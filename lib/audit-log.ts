/**
 * Audit Logging for Security Observability
 * 
 * Logs all security-relevant events for:
 * - Abuse detection
 * - Forensics
 * - Anomaly detection
 */

export type AuditEventType = 
  | 'agent_register'
  | 'agent_register_fail'
  | 'auth_challenge'
  | 'auth_verify'
  | 'auth_fail'
  | 'message_send'
  | 'message_blocked'
  | 'project_create'
  | 'project_join'
  | 'rate_limit_hit'
  | 'pow_fail'
  | 'replay_attempt'
  | 'suspicious_activity';

export interface AuditEvent {
  timestamp: number;
  type: AuditEventType;
  agentId?: string;
  agentPublicKey?: string;
  ip?: string;
  userAgent?: string;
  details: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// In-memory audit log (production would use a real logging service)
const auditLog: AuditEvent[] = [];
const MAX_LOG_SIZE = 10000;

/**
 * Log an audit event
 */
export function logAuditEvent(event: Omit<AuditEvent, 'timestamp'>): void {
  const entry: AuditEvent = {
    ...event,
    timestamp: Date.now(),
  };

  auditLog.push(entry);

  // Trim old entries if over limit
  if (auditLog.length > MAX_LOG_SIZE) {
    auditLog.splice(0, auditLog.length - MAX_LOG_SIZE);
  }

  // Console log for immediate visibility (also goes to Vercel logs)
  const logLevel = entry.riskLevel === 'critical' || entry.riskLevel === 'high' 
    ? 'warn' 
    : 'info';
  
  console[logLevel](`[AUDIT] ${entry.type}`, {
    riskLevel: entry.riskLevel,
    agentId: entry.agentId,
    ip: entry.ip,
    details: entry.details,
  });
}

/**
 * Get recent audit events (for admin/monitoring)
 */
export function getRecentAuditEvents(
  limit: number = 100,
  filter?: {
    type?: AuditEventType;
    riskLevel?: AuditEvent['riskLevel'];
    agentId?: string;
    since?: number;
  }
): AuditEvent[] {
  let events = [...auditLog];

  if (filter) {
    if (filter.type) {
      events = events.filter(e => e.type === filter.type);
    }
    if (filter.riskLevel) {
      events = events.filter(e => e.riskLevel === filter.riskLevel);
    }
    if (filter.agentId) {
      events = events.filter(e => e.agentId === filter.agentId);
    }
    if (filter.since !== undefined) {
      const since = filter.since;
      events = events.filter(e => e.timestamp >= since);
    }
  }

  return events.slice(-limit).reverse();
}

/**
 * Get audit stats (for dashboard)
 */
export function getAuditStats(since: number = Date.now() - 3600000) {
  const recent = auditLog.filter(e => e.timestamp >= since);
  
  return {
    total: recent.length,
    byType: recent.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byRisk: recent.reduce((acc, e) => {
      acc[e.riskLevel] = (acc[e.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    uniqueAgents: new Set(recent.filter(e => e.agentId).map(e => e.agentId)).size,
    uniqueIps: new Set(recent.filter(e => e.ip).map(e => e.ip)).size,
  };
}
