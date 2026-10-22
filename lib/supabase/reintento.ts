// Al renovar la sesión (pasa al abrir el CRM después de un rato), la base a veces rechaza por un instante la sesión
// nueva con "JWT issued at future": el servidor que la firma y el de la base tienen una diferencia mínima de reloj.
// En ese caso se espera un poco y se reintenta, en vez de mostrar un error que obliga a recargar la página.
const ESPERAS_MS = [400, 900, 1800]

export function fetchConReintento(fetchBase: typeof fetch = fetch): typeof fetch {
  return async (entrada, opciones) => {
    for (let intento = 0; ; intento++) {
      const respuesta = await fetchBase(entrada, opciones)
      if (respuesta.ok || intento >= ESPERAS_MS.length || (respuesta.status !== 401 && respuesta.status !== 403)) return respuesta
      const texto = await respuesta.clone().text().catch(() => '')
      if (!texto.includes('issued at future')) return respuesta
      await new Promise(listo => setTimeout(listo, ESPERAS_MS[intento]))
    }
  }
}
