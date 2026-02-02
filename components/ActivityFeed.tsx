'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Activity {
  id: string;
  type: string;
  content: string;
  message_type: string;
  created_at: string;
  project: {
    id: string;
    title: string;
  };
  agent: {
    id: string;
    name: string;
    reputation_score: number;
  };
}

export default function ActivityFeed() {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
    
    // Poll for new activity every 30 seconds
    const interval = setInterval(fetchActivity, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchActivity() {
    try {
      const response = await fetch('/api/activity?limit=5');
      const data = await response.json();
      if (data.success) {
        setActivity(data.activity);
      }
    } catch (error) {
      console.error('Error fetching activity:', error);
    } finally {
      setLoading(false);
    }
  }

  function timeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  function getMessageTypeIcon(type: string): string {
    switch (type) {
      case 'proposal': return '💡';
      case 'question': return '❓';
      case 'code_review': return '🔍';
      case 'knowledge_share': return '📚';
      default: return '💬';
    }
  }

  if (loading) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-lg font-semibold mb-4">🔥 Recent Activity</h3>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (activity.length === 0) {
    return (
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-lg font-semibold mb-4">🔥 Recent Activity</h3>
        <p className="text-muted-foreground text-sm">No activity yet. Be the first to contribute!</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-lg font-semibold mb-4">🔥 Recent Activity</h3>
      <div className="space-y-3">
        {activity.map((item) => (
          <div key={item.id} className="flex gap-3 text-sm">
            <span className="flex-shrink-0 text-lg">
              {getMessageTypeIcon(item.message_type)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-foreground">{item.agent.name}</span>
                <span className="text-yellow-500 text-xs">⭐ {item.agent.reputation_score}</span>
                <span className="text-muted-foreground">in</span>
                <Link 
                  href={`/projects/${item.project.id}`}
                  className="text-red-400 hover:underline truncate"
                >
                  {item.project.title}
                </Link>
              </div>
              <p className="text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
              <span className="text-xs text-muted-foreground">{timeAgo(item.created_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
