"""
ci_health.py — CI/CD Pipeline Health Checker
=============================================
What this does:
    Analyses CI/CD run data to detect:
    - Failure rate per workflow
    - Flaky tests (passes and fails inconsistently)
    - Slowest jobs (latency bottlenecks)
    - Recommended improvements

Why this exists:
    The job post explicitly lists "Improve CI/CD pipelines to reduce
    failures, latency, and manual intervention." You can't improve
    what you don't measure. This script gives you the measurement layer.

Job post mapping:
    "Improve CI/CD pipelines (primarily GitHub Actions)"
    "Reduce failures, latency, and manual intervention"
    "Automate repetitive build, test, release, and operational tasks"
"""

from statistics import mean, stdev
from enum import Enum


class RunStatus(str, Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


# A pipeline run is considered slow if it exceeds this duration (seconds)
SLOW_RUN_THRESHOLD_SECONDS = 600  # 10 minutes

# A workflow is flagged as flaky if its failure rate is in this range
# (too low = probably fine, too high = consistently broken, not flaky)
FLAKY_FAILURE_RATE_MIN = 0.1   # 10%
FLAKY_FAILURE_RATE_MAX = 0.6   # 60%

# Minimum runs required before we report on a workflow
MIN_RUNS_FOR_ANALYSIS = 3


def analyse_pipeline_health(runs: list[dict]) -> dict:
    """
    Analyse a list of CI pipeline runs and return a health report.

    Each run dict should contain:
        - workflow (str): name of the workflow / job
        - status (str): 'success' | 'failure' | 'cancelled' | 'skipped'
        - duration_seconds (int): how long the run took
        - branch (str, optional): git branch

    Returns:
        {
            "total_runs": int,
            "overall_success_rate": float,
            "workflows": { workflow_name: WorkflowStats },
            "flaky_workflows": [ workflow names ],
            "slow_workflows": [ workflow names ],
            "recommendations": [ str ]
        }
    """
    if not runs:
        return {
            "total_runs": 0,
            "overall_success_rate": 0.0,
            "workflows": {},
            "flaky_workflows": [],
            "slow_workflows": [],
            "recommendations": ["No run data provided."],
        }

    # Group runs by workflow
    by_workflow: dict[str, list] = {}
    for run in runs:
        name = run.get("workflow", "unknown")
        by_workflow.setdefault(name, []).append(run)

    workflow_stats = {}
    flaky = []
    slow = []
    recommendations = []

    for workflow, workflow_runs in by_workflow.items():
        if len(workflow_runs) < MIN_RUNS_FOR_ANALYSIS:
            continue

        stats = _compute_workflow_stats(workflow, workflow_runs)
        workflow_stats[workflow] = stats

        if stats["is_flaky"]:
            flaky.append(workflow)
            recommendations.append(
                f"'{workflow}' appears flaky ({stats['failure_rate']:.0%} failure rate). "
                f"Investigate non-deterministic tests or environment dependencies."
            )

        if stats["is_slow"]:
            slow.append(workflow)
            recommendations.append(
                f"'{workflow}' avg duration is {stats['avg_duration_seconds']:.0f}s. "
                f"Consider parallelising jobs or caching dependencies."
            )

    total = len(runs)
    successes = sum(1 for r in runs if r.get("status") == RunStatus.SUCCESS)
    overall_rate = successes / total if total > 0 else 0.0

    if overall_rate < 0.7:
        recommendations.append(
            f"Overall success rate is {overall_rate:.0%} — below 70%. "
            f"Prioritise fixing the most frequently failing workflows."
        )

    if not recommendations:
        recommendations.append("Pipeline health looks good. No immediate actions required.")

    return {
        "total_runs": total,
        "overall_success_rate": round(overall_rate, 4),
        "workflows": workflow_stats,
        "flaky_workflows": flaky,
        "slow_workflows": slow,
        "recommendations": recommendations,
    }


def _compute_workflow_stats(workflow: str, runs: list[dict]) -> dict:
    """Compute stats for a single workflow's run history."""
    total = len(runs)
    successes = sum(1 for r in runs if r.get("status") == RunStatus.SUCCESS)
    failures = sum(1 for r in runs if r.get("status") == RunStatus.FAILURE)
    failure_rate = failures / total if total > 0 else 0.0

    durations = [r["duration_seconds"] for r in runs if "duration_seconds" in r]
    avg_duration = mean(durations) if durations else 0
    max_duration = max(durations) if durations else 0
    duration_stdev = stdev(durations) if len(durations) > 1 else 0

    is_flaky = FLAKY_FAILURE_RATE_MIN <= failure_rate <= FLAKY_FAILURE_RATE_MAX
    is_slow = avg_duration > SLOW_RUN_THRESHOLD_SECONDS

    return {
        "workflow": workflow,
        "total_runs": total,
        "successes": successes,
        "failures": failures,
        "failure_rate": round(failure_rate, 4),
        "avg_duration_seconds": round(avg_duration, 1),
        "max_duration_seconds": max_duration,
        "duration_stdev": round(duration_stdev, 1),
        "is_flaky": is_flaky,
        "is_slow": is_slow,
    }


def format_health_report(health: dict) -> str:
    """Format health analysis as a readable report."""
    lines = [
        "=" * 60,
        "CI/CD PIPELINE HEALTH REPORT",
        "=" * 60,
        f"Total runs analysed  : {health['total_runs']}",
        f"Overall success rate : {health['overall_success_rate']:.0%}",
        f"Flaky workflows      : {len(health['flaky_workflows'])}",
        f"Slow workflows       : {len(health['slow_workflows'])}",
        "",
        "WORKFLOW BREAKDOWN:",
        "-" * 60,
    ]

    for name, stats in health["workflows"].items():
        flags = []
        if stats["is_flaky"]:
            flags.append("FLAKY")
        if stats["is_slow"]:
            flags.append("SLOW")
        flag_str = f" [{', '.join(flags)}]" if flags else ""

        lines.append(
            f"  {name:<30} "
            f"success={stats['successes']}/{stats['total_runs']} "
            f"avg={stats['avg_duration_seconds']:.0f}s"
            f"{flag_str}"
        )

    lines += [
        "",
        "RECOMMENDATIONS:",
        "-" * 60,
    ]
    for rec in health["recommendations"]:
        lines.append(f"  • {rec}")

    lines.append("=" * 60)
    return "\n".join(lines)


if __name__ == "__main__":
    # Demo with sample run data
    sample_runs = [
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

    health = analyse_pipeline_health(sample_runs)
    print(format_health_report(health))
