"""
recurring.py — Recurring Incident Pattern Detector
===================================================
What this does:
    Analyses a list of incidents and identifies patterns that
    recur frequently enough to warrant building an automation.

    This is the "identify recurring support tickets" part of the job.
    Once you know something recurs 3+ times, you stop fixing it manually
    and you write an automation for it.

Why this matters:
    The job post says: "Design and implement durable automations for
    issues that occur more than once." You can't do that without first
    detecting which issues actually recur. This script is step one.

Job post mapping:
    "Identify recurring support tickets, operational incidents, and manual workflows"
    "Generalize recurring issues into repeatable solutions"
    "Partner with all internal teams to investigate workflow bottlenecks"
"""

from collections import Counter, defaultdict
from triage import generate_incident_fingerprint, classify_incident


# How many times an incident must recur before we flag it for automation
RECURRENCE_THRESHOLD = 3


def analyse_incidents(incidents: list[dict]) -> dict:
    """
    Analyse a list of incidents and identify recurring patterns.

    Each incident dict must have at least:
        - title (str)
        - description (str, optional)

    Returns:
        {
            "total": int,
            "recurring_patterns": [ { fingerprint, count, sample_title, category, automation_priority } ],
            "category_breakdown": { category: count },
            "automation_candidates": [ patterns exceeding RECURRENCE_THRESHOLD ]
        }
    """
    if not incidents:
        return {
            "total": 0,
            "recurring_patterns": [],
            "category_breakdown": {},
            "automation_candidates": [],
        }

    fingerprint_map = defaultdict(list)

    for incident in incidents:
        title = incident.get("title", "")
        description = incident.get("description", "")

        classification = classify_incident(title, description)
        fingerprint = generate_incident_fingerprint(title, classification["category"])

        fingerprint_map[fingerprint].append({
            "title": title,
            "category": classification["category"],
            "severity": classification["severity"],
            "suggested_action": classification["suggested_action"],
        })

    # Build recurring patterns list
    recurring_patterns = []
    category_counter = Counter()

    for fingerprint, occurrences in fingerprint_map.items():
        count = len(occurrences)
        sample = occurrences[0]
        category_counter[sample["category"]] += count

        recurring_patterns.append({
            "fingerprint": fingerprint,
            "count": count,
            "sample_title": sample["title"],
            "category": sample["category"],
            "severity": sample["severity"],
            "suggested_action": sample["suggested_action"],
            "automation_priority": _automation_priority(count, sample["severity"]),
        })

    # Sort by count descending
    recurring_patterns.sort(key=lambda x: x["count"], reverse=True)

    automation_candidates = [
        p for p in recurring_patterns if p["count"] >= RECURRENCE_THRESHOLD
    ]

    return {
        "total": len(incidents),
        "recurring_patterns": recurring_patterns,
        "category_breakdown": dict(category_counter),
        "automation_candidates": automation_candidates,
    }


def _automation_priority(count: int, severity: str) -> str:
    """
    Determine automation priority based on recurrence count and severity.

    Higher severity + more recurrences = automate this first.
    """
    severity_weight = {"critical": 4, "high": 3, "medium": 2, "low": 1, "unknown": 0}
    weight = severity_weight.get(str(severity), 0)

    score = count * weight

    if score >= 12:
        return "immediate"
    elif score >= 6:
        return "high"
    elif score >= 3:
        return "medium"
    else:
        return "low"


def format_analysis_report(analysis: dict) -> str:
    """Format analysis result as a readable report."""
    lines = [
        "=" * 60,
        "RECURRING INCIDENT ANALYSIS",
        "=" * 60,
        f"Total incidents analysed : {analysis['total']}",
        f"Unique patterns detected : {len(analysis['recurring_patterns'])}",
        f"Automation candidates    : {len(analysis['automation_candidates'])}",
        "",
        "CATEGORY BREAKDOWN:",
    ]

    for category, count in sorted(analysis["category_breakdown"].items(), key=lambda x: -x[1]):
        lines.append(f"  {category:<20} {count} incidents")

    if analysis["automation_candidates"]:
        lines += [
            "",
            "TOP AUTOMATION CANDIDATES (recurs 3+ times):",
            "-" * 60,
        ]
        for p in analysis["automation_candidates"]:
            lines.append(
                f"  [{p['automation_priority'].upper():9}] "
                f"x{p['count']} — {p['sample_title'][:45]}"
            )
            lines.append(f"             Action: {p['suggested_action'][:55]}")

    lines.append("=" * 60)
    return "\n".join(lines)


if __name__ == "__main__":
    # Demo: analyse a sample batch of incidents
    sample_incidents = [
        {"title": "Production database connection error", "description": ""},
        {"title": "DB connection pool exhausted", "description": ""},
        {"title": "Postgres connection refused", "description": ""},
        {"title": "Deployment failed on staging", "description": ""},
        {"title": "Release pipeline error", "description": ""},
        {"title": "Memory OOM in api-service pod", "description": ""},
        {"title": "High memory usage alert", "description": ""},
        {"title": "High memory usage alert", "description": ""},
        {"title": "SSL certificate expiring soon", "description": ""},
    ]

    analysis = analyse_incidents(sample_incidents)
    print(format_analysis_report(analysis))
