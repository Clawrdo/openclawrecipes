/**
 * Challenge Store - Server-side challenge and nonce tracking
 * Prevents replay attacks and validates challenges were actually issued
 * Also tracks nonces for request-bound signatures
 */

interface ChallengeEntry {
  challenge: string;
  expiresAt: number;
  issued: number;
}

interface NonceEntry {
  nonce: string;
  usedAt: number;
  agentId: string;
}

// In-memory stores (production would use Redis/KV)
const challenges = new Map<string, ChallengeEntry>();
const usedNonces = new Map<string, NonceEntry>(); // key: agent:nonce

// Cleanup on access instead of setInterval (serverless-friendly)
function cleanupExpired() {
  const now = Date.now();
  
  // Clean challenges
  for (const [key, entry] of challenges.entries()) {
    if (now > entry.expiresAt) {
      challenges.delete(key);
    }
  }

  // Clean nonces (older than 1 hour)
  for (const [key, entry] of usedNonces.entries()) {
    if (now - entry.usedAt > 3600000) {
      usedNonces.delete(key);
    }
  }
}

/**
 * Store a newly generated challenge
 */
export function storeChallenge(challenge: string, expiresAt: number): void {
  cleanupExpired(); // Cleanup on access
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
  cleanupExpired(); // Cleanup on access
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

/**
 * Check and consume a nonce (one-time use per request)
 * Used with request-bound signatures
 */
export function checkAndConsumeNonce(agentPublicKey: string, nonce: string): {
  valid: boolean;
  reason?: string;
} {
  cleanupExpired();
  
  const nonceKey = `${agentPublicKey}:${nonce}`;
  
  if (usedNonces.has(nonceKey)) {
    return { valid: false, reason: 'Nonce already used (replay detected)' };
  }

  // Mark as used
  usedNonces.set(nonceKey, {
    nonce,
    usedAt: Date.now(),
    agentId: agentPublicKey
  });

  return { valid: true };
}
