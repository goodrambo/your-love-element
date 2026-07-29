#!/usr/bin/env python3
"""Dependency-light project Harness for Your Love Element."""

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "harness" / "contracts.json"
ROUTES_PATH = ROOT / "harness" / "routes.json"
MANUAL_PATH = ROOT / "harness" / "manual-checks.json"
STATUS_ORDER = {"PASS": 0, "SKIPPED": 1, "MANUAL_REQUIRED": 2, "FAIL": 3}
REQUIRED_ROUTE_KEYS = {
    "docs",
    "frontend",
    "tracking",
    "worker",
    "database",
    "paid_flow",
    "deployment",
    "social",
}
STANDING_GRANT_KEYS = {
    "apply_production_migrations",
    "git_push",
    "deploy_worker",
    "deploy_frontend",
    "publish_organic",
    "run_paid_flow_e2e",
    "send_customer_messages",
}
CONTRACT_TYPES = {
    "schema_version": int,
    "harness_version": str,
    "cache_revision": str,
    "state_max_review_days": int,
    "backlog_max_review_days": int,
    "manual_check_max_age_days": dict,
    "production": dict,
    "project_scope": dict,
    "standing_authority": dict,
    "required_files": list,
    "active_memory": list,
    "html_files": list,
    "javascript_files": list,
    "javascript_tests": list,
    "frontend_manual_digest_files": list,
    "paid_flow_manual_digest_files": list,
    "forbidden_active_paths": list,
    "ignored_roots": list,
    "max_active_binary_bytes": int,
    "protected_migrations": dict,
    "required_literals": list,
    "forbidden_patterns": list,
    "secret_names_forbidden_in_wrangler": list,
}


class Result:
    def __init__(self, status, name, message, blocking=False):
        self.status = status
        self.name = name
        self.message = message
        self.blocking = blocking


def relative(path):
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def load_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def digest_group(paths):
    digest = hashlib.sha256()
    for item in sorted(paths):
        path = ROOT / item
        digest.update(item.encode("utf-8"))
        digest.update(b"\0")
        if not path.is_file():
            digest.update(b"<missing>")
        else:
            digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def run(command, timeout=60):
    try:
        return subprocess.run(
            command,
            cwd=str(ROOT),
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(command, 124, stdout="", stderr="Timed out after {} seconds.".format(timeout))
    except OSError as error:
        return subprocess.CompletedProcess(command, 126, stdout="", stderr=str(error))


def find_node():
    candidates = []
    if os.environ.get("NODE_BIN"):
        candidates.append(Path(os.environ["NODE_BIN"]).expanduser())
    found = shutil.which("node")
    if found:
        candidates.append(Path(found))
    candidates.append(
        Path.home()
        / ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
    )
    for candidate in candidates:
        if candidate.is_file() and os.access(str(candidate), os.X_OK):
            return str(candidate)
    return None


def ignored(path, contracts):
    rel = relative(path)
    first = rel.split("/", 1)[0]
    return first in set(contracts.get("ignored_roots", []))


def active_files(contracts):
    ignored_roots = set(contracts.get("ignored_roots", []))
    for current, directories, filenames in os.walk(ROOT):
        current_path = Path(current)
        if current_path == ROOT:
            directories[:] = [item for item in directories if item not in ignored_roots]
        for filename in filenames:
            path = current_path / filename
            if not ignored(path, contracts):
                yield path


def git_paths(command):
    completed = run(command, timeout=30)
    if completed.returncode != 0:
        return set()
    return {line.strip() for line in completed.stdout.splitlines() if line.strip()}


def changed_files(staged_only=False):
    if staged_only:
        return git_paths(["git", "diff", "--cached", "--name-only", "--diff-filter=ACDMRTUXB"])
    changed = set()
    base_ref = os.environ.get("HARNESS_BASE_REF", "").strip()
    if base_ref and set(base_ref) != {"0"}:
        comparison = run(["git", "diff", "--name-only", "--diff-filter=ACDMRTUXB", base_ref + "...HEAD"])
        if comparison.returncode == 0:
            changed.update(line.strip() for line in comparison.stdout.splitlines() if line.strip())
    tracked = run(["git", "diff", "--name-only", "--diff-filter=ACDMRTUXB", "HEAD"])
    if tracked.returncode == 0:
        changed.update(line.strip() for line in tracked.stdout.splitlines() if line.strip())
    untracked = run(["git", "ls-files", "--others", "--exclude-standard"])
    if untracked.returncode == 0:
        changed.update(line.strip() for line in untracked.stdout.splitlines() if line.strip())
    return changed


def contract_schema_errors(contracts):
    errors = []
    for key, expected_type in CONTRACT_TYPES.items():
        if not isinstance(contracts.get(key), expected_type):
            errors.append("{} must be {}".format(key, expected_type.__name__))
    if errors:
        return errors
    if contracts["schema_version"] != 1:
        errors.append("schema_version must be 1")
    for key in (
        "required_files",
        "html_files",
        "javascript_files",
        "javascript_tests",
        "frontend_manual_digest_files",
        "paid_flow_manual_digest_files",
        "forbidden_active_paths",
        "ignored_roots",
        "secret_names_forbidden_in_wrangler",
    ):
        if not contracts[key] or not all(isinstance(item, str) and item for item in contracts[key]):
            errors.append("{} must be a non-empty string list".format(key))
    required_production = {"site_url", "worker_url", "support_email", "meta_pixel_id"}
    if not required_production.issubset(contracts["production"]):
        errors.append("production is missing required keys")
    elif not all(isinstance(contracts["production"][key], str) and contracts["production"][key] for key in required_production):
        errors.append("production values must be non-empty strings")
    project_scope = contracts["project_scope"]
    expected_scope_keys = {
        "authorized_root",
        "repository_name",
        "automation_id",
        "supabase_project_ref",
        "github_remote",
        "cloudflare_worker_name",
        "cloudflare_worker_origin",
        "cloudflare_zone",
        "resend_domain",
        "resend_from_address",
        "resend_support_address",
        "deny_other_projects",
    }
    if set(project_scope) != expected_scope_keys:
        errors.append("project_scope has an invalid shape")
    else:
        authorized_root = project_scope.get("authorized_root")
        if not isinstance(authorized_root, str) or not Path(authorized_root).is_absolute():
            errors.append("project_scope.authorized_root must be an absolute path")
        elif Path(authorized_root).resolve() != ROOT.resolve():
            errors.append("project_scope.authorized_root must match this repository exactly")
        elif project_scope.get("repository_name") != ROOT.name:
            errors.append("project_scope.repository_name must match this repository")
        elif project_scope.get("automation_id") != "yle":
            errors.append("project_scope.automation_id must be yle")
        elif project_scope.get("supabase_project_ref") != "nmwhaiimnuywnjlvobde":
            errors.append("project_scope.supabase_project_ref is not Your Love Element")
        elif project_scope.get("github_remote") != "https://github.com/goodrambo/your-love-element.git":
            errors.append("project_scope.github_remote is not Your Love Element")
        elif project_scope.get("cloudflare_worker_name") != "your-love-element-api":
            errors.append("project_scope.cloudflare_worker_name is not Your Love Element")
        elif project_scope.get("cloudflare_worker_origin") != contracts["production"].get("worker_url"):
            errors.append("project_scope.cloudflare_worker_origin and production.worker_url disagree")
        elif project_scope.get("cloudflare_zone") != "yourloveelement.com":
            errors.append("project_scope.cloudflare_zone is not Your Love Element")
        elif project_scope.get("resend_domain") != "yourloveelement.com":
            errors.append("project_scope.resend_domain is not Your Love Element")
        elif project_scope.get("resend_from_address") != "reports@yourloveelement.com":
            errors.append("project_scope.resend_from_address is not Your Love Element")
        elif project_scope.get("resend_support_address") != contracts["production"].get("support_email"):
            errors.append("project_scope.resend_support_address and production.support_email disagree")
        elif project_scope.get("deny_other_projects") is not True:
            errors.append("project_scope must deny other projects")
    authority = contracts["standing_authority"]
    grants = authority.get("grants") if isinstance(authority, dict) else None
    paid_media = authority.get("paid_media") if isinstance(authority, dict) else None
    if authority.get("schema_version") != 1 or not isinstance(grants, dict) or not isinstance(paid_media, dict):
        errors.append("standing_authority needs schema_version 1, grants, and paid_media")
    else:
        if set(grants) != STANDING_GRANT_KEYS:
            errors.append("standing_authority.grants must contain the exact supported grant keys")
        else:
            for name, record in grants.items():
                if not isinstance(record, dict) or set(record) != {"authorized", "evidence"}:
                    errors.append("standing_authority grant {} needs authorized and evidence".format(name))
                    break
                authorized = record.get("authorized")
                evidence = record.get("evidence")
                if not isinstance(authorized, bool):
                    errors.append("standing_authority grant {} authorized must be boolean".format(name))
                    break
                if authorized and (not isinstance(evidence, str) or not evidence.startswith("explicit_user_authorization:") or len(evidence) < 36):
                    errors.append("standing_authority grant {} needs explicit user authorization evidence".format(name))
                    break
                if not authorized and evidence is not None:
                    errors.append("standing_authority grant {} evidence must be null while denied".format(name))
                    break
        expected_paid_keys = {
            "authorized",
            "currency",
            "daily_cap",
            "lifetime_cap",
            "max_increase_percent_per_24h",
            "evidence",
        }
        if set(paid_media) != expected_paid_keys:
            errors.append("standing_authority.paid_media has an invalid shape")
        else:
            paid_authorized = paid_media.get("authorized")
            daily_cap = paid_media.get("daily_cap")
            lifetime_cap = paid_media.get("lifetime_cap")
            max_increase = paid_media.get("max_increase_percent_per_24h")
            evidence = paid_media.get("evidence")
            numeric_values = (daily_cap, lifetime_cap, max_increase)
            if not isinstance(paid_authorized, bool) or paid_media.get("currency") != "USD":
                errors.append("standing_authority.paid_media authorization/currency is invalid")
            elif not all(isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0 for value in numeric_values):
                errors.append("standing_authority.paid_media caps must be non-negative numbers")
            elif max_increase > 20:
                errors.append("standing_authority.paid_media max increase cannot exceed 20 percent per 24 hours")
            elif paid_authorized and (daily_cap <= 0 or lifetime_cap < daily_cap):
                errors.append("authorized paid media needs positive daily and lifetime caps")
            elif paid_authorized and (not isinstance(evidence, str) or not evidence.startswith("explicit_user_authorization:") or len(evidence) < 36):
                errors.append("authorized paid media needs explicit user authorization evidence")
            elif not paid_authorized and (daily_cap != 0 or lifetime_cap != 0 or evidence is not None):
                errors.append("denied paid media must keep zero caps and null evidence")
    for name in ("frontend_smoke", "paid_flow_e2e"):
        if not isinstance(contracts["manual_check_max_age_days"].get(name), int):
            errors.append("manual_check_max_age_days.{} must be an integer".format(name))
    for item, checksum in contracts["protected_migrations"].items():
        if not isinstance(item, str) or not re.fullmatch(r"[0-9a-f]{64}", str(checksum)):
            errors.append("protected_migrations has an invalid path or SHA-256")
            break
    for rule in contracts["active_memory"]:
        if not isinstance(rule, dict) or not isinstance(rule.get("path"), str) or not isinstance(rule.get("max_lines"), int):
            errors.append("active_memory entries need path and max_lines")
            break
    for rule in contracts["required_literals"]:
        if not isinstance(rule, dict) or not all(isinstance(rule.get(key), str) and rule.get(key) for key in ("id", "path", "value")):
            errors.append("required_literals entries need id, path, and value")
            break
    for rule in contracts["forbidden_patterns"]:
        if not isinstance(rule, dict) or not all(isinstance(rule.get(key), str) and rule.get(key) for key in ("id", "path", "pattern")):
            errors.append("forbidden_patterns entries need id, path, and pattern")
            break
    return errors


def hook_schema_errors(payload):
    errors = []
    hooks = payload.get("hooks") if isinstance(payload, dict) else None
    expected = {
        "SessionStart": ("session-start", 60),
        "SubagentStart": ("subagent-start", 30),
        "Stop": ("stop", 120),
    }
    if not isinstance(hooks, dict) or set(hooks) != set(expected):
        return ["hooks must define exactly SessionStart, SubagentStart, and Stop"]
    for event, (mode, timeout) in expected.items():
        entries = hooks.get(event)
        if not isinstance(entries, list) or len(entries) != 1 or not isinstance(entries[0], dict):
            errors.append("{} needs exactly one matcher entry".format(event))
            continue
        handlers = entries[0].get("hooks")
        if not isinstance(handlers, list) or len(handlers) != 1 or not isinstance(handlers[0], dict):
            errors.append("{} needs exactly one command handler".format(event))
            continue
        handler = handlers[0]
        command = handler.get("command")
        windows = handler.get("commandWindows")
        if handler.get("type") != "command":
            errors.append("{} handler type must be command".format(event))
        if not isinstance(command, str) or ".codex/hooks/harness_gate.py" not in command or not command.rstrip().endswith(mode):
            errors.append("{} command must invoke {}".format(event, mode))
        if not isinstance(windows, str) or ".codex/hooks/harness_gate.py" not in windows or not windows.rstrip('"').rstrip().endswith(mode):
            errors.append("{} commandWindows must invoke {}".format(event, mode))
        if handler.get("timeout") != timeout:
            errors.append("{} timeout must be {} seconds".format(event, timeout))
    return errors


def check_contract_files(contracts):
    results = []
    schema_errors = contract_schema_errors(contracts)
    if schema_errors:
        return [Result("FAIL", "contracts-schema", "; ".join(schema_errors), True)]
    results.append(Result("PASS", "contracts-schema", "Harness contract schema is complete."))

    project_scope = contracts["project_scope"]
    git_root = run(["git", "rev-parse", "--show-toplevel"], timeout=10)
    git_remote = run(["git", "remote", "get-url", "origin"], timeout=10)
    expected_root = Path(project_scope["authorized_root"]).resolve()
    actual_git_root = Path(git_root.stdout.strip()).resolve() if git_root.returncode == 0 and git_root.stdout.strip() else None
    worker_config = (ROOT / "worker/wrangler.toml").read_text(encoding="utf-8") if (ROOT / "worker/wrangler.toml").is_file() else ""
    expected_worker_literals = (
        'name = "{}"'.format(project_scope["cloudflare_worker_name"]),
        'SITE_URL = "https://{}"'.format(project_scope["cloudflare_zone"]),
        project_scope["resend_from_address"],
        project_scope["resend_support_address"],
    )
    scope_mismatch = (
        ROOT.resolve() != expected_root
        or actual_git_root != expected_root
        or git_remote.returncode != 0
        or git_remote.stdout.strip() != project_scope["github_remote"]
        or not all(value in worker_config for value in expected_worker_literals)
    )
    if scope_mismatch:
        results.append(Result(
            "FAIL",
            "project-scope-contract",
            "Filesystem, GitHub, Cloudflare, or Resend scope is outside the authorized Your Love Element assets.",
            True,
        ))
    else:
        results.append(Result(
            "PASS",
            "project-scope-contract",
            "Exact filesystem, GitHub, Cloudflare, Resend, and Supabase assets enforced for Your Love Element; other projects are denied.",
        ))

    standing = contracts["standing_authority"]
    authorized_grants = sorted(
        name for name, record in standing["grants"].items() if record["authorized"]
    )
    paid = standing["paid_media"]
    if authorized_grants or paid["authorized"]:
        summary = authorized_grants + (["paid_media"] if paid["authorized"] else [])
        results.append(Result(
            "PASS",
            "standing-authority-contract",
            "Explicit grants: {}; paid-media daily/lifetime caps: {}/{} USD.".format(
                ", ".join(summary), paid["daily_cap"], paid["lifetime_cap"]
            ),
        ))
    else:
        results.append(Result(
            "PASS",
            "standing-authority-contract",
            "Default deny: no production mutation, publishing, messaging, paid E2E, or paid-media spend is authorized; paid caps are 0 USD.",
        ))

    required = set(contracts["required_files"])
    required.update(contracts["html_files"])
    required.update(contracts["javascript_files"])
    required.update(contracts["javascript_tests"])
    required.update(contracts["frontend_manual_digest_files"])
    required.update(contracts["paid_flow_manual_digest_files"])
    required.update(contracts["protected_migrations"].keys())
    required.update({"styles.css", "worker/wrangler.toml", "supabase/README.md"})
    missing = [item for item in sorted(required) if not (ROOT / item).is_file()]
    if missing:
        results.append(Result("FAIL", "required-files", "Missing: " + ", ".join(missing), True))
    else:
        results.append(Result("PASS", "required-files", "All required Harness files exist."))

    agents = (ROOT / "AGENTS.md").read_text(encoding="utf-8") if (ROOT / "AGENTS.md").is_file() else ""
    expected = "HARNESS_VERSION: {}".format(contracts["harness_version"])
    if expected not in agents:
        results.append(Result("FAIL", "harness-version", "AGENTS.md and contracts.json disagree.", True))
    else:
        results.append(Result("PASS", "harness-version", expected))

    try:
        routes = load_json(ROUTES_PATH)
        missing_routes = []
        route_map = routes.get("routes") if isinstance(routes, dict) else None
        route_errors = []
        if not isinstance(routes, dict) or routes.get("schema_version") != 1 or not isinstance(route_map, dict):
            route_errors.append("routes.json needs schema_version 1 and a routes object")
        else:
            absent = sorted(REQUIRED_ROUTE_KEYS - set(route_map))
            if absent:
                route_errors.append("missing scopes: " + ", ".join(absent))
            for scope in sorted(REQUIRED_ROUTE_KEYS):
                paths = route_map.get(scope)
                if not isinstance(paths, list) or not paths or not all(isinstance(item, str) and item for item in paths):
                    route_errors.append("{} route must be a non-empty string list".format(scope))
                    continue
                missing_routes.extend(item for item in paths if not (ROOT / item).is_file())
        if missing_routes:
            route_errors.append("missing files: " + ", ".join(sorted(set(missing_routes))))
        if route_errors:
            results.append(Result("FAIL", "document-routes", "; ".join(route_errors), True))
        else:
            results.append(Result("PASS", "document-routes", "Every routed document exists."))
    except (OSError, ValueError) as error:
        results.append(Result("FAIL", "document-routes", str(error), True))

    try:
        manual = load_json(MANUAL_PATH)
        manual_valid = (
            manual.get("schema_version") == 1
            and isinstance(manual.get("frontend_smoke"), dict)
            and isinstance(manual.get("paid_flow_e2e"), dict)
        )
        if not manual_valid:
            raise ValueError("manual-checks.json needs schema_version 1 and both evidence records")
        results.append(Result("PASS", "manual-evidence-schema", "Manual evidence JSON is structurally complete."))
    except (OSError, ValueError) as error:
        results.append(Result("FAIL", "manual-evidence-schema", str(error), True))

    try:
        hook_errors = hook_schema_errors(load_json(ROOT / ".codex/hooks.json"))
        if hook_errors:
            results.append(Result("FAIL", "codex-hook-schema", "; ".join(hook_errors), True))
        else:
            results.append(Result("PASS", "codex-hook-schema", "Lifecycle hooks and platform commands are complete."))
    except (OSError, ValueError) as error:
        results.append(Result("FAIL", "codex-hook-schema", str(error), True))

    config_text = (ROOT / ".codex/config.toml").read_text(encoding="utf-8") if (ROOT / ".codex/config.toml").is_file() else ""
    feature_match = re.search(r"(?ms)^\[features\]\s*(.*?)(?=^\[|\Z)", config_text)
    if not feature_match or not re.search(r"(?m)^\s*hooks\s*=\s*true\s*$", feature_match.group(1)):
        results.append(Result("FAIL", "codex-hook-feature", ".codex/config.toml must enable hooks under [features].", True))
    else:
        results.append(Result("PASS", "codex-hook-feature", "Project hook feature is enabled."))

    workflow_path = ROOT / ".github/workflows/harness.yml"
    workflow_text = workflow_path.read_text(encoding="utf-8") if workflow_path.is_file() else ""
    workflow_literals = (
        "push:",
        "pull_request:",
        "actions/checkout@",
        "fetch-depth: 0",
        "actions/setup-python@",
        "actions/setup-node@",
        "python3 scripts/harness.py verify --scope all --ci",
    )
    missing_workflow = [item for item in workflow_literals if item not in workflow_text]
    if missing_workflow or re.search(r"(?m)^\s*continue-on-error:\s*true\s*$", workflow_text, re.IGNORECASE):
        message = "Missing/unsafe workflow semantics: " + ", ".join(missing_workflow or ["continue-on-error: true"])
        results.append(Result("FAIL", "ci-workflow", message, True))
    else:
        results.append(Result("PASS", "ci-workflow", "Push/PR CI runs blocking Python and Node verification."))

    if os.name != "nt":
        non_executable = [
            item for item in ("scripts/harness.py", ".codex/hooks/harness_gate.py", ".githooks/pre-commit")
            if (ROOT / item).is_file() and not os.access(str(ROOT / item), os.X_OK)
        ]
        if non_executable:
            results.append(Result("FAIL", "harness-executables", "Not executable: " + ", ".join(non_executable), True))
        else:
            results.append(Result("PASS", "harness-executables", "Harness entry points are executable."))
    return results


def check_memory(contracts):
    results = []
    violations = []
    for rule in contracts["active_memory"]:
        path = ROOT / rule["path"]
        if not path.is_file():
            continue
        line_count = len(path.read_text(encoding="utf-8").splitlines())
        if line_count > int(rule["max_lines"]):
            violations.append("{} has {} lines (max {})".format(rule["path"], line_count, rule["max_lines"]))
    if violations:
        results.append(Result("FAIL", "memory-size", "; ".join(violations), True))
    else:
        results.append(Result("PASS", "memory-size", "Active memory stays within its line budgets."))

    freshness_rules = (
        ("state", "docs/PROJECT_STATE.md", "last_verified", "state_max_review_days", True),
        ("backlog", "docs/BACKLOG.md", "last_reviewed", "backlog_max_review_days", False),
    )
    for label, item, last_key, window_key, needs_evidence in freshness_rules:
        text = (ROOT / item).read_text(encoding="utf-8")
        last_match = re.search(r"^{}:\s*(\d{{4}}-\d{{2}}-\d{{2}})\s*$".format(last_key), text, re.MULTILINE)
        review_match = re.search(r"^review_after:\s*(\d{4}-\d{2}-\d{2})\s*$", text, re.MULTILINE)
        evidence_match = re.search(r"^evidence:\s*\S.+$", text, re.MULTILINE)
        if not last_match or not review_match or (needs_evidence and not evidence_match):
            required_fields = "{}, review_after{}".format(last_key, ", and evidence" if needs_evidence else "")
            results.append(Result("FAIL", label + "-metadata", "{} needs {}.".format(item, required_fields), True))
            continue
        try:
            last_date = dt.date.fromisoformat(last_match.group(1))
            review_after = dt.date.fromisoformat(review_match.group(1))
        except ValueError as error:
            results.append(Result("FAIL", label + "-freshness", str(error), True))
            continue
        today = dt.date.today()
        max_window = int(contracts.get(window_key, 30))
        if last_date > today or review_after < last_date or (review_after - last_date).days > max_window:
            results.append(Result("FAIL", label + "-freshness", "Dates must be ordered, non-future, and no more than {} days apart.".format(max_window), True))
        elif review_after < today:
            results.append(Result("MANUAL_REQUIRED", label + "-freshness", "Evidence expired on {}.".format(review_after), True))
        else:
            results.append(Result("PASS", label + "-freshness", "Reviewable through {}.".format(review_after)))
    return results


def check_filesystem(contracts):
    results = []
    forbidden = [item for item in contracts["forbidden_active_paths"] if (ROOT / item).exists()]
    if forbidden:
        results.append(Result("FAIL", "artifact-boundary", "Non-runtime paths returned to active source: " + ", ".join(forbidden), True))
    else:
        results.append(Result("PASS", "artifact-boundary", "Generated media is outside active runtime paths."))

    junk = []
    oversized = []
    max_bytes = int(contracts["max_active_binary_bytes"])
    binary_extensions = {
        ".mp4", ".mov", ".webm", ".mkv", ".gif",
        ".zip", ".7z", ".rar", ".tar", ".gz",
        ".psd", ".aep", ".wav", ".mp3", ".m4a",
        ".pdf", ".xlsx", ".xls", ".pptx", ".docx",
    }
    for path in active_files(contracts):
        if path.name == ".DS_Store" or path.suffix.lower() in {".pyc", ".pyo"} or "__pycache__" in path.parts:
            junk.append(relative(path))
        try:
            size = path.stat().st_size
        except OSError:
            continue
        if path.suffix.lower() in binary_extensions or size > max_bytes:
            oversized.append("{} ({:.1f} MB)".format(relative(path), size / 1024 / 1024))
    if junk:
        results.append(Result("FAIL", "cache-files", "Remove: " + ", ".join(junk), True))
    else:
        results.append(Result("PASS", "cache-files", "No active OS/Python cache files."))
    if oversized:
        results.append(Result("FAIL", "large-active-files", "Move to artifacts/: " + ", ".join(oversized), True))
    else:
        results.append(Result("PASS", "large-active-files", "No generated/oversized binary in active source."))
    return results


def local_reference_target(document, value):
    value = value.strip()
    if not value or value.startswith(("#", "http://", "https://", "//", "mailto:", "tel:", "data:", "javascript:")):
        return None
    value = value.split("#", 1)[0].split("?", 1)[0]
    if not value or "{" in value or "}" in value:
        return None
    if value.startswith("/"):
        target = ROOT / value.lstrip("/")
    else:
        target = document.parent / value
    if target.is_dir():
        if document.suffix.lower() == ".md":
            return target.resolve()
        target = target / "index.html"
    elif value.endswith("/"):
        target = target / "index.html"
    return target.resolve()


def check_html(contracts):
    results = []
    missing_refs = []
    json_errors = []
    canonical_errors = []
    cache_errors = []
    expected_revision = contracts["cache_revision"]
    production_site = contracts["production"]["site_url"]
    attribute_re = re.compile(r"\b(?:src|href|poster)=[\"']([^\"']+)[\"']", re.IGNORECASE)
    jsonld_re = re.compile(r"<script[^>]*type=[\"']application/ld\+json[\"'][^>]*>(.*?)</script>", re.IGNORECASE | re.DOTALL)
    canonical_re = re.compile(r"<link[^>]*rel=[\"']canonical[\"'][^>]*href=[\"']([^\"']+)[\"']", re.IGNORECASE)

    for item in contracts["html_files"]:
        path = ROOT / item
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        for value in attribute_re.findall(text):
            target = local_reference_target(path, value)
            if target is not None and not target.exists():
                missing_refs.append("{} -> {}".format(item, value))
        for payload in jsonld_re.findall(text):
            try:
                json.loads(payload)
            except ValueError as error:
                json_errors.append("{}: {}".format(item, error))
        canonical = canonical_re.search(text)
        if not canonical or not canonical.group(1).startswith(production_site):
            canonical_errors.append(item)
        for asset in ("styles.css", "script.js", "runtime-config.js"):
            if "{}?v={}".format(asset, expected_revision) not in text:
                cache_errors.append("{} missing {} revision".format(item, asset))
        if "family=Fraunces" not in text or "family=Manrope" not in text:
            cache_errors.append("{} uses stale font config".format(item))

    results.append(Result("FAIL" if missing_refs else "PASS", "html-references", "; ".join(missing_refs) if missing_refs else "All local HTML references resolve.", bool(missing_refs)))
    results.append(Result("FAIL" if json_errors else "PASS", "json-ld", "; ".join(json_errors) if json_errors else "All JSON-LD blocks parse.", bool(json_errors)))
    results.append(Result("FAIL" if canonical_errors else "PASS", "canonicals", ", ".join(canonical_errors) if canonical_errors else "All pages use the production canonical origin.", bool(canonical_errors)))
    results.append(Result("FAIL" if cache_errors else "PASS", "frontend-revision", "; ".join(cache_errors) if cache_errors else "Fonts and cache revision are synchronized across all pages.", bool(cache_errors)))
    return results


def check_markdown_links(contracts):
    errors = []
    link_re = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
    for path in active_files(contracts):
        if path.suffix.lower() != ".md" or relative(path).startswith("docs/history/"):
            continue
        text = path.read_text(encoding="utf-8")
        for raw in link_re.findall(text):
            value = raw.strip().split(" ", 1)[0].strip("<>")
            target = local_reference_target(path, value)
            if target is not None and not target.exists():
                errors.append("{} -> {}".format(relative(path), value))
    return [Result("FAIL" if errors else "PASS", "markdown-links", "; ".join(errors) if errors else "Active Markdown links resolve.", bool(errors))]


def check_javascript(contracts):
    node = find_node()
    if not node:
        return [Result("MANUAL_REQUIRED", "javascript-syntax", "Node not found on PATH or in the bundled Codex runtime.", True)]
    failures = []
    for item in contracts["javascript_files"]:
        path = ROOT / item
        if not path.is_file():
            continue
        completed = run([node, "--check", str(path)], timeout=30)
        if completed.returncode != 0:
            failures.append("{}: {}".format(item, (completed.stderr or completed.stdout).strip()))
    version = run([node, "--version"], timeout=10).stdout.strip()
    return [Result("FAIL" if failures else "PASS", "javascript-syntax", "; ".join(failures) if failures else "{} checked with Node {}.".format(len(contracts["javascript_files"]), version), bool(failures))]


def check_javascript_tests(contracts):
    node = find_node()
    if not node:
        return [Result("MANUAL_REQUIRED", "javascript-tests", "Node not found on PATH or in the bundled Codex runtime.", True)]
    completed = run([node, "--test", *contracts["javascript_tests"]], timeout=60)
    if completed.returncode != 0:
        output = (completed.stdout + completed.stderr).strip()
        return [Result("FAIL", "javascript-tests", output or "Node test runner failed.", True)]
    return [Result("PASS", "javascript-tests", "{} test file(s) passed.".format(len(contracts["javascript_tests"])))]


def check_invariants(contracts):
    results = []
    failures = []
    for rule in contracts["required_literals"]:
        text = (ROOT / rule["path"]).read_text(encoding="utf-8")
        if rule["value"] not in text:
            failures.append(rule["id"])
    for rule in contracts["forbidden_patterns"]:
        text = (ROOT / rule["path"]).read_text(encoding="utf-8")
        if re.search(rule["pattern"], text):
            failures.append(rule["id"])
    if failures:
        results.append(Result("FAIL", "protected-invariants", "Violated: " + ", ".join(failures), True))
    else:
        results.append(Result("PASS", "protected-invariants", "Paid-flow, tracking, and local-safety invariants are present."))

    production = contracts["production"]
    consistency_rules = [
        ("runtime-worker-url", "assets/runtime-config.js", production["worker_url"]),
        ("browser-pixel-id", "assets/tracking-config.js", production["meta_pixel_id"]),
        ("worker-site-url", "worker/wrangler.toml", production["site_url"]),
        ("worker-support-email", "worker/wrangler.toml", production["support_email"]),
        ("worker-pixel-id", "worker/wrangler.toml", production["meta_pixel_id"]),
        ("robots-origin", "robots.txt", production["site_url"]),
        ("sitemap-origin", "sitemap.xml", production["site_url"]),
    ]
    inconsistent = []
    for identifier, item, value in consistency_rules:
        if value not in (ROOT / item).read_text(encoding="utf-8"):
            inconsistent.append(identifier)
    expected_host = production["site_url"].split("//", 1)[-1].strip("/")
    if (ROOT / "CNAME").read_text(encoding="utf-8").strip() != expected_host:
        inconsistent.append("cname-origin")
    frontend_supabase = []
    for item in ("index.html", "full-report/index.html", "script.js", "assets/runtime-config.js"):
        if ".supabase.co" in (ROOT / item).read_text(encoding="utf-8"):
            frontend_supabase.append(item)
    if frontend_supabase:
        inconsistent.append("frontend-direct-supabase:" + ",".join(frontend_supabase))
    if inconsistent:
        results.append(Result("FAIL", "production-contracts", "Drifted: " + ", ".join(inconsistent), True))
    else:
        results.append(Result("PASS", "production-contracts", "Domain, Worker, support, Pixel, CNAME, robots, sitemap, and browser boundary agree."))

    wrangler = (ROOT / "worker/wrangler.toml").read_text(encoding="utf-8")
    exposed = []
    for name in contracts["secret_names_forbidden_in_wrangler"]:
        if re.search(r"^\s*{}\s*=".format(re.escape(name)), wrangler, re.MULTILINE):
            exposed.append(name)
    if exposed:
        results.append(Result("FAIL", "secret-boundary", "Secret assignments found in wrangler.toml: " + ", ".join(exposed), True))
    else:
        results.append(Result("PASS", "secret-boundary", "No protected secret is assigned in wrangler.toml."))

    personal = []
    secret_values = []
    consumer_email = re.compile(
        r"[A-Z0-9._%+-]+@(gmail|googlemail|yahoo|hotmail|outlook|icloud|me|live|msn|aol|protonmail|proton|qq|163)\.[A-Z]{2,}",
        re.IGNORECASE,
    )
    secret_patterns = {
        "openai-key": re.compile(r"\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b"),
        "github-token": re.compile(r"\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b"),
        "jwt": re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"),
        "private-key": re.compile("-----BEGIN " + r"(?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
        "meta-token": re.compile(r"\bEAA[A-Za-z0-9]{20,}\b"),
        "supabase-secret": re.compile(r"\bsb_secret_[A-Za-z0-9_-]{16,}\b"),
    }
    text_extensions = {".md", ".js", ".html", ".toml", ".json", ".sql", ".yml", ".yaml", ".txt", ".css", ".xml", ".svg", ".py", ".sh"}
    for path in active_files(contracts):
        rel = relative(path)
        if path.suffix.lower() not in text_extensions and path.name not in {"CNAME", ".gitignore"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if not rel.startswith("docs/history/") and consumer_email.search(text):
            personal.append(rel)
        for label, pattern in secret_patterns.items():
            if pattern.search(text):
                secret_values.append("{} ({})".format(rel, label))
    if personal:
        results.append(Result("FAIL", "personal-data", "Consumer email address found in active files: " + ", ".join(personal), True))
    else:
        results.append(Result("PASS", "personal-data", "No consumer email address in active memory/source."))
    if secret_values:
        results.append(Result("FAIL", "secret-values", "Possible live secret material: " + ", ".join(secret_values), True))
    else:
        results.append(Result("PASS", "secret-values", "No common live credential pattern in active text/history."))
    return results


def check_migrations(contracts):
    results = []
    expected = contracts["protected_migrations"]
    actual_paths = sorted(relative(path) for path in (ROOT / "supabase/migrations").glob("*.sql"))
    if actual_paths != sorted(expected):
        results.append(Result("FAIL", "migration-inventory", "contracts.json must exactly inventory the migration directory.", True))
    else:
        results.append(Result("PASS", "migration-inventory", "All {} migrations are inventoried.".format(len(actual_paths))))

    changed = []
    for item, checksum in expected.items():
        path = ROOT / item
        if path.is_file() and sha256_file(path) != checksum:
            changed.append(item)
    if changed:
        results.append(Result("FAIL", "migration-checksums", "Applied migration changed: " + ", ".join(changed), True))
    else:
        results.append(Result("PASS", "migration-checksums", "Protected migration checksums match."))

    base_ref = os.environ.get("HARNESS_BASE_REF", "").strip()
    if not base_ref or set(base_ref) == {"0"}:
        base_ref = "HEAD"
    immutable = run([
        "git", "diff", "--name-status", "--find-renames", base_ref, "--", "supabase/migrations"
    ], timeout=30)
    if immutable.returncode != 0:
        results.append(Result("FAIL", "migration-immutability", "Cannot compare migration baseline {}: {}".format(base_ref, (immutable.stdout + immutable.stderr).strip()), True))
    else:
        rewritten = []
        for line in immutable.stdout.splitlines():
            fields = line.split("\t")
            if fields and fields[0] and not fields[0].startswith("A"):
                rewritten.append(line)
        if rewritten:
            results.append(Result("FAIL", "migration-immutability", "Existing migrations are append-only; add a new file instead: " + "; ".join(rewritten), True))
        else:
            results.append(Result("PASS", "migration-immutability", "Baseline migrations are unchanged; only additions are allowed."))

    inventories = [ROOT / "supabase/README.md", ROOT / "docs/05-supabase-database.md"]
    missing = []
    for inventory in inventories:
        text = inventory.read_text(encoding="utf-8")
        for item in actual_paths:
            if Path(item).name not in text:
                missing.append("{} missing {}".format(relative(inventory), Path(item).name))
    if missing:
        results.append(Result("FAIL", "migration-docs", "; ".join(missing), True))
    else:
        results.append(Result("PASS", "migration-docs", "Component and reference migration lists match disk."))
    return results


def verification_critical_files(contracts):
    files = set(contracts["required_files"])
    files.update(contracts["html_files"])
    files.update(contracts["javascript_files"])
    files.update(contracts["frontend_manual_digest_files"])
    files.update(contracts["paid_flow_manual_digest_files"])
    files.update(contracts["protected_migrations"])
    files.update({"styles.css", "worker/wrangler.toml", "supabase/README.md"})
    return files


def check_staged_integrity(contracts):
    staged = git_paths(["git", "diff", "--cached", "--name-only", "--diff-filter=ACDMRTUXB"])
    if not staged:
        return [Result("SKIPPED", "staged-snapshot", "No staged changes to verify.")]

    results = []
    unstaged = git_paths(["git", "diff", "--name-only", "--diff-filter=ACDMRTUXB"])
    unstaged.update(git_paths(["git", "ls-files", "--others", "--exclude-standard"]))
    overlap = sorted(staged & unstaged)
    if overlap:
        results.append(Result("FAIL", "staged-overlap", "Files differ between index and working tree: " + ", ".join(overlap), True))
    else:
        results.append(Result("PASS", "staged-overlap", "Staged files have no unstaged overlay."))

    indexed = git_paths(["git", "ls-files", "--cached"])
    missing_from_index = sorted(verification_critical_files(contracts) - indexed)
    if missing_from_index:
        results.append(Result("FAIL", "staged-required-files", "Required files absent from commit index: " + ", ".join(missing_from_index), True))
    else:
        results.append(Result("PASS", "staged-required-files", "All verification-critical files exist in the index."))

    gate_files = {
        "AGENTS.md",
        "docs/PROJECT_STATE.md",
        "docs/BACKLOG.md",
        "harness/contracts.json",
        "harness/routes.json",
        "harness/manual-checks.json",
        "scripts/harness.py",
        ".codex/config.toml",
        ".codex/hooks.json",
        ".codex/hooks/harness_gate.py",
        ".githooks/pre-commit",
        ".github/workflows/harness.yml",
    }
    unsafe_dirty = set(gate_files & unstaged)
    if staged & gate_files:
        unsafe_dirty.update(verification_critical_files(contracts) & unstaged)
    if unsafe_dirty:
        results.append(Result("FAIL", "staged-gate-cleanliness", "Verification would read unstaged critical files: " + ", ".join(sorted(unsafe_dirty)), True))
    else:
        results.append(Result("PASS", "staged-gate-cleanliness", "Commit gate is evaluated from an unmasked snapshot."))

    protected_sources = set(contracts["frontend_manual_digest_files"]) | set(contracts["paid_flow_manual_digest_files"])
    if staged & protected_sources and "harness/manual-checks.json" not in staged:
        results.append(Result("FAIL", "staged-manual-evidence", "Stage harness/manual-checks.json with every protected frontend/paid source change.", True))
    else:
        results.append(Result("PASS", "staged-manual-evidence", "Protected source and digest-bound evidence are staged together."))
    return results


def check_git(staged_only=False):
    failures = []
    commands = [("index", ["git", "diff", "--cached", "--check"])]
    if not staged_only:
        commands.insert(0, ("worktree", ["git", "diff", "--check"]))
    base_ref = os.environ.get("HARNESS_BASE_REF", "").strip()
    if base_ref and set(base_ref) != {"0"}:
        commands.append(("base", ["git", "diff", "--check", base_ref + "...HEAD"]))
    for label, command in commands:
        completed = run(command, timeout=30)
        if completed.returncode:
            failures.append("{}: {}".format(label, (completed.stdout + completed.stderr).strip()))
    if failures:
        return [Result("FAIL", "git-diff", "; ".join(failures), True)]
    return [Result("PASS", "git-diff", "No whitespace errors in the diff.")]


def current_manual_status(record, expected_digest, max_age_days, allowed_statuses=("pass",)):
    status = record.get("status")
    if status not in allowed_statuses or record.get("source_digest") != expected_digest:
        return None
    evidence = str(record.get("evidence") or "").strip()
    if len(evidence) < 24:
        return None
    try:
        verified_at = dt.date.fromisoformat(str(record.get("verified_at")))
    except (TypeError, ValueError):
        return None
    age = (dt.date.today() - verified_at).days
    return status if 0 <= age <= int(max_age_days) else None


def check_manual(contracts, scope, ci=False, staged_only=False):
    results = []
    changed = changed_files(staged_only=staged_only)
    frontend_files = set(contracts["frontend_manual_digest_files"])
    frontend_changed = bool(changed & frontend_files)
    manual = load_json(MANUAL_PATH)
    current_digest = digest_group(contracts["frontend_manual_digest_files"])
    recorded = manual.get("frontend_smoke", {})
    needs_frontend = frontend_changed or scope in {"frontend", "all"}
    if needs_frontend:
        max_age = contracts.get("manual_check_max_age_days", {}).get("frontend_smoke", 30)
        if current_manual_status(recorded, current_digest, max_age):
            results.append(Result("PASS", "frontend-browser-smoke", "Manual evidence matches frontend digest {}.".format(current_digest[:12])))
        else:
            results.append(Result("MANUAL_REQUIRED", "frontend-browser-smoke", "Run desktop/mobile local smoke and record digest {} in harness/manual-checks.json.".format(current_digest), True))
    else:
        results.append(Result("SKIPPED", "frontend-browser-smoke", "No frontend source changed."))

    paid_files = set(contracts["paid_flow_manual_digest_files"])
    paid_changed = bool(changed & paid_files)
    needs_paid = paid_changed or scope in {"worker", "database", "paid_flow", "deployment", "all"}
    if needs_paid:
        paid_digest = digest_group(contracts["paid_flow_manual_digest_files"])
        paid_record = manual.get("paid_flow_e2e", {})
        max_age = contracts.get("manual_check_max_age_days", {}).get("paid_flow_e2e", 90)
        evidence_status = current_manual_status(paid_record, paid_digest, max_age, ("pass", "waived"))
        if evidence_status == "pass":
            results.append(Result("PASS", "paid-flow-e2e", "Manual evidence matches paid-flow digest {}.".format(paid_digest[:12])))
        elif evidence_status == "waived":
            results.append(Result("SKIPPED", "paid-flow-e2e", "Digest-scoped waiver matches {}. This is not E2E proof; any paid-flow source change invalidates it.".format(paid_digest[:12])))
        else:
            blocking = bool(ci) or scope in {"paid_flow", "deployment"}
            results.append(Result("MANUAL_REQUIRED", "paid-flow-e2e", "Paid-flow source/scope needs an explicitly authorized production-like E2E or a narrowly justified digest waiver for {}. Do not claim deployment safety.".format(paid_digest), blocking))
    else:
        results.append(Result("SKIPPED", "paid-flow-e2e", "No paid-flow digest source changed and no high-risk scope was requested."))
    return results


def collect_verify(contracts, scope, ci=False, staged_only=False):
    results = []
    contract_results = check_contract_files(contracts)
    results.extend(contract_results)
    if any(item.status == "FAIL" for item in contract_results):
        return results
    if staged_only:
        results.extend(check_staged_integrity(contracts))
    results.extend(check_memory(contracts))
    results.extend(check_filesystem(contracts))
    results.extend(check_html(contracts))
    results.extend(check_markdown_links(contracts))
    results.extend(check_javascript(contracts))
    results.extend(check_javascript_tests(contracts))
    results.extend(check_invariants(contracts))
    results.extend(check_migrations(contracts))
    results.extend(check_git(staged_only=staged_only))
    results.extend(check_manual(contracts, scope, ci, staged_only=staged_only))
    return results


def print_results(results):
    for result in results:
        suffix = " [blocking]" if result.blocking and result.status in {"FAIL", "MANUAL_REQUIRED"} else ""
        print("[{}] {}{}: {}".format(result.status, result.name, suffix, result.message))
    counts = {status: sum(1 for item in results if item.status == status) for status in STATUS_ORDER}
    print("Summary: " + ", ".join("{}={}".format(key, counts[key]) for key in ("PASS", "FAIL", "MANUAL_REQUIRED", "SKIPPED")))


def has_blocker(results):
    return any(item.status == "FAIL" or (item.status == "MANUAL_REQUIRED" and item.blocking) for item in results)


def git_context():
    branch = run(["git", "branch", "--show-current"], timeout=10).stdout.strip() or "detached"
    head = run(["git", "rev-parse", "HEAD"], timeout=10).stdout.strip() or "unknown"
    status = run(["git", "status", "--porcelain=v1", "-uall"], timeout=30)
    lines = [line for line in status.stdout.splitlines() if line]
    return branch, head, lines


def record_session(session_id, branch, head, status_lines):
    if not session_id:
        return None
    safe_id = re.sub(r"[^A-Za-z0-9_.-]", "_", session_id)[:120]
    directory = ROOT / ".harness/sessions"
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / (safe_id + ".json")
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    payload = {
        "schema_version": 1,
        "session_id": session_id,
        "initial_branch": branch,
        "initial_head": head,
        "initial_status": status_lines,
        "created_at": now,
        "last_seen_at": now,
    }
    if path.is_file():
        try:
            old = load_json(path)
            payload["initial_branch"] = old.get("initial_branch", branch)
            payload["initial_head"] = old.get("initial_head", head)
            payload["initial_status"] = old.get("initial_status", status_lines)
            payload["created_at"] = old.get("created_at", now)
        except (OSError, ValueError):
            pass
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return relative(path)


def command_preflight(args, contracts):
    results = []
    contract_results = check_contract_files(contracts)
    results.extend(contract_results)
    if any(item.status == "FAIL" for item in contract_results):
        print_results(results)
        return 1
    results.extend(check_memory(contracts))
    branch, head, status_lines = git_context()
    results.append(Result("PASS", "git-baseline", "branch={}, HEAD={}, dirty entries={}".format(branch, head[:12], len(status_lines))))
    node = find_node()
    if node:
        results.append(Result("PASS", "tool-node", node))
    else:
        results.append(Result("MANUAL_REQUIRED", "tool-node", "Node is required before JavaScript verification.", True))
    results.append(Result("PASS", "tool-python", sys.executable + " " + sys.version.split()[0]))
    ffmpeg = shutil.which("ffmpeg")
    results.append(Result("PASS" if ffmpeg else "SKIPPED", "tool-ffmpeg", ffmpeg or "Needed only for media work."))
    hook_path = run(["git", "config", "--get", "core.hooksPath"], timeout=10).stdout.strip()
    if os.environ.get("CI"):
        results.append(Result("SKIPPED", "git-hook-install", "CI uses the GitHub workflow gate."))
    elif hook_path == ".githooks":
        results.append(Result("PASS", "git-hook-install", "core.hooksPath=.githooks"))
    else:
        results.append(Result("MANUAL_REQUIRED", "git-hook-install", "Run: git config core.hooksPath .githooks", False))
    recorded = record_session(args.session_id, branch, head, status_lines)
    if recorded:
        results.append(Result("PASS", "session-baseline", recorded))
    print_results(results)
    print("Read next: docs/PROJECT_STATE.md, docs/BACKLOG.md, and harness/routes.json.")
    return 1 if has_blocker(results) else 0


def command_verify(args, contracts):
    results = collect_verify(contracts, args.scope, args.ci, args.staged)
    print_results(results)
    return 1 if has_blocker(results) else 0


def command_live(args, contracts):
    site = contracts["production"]["site_url"] + "/"
    worker = contracts["production"]["worker_url"]
    targets = [
        ("site", site),
        ("worker", worker + "/api/health"),
        ("supabase", worker + "/api/health/supabase"),
        ("email-config", worker + "/api/health/email"),
        ("meta-config", worker + "/api/health/meta"),
    ]
    results = []
    for name, url in targets:
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "yle-harness/1.0"})
            with urllib.request.urlopen(request, timeout=args.timeout) as response:
                body = response.read(512 * 1024).decode("utf-8", errors="replace")
                ok = 200 <= response.status < 300
                if name != "site":
                    payload = json.loads(body)
                    ok = ok and payload.get("ok") is True
                results.append(Result("PASS" if ok else "FAIL", "live-" + name, "HTTP {}".format(response.status), not ok))
        except (urllib.error.URLError, ValueError, OSError) as error:
            results.append(Result("FAIL", "live-" + name, str(error), True))
    print_results(results)
    print("Live checks are read-only configuration/health evidence; they do not prove checkout, email delivery, or event receipt.")
    return 1 if has_blocker(results) else 0


def directory_size(path):
    total = 0
    if not path.exists():
        return total
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                pass
    return total


def human_bytes(value):
    amount = float(value)
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if amount < 1024 or unit == "TB":
            return "{:.1f} {}".format(amount, unit)
        amount /= 1024
    return str(value)


def command_maintenance(args, contracts):
    print("Active assets: {}".format(human_bytes(directory_size(ROOT / "assets"))))
    print("Local artifact archive: {}".format(human_bytes(directory_size(ROOT / "artifacts"))))
    print("Git directory: {}".format(human_bytes(directory_size(ROOT / ".git"))))
    count = run(["git", "count-objects", "-vH"], timeout=30)
    if count.returncode == 0:
        print(count.stdout.strip())
    print("Maintenance is report-only. It never prunes Git refs or deletes artifacts.")
    return 0


def command_digest(args, contracts):
    key = "{}_manual_digest_files".format(args.group)
    print(digest_group(contracts[key]))
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description="Your Love Element project Harness")
    sub = parser.add_subparsers(dest="command", required=True)

    preflight = sub.add_parser("preflight")
    preflight.add_argument("--session-id", default=os.environ.get("CODEX_SESSION_ID"))

    verify = sub.add_parser("verify")
    verify.add_argument("--scope", default="auto", choices=["auto", "all", "docs", "frontend", "tracking", "worker", "database", "paid_flow", "deployment", "social"])
    verify.add_argument("--ci", action="store_true")
    verify.add_argument("--staged", action="store_true", help="Verify the Git index and reject working-tree overlays")

    live = sub.add_parser("live")
    live.add_argument("--timeout", type=int, default=15)

    sub.add_parser("maintenance")

    digest = sub.add_parser("digest")
    digest.add_argument("--group", default="frontend", choices=["frontend", "paid_flow"])
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    try:
        contracts = load_json(CONTRACT_PATH)
    except (OSError, ValueError) as error:
        print("[FAIL] contracts: {}".format(error), file=sys.stderr)
        return 2

    schema_errors = contract_schema_errors(contracts)
    if schema_errors and args.command not in {"preflight", "verify"}:
        print("[FAIL] contracts-schema: {}".format("; ".join(schema_errors)), file=sys.stderr)
        return 2

    commands = {
        "preflight": command_preflight,
        "verify": command_verify,
        "live": command_live,
        "maintenance": command_maintenance,
        "digest": command_digest,
    }
    return commands[args.command](args, contracts)


if __name__ == "__main__":
    sys.exit(main())
