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

Fifteen unit tests cover mission state, adapters, errors, timeout/cancellation, request sharing, fallback/retry, and storage retention. tests/mission-browser.mjs exercises Phase 4 flows; tests/api-browser.mjs exercises API content, delayed loading, fallback, empty/malformed responses, request counts, and mobile notices. Both require an isolated Chrome debugging session on port 9338. Keep its profile outside the source tree; scripts clear that profile's storage. MISSION_TEST_URL overrides the default http://localhost:3010.

See [PHASE_5.md](PHASE_5.md) for the complete implementation report and file inventory, and [PHASE_4.md](PHASE_4.md) for the previous local mission system.
