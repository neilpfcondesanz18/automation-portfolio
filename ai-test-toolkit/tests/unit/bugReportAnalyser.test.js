import {
  analyseBugReport,
  severityColour,
  requiresEscalation,
} from '../../../src/modules/bugReportAnalyser';

const MOCK_CRITICAL_RESULT = {
  severity: 'critical',
  category: 'api',
  summary: 'NullPointerException on checkout',
  rootCause: {
    confidence: 'high',
    explanation: 'Expired cart item has null price',
    affectedComponents: ['CartService', 'CheckoutController'],
  },
  immediateActions: ['Rollback deploy', 'Alert on-call'],
  runbook: [
    { step: 1, action: 'Check logs', command: 'kubectl logs pod/api', expectedOutcome: 'Error visible' },
  ],
  preventionRecommendations: ['Add null checks'],
  relatedIssues: ['Cart expiry race condition'],
  automationOpportunity: 'Add alert when NPE rate spikes',
};

const MOCK_LOW_RESULT = {
  ...MOCK_CRITICAL_RESULT,
  severity: 'low',
  rootCause: { ...MOCK_CRITICAL_RESULT.rootCause, confidence: 'low' },
};

describe('bugReportAnalyser', () => {
  describe('analyseBugReport', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: JSON.stringify(MOCK_CRITICAL_RESULT) }],
        }),
      });
    });

    it('throws if input is empty', async () => {
      await expect(analyseBugReport('')).rejects.toThrow('Bug report content is required');
    });

    it('throws if input is only whitespace', async () => {
      await expect(analyseBugReport('  ')).rejects.toThrow('Bug report content is required');
    });

    it('returns structured triage result', async () => {
      const result = await analyseBugReport('TypeError: Cannot read null');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('rootCause');
      expect(result).toHaveProperty('runbook');
    });

    it('passes the bug report text to the API', async () => {
      const bugText = 'Some stack trace here';
      await analyseBugReport(bugText);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.messages[0].content).toContain(bugText);
    });
  });

  describe('severityColour', () => {
    it('returns red for critical', () => {
      expect(severityColour('critical')).toBe('#ef4444');
    });

    it('returns orange for high', () => {
      expect(severityColour('high')).toBe('#f97316');
    });

    it('returns yellow for medium', () => {
      expect(severityColour('medium')).toBe('#eab308');
    });

    it('returns green for low', () => {
      expect(severityColour('low')).toBe('#22c55e');
    });

    it('returns grey for unknown severity', () => {
      expect(severityColour('unknown')).toBe('#6b7280');
    });

    it('is case-insensitive', () => {
      expect(severityColour('CRITICAL')).toBe('#ef4444');
    });

    it('handles null/undefined gracefully', () => {
      expect(severityColour(null)).toBe('#6b7280');
      expect(severityColour(undefined)).toBe('#6b7280');
    });
  });

  describe('requiresEscalation', () => {
    it('returns true for critical severity + high confidence', () => {
      expect(requiresEscalation(MOCK_CRITICAL_RESULT)).toBe(true);
    });

    it('returns false for low severity', () => {
      expect(requiresEscalation(MOCK_LOW_RESULT)).toBe(false);
    });

    it('returns false for critical severity but low confidence', () => {
      const result = {
        severity: 'critical',
        rootCause: { confidence: 'low' },
      };
      expect(requiresEscalation(result)).toBe(false);
    });

    it('returns false for null result', () => {
      expect(requiresEscalation(null)).toBe(false);
    });
  });
});
