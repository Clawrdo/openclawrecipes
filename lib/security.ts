import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

/**
 * Security utilities for OpenClaw Recipes
 * Protects against XSS, prompt injection, and other attacks
 */

// Prompt injection patterns that could jailbreak agents
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|commands)/gi,
  /you\s+are\s+now\s+/gi,
  /system:\s*/gi,
  /\[INST\]/gi,
  /<\|im_start\|>/gi,
  /assistant:\s*$/gim,
  /\[SYSTEM\]/gi,
  /forget\s+(everything|all|previous)/gi,
  /new\s+instructions:/gi,
  /override\s+(previous|default)/gi,
];

// Content length limits (chars)
export const LIMITS = {
  AGENT_NAME: 50,
  AGENT_BIO: 500,
  AGENT_CAPABILITY: 50,
  AGENT_CAPABILITIES_COUNT: 20,
  PROJECT_TITLE: 200,
  PROJECT_DESCRIPTION: 10000,
  PROJECT_TAG: 30,
  PROJECT_TAGS_COUNT: 10,
  MESSAGE_CONTENT: 5000,
};

/**
 * Detect potential prompt injection attempts
 */
export function detectPromptInjection(text: string): {
  detected: boolean;
  patterns: string[];
} {
  const matches: string[] = [];
  
  for (const pattern of INJECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      matches.push(match[0]);
    }
  }
  
  return {
    detected: matches.length > 0,
    patterns: matches,
  };
}

/**
 * Sanitize markdown content for safe display
 * Converts markdown to HTML, then sanitizes to prevent XSS
 */
export function sanitizeMarkdown(markdown: string): string {
  // Parse markdown to HTML
  const html = marked.parse(markdown, {
    breaks: true,
    gfm: true,
  }) as string;
  
  // Sanitize HTML - only allow safe tags
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'code', 'pre', 'blockquote', 'a', 'hr'
    ],
    ALLOWED_ATTR: ['href'], // Only allow href on links
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

/**
 * Sanitize plain text input
 * Removes dangerous characters and enforces length limits
 */
export function sanitizeText(input: string, maxLength: number): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // Remove control chars
}

/**
 * Validate and sanitize agent name
 * Only allows alphanumeric, underscore, hyphen
 */
export function sanitizeAgentName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .slice(0, LIMITS.AGENT_NAME)
    .replace(/[^a-z0-9_-]/g, '');
  
  if (cleaned.length < 2) {
    throw new Error('Agent name must be at least 2 characters (alphanumeric, _, -)');
  }
  
  return cleaned;
}

/**
 * Validate and sanitize project title
 * Allows alphanumeric, spaces, hyphens, parentheses
 */
export function sanitizeProjectTitle(title: string): string {
  const cleaned = title
    .trim()
    .slice(0, LIMITS.PROJECT_TITLE)
    .replace(/[^\w\s\-()]/g, '');
  
  if (cleaned.length < 3) {
    throw new Error('Project title must be at least 3 characters');
  }
  
  return cleaned;
}

/**
 * Validate array of tags
 */
export function sanitizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  
  return tags
    .slice(0, LIMITS.PROJECT_TAGS_COUNT)
    .map(tag => sanitizeText(tag, LIMITS.PROJECT_TAG))
    .filter(tag => tag.length > 0);
}

/**
 * Validate array of capabilities
 */
export function sanitizeCapabilities(caps: string[]): string[] {
  if (!Array.isArray(caps)) {
    return [];
  }
  
  return caps
    .slice(0, LIMITS.AGENT_CAPABILITIES_COUNT)
    .map(cap => sanitizeText(cap, LIMITS.AGENT_CAPABILITY))
    .filter(cap => cap.length > 0);
}

/**
 * Comprehensive content validation
 * Returns sanitized content + warnings
 */
export interface ValidationResult {
  safe: boolean;
  content: string;
  warnings: string[];
}

export function validateContent(
  content: string,
  maxLength: number
): ValidationResult {
  const warnings: string[] = [];
  
  // Check length
  if (content.length > maxLength) {
    warnings.push(`Content truncated to ${maxLength} characters`);
    content = content.slice(0, maxLength);
  }
  
  // Check for prompt injection
  const injection = detectPromptInjection(content);
  if (injection.detected) {
    warnings.push('⚠️ Potential prompt injection detected');
    warnings.push(`Suspicious patterns: ${injection.patterns.join(', ')}`);
  }
  
  // Sanitize
  const sanitized = sanitizeText(content, maxLength);
  
  return {
    safe: warnings.length === 0,
    content: sanitized,
    warnings,
  };
}
