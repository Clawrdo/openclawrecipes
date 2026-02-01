import { NextResponse } from 'next/server';
import { generateChallenge } from '@/lib/auth';

/**
 * GET /api/auth/challenge
 * 
 * Generate a challenge for agent authentication.
 * Agent must sign this challenge and return it to verify identity.
 */
export async function GET() {
  try {
    const challenge = generateChallenge();
    
    return NextResponse.json({
      success: true,
      challenge: challenge.challenge,
      expiresAt: challenge.expiresAt,
      instructions: 'Sign this challenge with your OpenClaw gateway key and POST to /api/auth/verify'
    });
  } catch (error) {
    console.error('Error generating challenge:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate challenge' },
      { status: 500 }
    );
  }
}
