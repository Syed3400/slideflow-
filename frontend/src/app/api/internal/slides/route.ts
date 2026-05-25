import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authorizeInternalServiceRequest } from '@/lib/internal-service-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { presentationStatuses } from '@/lib/types/presentation-status'

type SlideInput = {
  order: number
  content?: string
  aiSummary?: string
  keywords: string[]
  presentationId: string
}

function isValidSlideInput(slide: unknown): slide is SlideInput {
  if (!slide || typeof slide !== 'object') {
    return false
  }

  const candidate = slide as Record<string, unknown>
  const hasValidOrder = typeof candidate.order === 'number' && Number.isInteger(candidate.order) && candidate.order > 0
  const hasValidContent = candidate.content === undefined || typeof candidate.content === 'string'
  const hasValidSummary = candidate.aiSummary === undefined || typeof candidate.aiSummary === 'string'
  const hasValidPresentationId = typeof candidate.presentationId === 'string' && candidate.presentationId.length > 0
  const hasValidKeywords =
    Array.isArray(candidate.keywords) &&
    candidate.keywords.length <= 30 &&
    candidate.keywords.every((keyword) => typeof keyword === 'string' && keyword.length <= 64)

  return hasValidOrder && hasValidContent && hasValidSummary && hasValidPresentationId && hasValidKeywords
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const authResponse = authorizeInternalServiceRequest(req, rawBody)
    if (authResponse) {
      return authResponse
    }

    const ip = getClientIp(req)
    const rateLimit = checkRateLimit(`internal:slides:${ip}`, 60, 60_000)
    if (!rateLimit.allowed) {
      return new NextResponse('Rate limit exceeded', {
        status: 429,
        headers: { 'retry-after': String(rateLimit.retryAfterSeconds) },
      })
    }

    const body = JSON.parse(rawBody)
    const { slides, presentationId } = body

    if (typeof presentationId !== 'string' || !presentationId.trim()) {
      return new NextResponse('Invalid presentationId', { status: 400 })
    }

    if (!Array.isArray(slides) || slides.length === 0 || slides.length > 500) {
      return new NextResponse('Invalid slides payload', { status: 400 })
    }

    if (!slides.every(isValidSlideInput)) {
      return new NextResponse('Invalid slide shape', { status: 400 })
    }

    // Bulk insert slides
    await prisma.$transaction([
      prisma.slide.createMany({
        data: slides,
      }),
      prisma.presentation.update({
        where: { id: presentationId },
        data: { status: presentationStatuses.parsed },
      }),
    ])


    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[INTERNAL_SLIDES_POST]', error)
    if (error instanceof SyntaxError) {
      return new NextResponse('Invalid request payload', { status: 400 })
    }
    return new NextResponse('Internal Error', { status: 500 })
  }
}
