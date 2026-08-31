# PAPIATMA MODULE — Product Requirements Document

## Original Problem Statement
User (Hinglish) wanted an SMS-inject system tied to Telegram, based on their Android `sms_server.sh` + zygisk module (`com.floatingmenu.SmsBroadcaster`). Two directions:
1. Web panel: enter Sender ID + Message Body for a "client" -> appears on that client's Telegram AND injects as SMS on the phone.
2. Telegram -> SMS: user sends a message to the client's Telegram bot -> phone injects it as SMS.
Admin panel (separate path) manages clients (key like "ramu" + bot token + chat id). Branding: PAPIATMA MODULE (@papiatma).

## Architecture
- Backend: FastAPI + MongoDB. Telegram send via httpx sendMessage; Telegram receive via getUpdates background poll loop (per active client, chat_id-filtered). Device queue `pending_injects`; phone pulls line-delimited `sender|body`.
- Auth: JWT single-admin (Bearer in localStorage).
- Frontend: React + Tailwind + shadcn + framer-motion + sonner. Dark tactical theme. Routes: `/` public inject, `/admin/login`, `/admin`.
- Phone module (flashable ZIP): `classes.dex` (com.papiatma.SmsBroadcaster), `papiatma_inject.sh` (pulls queue, calls app_process, auto-detects default SMS app), `service.sh` (boot start + watchdog), module.prop/customize.sh/META-INF.

## Implemented
- Admin login/seed (admin@papiatma.com / admin123), protected routes, 401 guards.
- Admin: Overview stats, Client CRUD (+ default_sender field, test-connection, show/hide token, active toggle), Logs.
- Public inject panel: client dropdown, sender+body, live preview, recent dispatches. /api/inject sends to Telegram + enqueues for phone.
- Device pull endpoint (secret-guarded) returns `sender|body` lines, marks delivered.
- Telegram -> SMS: backend getUpdates poller enqueues incoming bot messages (format `sender|body`, or default_sender + full text). First poll skips backlog. chat_id filtered.
- Downloadable phone assets served from frontend/public: classes.dex, papiatma_inject.sh, service.sh, papiatma_module.zip.
- Full rebrand TeleInject -> PAPIATMA MODULE (@papiatma); dex package com.floatingmenu -> com.papiatma; module path zygisk_floating_menu -> papiatma_module.

## Not verifiable here (no Android device / no real Telegram bot)
- Actual on-device SMS injection.
- Real Telegram message -> SMS end-to-end (poll logic tested for no-crash with fake token only).

## Backlog / Next
- P1: Device "last seen / online" indicator in admin.
- P2: Per-client target package/activity override from admin; SIM/subscription selection.
- P2: Ack-based delivery (mark delivered only after phone confirms).
- P2: Log export, resend failed.
