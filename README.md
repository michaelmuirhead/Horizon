# Horizon

A Next.js PWA for personal finance — envelope-style budgeting in the spirit of YNAB.

The Home and Budget tabs are built; the other tabs are placeholders awaiting design screens.

## Bottom navigation (left to right)

1. **Home** — Pinned categories, current goal, monthly summary, future-month assignments.
2. **Budget** — Plan and assign money to categories.
3. **Spending** — Transactions list and categorization.
4. **Accounts** — Connected accounts and balances.
5. **Reflect** — Trends, net worth, reports.

## Tech stack

- [Next.js 15](https://nextjs.org/) (App Router) + React 19
- TypeScript
- Tailwind CSS for styling
- [lucide-react](https://lucide.dev/) icons
- PWA: `public/manifest.json` + `public/sw.js` registered in `components/layout/PWARegister.tsx`

## Project layout

```
app/
├── layout.tsx              Root HTML + metadata + SW register
├── globals.css             Tailwind + base styles
└── (tabs)/                 Route group sharing the BottomNav
    ├── layout.tsx
    ├── page.tsx            Home
    ├── budget/page.tsx
    ├── spending/page.tsx
    ├── accounts/page.tsx
    └── reflect/page.tsx
components/
├── layout/                 BottomNav, Placeholder, PWARegister
├── home/                   Home sections + illustrations
└── budget/                 Toolbar, group section, available pill
lib/
├── budget.ts               Types + sample data
└── format.ts               Currency formatter
public/
├── manifest.json
├── sw.js
├── icon.svg
└── icon-maskable.svg
```

## Local development

```sh
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
```

The service worker is intentionally **only registered in production builds**, so
`npm run dev` won't cache stale assets while you iterate.

## Deploying to Vercel

Push to GitHub and import the repo at [vercel.com/new](https://vercel.com/new).
No special config needed — Vercel detects Next.js automatically.

After the first deploy, visit the site on iOS Safari → Share → **Add to Home Screen**
to install. On Chrome/Edge desktop you'll get a native install prompt.

## Notes on the visuals

- Dark mode only (forced via `color-scheme: dark` and `themeColor`).
- Home gradient (blue → green) sits behind the header and fades into the page background.
- Tab-bar pill background highlights the active tab; accent purple is `#6366f1`.
- The Pinned and Goal illustrations are Lucide-icon compositions standing in for
  custom artwork — easy to swap for SVG/PNG assets later.
- The PWA icon is a single SVG for simplicity; for the highest-fidelity install
  experience on iOS you'll likely want to add `apple-touch-icon` PNGs.
