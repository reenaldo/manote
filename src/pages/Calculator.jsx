import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import './Calculator.css'

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function inferProgram(studentNumber) {
  const { data: sg } = await supabase
    .from('student_grades')
    .select('matiere_code')
    .eq('student_number', studentNumber)
  if (!sg?.length) return null

  const matiereCodes = [...new Set(sg.map(r => r.matiere_code))]

  const { data: bm } = await supabase
    .from('bloc_matieres')
    .select('matiere_code, bloc_code')
    .in('matiere_code', matiereCodes)
  if (!bm?.length) return null

  const blocCodes = [...new Set(bm.map(r => r.bloc_code))]

  const { data: pb } = await supabase
    .from('program_blocs')
    .select('bloc_code, program')
    .in('bloc_code', blocCodes)
  if (!pb?.length) return null

  // For each matière, collect which programs it appears in
  const matiereToPrograms = {}
  for (const bmRow of bm) {
    const programs = pb.filter(p => p.bloc_code === bmRow.bloc_code).map(p => p.program)
    if (!matiereToPrograms[bmRow.matiere_code]) matiereToPrograms[bmRow.matiere_code] = new Set()
    for (const p of programs) matiereToPrograms[bmRow.matiere_code].add(p)
  }

  // Use the first matière that belongs to exactly one program (e.g. MI1JGMBF → siris only)
  // Shared matières like Compilation (4 programs) are ignored
  for (const programs of Object.values(matiereToPrograms)) {
    if (programs.size === 1) return [...programs][0]
  }

  return null // all matières are shared → can't infer, show picker
}

async function fetchData(student) {
  if (!student.program) {
    const inferred = await inferProgram(student.student_number)
    if (!inferred) return { blocs: null, noProgram: true }
    // Save inferred program so we don't repeat this lookup
    await supabase.from('students').upsert({
      student_number: student.student_number,
      first_name: student.first_name || null,
      last_name:  student.last_name  || null,
      program: inferred,
    }, { onConflict: 'student_number' })
    return fetchData({ ...student, program: inferred })
  }

  const { data: pb } = await supabase
    .from('program_blocs')
    .select('bloc_code, sort_order, ue_blocs(code, name, ects)')
    .eq('program', student.program)
    .order('sort_order')

  const blocCodes = (pb || []).map(r => r.bloc_code)
  if (!blocCodes.length) return { blocs: [] }

  const { data: bm } = await supabase
    .from('bloc_matieres')
    .select('bloc_code, matiere_code, coeff, sort_order, matieres(name)')
    .in('bloc_code', blocCodes)
    .order('sort_order')

  const matiereCodes = [...new Set((bm || []).map(r => r.matiere_code))]

  const [{ data: fields }, { data: grades }] = await Promise.all([
    supabase.from('matiere_fields')
      .select('matiere_code, field_name, label, coeff, sort_order, drop_lowest, max_grade')
      .in('matiere_code', matiereCodes)
      .order('sort_order'),
    supabase.from('student_grades')
      .select('matiere_code, field_name, grade')
      .eq('student_number', student.student_number),
  ])

  const savedGrades = {}
  for (const g of (grades || []))
    savedGrades[`${g.matiere_code}::${g.field_name}`] = g.grade

  const fieldsByMatiere = {}
  for (const f of (fields || [])) {
    if (!fieldsByMatiere[f.matiere_code]) fieldsByMatiere[f.matiere_code] = []
    fieldsByMatiere[f.matiere_code].push(f)
  }

  const bmByBloc = {}
  for (const r of (bm || [])) {
    if (!bmByBloc[r.bloc_code]) bmByBloc[r.bloc_code] = []
    bmByBloc[r.bloc_code].push(r)
  }

  const blocs = (pb || []).map(row => {
    const bloc = row.ue_blocs
    const matieres = (bmByBloc[bloc.code] || []).map(mr => ({
      code:   mr.matiere_code,
      name:   mr.matieres.name,
      coeff:  Number(mr.coeff),
      fields: (fieldsByMatiere[mr.matiere_code] || []).map(f => ({
        matiere_code: f.matiere_code,
        field_name:   f.field_name,
        label:        f.label,
        coeff:        Number(f.coeff),
        drop_lowest:  f.drop_lowest ?? false,
        max_grade:    Number(f.max_grade ?? 20),
      })),
    }))
    return { ...bloc, matieres }
  })

  return { blocs, savedGrades }
}

// ─── Compute ──────────────────────────────────────────────────────────────────

function compute(blocs, gradeValues) {
  if (!blocs) return { blocResults: [], moyenne: null }

  let totalEctsEarned = 0
  let totalEcts = 0

  const blocResults = blocs.map(bloc => {
    const matieres = bloc.matieres.map(m => {
      const fields = m.fields.map(f => {
        const raw    = gradeValues[`${f.matiere_code}::${f.field_name}`]
        const parsed = raw !== undefined && raw !== ''
          ? parseFloat(String(raw).replace(',', '.'))
          : null
        const max    = f.max_grade ?? 20
        const inRange = parsed !== null && !isNaN(parsed) && parsed >= 0 && parsed <= max
        const rawGrade = inRange ? parsed : 0
        // Convert to /20 scale
        const grade  = max !== 20 ? (rawGrade / max) * 20 : rawGrade
        const isEmpty = raw === undefined || raw === ''
        return { ...f, grade, rawGrade, isEmpty }
      })

      // Separate drop_lowest group from regular fields
      const dlFields  = fields.filter(f => f.drop_lowest)
      const regFields = fields.filter(f => !f.drop_lowest)

      let avg = 0
      let totalCoeff = regFields.reduce((s, f) => s + f.coeff, 0)
      let earned     = regFields.reduce((s, f) => s + f.grade * f.coeff, 0)

      if (dlFields.length > 0) {
        const filledDl = dlFields.filter(f => !f.isEmpty)
        if (filledDl.length > 0) {
          const sorted = [...filledDl].sort((a, b) => a.grade - b.grade)
          if (sorted.length > 1) sorted.shift() // drop lowest only if more than 1
          const dlAvg = sorted.reduce((s, f) => s + f.grade, 0) / sorted.length
          totalCoeff += 1
          earned     += dlAvg * 1
        }
      }

      avg = totalCoeff > 0 ? earned / totalCoeff : 0

      return { ...m, fields, avg }
    })

    const totalMCoeff = matieres.reduce((s, m) => s + m.coeff, 0)
    const earnedM     = matieres.reduce((s, m) => s + m.avg * m.coeff, 0)
    const avg         = totalMCoeff > 0 ? earnedM / totalMCoeff : 0

    totalEctsEarned += avg * bloc.ects
    totalEcts       += bloc.ects

    return { ...bloc, matieres, avg }
  })

  const moyenne = totalEcts > 0 ? totalEctsEarned / totalEcts : null
  return { blocResults, moyenne }
}

// ─── Programs ─────────────────────────────────────────────────────────────────

const PROGRAMS = [
  { code: 'siris', label: 'SIRIS', name: 'Réseaux & Systèmes' },
  { code: 'codia', label: 'CODIA', name: 'Données & IA' },
  { code: 'sil',   label: 'SIL',   name: 'Ingénierie Logiciel' },
  { code: 'i3d',   label: 'I3D',   name: 'Image & 3D' },
]

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Calculator({ student }) {
  const [blocs,       setBlocs]       = useState(null)
  const [gradeValues, setGradeValues] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [noProgram,   setNoProgram]   = useState(false)
  const [openBloc,    setOpenBloc]    = useState(null)

  const load = useCallback(async (s) => {
    setLoading(true)
    const result = await fetchData(s)
    if (result.noProgram) { setNoProgram(true); setLoading(false); return }
    setBlocs(result.blocs)
    setGradeValues(
      Object.fromEntries(Object.entries(result.savedGrades || {}).map(([k, v]) => [k, String(v)]))
    )
    setNoProgram(false)
    setLoading(false)
  }, [])

  useEffect(() => { load(student) }, [student, load])

  const handleProgramSelect = async (code) => {
    await supabase.from('students').upsert({
      student_number: student.student_number,
      first_name: student.first_name || null,
      last_name:  student.last_name  || null,
      program: code,
    }, { onConflict: 'student_number' })
    load({ ...student, program: code })
  }

  const setGrade = (key, value) =>
    setGradeValues(prev => ({ ...prev, [key]: value }))

  const { blocResults, moyenne } = compute(blocs, gradeValues)
  const displayName = [student.last_name, student.first_name].filter(Boolean).join(' ') || student.student_number

  if (loading) return <div className="calc-loading">Chargement…</div>

  if (noProgram) return (
    <div className="no-program">
      <div className="page-header">
        <h1 className="page-title">Choisissez votre parcours</h1>
        <p className="page-sub">Nous n'avons pas trouvé votre programme. Sélectionnez-le pour continuer.</p>
      </div>
      <div className="program-pick">
        {PROGRAMS.map(p => (
          <button key={p.code} className="program-pick-btn" onClick={() => handleProgramSelect(p.code)}>
            <span className="program-pick-code">{p.label}</span>
            <span className="program-pick-name">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="calculator">

      {/* Moyenne card */}
      <div className="moyenne-card">
        <div className="moyenne-card-meta">
          <span className="moyenne-card-label">Moyenne générale · S1</span>
          <div className="moyenne-card-name-row">
            <span className="moyenne-card-student">{displayName}</span>
            {student.program && <span className="nav-student-tag">{student.program.toUpperCase()}</span>}
          </div>
          <span className="moyenne-card-hint">Les notes vides comptent comme 0.</span>
        </div>
        <div className="moyenne-card-right">
          <div className="moyenne-score">
            <span className="moyenne-value">{moyenne.toFixed(3)}</span>
            <span className="moyenne-denom">/20</span>
          </div>
          {moyenne >= 10 && (
            <span className="moyenne-badge pass">Validé</span>
          )}
        </div>
      </div>

      {/* UE Blocs */}
      <div className="blocs">
        {blocResults.map((bloc, i) => (
          <BlocRow key={bloc.code} bloc={bloc} gradeValues={gradeValues} onGrade={setGrade}
            open={openBloc === i} onToggle={() => setOpenBloc(v => v === i ? null : i)} />
        ))}
      </div>

    </div>
  )
}

// ─── Collapsible bloc row ─────────────────────────────────────────────────────

function BlocRow({ bloc, gradeValues, onGrade, open, onToggle }) {
  return (
    <div className={`bloc ${open ? 'open' : ''}`}>
      <button className="bloc-header" onClick={onToggle}>
        <div className="bloc-header-left">
          <span className="bloc-name">{bloc.name}</span>
          <span className="ects-tag">{bloc.ects} ECTS</span>
        </div>
        <div className="bloc-avg-wrap">
          {bloc.avg !== null ? (
            <>
              <span className={`bloc-avg ${bloc.avg < 10 ? 'fail' : 'pass'}`}>{bloc.avg.toFixed(3)}</span>
              {bloc.avg >= 10 && (
                <span className="bloc-status pass">Validé</span>
              )}
            </>
          ) : (
            <span className="bloc-avg incomplete">—</span>
          )}
        </div>
      </button>

      {open && (
        <div className="bloc-body">
          {bloc.matieres.map(m => (
            <MatiereSection key={m.code} matiere={m} gradeValues={gradeValues} onGrade={onGrade} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Matière section ──────────────────────────────────────────────────────────

function MatiereSection({ matiere: m, gradeValues, onGrade }) {
  const dlFields  = m.fields.filter(f => f.drop_lowest)
  const regFields = m.fields.filter(f => !f.drop_lowest)

  // Compute QCM final note for display (ignore empty, drop lowest, average remaining, /20)
  let qcmFinal = null
  if (dlFields.length > 0) {
    const converted = dlFields
      .map(f => {
        const raw = gradeValues[`${f.matiere_code}::${f.field_name}`]
        if (raw === undefined || raw === '') return null
        const parsed = parseFloat(String(raw).replace(',', '.'))
        if (isNaN(parsed)) return null
        const max = f.max_grade ?? 20
        return (parsed / max) * 20
      })
      .filter(v => v !== null)

    if (converted.length > 0) {
      const sorted = [...converted].sort((a, b) => a - b)
      if (sorted.length > 1) sorted.shift() // drop lowest only if more than 1
      qcmFinal = sorted.reduce((s, g) => s + g, 0) / sorted.length
    } else {
      qcmFinal = 0
    }
  }

  return (
    <div className="matiere">
      <div className="matiere-header">
        <span className="matiere-name">{m.name}</span>
        {m.avg !== null ? (
          <span className={`matiere-avg ${m.avg < 10 ? 'fail' : 'pass'}`}>{m.avg.toFixed(3)}</span>
        ) : (
          <span className="matiere-avg incomplete">—</span>
        )}
      </div>

      {/* QCM inline row */}
      {dlFields.length > 0 && (
        <div className="field-row qcm-row">
          <span className="field-label">Moyenne QCM</span>
          <div className="qcm-inputs">
            {(() => {
              const parsed = dlFields.map(f => {
                const val = gradeValues[`${f.matiere_code}::${f.field_name}`] ?? ''
                return val === '' ? null : parseFloat(String(val).replace(',', '.'))
              })
              const filled = parsed.filter(v => v !== null)
              const minVal = filled.length > 0 ? Math.min(...filled) : null
              // Track if we've already marked one as lowest (in case of ties)
              let lowestMarked = false

              return dlFields.map((f, i) => {
                const key   = `${f.matiere_code}::${f.field_name}`
                const val   = gradeValues[key] ?? ''
                const empty = val === ''
                const max   = f.max_grade ?? 20
                const num   = parsed[i]
                const isLowest = !empty && num === minVal && !lowestMarked
                if (isLowest) lowestMarked = true
                const handleBlur = () => {
                  if (val === '') return
                  const p = parseFloat(String(val).replace(',', '.'))
                  if (isNaN(p)) { onGrade(key, ''); return }
                  onGrade(key, Math.min(max, Math.max(0, p)).toFixed(1))
                }
                return (
                  <input
                    key={f.field_name}
                    className={`field-input qcm-input ${empty ? 'empty' : isLowest ? 'fail' : 'filled'}`}
                    type="text" inputMode="decimal" placeholder="—"
                    title={f.label}
                    value={val}
                    onChange={e => onGrade(key, e.target.value)}
                    onBlur={handleBlur}
                  />
                )
              })
            })()}
          </div>
          <span className="field-input qcm-final-value filled">
            {qcmFinal.toFixed(3)}
          </span>
        </div>
      )}

      {/* Regular fields */}
      <div className="fields">
        {regFields.map(f => {
          const key      = `${f.matiere_code}::${f.field_name}`
          const val      = gradeValues[key] ?? ''
          const empty    = val === ''
          const maxGrade = f.max_grade ?? 20
          const num      = empty ? 0 : parseFloat(String(val).replace(',', '.'))
          const numOn20  = maxGrade !== 20 ? (num / maxGrade) * 20 : num
          const fail     = !empty && numOn20 < 10
          const handleBlur = () => {
            if (val === '') return
            const parsed = parseFloat(String(val).replace(',', '.'))
            if (isNaN(parsed)) { onGrade(key, ''); return }
            const clamped = Math.min(maxGrade, Math.max(0, parsed))
            onGrade(key, clamped.toFixed(maxGrade === 20 ? 3 : 1))
          }
          return (
            <div key={f.field_name} className="field-row">
              <span className="field-label">{f.label}</span>
              <span className="field-coeff">×{f.coeff}</span>
              <input
                className={`field-input ${empty ? 'empty' : fail ? 'fail' : 'filled'}`}
                type="text" inputMode="decimal" placeholder="—"
                value={val}
                onChange={e => onGrade(key, e.target.value)}
                onBlur={handleBlur}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
