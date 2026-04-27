import { callClaude, parseJsonResponse } from '../utils/anthropicClient';

const SYSTEM_PROMPT = `You are a DevOps and CI/CD expert. Analyse GitHub Actions logs and CI/CD failure outputs.

Always respond with ONLY a valid JSON object (no markdown, no preamble) in this exact format:
{
  "failureType": "test_failure|build_error|lint_error|timeout|dependency|auth|network|config|unknown",
  "failingStep": "Name of the failing step or job",
  "plainEnglishSummary": "What went wrong in plain English (max 2 sentences)",
  "rootCause": "Technical root cause explanation",
  "errorSignals": ["Key error lines or patterns extracted from the log"],
  "fix": {
    "confidence": "high|medium|low",
    "description": "What to do to fix this",
    "codeChanges": ["Specific file or config changes needed"],
    "commands": ["Commands to run to fix or diagnose"]
  },
  "isFlaky": true,
  "flakinessReason": "Why this might be flaky (null if not flaky)",
  "preventionTips": ["How to prevent this in future"],
  "estimatedFixTime": "< 5 min | 5-30 min | 30-60 min | > 1 hour"
}`;

/**
 * Decode a CI/CD failure log.
 * @param {string} log - Raw CI log output (e.g. GitHub Actions log)
 * @returns {Promise<object>} Structured failure analysis
 */
export async function decodeCIFailure(log) {
  if (!log?.trim()) {
    throw new Error('CI log content is required');
  }

  const userMessage = `Analyse this CI/CD failure log and provide a structured diagnosis:\n\n${log}`;
  const raw = await callClaude(SYSTEM_PROMPT, userMessage, 1000);
  return parseJsonResponse(raw);
}

/**
 * Extract the top error signals from a decoded result (max n).
 */
export function topErrorSignals(result, n = 3) {
  if (!result?.errorSignals) return [];
  return result.errorSignals.slice(0, n);
}

/**
 * Determine if a failure warrants immediate attention.
 */
export function isHighPriority(result) {
  const blockers = ['build_error', 'auth', 'config'];
  return blockers.includes(result?.failureType) && result?.fix?.confidence === 'high';
}

/**
 * Format fix time estimate for display.
 */
export function formatFixTime(result) {
  return result?.estimatedFixTime || 'Unknown';
}
