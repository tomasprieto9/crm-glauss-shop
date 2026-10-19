// Aplica un archivo de supabase/migrations dentro de una transacción (reemplaza a psql).
// Uso: node --env-file=.env.local scripts/aplicar-migracion.ts supabase/migrations/001_clientes.sql
import { readFileSync } from 'node:fs'
import pg from 'pg'

async function aplicar(archivo: string) {
  // Supabase firma sus certificados con una CA propia: la conexión va cifrada, sin validar esa cadena.
  const url = new URL(process.env.POSTGRES_URL_NON_POOLING!)
  url.searchParams.delete('sslmode')
  const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })

  await client.connect()
  try {
    await client.query('begin')
    await client.query(readFileSync(archivo, 'utf8'))
    await client.query('commit')
    console.log(`Aplicada: ${archivo}`)
  } catch (error) {
    await client.query('rollback')
    console.error(`Falló ${archivo}: ${(error as Error).message}`)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: node --env-file=.env.local scripts/aplicar-migracion.ts <archivo.sql>')
  process.exit(1)
}
aplicar(archivo)
