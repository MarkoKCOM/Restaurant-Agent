# API Authentication

## Overview

Add JWT-based authentication to the OpenSeat Fastify API. All routes except public endpoints require a valid Bearer token. The dashboard gains a login page that stores the JWT and attaches it to every API request. A seeded admin user is created during database setup so operators can log in immediately after deployment.

## Requirements

- REQ-1: Implement `POST /api/v1/auth/login` that accepts `{ email, password }` and returns `{ token, expiresIn }` on success or `401` on failure.
- REQ-2: Passwords are hashed with bcrypt (cost factor 10) and stored in a `users` table (`id`, `email`, `passwordHash`, `role`, `restaurantId`, `createdAt`).
- REQ-3: JWT payload contains `{ userId, email, role, restaurantId }` and expires in 24 hours. Signed with `JWT_SECRET` from environment.
- REQ-4: Register a Fastify `onRequest` hook that validates the `Authorization: Bearer <token>` header on every route except: `GET /api/v1/health`, `POST /api/v1/auth/login`, and all `GET /api/v1/reservations/availability*` routes.
- REQ-5: On invalid or expired token, respond with `401 { error: "Unauthorized" }`.
- REQ-6: Seed script creates an admin user with email `admin@bff.co.il` and an auto-generated password. The password is printed to stdout during seed execution so the operator can capture it.
- REQ-7: Dashboard adds a `/login` route with email and password fields.
- REQ-8: On successful login, store the JWT in `localStorage` and redirect to `/today`.
- REQ-9: All dashboard API calls include the `Authorization: Bearer <token>` header via a shared Axios/fetch interceptor or React Query default headers.
- REQ-10: If any API call returns 401, clear the stored token and redirect to `/login`.

## Acceptance Criteria

- AC-1: `POST /api/v1/auth/login` with correct admin credentials returns 200 with a valid JWT.
- AC-2: `POST /api/v1/auth/login` with wrong password returns 401.
- AC-3: `GET /api/v1/restaurants` without a token returns 401.
- AC-4: `GET /api/v1/restaurants` with a valid Bearer token returns 200.
- AC-5: `GET /api/v1/health` without a token returns 200 (public).
- AC-6: `GET /api/v1/reservations/availability?restaurantId=...&date=...` without a token returns 200 (public).
- AC-7: After seed runs, the admin password is visible in stdout.
- AC-8: Dashboard login page renders at `/login`, submits credentials, and redirects to `/today` on success.
- AC-9: Dashboard shows an error message on invalid credentials without redirecting.
- AC-10: A 401 response from any dashboard API call redirects the user to `/login`.

## API Changes

| Method | Path | Auth | Request Body | Response |
|--------|------|------|-------------|----------|
| POST | `/api/v1/auth/login` | Public | `{ email: string, password: string }` | `200 { token: string, expiresIn: number }` or `401 { error: "Unauthorized" }` |

All existing endpoints (except health and availability) now require `Authorization: Bearer <token>`.

## UI Changes

- New `/login` route with centered card containing email input, password input, and "Sign In" button.
- Error toast or inline message on failed login.
- Global 401 interceptor that clears token and redirects to `/login`.

## Database Changes

New `users` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, default gen_random_uuid() |
| email | varchar(255) | unique, not null |
| passwordHash | varchar(255) | not null |
| role | varchar(50) | default 'admin' |
| restaurantId | uuid | FK to restaurants, nullable |
| createdAt | timestamp | default now() |
