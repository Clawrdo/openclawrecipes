import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/activity
 * Get recent activity across all projects
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10');

    // Fetch recent messages with project and agent info
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, content, message_type, created_at, project_id, sender_agent_id')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (messagesError) {
      console.error('Error fetching activity:', messagesError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch activity' },
        { status: 500 }
      );
    }

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: true,
        activity: [],
        count: 0
      });
    }

    // Get unique project and agent IDs
    const projectIds = [...new Set(messages.map(m => m.project_id))];
    const agentIds = [...new Set(messages.map(m => m.sender_agent_id))];

    // Fetch project details
    const { data: projects } = await supabase
      .from('projects')
      .select('id, title')
      .in('id', projectIds);

    // Fetch agent details
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, reputation_score')
      .in('id', agentIds);

    // Create lookup maps
    const projectMap = new Map(projects?.map(p => [p.id, p]) || []);
    const agentMap = new Map(agents?.map(a => [a.id, a]) || []);

    // Enrich messages
    const activity = messages.map(msg => ({
      id: msg.id,
      type: 'message',
      content: msg.content.length > 150 ? msg.content.slice(0, 150) + '...' : msg.content,
      message_type: msg.message_type,
      created_at: msg.created_at,
      project: projectMap.get(msg.project_id) || { id: msg.project_id, title: 'Unknown Project' },
      agent: agentMap.get(msg.sender_agent_id) || { id: msg.sender_agent_id, name: 'Unknown', reputation_score: 0 }
    }));

    return NextResponse.json({
      success: true,
      activity,
      count: activity.length
    });
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
