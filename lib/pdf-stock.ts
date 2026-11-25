// PDF del stock al cierre, armado a mano (sin librerías): hoja A4, Helvetica, una banda por modelo y una fila por sabor.

export type GrupoStockPdf = { titulo: string; detalle: string; filas: { codigo: string; sabor: string; stock: number }[] }
export type StockPdf = { titulo: string; subtitulo: string; resumen: string; grupos: GrupoStockPdf[] }

const ANCHO = 595.28, ALTO = 841.89, MARGEN = 40

// Anchos de Helvetica (milésimas del tamaño de letra) para alinear a la derecha; lo que no está usa 556.
const ANCHOS: Record<string, number> = { ' ': 278, '.': 278, ',': 278, ':': 278, '·': 278, '-': 333, '(': 333, ')': 333, '/': 278, '#': 556, '$': 556, U: 722, S: 667, i: 222, l: 222, j: 222, t: 278, f: 278, r: 333, m: 833, w: 722, s: 500, c: 500, k: 500, v: 500, x: 500, y: 500, z: 500 }
const ANCHOS_NEGRITA: Record<string, number> = { ...ANCHOS, i: 278, l: 278, j: 278, t: 333, f: 333, r: 389, m: 889, w: 778, s: 556, c: 556, k: 556, v: 556, x: 556, y: 556, z: 500, u: 611, n: 611, o: 611, p: 611, q: 611, d: 611, b: 611, g: 611, h: 611 }
const anchoTexto = (texto: string, tamano: number, negrita: boolean) => [...texto].reduce((suma, letra) => suma + ((negrita ? ANCHOS_NEGRITA : ANCHOS)[letra] ?? 556), 0) * tamano / 1000

// Texto en WinAnsi (acentos, ñ, ¿, ·) con los caracteres especiales de PDF escapados.
const ESPECIALES: Record<string, number> = { '€': 0x80, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '–': 0x96, '—': 0x97, '−': 0x2d }
function textoPdf(texto: string) {
  let salida = ''
  for (const letra of texto) {
    const codigo = ESPECIALES[letra] ?? letra.charCodeAt(0)
    const byte = codigo < 256 && !(codigo >= 0x80 && codigo < 0xa0 && !(letra in ESPECIALES)) ? codigo : 0x3f
    const caracter = String.fromCharCode(byte)
    salida += caracter === '(' || caracter === ')' || caracter === '\\' ? '\\' + caracter : caracter
  }
  return `(${salida})`
}
const recortar = (texto: string, maximo: number) => texto.length > maximo ? texto.slice(0, maximo - 1) + '…' : texto

export function pdfStock(datos: StockPdf): Blob {
  const paginas: string[][] = []
  let pagina: string[] = []
  let y = 0
  const color = (gris: number) => `${gris} ${gris} ${gris}`
  const texto = (valor: string, x: number, alto: number, tamano: number, opciones: { negrita?: boolean; derecha?: boolean; gris?: number } = {}) => {
    const posicion = opciones.derecha ? x - anchoTexto(valor, tamano, Boolean(opciones.negrita)) : x
    pagina.push(`BT /${opciones.negrita ? 'F2' : 'F1'} ${tamano} Tf ${color(opciones.gris ?? 0.1)} rg ${posicion.toFixed(2)} ${alto.toFixed(2)} Td ${textoPdf(valor)} Tj ET`)
  }
  const nuevaPagina = () => {
    pagina = []
    paginas.push(pagina)
    y = ALTO - MARGEN
    if (paginas.length > 1) {
      texto(recortar(datos.titulo, 90), MARGEN, y - 9, 9, { gris: 0.45 })
      y -= 24
    }
  }
  const lugar = (alto: number) => { if (y - alto < MARGEN + 20) nuevaPagina() }

  nuevaPagina()
  texto(datos.titulo, MARGEN, y - 16, 17, { negrita: true })
  texto(datos.subtitulo, MARGEN, y - 34, 10, { gris: 0.4 })
  texto(datos.resumen, MARGEN, y - 52, 11, { negrita: true })
  y -= 72

  for (const grupo of datos.grupos) {
    lugar(24 + 17 * Math.min(grupo.filas.length, 3))
    pagina.push(`0.93 0.93 0.93 rg ${MARGEN} ${(y - 20).toFixed(2)} ${ANCHO - 2 * MARGEN} 20 re f`)
    texto(recortar(grupo.titulo, 60), MARGEN + 8, y - 14, 11, { negrita: true })
    texto(grupo.detalle, ANCHO - MARGEN - 8, y - 14, 10, { negrita: true, derecha: true })
    y -= 24
    for (const fila of grupo.filas) {
      lugar(17)
      const gris = fila.stock === 0 ? 0.6 : 0.1
      texto(recortar(fila.codigo, 10), MARGEN + 8, y - 11, 9, { gris: fila.stock === 0 ? 0.6 : 0.4 })
      texto(recortar(fila.sabor, 72), MARGEN + 78, y - 11, 10, { gris })
      texto(fila.stock.toLocaleString('es-AR'), ANCHO - MARGEN - 8, y - 11, 10, { negrita: fila.stock !== 0, derecha: true, gris })
      pagina.push(`0.9 0.9 0.9 RG 0.5 w ${MARGEN} ${(y - 16).toFixed(2)} m ${ANCHO - MARGEN} ${(y - 16).toFixed(2)} l S`)
      y -= 17
    }
    y -= 10
  }

  // Número de página al pie.
  paginas.forEach((contenido, indice) => {
    pagina = contenido
    texto(`Página ${indice + 1} de ${paginas.length}`, ANCHO - MARGEN, MARGEN - 14, 8, { derecha: true, gris: 0.5 })
  })

  // Armado del archivo: catálogo, páginas, fuentes y un contenido por página.
  const objetos: string[] = []
  const agregar = (cuerpo: string) => { objetos.push(cuerpo); return objetos.length }
  const catalogo = agregar('')
  const arbol = agregar('')
  const fuente = agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
  const negrita = agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')
  const hojas = paginas.map(contenido => {
    const flujo = contenido.join('\n')
    const contenidoId = agregar(`<< /Length ${flujo.length} >>\nstream\n${flujo}\nendstream`)
    return agregar(`<< /Type /Page /Parent ${arbol} 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Resources << /Font << /F1 ${fuente} 0 R /F2 ${negrita} 0 R >> >> /Contents ${contenidoId} 0 R >>`)
  })
  objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${arbol} 0 R >>`
  objetos[arbol - 1] = `<< /Type /Pages /Kids [${hojas.map(id => `${id} 0 R`).join(' ')}] /Count ${hojas.length} >>`

  let archivo = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'
  const posiciones: number[] = []
  objetos.forEach((cuerpo, indice) => { posiciones.push(archivo.length); archivo += `${indice + 1} 0 obj\n${cuerpo}\nendobj\n` })
  const xref = archivo.length
  archivo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${posiciones.map(posicion => `${String(posicion).padStart(10, '0')} 00000 n \n`).join('')}`
  archivo += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${xref}\n%%EOF`
  const bytes = new Uint8Array(archivo.length)
  for (let indice = 0; indice < archivo.length; indice++) bytes[indice] = archivo.charCodeAt(indice) & 0xff
  return new Blob([bytes], { type: 'application/pdf' })
}
