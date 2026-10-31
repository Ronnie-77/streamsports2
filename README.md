# StreamSports — Live Sports Streaming Platform

A production-grade live sports streaming website with a spatial UI design.

## Features
- Live matches, schedule, and IPTV channels
- Premium video player (HLS/DASH/MPEG-TS/MP4) with hls.js, dashjs, mpegts.js
- Admin panel with branding, ads control, API source management, channel curation
- Multiple API source support (DAMITV, Cinevid, Vidcdn IPTV)
- Auto/Manual content mode
- Spatial glassmorphism UI with Apple SF Pro fonts
- Light/dark theme
- Responsive (mobile/tablet/desktop)

## Tech Stack
- Next.js 16 (App Router, standalone output)
- TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM (SQLite)
- React Query + Zustand
- Framer Motion
- hls.js / dashjs / mpegts.js

## Setup
1. `bun install`
2. Copy `.env.example` to `.env` and set variables
3. `bun run db:push`
4. `bun run dev`

## Deploy to Cloudflare
1. Upload to GitHub
2. Set environment variables: `ADMIN_PASSWORD`, `DATABASE_URL`, `NODE_ENV=production`
3. `bun run build`
4. Deploy `.next/standalone/` to Cloudflare Pages or Workers

## Admin Access
- Navigate to `/admin`
- Password: set via `ADMIN_PASSWORD` env var

## License
All streams provided by third-party public APIs. We do not host any content.
