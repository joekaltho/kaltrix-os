Set-Content -Encoding UTF8 "docs\technical.md" "# KaltrixOS — Technical Documentation

## Tech Stack
- Frontend: Next.js 16, TypeScript, Tailwind CSS v4
- Backend: Next.js API Routes, Supabase (PostgreSQL)
- Auth: Supabase Auth
- Storage: Supabase Storage
- Charts: Recharts
- Hosting: Vercel
- Repo: GitHub

## Project Structure
- src/app/(auth) — Login and Register pages
- src/app/(dashboard)/dashboard — Business OS dashboard
- src/app/(dashboard)/admin — Admin command center
- src/app/(public)/discover — Public discovery page
- src/app/(public)/business/[slug] — Business profile pages
- src/app/page.tsx — Landing page
- src/lib/supabase — Supabase client files
- src/types — TypeScript interfaces
- docs — Project documentation

## Database Tables
- profiles — User accounts and roles
- businesses — Business profiles and TrustScores
- bookings — Appointment and booking records
- customers — Business CRM contacts
- invoices — Invoice records with line items
- messages — Customer to business messages
- reviews — Business reviews and ratings
- waitlist — Pre-launch email signups
- leads — Agency lead pipeline

## TrustScore Algorithm
- Business name: +10
- Industry set: +10
- City set: +10
- Phone number: +15
- Website URL: +20
- Description over 100 chars: +15
- Logo uploaded: +20
- Maximum score: 100

## Security
- Row Level Security enabled on all tables
- Users can only access their own data
- Admin role required for admin routes
- Route protection via Next.js middleware
- All sensitive keys in environment variables

## Environment Variables
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY

## Deployment
- Push to GitHub main triggers Vercel auto-deploy
- Environment variables configured in Vercel dashboard"