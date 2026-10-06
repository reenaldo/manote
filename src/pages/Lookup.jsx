import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Lookup.css'

export default function Lookup({ onFound }) {
  const [value,      setValue]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [notFound,   setNotFound]   = useState(false)

  // Name-completion step
  const [pendingStudent, setPendingStudent] = useState(null)
  const [firstName,      setFirstName]      = useState('')
  const [lastName,       setLastName]       = useState('')
  const [savingName,     setSavingName]     = useState(false)


  const handleSubmit = async (e) => {
    e.preventDefault()
    const num = value.trim()
    if (!num) return

    if (!/^\d{8}$/.test(num)) {
      setError('Le numéro étudiant doit contenir exactement 8 chiffres.')
      return
    }

    setLoading(true)
    setError(null)
    setNotFound(false)

    const { data, error: err } = await supabase
      .from('students')
      .select('student_number, first_name, last_name, program')
      .eq('student_number', num)
      .maybeSingle()

    setLoading(false)

    if (err) { setError('Erreur de connexion.'); return }

    if (!data) {
      setNotFound(true)
      return
    }

    // Found but no name → ask for it
    if (!data.first_name && !data.last_name) {
      setPendingStudent(data)
      return
    }

    onFound(data)
  }

  const handleContinueAnyway = () => {
    onFound({ student_number: value.trim(), first_name: null, last_name: null, program: null })
  }

  const handleSaveName = async (e) => {
    e.preventDefault()
    setSavingName(true)

    const { error: err } = await supabase
      .from('students')
      .update({ first_name: firstName.trim() || null, last_name: lastName.trim() || null })
      .eq('student_number', pendingStudent.student_number)

    setSavingName(false)

    if (err) { setError('Erreur lors de la sauvegarde.'); return }

    onFound({ ...pendingStudent, first_name: firstName.trim() || null, last_name: lastName.trim() || null })
  }

  // ── Name-completion screen ─────────────────────────────────────
  if (pendingStudent) return (
    <div className="lookup">
      <div className="lookup-hero">
        <h1 className="lookup-title">Complétez votre profil</h1>
        <p className="lookup-sub">Nous n'avons pas encore votre nom. Ajoutez-le pour personnaliser votre espace.</p>
      </div>

      <form className="lookup-form lookup-name-form" onSubmit={handleSaveName}>
        <div className="lookup-name-fields">
          <input
            className="lookup-name-input"
            type="text"
            placeholder="Nom"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            autoFocus
          />
          <input
            className="lookup-name-input"
            type="text"
            placeholder="Prénom"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
          />
        </div>
        {error && <p className="lookup-error">{error}</p>}
        <div className="lookup-name-actions">
          <button className="lookup-btn lookup-name-btn" type="submit" disabled={savingName}>
            {savingName ? '…' : 'Continuer →'}
          </button>
          <button type="button" className="lookup-continue-btn"
            onClick={() => onFound(pendingStudent)}>
            Passer cette étape
          </button>
        </div>
      </form>
    </div>
  )

  // ── Main lookup screen ─────────────────────────────────────────
  return (
    <div className="lookup">
      <div className="lookup-hero">
        <h1 className="lookup-title">Calculez votre moyenne</h1>
        <p className="lookup-sub">Entrez votre numéro étudiant pour accéder à vos notes et calculer votre moyenne du semestre.</p>
      </div>

      <form className="lookup-form" onSubmit={handleSubmit}>
        <div className="lookup-input-wrap">
          <input
            className="lookup-input"
            type="text"
            placeholder="8 chiffres (ex: 20xxxxxx)"
            value={value}
            onChange={e => { setValue(e.target.value); setError(null); setNotFound(false) }}
            autoFocus
            inputMode="numeric"
          />
          <button className="lookup-btn" type="submit" disabled={loading || !value.trim()}>
            {loading ? '…' : 'Voir mes notes →'}
          </button>
        </div>
        {error && <p className="lookup-error">{error}</p>}
        {notFound && (
          <div className="lookup-not-found">
            <p className="lookup-error">Numéro étudiant introuvable dans notre base de données.</p>
            <button type="button" className="lookup-continue-btn" onClick={handleContinueAnyway}>
              Continuer quand même pour calculer ma moyenne →
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
