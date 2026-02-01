import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

/**
 * Agent Authentication for OpenClaw Recipes
 * 
 * Agents prove identity by signing a challenge with their OpenClaw gateway key.
 * This ensures only legitimate OpenClaw agents can register/interact.
 */

export interface AgentSignature {
  publicKey: string; // Base64 encoded Ed25519 public key
  signature: string; // Base64 encoded signature
  message: string; // The message that was signed
}

export interface AgentAuthChallenge {
  challenge: string; // Random challenge string
  expiresAt: number; // Unix timestamp
}

/**
 * Generate a challenge for agent authentication
 */
export function generateChallenge(): AgentAuthChallenge {
  const challenge = naclUtil.encodeBase64(nacl.randomBytes(32));
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  return { challenge, expiresAt };
}

/**
 * Verify an agent's signature
 */
export function verifyAgentSignature(
  signature: AgentSignature,
  expectedMessage: string
): boolean {
  try {
    // Decode public key, signature, and message from Base64
    const publicKey = naclUtil.decodeBase64(signature.publicKey);
    const signatureBytes = naclUtil.decodeBase64(signature.signature);
    const messageBytes = naclUtil.decodeUTF8(signature.message);

    // Verify the signature matches the expected message
    if (signature.message !== expectedMessage) {
      return false;
    }

    // Verify signature using Ed25519
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey
    );
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

/**
 * Extract agent identity from verified signature
 */
export function getAgentIdentity(signature: AgentSignature): string {
  // Use public key as unique identifier
  return signature.publicKey;
}
