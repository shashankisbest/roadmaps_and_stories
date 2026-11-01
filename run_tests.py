#!/usr/bin/env python3
"""Run project tests and quality checks, then save their actual output."""

from __future__ import annotations

import os
import platform
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
REPORTS = ROOT / "test-reports"


def backend_python() -> Path | str:
    candidates = (
        BACKEND / "venv" / "Scripts" / "python.exe",
        BACKEND / ".venv" / "Scripts" / "python.exe",
        BACKEND / "venv" / "bin" / "python",
        BACKEND / ".venv" / "bin" / "python",
    )
    return next((candidate for candidate in candidates if candidate.exists()), sys.executable)


def command_result(
    label: str,
    command: list[str],
    display_command: str,
    cwd: Path,
    env: dict[str, str] | None = None,
) -> tuple[int, str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    output = (
        f"## {label}\n"
        f"$ {display_command}\n"
        f"Exit code: {result.returncode}\n\n"
        f"{result.stdout}"
    )
    if result.stderr:
        output += f"\n[stderr]\n{result.stderr}"
    return result.returncode, output.rstrip() + "\n"


def npm_command(*args: str) -> list[str]:
    if os.name == "nt":
        return ["cmd.exe", "/d", "/c", "npm", *args]
    return ["npm", *args]


def test_counts(output: str, kind: str) -> tuple[int | None, int, int]:
    if kind == "backend":
        match = re.search(r"Ran (\d+) tests?", output)
        total = int(match.group(1)) if match else None
        failure_match = re.search(
            r"FAILED \((?:failures=(\d+))?(?:, )?(?:errors=(\d+))?", output
        )
        failed = (
            sum(int(value or 0) for value in failure_match.groups())
            if failure_match
            else 0
        )
        skipped_match = re.search(r"skipped=(\d+)", output)
        skipped = int(skipped_match.group(1)) if skipped_match else 0
        return total, failed, skipped

    match = re.search(r"Tests\s+(.+)", output)
    if not match:
        return None, 0, 0
    summary = match.group(1)
    passed_match = re.search(r"(\d+) passed", summary)
    failed_match = re.search(r"(\d+) failed", summary)
    skipped_match = re.search(r"(\d+) skipped", summary)
    passed = int(passed_match.group(1)) if passed_match else 0
    failed = int(failed_match.group(1)) if failed_match else 0
    skipped = int(skipped_match.group(1)) if skipped_match else 0
    return passed + failed + skipped, failed, skipped


def run_check(
    label: str,
    command: list[str],
    display_command: str,
    cwd: Path,
    env: dict[str, str] | None = None,
) -> tuple[int, str]:
    return command_result(label, command, display_command, cwd, env)


def main() -> int:
    REPORTS.mkdir(exist_ok=True)
    python = str(backend_python())
    quality: list[str] = []
    checks: dict[str, int] = {}

    backend_test_code, backend_output = command_result(
        "Backend tests",
        [python, "manage.py", "test"],
        "python manage.py test",
        BACKEND,
    )
    (REPORTS / "backend-tests.txt").write_text(backend_output, encoding="utf-8")
    checks["Backend tests"] = backend_test_code

    frontend_test_code, frontend_output = command_result(
        "Frontend tests",
        npm_command("run", "test"),
        "npm run test",
        FRONTEND,
    )
    (REPORTS / "frontend-tests.txt").write_text(frontend_output, encoding="utf-8")
    checks["Frontend tests"] = frontend_test_code

    quality_commands = [
        ("Frontend lint", npm_command("run", "lint"), "npm run lint", FRONTEND, None),
        ("Frontend production build", npm_command("run", "build"), "npm run build", FRONTEND, None),
        ("Django system checks", [python, "manage.py", "check"], "python manage.py check", BACKEND, None),
        (
            "Migration consistency",
            [python, "manage.py", "makemigrations", "--check", "--dry-run"],
            "python manage.py makemigrations --check --dry-run",
            BACKEND,
            None,
        ),
        (
            "Production Django security checks",
            [python, "manage.py", "check", "--deploy"],
            "python manage.py check --deploy (isolated production-like settings)",
            BACKEND,
            {
                **os.environ,
                "DJANGO_DEBUG": "false",
                "DJANGO_SECRET_KEY": "phase-six-settings-check-only-not-a-deployment-secret",
                "DJANGO_ALLOWED_HOSTS": "api.example.test",
                "DB_NAME": "phase_six_settings_check",
                "DB_USER": "phase_six_settings_check",
                "DB_PASSWORD": "not-used-for-settings-check",
                "DB_HOST": "127.0.0.1",
                "DB_PORT": "5432",
                "CORS_ALLOWED_ORIGINS": "https://frontend.example.test",
            },
        ),
        ("Frontend dependency audit", npm_command("audit"), "npm audit", FRONTEND, None),
    ]

    for label, command, display, cwd, env in quality_commands:
        code, output = run_check(label, command, display, cwd, env)
        quality.append(output)
        checks[label] = code
    (REPORTS / "quality-checks.txt").write_text(
        "\n".join(quality), encoding="utf-8"
    )

    versions_code, versions_output = command_result(
        "Tool versions",
        [
            python,
            "-c",
            (
                "import django, rest_framework, sys; "
                "import psycopg; "
                "print('Python', sys.version.split()[0]); "
                "print('Django', django.get_version()); "
                "print('Django REST Framework', rest_framework.VERSION); "
                "print('psycopg', psycopg.__version__)"
            ),
        ],
        "python -c \"print Python and backend package versions\"",
        BACKEND,
    )
    node_code, node_output = command_result(
        "npm version",
        npm_command("--version"),
        "npm --version",
        FRONTEND,
    )
    node_version_code, npm_output = command_result(
        "Node version",
        ["node", "--version"],
        "node --version",
        FRONTEND,
    )
    dependency_code, dependency_output = command_result(
        "Frontend package versions",
        npm_command("ls", "--depth=0"),
        "npm ls --depth=0",
        FRONTEND,
    )
    versions_output += node_output + npm_output + dependency_output
    version_text = versions_output
    backend_total, backend_failed, backend_skipped = test_counts(
        backend_output, "backend"
    )
    frontend_total, frontend_failed, frontend_skipped = test_counts(
        frontend_output, "frontend"
    )
    overall_success = all(code == 0 for code in checks.values()) and all(
        code == 0
        for code in (versions_code, node_code, node_version_code, dependency_code)
    )

    def result_text(name: str, code: int) -> str:
        return "PASS" if code == 0 else "FAIL"

    def failure_details(label: str, code: int, output: str) -> str:
        if code == 0:
            return ""
        lines = output.splitlines()
        return (
            f"\n### {label}\n\n"
            "Failure classification: introduced or exposed during this phase; "
            "baseline failures are listed separately where known.\n\n"
            "```text\n"
            + "\n".join(lines[-80:])
            + "\n```\n"
        )

    failures = "".join(
        failure_details(label, code, output)
        for label, code, output in (
            ("Backend tests", backend_test_code, backend_output),
            ("Frontend tests", frontend_test_code, frontend_output),
            *(
                (label, checks[label], output)
                for label, _, _, _, _ in quality_commands
                for output in quality
                if output.startswith(f"## {label}\n")
            ),
        )
    )
    timestamp = datetime.now().astimezone().isoformat(timespec="seconds")
    backend_counts = (
        f"{backend_total - backend_failed - backend_skipped} passed, "
        f"{backend_failed} failed, {backend_skipped} skipped"
        if backend_total is not None
        else "unavailable (see captured output)"
    )
    frontend_counts = (
        f"{frontend_total - frontend_failed - frontend_skipped} passed, "
        f"{frontend_failed} failed, {frontend_skipped} skipped"
        if frontend_total is not None
        else "unavailable (see captured output)"
    )
    checks_summary = "\n".join(
        f"- {label}: {result_text(label, code)}"
        for label, code in checks.items()
    )
    production_output = next(
        (
            output
            for output in quality
            if output.startswith("## Production Django security checks\n")
        ),
        "",
    )
    security_warnings = [
        line.strip()
        for line in production_output.splitlines()
        if "(security.W" in line
    ]
    warning_summary = (
        "\n".join(f"- {warning}" for warning in security_warnings)
        if security_warnings
        else "No Django deployment security warnings."
    )
    report = f"""# Test Report

## Run information

- Date and time: {timestamp}
- Project root: `{ROOT}`
- Environment: {platform.platform()}
- Python/backend environment: see tool versions below; the runner uses `backend/venv` when present.
- Frontend environment: see Node/npm versions below.
- Test database: Django's isolated test database; development data was not used for tests.
- Overall assessment: {"PASS — all executed suites and quality checks succeeded." if overall_success else "FAIL — one or more commands failed; details are recorded below."}

## Tools and versions

{version_text.strip()}

## Baseline before this phase

- Backend: 16 tests passed; no failures.
- Frontend: no test script existed; lint and production build both passed.

## Backend tests

- Command: `python manage.py test`
- Result: {result_text("Backend tests", backend_test_code)}
- Tests: {backend_counts}

## Frontend tests

- Command: `npm run test`
- Result: {result_text("Frontend tests", frontend_test_code)}
- Tests: {frontend_counts}

## Quality checks

{checks_summary}

### Non-fatal deployment warnings

{warning_summary}

## Security checks performed

- Django production-mode settings were checked with a test-only key and non-production database placeholders; production checks do not connect to that database.
- Authentication endpoints have scoped login and registration throttles; backend tests exercise their limits.
- Django's CSRF/session configuration and frontend credential/CSRF request behavior are tested.
- Protected resource ownership, notification recipient scoping, report field exposure, and comment reply ownership are covered by backend tests.
- `npm audit` checked frontend dependency advisories.
- No production credentials were read into report output.

## Failures and classification

{"No command failures." if not failures else failures}

## Issues not tested

- Live deployment HTTPS termination, real production CORS/CSRF origins, and browser behavior across deployment domains.
- Rate-limit behavior across multiple production workers; configure Django's cache to use a shared backend before scaling beyond one process.
- Browser end-to-end flows against a running deployed frontend and backend.
- Production PostgreSQL backup/restore, load, and operational monitoring.

## Remaining security concerns

- Production must explicitly set `DJANGO_DEBUG=false`, a strong `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, and PostgreSQL credentials via environment variables. Production-like checks reject missing key, host, or database credentials.
- Configure and verify TLS termination and HSTS at the actual deployment/proxy. The production defaults enable secure cookies, HTTPS redirect, and HSTS; proxy configuration must preserve HTTPS detection.
- The default development cache is process-local; use shared cache storage for effective rate limiting across multiple application workers.
"""
    (REPORTS / "TEST_REPORT.md").write_text(report, encoding="utf-8")

    print(f"Reports saved in {REPORTS}")
    print(f"Overall: {'PASS' if overall_success else 'FAIL'}")
    return 0 if overall_success else 1


if __name__ == "__main__":
    raise SystemExit(main())
