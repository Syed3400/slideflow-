import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { presentationStatuses } from '@/lib/types/presentation-status';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { fileUrl, fileName } = await req.json();

  // 1. Create the presentation record in Prisma
  const presentation = await prisma.presentation.create({
    data: {
      title: fileName.replace(/\.[^/.]+$/, ''), // strip extension
      fileUrl,
      ownerId: userId,
      status: presentationStatuses.processing,
    },
  });

  // 2. Trigger the FastAPI Celery worker (non-blocking)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  fetch(`${apiUrl}/api/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileUrl,
      ownerId: userId,
      fileName,
      presentationId: presentation.id,
    }),
  }).catch((e) => console.error('FastAPI trigger failed:', e));

  return NextResponse.json(presentation);
}
