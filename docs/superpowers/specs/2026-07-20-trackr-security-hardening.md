# Trackr security hardening assessment

**Date:** 20 July 2026  
**Scope:** Expo SDK 57 offline-first SME app (`trackr`)  
**Status:** Next-release hardenings **shipped in code** (this pass). SQLCipher and integrity theater remain later / out of scope.

---

## 1. Threat model (reality check)

Trackr keeps sales, customers, inventory, notes, and attachments **on device**. There is no Trackr cloud account, so remote account takeover and server breaches are largely out of scope. The realistic threats are: **physical access** to an unlocked or briefly unlocked phone, **backup file theft** (Drive / WhatsApp / email), **ADB / rooted access** to app sandbox files, and **APK cloning** (competitor copies UI/features).

A React Native / Expo client **cannot** be fully protected from reverse engineering, modding, or a determined attacker with the device. App lock is a **UX gate**, not encryption. Treat “avoiding hacks and modding” as **raising the cost of casual theft**, not as DRM.

---

## 2. What’s already in place (good)

| Area | Current state |
|------|----------------|
| **App lock** | Optional PIN (4–6 digits) + optional biometrics; gated in `_layout` → `/lock` when `locked` |
| **PIN storage** | Salted hash in `expo-secure-store` (`src/lib/auth.ts`) — not plaintext PIN |
| **Biometrics** | `expo-local-authentication`; Face ID string in `app.json` |
| **Business data locality** | No app-side network API for books; legal copy matches offline-first |
| **Attachments ownership** | Copied into app `Paths.document/attachments/` (not raw picker URIs) |
| **Restore confirmations** | User warned that restore replaces all data |
| **Prod packaging** | EAS `production` uses Android App Bundle |

---

## 3. Shipped this pass (next release)

| Item | What shipped |
|------|----------------|
| **P2 Re-lock on background** | `AppState` in `app-context`: after ~15s background/inactive, `lock()` if lock enabled + onboarded. Grace avoids share sheets / pickers. |
| **P2 Screen / switcher privacy** | `expo-screen-capture` on lock screen (`preventScreenCaptureAsync` + iOS `enableAppSwitcherProtectionAsync`). iOS switcher blur also while unlocked with lock enabled. |
| **P4 PIN rate limit** | After 5 failed attempts, exponential lockout (30s → doubles, cap 15 min). Lock pad shows remaining time. |
| **P4 Confirm to disable / change PIN** | Confirm dialog + biometric or current PIN before turning lock off or changing PIN. Copy clarifies lock ≠ disk encryption. |
| **P4 Stronger PIN KDF** | New PINs use PBKDF2-SHA256 (100k) via SubtleCrypto when available; legacy single SHA-256 still verifies and migrates to v2 on successful unlock. Stored as `trackr_pin_kdf` = `1` \| `2`. |
| **P1 Passphrase backups** | Export builds fflate zip then AES-GCM wraps it (`.trackrbackup`, magic `TRKRBK01`, PBKDF2 210k). Restore requires passphrase. Legacy plaintext zip/JSON still restore with an explicit warning. |
| **Honest FAQ / settings** | FAQ + Settings security subtitle: lock ≠ encryption; backups should be passphrase-protected when sharing. |
| **Android Auto Backup** | `android.allowBackup: false` in `app.json`. |
| **Legal copy** | Privacy / Terms / Offline sections updated for passphrase-encrypted backups. |

### PIN KDF migration note

- **v1 (legacy):** `SHA-256(salt:pin)` — still accepted.
- **v2 (current):** PBKDF2-SHA256, 100_000 iterations, 256-bit key (SubtleCrypto); modest iterated-digest fallback if PBKDF2 unavailable.
- On successful v1 verify, hash is upgraded in place to v2 (same salt). No user action required.

### Encrypted backup format (v1 container)

```
magic "TRKRBK01" (8) | salt (16) | AES-GCM sealed zip (IV + ciphertext + tag via expo-crypto)
```

---

## 4. Gaps still open (honest)

| Gap | Why it matters |
|-----|----------------|
| **SQLite plaintext** | `trackr.db` via default `expo-sqlite` — PIN does not encrypt the DB |
| **Attachments plaintext** | Voice/photos readable with filesystem access |
| **Biometric device fallback** | `disableDeviceFallback: false` — device passcode can unlock without Trackr PIN |
| **Lock is UI-only** | Debugger / patched JS / direct DB open bypasses lock entirely |
| **No root / integrity checks** | Expected for this class of app; detection is bypassable |
| **Android switcher when unlocked** | Full FLAG_SECURE only on lock screen (so receipts can still be screenshotted while unlocked) |

---

## 5. Hardening plan (impact × effort for *this* app)

### P1 — Encrypt backups with a passphrase — **DONE (this pass)**

### P2 — Re-lock on background + privacy overlay — **DONE (this pass)**

### P3 — SQLCipher for `trackr.db` (+ attachment strategy) *(high impact, high effort)* — **later**

**Threat:** Rooted device, forensic copy, some backup agents.  
**Do:** Enable `expo-sqlite` plugin `useSQLCipher: true`, set `PRAGMA key` immediately after open ([SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)). Store DB key in SecureStore; unlock flow derives/unlocks key. **Requires prebuild / EAS (not Expo Go)** and a one-time migration of existing plaintext DBs.  
**Attachments:** Encrypt at rest or store under encrypted container; otherwise DB encryption alone leaves media exposed.

### P4 — Harden PIN / lock UX — **DONE (this pass)** (device-passcode fallback left intentional)

### P5 — Production / platform hygiene — **partially DONE** (`allowBackup: false`; keep shipping release Hermes only)

---

## 6. What *not* to bother with (false security)

| Idea | Why skip / deprioritize |
|------|-------------------------|
| **Root/jailbreak detection as a hard gate** | Trivially bypassed; frustrates legitimate power users |
| **Play Integrity / App Attest as core defense** | Useful for online abuse; little value when all secrets/data are local |
| **JS obfuscation / “anti-modding”** | Raises curiosity cost slightly; does not protect data at rest |
| **Trying to stop APK feature cloning** | UI/logic will be readable; compete on product, not DRM |
| **Claiming “bank-grade” because of PIN** | Misleads users; PIN ≠ encryption |

---

## 7. Implement now vs later

| When | What |
|------|------|
| **Now / next release** | ~~P2~~ ~~P4~~ ~~P1 backups~~ ~~FAQ honesty~~ ~~Android allowBackup~~ — **shipped** |
| **Later (dedicated security milestone)** | P3 SQLCipher + attachment encryption |
| **Skip unless threat changes** | Integrity APIs, anti-tamper, heavy obfuscation |

---

## 8. Expo SDK 57 references

- [expo-sqlite / SQLCipher](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)
- [expo-secure-store](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/)
- [expo-local-authentication](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/)
- [expo-screen-capture](https://docs.expo.dev/versions/v57.0.0/sdk/screen-capture/)
- [expo-crypto](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/)

---

## 9. Code map

- PIN / biometrics / rate limit / KDF: `src/lib/auth.ts`, `src/app/lock.tsx`, `src/app/settings.tsx`
- Lock gate + background re-lock + iOS switcher blur: `src/context/app-context.tsx`, `src/app/_layout.tsx`
- Screen capture on lock: `src/app/lock.tsx` (`expo-screen-capture`)
- DB: `src/db/client.ts` (`trackr.db`, no SQLCipher yet)
- Backups: `src/lib/backup.ts`, `src/lib/backup-crypto.ts`, UI in `settings.tsx` / `data.tsx`
- Attachments: `src/lib/attachments.ts`

---

## 10. Release note

**EAS rebuild required: YES** — `expo-screen-capture` is a native module; `android.allowBackup: false` needs a new native build. Not sufficient to ship JS-only OTA for these items.

*End of security hardening assessment.*
