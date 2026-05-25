import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeInternalServiceRequest } from '@/lib/internal-service-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { isPresentationStatus, presentationStatuses } from '@/lib/types/presentation-status'

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const authResponse = authorizeInternalServiceRequest(req, rawBody)
    if (authResponse) {
      return authResponse
    }

    const ip = getClientIp(req)
    const rateLimit = checkRateLimit(`internal:presentations:${ip}`, 30, 60_000)
    if (!rateLimit.allowed) {
      return new NextResponse('Rate limit exceeded', {
        status: 429,
        headers: { 'retry-after': String(rateLimit.retryAfterSeconds) },
      })
    }

    const body = JSON.parse(rawBody)
    const { title, fileUrl, ownerId } = body

    if (typeof title !== 'string' || !title.trim() || title.length > 200) {
      return new NextResponse('Invalid title', { status: 400 })
    }

    if (typeof ownerId !== 'string' || !ownerId.trim() || ownerId.length > 200) {
      return new NextResponse('Invalid ownerId', { status: 400 })
    }

    if (fileUrl !== undefined && fileUrl !== null && typeof fileUrl !== 'string') {
      return new NextResponse('Invalid fileUrl', { status: 400 })
    }

    const presentation = await prisma.presentation.create({
      data: {
        title: title.trim(),
        fileUrl: typeof fileUrl === 'string' ? fileUrl : '',
        ownerId: ownerId.trim(),
        status: presentationStatuses.processing,
      },
    })

    return NextResponse.json(presentation)
  } catch (error) {
    console.error('[INTERNAL_PRESENTATIONS_POST]', error)
    if (error instanceof SyntaxError) {
      return new NextResponse('Invalid request payload', { status: 400 })
    }
    return new NextResponse('Internal Error', { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const rawBody = await req.text()
    const authResponse = authorizeInternalServiceRequest(req, rawBody)
    if (authResponse) {
      return authResponse
    }

    const ip = getClientIp(req)
    const rateLimit = checkRateLimit(`internal:presentations:patch:${ip}`, 60, 60_000)
    if (!rateLimit.allowed) {
      return new NextResponse('Rate limit exceeded', {
        status: 429,
        headers: { 'retry-after': String(rateLimit.retryAfterSeconds) },
      })
    }

    const body = JSON.parse(rawBody)
    const { presentationId, status } = body

    if (typeof presentationId !== 'string' || !presentationId.trim()) {
      return new NextResponse('Invalid presentationId', { status: 400 })
    }

    if (!isPresentationStatus(status)) {
      return new NextResponse('Invalid status', { status: 400 })
    }

    const updated = await prisma.presentation.update({
      where: { id: presentationId.trim() },
      data: { status },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('[INTERNAL_PRESENTATIONS_PATCH]', error)
    if (error instanceof SyntaxError) {
      return new NextResponse('Invalid request payload', { status: 400 })
    }
    return new NextResponse('Internal Error', { status: 500 })
  }
}
