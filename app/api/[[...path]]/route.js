import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ ok: true, app: 'Bookly demo (mock data on client)' });
}

export async function POST() {
  return NextResponse.json({ ok: true });
}
