"""
triage.py — Incident Triage Automation Script
==============================================
What this does:
    Automates the triage of incoming incidents/tickets by:
    - Classifying severity based on keywords and patterns
    - Detecting if an incident is recurring
    - Suggesting a remediation action
    - Generating a fingerprint for deduplication

Why this exists:
    In a platform/SRE team, engineers waste hours manually reading
    and categorising tickets. This script automates that first pass,
    so engineers only touch tickets that need human judgment.

Job post mapping:
    "Identify recurring support tickets and operational incidents"
    "Design and implement durable automations for issues that occur more than once"
    "Triage incoming tickets or events"
"""

import re
import json
import hashlib
from datetime import datetime
from enum import Enum


class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


class Category(str, Enum):
    DATABASE = "database"
    NETWORK = "network"
    AUTH = "auth"
    PERFORMANCE = "performance"
    DEPLOYMENT = "deployment"
    STORAGE = "storage"
    UNKNOWN = "unknown"


# Triage rules: (regex pattern, severity, category, suggested action)
# Rules are evaluated top-to-bottom; first match wins.
TRIAGE_RULES = [
    (
        r"(production|prod).*(down|outage|unavailable)",
        Severity.CRITICAL,
        Category.NETWORK,
        "Page on-call immediately. Check load balancer health.",
    ),
    (
        r"(database|db|postgres|mysql|mongo).*(error|fail|down|corrupt)",
        Severity.CRITICAL,
        Category.DATABASE,
        "Check DB connection pool. Review slow query log. Consider failover.",
    ),
    (
        r"(memory|oom|out of memory|heap)",
        Severity.HIGH,
        Category.PERFORMANCE,
        "Restart affected pods. Review memory limits. Check for memory leaks.",
    ),
    (
        r"(deploy|deployment|release).*(fail|error|stuck|rollback)",
        Severity.HIGH,
        Category.DEPLOYMENT,
        "Check GitHub Actions logs. Review last diff. Roll back if needed.",
    ),
    (
        r"(login|auth|token|permission|403|401|unauthorized)",
        Severity.HIGH,
        Category.AUTH,
        "Check auth service health. Verify token expiry config.",
    ),
    (
        r"(disk|storage|volume).*(full|90%|95%|critical)",
        Severity.HIGH,
        Category.STORAGE,
        "Free up disk space. Rotate logs. Review retention policy.",
    ),
    (
        r"(slow|latency|timeout|response time)",
        Severity.MEDIUM,
        Category.PERFORMANCE,
        "Check APM traces. Review recent deploys. Look for N+1 queries.",
    ),
    (
        r"(certificate|ssl|tls|cert).*(expir|invalid|warn)",
        Severity.MEDIUM,
        Category.NETWORK,
        "Renew certificate. Check cert-manager logs.",
    ),
    (
        r"(warning|warn|deprecat)",
        Severity.LOW,
        Category.UNKNOWN,
        "Log for tracking. Review in next sprint.",
    ),
]


def classify_incident(title: str, description: str = "") -> dict:
    """
    Classify an incident based on its title and description.

    Args:
        title: The incident title / subject line
        description: Optional longer description or stack trace

    Returns:
        dict with severity, category, suggested_action, confidence, matched_pattern

    Raises:
        ValueError: if title is empty
    """
    if not title or not title.strip():
        raise ValueError("Incident title cannot be empty")

    text = f"{title} {description}".lower()

    for pattern, severity, category, action in TRIAGE_RULES:
        if re.search(pattern, text):
            return {
                "severity": severity,
                "category": category,
                "suggested_action": action,
                "confidence": "rule_match",
                "matched_pattern": pattern,
            }

    return {
        "severity": Severity.UNKNOWN,
        "category": Category.UNKNOWN,
        "suggested_action": "Manual review required. No automation rule matched.",
        "confidence": "no_match",
        "matched_pattern": None,
    }


def generate_incident_fingerprint(title: str, category: str) -> str:
    """
    Generate a short fingerprint for deduplication and recurrence detection.

    Normalises the title by stripping numbers/timestamps so that similar
    incidents hash to the same fingerprint regardless of time variance.

    Example:
        "DB error at 14:32" and "DB error at 15:01" → same fingerprint
    """
    normalised = re.sub(r"\d+", "", title.lower().strip())
    normalised = re.sub(r"\s+", " ", normalised)
    raw = f"{normalised}:{category}"
    return hashlib.md5(raw.encode()).hexdigest()[:12]


def triage_incident(title: str, description: str = "", history: list = None) -> dict:
    """
    Full triage pipeline for a single incident.

    Args:
        title: Incident title
        description: Incident body / stack trace
        history: List of previously seen fingerprints (for recurrence detection)

    Returns:
        Full triage result dict including timestamp, fingerprint,
        recurrence info, severity, category, and suggested action.
    """
    if history is None:
        history = []

    classification = classify_incident(title, description)
    fingerprint = generate_incident_fingerprint(title, classification["category"])
    is_recurring = fingerprint in history

    result = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "title": title,
        "fingerprint": fingerprint,
        "is_recurring": is_recurring,
        "recurrence_count": history.count(fingerprint),
        **classification,
    }

    if is_recurring:
        result["suggested_action"] = (
            f"[RECURRING x{result['recurrence_count']}] "
            f"{result['suggested_action']} "
            f"Consider building a durable automation for this pattern."
        )

    return result


def format_triage_report(result: dict) -> str:
    """Format a triage result as a human-readable report string."""
    lines = [
        "=" * 60,
        "INCIDENT TRIAGE REPORT",
        "=" * 60,
        f"Title      : {result['title']}",
        f"Severity   : {result['severity'].upper()}",
        f"Category   : {result['category']}",
        f"Recurring  : {'YES ⚠' if result['is_recurring'] else 'No'}",
        f"Fingerprint: {result['fingerprint']}",
        f"Confidence : {result['confidence']}",
        "-" * 60,
        f"Action     : {result['suggested_action']}",
        "=" * 60,
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    import sys

    title = " ".join(sys.argv[1:]) if len(sys.argv) > 1 else "Production database connection error"
    result = triage_incident(title)
    print(format_triage_report(result))
    print(f"\nJSON:\n{json.dumps(result, indent=2, default=str)}")
