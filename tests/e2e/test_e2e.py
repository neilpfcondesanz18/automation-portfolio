"""
test_e2e.py — End-to-End tests using Playwright
=================================================
What we're testing:
    Full workflow scenarios against a RUNNING instance of the API.
    These tests hit real HTTP endpoints — no mocking.

    E2E tests simulate what an actual client (another service, a webhook
    handler, a CI script) would do when calling this automation platform.

Prerequisites:
    The API server must be running before these tests execute.
    Start it with:  python sut/api/app.py
    Or via pytest:  the conftest below can auto-start it.

    pytest-playwright must be installed:
        pip install playwright pytest-playwright
        playwright install chromium

How these differ from integration tests:
    Integration tests use Flask's test client (no real network).
    E2E tests use real HTTP requests to a real running server.
    They catch issues that only appear at the network/serialisation boundary.

Job post mapping:
    "Experience operating production systems"
    "Automate repetitive build, test, release, and operational tasks"
"""

import pytest
import requests
import subprocess
import time
import signal
import os
import sys

# Base URL of the running API
BASE_URL = os.environ.get("API_BASE_URL", "http://localhost:5000")

# How long to wait for the server to start (seconds)
SERVER_STARTUP_TIMEOUT = 10


# ─── Server lifecycle fixture ─────────────────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def api_server():
    """
    Session-scoped fixture that starts the Flask API before any E2E test
    and shuts it down after all tests complete.

    'scope=session' means it runs once for the entire test session,
    not once per test — much faster.

    If API_BASE_URL is set externally (e.g. in CI pointing at a deployed env),
    we skip starting a local server.
    """
    external_url = os.environ.get("API_BASE_URL")
    if external_url and external_url != "http://localhost:5000":
        # Already pointing at an external server — don't start locally
        yield
        return

    # Start the local Flask server
    script_dir = os.path.join(os.path.dirname(__file__), "..", "..", "sut", "api")
    server = subprocess.Popen(
        [sys.executable, "app.py"],
        cwd=script_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait for it to be ready
    deadline = time.time() + SERVER_STARTUP_TIMEOUT
    while time.time() < deadline:
        try:
            requests.get(f"{BASE_URL}/api/health", timeout=1)
            break
        except Exception:
            time.sleep(0.3)
    else:
        server.kill()
        pytest.fail(f"API server did not start within {SERVER_STARTUP_TIMEOUT}s")

    yield server

    # Teardown: kill the server
    server.send_signal(signal.SIGTERM)
    server.wait(timeout=5)


# ─── Helper ───────────────────────────────────────────────────────────────────

def post(path: str, payload: dict) -> requests.Response:
    return requests.post(f"{BASE_URL}{path}", json=payload, timeout=10)


def get(path: str) -> requests.Response:
    return requests.get(f"{BASE_URL}{path}", timeout=10)


# ─── Health check ─────────────────────────────────────────────────────────────

class TestE2EHealth:

    def test_health_endpoint_is_reachable(self):
        response = get("/api/health")
        assert response.status_code == 200

    def test_health_returns_json(self):
        response = get("/api/health")
        data = response.json()
        assert data["status"] == "ok"


# ─── Full triage workflow ─────────────────────────────────────────────────────

class TestE2ETriageWorkflow:

    def test_triage_critical_incident_end_to_end(self):
        """
        Full workflow: POST an incident → receive classified triage result.
        Simulates a webhook from PagerDuty or Jira hitting this endpoint.
        """
        response = post("/api/triage", {
            "title": "Production database connection error",
            "description": "Connection pool exhausted, all requests timing out"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["severity"] == "critical"
        assert data["category"] == "database"
        assert "fingerprint" in data
        assert data["is_recurring"] is False

    def test_triage_recurring_incident_workflow(self):
        """
        Simulate an incident occurring multiple times.
        Step 1: triage first occurrence → get fingerprint
        Step 2: triage again with fingerprint in history → marked as recurring
        """
        # First occurrence
        first = post("/api/triage", {
            "title": "High memory usage alert",
            "description": "API pod heap exceeded 90%"
        }).json()

        fp = first["fingerprint"]
        assert first["is_recurring"] is False

        # Second occurrence
        second = post("/api/triage", {
            "title": "High memory usage alert",
            "description": "API pod heap exceeded 90%",
            "history": [fp]
        }).json()

        assert second["is_recurring"] is True
        assert second["recurrence_count"] == 1
        assert "automation" in second["suggested_action"].lower()

        # Third occurrence — action should recommend automation more strongly
        third = post("/api/triage", {
            "title": "High memory usage alert",
            "history": [fp, fp]
        }).json()
        assert third["recurrence_count"] == 2

    def test_triage_unknown_incident_still_responds(self):
        """
        An incident that matches no rule should still return a valid response,
        just with severity=unknown and a manual review action.
        """
        response = post("/api/triage", {"title": "Some obscure thing happened"})
        assert response.status_code == 200
        data = response.json()
        assert data["severity"] == "unknown"
        assert "manual" in data["suggested_action"].lower()

    def test_triage_invalid_request_returns_error(self):
        response = post("/api/triage", {"description": "No title provided"})
        assert response.status_code == 400
        assert "error" in response.json()


# ─── Recurring pattern detection workflow ─────────────────────────────────────

class TestE2ERecurringWorkflow:

    def test_batch_analysis_identifies_automation_candidates(self):
        """
        Simulate a week's worth of incidents being analysed for patterns.
        Verifies that repeated database issues are flagged for automation.
        """
        incidents = [
            {"title": "Production database connection error"},
            {"title": "DB connection pool exhausted"},
            {"title": "Postgres timeout in checkout service"},
            {"title": "Database failover triggered"},
            {"title": "Deployment failed on staging"},
            {"title": "SSL certificate expiring in 7 days"},
        ]
        response = post("/api/recurring", {"incidents": incidents})
        assert response.status_code == 200
        data = response.json()

        assert data["total"] == len(incidents)
        assert "recurring_patterns" in data
        assert "automation_candidates" in data
        assert "category_breakdown" in data

    def test_batch_with_high_recurrence_produces_candidates(self):
        """5 identical incidents should definitely produce automation candidates."""
        incidents = [{"title": "High memory usage alert"}] * 5
        data = post("/api/recurring", {"incidents": incidents}).json()
        assert len(data["automation_candidates"]) >= 1
        assert data["automation_candidates"][0]["count"] == 5

    def test_empty_batch_returns_valid_response(self):
        data = post("/api/recurring", {"incidents": []}).json()
        assert data["total"] == 0
        assert data["automation_candidates"] == []


# ─── CI health workflow ────────────────────────────────────────────────────────

class TestE2ECIHealthWorkflow:

    def test_ci_health_detects_flaky_pipeline(self):
        """
        Simulate a flaky test suite: 40% failure rate.
        Verify the API flags it and provides recommendations.
        """
        runs = [
            {"workflow": "integration-tests", "status": "success", "duration_seconds": 180},
            {"workflow": "integration-tests", "status": "success", "duration_seconds": 175},
            {"workflow": "integration-tests", "status": "success", "duration_seconds": 185},
            {"workflow": "integration-tests", "status": "failure", "duration_seconds": 170},
            {"workflow": "integration-tests", "status": "failure", "duration_seconds": 190},
        ]
        data = post("/api/ci-health", {"runs": runs}).json()
        assert "integration-tests" in data["flaky_workflows"]
        assert any("flaky" in rec.lower() for rec in data["recommendations"])

    def test_ci_health_detects_slow_pipeline(self):
        """Average > 10 minutes should be flagged as slow."""
        runs = [
            {"workflow": "e2e-suite", "status": "success", "duration_seconds": 720},
            {"workflow": "e2e-suite", "status": "success", "duration_seconds": 750},
            {"workflow": "e2e-suite", "status": "success", "duration_seconds": 700},
        ]
        data = post("/api/ci-health", {"runs": runs}).json()
        assert "e2e-suite" in data["slow_workflows"]
        assert any("parallel" in rec.lower() or "cach" in rec.lower()
                   for rec in data["recommendations"])

    def test_healthy_pipeline_produces_no_alerts(self):
        """All successes, fast runs → no flaky or slow flags."""
        runs = [
            {"workflow": "unit-tests", "status": "success", "duration_seconds": 90},
            {"workflow": "unit-tests", "status": "success", "duration_seconds": 85},
            {"workflow": "unit-tests", "status": "success", "duration_seconds": 95},
        ]
        data = post("/api/ci-health", {"runs": runs}).json()
        assert data["flaky_workflows"] == []
        assert data["slow_workflows"] == []

    def test_overall_success_rate_accuracy(self):
        """7 successes out of 10 runs = 70% success rate."""
        runs = (
            [{"workflow": "tests", "status": "success", "duration_seconds": 100}] * 7
            + [{"workflow": "tests", "status": "failure", "duration_seconds": 100}] * 3
        )
        data = post("/api/ci-health", {"runs": runs}).json()
        assert abs(data["overall_success_rate"] - 0.7) < 0.01


# ─── Rules endpoint ────────────────────────────────────────────────────────────

class TestE2ERulesEndpoint:

    def test_rules_endpoint_returns_all_rules(self):
        data = get("/api/rules").json()
        assert data["count"] > 0
        assert len(data["rules"]) == data["count"]

    def test_rules_include_critical_database_rule(self):
        data = get("/api/rules").json()
        critical_rules = [r for r in data["rules"] if r["severity"] == "critical"]
        assert len(critical_rules) >= 1

    def test_each_rule_has_action(self):
        data = get("/api/rules").json()
        for rule in data["rules"]:
            assert rule["action"], f"Rule {rule['index']} has no action"
