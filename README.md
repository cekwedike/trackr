# Trackr

A business tracker for SMEs — an account book, notebook and analytics tool in your pocket. Built with Expo (SDK 57) and offline-first local storage.

_A product of Siryus Creative Media Ltd._

## Features

- **Dashboard** — revenue, expenses, net profit, low-stock alerts, active orders, debts and upcoming reminders at a glance.
- **Sales tracker** — record what you sell, quantities, payment method, customer and date; automatically decrements stock.
- **Expense tracker** — log spending with amount, description, category and date.
- **Inventory** — products, ingredients and recipes with stock levels, units, costs and low-stock / reorder alerts.
- **Recipe cost calculator** — ingredient cost per batch, cost per unit, suggested price and expected profit.
- **Profit calculator** — revenue − COGS − expenses over any period, plus a configurable profit-allocation split (default 50% business / 20% savings / 10% emergency / 10% tithes / 10% owner).
- **Orders & customers** — manage orders through their lifecycle; store customers with phone, birthday and outstanding debts.
- **Notes** — a notebook with `[[wiki-links]]`, backlinks and the ability to link notes to records (products, customers, orders), like Obsidian.
- **Reminders** — one-off and recurring local notifications.
- **Analytics** — best sellers, monthly revenue/expense/profit trends, growth and payment breakdowns.
- **Security** — local PIN + biometric app lock. Data never leaves the device.
- **Backup** — export/import all data to a JSON file.

## Tech stack

- Expo SDK 57, React Native, TypeScript, Expo Router (file-based navigation)
- `expo-sqlite` with a hand-written typed data layer and migration runner
- `expo-local-authentication` + `expo-secure-store` (hashed PIN, biometric unlock)
- `expo-notifications` for reminders
- Themed `StyleSheet` design system (light + dark)

Money is stored as integer minor units to avoid floating-point errors.

## Getting started

```bash
npm install
npx expo start
```

Open in Expo Go (JS only) or, for full native module support, a development build.

## Building an Android APK

Local native builds aren't set up on this machine (no Android SDK). Use EAS Build (cloud):

```bash
# 1. Install the EAS CLI and log in (needs a free Expo account)
npm install -g eas-cli
eas login

# 2. Link the project (writes a projectId into app.json)
eas init

# 3. Build an installable APK (uses the "preview" profile in eas.json)
eas build --platform android --profile preview
```

When the build finishes, EAS gives you a download link for the `.apk` you can install on any Android device.

For a Play Store build (AAB) use `--profile production`.

## Project structure

```
src/
  app/                 Expo Router routes (tabs + stack screens)
  components/          UI kit, pickers, and shared entity forms
  constants/           theme tokens, currencies
  context/             app-wide settings/lock provider
  db/                  SQLite client, schema/migrations, typed repositories
  hooks/               theme + data-loading hooks
  lib/                 money, dates, profit engine, auth, notifications, backup
```
