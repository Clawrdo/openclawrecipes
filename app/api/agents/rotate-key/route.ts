import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentSignature, AgentSignature } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { validateAndConsumeChallenge } from '@/lib/challenge-store';
import { checkRateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit-log';

export interface RotateKeyRequest {
  newPublicKey: string; // The new public key to rotate to
  challenge: string; // Challenge for the signature
  signature: AgentSignature; // Signed with CURRENT key to prove ownership
}

/**
 * POST /api/agents/rotate-key
 * 
 * Rotate an agent's public key.
 * Agent must prove ownership of current key to rotate to a new one.
 * Identity (agent ID) and reputation persist.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    
    // Rate limiting
    const rateLimit = checkRateLimit(
      `rotate-key:${clientIp}`,
      { limit: 5, windowMs: 3600000 } // 5 per hour
    );
    
    if (!rateLimit.allowed) {
      logAuditEvent({
        type: 'rate_limit_hit',
        ip: clientIp,
        details: { endpoint: 'rotate-key' },
        riskLevel: 'medium',
      });
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }
    
    const body: RotateKeyRequest = await request.json();

    // Validate required fields
    if (!body.newPublicKey || !body.signature || !body.challenge) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: newPublicKey, signature, challenge' },
        { status: 400 }
      );
    }

    // Validate challenge
    const challengeValidation = validateAndConsumeChallenge(body.challenge);
    if (!challengeValidation.valid) {
      return NextResponse.json(
        { success: false, error: challengeValidation.reason || 'Invalid challenge' },
        { status: 401 }
      );
    }

    // Verify signature with CURRENT key
    // Message format: rotate_key:{new_public_key}:{challenge}
    const expectedMessage = `rotate_key:${body.newPublicKey}:${body.challenge}`;
    const isValid = verifyAgentSignature(body.signature, expectedMessage);
    
    if (!isValid) {
      logAuditEvent({
        type: 'auth_fail',
        ip: clientIp,
        agentPublicKey: body.signature.publicKey,
        details: { action: 'rotate-key', reason: 'invalid_signature' },
        riskLevel: 'high',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Find agent by CURRENT public key
    const { data: agent, error: findError } = await supabase
      .from('agents')
      .select('id, name, public_key')
      .eq('public_key', body.signature.publicKey)
      .single();

    if (findError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Check new key isn't already in use
    const { data: existingKey } = await supabase
      .from('agents')
      .select('id')
      .eq('public_key', body.newPublicKey)
      .single();

    if (existingKey) {
      return NextResponse.json(
        { success: false, error: 'New public key already in use' },
        { status: 409 }
      );
    }

    // Update the agent's public key
    const { error: updateError } = await supabase
      .from('agents')
      .update({ 
        public_key: body.newPublicKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', agent.id);

    if (updateError) {
      console.error('Database error:', updateError);
      return NextResponse.json(
        { success: false, error: 'Failed to rotate key' },
        { status: 500 }
      );
    }

    // Log successful key rotation (IMPORTANT for security audit)
    logAuditEvent({
      type: 'auth_verify',
      agentId: agent.id,
      ip: clientIp,
      details: { 
        action: 'key_rotation',
        oldKeyPrefix: body.signature.publicKey.slice(0, 8) + '...',
        newKeyPrefix: body.newPublicKey.slice(0, 8) + '...',
      },
      riskLevel: 'medium', // Key rotation is noteworthy
    });

    return NextResponse.json({
      success: true,
      message: 'Key rotated successfully',
      agent: {
        id: agent.id,
        name: agent.name,
      }
    });
  } catch (error) {
    console.error('Error rotating key:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
