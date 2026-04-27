import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CIFailureDecoderPanel from '../../../src/components/CIFailureDecoderPanel';

const MOCK_BUILD_ERROR = {
  failureType: 'build_error',
  failingStep: 'Build Docker image',
  plainEnglishSummary: 'Docker build failed because the base image could not be pulled from the registry.',
  rootCause: 'Registry authentication expired or image tag does not exist.',
  errorSignals: [
    'ERROR: failed to solve: node:18-alpine: not found',
    'pull access denied for node',
    'exit code: 1',
  ],
  fix: {
    confidence: 'high',
    description: 'Re-authenticate with the Docker registry and verify the image tag exists.',
    codeChanges: ['Dockerfile: verify FROM image tag exists'],
    commands: ['docker login registry.example.com', 'docker pull node:18-alpine'],
  },
  isFlaky: false,
  flakinessReason: null,
  preventionTips: ['Pin image digests', 'Add registry health check step'],
  estimatedFixTime: '5-30 min',
};

const MOCK_FLAKY = {
  ...MOCK_BUILD_ERROR,
  failureType: 'test_failure',
  isFlaky: true,
  flakinessReason: 'Async test setup race condition under load',
  fix: { ...MOCK_BUILD_ERROR.fix, confidence: 'medium' },
};

function mockApi(result) {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: JSON.stringify(result) }],
    }),
  });
}

describe('CIFailureDecoderPanel (integration)', () => {
  it('renders panel with input and submit button', () => {
    render(<CIFailureDecoderPanel />);
    expect(screen.getByTestId('cifailure-input')).toBeInTheDocument();
    expect(screen.getByTestId('cifailure-submit')).toBeInTheDocument();
  });

  it('submit is disabled when input is empty', () => {
    render(<CIFailureDecoderPanel />);
    expect(screen.getByTestId('cifailure-submit')).toBeDisabled();
  });

  it('loads sample log when Load Sample is clicked', async () => {
    render(<CIFailureDecoderPanel />);
    await userEvent.click(screen.getByTestId('cifailure-sample'));
    expect(screen.getByTestId('cifailure-input').value).toContain('npm test');
  });

  it('displays decoded result after successful API call', async () => {
    mockApi(MOCK_BUILD_ERROR);
    render(<CIFailureDecoderPanel />);

    await userEvent.type(screen.getByTestId('cifailure-input'), 'Error: build failed');
    await userEvent.click(screen.getByTestId('cifailure-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('cifailure-result')).toBeInTheDocument();
    });

    expect(screen.getByTestId('failure-type-badge')).toHaveTextContent('build error');
  });

  it('shows high priority alert for build_error with high fix confidence', async () => {
    mockApi(MOCK_BUILD_ERROR);
    render(<CIFailureDecoderPanel />);

    await userEvent.type(screen.getByTestId('cifailure-input'), 'Build error log');
    await userEvent.click(screen.getByTestId('cifailure-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('high-priority-alert')).toBeInTheDocument();
    });
  });

  it('does NOT show high priority alert for test_failure', async () => {
    mockApi(MOCK_FLAKY);
    render(<CIFailureDecoderPanel />);

    await userEvent.type(screen.getByTestId('cifailure-input'), 'Flaky test log');
    await userEvent.click(screen.getByTestId('cifailure-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('cifailure-result')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('high-priority-alert')).not.toBeInTheDocument();
  });

  it('shows flaky badge when isFlaky is true', async () => {
    mockApi(MOCK_FLAKY);
    render(<CIFailureDecoderPanel />);

    await userEvent.type(screen.getByTestId('cifailure-input'), 'Flaky test log');
    await userEvent.click(screen.getByTestId('cifailure-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('cifailure-result')).toBeInTheDocument();
    });

    expect(screen.getByText(/potentially flaky/i)).toBeInTheDocument();
  });

  it('shows error box when API fails', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ error: { message: 'Service unavailable' } }),
    });

    render(<CIFailureDecoderPanel />);
    await userEvent.type(screen.getByTestId('cifailure-input'), 'some log');
    await userEvent.click(screen.getByTestId('cifailure-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('cifailure-error')).toBeInTheDocument();
    });
  });

  it('displays estimated fix time', async () => {
    mockApi(MOCK_BUILD_ERROR);
    render(<CIFailureDecoderPanel />);

    await userEvent.type(screen.getByTestId('cifailure-input'), 'Error log');
    await userEvent.click(screen.getByTestId('cifailure-submit'));

    await waitFor(() => expect(screen.getByTestId('cifailure-result')).toBeInTheDocument());

    expect(screen.getByText(/5-30 min/)).toBeInTheDocument();
  });

  it('clear button resets the panel', async () => {
    mockApi(MOCK_BUILD_ERROR);
    render(<CIFailureDecoderPanel />);

    await userEvent.type(screen.getByTestId('cifailure-input'), 'Error log');
    await userEvent.click(screen.getByTestId('cifailure-submit'));
    await waitFor(() => expect(screen.getByTestId('cifailure-result')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Clear'));
    expect(screen.queryByTestId('cifailure-result')).not.toBeInTheDocument();
  });
});
