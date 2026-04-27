"""
test_api.py — Integration tests for the Flask REST API
=======================================================
What we're testing:
    The HTTP layer — do the endpoints accept the right inputs,
    return the right status codes, and produce the right response shapes?

    These are integration tests because they test multiple layers at once:
    Flask routing → request parsing → script logic → JSON serialisation.

    We use Flask's built-in test client (from conftest.py) which makes
    real HTTP-like requests without needing a running server.

pytest concepts used here:
    - flask_test_client fixture (from conftest.py)
    - JSON request/response assertions
    - Status code validation
    - Response schema checks
"""

import json
import pytest


class TestHealthEndpoint:

    def test_returns_200(self, flask_test_client):
        response = flask_test_client.get("/api/health")
        assert response.status_code == 200

    def test_returns_ok_status(self, flask_test_client):
        data = response = flask_test_client.get("/api/health").get_json()
        assert data["status"] == "ok"

    def test_returns_service_name(self, flask_test_client):
        data = flask_test_client.get("/api/health").get_json()
        assert "service" in data


class TestTriageEndpoint:

    def test_valid_request_returns_200(self, flask_test_client):
        response = flask_test_client.post(
            "/api/triage",
            json={"title": "Production database down"}
        )
        assert response.status_code == 200

    def test_returns_severity(self, flask_test_client):
        data = flask_test_client.post(
            "/api/triage",
            json={"title": "Production database down"}
        ).get_json()
        assert "severity" in data

    def test_returns_fingerprint(self, flask_test_client):
        data = flask_test_client.post(
            "/api/triage",
            json={"title": "Production database down"}
        ).get_json()
        assert "fingerprint" in data
        assert len(data["fingerprint"]) == 12

    def test_missing_title_returns_400(self, flask_test_client):
        response = flask_test_client.post("/api/triage", json={"description": "no title"})
        assert response.status_code == 400

    def test_empty_title_returns_400(self, flask_test_client):
        response = flask_test_client.post("/api/triage", json={"title": ""})
        assert response.status_code == 400

    def test_whitespace_title_returns_400(self, flask_test_client):
        response = flask_test_client.post("/api/triage", json={"title": "   "})
        assert response.status_code == 400

    def test_non_json_body_returns_400(self, flask_test_client):
        response = flask_test_client.post(
            "/api/triage",
            data="not json",
            content_type="text/plain"
        )
        assert response.status_code == 400

    def test_invalid_history_type_returns_400(self, flask_test_client):
        response = flask_test_client.post(
            "/api/triage",
            json={"title": "DB error", "history": "not-a-list"}
        )
        assert response.status_code == 400

    def test_critical_incident_classified_correctly(self, flask_test_client):
        data = flask_test_client.post(
            "/api/triage",
            json={"title": "Production is down and unavailable"}
        ).get_json()
        assert data["severity"] == "critical"

    def test_recurring_detection_via_history(self, flask_test_client):
        # First call to get fingerprint
        first = flask_test_client.post(
            "/api/triage",
            json={"title": "Database connection error"}
        ).get_json()
        fp = first["fingerprint"]

        # Second call with fingerprint in history
        second = flask_test_client.post(
            "/api/triage",
            json={"title": "Database connection error", "history": [fp]}
        ).get_json()

        assert second["is_recurring"] is True
        assert second["recurrence_count"] == 1

    def test_response_contains_all_required_fields(self, flask_test_client):
        data = flask_test_client.post(
            "/api/triage",
            json={"title": "Some incident"}
        ).get_json()
        required = {"timestamp", "title", "fingerprint", "is_recurring",
                    "recurrence_count", "severity", "category", "suggested_action"}
        assert required.issubset(data.keys())


class TestRecurringEndpoint:

    def test_valid_request_returns_200(self, flask_test_client, sample_incidents):
        response = flask_test_client.post(
            "/api/recurring",
            json={"incidents": sample_incidents}
        )
        assert response.status_code == 200

    def test_returns_total_count(self, flask_test_client, sample_incidents):
        data = flask_test_client.post(
            "/api/recurring",
            json={"incidents": sample_incidents}
        ).get_json()
        assert data["total"] == len(sample_incidents)

    def test_returns_recurring_patterns(self, flask_test_client, sample_incidents):
        data = flask_test_client.post(
            "/api/recurring",
            json={"incidents": sample_incidents}
        ).get_json()
        assert "recurring_patterns" in data
        assert isinstance(data["recurring_patterns"], list)

    def test_returns_automation_candidates(self, flask_test_client, sample_incidents):
        data = flask_test_client.post(
            "/api/recurring",
            json={"incidents": sample_incidents}
        ).get_json()
        assert "automation_candidates" in data

    def test_missing_incidents_field_returns_400(self, flask_test_client):
        response = flask_test_client.post("/api/recurring", json={"wrong": "field"})
        assert response.status_code == 400

    def test_incidents_not_list_returns_400(self, flask_test_client):
        response = flask_test_client.post(
            "/api/recurring",
            json={"incidents": "not a list"}
        )
        assert response.status_code == 400

    def test_empty_incidents_returns_200_with_zero_total(self, flask_test_client):
        data = flask_test_client.post(
            "/api/recurring",
            json={"incidents": []}
        ).get_json()
        assert data["total"] == 0

    def test_non_json_returns_400(self, flask_test_client):
        response = flask_test_client.post(
            "/api/recurring",
            data="plain text",
            content_type="text/plain"
        )
        assert response.status_code == 400


class TestCIHealthEndpoint:

    def test_valid_request_returns_200(self, flask_test_client, sample_ci_runs):
        response = flask_test_client.post(
            "/api/ci-health",
            json={"runs": sample_ci_runs}
        )
        assert response.status_code == 200

    def test_returns_total_runs(self, flask_test_client, sample_ci_runs):
        data = flask_test_client.post(
            "/api/ci-health",
            json={"runs": sample_ci_runs}
        ).get_json()
        assert data["total_runs"] == len(sample_ci_runs)

    def test_returns_overall_success_rate(self, flask_test_client, sample_ci_runs):
        data = flask_test_client.post(
            "/api/ci-health",
            json={"runs": sample_ci_runs}
        ).get_json()
        assert "overall_success_rate" in data
        assert 0.0 <= data["overall_success_rate"] <= 1.0

    def test_returns_recommendations(self, flask_test_client, sample_ci_runs):
        data = flask_test_client.post(
            "/api/ci-health",
            json={"runs": sample_ci_runs}
        ).get_json()
        assert "recommendations" in data
        assert len(data["recommendations"]) > 0

    def test_missing_runs_field_returns_400(self, flask_test_client):
        response = flask_test_client.post("/api/ci-health", json={"wrong": "field"})
        assert response.status_code == 400

    def test_runs_not_list_returns_400(self, flask_test_client):
        response = flask_test_client.post(
            "/api/ci-health",
            json={"runs": "not a list"}
        )
        assert response.status_code == 400

    def test_empty_runs_returns_200(self, flask_test_client):
        data = flask_test_client.post(
            "/api/ci-health",
            json={"runs": []}
        ).get_json()
        assert data["total_runs"] == 0

    def test_flaky_workflows_detected(self, flask_test_client):
        runs = [
            {"workflow": "flaky", "status": "success", "duration_seconds": 100},
            {"workflow": "flaky", "status": "success", "duration_seconds": 100},
            {"workflow": "flaky", "status": "success", "duration_seconds": 100},
            {"workflow": "flaky", "status": "failure", "duration_seconds": 100},
            {"workflow": "flaky", "status": "failure", "duration_seconds": 100},
        ]
        data = flask_test_client.post(
            "/api/ci-health",
            json={"runs": runs}
        ).get_json()
        assert "flaky" in data["flaky_workflows"]


class TestRulesEndpoint:

    def test_returns_200(self, flask_test_client):
        response = flask_test_client.get("/api/rules")
        assert response.status_code == 200

    def test_returns_rules_list(self, flask_test_client):
        data = flask_test_client.get("/api/rules").get_json()
        assert "rules" in data
        assert isinstance(data["rules"], list)

    def test_rules_count_matches(self, flask_test_client):
        data = flask_test_client.get("/api/rules").get_json()
        assert data["count"] == len(data["rules"])

    def test_each_rule_has_required_fields(self, flask_test_client):
        data = flask_test_client.get("/api/rules").get_json()
        required = {"index", "pattern", "severity", "category", "action"}
        for rule in data["rules"]:
            assert required.issubset(rule.keys())
