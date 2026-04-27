import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TestCaseGeneratorPanel from '../../../src/components/TestCaseGeneratorPanel';

const MOCK_API_RESULT = {
  summary: 'Login test cases generated',
  format: 'plain',
  testCases: [
    {
      id: 'TC-001',
      title: 'Successful login with valid credentials',
      type: 'positive',
      priority: 'critical',
      preconditions: ['User is registered'],
      steps: ['Navigate to login page', 'Enter valid email', 'Enter valid password', 'Click login'],
      expectedResult: 'User is redirected to dashboard',
      tags: ['auth', 'smoke'],
    },
    {
      id: 'TC-002',
      title: 'Login fails with invalid password',
      type: 'negative',
      priority: 'high',
      preconditions: ['User is registered'],
      steps: ['Enter valid email', 'Enter wrong password', 'Click login'],
      expectedResult: 'Error message shown',
      tags: ['auth'],
    },
  ],
  coverageAreas: ['authentication'],
  automationNotes: 'Automate with Playwright',
};

function mockApiSuccess() {
  global.fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      content: [{ type: 'text', text: JSON.stringify(MOCK_API_RESULT) }],
    }),
  });
}

function mockApiError(message = 'Internal Server Error') {
  global.fetch.mockResolvedValue({
    ok: false,
    status: 500,
    statusText: message,
    json: async () => ({ error: { message } }),
  });
}

describe('TestCaseGeneratorPanel (integration)', () => {
  it('renders the panel with input and submit button', () => {
    render(<TestCaseGeneratorPanel />);
    expect(screen.getByTestId('testgen-input')).toBeInTheDocument();
    expect(screen.getByTestId('testgen-submit')).toBeInTheDocument();
    expect(screen.getByTestId('testgen-format')).toBeInTheDocument();
  });

  it('submit button is disabled when input is empty', () => {
    render(<TestCaseGeneratorPanel />);
    expect(screen.getByTestId('testgen-submit')).toBeDisabled();
  });

  it('submit button enables when user types input', async () => {
    render(<TestCaseGeneratorPanel />);
    await userEvent.type(screen.getByTestId('testgen-input'), 'User story text');
    expect(screen.getByTestId('testgen-submit')).not.toBeDisabled();
  });

  it('loads sample input when Load Sample is clicked', async () => {
    render(<TestCaseGeneratorPanel />);
    await userEvent.click(screen.getByTestId('testgen-sample'));
    expect(screen.getByTestId('testgen-input').value).toContain('registered user');
  });

  it('displays test case results after successful API call', async () => {
    mockApiSuccess();
    render(<TestCaseGeneratorPanel />);

    await userEvent.type(screen.getByTestId('testgen-input'), 'A user story about login');
    await userEvent.click(screen.getByTestId('testgen-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('testgen-result')).toBeInTheDocument();
    });

    expect(screen.getAllByTestId('test-case-item')).toHaveLength(2);
    expect(screen.getByText('TC-001')).toBeInTheDocument();
    expect(screen.getByText('TC-002')).toBeInTheDocument();
  });

  it('displays error message on API failure', async () => {
    mockApiError('Service unavailable');
    render(<TestCaseGeneratorPanel />);

    await userEvent.type(screen.getByTestId('testgen-input'), 'A user story');
    await userEvent.click(screen.getByTestId('testgen-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('testgen-error')).toBeInTheDocument();
    });
  });

  it('sends selected format to the API', async () => {
    mockApiSuccess();
    render(<TestCaseGeneratorPanel />);

    await userEvent.type(screen.getByTestId('testgen-input'), 'Story text');
    await userEvent.selectOptions(screen.getByTestId('testgen-format'), 'gherkin');
    await userEvent.click(screen.getByTestId('testgen-submit'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain('gherkin');
  });

  it('shows badges for type and priority on test case items', async () => {
    mockApiSuccess();
    render(<TestCaseGeneratorPanel />);

    await userEvent.type(screen.getByTestId('testgen-input'), 'Story');
    await userEvent.click(screen.getByTestId('testgen-submit'));

    await waitFor(() => expect(screen.getByTestId('testgen-result')).toBeInTheDocument());

    expect(screen.getByText('positive')).toBeInTheDocument();
    expect(screen.getByText('critical')).toBeInTheDocument();
  });

  it('clear button resets the result', async () => {
    mockApiSuccess();
    render(<TestCaseGeneratorPanel />);

    await userEvent.type(screen.getByTestId('testgen-input'), 'Story');
    await userEvent.click(screen.getByTestId('testgen-submit'));
    await waitFor(() => expect(screen.getByTestId('testgen-result')).toBeInTheDocument());

    await userEvent.click(screen.getByText('Clear'));
    expect(screen.queryByTestId('testgen-result')).not.toBeInTheDocument();
  });
});
