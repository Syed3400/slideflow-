import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import prisma from '@/lib/prisma'
import { presentationStatuses } from '@/lib/types/presentation-status'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const presentations = await prisma.presentation.findMany({
      where: {
        ownerId: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: { slides: true },
        },
      },
    })

    return NextResponse.json(presentations)
  } catch (error) {
    console.error('[PRESENTATIONS_GET]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await req.json()
    const { title, fileUrl } = body

    if (!title) {
      return new NextResponse('Title is required', { status: 400 })
    }

    const presentation = await prisma.presentation.create({
      data: {
        title,
        fileUrl,
        ownerId: userId,
        status: presentationStatuses.pending,
      },
    })

    return NextResponse.json(presentation)
  } catch (error) {
    console.error('[PRESENTATIONS_POST]', error)
    return new NextResponse('Internal Error', { status: 500 })
  }
}
