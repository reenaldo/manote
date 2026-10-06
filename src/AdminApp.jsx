import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Upload from './pages/Upload'

function NavShell({ children, onLogout }) {
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-logo">
          MANOTE · Admin
        </div>
        {onLogout && <button className="nav-admin" onClick={onLogout}>Déconnexion</button>}
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}

export default function AdminApp() {
  const [session,     setSession]     = useState(undefined)
  const [role,        setRole]        = useState(null)
  const [isInvite,    setIsInvite]    = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [error,       setError]       = useState(null)
  const [loading,     setLoading]     = useState(false)

  useEffect(() => {
    // Detect invite token in URL hash
    const hash = window.location.hash
    if (hash.includes('type=invite') || hash.includes('type=recovery')) {
      setIsInvite(true)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchRole(session.user.id)
      else setRole(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchRole = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()
    setRole(data?.role ?? 'student')
  }

  const handleSetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setError(error.message); setLoading(false); return }
    setIsInvite(false)
    window.location.hash = ''
    setLoading(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleLogout = () => {
    supabase.auth.signOut()
    setRole(null)
  }

  // Loading
  if (session === undefined) return (
    <NavShell>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Chargement…</p>
    </NavShell>
  )

  // Invite — set password
  if (isInvite && session) return (
    <NavShell>
      <div className="admin-login">
        <div className="page-header">
          <h1 className="page-title">Créez votre mot de passe</h1>
          <p className="page-sub">Choisissez un mot de passe pour votre compte admin.</p>
        </div>
        <form className="login-form" onSubmit={handleSetPassword}>
          <div className="login-field">
            <label className="login-label">Nouveau mot de passe</label>
            <input className="login-input" type="password" autoFocus required
              minLength={8} placeholder="8 caractères minimum"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Enregistrement…' : 'Définir le mot de passe'}
          </button>
        </form>
      </div>
    </NavShell>
  )

  // Not logged in → login form
  if (!session) return (
    <NavShell>
      <div className="admin-login">
        <div className="page-header">
          <h1 className="page-title">Connexion admin</h1>
          <p className="page-sub">Accès réservé aux administrateurs.</p>
        </div>
        <form className="login-form" onSubmit={handleLogin}>
          <div className="login-field">
            <label className="login-label">Email</label>
            <input className="login-input" type="email" value={email} autoFocus required
              onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="login-field">
            <label className="login-label">Mot de passe</label>
            <input className="login-input" type="password" value={password} required
              onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button className="btn-primary login-btn" type="submit" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </NavShell>
  )

  // Logged in but not admin
  if (role && role !== 'admin') return (
    <NavShell onLogout={handleLogout}>
      <div className="page-header">
        <h1 className="page-title">Accès refusé</h1>
        <p className="page-sub">Votre compte n'a pas les droits administrateur.</p>
      </div>
    </NavShell>
  )

  // Waiting for role to load
  if (!role) return (
    <NavShell>
      <p style={{ color: 'var(--muted)', fontSize: 13 }}>Vérification des droits…</p>
    </NavShell>
  )

  // Admin ✓
  return (
    <NavShell onLogout={handleLogout}>
      <Upload />
    </NavShell>
  )
}
