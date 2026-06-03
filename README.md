# Community App Monorepo

NestJS monorepo with separate services for authentication and user management, plus shared libraries for database access, entities, DTOs, and repositories.

## Services

- `auth` app (`apps/auth`): currently exposes a basic health-style endpoint.
- `user-management` app (`apps/user-management`): includes super admin creation endpoint and shared DB setup.

## Tech stack

- Node.js + TypeScript
- NestJS 11
- TypeORM
- PostgreSQL
- bcryptjs

## Repository layout

```text
apps/
  auth/
  user-management/
libs/
  database/
  dtos/
  entities/
  repositories/
```

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL database

## Environment variables

Create a `.env` file in the repo root:

```env
DB_HOST=your-db-host
DB_PORT=5432
DB_USERNAME=your-db-username
DB_PASSWORD=your-db-password
DB_NAME=your-db-name

AUTHENTICATION_PORT=8000
USER_MANAGEMENT_PORT=8001

JWT_SECRET=replace-with-strong-secret
```

Notes:

- `libs/database` reads `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_NAME`.
- TypeORM is configured with `synchronize: false`, so schema migrations must be handled separately.

## Install dependencies

```bash
npm install
```

## Run services

Run auth service:

```bash
npm run start:dev:auth
```

Run user-management service:

```bash
npx nest start user-management --watch
```

## Build

Build auth service:

```bash
npm run build:auth
```

Build user-management service:

```bash
npx nest build user-management
```

## API reference

### Auth service (`AUTHENTICATION_PORT`, default `3000`)

- `GET /`
  - Response: `"Hello World!"`

### User-management service (`USER_MANAGEMENT_PORT`, default `3001`)

Global prefix: `/api`

- `GET /api`

  - Response: `"Hello World!"`

- `POST /api/users/create-super-admin`
  - Body:
    - `email` (required, valid email)
    - `username` (optional)
    - `firstName` (required)
    - `lastName` (required)
    - `password` (required, min 6 chars)
  - Success response:
    - `message`: `"Super Admin created successfully"`
    - `id`: created user id
  - Error responses:
    - `400 Super admin already exists`
    - `400 Email already registered`

Example request:

```bash
curl -X POST http://localhost:3001/api/users/create-super-admin \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@example.com\",\"username\":\"superadmin\",\"firstName\":\"System\",\"lastName\":\"Admin\",\"password\":\"secret123\"}"
```

## Tests

Run all unit tests:

```bash
npm test
```

Run auth e2e tests:

```bash
npm run test:e2e:auth
```

Run user-management e2e tests:

```bash
npx jest --config ./apps/user-management/test/jest-e2e.json
```

## Important naming note

Some npm scripts still refer to a `main` app (`start:main`, `build:main`, `test:e2e:main`), but the current app folder is `apps/user-management`. Prefer the commands in this README for user-management.

## Role Hierarchy

SUPER_ADMIN
↓
IAIRE_ADMIN
↓
BOARD_ADMIN
↓
SCHOOL_ADMIN
↓
TEACHER
↓
STUDENT

## IAIRE User Role Flow

![IAIRE User Role Flow](./assets/user-role-flow.png)
