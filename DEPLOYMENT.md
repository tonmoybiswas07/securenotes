# Deployment: separate frontend and backend

This submission uses two GitHub repositories and two Vercel projects. MongoDB
Atlas stores all users, notes, and posts.

| Item | URL |
| --- | --- |
| Frontend source | https://github.com/tonmoybiswas07/securenotes-frontend |
| Backend source | https://github.com/tonmoybiswas07/securenotes |
| Frontend live | https://securenotes-frontend-liard.vercel.app |
| Backend live | https://securenotes-api-rho.vercel.app |
| Database health | https://securenotes-api-rho.vercel.app/api/health |

## Backend project

Import the backend GitHub repo into Vercel with the Express framework. This repo's
`vercel.json` supplies the build settings. `src/app.ts` exports the Express app;
`src/server.ts` is the local persistent-server entry point.

- Install: `npm ci --include=dev`
- Build: `npm run build`
- Node: 24.x
- `MONGODB_URI`: actual Atlas URI, configured as a production secret
- `JWT_SECRET`: separate production signing secret, at least 32 characters
- `CLIENT_ORIGIN`: `https://securenotes-frontend-liard.vercel.app`
- `TRUST_PROXY_HOPS`: `1` for this deployment's proxy boundary; `0` locally

The database connection and index initialization are shared within a warm function
instance. API handlers wait for initialization, including after cold starts.
`/api/health` checks that initialization succeeded. Requests still depend on Atlas
availability. Atlas Network Access must permit the deployment's outbound traffic.
Do not commit actual environment values or `.vercel/` metadata.

Vercel controls HTTP invocation; no public port needs configuring. If moving to a
persistent host such as Render, use `npm start`; the local server reads `PORT`.

## Frontend project

Import the independent frontend repository as a second Vercel project. Its own
`vercel.json` configures `npm run build` and output directory `dist`.

Set `PUBLIC_API_BASE_URL=https://securenotes-api-rho.vercel.app/api` in production.
The build writes this public URL to `config.js`. Database credentials and signing
secrets are never needed by the frontend. If URLs change, update this value and
the backend's `CLIENT_ORIGIN`, then redeploy both affected projects.

Production environment changes apply on the next deployment. Both projects are
connected to their own GitHub repositories for later deployments from `main`.

## Run locally for the interview

Backend terminal:

```sh
npm install
# Set .env with your own Atlas URI and JWT_SECRET; CLIENT_ORIGIN=http://localhost:5173
npm run dev
```

Frontend terminal (its own checkout):

```sh
cp .env.example .env
npm run dev
```

The backend is at http://localhost:5001 and the frontend at http://localhost:5173.
In the original working directory, the separate frontend checkout is `frontend/`;
that folder is ignored by the parent backend repository.

## Admin setup

Run `npm run seed:admin` locally with `ADMIN_EMAIL` and `ADMIN_PASSWORD` set in the
backend `.env` and the same Atlas database URI as production. The script creates a
new account and refuses to overwrite an existing account. Never publish admin
credentials. Browser refresh signs out because JWTs live only in memory.

## Verification and limits

Integration tests use a temporary replica set, not Atlas. Public production HTTP
checks verify frontend assets, API configuration, health, and public posts. A
short-lived deployment-check account verifies live registration, authenticated
note CRUD, role denial, and `$lookup`; its account and content are removed afterward.
Browser click-through QA has not been performed.

Rate limits currently use in-process memory, so limits are not shared across
serverless instances and reset on restarts. A durable rate-limit store is a future
production improvement. Password changes do not revoke already-issued tokens;
they expire within one hour. See the README for index and pagination tradeoffs.

## References

- https://vercel.com/docs/frameworks/backend/express
- https://www.mongodb.com/docs/atlas/security/ip-access-list/
