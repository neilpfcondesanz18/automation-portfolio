import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BugReportAnalyserPanel from '../../../src/components/BugReportAnalyserPanel';

const MOCK_CRITICAL = {
  severity: 'critical',
  category: 'api',
  summary: 'NullPointerException in checkout service',
  rootCause: {
    confidence: 'high',
    explanation: 'Cart item with null price passes into total calculation',
    affectedComponents: ['CartService', 'CheckoutController'],
  },
  immediateActions: ['Rollback the deploy', 'Page the on-call engineer'],
  runbook: [
    {
      step: 1,
      action: 'Check application logs for the past 2 hours',
      command: 'kubectl logs deployment/api --since=2h | grep ERROR',
      expectedOutcome: 'NPE stack traces visible in output',
    },
    {
      step: 2,
      action: 'Verify cart expiry handling',
      command: 'redis-cli HGETALL cart:session:abc',
      expectedOutcome: 'Expired items should have null price field',
    },
  ],
  preventionRecommendations: ['Add null guard in CartService.calculateTotal'],
  relatedIssues: ['Cart expiry race condition'],
  automationOpportunity: 'Alert when NPE rate in checkout exceeds threshold',
};

const MOCK_LOW = {
  ...MOCK_CRITICAL,
  severity: 'low',
  rootCause: { ...MOCK_CRITICAL.rootCause, confidence: 'low' },
};

function mockApi(result) {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: JSON.stringify(result) }],
    }),
  });
}

describe('BugReportAnalyserPanel (integration)', () => {
  it('renders the panel with input and submit button', () => {
    render(<BugReportAnalyserPanel />);
    expect(screen.getByTestId('bugreport-input')).toBeInTheDocument();
    expect(screen.getByTestId('bugreport-submit')).toBeInTheDocument();
  });

  it('submit button is disabled when input is empty', () => {
    render(<BugReportAnalyserPanel />);
    expect(screen.getByTestId('bugreport-submit')).toBeDisabled();
  });

  it('loads sample bug report when Load Sample is clicked', async () => {
    render(<BugReportAnalyserPanel />);
    await userEvent.click(screen.getByTestId('bugreport-sample'));
    expect(screen.getByTestId('bugreport-input').value).toContain('NullPointerException');
  });

  it('shows triage result with severity badge after API call', async () => {
    mockApi(MOCK_CRITICAL);
    render(<BugReportAnalyserPanel />);

    await userEvent.type(screen.getByTestId('bugreport-input'), 'Some stack trace');
    await userEvent.click(screen.getByTestId('bugreport-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('bugreport-result')).toBeInTheDocument();
    });

    expect(screen.getByTestId('severity-badge')).toHaveTextContent('critical');
  });

  it('shows escalation alert for critical + high confidence', async () => {
    mockApi(MOCK_CRITICAL);
    render(<BugReportAnalyserPanel />);

    await userEvent.type(screen.getByTestId('bugreport-input'), 'Stack trace');
    await userEvent.click(screen.getByTestId('bugreport-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('escalation-alert')).toBeInTheDocument();
    });
  });

  it('does NOT show escalation alert for low severity', async () => {
    mockApi(MOCK_LOW);
    render(<BugReportAnalyserPanel />);

    await userEvent.type(screen.getByTestId('bugreport-input'), 'Minor bug');
    await userEvent.click(screen.getByTestId('bugreport-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('bugreport-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('escalation-alert')).not.toBeInTheDocument();
  });

  it('renders all runbook steps', async () => {
    mockApi(MOCK_CRITICAL);
    render(<BugReportAnalyserPanel />);

    await userEvent.type(screen.getByTestId('bugreport-input'), 'Stack trace');
    await userEvent.click(screen.getByTestId('bugreport-submit'));

    await waitFor(() => {
      expect(screen.getAllByTestId('runbook-step')).toHaveLength(2);
    });
  });

  it('shows error box on API failure', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server error',
      json: async () => ({ error: { message: 'Server error' } }),
    });

    render(<BugReportAnalyserPanel />);
    await userEvent.type(screen.getByTestId('bugreport-input'), 'bug info');
    await userEvent.click(screen.getByTestId('bugreport-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('bugreport-error')).toBeInTheDocument();
    });
  });

  it('clear button resets the view', async () => {
    mockApi(MOCK_CRITICAL);
    render(<BugReportAnalyserPanel />);

    await userEvent.type(screen.getByTestId('bugreport-input'), 'Stack trace');
    await userEvent.click(screen.getByTestId('bugreport-submit'));
    await waitFor(() => expect(screen.getByTestId('bugreport-result')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Clear'));
    expect(screen.queryByTestId('bugreport-result')).not.toBeInTheDocument();
  });
});
