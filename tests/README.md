# Test Suite

This directory contains all tests that target the automation platform (SUT).

---

## Test Pyramid

```
        /\
       /E2E\          ← Fewest tests, slowest, most realistic
      /------\
     /Integra-\       ← API endpoint tests via Flask test client
    /tion tests\
   /------------\
  / Unit  tests  \    ← Most tests, fastest, most isolated
 /________________\
```

**Rule of thumb:** Most tests should be unit tests. Integration tests cover the "glue" between layers. E2E tests cover the most important user flows only.

---

## Setup

```bash
pip install -r tests/requirements.txt
```

---

## Running Tests

### Unit tests — test script logic in isolation, no server needed

```bash
pytest tests/unit/ -v
```

What's tested:
- `test_triage.py` — incident classification rules, fingerprinting, recurrence detection
- `test_recurring.py` — pattern detection, automation priority scoring
- `test_ci_health.py` — flaky/slow detection, success rate calculation

### Integration tests — test the API layer, no server needed

Uses Flask's built-in test client — no real HTTP, no port binding, fast.

```bash
pytest tests/integration/ -v
```

What's tested:
- All API endpoints (`/api/triage`, `/api/recurring`, `/api/ci-health`, `/api/rules`, `/api/health`)
- Request validation (missing fields, wrong types, empty bodies)
- Response shapes and status codes

### E2E tests — test full HTTP flows against a real running server

The server is **auto-started** by the `conftest.py` session fixture. You don't need to start it manually.

```bash
pytest tests/e2e/ -v
```

What's tested:
- Real HTTP requests to real endpoints
- Full workflow scenarios (triage → recurrence → automation recommendation)
- Realistic payloads that simulate external callers (webhooks, CI jobs)

### Run everything

```bash
pytest tests/ -v
```

### Run with coverage

```bash
pytest tests/unit/ tests/integration/ \
  --cov=sut \
  --cov-report=term-missing \
  --cov-report=html
# → open htmlcov/index.html in browser
```

### Run a single test file

```bash
pytest tests/unit/test_triage.py -v
```

### Run a single test by name

```bash
pytest tests/unit/test_triage.py::TestClassifyIncident::test_matching_is_case_insensitive -v
```

### Run tests matching a keyword

```bash
pytest tests/ -k "recurring" -v
```

---

## Test Configuration

### `conftest.py`

Shared fixtures available to all test files:

| Fixture | Scope | What it provides |
|---|---|---|
| `sample_incidents` | function | A list of 9 mixed incidents for recurring tests |
| `sample_ci_runs` | function | 12 CI runs covering flaky and slow workflows |
| `flask_test_client` | function | Flask test client — pre-configured for integration tests |

### Using fixtures in your tests

```python
def test_my_new_test(sample_incidents, flask_test_client):
    # sample_incidents is already populated
    # flask_test_client is ready to make requests
    response = flask_test_client.post("/api/recurring", json={"incidents": sample_incidents})
    assert response.status_code == 200
```

---

## Writing New Tests

### Adding a unit test

1. Open the relevant file in `tests/unit/`
2. Add a new method to the relevant class (or a new class)
3. Use plain `assert` statements — pytest gives rich diffs on failure

```python
def test_my_new_case(self):
    result = classify_incident("some new pattern")
    assert result["severity"] == Severity.HIGH
```

### Adding a parametrized test

Use `@pytest.mark.parametrize` to run one test with many inputs — avoids repetition:

```python
@pytest.mark.parametrize("title,expected", [
    ("DB error", Severity.CRITICAL),
    ("memory OOM", Severity.HIGH),
    ("unknown thing", Severity.UNKNOWN),
])
def test_classification(self, title, expected):
    result = classify_incident(title)
    assert result["severity"] == expected
```

### Adding an integration test

```python
def test_my_endpoint(self, flask_test_client):
    response = flask_test_client.post("/api/triage", json={"title": "DB error"})
    assert response.status_code == 200
    assert response.get_json()["severity"] == "critical"
```

### Adding an E2E test

```python
def test_my_workflow(self):
    response = requests.post(f"{BASE_URL}/api/triage", json={"title": "DB error"})
    assert response.status_code == 200
```

---

## Understanding Test Output

```
PASSED tests/unit/test_triage.py::TestClassifyIncident::test_raises_on_empty_title
FAILED tests/unit/test_triage.py::TestClassifyIncident::test_classification_rules[DB error-critical-database]

FAILED tests/unit/test_triage.py::TestClassifyIncident::test_classification_rules
AssertionError: Expected severity critical for 'DB error', got unknown
```

- `PASSED` — test passed ✓
- `FAILED` — test failed, pytest shows you exactly what was expected vs what was received
- `ERROR` — test couldn't run (e.g. import error, fixture failure)

---

## CI Integration

Tests run automatically on every push via GitHub Actions:

```yaml
# .github/workflows/ci.yml
lint → unit-tests → integration-tests → e2e-tests
```

Each job must pass before the next runs. Coverage is enforced at 80% minimum.

To simulate CI locally:
```bash
pytest tests/unit/ --cov=sut/scripts --cov-fail-under=80
pytest tests/integration/ --cov=sut/api --cov-fail-under=80
pytest tests/e2e/
```
