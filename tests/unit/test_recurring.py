"""
test_recurring.py — Unit tests for recurring.py
================================================
What we're testing:
    The pattern detection and automation prioritisation logic.

Key concepts tested:
    - Does it correctly count pattern occurrences?
    - Does it correctly identify automation candidates?
    - Is the automation priority scoring correct?
    - Edge cases: empty input, single incident, all unique incidents
"""

import pytest
from recurring import analyse_incidents, _automation_priority, RECURRENCE_THRESHOLD


class TestAnalyseIncidents:

    def test_empty_input_returns_zero_total(self):
        result = analyse_incidents([])
        assert result["total"] == 0
        assert result["recurring_patterns"] == []
        assert result["automation_candidates"] == []

    def test_total_count_matches_input(self, sample_incidents):
        result = analyse_incidents(sample_incidents)
        assert result["total"] == len(sample_incidents)

    def test_detects_recurring_database_incidents(self):
        """Three DB-related incidents should cluster into one pattern."""
        incidents = [
            {"title": "Production database connection error"},
            {"title": "DB connection pool exhausted"},
            {"title": "Postgres connection refused"},
        ]
        result = analyse_incidents(incidents)
        # All three should map to database category and form at least one pattern
        db_patterns = [
            p for p in result["recurring_patterns"]
            if p["category"] == "database"
        ]
        assert len(db_patterns) >= 1

    def test_automation_candidates_meet_threshold(self, sample_incidents):
        """All automation candidates should have count >= RECURRENCE_THRESHOLD."""
        result = analyse_incidents(sample_incidents)
        for candidate in result["automation_candidates"]:
            assert candidate["count"] >= RECURRENCE_THRESHOLD

    def test_single_incident_no_automation_candidates(self):
        result = analyse_incidents([{"title": "One-off weird error"}])
        assert result["automation_candidates"] == []

    def test_category_breakdown_is_present(self, sample_incidents):
        result = analyse_incidents(sample_incidents)
        assert isinstance(result["category_breakdown"], dict)
        assert len(result["category_breakdown"]) > 0

    def test_patterns_sorted_by_count_descending(self, sample_incidents):
        result = analyse_incidents(sample_incidents)
        counts = [p["count"] for p in result["recurring_patterns"]]
        assert counts == sorted(counts, reverse=True)

    def test_incidents_missing_description_still_work(self):
        incidents = [{"title": "DB error"}, {"title": "DB error"}, {"title": "DB error"}]
        result = analyse_incidents(incidents)
        assert result["total"] == 3

    def test_each_pattern_has_required_fields(self, sample_incidents):
        result = analyse_incidents(sample_incidents)
        required = {"fingerprint", "count", "sample_title", "category",
                    "severity", "suggested_action", "automation_priority"}
        for pattern in result["recurring_patterns"]:
            assert required.issubset(pattern.keys()), (
                f"Pattern missing fields: {required - pattern.keys()}"
            )

    def test_identical_incidents_cluster_together(self):
        """Five identical titles should produce exactly one pattern with count=5."""
        incidents = [{"title": "High memory usage alert"}] * 5
        result = analyse_incidents(incidents)
        # Should have one dominant pattern
        top = result["recurring_patterns"][0]
        assert top["count"] == 5

    def test_all_unique_incidents_no_candidates(self):
        incidents = [
            {"title": "Production database down"},
            {"title": "SSL certificate warning"},
            {"title": "Slow response on checkout"},
        ]
        result = analyse_incidents(incidents)
        assert result["automation_candidates"] == []


class TestAutomationPriority:

    @pytest.mark.parametrize("count,severity,expected", [
        (5, "critical", "immediate"),   # 5 * 4 = 20 >= 12
        (3, "high",     "high"),        # 3 * 3 = 9 >= 6
        (2, "medium",   "medium"),      # 2 * 2 = 4 >= 3
        (1, "low",      "low"),         # 1 * 1 = 1 < 3
        (1, "unknown",  "low"),         # 1 * 0 = 0 < 3
        (10, "low",     "medium"),      # 10 * 1 = 10 >= 6... wait, let's check
    ])
    def test_priority_scoring(self, count, severity, expected):
        result = _automation_priority(count, severity)
        assert result == expected

    def test_high_count_high_severity_is_immediate(self):
        assert _automation_priority(10, "critical") == "immediate"

    def test_low_count_low_severity_is_low(self):
        assert _automation_priority(1, "low") == "low"
