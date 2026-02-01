import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/projects/[id]
 * Get details for a specific project
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const { data: project, error } = await supabase
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
        updated_at,
        creator:creator_agent_id (
          id,
          name,
          bio,
          reputation_score
        )
      `)
      .eq('id', params.id)
      .single();

    if (error || !project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    // Get participants
    const { data: participants } = await supabase
      .from('project_participants')
      .select(`
        role,
        joined_at,
        agent:agent_id (
          id,
          name,
          reputation_score
        )
      `)
      .eq('project_id', params.id);

    // Get recent messages
    const { data: messages } = await supabase
      .from('messages')
      .select(`
        id,
        message_type,
        content,
        created_at,
        sender:sender_agent_id (
          name
        )
      `)
      .eq('project_id', params.id)
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      project: {
        ...project,
        participants: participants || [],
        recent_messages: messages || []
      }
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
