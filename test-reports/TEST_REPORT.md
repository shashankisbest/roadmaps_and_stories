# Test Report

## Run information

- Date and time: 2026-10-30T19:18:14+05:30
- Project root: `C:\SHASHANK\PROJECTS\roadmaps_stories`
- Environment: Windows-11-10.0.26200-SP0
- Python/backend environment: see tool versions below; the runner uses `backend/venv` when present.
- Frontend environment: see Node/npm versions below.
- Test database: Django's isolated test database; development data was not used for tests.
- Overall assessment: PASS — all executed suites and quality checks succeeded.

## Tools and versions

## Tool versions
$ python -c "print Python and backend package versions"
Exit code: 0

Python 3.14.0
Django 6.1.2
Django REST Framework 3.18.3
psycopg 3.3.6
## npm version
$ npm --version
Exit code: 0

10.9.3
## Node version
$ node --version
Exit code: 0

v22.20.0
## Frontend package versions
$ npm ls --depth=0
Exit code: 0

frontend@0.0.0 C:\SHASHANK\PROJECTS\roadmaps_stories\frontend
+-- @eslint/js@10.0.1
+-- @testing-library/jest-dom@7.0.1
+-- @testing-library/react@16.3.3
+-- @testing-library/user-event@14.6.8
+-- @types/react-dom@19.3.0
+-- @types/react@19.3.0
+-- @vitejs/plugin-react@6.1.2
+-- @xyflow/react@12.12.0
+-- eslint-plugin-react-hooks@7.1.1
+-- eslint-plugin-react-refresh@0.5.7
+-- eslint@10.12.0
+-- globals@17.13.0
+-- jsdom@29.1.1
+-- react-dom@19.3.0
+-- react@19.3.0
+-- vite@8.3.3
`-- vitest@5.0.5

## Baseline before this phase

- Backend: 16 tests passed; no failures.
- Frontend: no test script existed; lint and production build both passed.

## Backend tests

- Command: `python manage.py test`
- Result: PASS
- Tests: 24 passed, 0 failed, 0 skipped

## Frontend tests

- Command: `npm run test`
- Result: PASS
- Tests: 10 passed, 0 failed, 0 skipped

## Quality checks

- Backend tests: PASS
- Frontend tests: PASS
- Frontend lint: PASS
- Frontend production build: PASS
- Django system checks: PASS
- Migration consistency: PASS
- Production Django security checks: PASS
- Frontend dependency audit: PASS

### Non-fatal deployment warnings

- ?: (security.W005) You have not set the SECURE_HSTS_INCLUDE_SUBDOMAINS setting to True. Without this, your site is potentially vulnerable to attack via an insecure connection to a subdomain. Only set this to True if you are certain that all subdomains of your domain should be served exclusively via SSL.
- ?: (security.W021) You have not set the SECURE_HSTS_PRELOAD setting to True. Without this, your site cannot be submitted to the browser preload list.

## Security checks performed

- Django production-mode settings were checked with a test-only key and non-production database placeholders; production checks do not connect to that database.
- Authentication endpoints have scoped login and registration throttles; backend tests exercise their limits.
- Django's CSRF/session configuration and frontend credential/CSRF request behavior are tested.
- Protected resource ownership, notification recipient scoping, report field exposure, and comment reply ownership are covered by backend tests.
- `npm audit` checked frontend dependency advisories.
- No production credentials were read into report output.

## Failures and classification

No command failures.

## Issues not tested

- Live deployment HTTPS termination, real production CORS/CSRF origins, and browser behavior across deployment domains.
- Rate-limit behavior across multiple production workers; configure Django's cache to use a shared backend before scaling beyond one process.
- Browser end-to-end flows against a running deployed frontend and backend.
- Production PostgreSQL backup/restore, load, and operational monitoring.

## Remaining security concerns

- Production must explicitly set `DJANGO_DEBUG=false`, a strong `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, and PostgreSQL credentials via environment variables. Production-like checks reject missing key, host, or database credentials.
- Configure and verify TLS termination and HSTS at the actual deployment/proxy. The production defaults enable secure cookies, HTTPS redirect, and HSTS; proxy configuration must preserve HTTPS detection.
- The default development cache is process-local; use shared cache storage for effective rate limiting across multiple application workers.
