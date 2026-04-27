"""
test_ci_health.py — Unit tests for ci_health.py
================================================
What we're testing:
    The CI pipeline health analysis logic — flaky detection,
    slow workflow detection, success rate calculation, recommendations.

Key things to validate:
    - Correct flakiness detection (not too low, not too high failure rate)
    - Correct slowness detection (average > threshold)
    - Recommendations are generated appropriately
    - Edge cases: empty runs, single run, all successes, all failures
"""

import pytest
from ci_health import (
    analyse_pipeline_health,
    _compute_workflow_stats,
    SLOW_RUN_THRESHOLD_SECONDS,
    FLAKY_FAILURE_RATE_MIN,
    FLAKY_FAILURE_RATE_MAX,
    MIN_RUNS_FOR_ANALYSIS,
)


class TestAnalysePipelineHealth:

    def test_empty_runs_returns_zero_total(self):
        result = analyse_pipeline_health([])
        assert result["total_runs"] == 0
        assert result["overall_success_rate"] == 0.0

    def test_total_runs_matches_input(self, sample_ci_runs):
        result = analyse_pipeline_health(sample_ci_runs)
        assert result["total_runs"] == len(sample_ci_runs)

    def test_all_success_gives_100_percent(self):
        runs = [
            {"workflow": "unit-tests", "status": "success", "duration_seconds": 100},
            {"workflow": "unit-tests", "status": "success", "duration_seconds": 100},
            {"workflow": "unit-tests", "status": "success", "duration_seconds": 100},
        ]
        result = analyse_pipeline_health(runs)
        assert result["overall_success_rate"] == 1.0

    def test_all_failure_gives_zero_percent(self):
        runs = [
            {"workflow": "unit-tests", "status": "failure", "duration_seconds": 100},
            {"workflow": "unit-tests", "status": "failure", "duration_seconds": 100},
            {"workflow": "unit-tests", "status": "failure", "duration_seconds": 100},
        ]
        result = analyse_pipeline_health(runs)
        assert result["overall_success_rate"] == 0.0

    def test_detects_flaky_workflow(self):
        """40% failure rate = flaky."""
        runs = [
            {"workflow": "flaky-tests", "status": "success", "duration_seconds": 100},
            {"workflow": "flaky-tests", "status": "success", "duration_seconds": 100},
            {"workflow": "flaky-tests", "status": "success", "duration_seconds": 100},
            {"workflow": "flaky-tests", "status": "failure", "duration_seconds": 100},
            {"workflow": "flaky-tests", "status": "failure", "duration_seconds": 100},
        ]
        result = analyse_pipeline_health(runs)
        assert "flaky-tests" in result["flaky_workflows"]

    def test_does_not_flag_reliable_workflow_as_flaky(self):
        """0% failure rate = not flaky."""
        runs = [
            {"workflow": "solid-tests", "status": "success", "duration_seconds": 100},
            {"workflow": "solid-tests", "status": "success", "duration_seconds": 100},
            {"workflow": "solid-tests", "status": "success", "duration_seconds": 100},
        ]
        result = analyse_pipeline_health(runs)
        assert "solid-tests" not in result["flaky_workflows"]

    def test_does_not_flag_consistently_broken_as_flaky(self):
        """90% failure rate = consistently broken, not flaky."""
        runs = [
            {"workflow": "broken-tests", "status": "failure", "duration_seconds": 100},
            {"workflow": "broken-tests", "status": "failure", "duration_seconds": 100},
            {"workflow": "broken-tests", "status": "failure", "duration_seconds": 100},
            {"workflow": "broken-tests", "status": "failure", "duration_seconds": 100},
            {"workflow": "broken-tests", "status": "success", "duration_seconds": 100},
        ]
        result = analyse_pipeline_health(runs)
        assert "broken-tests" not in result["flaky_workflows"]

    def test_detects_slow_workflow(self):
        """Avg > SLOW_RUN_THRESHOLD_SECONDS should be flagged."""
        runs = [
            {"workflow": "slow-e2e", "status": "success", "duration_seconds": SLOW_RUN_THRESHOLD_SECONDS + 100},
            {"workflow": "slow-e2e", "status": "success", "duration_seconds": SLOW_RUN_THRESHOLD_SECONDS + 200},
            {"workflow": "slow-e2e", "status": "success", "duration_seconds": SLOW_RUN_THRESHOLD_SECONDS + 150},
        ]
        result = analyse_pipeline_health(runs)
        assert "slow-e2e" in result["slow_workflows"]

    def test_fast_workflow_not_flagged_as_slow(self):
        runs = [
            {"workflow": "fast-unit", "status": "success", "duration_seconds": 60},
            {"workflow": "fast-unit", "status": "success", "duration_seconds": 75},
            {"workflow": "fast-unit", "status": "success", "duration_seconds": 55},
        ]
        result = analyse_pipeline_health(runs)
        assert "fast-unit" not in result["slow_workflows"]

    def test_workflow_with_fewer_than_min_runs_excluded(self):
        """Workflows with < MIN_RUNS_FOR_ANALYSIS runs are not analysed."""
        runs = [
            {"workflow": "rare-job", "status": "failure", "duration_seconds": 100},
            {"workflow": "rare-job", "status": "failure", "duration_seconds": 100},
            # Only 2 runs, below MIN_RUNS_FOR_ANALYSIS (3)
        ]
        result = analyse_pipeline_health(runs)
        assert "rare-job" not in result["workflows"]

    def test_recommendations_not_empty(self, sample_ci_runs):
        result = analyse_pipeline_health(sample_ci_runs)
        assert len(result["recommendations"]) > 0

    def test_result_has_required_fields(self, sample_ci_runs):
        result = analyse_pipeline_health(sample_ci_runs)
        required = {"total_runs", "overall_success_rate", "workflows",
                    "flaky_workflows", "slow_workflows", "recommendations"}
        assert required.issubset(result.keys())


class TestComputeWorkflowStats:

    def test_success_rate_calculation(self):
        runs = [
            {"workflow": "test", "status": "success", "duration_seconds": 100},
            {"workflow": "test", "status": "success", "duration_seconds": 100},
            {"workflow": "test", "status": "failure", "duration_seconds": 100},
            {"workflow": "test", "status": "failure", "duration_seconds": 100},
        ]
        stats = _compute_workflow_stats("test", runs)
        assert stats["failure_rate"] == 0.5
        assert stats["successes"] == 2
        assert stats["failures"] == 2

    def test_avg_duration_calculation(self):
        runs = [
            {"workflow": "test", "status": "success", "duration_seconds": 100},
            {"workflow": "test", "status": "success", "duration_seconds": 200},
        ]
        stats = _compute_workflow_stats("test", runs)
        assert stats["avg_duration_seconds"] == 150.0

    def test_flaky_detection_at_boundary(self):
        """Exactly at FLAKY_FAILURE_RATE_MIN boundary."""
        n = 10
        fail_count = int(n * FLAKY_FAILURE_RATE_MIN)
        runs = (
            [{"workflow": "t", "status": "failure", "duration_seconds": 100}] * fail_count
            + [{"workflow": "t", "status": "success", "duration_seconds": 100}] * (n - fail_count)
        )
        stats = _compute_workflow_stats("t", runs)
        assert stats["is_flaky"] is True

    def test_stats_has_required_fields(self):
        runs = [
            {"workflow": "t", "status": "success", "duration_seconds": 100},
            {"workflow": "t", "status": "success", "duration_seconds": 100},
            {"workflow": "t", "status": "success", "duration_seconds": 100},
        ]
        stats = _compute_workflow_stats("t", runs)
        required = {"workflow", "total_runs", "successes", "failures",
                    "failure_rate", "avg_duration_seconds", "max_duration_seconds",
                    "duration_stdev", "is_flaky", "is_slow"}
        assert required.issubset(stats.keys())
