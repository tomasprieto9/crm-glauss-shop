import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  return NextResponse.json(await prisma.expense.findMany({ orderBy: { expenseDate: 'desc' } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  const amount = Number(body.amount)
  if (!body.category || !body.description || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Categoría, descripción y un monto válido son obligatorios.' }, { status: 400 })
  const expense = await prisma.expense.create({ data: { expenseDate: body.date ? new Date(`${body.date}T00:00:00`) : new Date(), category: body.category, description: body.description, amount } })
  return NextResponse.json(expense, { status: 201 })
}
