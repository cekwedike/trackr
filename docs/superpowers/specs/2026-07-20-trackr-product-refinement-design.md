# Trackr Product Refinement — Design Spec

**Date:** 2026-07-20  
**Status:** Approved — locked decisions recorded; continuous same-day execution  
**App:** Trackr (Expo SDK 57, offline-first SQLite SME tracker)  
**Expo docs baseline:** https://docs.expo.dev/versions/v57.0.0/

---

## 1. Intent & scope

This request spans **multiple subsystems**. Work is sequenced into phases for order of execution, **not** deferred to future weeks. Everything in scope below is planned for **continuous same-day implementation**, step by step.

This document:

1. Maps what already exists vs what is net-new  
2. Records **locked product decisions** (§16)  
3. Specs UX polish, landing/legal, notes/voice/contacts, and SME modules in enough detail to implement  
4. Defines Phase 1 → 2 → 3 as an **execution order**, not a multi-week roadmap  

**Hard gate:** Locked decisions in §16 are final. Do not re-ask them. Do not ship “coming soon” teasers for accounting, marketing, bookkeeping, or operations — those modules are **in scope and must be built**.

---

## 2. Goals & non-goals

### Goals

| Priority | Goal |
|----------|------|
| P0 | Fix layout/centering bugs on empty list screens; remove spinny loaders from boot; reconcile loading UX |
| P0 | Progressive dashboard density — not jam-packed on first open |
| P0 | Polished onboarding (consistent Continue placement, instant feedback) |
| P0 | Friendly user-facing errors (no raw/dev/404-style messages) |
| P1 | Redesigned welcome/landing with motion + real stock photos + legal links |
| P1 | Properly written Privacy Policy, Terms of Use (± Data Processing / offline notice) |
| P1 | Event-driven local notifications (low stock, overdue, orders, birthdays, backup nudge) |
| P2 | Permissions: contacts (import + birthday reminders / occasional re-sync), microphone (voice notes), photo library polish — just-in-time with rationale |
| P2 | Notes: typed notes + note types + voice recording storage/playback; backup zip includes audio |
| P3 | **Implement** SME office modules: accounting/bookkeeping depth, marketing tools, operations depth — not teased |
| P1–P2 | Accessibility, offline clarity, export discoverability, anti–dark-pattern copy |

### Non-goals (explicit)

- **Not** cloud sync / multi-device accounts (app remains offline-first; data on device)  
- **Not** rewriting the design system or industry engine from scratch  
- **Not** App Store / Play Store listing copy as part of this cycle (legal pages yes; store marketing later)  
- **Not** changing minSdk / Android install diagnostics (already confirmed WhatsApp APK corruption, not minSdk)  
- **Not** multi-user cloud, POS hardware, e-invoicing networks, ad-manager APIs, or full payroll in this cycle  
- **Not** “coming soon” placeholders for in-scope SME modules  

---

## 3. Current state inventory

### Already in the app (do not rebuild)

| Area | What exists |
|------|-------------|
| **Welcome** | `src/app/welcome.tsx` — blue gradient, Aurora, logo, horizontal feature carousel (icon discs), “Get started”. No stock photos, no legal links |
| **Onboarding** | 5 steps (business name → industry → currency → notifications → PIN/biometric); sticky footer; Back+Continue after step 0 |
| **Dashboard** | Industry-driven widgets (typically 7–8: hero, quickActions, profit/stats/pipeline, etc.); `GettingStarted` checklist; collapsible sections |
| **Sales / inventory / etc.** | List screens with `SkeletonList` loading + `EmptyState` CTAs |
| **Notes** | Title/body, pin, color, `[[wiki-links]]`, entity links, card/list/connection views. **No note types. No audio.** |
| **Attachments** | `attachments` table + `pickAttachmentImage()` via `expo-image-picker` |
| **Notifications** | User reminders (local); daily + weekly summary nudges from Settings |
| **Permissions** | Notifications + photo library helpers; biometric via `expo-local-authentication`. Mic explicitly **disabled** in `app.json` image-picker plugin. No contacts |
| **Security** | PIN + biometric lock; Secure Store |
| **Data** | JSON backup/restore; CSV exports (sales, expenses, customers, inventory, orders); demo data |
| **UX infra** | `PressableScale`, haptics, undo toast, confirm dialogs, FAQ/Help, What’s New sheet, per-widget `ErrorBoundary` |
| **EAS** | `eas.json` with development / preview APK / production AAB / production-apk |

### Net-new vs deepen

| Request | Classification |
|---------|----------------|
| Landing redesign + stock images + motion | **Redesign** of existing welcome |
| Privacy / Terms / legal | **Net-new** screens + copy |
| More notifications | **Extend** `notifications.ts` + scheduling hooks on domain events |
| Contacts / mic / richer photos | **Net-new** packages + config plugins + JIT prompts |
| Note types + voice | **Schema + UX expansion** on notes; new `expo-audio` dependency; **zip backup includes audio** |
| Loader strategy | **Policy + fix** (`BrandLoading` still has `ActivityIndicator`) |
| Progressive dashboard | **Behavior change** on widget reveal / defaults |
| Empty-state centering | **Bugfix** in `EmptyState` / Button layout |
| SME office (accounting, marketing, operations) | **Build in Phase 3** — full implementation, not vaporware copy |
| Anti dark-patterns / friendly errors | **Copy + error UX audit** |

---

## 4. Sub-projects & execution order (same-day continuous)

| # | Sub-project | Depends on | Phase |
|---|-------------|------------|-------|
| A | UX foundation: loaders, empty-state centering, button feedback, friendly errors, onboarding Continue consistency | — | **1** |
| B | Progressive dashboard density | A | **1** |
| C | Landing redesign + legal documents | A | **1** |
| D | Notifications expansion (event-driven locals) | A | **2** |
| E | Permissions matrix (contacts, mic, photos polish) | E before F for mic | **2** |
| F | Notes types + voice recordings + zip backup with audio | E | **2** |
| G | SME modules: accounting/bookkeeping, marketing tools, operations depth | A–F stable preferred; may start after C if capacity | **3** |

**Order:** A → B → C → D → E → F → G. Execute continuously; do not stop after polish.

---

## 5. Sequencing approach (locked)

### Continuous same-day vertical delivery (locked)

Execute Phase 1 (UX + landing/legal), then Phase 2 (notes/voice/contacts/permissions/notifications), then Phase 3 (SME modules) **in one continuous session stream**. Sequence work for leverage and dependency order; **do not** frame Phase 1 as a “1–2 week polish-only” ship gate that defers SME modules.

- **Pros:** Matches owner intent — everything built, not teased  
- **Cons:** Large surface; requires clear checklists and binary rebuilds for native modules mid-stream  

**Rejected:** Multi-week “polish MVP only” framing. **Rejected:** “Coming soon” for accounting / marketing / bookkeeping / operations.

---

## 6. Loader strategy (LOCKED)

| Context | Pattern | Forbidden |
|---------|---------|-----------|
| **App boot / full-screen gate** (`AppGate` until DB ready) | **Logo preloader only** — pulse/fade on brand mark; optional short status text (“Opening your books…”) | `ActivityIndicator`, spinners, full-screen skeletons |
| **List / section content load** (sales, inventory, customers, orders, notes list) | **Sparse skeleton** (`SkeletonList` / section shimmer) only when replacing meaningful layout for >~150ms | Spinners in place of content; infinite shimmer |
| **Inline / button busy** (save, export, record payment) | **Button state**: disabled + label change (“Saving…”) or subtle opacity; prefer checkmark success haptic | Spinners on buttons |
| **Search / tiny inline wait** | Prefer muted text “Searching…” or nothing if <100ms | Spinners |

### Code reality to fix

- `BrandLoading` in `src/app/_layout.tsx` — **remove** the white `ActivityIndicator`.  
- `Button` uses `ActivityIndicator` when `loading` — replace with non-spinny busy treatment (opacity + “…” / “Saving…” label).  
- `search.tsx` small spinner — replace with text or omit.  
- Keep `SkeletonList` on list screens; do not expand skeletons to full-app boot.

---

## 7. Progressive dashboard density

### Problem

Industry configs render ~7–8 widgets immediately plus `GettingStarted` — feels jam-packed.

### Design

**Tiered reveal** driven by usage:

1. **Day-0 / empty books**  
   - Show: `GettingStarted` (if not dismissed) + `hero` + `quickActions` (max 3–4 visible).  
   - Hide: stats grids, best sellers, production, expenses charts, debts lists until there is data **or** user expands.

2. **Has some data**  
   - Auto-unlock widgets that have content (e..g. low stock only if threshold breached; debts only if balance > 0; pipeline only if open orders).  
   - Keep empty secondary widgets behind “Show more insights”.

3. **Power user**  
   - Persist expanded set (`dashboard.expanded` or reveal-all flag).  
   - Optional Settings toggle later: “Compact dashboard” (default on) vs “Show everything”.

### Layout breathing room

- Increase vertical rhythm between sections.  
- Hero remains single composition.  
- Quick actions: max 3–4 visible; rest in FAB (already exists).

### Non-goal

Do not remove industry widget *definitions* — only change default visibility / collapse rules.

---

## 8. Layout & centering fixes

### Bug

`EmptyState` centers children via `alignItems: 'center'`, but the CTA `Button` sets `alignSelf: 'stretch'` with `maxWidth: 300`. Stretch overrides cross-axis centering → button pins **left**.

### Fix

- CTA: `alignSelf: 'center'`, `width: '100%'`, `maxWidth: 300`.  
- `EmptyState` container: `width: '100%'`; mid-viewport empty via flexGrow / minHeight.  
- Audit all `EmptyState` call sites.  
- Spot-check tablet / wide layouts.

---

## 9. Landing page redesign + legal

### Product subject

**Trackr** = all-in-one SME office on your phone — cash, stock, customers, profit, notes, and ops tools. Feel: **confident, practical, daylight workshop / stall ledger** — not fintech purple glow, not cream-serif lifestyle blog, not neo-brutal newspaper.

### Visual direction (LOCKED imagery: brand-led hero + real stock photos below)

| Token | Choice |
|-------|--------|
| Primary | Brand blue `#2563EB` |
| Surface | Soft cool gray-blue daylight; deep navy night panels for hero only |
| Accent | Teal/cyan info sparingly; tone down purple Aurora on welcome |
| Type | Montserrat (existing) |
| Imagery | **Option C:** Brand-led first viewport (logo + wordmark hero signal); **real stock photos** in lower feature sections (market stall / shop counter / notebook+phone) |
| Motion | Logo → wordmark → CTA entrance; parallax / entrance on feature photo beats |

### Structure (first viewport budget)

1. Brand (logo + **Trackr**) as hero signal  
2. One headline  
3. One supporting sentence  
4. One CTA (“Get started”)  
5. Brand-led visual plane (gradient / Aurora — not a card collage)  

Below fold: real stock photo feature sections, privacy trust line, links to legal.

### Legal documents (in-app)

| Doc | Purpose |
|-----|---------|
| **Privacy Policy** | On-device storage, permissions rationale, user-controlled backups, contact |
| **Terms of Use** | License, no warranty for business decisions, backup responsibility, liability |
| **Offline & Data Notice** | No Trackr cloud account; uninstall may erase data; export recommended |

**Placement:** Welcome footer; Settings / More → Legal; onboarding optional agree line with links.

**Implementation:** `src/app/legal/privacy.tsx`, `terms.tsx` (or `legal/[slug].tsx`) + in-repo offline content.

---

## 10. Notes: types + voice architecture

### Note types

Add `notes.note_type` (TEXT, default `'text'`):

| Type | Behavior |
|------|----------|
| `text` | Current title + body + wiki links |
| `checklist` | Body as line items with `[ ]` / `[x]` toggles |
| `voice` | Title + optional caption; primary content = audio attachment(s) |
| `linked` | UX preset starting from “link to entity” |

### Voice recordings

- **Library:** `expo-audio` (SDK 57) — `microphonePermission`; `recordAudioAndroid: true`.  
- **Storage:** `Paths.document/attachments/`; `attachments` row with audio mime.  
- **UX:** Tap-to-toggle record; waveform; inline playback.  
- **Permissions:** JIT before first record.  
- **Backup (LOCKED):** Include audio files in backup **zip** when voice ships.

### Migrations

- `ALTER TABLE notes ADD COLUMN note_type TEXT NOT NULL DEFAULT 'text';`  
- Optional: `duration_ms` on attachments  

---

## 11. Permissions matrix

| Permission | Today | Needed for | When to ask | Config |
|------------|-------|------------|-------------|--------|
| **Notifications** | Yes | Reminders, nudges, event alerts | Onboarding opt-in + Settings | Existing + category channels |
| **Photo library** | Partial | Product images, note/receipt photos | First attach | Unify via `permissions.ts` |
| **Camera** | Disabled | Optional receipts later | Not required for Phase 1–2 | Leave false unless needed |
| **Microphone** | Explicitly false | Voice notes | First voice record | `expo-audio` plugin |
| **Contacts (LOCKED)** | None | Import customers + birthday reminders + **occasional re-sync** | First import / re-sync | `expo-contacts` read-only |
| **Biometric** | Yes | App lock | Onboarding / Settings | Existing |

### Principles

- Ask **just in time**, with rationale before OS prompt.  
- Denied → path to Settings; never block core bookkeeping.  
- Contacts: import selected → customer; birthday field → notification; occasional re-sync refreshes names/phones/birthdays user opts into.  
- New native modules need a **new EAS build**.

---

## 12. Notifications plan

### Keep

- User-created reminders  
- Opt-in daily / weekly summary nudges  

### Add (local, event-driven)

| Event | When | Channel | Default |
|-------|------|---------|---------|
| **Low stock** | Threshold crossed | `inventory` | On if granted; throttle 1/day/item |
| **Overdue debt / credit** | Aging after credit sale | `payments` | Off until enabled |
| **Order due** | Morning of / 1h before | `orders` | On when module used |
| **Customer birthday** | Morning of birthday | `crm` | Off by default |
| **Backup reminder** | Weekly if no backup in N days | `system` | Off by default |

### Rules

- All local; no push server.  
- Per-category toggles in Settings.  
- Helpful copy — never guilt or fake urgency.  
- Cancel/reschedule when records change.

---

## 13. SME platform roadmap (LOCKED — implement, do not tease)

**Positioning (LOCKED):** “All-in-one SME office.” Accounting, marketing, bookkeeping, and operations are **in scope** and must be **implemented** in Phase 3 of this execution — not promised as “coming soon.”

Trackr today is already strong **operations + light bookkeeping**. Phase 3 deepens and adds marketing tooling.

### Phase 1 — UX polish + landing/legal

Loaders, density, empty states, onboarding, friendly errors, welcome redesign, Privacy + Terms.

### Phase 2 — Notes / voice / contacts / permissions / notifications

Voice notes, note types, contacts import + birthday reminders + occasional re-sync, zip backup with audio, event-driven locals.

### Phase 3 — SME modules (build fully)

**Accounting / bookkeeping**

- Chart of simple cash categories / P&L report polish  
- Optional tax/VAT fields per region  
- Period lock / monthly close snapshots (extend `profit_records`)  
- Receipt image attach on expenses  

**Marketing tools**

- Birthday / follow-up reminders (ties to contacts + notifications)  
- Simple message templates (copy / share sheet — not WhatsApp Business API)  
- Customer notes timeline  

**Operations depth**

- Stronger order/pipeline workflows, restock flows, recurring expenses polish, export discoverability from empty states  

### Explicitly later / out of this cycle

- Multi-user cloud, POS hardware, e-invoicing networks, ad managers, full payroll  

---

## 14. UX quality bar

| Rule | Spec |
|------|------|
| **No spinny loaders** | Per §6 |
| **Instant feedback** | `PressableScale` + haptics on primary actions |
| **Onboarding Continue** | Same footer slot; Back left ghost; Continue/Finish right; equal height 56; honest “Skip for now” |
| **Anti dark patterns** | Clear destructive labels; no confirm shaming |
| **Friendly errors** | Map to human sentences; friendly `+not-found`; no raw SQLite/stack to users |
| **Accessibility** | Labels; `reduceMotion`; contrast; ≥44pt targets |
| **Offline honesty** | FAQ + legal + empty states reinforce on-device + backup |

---

## 15. Missing items (include)

| Item | Phase | Notes |
|------|-------|-------|
| Friendly `+not-found` route | 1 | Expo Router |
| Backup zip includes media/audio | 2 | Locked with voice |
| Accessibility pass | 1/1 | Labels, focus |
| Reduced-motion on welcome | 1 | Required |
| Notification categories + Settings UI | 2 | |
| Camera for receipts | 3 optional | If needed for expense attach |
| Store privacy nutrition labels | 1 | Match Privacy Policy |
| Localization beyond currency | Later | EN-first |

---

## 16. Locked decisions (formerly open questions)

| # | Decision | Choice |
|---|----------|--------|
| 1 | **Loaders** | Logo preloader for boot/full-screen; **sparse skeletons for content lists only**; **NO spinners anywhere** |
| 2 | **Landing imagery** | **C** — brand-led hero + real stock photos in lower sections |
| 3 | **Backup + voice** | **A** — include audio files in backup zip when voice ships |
| 4 | **Contacts** | **B** — import + birthday reminders / occasional re-sync |
| 5 | **Positioning** | **B** — “All-in-one SME office”; SME modules **implemented**, never “coming soon” |

---

## 17. Phase scopes (execution order, same day)

### Phase 1 — UX polish + landing/legal

1. Remove boot `ActivityIndicator`; logo-only `BrandLoading`  
2. Replace button/search spinners with non-spinny busy states  
3. Fix `EmptyState` centering + mid-viewport empty layout  
4. Progressive dashboard defaults (compact / data-gated widgets)  
5. Onboarding footer consistency + micro-polish  
6. Friendly not-found + error copy audit  
7. Welcome redesign (brand-led hero + stock photos below)  
8. Privacy + Terms in-app + links  

### Phase 2 — Notes / voice / contacts / permissions / notifications

Voice notes, note types, contacts import + birthdays + re-sync, zip backup with audio, event-driven notification channels.

### Phase 3 — SME modules

Accounting/bookkeeping depth, marketing tools, operations depth — **ship working features**, not teasers.

---

## 18. Codebase blockers / watchouts

| Blocker / risk | Detail |
|----------------|--------|
| **New native modules** | `expo-audio`, `expo-contacts` need EAS rebuild |
| **Mic currently disabled** | `app.json` image-picker `microphonePermission: false` — add `expo-audio` carefully |
| **Backup gap** | JSON backup may not package binaries — zip with audio is required when voice ships |
| **EmptyState stretch bug** | High visibility; localized fix |
| **BrandLoading contradiction** | Logo + spinner today vs locked policy |
| **Dashboard density** | Visibility layer over industry widget lists |
| **Legal liability** | Draft policies need owner review before store submission |
| **SME scope size** | Phase 3 is large — keep modules shippable vertical slices |

---

## 19. Spec self-review

| Check | Result |
|-------|--------|
| Placeholders | Locked decisions replace open questions |
| Contradictions | Loader policy locked in §6 |
| Scope | Phases are execution order; SME modules in Phase 3, not deferred indefinitely |
| Expo 57 | Audio/contacts/image-picker against v57 docs |

---

## 20. Next step

1. Implementation plan: `docs/superpowers/plans/2026-07-20-trackr-product-refinement.md`  
2. Execute Phase 1 Step 1 cluster immediately; continue through Phase 2–3 without “coming soon” framing  

---

*End of design spec.*
