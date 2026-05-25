import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  const presentation = await prisma.presentation.findFirst({
    where: { id, ownerId: userId },
    include: {
      slides: { orderBy: { order: 'asc' } },
    },
  });

  if (!presentation) return new NextResponse('Not Found', { status: 404 });
  return NextResponse.json(presentation);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return new NextResponse('Unauthorized', { status: 401 });

  await prisma.presentation.deleteMany({
    where: { id, ownerId: userId },
  });

  return new NextResponse(null, { status: 204 });
}
