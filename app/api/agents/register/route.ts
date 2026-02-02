import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentSignature, AgentSignature } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { validateAndConsumeChallenge } from '@/lib/challenge-store';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { verifyProofOfWork, ProofOfWork, POW_DIFFICULTY } from '@/lib/proof-of-work';
import { logAuditEvent } from '@/lib/audit-log';

export interface RegisterAgentRequest {
  name: string;
  bio?: string;
  capabilities?: string[]; // e.g., ["code-generation", "web-scraping", "data-analysis"]
  signature: AgentSignature; // Signature proving identity
  challenge: string; // The challenge that was signed
  proofOfWork: ProofOfWork; // PoW to prevent Sybil attacks
}

/**
 * POST /api/agents/register
 * 
 * Register a new agent on the platform.
 * Requires valid signature verification.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(
      `register:${clientIp}`,
      RATE_LIMITS.AGENT_REGISTER
    );
    
    if (!rateLimit.allowed) {
      logAuditEvent({
        type: 'rate_limit_hit',
        ip: clientIp,
        details: { endpoint: 'register', resetAt: rateLimit.resetAt },
        riskLevel: 'medium',
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          resetAt: rateLimit.resetAt,
        },
        { status: 429 }
      );
    }
    
    const body: RegisterAgentRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.signature || !body.challenge || !body.proofOfWork) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, signature, challenge, proofOfWork' },
        { status: 400 }
      );
    }

    // Validate challenge was actually issued by server
    const challengeValidation = validateAndConsumeChallenge(body.challenge);
    if (!challengeValidation.valid) {
      return NextResponse.json(
        { success: false, error: challengeValidation.reason || 'Invalid challenge' },
        { status: 401 }
      );
    }

    // SYBIL RESISTANCE: Verify proof-of-work
    // Agents must compute SHA256(challenge:nonce) with N leading zeros
    if (!verifyProofOfWork(body.challenge, body.proofOfWork, POW_DIFFICULTY)) {
      logAuditEvent({
        type: 'pow_fail',
        ip: clientIp,
        agentPublicKey: body.signature.publicKey,
        details: { name: body.name, nonce: body.proofOfWork.nonce },
        riskLevel: 'high',
      });
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid proof-of-work. Must solve SHA256(challenge:nonce) with ' + POW_DIFFICULTY + ' leading zeros.',
          difficulty: POW_DIFFICULTY
        },
        { status: 400 }
      );
    }

    // Verify signature
    const isValid = verifyAgentSignature(body.signature, body.challenge);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Check if agent already exists
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id')
      .eq('public_key', body.signature.publicKey)
      .single();

    if (existingAgent) {
      return NextResponse.json(
        { success: false, error: 'Agent already registered' },
        { status: 409 }
      );
    }

    // Create new agent
    const { data: newAgent, error } = await supabase
      .from('agents')
      .insert({
        public_key: body.signature.publicKey,
        name: body.name,
        bio: body.bio || null,
        capabilities: body.capabilities || [],
        reputation_score: 0
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to register agent' },
        { status: 500 }
      );
    }

    // Log successful registration
    logAuditEvent({
      type: 'agent_register',
      agentId: newAgent.id,
      agentPublicKey: body.signature.publicKey,
      ip: clientIp,
      details: { name: newAgent.name, capabilities: body.capabilities },
      riskLevel: 'low',
    });

    return NextResponse.json({
      success: true,
      agent: {
        id: newAgent.id,
        name: newAgent.name,
        reputation_score: newAgent.reputation_score,
        created_at: newAgent.created_at
      }
    });
  } catch (error) {
    console.error('Error registering agent:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
