import {
  decodeCIFailure,
  topErrorSignals,
  isHighPriority,
  formatFixTime,
} from '../../../src/modules/ciFailureDecoder';

const MOCK_RESULT = {
  failureType: 'build_error',
  failingStep: 'Build Docker image',
  plainEnglishSummary: 'The Docker build failed because a base image was not found.',
  rootCause: 'Base image node:18-alpine not found in registry.',
  errorSignals: [
    'ERROR: failed to solve: node:18-alpine: not found',
    'pull access denied',
    'exit code: 1',
  ],
  fix: {
    confidence: 'high',
    description: 'Update the base image tag or re-authenticate with the registry.',
    codeChanges: ['Dockerfile: change FROM node:18-alpine to node:18-alpine3.18'],
    commands: ['docker login registry.example.com', 'docker pull node:18-alpine'],
  },
  isFlaky: false,
  flakinessReason: null,
  preventionTips: ['Pin base image digests', 'Add registry health check to pipeline'],
  estimatedFixTime: '5-30 min',
};

const MOCK_FLAKY_RESULT = {
  ...MOCK_RESULT,
  failureType: 'test_failure',
  isFlaky: true,
  flakinessReason: 'Race condition in async test setup',
  fix: { ...MOCK_RESULT.fix, confidence: 'low' },
};

describe('ciFailureDecoder', () => {
  describe('decodeCIFailure', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify(MOCK_RESULT) }],
        }),
      });
    });

    it('throws if log is empty', async () => {
      await expect(decodeCIFailure('')).rejects.toThrow('CI log content is required');
    });

    it('throws if log is only whitespace', async () => {
      await expect(decodeCIFailure('   ')).rejects.toThrow('CI log content is required');
    });

    it('returns structured result with failureType', async () => {
      const result = await decodeCIFailure('Error: process exited with code 1');
      expect(result).toHaveProperty('failureType');
      expect(result).toHaveProperty('fix');
      expect(result).toHaveProperty('errorSignals');
    });

    it('passes log content to the API', async () => {
      const log = 'npm ERR! code ENOENT';
      await decodeCIFailure(log);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toContain(log);
    });
  });

  describe('topErrorSignals', () => {
    it('returns up to n signals', () => {
      expect(topErrorSignals(MOCK_RESULT, 2)).toHaveLength(2);
    });

    it('returns all signals if n > available', () => {
      expect(topErrorSignals(MOCK_RESULT, 10)).toHaveLength(3);
    });

    it('defaults to 3', () => {
      expect(topErrorSignals(MOCK_RESULT)).toHaveLength(3);
    });

    it('returns empty array for null result', () => {
      expect(topErrorSignals(null)).toEqual([]);
    });

    it('returns first signal as most important', () => {
      const signals = topErrorSignals(MOCK_RESULT, 1);
      expect(signals[0]).toContain('node:18-alpine');
    });
  });

  describe('isHighPriority', () => {
    it('returns true for build_error with high confidence fix', () => {
      expect(isHighPriority(MOCK_RESULT)).toBe(true);
    });

    it('returns true for auth failure type with high confidence', () => {
      const authResult = { failureType: 'auth', fix: { confidence: 'high' } };
      expect(isHighPriority(authResult)).toBe(true);
    });

    it('returns false for test_failure type', () => {
      expect(isHighPriority(MOCK_FLAKY_RESULT)).toBe(false);
    });

    it('returns false for build_error with low confidence fix', () => {
      const result = { failureType: 'build_error', fix: { confidence: 'low' } };
      expect(isHighPriority(result)).toBe(false);
    });

    it('returns false for null result', () => {
      expect(isHighPriority(null)).toBe(false);
    });
  });

  describe('formatFixTime', () => {
    it('returns estimated fix time from result', () => {
      expect(formatFixTime(MOCK_RESULT)).toBe('5-30 min');
    });

    it('returns "Unknown" for null result', () => {
      expect(formatFixTime(null)).toBe('Unknown');
    });

    it('returns "Unknown" when estimatedFixTime is missing', () => {
      expect(formatFixTime({})).toBe('Unknown');
    });
  });
});
