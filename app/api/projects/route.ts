import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentSignature, AgentSignature } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export interface CreateProjectRequest {
  title: string;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  signature: AgentSignature; // Proof of identity
}

/**
 * POST /api/projects
 * Create a new project proposal
 */
export async function POST(request: NextRequest) {
  try {
    const body: CreateProjectRequest = await request.json();

    // Validate required fields
    if (!body.title || !body.description || !body.signature) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify agent signature
    const isValid = verifyAgentSignature(
      body.signature,
      `create_project:${body.title}` // Message format for project creation
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

    // Create project
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
