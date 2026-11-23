import { NextResponse } from 'next/server';

// Ruta de relleno: cualquier /api/... que no exista responde 404 (antes devolvía 200 y podía ocultar URLs mal configuradas)
const notFound = () => NextResponse.json({ error: 'Ruta de API no encontrada' }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
