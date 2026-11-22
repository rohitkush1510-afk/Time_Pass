# FundRaise

A full-stack crowdfunding platform where **creators** launch campaigns, **supporters** back them with pledges, and **admins** review and approve campaigns before they go live. Funding totals update in real time across all connected browsers using Socket.IO.

> **Note:** Payments are **mock only**. Card numbers are validated for format (16 digits) but are never charged, stored, or sent to a payment gateway. This project is a demo/capstone application, not a production payment system.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [1. Install dependencies](#1-install-dependencies)
  - [2. Configure environment variables](#2-configure-environment-variables)
  - [3. Seed the admin account](#3-seed-the-admin-account)
  - [4. Run the app](#4-run-the-app)
- [Demo Credentials & User Workflows](#demo-credentials--user-workflows)
- [Frontend Routes](#frontend-routes)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Real-Time Updates](#real-time-updates)
- [Image Uploads](#image-uploads)
- [Validation & Business Rules](#validation--business-rules)
- [Available Scripts](#available-scripts)
- [Building for Production](#building-for-production)
- [Deployment Notes](#deployment-notes)
- [Troubleshooting](#troubleshooting)
- [Security Notes & Limitations](#security-notes--limitations)
- [License](#license)

---

## Features

- **Role-based access control** — three roles: `supporter`, `creator`, and `admin`, enforced on both the API and the UI.
- **Campaign lifecycle** — campaigns start as `pending`, are reviewed by an admin, and become `approved` or `rejected`. Only approved campaigns appear publicly and accept pledges.
- **Mock pledging** — supporters pledge with a 16-digit mock card number and an optional message. Minimum pledge is 10.
- **Live funding updates** — when a pledge is made, a `newPledge` Socket.IO event pushes updated totals to every connected client (home gallery and campaign detail pages update without a refresh).
- **Interactive "fan gallery"** — a draggable, scrollable, keyboard-navigable card carousel of live campaigns on the home page, with responsive sizing and reduced-motion support.
- **Category statistics** — an aggregation endpoint shows total funds raised per category, visible on the home page and admin dashboard.
- **Image support** — creators can paste an image (Ctrl+V), upload a file, or provide an image URL. Uploaded images are resized/re-encoded client-side and stored on the server.
- **Theme support** — light/dark theme toggle that respects the system preference and persists the choice in `localStorage`.
- **Session persistence** — JWT stored in `localStorage`; sessions are re-verified against `/api/auth/me` on page load.
- **Admin dashboard** — review pending campaigns, approve/reject any campaign, and view platform-wide stats (total raised, unique supporters, pledges, campaigns, pending count, users).

---

## Tech Stack

**Backend** (`backend/`)

| Package | Purpose |
| --- | --- |
| Node.js + Express 5 | HTTP server and REST API |
| MongoDB + Mongoose 9 | Document database and ODM |
| Socket.IO 4 | Real-time bidirectional events |
| jsonwebtoken | JWT authentication (`Bearer` tokens, 7-day expiry) |
| bcrypt | Password hashing (cost factor 10) |
| cors | Cross-origin request handling |
| dotenv | Environment configuration |

**Frontend** (`frontend/`)

| Package | Purpose |
| --- | --- |
| React 19 + Vite 8 | UI library and build tool |
| React Router 7 | Client-side routing and protected routes |
| socket.io-client | Listening for live pledge events |
| Plain CSS | Styling (`App.css`, `FanGallery.css`) |

---

## Project Structure

```
FundRaise/
├── backend/
│   ├── middleware/
│   │   └── auth.js          # auth (JWT verify) and adminOnly guards
│   ├── models/
│   │   ├── User.js          # name, email, password, role
│   │   ├── Campaign.js      # campaign fields + status + creator ref
│   │   └── Pledge.js        # pledge amount, message, payment status
│   ├── routes/
│   │   ├── auth.js          # /api/auth/*
│   │   ├── campaigns.js     # /api/campaigns/*
│   │   ├── pledges.js       # /api/pledges/*
│   │   └── admin.js         # /api/admin/*
│   ├── utils/
│   │   └── stats.js         # shared per-campaign aggregation helper
│   ├── uploads/             # user-uploaded campaign images (served at /api/uploads)
│   ├── .env                 # backend secrets (git-ignored)
│   ├── seed.js              # creates the default admin account
│   ├── server.js            # app entry point, CORS, routes, Socket.IO, DB connection
│   └── package.json
├── frontend/
│   ├── public/              # static assets (e.g. favicon.svg)
│   ├── src/
│   │   ├── components/      # Navbar, FanGallery, ProgressBar, ThemeToggle
│   │   ├── context/         # AuthContext, ThemeContext
│   │   ├── pages/           # Home, Login, Register, CampaignDetail,
│   │   │                    # CreateCampaign, MyCampaigns, MyPledges, AdminDashboard
│   │   ├── utils/           # dates.js, images.js helpers
│   │   ├── api.js           # fetch wrapper: auth header + /api base path
│   │   ├── App.jsx          # providers, router, protected routes
│   │   ├── App.css          # global styles and theme variables
│   │   └── main.jsx         # React entry point
│   ├── .env                 # frontend config (git-ignored)
│   ├── index.html
│   ├── vite.config.js       # dev server port + /api and /socket.io proxies
│   └── package.json
└── README.md
```

---

## Architecture Overview

```
Browser (React)
   │  REST via api.js ──────────► Express API (/api/*)
   │  WebSocket via socket.io ──► Socket.IO server (same HTTP server)
   ▼
MongoDB  ◄── Mongoose models (User, Campaign, Pledge)
```

- The frontend talks to the backend over REST. `frontend/src/api.js` prefixes every call with `/api` and attaches `Authorization: Bearer <token>` from `localStorage` when present.
- In development, Vite proxies `/api` and `/socket.io` to the backend, so the browser can keep calling same-origin paths. The proxy targets come from `VITE_API_URL` / `VITE_SOCKET_URL`.
- When a pledge succeeds, the backend emits a `newPledge` event containing the campaign ID and fresh totals. The home page and campaign detail page listen for it and update state immediately.
- All admin routes pass through `auth` + `adminOnly` middleware; creator-only mutations are checked inside the route handlers.

---

## Prerequisites

- **Node.js 20.19+ or 22.12+** (recommended for Vite 8 / modern Express)
- **npm** (ships with Node)
- **MongoDB** — either a local instance or a MongoDB Atlas cluster (a connection URI is required)

---

## Getting Started

### 1. Install dependencies

Open a terminal in each folder:

```bash
cd backend
npm install
```

```bash
cd frontend
npm install
```

### 2. Configure environment variables

Both `.env` files are git-ignored. Create them if they are missing (or replace the example values with your own).

**`backend/.env`**

```env
PORT=5000
MONGO_URL=mongodb+srv://<user>:<password>@<cluster-host>/<database>
JWT_SECRET=replace-with-a-long-random-secret
CORS_ORIGIN=http://localhost:3000
DNS_SERVERS=8.8.8.8,1.1.1.1
```

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | Yes | Port the API listens on (e.g. `5000`). |
| `MONGO_URL` | Yes | MongoDB connection string. If missing, the server still starts but logs a MongoDB error and data operations will fail. |
| `JWT_SECRET` | Yes | Secret used to sign/verify JWTs. Use a strong random value. |
| `CORS_ORIGIN` | No | Comma-separated allowed origins, or `*` (default) to allow all. Set to your frontend URL in production. |
| `DNS_SERVERS` | No | Optional comma-separated DNS servers for environments with custom DNS resolution. |

**`frontend/.env`**

```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
VITE_PORT=3000
```

| Variable | Required | Description |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Backend origin. Used for the Vite proxy target and as the API base in `api.js`. Set to `""` if the frontend and API are served from the same origin. |
| `VITE_SOCKET_URL` | No | Socket.IO origin. Falls back to `VITE_API_URL`. |
| `VITE_PORT` | No | Port for the Vite dev server (default `3000`). |

> For local development, point `VITE_API_URL` at `http://localhost:5000` and set `backend` `CORS_ORIGIN=http://localhost:3000`.

### 3. Seed the admin account

The admin cannot be created through the public registration form. From the `backend` folder run:

```bash
npm run seed
```

This creates (only if it doesn't already exist):

```
email:    admin@fundraise.com
password: admin123
```

### 4. Run the app

In one terminal (backend):

```bash
cd backend
npm run dev     # node --watch server.js (auto-restart on changes)
# or: npm start
```

In another terminal (frontend):

```bash
cd frontend
npm run dev     # Vite dev server
```

Then open:

- **Frontend:** http://localhost:3000
- **API health check:** http://localhost:5000/ → `FundRaise API is running`

---

## Demo Credentials & User Workflows

| Role | How to obtain | What they can do |
| --- | --- | --- |
| **Supporter** | Register with role `Supporter` | Browse campaigns, pledge to approved campaigns, view own pledges. |
| **Creator** | Register with role `Creator` | Everything a supporter can do, plus create campaigns, edit/delete *pending* campaigns, and view own campaigns. |
| **Admin** | Created via `npm run seed` | View all campaigns and platform stats, approve or reject campaigns. |

Default admin login (shown on the login page as a demo hint):

```
admin@fundraise.com  /  admin123
```

**Typical end-to-end flow**

1. Register as a **creator** and log in.
2. Create a campaign (title, description, goal, deadline, category, optional image). It is saved with status `pending`.
3. Log in as **admin** (`/admin`) and approve the campaign.
4. Register/log in as a **supporter**, open the campaign, and pledge (min 10, any 16-digit mock card number).
5. Watch the progress bar, supporter count, and home gallery update live via Socket.IO.

---

## Frontend Routes

| Path | Access | Page | Description |
| --- | --- | --- | --- |
| `/` | Public | `Home` | Search/filter approved campaigns, interactive fan gallery, category stats table. |
| `/login` | Public | `Login` | Email/password login; redirects based on role. |
| `/register` | Public | `Register` | Sign up as supporter or creator (admin signup is not allowed). |
| `/campaign/:id` | Public | `CampaignDetail` | Campaign info, progress, pledge form, pledge list, live status indicator. |
| `/create` | Creator | `CreateCampaign` | Create a new pending campaign with optional image. |
| `/my-campaigns` | Creator | `MyCampaigns` | List, edit and delete own campaigns (edits only while pending). |
| `/my-pledges` | Authenticated | `MyPledges` | List pledges made by the current supporter. |
| `/admin` | Admin | `AdminDashboard` | Review queue, status management, platform stats. |

Protected routes render a "Loading..." state while the session is verified, redirect to `/login` when signed out, and show an access message when the role doesn't match.

---

## API Reference

Base URL: `/api` (e.g. `http://localhost:5000/api`).

Authentication: send `Authorization: Bearer <token>` for protected endpoints. The token is returned by `POST /auth/login`.

Errors are returned as `{ "message": "..." }` with an appropriate HTTP status code.

### Authentication — `/api/auth`

| Method | Endpoint | Auth | Body / Query | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/auth/register` | — | `{ name, email, password, role }` | Registers a user. `role` is sanitized: only `creator` is honored; everything else becomes `supporter`. Returns `201 { message }`. |
| `POST` | `/auth/login` | — | `{ email, password }` | Returns `{ token, user: { id, name, email, role } }`. Token expires in 7 days. |
| `GET` | `/auth/me` | Bearer | — | Returns the current user's profile (no password). |

### Campaigns — `/api/campaigns`

| Method | Endpoint | Auth | Body / Query | Description |
| --- | --- | --- | --- | --- |
| `GET` | `/campaigns/category-stats` | — | — | `[{ category, totalRaised }]` aggregated from paid pledges, sorted by total raised. |
| `GET` | `/campaigns` | — | `?category=&search=` | Lists **approved** campaigns (newest first) with `totalRaised` and `supportersCount`. `search` matches title case-insensitively. |
| `GET` | `/campaigns/mine` | Bearer | — | Lists the current user's campaigns with stats (newest first). |
| `GET` | `/campaigns/:id` | — | — | A single campaign with stats and populated creator name. |
| `POST` | `/campaigns` | Bearer (creator) | `{ title, description, goal, deadline, category, imageUrl?, imageData? }` | Creates a `pending` campaign. `imageData` is a base64 data URL. Returns `201 { message, campaign }`. |
| `PUT` | `/campaigns/:id` | Bearer (owner) | Any editable campaign fields | Updates a campaign. Only the owner and only while status is `pending`. Supports replacing images. |
| `DELETE` | `/campaigns/:id` | Bearer (owner) | — | Deletes a pending campaign and its uploaded image. |

### Pledges — `/api/pledges`

| Method | Endpoint | Auth | Body / Query | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/pledges` | Bearer | `{ campaignId, amount, cardNumber, message? }` | Creates a paid pledge and emits `newPledge`. Returns `{ message, pledge, totalRaised, supportersCount }`. |
| `GET` | `/pledges/mine` | Bearer | — | Current user's pledges with populated campaign title/category/goal. |
| `GET` | `/pledges/campaign/:id` | — | — | Pledges for a campaign with populated supporter names, newest first. |

### Admin — `/api/admin` (Bearer token with `role: admin` required on all)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/admin/campaigns` | All campaigns (any status) with creator name/email and funding stats. |
| `PUT` | `/admin/campaigns/:id/approve` | Sets status to `approved`. |
| `PUT` | `/admin/campaigns/:id/reject` | Sets status to `rejected`. |
| `GET` | `/admin/stats` | `{ totalRaised, supportersCount, pledgesCount, campaignsCount, pendingCount, usersCount }` (only paid pledges count toward total raised). |

### Other

| Endpoint | Description |
| --- | --- |
| `GET /` | Plain-text health check: `FundRaise API is running`. |
| `GET /api/uploads/:filename` | Static serving of campaign images stored in `backend/uploads`. |
| `GET /api/*` (unmatched) | `404 { message: 'API route not found' }`. |

---

## Data Models

**User** (`users` collection)

```js
{
  name: String,            // required
  email: String,           // required, unique, stored lowercase/trimmed
  password: String,        // required, bcrypt hash (never returned by the API)
  role: 'creator' | 'supporter' | 'admin',  // default: 'supporter'
  createdAt, updatedAt     // timestamps
}
```

**Campaign** (`campaigns` collection)

```js
{
  title: String,           // required
  description: String,     // required
  goal: Number,            // required, > 0
  deadline: Date,          // required, in the future at creation
  category: String,        // e.g. Medical, Education, Tech, Animals, Other
  imageUrl: String,        // default: ''  (local path or external URL)
  status: 'pending' | 'approved' | 'rejected',  // default: 'pending'
  creator: ObjectId,       // ref: 'User', required
  createdAt, updatedAt
}
```

**Pledge** (`pledges` collection)

```js
{
  campaign: ObjectId,      // ref: 'Campaign', required
  supporter: ObjectId,     // ref: 'User', required
  amount: Number,          // required, >= 10
  message: String,         // default: ''
  paymentStatus: 'pending' | 'paid' | 'failed',  // default: 'paid' (mock)
  createdAt, updatedAt
}
```

Funding statistics are computed with MongoDB aggregations that sum `amount` for `paymentStatus: 'paid'` pledges and count distinct supporters via `$addToSet`.

---

## Real-Time Updates

- The backend creates the Socket.IO server on the same HTTP server as Express and configures CORS to match `CORS_ORIGIN`.
- On a successful pledge, the API emits:

  ```js
  io.emit('newPledge', {
    campaignId: String(campaign._id),
    totalRaised: stats.totalRaised,
    supportersCount: stats.supportersCount
  });
  ```

- `Home.jsx` listens and updates only the matching campaign card, then refreshes category stats.
- `CampaignDetail.jsx` listens and updates the progress bar/supporter count and reloads the pledge list for that campaign. It also displays a live connection indicator (`connected (live)` / `not connected`).

---

## Image Uploads

1. The client (`frontend/src/utils/images.js`) accepts JPG, PNG, WEBP, or GIF, resizes the longest side to at most 1600 px, and re-encodes it as a JPEG data URL (quality 0.85).
2. The data URL is sent in the `imageData` field with campaign create/update requests.
3. The backend (`saveUploadedImage` in `backend/routes/campaigns.js`) validates the data URL, enforces a 3 MB decoded size limit, writes the file to `backend/uploads` with a random UUID filename, and stores `/api/uploads/<filename>` as `imageUrl`.
4. Replacing or deleting a campaign image removes the old local file. External image URLs are stored as-is and are not deleted.
5. The API also has a 6 MB JSON body limit with a friendly error for oversized requests.

Creators can paste an image directly into the image URL field with **Ctrl+V**, use the file picker, or paste an external image URL.

---

## Validation & Business Rules

**Campaigns**

- Title, description, goal, deadline, and category are required.
- Goal must be a finite number greater than 0.
- Deadline must be a valid date in the future when creating a campaign.
- Only users with the `creator` role can create campaigns.
- Only the creator can edit/delete their own campaign, and only while it is `pending`.
- Only `approved` campaigns are listed publicly or can receive pledges.

**Pledges**

- A valid campaign ID is required.
- Amount must be a finite number, at least **10**.
- Card number must be exactly 16 digits after stripping whitespace (mock validation only).
- Campaign must exist, be `approved`, and not have passed its deadline.
- Creators cannot pledge to their own campaigns.

**Auth**

- Email is trimmed and lowercased on register/login.
- Duplicate email registration is rejected.
- Passwords are hashed with bcrypt (cost 10); JWTs expire after 7 days.
- The public registration endpoint can never grant the `admin` role.

---

## Available Scripts

**Backend** (`cd backend`)

| Command | Description |
| --- | --- |
| `npm start` | Start the API with `node server.js`. |
| `npm run dev` | Start with `node --watch server.js` (auto-restart on file changes). |
| `npm run seed` | Create the default admin account if it doesn't exist. |

**Frontend** (`cd frontend`)

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server (with API/WebSocket proxy). |
| `npm run build` | Create a production build in `frontend/dist`. |
| `npm run preview` | Serve the production build locally for verification. |

---

## Building for Production

```bash
cd frontend
npm run build
# output: frontend/dist
```

Serve `frontend/dist` with any static host (Nginx, "static site" hosting, etc.). Configure the production `.env` values **before** building, because Vite inlines `VITE_*` variables at build time.

For the backend:

```bash
cd backend
npm start
```

Set `PORT`, `MONGO_URL`, `JWT_SECRET`, and a restrictive `CORS_ORIGIN` in the production environment. Ensure `backend/uploads` is writable and persisted if you rely on uploaded images (or replace local storage with object storage for multi-instance deployments).

---

## Deployment Notes

- The repository includes a frontend `.env` pointing to a hosted API (`https://capstone-fundraise.onrender.com`) — replace it with your own backend URL when deploying your instance.
- For a frontend/backend split deployment, set `CORS_ORIGIN` on the backend to your frontend domain (comma-separated for multiple origins) and set `VITE_API_URL` / `VITE_SOCKET_URL` to your backend origin.
- Socket.IO needs WebSocket support on the host; the Vite dev proxy already enables `ws: true` for `/socket.io`.
- On platforms with ephemeral filesystems, uploaded images in `backend/uploads` will not persist across restarts. Use durable/object storage in that case.
- MongoDB Atlas users may need to allow their server IP in the cluster's network access list; `DNS_SERVERS` is available if DNS resolution needs overriding.

---

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `MongoDB error: MONGO_URL is missing in backend/.env` | Create `backend/.env` with a valid `MONGO_URL`. |
| `MongooseServerSelectionError` / connection timeouts | Check the Atlas URI, credentials, network access/IP allowlist, and `DNS_SERVERS`. |
| Frontend shows `Network Error` / empty campaign list | Confirm the backend is running and `VITE_API_URL` matches its origin; check `CORS_ORIGIN` on the backend. |
| `Invalid token` / unexpected logouts | Ensure `JWT_SECRET` is identical across restarts; clearing `localStorage` keys `token` and `user` forces a fresh login. |
| `You are not allowed to see this page.` | The logged-in user's role doesn't match the route (e.g. supporter visiting `/create`). Register as a creator or log in with the right account. |
| No campaigns visible | New campaigns are `pending` until an admin approves them. Log in as admin and approve. |
| `Pledge successful` doesn't update other browsers | Check that `VITE_SOCKET_URL` is reachable and the host supports WebSockets; the detail page shows the socket status. |
| `Request is too large (max 6 MB)` | Pick a smaller image. Uploads are limited to 3 MB after client-side resizing. |
| `Email is already registered` | Use a different email or the existing account's credentials. |
| Admin login fails | Run `npm run seed` in `backend` to create the admin, or verify the seeded credentials. |

---

## Security Notes & Limitations

- **Mock payments:** no real payment processing; never use real card details.
- **Secrets:** `.env` files are git-ignored. Keep `MONGO_URL` and `JWT_SECRET` out of version control, and rotate any credentials that may have been exposed.
- **Token storage:** JWTs are stored in `localStorage`, which is accessible to JavaScript on the origin — a common trade-off for simple SPAs. A more hardened design would use secure, HTTP-only cookies.
- **Local file uploads:** filenames are randomized and MIME types are validated, but images are served publicly from `/api/uploads`. There is no per-user access control on uploaded files.
- **No rate limiting or email verification:** the API does not implement brute-force protection, rate limits, or email verification. Add these before any public deployment.
- **Demo credentials:** the seeded admin password is a known default (`admin123`) and is printed on the login page for demo purposes. Change it for real deployments.

---

## License

This project is provided as-is for demonstration/educational purposes. No specific open-source license is currently declared in the repository.
