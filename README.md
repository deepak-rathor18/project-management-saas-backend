# Taskflow Backend

Taskflow's backend is a REST API built with Node.js, Express, and Mongoose. It provides authentication, workspace and project management, tasks, comments, dashboard metrics, and activity history. The API enforces authentication, workspace membership, and project permissions on protected routes.

This directory can be published as its own repository. Configure the frontend's `VITE_API_URL` to point to this API after deployment.

## Project overview

This backend powers Taskflow, an organization-based project and task management application. It is the authority for data persistence, authentication, and role-based access; the React frontend is a separate application that consumes the `/api` routes.

## Features

- Account registration/login, password hashing, JWT authentication, and protected routes.
- Organization creation, member management, and OWNER / ADMIN / MEMBER roles.
- Project creation, membership, MANAGER / MEMBER project roles, and project archival.
- Task CRUD, assignment, status transitions, labels, due dates, filters, search, sorting, and pagination.
- Task comments, activity history, project/workspace dashboard metrics, and health endpoint.
- Backend enforcement of organization/project access and task-assignee permissions.
- Development-only idempotent demo seed data.

## Tech stack

- Node.js 20+, ES modules
- Express 4
- MongoDB and Mongoose 8
- JWT (`jsonwebtoken`) and `bcryptjs`
- `helmet`, `cors`, `express-rate-limit`, and `dotenv`
- Node.js built-in test runner

## Architecture overview

The Express app mounts route modules and common middleware. Authentication middleware verifies JWTs; project access middleware loads organization/project/task context and checks permissions; controllers validate request data and apply business rules using Mongoose models. Errors are mapped to JSON responses by shared HTTP utilities.

```text
HTTP client (frontend)
  -> Express app and middleware
    -> Routes
      -> Authentication and organization/project access checks
        -> Controllers and validation
          -> Mongoose models -> MongoDB
```

## Requirements

- Node.js 20 or later
- MongoDB 6 or later, running locally or available through MongoDB Atlas

## Setup

From the `backend` directory, install dependencies and create a local environment file:

```powershell
npm install
Copy-Item .env.example .env
```

Configure `.env`:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/taskflow
JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

Use a long, unique `JWT_SECRET`. In production, `CLIENT_URL` must match the frontend origin exactly. Multiple production origins can be provided as a comma-separated list. In development, HTTP origins on `localhost`, `127.0.0.1`, and `::1` are allowed on any port so Vite's alternate ports work without weakening the production allowlist.

Start the API:

```powershell
npm run dev
```

The API listens on port `5000` by default. Check that it is running at `http://localhost:5000/api/health`.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with Nodemon |
| `npm start` | Start the API with Node.js |
| `npm test` | Run backend tests with Node's built-in test runner |
| `node src/seed.js` | Seed the configured development database with demo data |

## Test credentials and seed data

The seed script upserts its demo users, workspaces, projects, tasks, comments, and activity records. It uses the `MONGODB_URI` from `.env` and refuses to run when `NODE_ENV=production`. Point it only at a development database; the demo accounts use reserved example.com addresses and their seed password is reset each time the script runs.

Run it from the backend directory:

```powershell
node src/seed.js
```

Seeded accounts share the development-only password `Test@123456`:

| Account | Email |
| --- | --- |
| Owner | `owner@example.com` |
| Admin | `admin@example.com` |
| Manager | `manager@example.com` |
| Member | `member1@example.com` |
| Member | `member2@example.com` |

Do not use these demo credentials for production or real user accounts.

## API overview

Protected routes require a bearer token in the `Authorization` header:

```text
Authorization: Bearer <token>
```

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Register and receive an access token |
| `POST` | `/api/auth/login` | Sign in and receive an access token |
| `POST` | `/api/auth/logout` | Sign-out acknowledgement |
| `GET` | `/api/auth/me` | Get the current account |
| `POST`, `GET` | `/api/organizations` | Create a workspace or list memberships |
| `GET`, `PUT` | `/api/organizations/:id` | Read or update workspace details |
| `GET` | `/api/organizations/:id/dashboard` | Get workspace dashboard metrics and activity |
| `GET` | `/api/organizations/:id/activity` | Get authorized workspace activity history (`page`, `limit`, maximum 50 per page) |
| `POST` | `/api/organizations/:id/members` | Add an already-registered user by email |
| `PATCH`, `DELETE` | `/api/organizations/:id/members/:userId` | Change a workspace role or remove a member |
| `GET`, `POST` | `/api/projects` | List accessible projects or create a project |
| `GET`, `PUT`, `DELETE` | `/api/projects/:id` | Read, update, or archive a project |
| `POST` | `/api/projects/:id/members` | Add a project member or manager |
| `PATCH`, `DELETE` | `/api/projects/:id/members/:userId` | Change a project role or remove a member |
| `GET` | `/api/projects/:id/activity` | Get project activity |
| `GET`, `POST` | `/api/projects/:projectId/tasks` | List or create project tasks |
| `GET`, `PUT`, `DELETE` | `/api/tasks/:taskId` | Read, edit, or delete a task |
| `PATCH` | `/api/tasks/:taskId/status` | Update task status when permitted |
| `PATCH` | `/api/tasks/:taskId/assignee` | Assign or unassign a task |
| `GET`, `POST` | `/api/tasks/:taskId/comments` | List or add task comments |
| `PUT`, `DELETE` | `/api/comments/:commentId` | Edit or delete a comment when permitted |
| `GET` | `/api/health` | Check API health |

The task-list endpoint supports `page`, `limit` (maximum 100), `status`, `priority`, `assignee` (`me` or a user ID), `search`, and `sort` (`createdAt`, `dueDate`, `priority`, or `updatedAt`).

## Data model

- `User`: normalized unique email, display name, and bcrypt password hash.
- `Organization`: owner plus embedded user/role membership entries.
- `Project`: organization and owner references, members, manager subset, status, priority, and due date.
- `Task`: organization/project references, reporter, optional assignee, status, priority, labels, and dates.
- `Comment`: organization/project/task references and author.
- `Activity`: organization, actor, optional project/task references, action, and display detail.

Organizations own projects; projects contain tasks; tasks contain comments. Organization and project references are used to scope protected queries.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | No | HTTP port (default `5000`, deployment hosts may provide it) |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long, unique secret for signing access tokens |
| `CLIENT_URL` | No | Allowed frontend origin(s), comma-separated |
| `NODE_ENV` | No | Runtime mode; `production` blocks demo seeding |

## Roles and authorization

- **Organization owner:** manages the workspace, members, organization roles, and projects.
- **Organization admin:** manages workspace details, members, and projects, but cannot change workspace roles.
- **Project manager:** manages the projects they lead, including members, tasks, and task assignments.
- **Project member:** can access their project and assigned tasks; task-list and task-detail access are restricted to tasks assigned to them. Members can comment and update the status of their assigned tasks where permitted.

These rules are enforced by backend authentication middleware, project access middleware, and controller checks. A frontend-hidden button is not treated as authorization.

## Backend structure

```text
src/
  app.js                    Express middleware and route mounting
  server.js                 Environment loading, database connection, and startup
  config/database.js        MongoDB connection
  controllers/              Request handlers and business logic
  middleware/               Authentication, access checks, and error mapping
  models/                   User, Organization, Project, Task, Comment, Activity
  routes/                   Endpoint declarations and middleware composition
  seed.js                   Idempotent development demo-data seed
  utils/                    Request validation and async helpers
```

## Security and deployment notes

- Passwords are hashed with bcryptjs; JWTs expire after seven days.
- Login and registration are rate limited. Helmet adds common security headers.
- CORS is restricted to the origin or origins configured in `CLIENT_URL`.
- Keep `.env` private. Never commit database credentials or `JWT_SECRET`.
- Set `NODE_ENV=production` and use production secrets when deploying.
- Logout clears the client-side token; tokens are stateless and are not revoked server-side before expiry.

## Deployment

1. Provision MongoDB Atlas or another secured MongoDB service.
2. Deploy this folder as a Node.js service using `npm install` and `npm start`.
3. Configure `MONGODB_URI`, a strong `JWT_SECRET`, `NODE_ENV=production`, `PORT` as required by the host, and `CLIENT_URL` with the deployed frontend origin.
4. Confirm `/api/health` is reachable and the frontend can authenticate. Never expose `JWT_SECRET` or `MONGODB_URI` to the frontend.

The companion frontend is maintained and deployed separately. Configure its `VITE_API_URL` to this API's public base URL followed by `/api`.

## Known limitations

- Invitations require an already registered email; invitation delivery and password reset are not implemented.
- JWT logout is client-side only; tokens expire after seven days and cannot be revoked server-side.
- Automated tests cover request validation, CORS policy, the health endpoint, and rejection of unauthenticated API requests. Full route-level role and resource-isolation integration tests are still needed.
- Activity history is available per project and per workspace; notifications and real-time updates are not implemented.

## Future improvements

- Add invitation and password-reset flows, token revocation, and stronger account lifecycle management.
- Expand role/authorization integration tests and API request validation coverage.
- Add notifications and live updates.

## AI tools used

Copilot SDK in VS Code assisted with implementation and documentation. Review and verify generated changes, especially authorization and deployment settings, before production use.
