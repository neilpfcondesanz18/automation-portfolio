import { test, expect } from '@playwright/test';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Mock the Anthropic API in the browser context.
 * Intercepts fetch calls to api.anthropic.com and returns canned responses.
 */
async function mockAnthropicAPI(page, responseBody) {
  await page.route('https://api.anthropic.com/v1/messages', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify(responseBody) }],
      }),
    });
  });
}

const MOCK_TEST_CASES = {
  summary: 'E2E generated test cases',
  format: 'plain',
  testCases: [
    {
      id: 'TC-001',
      title: 'Successful login',
      type: 'positive',
      priority: 'critical',
      preconditions: ['User exists'],
      steps: ['Go to login', 'Enter credentials', 'Submit'],
      expectedResult: 'Dashboard shown',
      tags: ['smoke', 'auth'],
    },
    {
      id: 'TC-002',
      title: 'Login with wrong password',
      type: 'negative',
      priority: 'high',
      preconditions: [],
      steps: ['Enter wrong password', 'Submit'],
      expectedResult: 'Error shown',
      tags: ['auth'],
    },
  ],
  coverageAreas: ['auth'],
  automationNotes: 'Automate with Playwright',
};

const MOCK_BUG_REPORT = {
  severity: 'critical',
  category: 'api',
  summary: 'NPE in checkout service',
  rootCause: {
    confidence: 'high',
    explanation: 'Null price in expired cart item',
    affectedComponents: ['CartService'],
  },
  immediateActions: ['Rollback', 'Alert on-call'],
  runbook: [
    { step: 1, action: 'Check logs', command: 'kubectl logs pod/api', expectedOutcome: 'NPE visible' },
  ],
  preventionRecommendations: ['Add null checks'],
  relatedIssues: [],
  automationOpportunity: 'Alert on NPE spike',
};

const MOCK_CI_FAILURE = {
  failureType: 'build_error',
  failingStep: 'Build Docker image',
  plainEnglishSummary: 'Docker build failed — base image not found.',
  rootCause: 'Registry auth expired.',
  errorSignals: ['ERROR: node:18-alpine not found', 'pull access denied'],
  fix: {
    confidence: 'high',
    description: 'Re-authenticate with registry.',
    codeChanges: ['Update Dockerfile FROM tag'],
    commands: ['docker login', 'docker pull node:18-alpine'],
  },
  isFlaky: false,
  flakinessReason: null,
  preventionTips: ['Pin digest'],
  estimatedFixTime: '5-30 min',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('QA Intelligence Toolkit — E2E', () => {

  test.describe('App shell', () => {
    test('loads and shows the header and all three tabs', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.brand-name')).toHaveText('QA Intelligence');
      await expect(page.getByTestId('tab-testgen')).toBeVisible();
      await expect(page.getByTestId('tab-bugreport')).toBeVisible();
      await expect(page.getByTestId('tab-cifailure')).toBeVisible();
    });

    test('tab navigation switches panels', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByTestId('testgen-input')).toBeVisible();

      await page.getByTestId('tab-bugreport').click();
      await expect(page.getByTestId('bugreport-input')).toBeVisible();

      await page.getByTestId('tab-cifailure').click();
      await expect(page.getByTestId('cifailure-input')).toBeVisible();

      await page.getByTestId('tab-testgen').click();
      await expect(page.getByTestId('testgen-input')).toBeVisible();
    });

    test('active tab has visual indicator', async ({ page }) => {
      await page.goto('/');
      const tab = page.getByTestId('tab-testgen');
      await expect(tab).toHaveAttribute('aria-selected', 'true');

      await page.getByTestId('tab-bugreport').click();
      await expect(page.getByTestId('tab-bugreport')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('tab-testgen')).toHaveAttribute('aria-selected', 'false');
    });
  });

  test.describe('Test Case Generator', () => {
    test.beforeEach(async ({ page }) => {
      await mockAnthropicAPI(page, MOCK_TEST_CASES);
      await page.goto('/');
    });

    test('submit is disabled with empty input', async ({ page }) => {
      await expect(page.getByTestId('testgen-submit')).toBeDisabled();
    });

    test('load sample populates the textarea', async ({ page }) => {
      await page.getByTestId('testgen-sample').click();
      const value = await page.getByTestId('testgen-input').inputValue();
      expect(value.length).toBeGreaterThan(50);
      await expect(page.getByTestId('testgen-submit')).toBeEnabled();
    });

    test('generates test cases and displays results', async ({ page }) => {
      await page.getByTestId('testgen-input').fill('User story: login feature');
      await page.getByTestId('testgen-submit').click();

      await expect(page.getByTestId('testgen-result')).toBeVisible({ timeout: 10000 });
      const items = page.getByTestId('test-case-item');
      await expect(items).toHaveCount(2);
    });

    test('test case items show ID, type badge and priority badge', async ({ page }) => {
      await page.getByTestId('testgen-input').fill('Login user story');
      await page.getByTestId('testgen-submit').click();

      await expect(page.getByTestId('testgen-result')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('TC-001')).toBeVisible();
      await expect(page.getByText('positive')).toBeVisible();
      await expect(page.getByText('critical')).toBeVisible();
    });

    test('clear button removes results', async ({ page }) => {
      await page.getByTestId('testgen-input').fill('Login user story');
      await page.getByTestId('testgen-submit').click();
      await expect(page.getByTestId('testgen-result')).toBeVisible({ timeout: 10000 });

      await page.getByText('Clear').click();
      await expect(page.getByTestId('testgen-result')).not.toBeVisible();
    });

    test('can change format to gherkin before generating', async ({ page }) => {
      await page.getByTestId('testgen-format').selectOption('gherkin');
      await page.getByTestId('testgen-input').fill('Some story');
      await page.getByTestId('testgen-submit').click();
      await expect(page.getByTestId('testgen-result')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Bug Report Analyser', () => {
    test.beforeEach(async ({ page }) => {
      await mockAnthropicAPI(page, MOCK_BUG_REPORT);
      await page.goto('/');
      await page.getByTestId('tab-bugreport').click();
    });

    test('submit is disabled with empty input', async ({ page }) => {
      await expect(page.getByTestId('bugreport-submit')).toBeDisabled();
    });

    test('load sample populates input', async ({ page }) => {
      await page.getByTestId('bugreport-sample').click();
      const value = await page.getByTestId('bugreport-input').inputValue();
      expect(value).toContain('NullPointerException');
    });

    test('analyses bug report and shows severity badge', async ({ page }) => {
      await page.getByTestId('bugreport-input').fill('TypeError: Cannot read null');
      await page.getByTestId('bugreport-submit').click();

      await expect(page.getByTestId('bugreport-result')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('severity-badge')).toHaveText('critical');
    });

    test('shows escalation alert for critical + high confidence', async ({ page }) => {
      await page.getByTestId('bugreport-input').fill('Critical bug');
      await page.getByTestId('bugreport-submit').click();

      await expect(page.getByTestId('escalation-alert')).toBeVisible({ timeout: 10000 });
    });

    test('displays runbook steps', async ({ page }) => {
      await page.getByTestId('bugreport-input').fill('Stack trace here');
      await page.getByTestId('bugreport-submit').click();

      await expect(page.getByTestId('bugreport-result')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('runbook-step')).toBeVisible();
    });
  });

  test.describe('CI Failure Decoder', () => {
    test.beforeEach(async ({ page }) => {
      await mockAnthropicAPI(page, MOCK_CI_FAILURE);
      await page.goto('/');
      await page.getByTestId('tab-cifailure').click();
    });

    test('submit is disabled with empty input', async ({ page }) => {
      await expect(page.getByTestId('cifailure-submit')).toBeDisabled();
    });

    test('load sample populates input', async ({ page }) => {
      await page.getByTestId('cifailure-sample').click();
      const value = await page.getByTestId('cifailure-input').inputValue();
      expect(value).toContain('npm test');
    });

    test('decodes CI failure and shows failure type', async ({ page }) => {
      await page.getByTestId('cifailure-input').fill('Error: docker build failed\nexit code 1');
      await page.getByTestId('cifailure-submit').click();

      await expect(page.getByTestId('cifailure-result')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('failure-type-badge')).toHaveText('build error');
    });

    test('shows high priority alert for build_error', async ({ page }) => {
      await page.getByTestId('cifailure-input').fill('Build error log');
      await page.getByTestId('cifailure-submit').click();

      await expect(page.getByTestId('high-priority-alert')).toBeVisible({ timeout: 10000 });
    });

    test('displays estimated fix time', async ({ page }) => {
      await page.getByTestId('cifailure-input').fill('Failure log');
      await page.getByTestId('cifailure-submit').click();

      await expect(page.getByTestId('cifailure-result')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('5-30 min')).toBeVisible();
    });

    test('clear button removes decoded result', async ({ page }) => {
      await page.getByTestId('cifailure-input').fill('Error log');
      await page.getByTestId('cifailure-submit').click();
      await expect(page.getByTestId('cifailure-result')).toBeVisible({ timeout: 10000 });

      await page.getByText('Clear').click();
      await expect(page.getByTestId('cifailure-result')).not.toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('tabs use correct ARIA roles and attributes', async ({ page }) => {
      await page.goto('/');
      const tabs = page.locator('[role="tab"]');
      await expect(tabs).toHaveCount(3);

      for (const tab of await tabs.all()) {
        await expect(tab).toHaveAttribute('aria-selected');
        await expect(tab).toHaveAttribute('aria-controls');
      }
    });

    test('panels have tabpanel role', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('[role="tabpanel"]')).toBeVisible();
    });

    test('all textareas are keyboard accessible', async ({ page }) => {
      await page.goto('/');
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toBeVisible();
    });
  });
});
