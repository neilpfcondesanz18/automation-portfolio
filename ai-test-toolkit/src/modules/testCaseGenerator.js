import { callClaude, parseJsonResponse } from '../utils/anthropicClient';

const SYSTEM_PROMPT = `You are a senior QA automation engineer. When given a user story, feature description, or API spec, you generate comprehensive structured test cases.

Always respond with ONLY a valid JSON object (no markdown, no preamble) in this exact format:
{
  "summary": "Brief summary of what is being tested",
  "format": "the format used (gherkin|plain|code)",
  "testCases": [
    {
      "id": "TC-001",
      "title": "Short test title",
      "type": "positive|negative|edge|security|performance",
      "priority": "critical|high|medium|low",
      "preconditions": ["list of preconditions"],
      "steps": ["step 1", "step 2"],
      "expectedResult": "What should happen",
      "tags": ["tag1", "tag2"]
    }
  ],
  "coverageAreas": ["area1", "area2"],
  "automationNotes": "Notes on automating these tests"
}`;

/**
 * Generate test cases from a user story or feature description.
 * @param {string} input - User story, feature desc, or API spec
 * @param {'gherkin'|'plain'|'code'} format - Output format preference
 * @returns {Promise<object>} Structured test case result
 */
export async function generateTestCases(input, format = 'plain') {
  if (!input?.trim()) {
    throw new Error('Input is required to generate test cases');
  }

  const userMessage = `Generate comprehensive test cases for the following in "${format}" format:\n\n${input}`;
  const raw = await callClaude(SYSTEM_PROMPT, userMessage, 1000);
  return parseJsonResponse(raw);
}

/**
 * Count test cases by type from a result object.
 */
export function summariseByType(result) {
  if (!result?.testCases) return {};
  return result.testCases.reduce((acc, tc) => {
    acc[tc.type] = (acc[tc.type] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Count test cases by priority from a result object.
 */
export function summariseByPriority(result) {
  if (!result?.testCases) return {};
  return result.testCases.reduce((acc, tc) => {
    acc[tc.priority] = (acc[tc.priority] || 0) + 1;
    return acc;
  }, {});
}

/**
 * Filter test cases by type.
 */
export function filterByType(result, type) {
  if (!result?.testCases) return [];
  return result.testCases.filter((tc) => tc.type === type);
}
