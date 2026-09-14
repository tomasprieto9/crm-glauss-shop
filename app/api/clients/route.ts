import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  return NextResponse.json(await prisma.client.findMany({ orderBy: { createdAt: 'desc' } }))
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.firstName || !body.lastName) return NextResponse.json({ error: 'Nombre y apellido son obligatorios.' }, { status: 400 })
  const client = await prisma.client.create({ data: { firstName: body.firstName, lastName: body.lastName, phone: body.phone || null, email: body.email || null } })
  return NextResponse.json(client, { status: 201 })
}
