# Browser smoke E2E

The smoke suite uses the real Next.js app, NestJS API, and an isolated
PostgreSQL database. It covers login, public tournament rendering, approved
registration visibility, bracket results, and admin report review.

Set `E2E_DATABASE_URL` to a database or schema whose name contains `e2e` or
`test`, then run:

```powershell
$env:E2E_DATABASE_URL = "postgresql://user:password@localhost:5432/arenaverse_e2e?schema=public"
npm run test:e2e
```

The runner applies migrations and resets the selected E2E database before
each run. It refuses to seed a URL without the `e2e`/`test` marker. Never point
this command at development or production data.
