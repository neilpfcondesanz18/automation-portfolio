import {
  generateTestCases,
  summariseByType,
  summariseByPriority,
  filterByType,
} from '../../../src/modules/testCaseGenerator';

const MOCK_RESULT = {
  summary: 'Login feature test cases',
  format: 'plain',
  testCases: [
    { id: 'TC-001', title: 'Valid login', type: 'positive', priority: 'critical', steps: [], expectedResult: 'Redirect to dashboard', tags: ['auth'] },
    { id: 'TC-002', title: 'Invalid password', type: 'negative', priority: 'high', steps: [], expectedResult: 'Show error', tags: ['auth'] },
    { id: 'TC-003', title: 'Account lockout', type: 'negative', priority: 'high', steps: [], expectedResult: 'Account locked', tags: ['security'] },
    { id: 'TC-004', title: 'SQL injection', type: 'security', priority: 'critical', steps: [], expectedResult: 'Reject input', tags: ['security'] },
    { id: 'TC-005', title: 'Empty username', type: 'edge', priority: 'medium', steps: [], expectedResult: 'Validation error', tags: [] },
  ],
  coverageAreas: ['authentication', 'validation'],
  automationNotes: 'Can be automated with Playwright',
};

describe('testCaseGenerator', () => {
  describe('generateTestCases', () => {
    const mockApiCall = () =>
      Promise.resolve(JSON.stringify(MOCK_RESULT));

    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify(MOCK_RESULT) }],
        }),
      });
    });

    it('throws if input is empty', async () => {
      await expect(generateTestCases('')).rejects.toThrow('Input is required');
    });

    it('throws if input is only whitespace', async () => {
      await expect(generateTestCases('   ')).rejects.toThrow('Input is required');
    });

    it('returns structured result with testCases array', async () => {
      const result = await generateTestCases('User story: login', 'plain');
      expect(result).toHaveProperty('testCases');
      expect(Array.isArray(result.testCases)).toBe(true);
    });

    it('sends format preference in the user message', async () => {
      await generateTestCases('Some user story', 'gherkin');
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toContain('gherkin');
    });

    it('defaults to plain format', async () => {
      await generateTestCases('Some user story');
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toContain('plain');
    });
  });

  describe('summariseByType', () => {
    it('returns counts per type', () => {
      const summary = summariseByType(MOCK_RESULT);
      expect(summary.positive).toBe(1);
      expect(summary.negative).toBe(2);
      expect(summary.security).toBe(1);
      expect(summary.edge).toBe(1);
    });

    it('returns empty object for null input', () => {
      expect(summariseByType(null)).toEqual({});
    });

    it('returns empty object when testCases is missing', () => {
      expect(summariseByType({ summary: 'test' })).toEqual({});
    });
  });

  describe('summariseByPriority', () => {
    it('returns counts per priority', () => {
      const summary = summariseByPriority(MOCK_RESULT);
      expect(summary.critical).toBe(2);
      expect(summary.high).toBe(2);
      expect(summary.medium).toBe(1);
    });

    it('returns empty object for null input', () => {
      expect(summariseByPriority(null)).toEqual({});
    });
  });

  describe('filterByType', () => {
    it('filters test cases by type', () => {
      const negatives = filterByType(MOCK_RESULT, 'negative');
      expect(negatives).toHaveLength(2);
      expect(negatives.every((tc) => tc.type === 'negative')).toBe(true);
    });

    it('returns empty array for unmatched type', () => {
      expect(filterByType(MOCK_RESULT, 'performance')).toEqual([]);
    });

    it('returns empty array for null result', () => {
      expect(filterByType(null, 'positive')).toEqual([]);
    });
  });
});
