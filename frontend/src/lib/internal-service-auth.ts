import crypto from 'crypto'
import { NextResponse } from 'next/server'

const TOKEN_HEADER = 'x-service-token'
const SIGNATURE_HEADER = 'x-service-signature'
const TIMESTAMP_HEADER = 'x-service-timestamp'
const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000

export function authorizeInternalServiceRequest(req: Request, rawBody: string): NextResponse | null {
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN
  if (!expectedToken) {
    console.error('[INTERNAL_AUTH] INTERNAL_SERVICE_TOKEN is not configured')
    return new NextResponse('Service auth is not configured', { status: 500 })
  }

  const providedToken = req.headers.get(TOKEN_HEADER)
  if (!providedToken || providedToken !== expectedToken) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const signingSecret = process.env.INTERNAL_SIGNING_SECRET
  if (!signingSecret) {
    return null
  }

  const providedSignature = req.headers.get(SIGNATURE_HEADER)
  const providedTimestamp = req.headers.get(TIMESTAMP_HEADER)

  if (!providedSignature || !providedTimestamp) {
    return new NextResponse('Missing signature headers', { status: 401 })
  }

  const timestampMs = Number(providedTimestamp) * 1000
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > SIGNATURE_MAX_AGE_MS) {
    return new NextResponse('Signature timestamp is invalid or expired', { status: 401 })
  }

  const signedPayload = `${providedTimestamp}.${rawBody}`
  const expectedSignature = crypto
    .createHmac('sha256', signingSecret)
    .update(signedPayload)
    .digest('hex')

  const providedBuffer = Buffer.from(providedSignature, 'hex')
  const expectedBuffer = Buffer.from(expectedSignature, 'hex')
  if (providedBuffer.length !== expectedBuffer.length) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  const isValidSignature = crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  if (!isValidSignature) {
    return new NextResponse('Invalid signature', { status: 401 })
  }

  return null
}
