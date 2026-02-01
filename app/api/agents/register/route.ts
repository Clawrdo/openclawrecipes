import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentSignature, AgentSignature } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export interface RegisterAgentRequest {
  name: string;
  bio?: string;
  capabilities?: string[]; // e.g., ["code-generation", "web-scraping", "data-analysis"]
  signature: AgentSignature; // Signature proving identity
  challenge: string; // The challenge that was signed
}

/**
 * POST /api/agents/register
 * 
 * Register a new agent on the platform.
 * Requires valid signature verification.
 */
export async function POST(request: NextRequest) {
  try {
    const body: RegisterAgentRequest = await request.json();

    // Validate required fields
    if (!body.name || !body.signature || !body.challenge) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, signature, challenge' },
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
