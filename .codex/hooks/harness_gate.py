#!/usr/bin/env python3
"""Codex lifecycle adapter for the repository Harness."""

import json
import os
from pathlib import Path
import subprocess
import sys


def read_payload():
    try:
        return json.load(sys.stdin)
    except (ValueError, OSError):
        return {}


def repository_root(cwd):
    try:
        completed = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return Path(cwd)
    if completed.returncode == 0:
        return Path(completed.stdout.strip())
    return Path(cwd)


def run_harness(root, arguments, timeout, extra_env=None):
    environment = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    environment.update(extra_env or {})
    command = [sys.executable, str(root / "scripts/harness.py")] + arguments
    try:
        return subprocess.run(
            command,
            cwd=str(root),
            env=environment,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(command, 124, stdout="Harness timed out after {} seconds.".format(timeout))
    except OSError as error:
        return subprocess.CompletedProcess(command, 126, stdout="Harness could not start: {}".format(error))


def session_baseline(root, session_id):
    if not session_id:
        return None
    safe_id = __import__("re").sub(r"[^A-Za-z0-9_.-]", "_", str(session_id))[:120]
    path = root / ".harness" / "sessions" / (safe_id + ".json")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    initial_head = str(payload.get("initial_head") or "").strip()
    return initial_head or None


def compact(text, limit=2400):
    text = text.strip()
    return text if len(text) <= limit else text[-limit:]


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    payload = read_payload()
    root = repository_root(payload.get("cwd") or str(Path.cwd()))

    if mode == "subagent-start":
        print(json.dumps({
            "systemMessage": "Your Love Element project Harness applies to this subagent.",
            "hookSpecificOutput": {
                "hookEventName": "SubagentStart",
                "additionalContext": "Read root AGENTS.md, docs/PROJECT_STATE.md, and the matching harness/routes.json scope before acting. History and artifacts are not current state."
            }
        }))
        return 0

    if mode == "session-start":
        arguments = ["preflight"]
        if payload.get("session_id"):
            arguments.extend(["--session-id", str(payload["session_id"])])
        completed = run_harness(root, arguments, timeout=50)
        passed = completed.returncode == 0
        context = (
            "Project Harness preflight passed. Read AGENTS.md, docs/PROJECT_STATE.md, "
            "docs/BACKLOG.md, and the relevant route before editing. Run verify before finishing."
            if passed
            else "Project Harness preflight failed. Limit work to diagnosing or repairing the Harness before unrelated changes.\n" + compact(completed.stdout)
        )
        output = {
            "continue": True,
            "hookSpecificOutput": {
                "hookEventName": "SessionStart",
                "additionalContext": context
            }
        }
        if not passed:
            output["systemMessage"] = "Your Love Element Harness preflight failed."
        print(json.dumps(output))
        return 0

    if mode == "stop":
        if payload.get("stop_hook_active"):
            print("{}")
            return 0
        extra_env = {}
        baseline = session_baseline(root, payload.get("session_id"))
        if baseline:
            extra_env["HARNESS_BASE_REF"] = baseline
        completed = run_harness(root, ["verify", "--scope", "auto"], timeout=100, extra_env=extra_env)
        if completed.returncode != 0:
            print(json.dumps({
                "decision": "block",
                "reason": "The project Harness has blocking failures. Fix the reported repository issue before stopping.\n" + compact(completed.stdout)
            }))
        else:
            print("{}")
        return 0

    print("{}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
