"""
app.py — REST API for the Automation Platform
==============================================
What this does:
    Wraps the automation scripts (triage.py, recurring.py, ci_health.py)
    in a Flask REST API so they can be called over HTTP.

    This is realistic — in a real platform team these scripts would be
    triggered by webhooks from PagerDuty, GitHub, Jira, etc.

Endpoints:
    POST /api/triage          — triage a single incident
    POST /api/recurring       — analyse a batch for recurring patterns
    POST /api/ci-health       — analyse CI pipeline run data
    GET  /api/health          — service health check
    GET  /api/rules           — list all triage rules

Running locally:
    pip install flask
    python app.py
    → http://localhost:5000
"""

import sys
import os

# Allow importing sibling scripts
sys.path.insert(0, os.path.dirname(__file__))

from flask import Flask, request, jsonify
from triage import triage_incident, classify_incident, TRIAGE_RULES
from recurring import analyse_incidents
from ci_health import analyse_pipeline_health

app = Flask(__name__)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health():
    """Simple liveness check. Used by CI and load balancers."""
    return jsonify({"status": "ok", "service": "automation-platform"}), 200


# ─── Triage ───────────────────────────────────────────────────────────────────

@app.route("/api/triage", methods=["POST"])
def triage():
    """
    Triage a single incident.

    Request body:
        {
            "title": "Production database down",
            "description": "Optional stack trace or details",
            "history": ["fingerprint1", "fingerprint2"]   // optional
        }

    Response:
        Full triage result including severity, category, suggested_action,
        fingerprint, and recurrence info.
    """
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Field 'title' is required and cannot be empty"}), 400

    description = data.get("description", "")
    history = data.get("history", [])

    if not isinstance(history, list):
        return jsonify({"error": "Field 'history' must be a list of fingerprint strings"}), 400

    try:
        result = triage_incident(title, description, history)
        return jsonify(result), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": "Internal triage error", "detail": str(e)}), 500


# ─── Recurring ────────────────────────────────────────────────────────────────

@app.route("/api/recurring", methods=["POST"])
def recurring():
    """
    Analyse a batch of incidents for recurring patterns.

    Request body:
        {
            "incidents": [
                { "title": "...", "description": "..." },
                ...
            ]
        }

    Response:
        Pattern analysis including automation candidates.
    """
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    incidents = data.get("incidents")

    if incidents is None:
        return jsonify({"error": "Field 'incidents' is required"}), 400

    if not isinstance(incidents, list):
        return jsonify({"error": "Field 'incidents' must be a list"}), 400

    try:
        result = analyse_incidents(incidents)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Analysis error", "detail": str(e)}), 500


# ─── CI Health ────────────────────────────────────────────────────────────────

@app.route("/api/ci-health", methods=["POST"])
def ci_health():
    """
    Analyse CI/CD pipeline run data for health issues.

    Request body:
        {
            "runs": [
                {
                    "workflow": "unit-tests",
                    "status": "success",
                    "duration_seconds": 120
                },
                ...
            ]
        }

    Response:
        Health report with flaky/slow workflow detection and recommendations.
    """
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    runs = data.get("runs")

    if runs is None:
        return jsonify({"error": "Field 'runs' is required"}), 400

    if not isinstance(runs, list):
        return jsonify({"error": "Field 'runs' must be a list"}), 400

    try:
        result = analyse_pipeline_health(runs)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": "Health analysis error", "detail": str(e)}), 500


# ─── Rules ────────────────────────────────────────────────────────────────────

@app.route("/api/rules", methods=["GET"])
def list_rules():
    """
    Return all active triage rules.
    Useful for audit, documentation, and debugging.
    """
    rules = [
        {
            "index": i,
            "pattern": pattern,
            "severity": severity,
            "category": category,
            "action": action,
        }
        for i, (pattern, severity, category, action) in enumerate(TRIAGE_RULES)
    ]
    return jsonify({"count": len(rules), "rules": rules}), 200


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
