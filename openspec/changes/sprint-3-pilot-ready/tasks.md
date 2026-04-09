## Sprint 3 Tasks — Pilot Ready

### Track A: Claude Code (Security + Dashboard Polish + Infrastructure)

- [ ] A1. **JWT Auth middleware** — Create `apps/api/src/middleware/auth.ts` with Fastify onRequest hook, JWT verification, exclude health/login/availability routes
- [ ] A2. **Login endpoint** — `POST /api/v1/auth/login` accepting email+password, returning JWT token
- [ ] A3. **Seed admin user** — Add admin_users table or use restaurants table, seed BFF admin credentials
- [ ] A4. **Dashboard login page** — `apps/dashboard/src/pages/LoginPage.tsx`, store JWT, redirect to /today
- [ ] A5. **Dashboard auth wrapper** — Wrap all routes in auth check, redirect to /login if no token, attach Bearer header to all API calls
- [ ] A6. **Settings hours editor** — Replace read-only hours display with editable time inputs per day + save button
- [ ] A7. **Settings table editor** — Add/remove/edit tables from dashboard (uses existing table CRUD API)
- [ ] A8. **Reservation detail panel** — Click row → slide-over panel with full details + edit form
- [ ] A9. **Widget branding** — Fetch restaurant config on mount, apply primaryColor/logo/welcomeText
- [ ] A10. **Widget input validation** — Israeli phone format, server-side past date rejection
- [ ] A11. **SSL/HTTPS** — Certbot for nginx, auto-renew, redirect HTTP→HTTPS
- [ ] A12. **Update docs** — ROADMAP.md, ARCHITECTURE.md, PROGRESS.md to reflect Sprint 3

### Track B: Jake (Features + WhatsApp Skeleton)

- [ ] B1. **Waitlist service** — `apps/api/src/services/waitlist.service.ts` with add, list, match, accept, expire functions
- [ ] B2. **Waitlist routes** — `POST /api/v1/waitlist`, `GET /api/v1/waitlist`, `POST /api/v1/waitlist/:id/accept`
- [ ] B3. **Waitlist auto-match on cancel** — In cancelReservation, check for matching waitlist entries, set offered+expiry
- [ ] B4. **Waitlist lazy expiry** — On each waitlist query, expire entries past their expiresAt
- [ ] B5. **Guest preference editor** — Add edit form to GuestDetailPage for preferences, tags, notes
- [ ] B6. **Guest auto-tagging** — Auto-tag guests based on visitCount thresholds (new/returning/regular/VIP)
- [ ] B7. **WhatsApp session manager** — `apps/api/src/whatsapp/session.ts` with Baileys connection + QR
- [ ] B8. **WhatsApp message handler** — `apps/api/src/whatsapp/handler.ts` stub that logs inbound messages
- [ ] B9. **WhatsApp sender** — `apps/api/src/whatsapp/sender.ts` helper for outbound messages
- [ ] B10. **WhatsApp admin routes** — `POST /api/v1/whatsapp/start`, `POST /stop`, `GET /status`, `GET /qr`
- [ ] B11. **End-to-end test** — Widget booking → API → verify in dashboard, cancellation → waitlist match

### Track C: Shared / Final

- [ ] C1. **Build + type-check** — `pnpm build` passes with zero errors across all 5 packages
- [ ] C2. **Deploy** — Restart openseat-api service, verify all endpoints
- [ ] C3. **Commit + push** — All changes committed to main branch on GitHub
- [ ] C4. **PROGRESS.md** — Update with Sprint 3 completion notes
