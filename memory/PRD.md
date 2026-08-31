# TeleInject — Product Requirements Document

## Original Problem Statement
User (Hinglish) wanted a tool based on their Android `sms_server.sh` script: a system where a Sender ID + Message Body are entered and delivered to Telegram (appearing like an SMS). Follow-up clarified: an ADMIN panel (separate path) to manage "clients" (each client = key like "ramu", a name like "Clinkit", a Telegram bot token, and a chat id fixed by admin), and a SEPARATE public "inject" panel where an operator picks a client key, enters Sender ID + Message Body, and it is sent to that client's Telegram. Both sides show history/logs.

## Architecture
- Backend: FastAPI + MongoDB (motor). Telegram delivery via httpx call to `api.telegram.org/bot<token>/sendMessage` (HTML parse mode, per-client token/chat id).
- Auth: JWT single-admin (Bearer token in localStorage `ti_admin_token`), admin seeded from env.
- Frontend: React + Tailwind + shadcn/ui + Framer Motion + sonner. Dark tactical command-center theme.
- Routes: `/` public inject panel, `/admin/login`, `/admin` (protected).

## User Personas
- Operator: uses public inject panel to dispatch messages (no login).
- Admin: manages clients + credentials, views all logs/stats.

## Core Requirements (static)
- Client CRUD with per-client Telegram bot token + chat id.
- Public message dispatch (sender id + body) to a chosen client's Telegram.
- Message logs + status (delivered/failed) on both sides.
- Message format on Telegram: `<b>{sender}</b>\n{body}`.

## Implemented (2026-08-31)
- JWT admin login/seed; protected admin routes; 401 guards.
- Admin panel: Overview stats, Clients tab (add/edit/delete, test-connection, show/hide token, active toggle), Logs tab.
- Public inject panel: client dropdown (tokens hidden), sender id, message body, live Telegram preview, recent dispatches.
- Inject endpoint sends to Telegram, logs result; graceful JSON failure with real Telegram error detail.
- Tested: 17/17 backend pytest pass, full frontend e2e pass.

## Backlog / Remaining
- P1: Reverse flow (Telegram message -> phone SMS injection) — this runs on the rooted Android device via the existing `sms_server.sh` + zygisk module; the web app is the sender side only. A future bridge/webhook could be added.
- P2: Log export (CSV/JSON), resend-failed button, date-range filters.
- P2: Rate limiting per client; message templates.
- P2: Escape user input in duplicate-key regex; explicit CORS origins.

## Next Tasks
- Get a real Telegram bot token + chat id from user and verify live delivery end-to-end.
