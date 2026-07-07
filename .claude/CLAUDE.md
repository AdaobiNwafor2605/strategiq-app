# Project: Strategiq

## What this project is
✏️ StrategiQ is a SaaS analytics and data science platform built specifically for Shopify clothing brands. It combines customer segmentation, machine learning, and strategic recommendations to tell brand owners what to do next — not just show them charts.
It is positioned as an outsourced data analyst, customer insights team, and growth strategist built into a single tool. The goal is to make data-driven decisions accessible to brand owners who do not have an internal data team.
One-Line Positioning
StrategiQ helps Shopify clothing brands understand their customers, predict opportunities, and take smarter weekly marketing actions — without needing a data team.



✏️ [Who uses it: The primary user is a Shopify clothing brand owner or operator who wants to grow sales, improve retention, and understand their customers better. They do not have an internal data team. They may have access to Shopify analytics, but they cannot turn that data into customer strategy.


## Tech stack
- Frontend: Next.js (App Router), React, TypeScript, Tailwind CSS
- Backend: Python / FastAPI
- Database + Auth: Supabase (PostgreSQL, Row Level Security, Storage)
- Runtime: Node.js for tooling/scripts
- Deployment: ✏️ [e.g. Vercel for frontend, Render for backend]

## Project structure
✏️ [Copy your folder structure here — run `ls` in your project root
    and paste what you see. Even rough is fine. Example:]
ADVANCED_ANALYTICS_README.md	README.md
backend				scripts
dist				shared
eslint.config.js		src
index.html			tailwind.config.js
node_modules			tsconfig.app.json
package-lock.json		tsconfig.json
package.json			tsconfig.node.json
postcss.config.js		vite.config.ts

## Key commands
✏️ [Fill in how to run your project locally. Examples:]
# npm run dev          → start frontend 
# npm run backend

## Database
- Supabase project: ✏️ [krmflpybnrzdzctomvpu]
- Key tables: ✏️ [e.g. users, profiles, datasets, orders]
- Always use Row Level Security (RLS) on new tables
- Never expose the service role key in frontend code

## How this project is built
- Build in small steps, test each one before moving on
- Always check existing files before creating new ones
- Don't break existing imports or working functionality
- When changing the UI, don't touch data fetching or API logic
- Use Supabase client from /src/lib/supabase.ts (don't create new instances)

## What's currently working
✏️ [List what's already built and working, so Claude doesn't rebuild it.
    Example:]
# - User auth (Supabase email/password)
# - Dashboard page with basic layout


## Routing
- This app uses state-based navigation in App.tsx — NOT React Router
- Never introduce React Router or any routing library without asking me first