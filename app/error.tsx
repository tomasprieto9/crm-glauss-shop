'use client'

import { useEffect, useState } from 'react'

const CLAVE = 'glauss-reintentos'

// Si algo no carga (por ejemplo, se cortó internet un momento), se recarga solo hasta 2 veces por minuto;
// si sigue fallando, se muestra un botón para reintentar.
export default function ErrorDeCarga() {
  const [reintentando, setReintentando] = useState(true)
  useEffect(() => {
    let registro = { veces: 0, desde: Date.now() }
    try {
      const guardado = JSON.parse(sessionStorage.getItem(CLAVE) ?? 'null')
      if (guardado && Date.now() - guardado.desde < 60_000) registro = guardado
    } catch {}
    if (registro.veces >= 2) { setReintentando(false); return }
    try { sessionStorage.setItem(CLAVE, JSON.stringify({ ...registro, veces: registro.veces + 1 })) } catch {}
    const espera = setTimeout(() => window.location.reload(), 1200)
    return () => clearTimeout(espera)
  }, [])
  return <main className="login-page"><section className="card login-card"><img className="brand-logo login-logo" src="/logo-glauss.png" alt="Glauss Shop" /><p className="eyebrow">CRM INTERNO</p><h1>{reintentando ? 'Cargando…' : 'No se pudo cargar'}</h1><p className="heading-subtitle">{reintentando ? 'Hubo un problema de conexión. Reintentando solo…' : 'Revisá que tengas internet y tocá Reintentar.'}</p>{!reintentando && <button className="quick-button login-button" onClick={() => { try { sessionStorage.removeItem(CLAVE) } catch {} window.location.reload() }}>Reintentar</button>}</section></main>
}
