# Interstellar

An interactive Next.js / React Three Fiber solar system with Sun, Earth, Mars, scientific profiles, explicit camera travel, and local mission progress.

Phase 5 connects the isolated Laravel catalog API at C:/laragon/www/interstellar-api. Mission progress remains browser-local; the backend only publishes body and mission definitions.

## Run locally

Start the backend in another terminal from C:/laragon/www/interstellar-api:

    php artisan migrate --seed --no-interaction
    php artisan serve --host=127.0.0.1 --port=8000 --no-interaction

The backend uses its own database/database.sqlite. Preserve existing environment files and never reset unrelated databases. See its README for clean setup instructions.

Create .env.local from .env.example only if missing:

    NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api

This public value is compiled into the browser bundle. Restart development or rebuild production after changing it. Use a deployed HTTPS API origin in production. If omitted or unavailable, the app uses its existing local body and mission catalog.

Run the frontend:

    npm.cmd run dev

The default origin is http://localhost:3000. Browser regression scripts also support a server on port 3010, included in the backend development CORS allowlist.

## Data behavior

The local scene renders immediately during API loading. A shared provider requests bodies and missions once, validates both, and publishes a consistent catalog. Successful empty data shows an empty notice. Invalid or unavailable data switches to a labeled local fallback. Retry is explicit. Panels, selection, camera controls, and localStorage progress stay independent of network availability.

## Validation

    npm.cmd run lint
    npx.cmd tsc --noEmit
    npm.cmd test
    npm.cmd run build

Sixteen unit tests cover mission state, versioned requests, adapters, errors, timeout/cancellation, request sharing, fallback/retry, and storage retention. The client appends `/v1` to the configured `/api` base; do not include `/v1` in the environment value. Legacy backend `/api` routes remain available.

Run `node tests/run-browser.mjs` for the production build and both browser suites with a new temporary SQLite database and Chrome profile. It requires PHP, installed backend dependencies, and Chrome. It refuses occupied ports (3010, 8016, 9338), never migrates the development database, and stops its servers on completion. It runs mission regressions with the isolated API online and again after stopping it. Screenshots remain in the printed temporary directory for review. See [PHASE_6.md](PHASE_6.md) for configuration overrides, exact coverage, deployment steps, and validation results.

See [PHASE_5.md](PHASE_5.md) for the complete implementation report and file inventory, and [PHASE_4.md](PHASE_4.md) for the previous local mission system.

## Production configuration

Use the existing Node server deployment (`npm ci`, `npm run build`, `npm run start`) behind an HTTPS reverse proxy. Set `NEXT_PUBLIC_API_BASE_URL=https://api.example.com/api` **before building**, replacing the example host. This browser-visible address must be reachable by users; localhost points to the user's computer. Keep application keys, database paths, credentials, and other backend settings exclusively on the backend. Changing the public URL requires a new build. The frontend needs no backend secret. See [PHASE_6.md](PHASE_6.md) for Laravel configuration, persistence, backup, and rollout guidance. No production hosting environment has been verified.
