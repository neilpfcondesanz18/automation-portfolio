# System Under Test (SUT)

This directory contains the **automation platform** — the actual system your tests are written against.

It's made up of two parts:
1. **Python scripts** — the core automation logic
2. **Flask API** — an HTTP wrapper around those scripts

---

## The Scripts

### `scripts/triage.py` — Incident Triage Engine

**What it does:** Classifies an incoming incident by severity and category, suggests a remediation action, and detects if the same incident has happened before (recurrence detection).

**Why it matters:** On-call engineers get paged at 3am. This script does the first-pass classification automatically so they know immediately whether to wake up the whole team or just queue it for morning.

**Run it directly:**
```bash
cd sut/scripts
python triage.py "Production database connection error"
```

**Key functions:**
| Function | What it does |
|---|---|
| `classify_incident(title, description)` | Match title/description against triage rules → returns severity + category |
| `generate_incident_fingerprint(title, category)` | Create a stable hash for deduplication |
| `triage_incident(title, description, history)` | Full pipeline — classify + fingerprint + recurrence check |
| `format_triage_report(result)` | Human-readable report string |

---

### `scripts/recurring.py` — Pattern Detector

**What it does:** Takes a batch of incidents and identifies which patterns recur frequently enough to warrant building an automation. Outputs "automation candidates" with a priority score.

**Why it matters:** The job says "design durable automations for issues that occur more than once." You can't do that without first knowing which issues actually recur.

**Run it directly:**
```bash
cd sut/scripts
python recurring.py
```

**Key functions:**
| Function | What it does |
|---|---|
| `analyse_incidents(incidents)` | Cluster incidents by fingerprint, count occurrences, flag candidates |
| `_automation_priority(count, severity)` | Score priority: immediate / high / medium / low |
| `format_analysis_report(analysis)` | Human-readable analysis report |

---

### `scripts/ci_health.py` — CI Pipeline Health Analyser

**What it does:** Analyses CI/CD run data to detect flaky tests (inconsistent pass/fail), slow pipelines (avg > 10 minutes), and generates recommendations.

**Why it matters:** The job explicitly requires improving CI/CD pipelines. This is the measurement layer — you can't improve what you don't measure.

**Run it directly:**
```bash
cd sut/scripts
python ci_health.py
```

**Key functions:**
| Function | What it does |
|---|---|
| `analyse_pipeline_health(runs)` | Compute success rates, detect flaky/slow workflows, generate recommendations |
| `_compute_workflow_stats(workflow, runs)` | Per-workflow statistics (failure rate, avg duration, stdev) |
| `format_health_report(health)` | Human-readable health report |

---

## The API

### `api/app.py` — Flask REST API

Wraps all three scripts behind HTTP endpoints so they can be triggered by external systems (webhooks from PagerDuty, Jira, GitHub Actions, etc.).

### Setup

```bash
pip install -r sut/requirements.txt
cd sut/api
python app.py
# → http://localhost:5000
```

### Endpoints

#### `GET /api/health`
Liveness check. Returns `{"status": "ok"}`.

```bash
curl http://localhost:5000/api/health
```

---

#### `POST /api/triage`
Triage a single incident.

```bash
curl -X POST http://localhost:5000/api/triage \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Production database connection error",
    "description": "Connection pool exhausted",
    "history": []
  }'
```

**Request fields:**
| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | Yes | Incident title |
| `description` | string | No | Stack trace or extra detail |
| `history` | list[string] | No | Previously seen fingerprints |

**Response:**
```json
{
  "timestamp": "2026-04-26T10:00:00Z",
  "title": "Production database connection error",
  "fingerprint": "a1b2c3d4e5f6",
  "is_recurring": false,
  "recurrence_count": 0,
  "severity": "critical",
  "category": "database",
  "suggested_action": "Check DB connection pool...",
  "confidence": "rule_match"
}
```

---

#### `POST /api/recurring`
Analyse a batch of incidents for recurring patterns.

```bash
curl -X POST http://localhost:5000/api/recurring \
  -H "Content-Type: application/json" \
  -d '{
    "incidents": [
      {"title": "DB error", "description": ""},
      {"title": "DB timeout", "description": ""},
      {"title": "Postgres refused", "description": ""}
    ]
  }'
```

---

#### `POST /api/ci-health`
Analyse CI/CD pipeline run data.

```bash
curl -X POST http://localhost:5000/api/ci-health \
  -H "Content-Type: application/json" \
  -d '{
    "runs": [
      {"workflow": "unit-tests", "status": "success", "duration_seconds": 120},
      {"workflow": "unit-tests", "status": "failure", "duration_seconds": 115}
    ]
  }'
```

---

#### `GET /api/rules`
List all active triage rules (for audit and documentation).

```bash
curl http://localhost:5000/api/rules
```

---

## Error Handling

All endpoints return a consistent error format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request (missing/invalid fields) |
| 500 | Unexpected server error |
