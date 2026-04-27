# QA Intelligence Toolkit

An AI-powered test automation toolkit for senior QA and automation engineers. Built with React + Claude (claude-sonnet-4-20250514).

## Modules

| Module | What it does |
|---|---|
| **Test Case Generator** | Paste a user story or API spec → get structured test cases (plain / Gherkin / code) |
| **Bug Report Analyser** | Paste a stack trace or bug report → triage, root cause, and remediation runbook |
| **CI Failure Decoder** | Paste a CI/CD log → failure type, root cause, fix commands, and flakiness detection |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Run (dev)

```bash
npm run dev
# → http://localhost:3000
```

> The app calls the Anthropic API directly from the browser. No API key is needed when running inside Claude.ai artifacts. For standalone use, add your key to a `.env` file (see below).

---

## Test Suite

### Unit tests

```bash
npm run test:unit
```

Covers: `anthropicClient`, `testCaseGenerator`, `bugReportAnalyser`, `ciFailureDecoder`, `useAIModule` hook.

### Integration tests

```bash
npm run test:integration
```

Covers: all three panel components with mocked API responses using `@testing-library/react`.

### E2E tests (Playwright)

```bash
# Install browsers first (once)
npx playwright install

# Run headless
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

E2E tests intercept `api.anthropic.com` at the network layer via `page.route()` — no real API calls are made.

### Run everything

```bash
npm run test:all
```

### Coverage report

```bash
npm run test
# → coverage/index.html
```

---

## Project Structure

```
ai-test-toolkit/
├── src/
│   ├── components/
│   │   ├── TestCaseGeneratorPanel.jsx
│   │   ├── BugReportAnalyserPanel.jsx
│   │   └── CIFailureDecoderPanel.jsx
│   ├── modules/
│   │   ├── testCaseGenerator.js      # AI module — test case generation
│   │   ├── bugReportAnalyser.js      # AI module — bug triage + runbook
│   │   └── ciFailureDecoder.js       # AI module — CI failure analysis
│   ├── hooks/
│   │   └── useAIModule.js            # Generic hook for AI calls
│   ├── utils/
│   │   └── anthropicClient.js        # Thin wrapper around Anthropic API
│   ├── App.jsx
│   └── App.css
├── tests/
│   ├── setup.js
│   ├── unit/
│   │   ├── anthropicClient.test.js
│   │   ├── testCaseGenerator.test.js
│   │   ├── bugReportAnalyser.test.js
│   │   ├── ciFailureDecoder.test.js
│   │   └── useAIModule.test.js
│   ├── integration/
│   │   ├── TestCaseGeneratorPanel.test.jsx
│   │   ├── BugReportAnalyserPanel.test.jsx
│   │   └── CIFailureDecoderPanel.test.jsx
│   └── e2e/
│       └── app.spec.js
├── index.html
├── vite.config.js
├── jest.config.js
├── babel.config.js
├── playwright.config.js
└── package.json
```

---

## Standalone Use (outside Claude.ai)

If you want to run this outside of Claude.ai, you'll need an Anthropic API key.

Create a `.env` file:

```
VITE_ANTHROPIC_API_KEY=sk-ant-...
```

Then update `src/utils/anthropicClient.js` to read the key:

```js
headers: {
  'Content-Type': 'application/json',
  'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
}
```

> **Note:** Direct browser access to the Anthropic API is fine for personal/dev tools. For production apps, route calls through a backend proxy.

---

## CI/CD Integration

Example GitHub Actions workflow:

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-and-integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Tech Stack

- **React 18** + Vite
- **Claude Sonnet** (Anthropic API)
- **Jest** + `@testing-library/react` — unit & integration tests
- **Playwright** — E2E tests
- **MSW** — available for advanced API mocking patterns
