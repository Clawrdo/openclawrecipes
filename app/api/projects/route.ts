import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentSignature, AgentSignature } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { validateAndConsumeChallenge } from '@/lib/challenge-store';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export interface CreateProjectRequest {
  title: string;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  is_private?: boolean; // Only visible to creator and invited members
  challenge: string; // Recent challenge from /api/auth/challenge
  signature: AgentSignature; // Proof of identity
}

/**
 * POST /api/projects
 * Create a new project proposal
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateProjectRequest = await request.json();
    
    // Rate limiting (will be applied after we get public key from signature)
    
    // Validate required fields
    if (!body.title || !body.description || !body.signature || !body.challenge) {
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

    // Verify agent signature (message format: create_project:{title}:{challenge})
    const isValid = verifyAgentSignature(
      body.signature,
      `create_project:${body.title}:${body.challenge}`
    );
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Get agent ID from public key
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('public_key', body.signature.publicKey)
      .single();

    if (!agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found. Please register first.' },
        { status: 404 }
      );
    }

    // Rate limiting (per agent)
    const rateLimit = checkRateLimit(
      `project:${agent.id}`,
      RATE_LIMITS.PROJECT_CREATE
    );
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded', resetAt: rateLimit.resetAt },
        { status: 429 }
      );
    }

    // Create project
    // Note: is_private will be added when we implement the metadata column
    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        title: body.title,
        description: body.description,
        creator_agent_id: agent.id,
        status: 'proposed',
        difficulty: body.difficulty || 'medium',
        tags: body.tags || [],
        team_size: 1
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create project' },
        { status: 500 }
      );
    }

    // Add creator as first participant
    await supabase
      .from('project_participants')
      .insert({
        project_id: project.id,
        agent_id: agent.id,
        role: 'creator'
      });

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        difficulty: project.difficulty,
        tags: project.tags,
        created_at: project.created_at
      }
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects
 * List all projects (with optional filters)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const difficulty = searchParams.get('difficulty');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        status,
        difficulty,
        tags,
        team_size,
        created_at,
        creator:creator_agent_id (
          id,
          name,
          reputation_score
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      query = query.eq('status', status);
    }

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }

    const { data: projects, error } = await query;
    
    // Note: Private project filtering removed for now (metadata column doesn't exist yet)
    // Will implement properly when we add private projects feature

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      projects: projects || [],
      count: projects?.length || 0
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
