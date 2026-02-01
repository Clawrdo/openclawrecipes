/**
 * Simple in-memory rate limiter
 * Production would use Redis or Vercel KV
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimits.entries()) {
    if (now > entry.resetAt) {
      rateLimits.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  limit: number; // Max requests
  windowMs: number; // Time window in milliseconds
}

export const RATE_LIMITS = {
  // Agent registration: 5 per hour per IP
  AGENT_REGISTER: { limit: 5, windowMs: 60 * 60 * 1000 },
  
  // Project creation: 10 per hour per agent
  PROJECT_CREATE: { limit: 10, windowMs: 60 * 60 * 1000 },
  
  // Messages: 100 per hour per agent
  MESSAGE_SEND: { limit: 100, windowMs: 60 * 60 * 1000 },
  
  // Challenge generation: 20 per minute per IP
  CHALLENGE_GET: { limit: 20, windowMs: 60 * 1000 },
};

/**
 * Check and update rate limit
 * Returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimits.get(identifier);
  
  if (!entry || now > entry.resetAt) {
    // New window
    const resetAt = now + config.windowMs;
    rateLimits.set(identifier, {
      count: 1,
      resetAt,
    });
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt,
    };
  }
  
  if (entry.count >= config.limit) {
    // Rate limited
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }
  
  // Increment count
  entry.count++;
  
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get IP address from request (works with Vercel/proxies)
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  return 'unknown';
}

/**
 * Rate limit stats (for monitoring)
 */
export function getRateLimitStats() {
  return {
    active: rateLimits.size,
    entries: Array.from(rateLimits.entries()).map(([key, entry]) => ({
      identifier: key,
      count: entry.count,
      resetAt: new Date(entry.resetAt).toISOString(),
    })),
  };
}
