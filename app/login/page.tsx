'use client'

import { useActionState } from 'react'
import { iniciarSesion } from './actions'

export default function LoginPage() {
  const [error, entrar, enviando] = useActionState(iniciarSesion, null)
  return <main className="login-page"><section className="card login-card"><img className="brand-logo login-logo" src="/logo-glauss.png" alt="Glauss Shop" /><p className="eyebrow">CRM INTERNO</p><h1>Entrar</h1><p className="heading-subtitle">Ingresá con tu email y contraseña.</p><form action={entrar} className="login-form"><label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required autoFocus /></label><label className="field"><span>Contraseña</span><input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="login-error" role="alert">{error}</p>}<button className="quick-button login-button" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button></form></section></main>
}
