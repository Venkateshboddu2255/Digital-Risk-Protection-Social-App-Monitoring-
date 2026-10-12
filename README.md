# BrandShield AI — Digital Risk Protection

A MERN-stack hackathon prototype for monitoring potential brand impersonation across social profiles and mobile app listings.

## Features

- Brand profiles: company name, website, logo URL, keywords, official social accounts, official apps, trusted publisher and package IDs.
- Social monitoring: sample/imported candidate profiles, name similarity, bio/keyword context, suspicious links, logo signal fields, explainable scoring.
- App monitoring: app name, developer/publisher, package ID, store URL, description and icon signal fields.
- Official-asset exclusion: exact registered social URLs/account IDs and app package IDs/store URLs can be excluded from alerts.
- Look-alike matching: normalization, Levenshtein similarity, spacing/punctuation variation, added words, and basic Unicode confusable handling.
- Threat dashboard: counts, risk bands, source/type filters, review status, evidence, and CSV export.
- Sample dataset for a repeatable demo.
- Authentication: registration, login, secure HTTP-only session cookie, logout, and current-user session check.
- Role-based authorization: `analyst` and `admin` roles; administrator-only user listing and brand update/delete actions.
- Architecture diagram and test checklist.

## Important prototype limitations

The built-in scanner uses local demo records and user-imported candidate records. It does not silently scrape social platforms or app stores. Real-world monitoring requires approved APIs, permitted public datasets, credentials, and compliance with each source's terms. Risk scores are prioritization signals, not proof that an account/app is malicious. Review findings before taking action.

## Requirements

- Node.js 20+ recommended
- npm
- MongoDB Community Server running locally, or MongoDB Atlas

## 1. Configure the backend

Open a terminal in `backend`:

```bash
npm install
```

Copy `.env.example` to `.env`, then adjust if needed:

Windows CMD:
```bat
copy .env.example .env
```

PowerShell:
```powershell
Copy-Item .env.example .env
```

Default local configuration is provided in `.env.example`. After copying it to `.env`, **change `JWT_SECRET` to a random secret of at least 32 characters and change `ADMIN_PASSWORD` to a unique password of at least 12 characters**. Keep `.env` private and never commit it.

```env
PORT=5001
MONGODB_URI=mongodb://127.0.0.1:27017/brandshield
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=your-long-random-secret-at-least-32-characters
ADMIN_NAME=BrandShield Administrator
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-unique-admin-password
NODE_ENV=development
```

## 2. Configure and run the frontend

Open a second terminal in `frontend`:

```bash
npm install
```

Copy `.env.example` to `.env` if desired. Default API URL is `http://localhost:5001/api`.

## 3. Create an administrator account (optional but recommended)

With MongoDB running and the backend `.env` filled with your own `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`, run this from the `backend` folder:

```bash
npm run create-admin
```

The command creates or updates the configured administrator account. Do not use the example password in a real environment. Normal sign-ups always receive the `analyst` role; the registration form cannot grant itself administrator access.

## 4. Start the application

Terminal 1:
```bash
cd backend
npm run dev
```

Terminal 2:
```bash
cd frontend
npm run dev
```

Open the Vite URL printed in the terminal, usually http://localhost:5173.

## 5. Authentication and authorization workflow

1. Open the frontend URL and choose **Create account** to register an analyst account, or sign in with the admin credentials configured above.
2. Registration and login set an HTTP-only cookie; the browser JavaScript cannot read the session token. Sessions expire after eight hours.
3. Click **Logout** to clear the session cookie and return to the login screen.
4. All brand, scan, threat, and dashboard APIs require a valid session. `GET /api/health` remains public for service health checks.
5. Analysts can view profiles, create brand profiles, run scans, and update threat statuses. Admins can also list users and update/delete brand profiles.

## 6. Demo workflow

1. Create a brand profile, e.g. `NovaPay Demo`.
2. Add an official social account URL/account ID and an official app package ID if you have a real test asset. For the fictional demo brand, use clearly fictional test identifiers.
3. Open Social Monitoring and run a sample scan.
4. Open App Monitoring and run a sample scan.
5. Review the alerts and their evidence/risk score.
6. Change a finding's status to `Under Review`, `Resolved`, or `Dismissed`.
7. Export the threats to CSV.

Sample results are explicitly labeled as demo data. Do not represent them as live platform findings.

## API overview

- `GET /api/health` — public API/database health
- `POST /api/auth/register` — create an analyst account
- `POST /api/auth/login` — sign in
- `POST /api/auth/logout` — clear the session cookie
- `GET /api/auth/me` — current signed-in user
- `GET /api/auth/users` — administrator-only user list
- `GET /api/brands` — list brands
- `POST /api/brands` — create brand
- `GET /api/brands/:id` — get a brand
- `PUT /api/brands/:id` — update a brand
- `DELETE /api/brands/:id` — delete a brand
- `GET /api/threats` — list/filter threats
- `PATCH /api/threats/:id/status` — update review status
- `POST /api/scans/social` — run social demo/import scan for a brand
- `POST /api/scans/apps` — run app demo/import scan for a brand
- `GET /api/dashboard` — dashboard summary

For `POST /api/scans/social` and `POST /api/scans/apps`, JSON body:
```json
{
  "brandId": "MONGODB_BRAND_ID",
  "source": "demo"
}
```

To scan provided candidate records instead, pass `"source":"custom"` and a `candidates` array. See the in-app scanner page and backend routes for fields.

## Security notes before public deployment

Authentication and role checks are implemented for this prototype. Before exposing it publicly:
- Use HTTPS and configure exact CORS origins; set `NODE_ENV=production` so session cookies use the `Secure` flag.
- Use rate limiting and audit logs.
- Validate uploaded images and store them safely (the current prototype accepts logo/icon URLs, not file uploads).
- Store secrets in host environment variables, never in Git.
- Use source-specific API credentials and respect platform policies.
- Add pagination, retention controls, monitoring, and production-grade error handling.

## Architecture

See `docs/architecture.md` and `docs/architecture.mmd`.
