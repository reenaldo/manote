import { useState, useRef, useCallback, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { supabase } from '../lib/supabase'
import './Upload.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

// ─── PDF helpers ─────────────────────────────────────────────────────────────

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let fullText = ''
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    fullText += content.items.map(item => item.str).join(' ') + '\n'
  }
  return fullText
}

function parseStudentInfo(text) {
  const numMatch   = text.match(/\b(2\d{7})\b/)
  const nomMatch   = text.match(/[Nn]om\s*:?\s*([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜ\-]+)/u)
  const prenomMatch = text.match(/[Pp]r[eé]nom\s*:?\s*([A-ZÀÂÄÉÈÊËÎÏÔÙÛÜa-zàâäéèêëîïôùûü\-]+)/u)
  return {
    studentNumber: numMatch    ? numMatch[1]    : null,
    lastName:      nomMatch    ? nomMatch[1]    : null,
    firstName:     prenomMatch ? prenomMatch[1] : null,
  }
}

function detectProgram(text) {
  const t = text.toLowerCase()
  if (t.includes('siris'))                                              return 'siris'
  if (t.includes('codia'))                                              return 'codia'
  if (t.includes('image et 3d') || t.includes('i3d'))                  return 'i3d'
  if (t.includes('science et ingénierie du logiciel') || /\bsil\b/.test(t)) return 'sil'
  if (t.includes('mi1jg'))                                              return 'siris'
  if (t.includes('mi1kg') || t.includes('mi1tg'))                      return 'codia'
  if (t.includes('mi1lg'))                                              return 'sil'
  if (/mi1hgmb[fhi]/.test(t))                                          return 'i3d'
  return null
}

const GRADE_RE = /\b(\d{1,2}(?:[,.]\d+)?)\b/g

function extractGradeValues(text, startIdx, count) {
  const slice = text.slice(startIdx, startIdx + 600)
  const grades = []
  let m
  GRADE_RE.lastIndex = 0
  while ((m = GRADE_RE.exec(slice)) !== null && grades.length < count) {
    const v = parseFloat(m[1].replace(',', '.'))
    if (v >= 0 && v <= 20) grades.push(v)
  }
  return grades
}

function parseGrades(text, fieldsByMatiere) {
  const results = []
  for (const [code, fields] of Object.entries(fieldsByMatiere)) {
    const codeIdx = text.indexOf(code)
    if (codeIdx !== -1) {
      const values = extractGradeValues(text, codeIdx + code.length, fields.length)
      fields.forEach((f, i) => {
        if (values[i] !== undefined)
          results.push({ matiere_code: code, field_name: f.field_name, grade: values[i] })
      })
    } else {
      for (const f of fields) {
        const escaped = f.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = new RegExp(escaped + '[^\\d]{0,80}?(\\d{1,2}[,.]\\d|\\d{1,2})(?=\\D|$)', 'i')
        const m = text.match(re)
        if (m) {
          const v = parseFloat(m[1].replace(',', '.'))
          if (v >= 0 && v <= 20)
            results.push({ matiere_code: code, field_name: f.field_name, grade: v })
        }
      }
    }
  }
  return results
}

// ─── Bulk QCM helpers ─────────────────────────────────────────────────────────

function isBulkQcm(text) {
  const studentCount = (text.match(/\b2\d{7}\b/g) || []).length
  const hasQcm = /\bQCM\s+\d+\b/i.test(text)
  return studentCount >= 5 && hasQcm
}

function parseBulkQcm(text) {
  // Format (row-by-row from pdfjs):
  // [dates...] QCM 1 QCM 2 ... QCM N  studentNr grade1 grade2 ... gradeN  studentNr ...
  const tokens = text.split(/\s+/).filter(t => t)
  let i = 0

  // Scan header section: collect "QCM N" field names until the first student number
  const qcmFields = []
  while (i < tokens.length && !/^2\d{7}$/.test(tokens[i])) {
    if (/^qcm$/i.test(tokens[i]) && i + 1 < tokens.length && /^\d+$/.test(tokens[i + 1])) {
      qcmFields.push(`qcm${tokens[i + 1]}`)
      i += 2
    } else {
      i++
    }
  }

  // Parse data rows: each row starts with a student number then N grade tokens
  const studentNumbers = []
  const studentGrades = {}

  while (i < tokens.length) {
    if (!/^2\d{7}$/.test(tokens[i])) { i++; continue }

    const sn = tokens[i++]
    studentNumbers.push(sn)
    studentGrades[sn] = []

    let col = 0
    while (col < qcmFields.length && i < tokens.length) {
      const t = tokens[i]
      if (/^2\d{7}$/.test(t)) break // next student row starts
      i++
      if (t === 'ABS' || t === 'EXC') {
        col++ // absent/excused: skip column, no grade saved
      } else if (/^\d+(\.\d+)?$/.test(t)) {
        const grade = parseFloat(t)
        if (grade >= 0 && grade <= 20) {
          studentGrades[sn].push({ field_name: qcmFields[col], grade })
        }
        col++
      }
    }
  }

  const qcmBlocks = qcmFields.map((fieldName, idx) => ({ qcmNum: idx + 1, fieldName }))
  return { studentNumbers, qcmBlocks, studentGrades }
}

async function saveBulkGrades(matiereCode, studentGrades) {
  const studentNumbers = Object.keys(studentGrades)

  // Ensure students exist (don't overwrite existing names/program)
  await supabase.from('students').upsert(
    studentNumbers.map(sn => ({ student_number: sn })),
    { onConflict: 'student_number', ignoreDuplicates: true }
  )

  // Delete existing grades for this matière for these students
  await supabase.from('student_grades')
    .delete()
    .in('student_number', studentNumbers)
    .eq('matiere_code', matiereCode)

  // Insert new grades
  const rows = []
  for (const [studentNumber, grades] of Object.entries(studentGrades)) {
    for (const { field_name, grade } of grades) {
      rows.push({ student_number: studentNumber, matiere_code: matiereCode, field_name, grade })
    }
  }
  if (rows.length > 0) {
    const { error } = await supabase.from('student_grades').insert(rows)
    if (error) throw error
  }
  return rows.length
}

async function fetchFieldsByMatiere(program) {
  const { data: pb, error: e1 } = await supabase
    .from('program_blocs')
    .select('bloc_code')
    .eq('program', program)
  if (e1) throw e1

  const blocCodes = (pb || []).map(r => r.bloc_code)
  if (!blocCodes.length) return {}

  const { data: bm, error: e2 } = await supabase
    .from('bloc_matieres')
    .select('matiere_code, sort_order')
    .in('bloc_code', blocCodes)
  if (e2) throw e2

  const matiereCodes = [...new Set((bm || []).map(r => r.matiere_code))]
  if (!matiereCodes.length) return {}

  const { data: fields, error: e3 } = await supabase
    .from('matiere_fields')
    .select('matiere_code, field_name, label, sort_order')
    .in('matiere_code', matiereCodes)
    .order('sort_order')
  if (e3) throw e3

  const map = {}
  for (const f of (fields || [])) {
    if (!map[f.matiere_code]) map[f.matiere_code] = []
    map[f.matiere_code].push(f)
  }
  return map
}

async function saveGrades(student, program, grades) {
  await supabase.from('students').upsert({
    student_number: student.studentNumber,
    first_name: student.firstName || null,
    last_name:  student.lastName  || null,
    program,
  }, { onConflict: 'student_number' })

  await supabase.from('student_grades').delete().eq('student_number', student.studentNumber)

  if (grades.length > 0) {
    const { error } = await supabase.from('student_grades').insert(
      grades.map(g => ({
        student_number: student.studentNumber,
        matiere_code:   g.matiere_code,
        field_name:     g.field_name,
        grade:          g.grade,
      }))
    )
    if (error) throw error
  }
}

async function processAndUpload(file, overrides = {}, onStatus) {
  onStatus({ status: 'parsing' })
  let text
  try {
    text = overrides.text || await extractPdfText(file)
  } catch (err) {
    onStatus({ status: 'error', error: err.message })
    return
  }

  // ── Bulk class-wide QCM sheet ───────────────────────────────────────────────
  if (isBulkQcm(text)) {
    const bulk = overrides.bulk || parseBulkQcm(text)
    const matiereCode = overrides.matiereCode

    if (!matiereCode) {
      onStatus({ status: 'needs_input', missing: ['program', 'matiereCode'], text, bulk })
      return
    }

    onStatus({ status: 'uploading', bulk, matiereCode })
    try {
      const gradeCount = await saveBulkGrades(matiereCode, bulk.studentGrades)
      onStatus({ status: 'done', bulk, matiereCode, gradeCount })
    } catch (err) {
      onStatus({ status: 'error', error: err.message })
    }
    return
  }

  // ── Single-student PDF ──────────────────────────────────────────────────────
  const parsed  = parseStudentInfo(text)
  const student = {
    studentNumber: overrides.studentNumber || parsed.studentNumber,
    lastName:      overrides.lastName      || parsed.lastName,
    firstName:     overrides.firstName     || parsed.firstName,
  }
  const program = overrides.program || detectProgram(text)

  const missing = []
  if (!student.studentNumber) missing.push('studentNumber')
  if (!program)               missing.push('program')
  if (missing.length > 0) {
    onStatus({ status: 'needs_input', missing, student, program, text })
    return
  }

  let grades = []
  try {
    const fieldsByMatiere = await fetchFieldsByMatiere(program)
    grades = parseGrades(text, fieldsByMatiere)
    onStatus({ status: 'uploading', student, program, grades })
  } catch (err) {
    onStatus({ status: 'error', error: err.message, student, program })
    return
  }
  try {
    await saveGrades(student, program, grades)
    onStatus({ status: 'done', student, program, grades })
  } catch (err) {
    onStatus({ status: 'error', error: err.message, student, program, grades })
  }
}

// ─── Programs ────────────────────────────────────────────────────────────────

const PROGRAMS = [
  { code: 'siris', label: 'SIRIS' },
  { code: 'codia', label: 'CODIA' },
  { code: 'sil',   label: 'SIL' },
  { code: 'i3d',   label: 'I3D' },
]

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Upload() {
  const [mode, setMode] = useState('pdf')

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Import des notes</h1>
        <p className="page-sub">Importez un relevé PDF ou saisissez les notes manuellement.</p>
      </div>

      <div className="mode-toggle">
        <button className={mode === 'pdf' ? 'active' : ''} onClick={() => setMode('pdf')}>
          Import PDF
        </button>
        <button className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>
          Saisie manuelle
        </button>
      </div>

      {mode === 'pdf'    && <PdfImport />}
      {mode === 'manual' && <ManualEntry />}
    </div>
  )
}

// ─── PDF import ───────────────────────────────────────────────────────────────

function PdfImport() {
  const [dragging, setDragging] = useState(false)
  const [files,    setFiles]    = useState([])
  const inputRef = useRef()

  const updateEntry = useCallback((file, patch) => {
    setFiles(prev => prev.map(e => e.file === file ? { ...e, ...patch } : e))
  }, [])

  const handleFiles = useCallback((incoming) => {
    const pdfs = Array.from(incoming).filter(f => f.type === 'application/pdf')
    if (!pdfs.length) return
    setFiles(prev => [
      ...prev,
      ...pdfs.map(file => ({ file, status: 'parsing', student: null, program: null, grades: [] })),
    ])
    for (const file of pdfs)
      processAndUpload(file, {}, patch => updateEntry(file, patch))
  }, [updateEntry])

  const handleRetry = useCallback((file, overrides) => {
    updateEntry(file, { status: 'parsing' })
    processAndUpload(file, overrides, patch => updateEntry(file, patch))
  }, [updateEntry])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  return (
    <div>
      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf" multiple hidden
          onChange={e => handleFiles(e.target.files)} />
        <div className="dropzone-arrow">↑</div>
        <p className="dropzone-primary">
          Glisser les PDFs ici ou <span className="link">parcourir</span>
        </p>
        <p className="dropzone-hint">Enregistrement automatique · Plusieurs fichiers acceptés</p>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((entry, idx) => (
            <FileEntry
              key={idx}
              entry={entry}
              onRemove={() => setFiles(prev => prev.filter((_, i) => i !== idx))}
              onRetry={(overrides) => handleRetry(entry.file, overrides)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FileEntry({ entry, onRemove, onRetry }) {
  const [expanded,      setExpanded]      = useState(false)
  const [showPreview,   setShowPreview]   = useState(false)
  const [manualNum,     setManualNum]     = useState(entry.student?.studentNumber || '')
  const [manualProg,    setManualProg]    = useState(entry.program || '')
  const [manualMatiere, setManualMatiere] = useState('')
  const [matierePills,  setMatierePills]  = useState([])

  const isBulk = !!entry.bulk

  useEffect(() => {
    if (!isBulk || !manualProg) { setMatierePills([]); setManualMatiere(''); return }
    async function load() {
      const { data: pb } = await supabase.from('program_blocs').select('bloc_code').eq('program', manualProg)
      const blocCodes = (pb || []).map(r => r.bloc_code)
      if (!blocCodes.length) return

      const { data: bm } = await supabase.from('bloc_matieres')
        .select('matiere_code, matieres(name)').in('bloc_code', blocCodes)
      const matiereCodes = [...new Set((bm || []).map(r => r.matiere_code))]
      if (!matiereCodes.length) return

      const seen = new Set()
      const pills = []
      for (const r of (bm || [])) {
        if (!seen.has(r.matiere_code)) {
          seen.add(r.matiere_code)
          pills.push({ code: r.matiere_code, name: r.matieres.name })
        }
      }
      setMatierePills(pills)
    }
    load()
  }, [isBulk, manualProg])

  const doneLabel = isBulk
    ? `${entry.gradeCount} notes · ${entry.bulk.studentNumbers.length} étudiants`
    : `${entry.grades?.length ?? 0} note${(entry.grades?.length ?? 0) !== 1 ? 's' : ''} enregistrée${(entry.grades?.length ?? 0) !== 1 ? 's' : ''}`

  const statusLabel = {
    parsing:      'Analyse…',
    uploading:    'Enregistrement…',
    done:         doneLabel,
    error:        entry.error,
    needs_input:  isBulk ? `${entry.bulk?.studentNumbers?.length} étudiants · code matière requis` : 'Informations manquantes',
  }[entry.status] ?? ''

  const canRemove = entry.status !== 'parsing' && entry.status !== 'uploading'

  return (
    <div className={`file-entry ${entry.status}`}>
      <div className="file-entry-header">
        <div className="file-entry-left">
          <div className={`file-status-dot ${entry.status}`} />
          <div className="file-entry-info">
            <span className="file-name">{entry.file.name}</span>
            {isBulk && entry.matiereCode && (
              <span className="file-meta">{entry.matiereCode} · {entry.bulk.qcmBlocks.length} QCM</span>
            )}
            {!isBulk && entry.student?.studentNumber && (
              <span className="file-meta">
                {entry.student.studentNumber}
                {entry.student.lastName  ? ` · ${entry.student.lastName}`  : ''}
                {entry.student.firstName ? ` ${entry.student.firstName}` : ''}
                {entry.program           ? ` · ${entry.program.toUpperCase()}` : ''}
              </span>
            )}
            <span className={`file-status-label ${entry.status}`}>{statusLabel}</span>
          </div>
        </div>

        <div className="file-entry-actions">
          {(entry.grades?.length > 0 || (isBulk && entry.status === 'done')) && (
            <button className="btn-ghost" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Masquer' : 'Aperçu'}
            </button>
          )}
          {canRemove && (
            <button className="btn-ghost danger" onClick={onRemove}>Retirer</button>
          )}
        </div>
      </div>

      {entry.status === 'needs_input' && (
        <div className="needs-input-form">
          {/* Programme — shown for both bulk and single-student */}
          {entry.missing?.includes('program') && (
            <div className="needs-input-field">
              <label className="needs-input-label">Programme</label>
              <div className="program-pills">
                {PROGRAMS.map(p => (
                  <button key={p.code}
                    className={`pill ${manualProg === p.code ? 'active' : ''}`}
                    onClick={() => setManualProg(p.code)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* UE / Matière — bulk: dynamic pills from DB; single: text input */}
          {entry.missing?.includes('matiereCode') && (
            <div className="needs-input-field">
              <label className="needs-input-label">UE / Matière</label>
              {isBulk ? (
                !manualProg ? (
                  <span className="needs-input-hint">Sélectionnez un programme d'abord</span>
                ) : matierePills.length === 0 ? (
                  <span className="needs-input-hint">Chargement…</span>
                ) : (
                  <div className="program-pills">
                    {matierePills.map(m => (
                      <button key={m.code}
                        className={`pill ${manualMatiere === m.code ? 'active' : ''}`}
                        onClick={() => setManualMatiere(m.code)}>
                        <span style={{ fontWeight: 600 }}>{m.code}</span>
                        <span style={{ fontWeight: 400, opacity: 0.7, marginLeft: 6 }}>{m.name}</span>
                      </button>
                    ))}
                  </div>
                )
              ) : (
                <input className="form-input" type="text" placeholder="MI1JGMBF"
                  value={manualMatiere} onChange={e => setManualMatiere(e.target.value.toUpperCase())} />
              )}
            </div>
          )}

          {/* Student number — single-student only */}
          {entry.missing?.includes('studentNumber') && (
            <div className="needs-input-field">
              <label className="needs-input-label">Numéro étudiant</label>
              <input className="form-input" type="text" placeholder="20xxxxxx"
                value={manualNum} onChange={e => setManualNum(e.target.value)} />
            </div>
          )}

          {/* Bulk preview table */}
          {isBulk && showPreview && entry.bulk && manualMatiere && (
            <div className="grades-preview-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
              <table className="grades-preview">
                <thead>
                  <tr>
                    <th>Étudiant</th>
                    {entry.bulk.qcmBlocks.map(b => <th key={b.fieldName}>{b.fieldName.toUpperCase()}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {entry.bulk.studentNumbers.map(sn => {
                    const grades = entry.bulk.studentGrades[sn] || []
                    return (
                      <tr key={sn}>
                        <td>{sn}</td>
                        {entry.bulk.qcmBlocks.map(b => {
                          const g = grades.find(g => g.field_name === b.fieldName)
                          return <td key={b.fieldName}>{g ? g.grade : '—'}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {isBulk ? (
            !showPreview ? (
              <button className="btn-primary" style={{ marginTop: 4 }}
                disabled={!manualMatiere.trim() || !manualProg}
                onClick={() => setShowPreview(true)}>
                Voir les notes →
              </button>
            ) : (
              <button className="btn-primary" style={{ marginTop: 4 }}
                onClick={() => onRetry({ text: entry.text, bulk: entry.bulk, matiereCode: manualMatiere.trim() })}>
                Confirmer l'import →
              </button>
            )
          ) : (
            <button className="btn-primary" style={{ marginTop: 4 }}
              disabled={
                (entry.missing?.includes('studentNumber') && !manualNum.trim()) ||
                (entry.missing?.includes('program') && !manualProg)
              }
              onClick={() => onRetry({
                text:          entry.text,
                studentNumber: manualNum.trim()  || entry.student?.studentNumber,
                program:       manualProg         || entry.program,
                lastName:      entry.student?.lastName,
                firstName:     entry.student?.firstName,
              })}>
              Continuer →
            </button>
          )}
        </div>
      )}

      {expanded && !isBulk && entry.grades?.length > 0 && (
        <div className="grades-preview-wrap">
          <table className="grades-preview">
            <thead>
              <tr><th>Matière</th><th>Champ</th><th>Note</th></tr>
            </thead>
            <tbody>
              {entry.grades.map((g, i) => (
                <tr key={i}>
                  <td>{g.matiere_code}</td>
                  <td>{g.field_name}</td>
                  <td>{g.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && isBulk && entry.bulk && (
        <div className="grades-preview-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
          <table className="grades-preview">
            <thead>
              <tr>
                <th>Étudiant</th>
                {entry.bulk.qcmBlocks.map(b => <th key={b.fieldName}>{b.fieldName.toUpperCase()}</th>)}
              </tr>
            </thead>
            <tbody>
              {entry.bulk.studentNumbers.map(sn => {
                const grades = entry.bulk.studentGrades[sn] || []
                return (
                  <tr key={sn}>
                    <td>{sn}</td>
                    {entry.bulk.qcmBlocks.map(b => {
                      const g = grades.find(g => g.field_name === b.fieldName)
                      return <td key={b.fieldName}>{g ? g.grade : '—'}</td>
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Manual entry ─────────────────────────────────────────────────────────────

function ManualEntry() {
  const [program,       setProgram]       = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [lastName,      setLastName]      = useState('')
  const [firstName,     setFirstName]     = useState('')
  const [structure,     setStructure]     = useState(null)
  const [gradeValues,   setGradeValues]   = useState({})
  const [saving,        setSaving]        = useState(false)
  const [saveState,     setSaveState]     = useState(null) // null | 'ok' | string(error)

  // Auto-fill from existing student
  useEffect(() => {
    if (studentNumber.length < 8) return
    supabase.from('students').select('*').eq('student_number', studentNumber).maybeSingle()
      .then(({ data }) => {
        if (!data) return
        if (data.last_name)  setLastName(data.last_name)
        if (data.first_name) setFirstName(data.first_name)
        if (data.program)    setProgram(data.program)
      })
  }, [studentNumber])

  // Load program structure
  useEffect(() => {
    if (!program) { setStructure(null); return }
    setStructure(null)

    Promise.all([
      supabase.from('program_blocs')
        .select('bloc_code, sort_order, ue_blocs(code, name, ects)')
        .eq('program', program)
        .order('sort_order'),
      supabase.from('program_blocs')
        .select('bloc_code')
        .eq('program', program),
    ]).then(async ([{ data: pb }, { data: pbCodes }]) => {
      const blocCodes = (pbCodes || []).map(r => r.bloc_code)
      const { data: bmRows } = await supabase
        .from('bloc_matieres')
        .select('bloc_code, matiere_code, sort_order, coeff, matieres(name)')
        .in('bloc_code', blocCodes)

      // Reshape bmData to match the old structure
      const bmData = (pb || []).map(row => ({
        bloc_code: row.bloc_code,
        bloc_matieres: (bmRows || []).filter(bm => bm.bloc_code === row.bloc_code),
      }))

      const matiereCodes = [...new Set(
        (bmRows || []).map(bm => bm.matiere_code)
      )]
      const { data: fields } = await supabase
        .from('matiere_fields')
        .select('matiere_code, field_name, label, coeff, sort_order')
        .in('matiere_code', matiereCodes)
        .order('sort_order')

      const fieldsByMatiere = {}
      for (const f of (fields || [])) {
        if (!fieldsByMatiere[f.matiere_code]) fieldsByMatiere[f.matiere_code] = []
        fieldsByMatiere[f.matiere_code].push(f)
      }

      const bmByBloc = {}
      for (const r of (bmData || []))
        bmByBloc[r.bloc_code] = r.bloc_matieres.sort((a, b) => a.sort_order - b.sort_order)

      setStructure((pb || []).map(row => ({
        bloc: row.ue_blocs,
        matieres: (bmByBloc[row.bloc_code] || []).map(bm => ({
          code:   bm.matiere_code,
          name:   bm.matieres.name,
          fields: fieldsByMatiere[bm.matiere_code] || [],
        })),
      })))
    })
  }, [program])

  // Pre-load existing grades
  useEffect(() => {
    if (studentNumber.length < 8 || !program) return
    supabase.from('student_grades').select('matiere_code, field_name, grade')
      .eq('student_number', studentNumber)
      .then(({ data }) => {
        if (!data?.length) return
        const map = {}
        for (const g of data) map[`${g.matiere_code}::${g.field_name}`] = String(g.grade)
        setGradeValues(map)
      })
  }, [studentNumber, program])

  const setGrade = (matiereCode, fieldName, value) => {
    setGradeValues(prev => ({ ...prev, [`${matiereCode}::${fieldName}`]: value }))
    setSaveState(null)
  }

  const handleSave = async () => {
    if (!studentNumber || !program) return
    setSaving(true)
    setSaveState(null)
    try {
      const grades = []
      for (const [key, val] of Object.entries(gradeValues)) {
        if (!val) continue
        const v = parseFloat(val.replace(',', '.'))
        if (isNaN(v) || v < 0 || v > 20) continue
        const [matiere_code, field_name] = key.split('::')
        grades.push({ matiere_code, field_name, grade: v })
      }
      await saveGrades(
        { studentNumber, firstName: firstName || null, lastName: lastName || null },
        program,
        grades
      )
      setSaveState('ok')
    } catch (err) {
      setSaveState(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="manual-entry">

      {/* Student form */}
      <div className="grade-bloc">
        <div className="grade-bloc-header">
          <span className="grade-bloc-name">Étudiant</span>
        </div>
        <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-field">
            <label className="form-label">N° étudiant</label>
            <input className="form-input" type="text" placeholder="20xxxxxx"
              value={studentNumber} onChange={e => { setStudentNumber(e.target.value); setSaveState(null) }} />
          </div>
          <div className="form-field">
            <label className="form-label">Programme</label>
            <div className="program-pills">
              {PROGRAMS.map(p => (
                <button key={p.code}
                  className={`pill ${program === p.code ? 'active' : ''}`}
                  onClick={() => { setProgram(p.code); setSaveState(null) }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Nom</label>
            <input className="form-input" type="text" placeholder="DUPONT"
              value={lastName} onChange={e => { setLastName(e.target.value); setSaveState(null) }} />
          </div>
          <div className="form-field">
            <label className="form-label">Prénom</label>
            <input className="form-input" type="text" placeholder="Jean"
              value={firstName} onChange={e => { setFirstName(e.target.value); setSaveState(null) }} />
          </div>
        </div>
      </div>

      {/* Grade form */}
      {program && !structure && <p className="text-muted">Chargement…</p>}

      {structure && (
        <div className="grade-form">
          {structure.map(({ bloc, matieres }) => (
            <div key={bloc.code} className="grade-bloc">
              <div className="grade-bloc-header">
                <span className="grade-bloc-name">{bloc.name}</span>
                <span className="grade-ects">{bloc.ects} ECTS</span>
              </div>
              {matieres.map(m => (
                <div key={m.code} className="grade-matiere">
                  <div className="grade-matiere-name">{m.name}</div>
                  <div className="grade-fields">
                    {m.fields.map(f => (
                      <div key={f.field_name} className="grade-field-row">
                        <label className="grade-field-label">
                          {f.label}
                          <span className="coeff-badge">×{f.coeff}</span>
                        </label>
                        <input
                          className="grade-input"
                          type="number"
                          min="0" max="20" step="0.5"
                          placeholder="—"
                          value={gradeValues[`${m.code}::${f.field_name}`] ?? ''}
                          onChange={e => setGrade(m.code, f.field_name, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}

          <div className="save-row">
            {saveState === 'ok' && <span className="save-msg ok">Enregistré</span>}
            {saveState && saveState !== 'ok' && <span className="save-msg error">{saveState}</span>}
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !studentNumber || !program}
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
