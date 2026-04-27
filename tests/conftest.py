"""
conftest.py — Shared pytest fixtures
=====================================
What this file does:
    pytest automatically loads conftest.py before any test.
    We use it to define shared fixtures — reusable setup/teardown
    that multiple test files can use without repeating themselves.

    Think of fixtures as the pytest equivalent of beforeEach/afterEach
    in Jest, but more powerful (they have scope: function/module/session).
"""

import sys
import os
import pytest

# Add the SUT scripts directory to the path so tests can import them
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sut", "scripts"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "sut", "api"))


@pytest.fixture
def sample_incidents():
    """A reusable batch of sample incidents for recurring pattern tests."""
    return [
        {"title": "Production database connection error", "description": ""},
        {"title": "DB connection pool exhausted", "description": "postgres timeout"},
        {"title": "Postgres connection refused", "description": ""},
        {"title": "Deployment failed on staging", "description": ""},
        {"title": "Release pipeline error in GitHub Actions", "description": ""},
        {"title": "Memory OOM in api-service pod", "description": ""},
        {"title": "High memory usage alert", "description": "heap size exceeded"},
        {"title": "High memory usage alert", "description": "heap size exceeded"},
        {"title": "SSL certificate expiring soon", "description": ""},
    ]


@pytest.fixture
def sample_ci_runs():
    """Reusable CI run data covering flaky and slow workflows."""
    return [
        {"workflow": "unit-tests", "status": "success", "duration_seconds": 120},
        {"workflow": "unit-tests", "status": "success", "duration_seconds": 115},
        {"workflow": "unit-tests", "status": "failure", "duration_seconds": 118},
        {"workflow": "unit-tests", "status": "success", "duration_seconds": 122},
        {"workflow": "unit-tests", "status": "failure", "duration_seconds": 110},
        {"workflow": "e2e-tests", "status": "success", "duration_seconds": 900},
        {"workflow": "e2e-tests", "status": "success", "duration_seconds": 950},
        {"workflow": "e2e-tests", "status": "success", "duration_seconds": 870},
        {"workflow": "deploy-staging", "status": "failure", "duration_seconds": 200},
        {"workflow": "deploy-staging", "status": "success", "duration_seconds": 180},
        {"workflow": "deploy-staging", "status": "failure", "duration_seconds": 195},
        {"workflow": "deploy-staging", "status": "success", "duration_seconds": 210},
    ]


@pytest.fixture
def flask_test_client():
    """
    Provides a Flask test client for integration tests.
    This lets us make HTTP requests to the API without starting a real server.

    Scope is 'function' (default) — a fresh client per test.
    """
    from app import app
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client
