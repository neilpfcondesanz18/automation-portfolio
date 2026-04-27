import { callClaude, parseJsonResponse } from '../utils/anthropicClient';

const SYSTEM_PROMPT = `You are a senior QA and platform engineer specialising in incident triage and root cause analysis. Analyse bug reports and stack traces.

Always respond with ONLY a valid JSON object (no markdown, no preamble) in this exact format:
{
  "severity": "critical|high|medium|low",
  "category": "ui|api|database|network|auth|performance|data|infra|unknown",
  "summary": "One-line plain-English summary of the issue",
  "rootCause": {
    "confidence": "high|medium|low",
    "explanation": "Detailed root cause explanation",
    "affectedComponents": ["component1", "component2"]
  },
  "immediateActions": ["Action 1", "Action 2"],
  "runbook": [
    {
      "step": 1,
      "action": "What to do",
      "command": "Optional shell/code command",
      "expectedOutcome": "What success looks like"
    }
  ],
  "preventionRecommendations": ["Recommendation 1"],
  "relatedIssues": ["Possible related failure patterns"],
  "automationOpportunity": "How this could be automated or caught earlier"
}`;

/**
 * Analyse a bug report or stack trace.
 * @param {string} bugReport - Raw bug report, error log, or stack trace
 * @returns {Promise<object>} Structured triage result
 */
export async function analyseBugReport(bugReport) {
  if (!bugReport?.trim()) {
    throw new Error('Bug report content is required');
  }

  const userMessage = `Triage this bug report and provide a structured analysis:\n\n${bugReport}`;
  const raw = await callClaude(SYSTEM_PROMPT, userMessage, 1000);
  return parseJsonResponse(raw);
}

/**
 * Determine badge colour for a severity level.
 */
export function severityColour(severity) {
  const map = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
  };
  return map[severity?.toLowerCase()] || '#6b7280';
}

/**
 * Check if a triage result requires immediate escalation.
 */
export function requiresEscalation(result) {
  return result?.severity === 'critical' && result?.rootCause?.confidence === 'high';
}
