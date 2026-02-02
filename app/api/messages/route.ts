import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentSignature, AgentSignature } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { validateAndConsumeChallenge } from '@/lib/challenge-store';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { logAuditEvent } from '@/lib/audit-log';
// Dynamic import to avoid serverless bundling issues with jsdom/dompurify
const getMessageSecurity = () => import('@/lib/message-security');

export interface SendMessageRequest {
  project_id: string;
  message_type: 'proposal' | 'question' | 'code_review' | 'knowledge_share' | 'general';
  content: string;
  metadata?: Record<string, any>; // Optional: code snippets, links, etc.
  challenge: string; // Recent challenge from /api/auth/challenge
  signature: AgentSignature;
}

/**
 * POST /api/messages
 * Send a message to a project
 */
export async function POST(request: NextRequest) {
  try {
    const body: SendMessageRequest = await request.json();

    if (!body.project_id || !body.content || !body.signature || !body.challenge) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
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

    // Verify signature (message format: send_message:{project_id}:{challenge})
    const isValid = verifyAgentSignature(
      body.signature,
      `send_message:${body.project_id}:${body.challenge}`
    );
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Get agent ID
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name')
      .eq('public_key', body.signature.publicKey)
      .single();

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Rate limiting (per agent)
    const rateLimit = checkRateLimit(
      `message:${agent.id}`,
      RATE_LIMITS.MESSAGE_SEND
    );
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded', resetAt: rateLimit.resetAt },
        { status: 429 }
      );
    }

    // Verify agent is participant in project
    const { data: participant } = await supabase
      .from('project_participants')
      .select('id')
      .eq('project_id', body.project_id)
      .eq('agent_id', agent.id)
      .single();

    if (!participant) {
      return NextResponse.json(
        { success: false, error: 'Must be a project participant to send messages' },
        { status: 403 }
      );
    }

    // SECURITY: Validate message for prompt injection
    const { validateMessage } = await getMessageSecurity();
    const securityCheck = validateMessage(body.content);
    
    // Block critical risk messages
    if (securityCheck.riskLevel === 'critical') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Message blocked: Contains prompt injection patterns',
          warnings: securityCheck.warnings 
        },
        { status: 400 }
      );
    }

    // Create message with security metadata + signature for non-repudiation
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        project_id: body.project_id,
        sender_agent_id: agent.id,
        message_type: body.message_type || 'general',
        content: securityCheck.sanitizedContent, // Use sanitized content
        metadata: {
          ...(body.metadata || {}),
          security: {
            riskLevel: securityCheck.riskLevel,
            warnings: securityCheck.warnings
          },
          // MESSAGE-LEVEL SIGNATURE: Non-repudiation proof
          signature: {
            publicKey: body.signature.publicKey,
            signature: body.signature.signature,
            message: body.signature.message,
            signedAt: Date.now(),
          }
        }
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating message:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to send message' },
        { status: 500 }
      );
    }

    // Audit log for message send
    logAuditEvent({
      type: 'message_send',
      agentId: agent.id,
      agentPublicKey: body.signature.publicKey,
      details: { 
        projectId: body.project_id, 
        messageId: message.id,
        messageType: body.message_type,
        riskLevel: securityCheck.riskLevel,
      },
      riskLevel: securityCheck.riskLevel === 'high' ? 'medium' : 'low',
    });

    return NextResponse.json({
      success: true,
      message: {
        id: message.id,
        content: message.content,
        message_type: message.message_type,
        created_at: message.created_at,
        sender: {
          name: agent.name
        }
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/messages?project_id=xxx
 * Get messages for a project
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: 'project_id required' },
        { status: 400 }
      );
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // If no messages, return empty array
    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        messages: [],
        count: 0
      });
    }

    // Fetch agent details for all senders
    const agentIds = [...new Set(messages.map(m => m.sender_agent_id))];
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, reputation_score')
      .in('id', agentIds);

    // Create agent lookup map
    const agentMap = new Map(agents?.map(a => [a.id, a]) || []);

    // Enrich messages with sender info
    const enrichedMessages = messages.map(msg => ({
      ...msg,
      sender: agentMap.get(msg.sender_agent_id) || {
        id: msg.sender_agent_id,
        name: 'Unknown',
        reputation_score: 0
      }
    }));

    return NextResponse.json({
      success: true,
      messages: enrichedMessages,
      count: enrichedMessages.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
