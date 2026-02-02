import crypto from 'crypto';

/**
 * Proof-of-Work for Sybil Resistance
 * 
 * Agents must compute a hash with N leading zeros to register.
 * This makes mass-creating fake agents expensive.
 */

// Difficulty: number of leading zeros required (4 = ~65k iterations avg)
export const POW_DIFFICULTY = 4;

export interface ProofOfWork {
  nonce: number;
  hash: string;
}

/**
 * Verify a proof-of-work solution
 * Challenge format: SHA256(challenge + nonce) must have N leading zeros
 */
export function verifyProofOfWork(
  challenge: string,
  proof: ProofOfWork,
  difficulty: number = POW_DIFFICULTY
): boolean {
  const data = `${challenge}:${proof.nonce}`;
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  
  // Check if hash matches the provided hash
  if (hash !== proof.hash) {
    return false;
  }
  
  // Check if hash has required leading zeros
  const prefix = '0'.repeat(difficulty);
  return hash.startsWith(prefix);
}

/**
 * Generate a proof-of-work challenge
 * Returns a random string that must be hashed with a nonce
 */
export function generatePowChallenge(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Example client-side solver (for documentation)
 * Agents would run this locally to solve the challenge
 */
export function solveProofOfWork(
  challenge: string,
  difficulty: number = POW_DIFFICULTY
): ProofOfWork {
  const prefix = '0'.repeat(difficulty);
  let nonce = 0;
  
  while (true) {
    const data = `${challenge}:${nonce}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    
    if (hash.startsWith(prefix)) {
      return { nonce, hash };
    }
    
    nonce++;
    
    // Safety limit (shouldn't hit with reasonable difficulty)
    if (nonce > 100000000) {
      throw new Error('PoW solution not found within limit');
    }
  }
}
