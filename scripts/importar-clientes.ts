// Importa data/clientes_import.csv a la tabla clientes: upsert por teléfono con la service role key.
// Uso: node --env-file=.env.local scripts/importar-clientes.ts [ruta.csv]
// Solo escribe nombre, telefono, segmento, zona, notas y nombre_original. Si el cliente ya existe,
// no toca consentimiento, edad_verificada ni estado_campana, así que se puede volver a correr.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const COLUMNAS = ['nombre', 'telefono', 'segmento', 'zona', 'notas', 'nombre_original']
const SEGMENTOS = ['cliente', 'no_compro', 'publicidad', 'comercio', 'comercio_prospecto']
const ZONAS = ['la_plata', 'amba', 'interior', 'exterior']
const TAMANO_LOTE = 500

// CSV estándar: campos entre comillas, comillas dobles escapadas y saltos de línea dentro de comillas.
function parsearCsv(texto: string) {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let entreComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') entreComillas = false
      else campo += c
    } else if (c === '"') entreComillas = true
    else if (c === ',') { fila.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo); filas.push(fila); fila = []; campo = ''
    } else campo += c
  }
  if (campo !== '' || fila.length > 0) { fila.push(campo); filas.push(fila) }
  return filas
}

async function importar(ruta: string) {
  const [encabezado, ...filas] = parsearCsv(readFileSync(ruta, 'utf8').replace(/^﻿/, ''))
  if (encabezado?.join(',') !== COLUMNAS.join(',')) {
    throw new Error(`El encabezado tiene que ser exactamente: ${COLUMNAS.join(',')}`)
  }

  const errores: string[] = []
  const clientes = filas
    .map((fila, i) => ({ fila, numero: i + 2 }))
    .filter(({ fila }) => fila.some(campo => campo.trim() !== ''))
    .map(({ fila, numero }) => {
      if (fila.length !== COLUMNAS.length) errores.push(`fila ${numero}: tiene ${fila.length} columnas en vez de ${COLUMNAS.length}`)
      const [nombre, telefono, segmento, zona, notas, nombreOriginal] = fila.map(campo => campo.trim())
      if (!nombre) errores.push(`fila ${numero}: falta el nombre`)
      if (!/^\+\d{8,15}$/.test(telefono ?? '')) errores.push(`fila ${numero}: el teléfono no está en formato E.164`)
      if (!SEGMENTOS.includes(segmento)) errores.push(`fila ${numero}: segmento desconocido "${segmento}"`)
      if (zona && !ZONAS.includes(zona)) errores.push(`fila ${numero}: zona desconocida "${zona}"`)
      return { nombre, telefono, segmento, zona: zona || null, notas: notas || null, nombre_original: nombreOriginal || null }
    })

  const vistos = new Set<string>()
  for (const cliente of clientes) {
    if (vistos.has(cliente.telefono)) errores.push(`teléfono repetido en el archivo (${cliente.nombre})`)
    vistos.add(cliente.telefono)
  }

  if (errores.length > 0) {
    console.error(`No se importó nada: ${errores.length} problema(s) en ${ruta}`)
    errores.slice(0, 20).forEach(error => console.error(`  - ${error}`))
    process.exitCode = 1
    return
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  for (let i = 0; i < clientes.length; i += TAMANO_LOTE) {
    const lote = clientes.slice(i, i + TAMANO_LOTE)
    const { error } = await supabase.from('clientes').upsert(lote, { onConflict: 'telefono' })
    if (error) throw new Error(`Falló el lote que empieza en la fila ${i + 2}: ${error.message}`)
  }
  console.log(`Archivo: ${clientes.length} clientes cargados (upsert por teléfono).`)

  const contar = async (segmento?: string) => {
    let consulta = supabase.from('clientes').select('*', { count: 'exact', head: true })
    if (segmento) consulta = consulta.eq('segmento', segmento)
    const { count, error } = await consulta
    if (error) throw new Error(error.message)
    return count
  }
  console.log(`Base: ${await contar()} clientes en total`)
  for (const segmento of SEGMENTOS) console.log(`  ${segmento}: ${await contar(segmento)}`)
}

importar(process.argv[2] ?? 'data/clientes_import.csv').catch(error => {
  console.error(error.message)
  process.exitCode = 1
})
