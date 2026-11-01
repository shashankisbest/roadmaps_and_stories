# Test reports

From the project root, run:

```powershell
python run_tests.py
```

The script selects `backend/venv` when available (otherwise it uses the active
Python interpreter), then runs the Django test suite, frontend tests, frontend
lint/build, Django system and migration checks, production-mode Django security
checks, and `npm audit`.

It captures each command's actual output in `backend-tests.txt`,
`frontend-tests.txt`, and `quality-checks.txt`, and regenerates
`TEST_REPORT.md`. It returns a nonzero exit code if any command fails. The
backend tests use Django's isolated test database. The production-mode check
uses test-only settings and placeholder database values; it does not connect to
a production database or read credentials into the reports.

The `security-audit.md` file records the code/configuration review and security
changes for this phase. Install backend requirements and run `npm ci` in
`frontend/` before running the script if dependencies are not already present.
