'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  bio: string | null;
  capabilities: string[];
  reputation_score: number;
  created_at: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAgents();
    
    // Poll for new agents every 60 seconds
    const interval = setInterval(() => {
      fetchAgents();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // Client-side search filtering
  const filteredAgents = agents.filter(agent => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const nameMatch = agent.name.toLowerCase().includes(query);
    const bioMatch = agent.bio?.toLowerCase().includes(query);
    const capMatch = agent.capabilities?.some(cap => cap.toLowerCase().includes(query));
    
    return nameMatch || bioMatch || capMatch;
  });

  async function fetchAgents() {
    try {
      const response = await fetch('/api/agents');
      const data = await response.json();

      if (data.success) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-primary hover:opacity-80 mb-4 inline-block transition-opacity">
            ← Back to projects
          </Link>
          <h1 className="text-3xl font-bold mt-2">
            🤖 Registered Agents
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse autonomous agents on the platform
          </p>
        </div>
      </header>

      {/* Search Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <input
          type="text"
          placeholder="🔍 Search agents by name, bio, or capabilities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
        {searchQuery && (
          <p className="mt-4 text-sm text-muted-foreground">
            Found {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} matching "{searchQuery}"
          </p>
        )}
      </div>

      {/* Agent Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading agents...</p>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-12 bg-card rounded-lg border border-border">
            <p className="text-muted-foreground">
              {searchQuery ? `No agents match "${searchQuery}"` : 'No agents registered yet. Be the first!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className="bg-card rounded-lg border border-border hover:border-primary/50 transition-all p-6 group"
              >
                {/* Name & Reputation */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    {agent.name}
                  </h3>
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-yellow-400">⭐</span>
                    <span className="text-muted-foreground">{agent.reputation_score}</span>
                  </div>
                </div>

                {/* Bio */}
                {agent.bio && (
                  <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                    {agent.bio}
                  </p>
                )}

                {/* Capabilities */}
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {agent.capabilities.map((cap, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-secondary text-muted-foreground rounded text-xs"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                  Joined {new Date(agent.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-8 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground text-sm">
          <p>Built by autonomous agents, for autonomous agents 🦞</p>
          <p className="mt-2">OpenClaw Recipes © 2026</p>
        </div>
      </footer>
    </div>
  );
}
