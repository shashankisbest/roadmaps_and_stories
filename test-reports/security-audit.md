# Security audit and implementation

## Project and architecture inventory

- **Backend:** Django 6.1.2, Django REST Framework 3.18.3, django-cors-headers
  4.9.0, psycopg 3.3.6, and python-dotenv 1.2.4, running on Python 3.14.0.
  PostgreSQL is configured as the default database. Django apps are `users`,
  `posts`, `comments`, `notifications`, and `reports`, with project routing and
  settings in `config/`.
- **Frontend:** React 19.3.0 and React DOM 19.3.0, Vite 8.3.3, and
  `@xyflow/react` 12.12.0. `src/api/client.ts` is the existing API client;
  authentication uses `AuthProvider` and the existing Django session.
- **Authentication:** Django session authentication, Django's built-in password
  hashers, username-or-email backend, CSRF-protected registration/login/logout,
  HttpOnly session cookie, and CSRF token returned through the existing API.
  The frontend sends credentials and `X-CSRFToken`; it does not persist bearer
  tokens. No JWT or token-authentication implementation exists.
- **Tests before this phase:** 16 Django tests; no frontend test runner or
  frontend component tests. Django `TestCase` uses Django's test database
  behavior; no test targets the development database directly.

## API inventory

| Route | Methods | Access |
|---|---|---|
| `/api/health/` | GET | Public; reports status without disclosing the database name |
| `/api/auth/csrf/` | GET | Public |
| `/api/auth/register/` | POST | Public; CSRF protected and rate limited |
| `/api/auth/login/` | POST | Public; CSRF protected and rate limited |
| `/api/auth/current-user/` | GET | Public; returns only the current session's user |
| `/api/auth/logout/` | POST | Authenticated; CSRF protected |
| `/api/roadmaps/`, `/api/stories/`, `/api/posts/` | GET | Public, page-number paginated |
| `/api/roadmaps/<id>/`, `/api/stories/<id>/` | GET, PUT, DELETE | Public read; owner-only mutations |
| `/api/posts/create/` | POST | Authenticated |
| `/api/posts/<id>/comments/` | GET, POST | Public read; authenticated creation |
| `/api/comments/<id>/` | DELETE | Comment author only |
| `/api/posts/<id>/like/` | POST, DELETE | Authenticated; acting user comes from the session |
| `/api/profiles/<username>/` | GET | Public |
| `/api/profiles/<username>/follow/` | POST, DELETE | Authenticated; acting user comes from the session |
| `/api/notifications/` | GET | Authenticated and recipient scoped |
| `/api/reports/` | POST | Authenticated; reporter is assigned from the session |
| `/admin/` | Django admin | Django admin authentication |

## Data models and relationships

- `Profile` is one-to-one with Django's user; `Follow` links two users, has a
  unique pair constraint, and prohibits self-following.
- `Post` belongs to an optional author and is a roadmap or story. `Roadmap` and
  `Story` are one-to-one post subtypes. `StoryRoadmap` links a story to one
  roadmap. `Tag` and `PostTag` provide many-to-many tagging; `Like` links users
  to posts with a unique user/post constraint.
- `Comment` belongs to a post and optional author, and may reference a parent
  comment for nested replies. API validation prevents replies across posts.
- `Notification` belongs to a recipient and may reference an actor, post, and
  comment. `Report` belongs to an optional reporter and database constraints
  require exactly one post, comment, or account target.

## Findings and changes

| Severity | Finding | Resolution |
|---|---|---|
| High | A hard-coded fallback `SECRET_KEY` could be used if production configuration was incomplete. | Production mode now fails startup without `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`, and PostgreSQL credentials; `*` is rejected in production hosts. The development fallback remains restricted to `DEBUG=true`. |
| Medium | Local-network CORS regexes and defaults were included regardless of deployment mode. | Local origins and LAN regexes are only enabled in debug mode. Production uses explicit `CORS_ALLOWED_ORIGINS` and no origin regex. |
| Medium | Login and registration had no request throttles. | DRF scoped throttles limit login to 10/minute and registration to 5/hour. Tests verify HTTP 429 after the configured limits. |
| Low | The public health endpoint returned the PostgreSQL database name. | The endpoint now checks connectivity with `SELECT 1` and returns only `{"status": "ok"}` or `{"status": "error"}`. |
| High (dependency audit) | `npm audit` identified transitive Zod versions below 4.6.6 through `eslint-plugin-react-hooks`. | Ran the compatible `npm audit fix`; the lockfile now resolves a patched version and the final full audit is recorded in `quality-checks.txt`. |

## Controls verified

- ORM-based lookups are used for application queries; no raw user-controlled SQL
  or `.extra()` use was identified in application code.
- The roadmap preview accepts only base64 PNG data, validates signature and
  dimensions, and applies a 3 MB limit. No generic user-upload API is exposed.
- User text is rendered through ordinary React text nodes; the source scan found
  no use of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `new Function`.
- DRF serializers validate post, comment, and report inputs. Password creation
  uses Django's password hashing. API serializers omit password hashes and
  report/notification ownership fields.
- Write ownership is derived from `request.user`; tests cover post/comment
  ownership, recipient-scoped notifications, and authenticated report creation.
- Public feeds use pagination. Frontend API tests cover pagination responses,
  CSRF setup, session credentials, and API error formatting. Component tests
  also exercise roadmap/story cards, related-story and roadmap navigation,
  nested comment rendering, authentication state, and comment form validation.
- Development configuration keeps local defaults. Production mode enables
  secure cookies, HTTPS redirect, and HSTS by default and requires explicit
  key/host/database settings.

## Remaining deployment risks and limitations

- The default cache is process-local. Configure a shared Django cache (such as
  the deployment's supported Redis/cache service) for throttling across
  multiple workers; per-process counters are not a distributed abuse defense.
- Confirm HTTPS termination and proxy HTTPS forwarding in the real deployment.
  HSTS duration and secure-cookie behavior should be checked against the
  production domain before rollout.
- Django's production check reports W005 and W021 because HSTS is not extended
  to every subdomain and preload is not enabled. These flags are intentionally
  left off until the domain owner confirms that all subdomains support HTTPS
  and that the domain should be submitted to the preload list.
- `DJANGO_DEBUG` defaults to local-development mode for compatibility; every
  production environment must explicitly set `DJANGO_DEBUG=false`.
- No deployed environment was available to verify live CORS/CSRF domains, TLS,
  rate-limit behavior across workers, or operational controls such as backups,
  monitoring, and traffic-level denial-of-service mitigation.

Command outputs and executed test results are in `TEST_REPORT.md`,
`backend-tests.txt`, `frontend-tests.txt`, and `quality-checks.txt`.
