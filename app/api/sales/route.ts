import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const sales = await prisma.sale.findMany({ include: { client: true, items: { include: { product: true } } }, orderBy: [{ saleDate: 'desc' }, { number: 'desc' }] })
  return NextResponse.json(sales)
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.paymentMethod || !Array.isArray(body.items) || body.items.length === 0) return NextResponse.json({ error: 'Método de pago y productos son obligatorios.' }, { status: 400 })
  const productIds = body.items.map((item: { productId: string }) => item.productId)
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } })
  const byId = new Map(products.map(product => [product.id, product]))
  const items = body.items.map((item: { productId: string; quantity: number }) => { const product = byId.get(item.productId); const quantity = Number(item.quantity); if (!product || !Number.isInteger(quantity) || quantity < 1 || product.stock < quantity) throw new Error('Producto o stock inválido.'); return { productId: product.id, quantity, unitPrice: product.price, subtotal: Number(product.price) * quantity } })
  const total = items.reduce((sum: number, item: { subtotal: number }) => sum + item.subtotal, 0)
  const sale = await prisma.$transaction(async transaction => { const created = await transaction.sale.create({ data: { clientId: body.clientId || null, paymentMethod: body.paymentMethod, saleDate: body.date ? new Date(`${body.date}T00:00:00`) : new Date(), total, items: { create: items } }, include: { client: true, items: { include: { product: true } } } }); for (const item of items) await transaction.product.update({ where: { id: item.productId }, data: { stock: { decrement: item.quantity } } }); return created })
  return NextResponse.json(sale, { status: 201 })
}
