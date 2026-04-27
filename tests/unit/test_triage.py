"""
test_triage.py — Unit tests for triage.py
==========================================
What we're testing:
    The core triage logic in isolation — no Flask, no HTTP, no external deps.
    Just the Python functions themselves.

Testing approach:
    - classify_incident: does each rule match the right inputs?
    - generate_incident_fingerprint: is deduplication stable and correct?
    - triage_incident: does the full pipeline compose correctly?
    - format_triage_report: does the formatter produce expected output?

pytest concepts used here:
    - @pytest.mark.parametrize  — run one test with many input variations
    - pytest.raises             — assert that exceptions are raised correctly
    - plain assert statements   — pytest rewrites these to give rich diffs
"""

import pytest
from triage import (
    classify_incident,
    generate_incident_fingerprint,
    triage_incident,
    format_triage_report,
    Severity,
    Category,
)


# ─── classify_incident ────────────────────────────────────────────────────────

class TestClassifyIncident:

    def test_raises_on_empty_title(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            classify_incident("")

    def test_raises_on_whitespace_title(self):
        with pytest.raises(ValueError, match="cannot be empty"):
            classify_incident("   ")

    @pytest.mark.parametrize("title,expected_severity,expected_category", [
        # Critical patterns
        ("Production is down",           Severity.CRITICAL, Category.NETWORK),
        ("prod outage detected",         Severity.CRITICAL, Category.NETWORK),
        ("database error in prod",       Severity.CRITICAL, Category.DATABASE),
        ("postgres connection failed",   Severity.CRITICAL, Category.DATABASE),
        # High severity
        ("memory OOM in api pod",        Severity.HIGH,     Category.PERFORMANCE),
        ("out of memory error",          Severity.HIGH,     Category.PERFORMANCE),
        ("deployment failed",            Severity.HIGH,     Category.DEPLOYMENT),
        ("release rollback required",    Severity.HIGH,     Category.DEPLOYMENT),
        ("401 unauthorized on API",      Severity.HIGH,     Category.AUTH),
        ("disk volume 95% full",         Severity.HIGH,     Category.STORAGE),
        # Medium severity
        ("slow response times",          Severity.MEDIUM,   Category.PERFORMANCE),
        ("request timeout",              Severity.MEDIUM,   Category.PERFORMANCE),
        ("SSL certificate expiring",     Severity.MEDIUM,   Category.NETWORK),
        # Low severity
        ("deprecation warning in logs",  Severity.LOW,      Category.UNKNOWN),
        # No match
        ("something totally random",     Severity.UNKNOWN,  Category.UNKNOWN),
    ])
    def test_classification_rules(self, title, expected_severity, expected_category):
        result = classify_incident(title)
        assert result["severity"] == expected_severity, (
            f"Expected severity {expected_severity} for '{title}', got {result['severity']}"
        )
        assert result["category"] == expected_category

    def test_description_extends_matching(self):
        """Title alone doesn't match, but description pushes it over."""
        result = classify_incident(
            title="Something is wrong",
            description="production service unavailable"
        )
        assert result["severity"] == Severity.CRITICAL

    def test_unknown_incident_has_no_matched_pattern(self):
        result = classify_incident("Some completely unrelated thing")
        assert result["matched_pattern"] is None
        assert result["confidence"] == "no_match"

    def test_known_incident_has_matched_pattern(self):
        result = classify_incident("Production database error")
        assert result["matched_pattern"] is not None
        assert result["confidence"] == "rule_match"

    def test_matching_is_case_insensitive(self):
        lower = classify_incident("production database error")
        upper = classify_incident("PRODUCTION DATABASE ERROR")
        assert lower["severity"] == upper["severity"]
        assert lower["category"] == upper["category"]


# ─── generate_incident_fingerprint ────────────────────────────────────────────

class TestGenerateIncidentFingerprint:

    def test_same_title_same_category_produces_same_fingerprint(self):
        fp1 = generate_incident_fingerprint("DB error", "database")
        fp2 = generate_incident_fingerprint("DB error", "database")
        assert fp1 == fp2

    def test_different_title_produces_different_fingerprint(self):
        fp1 = generate_incident_fingerprint("DB error", "database")
        fp2 = generate_incident_fingerprint("Network timeout", "network")
        assert fp1 != fp2

    def test_timestamps_stripped_for_deduplication(self):
        """
        "DB error at 14:32" and "DB error at 15:01" should share a fingerprint
        because the numbers are stripped during normalisation.
        """
        fp1 = generate_incident_fingerprint("DB error at 14:32", "database")
        fp2 = generate_incident_fingerprint("DB error at 15:01", "database")
        assert fp1 == fp2

    def test_fingerprint_is_12_chars(self):
        fp = generate_incident_fingerprint("anything", "network")
        assert len(fp) == 12

    def test_fingerprint_is_hex(self):
        fp = generate_incident_fingerprint("anything", "network")
        int(fp, 16)  # raises ValueError if not valid hex

    def test_different_category_different_fingerprint(self):
        fp1 = generate_incident_fingerprint("error occurred", "database")
        fp2 = generate_incident_fingerprint("error occurred", "network")
        assert fp1 != fp2


# ─── triage_incident ──────────────────────────────────────────────────────────

class TestTriageIncident:

    def test_returns_required_fields(self):
        result = triage_incident("Production database down")
        assert "timestamp" in result
        assert "title" in result
        assert "fingerprint" in result
        assert "is_recurring" in result
        assert "severity" in result
        assert "category" in result
        assert "suggested_action" in result

    def test_not_recurring_when_history_is_empty(self):
        result = triage_incident("DB error", history=[])
        assert result["is_recurring"] is False
        assert result["recurrence_count"] == 0

    def test_is_recurring_when_fingerprint_in_history(self):
        first = triage_incident("DB error")
        fp = first["fingerprint"]
        second = triage_incident("DB error", history=[fp])
        assert second["is_recurring"] is True
        assert second["recurrence_count"] == 1

    def test_recurrence_count_reflects_history_frequency(self):
        first = triage_incident("DB error")
        fp = first["fingerprint"]
        result = triage_incident("DB error", history=[fp, fp, fp])
        assert result["recurrence_count"] == 3

    def test_recurring_action_mentions_automation(self):
        first = triage_incident("DB error")
        fp = first["fingerprint"]
        result = triage_incident("DB error", history=[fp])
        assert "automation" in result["suggested_action"].lower()

    def test_recurring_action_mentions_recurrence_count(self):
        first = triage_incident("DB error")
        fp = first["fingerprint"]
        result = triage_incident("DB error", history=[fp, fp])
        assert "2" in result["suggested_action"]

    def test_default_history_is_empty(self):
        # Calling without history should not raise
        result = triage_incident("Some issue")
        assert result["is_recurring"] is False


# ─── format_triage_report ─────────────────────────────────────────────────────

class TestFormatTriageReport:

    def test_report_contains_title(self):
        result = triage_incident("Production database down")
        report = format_triage_report(result)
        assert "Production database down" in report

    def test_report_contains_severity(self):
        result = triage_incident("Production database down")
        report = format_triage_report(result)
        assert "CRITICAL" in report

    def test_report_contains_recurring_marker(self):
        first = triage_incident("DB error")
        fp = first["fingerprint"]
        result = triage_incident("DB error", history=[fp])
        report = format_triage_report(result)
        assert "YES" in report

    def test_report_is_string(self):
        result = triage_incident("Some issue")
        assert isinstance(format_triage_report(result), str)
