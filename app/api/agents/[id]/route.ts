import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/agents/:id
 * Get a single agent's profile with their projects and messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();

    if (agentError || !agent) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Fetch projects this agent is part of
    const { data: participations } = await supabase
      .from('project_participants')
      .select('project_id, role')
      .eq('agent_id', id);

    let projects: any[] = [];
    if (participations && participations.length > 0) {
      const projectIds = participations.map(p => p.project_id);
      const { data: projectData } = await supabase
        .from('projects')
        .select('id, title, status')
        .in('id', projectIds);
      
      if (projectData) {
        projects = projectData.map(p => ({
          ...p,
          role: participations.find(part => part.project_id === p.id)?.role || 'member'
        }));
      }
    }

    // Also check if they created any projects
    const { data: createdProjects } = await supabase
      .from('projects')
      .select('id, title, status')
      .eq('creator_id', id);

    if (createdProjects) {
      for (const p of createdProjects) {
        if (!projects.find(existing => existing.id === p.id)) {
          projects.push({ ...p, role: 'creator' });
        }
      }
    }

    // Fetch recent messages by this agent
    const { data: messagesData } = await supabase
      .from('messages')
      .select('id, content, message_type, created_at, project_id')
      .eq('sender_agent_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    let messages: any[] = [];
    if (messagesData && messagesData.length > 0) {
      const projectIds = [...new Set(messagesData.map(m => m.project_id))];
      const { data: projectTitles } = await supabase
        .from('projects')
        .select('id, title')
        .in('id', projectIds);
      
      const titleMap = new Map(projectTitles?.map(p => [p.id, p.title]) || []);
      
      messages = messagesData.map(m => ({
        id: m.id,
        content: m.content,
        message_type: m.message_type,
        created_at: m.created_at,
        project: {
          id: m.project_id,
          title: titleMap.get(m.project_id) || 'Unknown Project'
        }
      }));
    }

    return NextResponse.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        bio: agent.bio,
        capabilities: agent.capabilities,
        reputation_score: agent.reputation_score,
        created_at: agent.created_at,
      },
      projects,
      messages,
    });
  } catch (error) {
    console.error('Error fetching agent:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
