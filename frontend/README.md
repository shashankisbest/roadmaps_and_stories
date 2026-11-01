# Roadmaps & Stories frontend

The UI reads roadmaps, stories, profiles, and comments from the Django REST API.
Copy `.env.example` to `.env.local` if the API is not at the default
`http://localhost:8000/api/`. Open the frontend at `http://localhost:5173` and use
`localhost` (not `127.0.0.1`) for both frontend and backend in local development so
session and CSRF cookies remain same-site.

Start the backend following [the backend setup guide](../backend/README.md), then run
these commands from this folder:

```powershell
npm install
npm run dev
```

Run `npm run lint` and `npm run build` to validate the frontend.
Run `npm run test` to execute the Vitest/React Testing Library unit and component
tests. From the project root, `python run_tests.py` runs the full test and
quality-check workflow and captures reports under `test-reports/`.
