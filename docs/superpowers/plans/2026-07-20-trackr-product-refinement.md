# Trackr Product Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Trackr as a refined all-in-one SME office: UX polish + landing/legal, then notes/voice/contacts/notifications, then accounting/marketing/operations modules — continuous same-day execution, no “coming soon.”

**Architecture:** Offline-first Expo SDK 57 app; SQLite via existing repos; UI via `src/components/ui.tsx` + industry widgets; new native modules (`expo-audio`, `expo-contacts`) only in Phase 2 after UX that needs no new binaries.

**Tech Stack:** Expo SDK 57, Expo Router, Reanimated, SecureStore, SQLite, expo-notifications; later expo-audio, expo-contacts, zip backup.

**Spec:** `docs/superpowers/specs/2026-07-20-trackr-product-refinement-design.md`  
**Commits:** Only when the user explicitly asks — do not auto-commit.

**Expo docs:** https://docs.expo.dev/versions/v57.0.0/

---

## File map (high level)

| Area | Primary files |
|------|----------------|
| Loaders / boot | `src/app/_layout.tsx`, `src/components/ui.tsx` (Button), `src/app/search.tsx` |
| Empty states | `src/components/ui.tsx` (`EmptyState`) |
| Dashboard density | `src/components/dashboard/renderer.tsx`, `src/lib/dashboard-visibility.ts` (new), `src/components/dashboard/widgets.tsx` (quickActions cap) |
| Friendly errors | `src/lib/errors.ts` (new), `src/context/app-context.tsx`, `src/app/settings.tsx`, `src/app/data.tsx`, `src/app/+not-found.tsx` (new) |
| Onboarding | `src/app/onboarding.tsx` |
| Landing + legal | `src/app/welcome.tsx`, `src/app/legal/*`, `assets/images/landing/*` |
| Notes / voice | notes schema/repos, `expo-audio`, attachments, backup zip |
| Contacts | `expo-contacts`, customers repo, birthday notifications |
| SME modules | reports/profit/expenses/customers + new marketing/templates screens |

---

## Phase 1 — UX polish + landing/legal

### Task 1: Logo-only boot (no spinner)

**Files:**
- Modify: `src/app/_layout.tsx`

- [x] **Step 1: Remove `ActivityIndicator` from `BrandLoading`**
- [x] **Step 2: Smoke-check** (logo + “Opening your books…”; no spinner)

---

### Task 2: Non-spinny button + search busy states

**Files:**
- Modify: `src/components/ui.tsx` (`Button`)
- Modify: `src/app/search.tsx`

- [x] **Step 1: Replace Button `ActivityIndicator` with label/opacity busy state**
- [x] **Step 2: Replace search spinner with muted text**

---

### Task 3: Fix EmptyState CTA centering

**Files:**
- Modify: `src/components/ui.tsx` (`EmptyState`)

- [x] **Step 1: Fix layout**
- [ ] **Step 2: Visually verify** (device/simulator — next agent or user)

---

### Task 4: Progressive dashboard density

**Files:**
- Create: `src/lib/dashboard-visibility.ts`
- Modify: `src/components/dashboard/renderer.tsx`
- Modify: `src/components/dashboard/widgets.tsx` (cap quick actions at 4)
- Modify: `src/app/(tabs)/index.tsx` if needed to pass `data` (already passed)

- [x] **Step 1: Add visibility helper**
- [x] **Step 2: Update `DashboardRenderer`**
- [x] **Step 3: Cap quick actions**
- [ ] **Step 4: Verify day-0 dashboard** (device/simulator)

---

### Task 5: Friendly errors + not-found

**Files:**
- Create: `src/lib/errors.ts`
- Create: `src/app/+not-found.tsx`
- Modify: `src/context/app-context.tsx`
- Modify: `src/app/settings.tsx`
- Modify: `src/app/data.tsx`

- [x] **Step 1: `toUserMessage`**
- [x] **Step 2: Wire call sites**
- [x] **Step 3: Add `+not-found.tsx`**

---

### Task 6: Onboarding Continue consistency

**Files:**
- Modify: `src/app/onboarding.tsx`

- [x] **Step 1: Footer buttons `size="lg"` (height 56)**

---

### Task 7: Landing redesign (brand-led + stock photos)

**Files:**
- Modify: `src/app/welcome.tsx`
- Add: `assets/images/landing/*.jpg` (licensed stock)
- Skill: frontend-design when implementing

- [x] Brand-led first viewport (logo + Trackr hero, one headline, one sentence, Get started)  
- [x] Lower sections with real stock photos  
- [x] Tone down purple Aurora; 2–3 entrance motions; honor `reduceMotion`  
- [x] Footer links to Privacy / Terms  

---

### Task 8: Legal documents

**Files:**
- Create: `src/app/legal/privacy.tsx`, `src/app/legal/terms.tsx` (or `[slug].tsx`)
- Modify: welcome + settings/more to link

- [x] Offline-readable Privacy + Terms + Offline & Data notice  
- [x] Owner review note in FAQ or doc header before store submit  

---

## Phase 2 — Notes / voice / contacts / permissions / notifications

### Task 9: Permissions façade + packages

- [x] Add `expo-contacts`, `expo-audio` per Expo 57 docs; update `app.json` plugins; fix mic conflict with image-picker  
- [x] Extend `src/lib/permissions.ts` with contacts + microphone JIT + rationale  
- [ ] New EAS build required before device QA  

### Task 10: Note types + voice

- [x] Migration: `note_type` on notes; optional `duration_ms` on attachments  
- [x] Voice record/playback UI; waveform  
- [x] Zip backup includes `attachments/` audio (LOCKED)  

### Task 11: Contacts import + birthdays + re-sync

- [x] Import flow → customers  
- [x] Birthday field + morning local notification  
- [x] Occasional re-sync entry point  

### Task 12: Event-driven notifications

- [x] Channels: inventory, payments, orders, crm, system  
- [x] Low stock, overdue, order due, birthday, backup nudge  
- [x] Settings category toggles  

---

## Phase 3 — SME modules (implement fully)

### Task 13: Accounting / bookkeeping

- [x] Category chart / P&L polish on reports  
- [x] Optional tax/VAT fields  
- [x] Period lock / monthly close snapshots  
- [x] Receipt attach on expenses  

### Task 14: Marketing tools

- [x] Message templates (copy/share)  
- [x] Customer timeline / follow-ups  
- [x] Birthday campaigns via local reminders  

### Task 15: Operations depth

- [x] Pipeline/restock/recurring polish  
- [x] Export CTAs from empty states  
- [x] Remove any leftover tease/coming-soon copy  

---

## Verification checklist (ongoing)

- [x] No `ActivityIndicator` left in product UX paths (grep `ActivityIndicator`)  
- [ ] Empty CTAs centered on phone + wide (code fixed; device/simulator verify remaining)  
- [ ] Day-0 dashboard sparse; expands with data (code gated; device/simulator verify remaining)  
- [x] Errors never show raw 404/stacks (`toUserMessage` + receipt share/print)  
- [x] Landing + legal offline  
- [x] Voice backup zip contains audio  
- [x] SME modules usable end-to-end (not stubs)  
- [x] Hub EmptyStates use compact layout (Accounting / Marketing / Operations / Profit)  
- [x] Interactive rows/chips/icon buttons give haptic + press feedback  
- [x] Marketing template editor back closes editor (does not `router.back` off-screen)  

---

## Spec coverage self-check

| Spec section | Tasks |
|--------------|-------|
| §6 Loaders | 1–2 |
| §7 Dashboard | 4 |
| §8 EmptyState | 3 |
| §9 Landing/legal | 7–8 |
| §10–11 Notes/voice/contacts | 9–11 |
| §12 Notifications | 12 |
| §13 SME | 13–15 |
| §14 Errors/onboarding | 5–6 |
| Locked §16 | Reflected throughout |

---

*Plan complete. Execute Task 1 cluster next without waiting.*
