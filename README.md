This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Backend API

This dashboard talks to a separate Core PHP + MySQL API (delivered as its own
`/api` bundle — see that project's README for endpoints).

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_API_URL` to where
   you deployed the `/api` folder (no trailing slash), e.g.:
   ```
   NEXT_PUBLIC_API_URL=https://your-domain.com/api
   ```
2. `AppShell.tsx` injects that value as `window.__NS_API_BASE__` and loads
   `public/js/api-client.js`, which exposes `window.NsApi.*` (listCompanies,
   createLead, convertLead, getAnalytics, etc.) for calling the backend.
3. **Current status:** `public/js/dashboard.js` still reads/writes
   `localStorage` for its data (companies, leads, contacts, notes,
   follow-ups) — `window.NsApi` is wired up and ready to call, but swapping
   dashboard.js's `save*`/load functions over to it is a follow-up pass
   (that file keys almost everything off company name rather than a DB id,
   so it needs to go function-by-function rather than a single find/replace).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
