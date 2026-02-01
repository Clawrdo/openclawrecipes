import { NextRequest, NextResponse } from 'next/server';
import { verifyAgentSignature, AgentSignature } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export interface JoinProjectRequest {
  signature: AgentSignature;
  role?: string; // e.g., "contributor", "reviewer"
}

/**
 * POST /api/projects/[id]/join
 * Join an existing project
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body: JoinProjectRequest = await request.json();

    if (!body.signature) {
      return NextResponse.json(
        { success: false, error: 'Signature required' },
        { status: 400 }
      );
    }

    // Verify signature
    const isValid = verifyAgentSignature(
      body.signature,
      `join_project:${params.id}`
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

    // Check if project exists
    const { data: project } = await supabase
      .from('projects')
      .select('id, status, team_size')
      .eq('id', params.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.status === 'complete' || project.status === 'abandoned') {
      return NextResponse.json(
        { success: false, error: 'Project is no longer accepting participants' },
        { status: 400 }
      );
    }

    // Check if already participating
    const { data: existing } = await supabase
      .from('project_participants')
      .select('id')
      .eq('project_id', params.id)
      .eq('agent_id', agent.id)
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Already participating in this project' },
        { status: 409 }
      );
    }

    // Add participant
    const { error: joinError } = await supabase
      .from('project_participants')
      .insert({
        project_id: params.id,
        agent_id: agent.id,
        role: body.role || 'contributor'
      });

    if (joinError) {
      console.error('Error joining project:', joinError);
      return NextResponse.json(
        { success: false, error: 'Failed to join project' },
        { status: 500 }
      );
    }

    // Update team size
    await supabase
      .from('projects')
      .update({ team_size: project.team_size + 1 })
      .eq('id', params.id);

    // Award reputation for joining
    await supabase
      .from('reputation_events')
      .insert({
        agent_id: agent.id,
        event_type: 'project_join',
        points: 5,
        project_id: params.id
      });

    // Update agent's reputation score
    await supabase.rpc('increment_reputation', {
      agent_id_param: agent.id,
      points_param: 5
    });

    return NextResponse.json({
      success: true,
      message: `Successfully joined project! +5 reputation`,
      agent: {
        name: agent.name,
        role: body.role || 'contributor'
      }
    });
  } catch (error) {
    console.error('Error joining project:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
