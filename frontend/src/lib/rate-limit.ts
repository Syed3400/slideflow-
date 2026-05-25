const store = new Map<string, number[]>()

type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const hits = store.get(key) ?? []
  const windowStart = now - windowMs
  const recentHits = hits.filter((hit) => hit >= windowStart)

  if (recentHits.length >= limit) {
    const oldestHit = recentHits[0]
    const retryAfterSeconds = Math.max(1, Math.ceil((oldestHit + windowMs - now) / 1000))
    store.set(key, recentHits)
    return { allowed: false, retryAfterSeconds }
  }

  recentHits.push(now)
  store.set(key, recentHits)
  return { allowed: true, retryAfterSeconds: 0 }
}

export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown'
  }

  return req.headers.get('x-real-ip') || 'unknown'
}
