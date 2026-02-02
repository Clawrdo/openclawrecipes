import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';
import crypto from 'crypto';

/**
 * Agent Authentication for OpenClaw Recipes
 * 
 * Agents prove identity by signing requests with their OpenClaw gateway key.
 * NEW: Request-bound signatures (method + path + body hash + timestamp + nonce)
 * LEGACY: Challenge-response (being phased out)
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

export interface RequestBoundSignature {
  publicKey: string; // Agent's public key
  signature: string; // Signature of canonical request string
  timestamp: number; // Request timestamp (within 5 min tolerance)
  nonce: string; // Unique per-request identifier (base64)
}

export interface CanonicalRequest {
  method: string;
  path: string;
  bodyHash: string; // SHA-256 of body
  timestamp: number;
  nonce: string;
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

/**
 * BUILD: Canonical request string for signing
 * Format: METHOD|PATH|BODY_HASH|TIMESTAMP|NONCE
 */
export function buildCanonicalRequest(req: CanonicalRequest): string {
  return `${req.method}|${req.path}|${req.bodyHash}|${req.timestamp}|${req.nonce}`;
}

/**
 * HASH: SHA-256 hash of request body
 */
export function hashRequestBody(body: string | Buffer): string {
  const hash = crypto.createHash('sha256');
  hash.update(body);
  return hash.digest('base64');
}

/**
 * VERIFY: Request-bound signature
 * Ensures signature covers the entire request, not just a challenge
 */
export function verifyRequestBoundSignature(
  sig: RequestBoundSignature,
  req: CanonicalRequest,
  maxAgeMs: number = 300000 // 5 minutes
): boolean {
  try {
    // 1. Check timestamp is recent
    const now = Date.now();
    if (Math.abs(now - sig.timestamp) > maxAgeMs) {
      console.error('Signature timestamp outside tolerance window');
      return false;
    }

    // 2. Build the canonical request string
    const canonical = buildCanonicalRequest(req);

    // 3. Verify signature
    const publicKey = naclUtil.decodeBase64(sig.publicKey);
    const signatureBytes = naclUtil.decodeBase64(sig.signature);
    const canonicalBytes = Buffer.from(canonical, 'utf-8');

    return nacl.sign.detached.verify(
      canonicalBytes,
      signatureBytes,
      publicKey
    );
  } catch (error) {
    console.error('Request signature verification failed:', error);
    return false;
  }
}
