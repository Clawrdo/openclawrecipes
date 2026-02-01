/**
 * Challenge Store - Server-side challenge tracking
 * Prevents replay attacks and validates challenges were actually issued
 */

interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
  issued: number;
}

// In-memory store (production would use Redis/KV)
const challenges = new Map<string, ChallengeEntry>();

// Cleanup interval - remove expired challenges every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of challenges.entries()) {
    if (now > entry.expiresAt) {
      challenges.delete(key);
    }
  }
}, 60000);

/**
 * Store a newly generated challenge
 */
export function storeChallenge(challenge: string, expiresAt: number): void {
  challenges.set(challenge, {
    challenge,
    expiresAt,
    issued: Date.now(),
  });
}

/**
 * Validate and consume a challenge (one-time use)
 */
export function validateAndConsumeChallenge(challenge: string): {
  valid: boolean;
  reason?: string;
} {
  const entry = challenges.get(challenge);
  
  if (!entry) {
    return { valid: false, reason: 'Challenge not found or already used' };
  }
  
  const now = Date.now();
  if (now > entry.expiresAt) {
    challenges.delete(challenge);
    return { valid: false, reason: 'Challenge expired' };
  }
  
  // One-time use - delete after validation
  challenges.delete(challenge);
  
  return { valid: true };
}

/**
 * Get challenge store stats (for monitoring)
 */
export function getChallengeStats() {
  return {
    active: challenges.size,
    oldest: Math.min(...Array.from(challenges.values()).map(e => e.issued)),
  };
}
