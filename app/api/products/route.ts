import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })
  return NextResponse.json(products)
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.name || !body.brand || !body.category) return NextResponse.json({ error: 'Nombre, marca y categoría son obligatorios.' }, { status: 400 })
  const product = await prisma.product.create({ data: { name: body.name, brand: body.brand, category: body.category, price: Number(body.price) || 0, stock: Number(body.stock) || 0, minStock: Number(body.minStock) || 0, description: body.description || null } })
  return NextResponse.json(product, { status: 201 })
}
