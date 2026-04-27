# Automation Engineer Portfolio

A monorepo showcasing the skills required for a **Platform / Automation Engineer** role — incident automation, CI/CD health analysis, AI-assisted tooling, infrastructure-as-code, and a full test pyramid.

Built by a senior test automation engineer to demonstrate hands-on depth across Python, JavaScript, AWS, Terraform, GitHub Actions, pytest, Jest, and Playwright.

---

## What's Inside

```
portfolio/
│
├── ai-test-toolkit/        AI-powered QA toolkit (React + Claude API)
│   ├── src/                React app — 3 AI modules
│   └── tests/              Jest unit + integration, Playwright E2E
│
├── sut/                    System Under Test — Python automation platform
│   ├── scripts/            Core automation scripts
│   │   ├── triage.py       Incident classifier & recurrence detector
│   │   ├── recurring.py    Recurring pattern analyser
│   │   └── ci_health.py    CI/CD pipeline health analyser
│   └── api/
│       └── app.py          Flask REST API exposing the scripts
│
├── tests/                  Full pytest suite targeting the SUT
│   ├── unit/               Script logic in isolation
│   ├── integration/        API endpoints via Flask test client
│   └── e2e/                Full HTTP flows against running server
│
├── terraform/              AWS infrastructure as code
│   ├── main.tf             ECS Fargate, ALB, VPC, ECR, CloudWatch
│   └── variables.tf
│
└── .github/
    └── workflows/
        └── ci.yml          Unified CI pipeline (Python + Node tracks)
```

---

## Skills Demonstrated

| Skill | Where |
|---|---|
| Python scripting | `sut/scripts/` |
| REST API design | `sut/api/app.py` |
| pytest (unit, integration, E2E) | `tests/` |
| React + modern JS | `ai-test-toolkit/src/` |
| Jest + Testing Library | `ai-test-toolkit/tests/unit/`, `tests/integration/` |
| Playwright E2E | `ai-test-toolkit/tests/e2e/`, `tests/e2e/` |
| AI-assisted tooling | `ai-test-toolkit/` — Claude API integration |
| GitHub Actions CI/CD | `.github/workflows/ci.yml` |
| AWS + Terraform (IaC) | `terraform/` |
| Incident triage automation | `sut/scripts/triage.py` |
| Recurring pattern detection | `sut/scripts/recurring.py` |
| CI health analysis | `sut/scripts/ci_health.py` |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- pip, npm

---

### 1. Automation Platform (Python)

```bash
# Install dependencies
pip install -r sut/requirements.txt
pip install -r tests/requirements.txt

# Start the API
cd sut/api && python app.py
# → http://localhost:5000

# In a new terminal — run the tests
pytest tests/unit/ -v               # unit tests (no server needed)
pytest tests/integration/ -v        # integration tests (no server needed)
pytest tests/e2e/ -v                # E2E tests (server auto-starts)

# Or run everything
pytest tests/ -v
```

---

### 2. AI Test Toolkit (Node.js / React)

```bash
cd ai-test-toolkit

# Install dependencies
npm install

# Start the dev server
npm run dev
# → http://localhost:3000

# Run tests
npm run test:unit           # Jest unit tests
npm run test:integration    # Jest integration tests
npm run test:e2e            # Playwright E2E (starts server automatically)

# Or run all at once
npm run test:all
```

---

### 3. Terraform (AWS Infrastructure)

```bash
cd terraform

# Initialise
terraform init

# Preview changes
terraform plan -var="environment=dev"

# Apply
terraform apply -var="environment=dev"
```

> See [`terraform/README.md`](terraform/README.md) for full setup including AWS credentials.

---

## CI/CD Pipeline

Every push to `main` or `develop` triggers the GitHub Actions pipeline:

```
Python track:   lint → unit → integration → e2e
Node track:     lint → unit → integration → e2e (Playwright)
                              ↓
                         Summary gate
```

Both tracks run in parallel. The summary job only passes when both tracks pass.

View the pipeline: `.github/workflows/ci.yml`

---

## Module READMEs

Each subdirectory has a detailed README:

| README | Covers |
|---|---|
| [`sut/README.md`](sut/README.md) | API endpoints, curl examples, script internals |
| [`tests/README.md`](tests/README.md) | Running tests, writing new tests, fixtures |
| [`ai-test-toolkit/README.md`](ai-test-toolkit/README.md) | React app setup, standalone API key config |
| [`terraform/README.md`](terraform/README.md) | AWS setup, deploy commands, remote state |

---

## Pushing to GitHub

```bash
git init
git add .
git commit -m "feat: automation engineer portfolio — initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/automation-portfolio.git
git push -u origin main
```

GitHub Actions will automatically pick up `.github/workflows/ci.yml` and run the full pipeline on your first push.
