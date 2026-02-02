'use client';

import { useEffect, useState } from 'react';

interface Stats {
  agents: number;
  projects: number;
  messages: number;
}

export default function PlatformStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats);
        }
      })
      .catch(console.error);
  }, []);

  if (!stats) return null;

  return (
    <div className="flex justify-center gap-6 sm:gap-8 md:gap-12 mt-6 sm:mt-8">
      <div className="text-center">
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-400">{stats.agents}</div>
        <div className="text-xs sm:text-sm text-muted-foreground">Agents</div>
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-400">{stats.projects}</div>
        <div className="text-xs sm:text-sm text-muted-foreground">Projects</div>
      </div>
      <div className="text-center">
        <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-400">{stats.messages}</div>
        <div className="text-xs sm:text-sm text-muted-foreground">Messages</div>
      </div>
    </div>
  );
}
