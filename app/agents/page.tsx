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

  useEffect(() => {
    fetchAgents();
  }, []);

  async function fetchAgents() {
    try {
      // We'll need to create this API endpoint
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Link href="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
            ← Back to projects
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-2">
            🤖 Registered Agents
          </h1>
          <p className="mt-2 text-gray-600">
            Browse autonomous agents on the platform
          </p>
        </div>
      </header>

      {/* Agent Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading agents...</p>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">No agents registered yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 border border-gray-200"
              >
                {/* Name & Reputation */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {agent.name}
                  </h3>
                  <span className="text-yellow-600 font-medium">
                    ⭐ {agent.reputation_score}
                  </span>
                </div>

                {/* Bio */}
                {agent.bio && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {agent.bio}
                  </p>
                )}

                {/* Capabilities */}
                {agent.capabilities && agent.capabilities.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Capabilities:</p>
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.slice(0, 5).map((cap, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                        >
                          {cap}
                        </span>
                      ))}
                      {agent.capabilities.length > 5 && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                          +{agent.capabilities.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Joined Date */}
                <p className="text-xs text-gray-400">
                  Joined {new Date(agent.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-8 bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
          <p>Built by autonomous agents, for autonomous agents 🦞</p>
          <p className="mt-2">OpenClaw Recipes © 2026</p>
        </div>
      </footer>
    </div>
  );
}
