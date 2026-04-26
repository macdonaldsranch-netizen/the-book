# The Book — Reservation Management System

A full-stack reservation and staff scheduling app for **McDonald's Ranch**, built on React, Node.js, Firebase Hosting, Cloud Firestore, and Firebase Auth.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, single-page app |
| Backend API | Node.js + Express (Firebase Cloud Functions) |
| Database | Cloud Firestore |
| Authentication | Firebase Auth (email/password + custom role claims) |
| Hosting | Firebase Hosting |
| Python backend (local dev alt.) | FastAPI + `backend/main.py` |

---

## Project structure

```
the-book-cloud/
├── firebase.json               ← Hosting + Firestore + Functions config
├── firestore.rules             ← Role-based Firestore security rules
├── firestore.indexes.json      ← Composite indexes
├── functions/
│   ├── index.js                ← Express API (all endpoints, Node.js)
│   └── package.json
├── backend/
│   ├── main.py                 ← FastAPI app (Python, for local dev / Cloud Run)
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── setup_firebase.py       ← One-time admin user seeder
│   └── .env.example            ← Copy to .env and fill in values
└── frontend/
    ├── package.json
    └── src/
        ├── firebase.js         ← ⚠ Fill in Firebase web config (see setup)
        ├── api.js              ← Auth-aware API client
        └── App.js              ← Full React application
```

---

## One-time setup

### Step 1 — Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com) and open (or create) the project
2. **Authentication** → Sign-in method → Enable **Email/Password**
3. **Firestore** → Create database → Production mode → Region: `us-central1`
4. **Project Settings → Service accounts** → Generate new private key → save as `backend/serviceAccountKey.json` (never commit this file — it is gitignored)
5. **Project Settings → General → Your apps** → Add a Web app → copy the `firebaseConfig` snippet into `frontend/src/firebase.js`

### Step 2 — Update project references

Replace every occurrence of `the-book-786` with your Firebase project ID in:

| File | Field |
|---|---|
| `frontend/src/firebase.js` | Full `firebaseConfig` object |
| `.firebaserc` | `"default"` project |
| `backend/.env` | `FIREBASE_PROJECT_ID` |
| `backend/main.py` | CORS origins + fallback project ID |
| `functions/index.js` | CORS origins + health check project string |

### Step 3 — Create the first admin user

In Firebase Console → **Authentication** → Add user (email + password). Copy the UID, then run:

```bash
cd backend
python setup_firebase.py
```

Or manually using the Firebase Admin SDK:

```bash
python -c "
import firebase_admin
from firebase_admin import credentials, auth
firebase_admin.initialize_app(credentials.Certificate('serviceAccountKey.json'))
auth.set_custom_user_claims('PASTE_UID_HERE', {'role': 'admin'})
print('Admin role set — user must sign out and back in')
"
```

> After changing a role the user must **sign out and sign in again** to pick up the new token claim.

---

## Local development

### Backend (Python FastAPI)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
copy .env.example .env         # fill in FIREBASE_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS
uvicorn main:app --reload --port 8081
```

Interactive API docs: http://localhost:8081/docs

### Frontend

```bash
cd frontend
npm install --legacy-peer-deps
npm start                      # proxies /api → localhost:8081
```

App: http://localhost:3000

---

## Deploy to Firebase (requires Blaze billing plan)

Firebase Cloud Functions requires the [Blaze pay-as-you-go plan](https://firebase.google.com/pricing). The free tier inside Blaze covers 2M function invocations/month — typical usage costs $0.

### 1. Authenticate

```bash
firebase login
firebase use --add          # select your project
```

### 2. Install function dependencies

```bash
cd functions
npm install --legacy-peer-deps
```

### 3. Build the frontend

```bash
cd frontend
npm run build
```

### 4. Deploy everything

```bash
# From repo root
firebase deploy --project <YOUR_PROJECT_ID>
```

This deploys:
- **Firebase Hosting** — React frontend
- **Cloud Functions** — Express API (`/api/**`)
- **Firestore rules + indexes**

To deploy individually:

```bash
firebase deploy --only "hosting,firestore" --project <YOUR_PROJECT_ID>
firebase deploy --only functions --project <YOUR_PROJECT_ID>
```

### Live URLs

| Resource | URL |
|---|---|
| App | `https://<project-id>.web.app` |
| API health | `https://<project-id>.web.app/api/health` |
| Firebase Console | `https://console.firebase.google.com/project/<project-id>` |

---

## Roles & permissions

| Role | What they can do |
|---|---|
| `admin` | Full access — manage users, delete reservations, update capacity, settings |
| `staff` | Create/edit reservations & appointments, mark attendance, view activity log |
| `user` | Reserved for future public-facing booking portal |

Roles are stored as **Firebase Custom Claims** and set via `POST /api/users/role` (admin only).

---

## API reference

All endpoints require `Authorization: Bearer <Firebase ID token>` except `/api/health`.

| Method | Endpoint | Min role | Description |
|---|---|---|---|
| GET | `/api/health` | public | Health check |
| GET | `/api/reservations` | staff | List all reservations |
| POST | `/api/reservations` | staff | Create reservation |
| PUT | `/api/reservations/:id` | staff | Update reservation |
| PATCH | `/api/reservations/:id/attendance` | staff | Mark checked-in / no-show |
| DELETE | `/api/reservations/:id` | admin | Delete reservation |
| GET | `/api/appointments` | staff | List staff appointments |
| POST | `/api/appointments` | staff | Create appointment |
| PUT | `/api/appointments/:id` | staff | Update appointment |
| DELETE | `/api/appointments/:id` | staff | Delete appointment |
| GET | `/api/activity` | staff | Activity log (last 200 events) |
| GET | `/api/capacity/:date` | staff | Get daily rider capacity |
| PUT | `/api/capacity/:date` | admin | Set daily rider capacity |
| GET | `/api/settings` | staff | Get global settings |
| PUT | `/api/settings` | admin | Update global settings |
| GET | `/api/users` | admin | List all users |
| POST | `/api/users/invite` | admin | Create new user account |
| POST | `/api/users/role` | admin | Change user role |
| POST | `/api/users/disable` | admin | Deactivate user |
| POST | `/api/users/enable` | admin | Reactivate user |
| POST | `/api/users/reset-password` | admin | Generate password reset link |

---

## Security notes

- `backend/serviceAccountKey.json` — **never commit**; listed in `backend/.gitignore`
- `backend/.env` — **never commit**; listed in `backend/.gitignore`
- `frontend/src/firebase.js` config values are **public** client-side identifiers — safe to commit
- All API routes verify the Firebase ID token on every request
- Firestore security rules enforce role checks at the database layer as a second line of defence

---

## Firestore collections

| Collection | Purpose |
|---|---|
| `reservations` | Guest ride reservations |
| `appointments` | Staff appointments / schedule blocks |
| `activity` | Audit log of all create/update/delete actions |
| `dailyCapacity` | Per-date max rider overrides |
| `settings` | Global settings (default capacity, business name, ride types) |
| `users` | User profiles + role mirror (source of truth is Firebase Auth custom claims) |


---

## Project structure

```
the-book-cloud/
├── firebase.json           ← Hosting + Firestore config
├── firestore.rules         ← Role-based security rules
├── firestore.indexes.json  ← Composite indexes
├── cloudbuild.yaml         ← CI/CD pipeline (optional)
├── backend/
│   ├── main.py             ← FastAPI app (all endpoints)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example        ← Copy to .env and fill in
└── frontend/
    ├── package.json
    ├── public/index.html
    └── src/
        ├── index.js
        ├── firebase.js     ← ⚠ Fill in your Firebase web config
        ├── api.js          ← Auth-aware API client
        └── App.js          ← Full React app
```

---

## One-time setup checklist

### 1. Firebase Console (5 min)
- [ ] Go to https://console.firebase.google.com → project **the-book-786**
- [ ] **Authentication** → Sign-in method → Enable **Email/Password**
- [ ] **Firestore** → Create database → Start in **production mode** → Region: `us-central1`
- [ ] **Project Settings → Service accounts** → Generate new private key → save as `backend/serviceAccountKey.json`
- [ ] **Project Settings → General → Your apps** → Add a Web app → copy `firebaseConfig` values into `frontend/src/firebase.js`

### 2. Create the first admin user
In Firebase Console → Authentication → Add user (email + password).
Then run once in your terminal to set the admin role:

```bash
cd backend
python -c "
import firebase_admin
from firebase_admin import credentials, auth

firebase_admin.initialize_app(credentials.Certificate('serviceAccountKey.json'))
auth.set_custom_user_claims('PASTE_UID_HERE', {'role': 'admin'})
print('Done')
"
```

After setting the claim, the user must **sign out and sign in again** for the new role to take effect.

---

## Local development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # then edit .env
uvicorn main:app --reload --port 8080
```
API docs: http://localhost:8080/docs

### Frontend
```bash
cd frontend
npm install --legacy-peer-deps
npm start                       # proxies /api → localhost:8080
```
App: http://localhost:3000

---

## Deploy to Firebase + Cloud Run

### Backend → Cloud Run
```bash
cd backend
gcloud builds submit --tag gcr.io/the-book-786/the-book-api
gcloud run deploy the-book-api \
  --image gcr.io/the-book-786/the-book-api \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated
```
After deploy, update `firebase.json` `run.serviceId` if different.

### Frontend → Firebase Hosting
```bash
cd frontend
npm run build
firebase deploy --only hosting
```

### Firestore rules + indexes
```bash
firebase deploy --only firestore
```

---

## Roles

| Role  | Permissions |
|-------|-------------|
| admin | Full access — manage users, delete reservations, set capacity, settings |
| staff | Create/edit reservations & appointments, view activity log, check-in |
| user  | No access (reserved for future public booking) |

Roles are set as **Firebase Custom Claims** via `/api/users/role` (admin only).
After changing a role, the user must sign out + sign in to get the new token.

---

## API endpoints (all require `Authorization: Bearer <Firebase ID token>`)

| Method | Path | Role |
|--------|------|------|
| GET    | /api/reservations | staff+ |
| POST   | /api/reservations | staff+ |
| PUT    | /api/reservations/:id | staff+ |
| PATCH  | /api/reservations/:id/attendance | staff+ |
| DELETE | /api/reservations/:id | admin |
| GET    | /api/appointments | staff+ |
| POST/PUT/DELETE | /api/appointments/:id | staff+ |
| GET    | /api/activity | staff+ |
| GET/PUT | /api/capacity/:date | GET:staff, PUT:admin |
| GET/PUT | /api/settings | GET:staff, PUT:admin |
| GET    | /api/users | admin |
| POST   | /api/users/invite | admin |
| POST   | /api/users/role | admin |
| GET    | /api/health | public |
