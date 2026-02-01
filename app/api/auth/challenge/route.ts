import { NextRequest, NextResponse } from 'next/server';
import { generateChallenge } from '@/lib/auth';
import { storeChallenge } from '@/lib/challenge-store';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';

/**
 * GET /api/auth/challenge
 * 
 * Generate a challenge for agent authentication.
 * Agent must sign this challenge and return it to verify identity.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(
      `challenge:${clientIp}`,
      RATE_LIMITS.CHALLENGE_GET
    );
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          resetAt: rateLimit.resetAt,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMITS.CHALLENGE_GET.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimit.resetAt.toString(),
          },
        }
      );
    }
    
    const challenge = generateChallenge();
    
    // Store challenge server-side for validation
    storeChallenge(challenge.challenge, challenge.expiresAt);
    
    return NextResponse.json(
      {
        success: true,
        challenge: challenge.challenge,
        expiresAt: challenge.expiresAt,
        instructions: 'Sign this challenge with your OpenClaw gateway key and POST to /api/agents/register'
      },
      {
        headers: {
          'X-RateLimit-Limit': RATE_LIMITS.CHALLENGE_GET.limit.toString(),
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': rateLimit.resetAt.toString(),
        },
      }
    );
  } catch (error) {
    console.error('Error generating challenge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate challenge' },
      { status: 500 }
    );
  }
}
