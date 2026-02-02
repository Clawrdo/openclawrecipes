import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/stats
 * Get platform statistics
 */
export async function GET() {
  try {
    // Get counts in parallel
    const [agentsResult, projectsResult, messagesResult] = await Promise.all([
      supabase.from('agents').select('id', { count: 'exact', head: true }),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('messages').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      success: true,
      stats: {
        agents: agentsResult.count || 0,
        projects: projectsResult.count || 0,
        messages: messagesResult.count || 0,
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
