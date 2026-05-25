import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { presentationStatuses } from '@/lib/types/presentation-status';

export async function POST(req: Request) {
  // 1. Authenticate
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Parse incoming multipart file
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return new NextResponse('No file provided', { status: 400 });
  }

  // 3. Create Prisma record immediately so the dashboard shows PROCESSING
  const presentation = await prisma.presentation.create({
    data: {
      title: file.name.replace(/\.[^/.]+$/, ''), // strip extension
      fileUrl: '',
      ownerId: userId,
      status: presentationStatuses.processing,
    },
  });

  console.log(`[Upload Proxy] Created presentation ${presentation.id} for user ${userId}`);

  // 4. Forward file + IDs to FastAPI (non-blocking)
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const internalServiceToken = process.env.INTERNAL_SERVICE_TOKEN;
  const backendForm = new FormData();
  backendForm.append('file', file);
  backendForm.append('presentation_id', presentation.id);
  backendForm.append('owner_id', userId);

  fetch(`${apiUrl}/api/upload`, {
    method: 'POST',
    body: backendForm,
    headers: internalServiceToken
      ? {
          'x-service-token': internalServiceToken,
        }
      : undefined,
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text();
      console.error('[Upload Proxy] FastAPI error:', text);
    } else {
      console.log('[Upload Proxy] FastAPI accepted the file for parsing.');
    }
  }).catch((e) => {
    console.error('[Upload Proxy] Could not reach FastAPI:', e.message);
  });

  // 5. Return the new presentation to the client immediately
  return NextResponse.json(presentation);
}
