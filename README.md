# SPEctrum v2 — Project Board

Scrum project management for SPE teams. This release rebuilds the **Project Board** module of SPEctrum with a new information architecture and the SPE Nova design language.

> Prototype status: the app runs fully in the browser. Data is sample data stored in `localStorage` (Account menu › **Reset demo data** restores it). There is no backend yet.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # domain + store unit tests (Vitest)
npm run typecheck
npm run build
```

## Deploy (Netlify)

`netlify.toml` configures everything: build command `npm run build`, publish directory `dist`, Node 22, and a catch-all redirect to `index.html` so deep links like `/projects/p-at/sprints/…` work. If the site was created before this file existed, check **Site configuration › Build & deploy** and clear any manually set publish directory (it must be `dist`, not the repo root), then trigger a new deploy.

## Team workspace (Supabase)

With Supabase connected, SPEctrum is a shared workspace: sign-in with **Supabase Auth** (email + password, **Microsoft** via the Azure provider, password reset) and all board data — projects, sprints, tasks, retro, docs, holidays — lives in Postgres and syncs live between teammates. There is no public sign-up; admins add people.

### Who can see and change what (Row Level Security)

| Person | Sees | Changes |
| --- | --- | --- |
| **Admin** | Everything | Everything, plus people, access, and holidays |
| **Tribe access** (e.g. Phoenix) | Every project in that tribe, so tribe dashboards work | Can create projects in that tribe; view only on projects they're not a member of |
| **Project member** (in the project's team) | That project | That project's sprints, tasks, retro, docs, settings |
| Anyone else signed in | Nothing | Nothing |

Access is enforced in the database, not only in the UI. `supabase/tests/` runs 22 RLS scenarios on plain Postgres (see its README).

### Set up

1. Create a Supabase project. In **SQL Editor**, run `supabase/migrations/0001_profiles.sql`, then `0002_workspace.sql`.
2. **Authentication › URL Configuration**: set *Site URL* to your Netlify URL; add `https://<your-site>/reset-password` and `https://<your-site>/projects` to *Redirect URLs* (plus `http://localhost:5173/**` for local dev).
3. **Authentication › Users › Add user** for yourself, then sign in to SPEctrum once (this creates your member row). Make yourself admin in the SQL Editor:
   ```sql
   update public.members set is_admin = true where email = 'you@company.com';
   ```
4. Sign in again. The empty workspace offers **Import demo projects** or **Create first project**.
5. **Administration › People & access**: add people by the email they sign in with, pick their tribes, and make admins. They get access on their first sign-in with that email (linked by the verified email, not by name). Put people into project teams from each project.
6. Microsoft: **Authentication › Providers › Azure** with the Client ID / Secret of an Entra ID app registration whose redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`.
7. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings › API) in **Netlify › Site configuration › Environment variables**, or in `.env.local` for local dev (see `.env.example`), then redeploy. Vite reads them at build time.

### How sync works

- On sign-in the app loads everything the person may see, then writes their changes back (debounced ~0.4 s, retried with backoff when offline) and applies teammates' changes over **Supabase Realtime**. The top bar shows *Saved / Saving… / Offline / Not saved*.
- Tables keep the columns access rules need (`id`, `project_id`, `tribe`, `status`, …) plus `data jsonb` with the full entity, so product changes (e.g. custom workflow columns) don't need a migration each time.
- Conflicts: last write wins per entity (a task, a sprint). A change the database refuses is rolled back to the server copy with a message.
- Favorites and recently opened stay in the browser, per person.

Without the Supabase variables the login page offers **Continue in demo mode**, and data stays in the browser as before.

## What's in this module

| Area | What you can do |
| --- | --- |
| **Project Board** (`/projects`) | Tribes first: portfolio KPIs (running projects, health mix, overdue, defects), recently opened projects, and one card per tribe with its health mix, running projects and their health, sprint progress, overdue and defects. A tribe card opens the tribe page. |
| **Tribe** (`/projects/tribe/:tribe`) | Tribe KPIs, then the tribe's projects: All / Favorites / My projects, search, status filter, **grid** (sprint at a glance) or **list** (health table: health, active sprint, progress vs time, tasks by status, overdue, defects, velocity). **Needs a decision** list, tribe switcher, new project (tribe prefilled). A project opens its dashboard. |
| **Project › Dashboard** (project landing page) | Health with reasons, the active sprint (goal, progress vs elapsed working time, status mix), **Needs attention** with a next step for each, KPIs (velocity, goals met, backlog readiness, overdue, defects), **every sprint in the project** (dates, goal, tasks, delivered weight, goal outcome — click to open), velocity chart, tasks per board column, workload per person, overdue tasks. |
| **Project › Backlog** | Ordered product backlog, inline weight estimate, sprint-readiness (weight + acceptance criteria), bulk add to a sprint with undo. |
| **Project › Sprints** | Active / Planned / Completed groups. Create, set up, start, edit, complete, and delete draft sprints. |
| **Sprint setup** | Required sprint goal, flexible length (1–4 weeks or custom dates), overlap check, >1 month warning, holiday-aware working days, save length as project default. |
| **Sprint › Board** | Columns come from the project workflow. Drag and drop between them (plus a keyboard-friendly card menu), only-my-tasks, type filter, add task per column, undo. **Edit columns** opens the workflow editor. |
| **Workflow (board columns)** | Per project, in Settings › Board columns or from the board: add, rename, recolor, reorder (drag or arrows), set what each column *counts as*, delete (tasks move to a column you pick). |
| **Sprint › Task list / Report / Review / Retro** | Sortable table, burndown with ideal line, per-person delivery, increment vs not done, review notes, sprint retro. |
| **Complete sprint** | Record the goal outcome (Achieved / Partially / Not achieved), carry open work to the next sprint or back to the backlog, review notes. |
| **Task drawer** (`?task=<id>` on any page) | Edit status, type, severity, assignee, reviewer, due date, weight, sprint, epic, description, acceptance criteria, attachments, comments. Deep-linkable. |
| **Releases / Defects / Retro / Docs / Settings** | Release state of done items, defect triage by severity, retro action items across sprints, linked documents, project details, sprint defaults, members, complete / reopen. |
| **Administration › Holiday calendar** | Public holidays and collective leave used for working-day calculations. |
| **Quick switcher** | `Ctrl/⌘ + K` to jump to a project, active sprint, or task. |

Other sidebar modules (Squad Health Check, Work Performance, …) show a placeholder — they move over in later releases.

## Product rules

- **Sprint names** are `Sprint {n}`, numbered automatically per project and never reset per year. Dates are metadata, not part of the name.
- **Sprint goal** is required before a sprint can start: one sentence, max 120 characters, written as *[checkable outcome] so that [who can do what]*.
- A sprint can start only when it has a goal, dates, and at least one task, and no other sprint in the project is active.
- **Sprint length** is flexible. Presets are 1, 2 (recommended), 3, and 4 weeks, or any custom range. Overlapping sprints are blocked; sprints longer than one month and start days on weekends/holidays only get a warning.
- **Working days** exclude weekends, public holidays, and (per project setting) collective leave from the Holiday calendar.
- **Goal outcome** is recorded only when the sprint is completed, so an active sprint is never shown as "Not achieved".
- Backlog items are **sprint-ready** when they have a weight and at least one acceptance criterion.
- **Workflow columns are flexible.** Each column has a name, color, and a category (*counts as* Not started, In progress, In review, or Done). Progress, burndown, due-date warnings, and releases use the category, so custom columns like "Ready for QA" still count correctly. A workflow needs at least two columns and at least one Done column; column names are unique. New columns are inserted before Done. New tasks land in the first *Not started* column.

- **Health** compares the active sprint's progress (by weight, or task count when nothing is estimated) with the share of its working days already elapsed. Up to 10 pts behind = *On track*, up to 25 = *At risk*, more = *Off track*. A sprint past its end date is *Off track*; an open critical defect turns *On track* into *At risk*. Projects without an active sprint show *No active sprint*.
- **Velocity** is the delivered weight of the last 5 completed sprints.

## Code map

```
src/
  domain/      types, date & working-day math, sprint rules, seed data (+ unit tests)
  store/       Zustand store with localStorage persistence (+ unit tests)
  auth/        Supabase Auth provider, route guard, profile → member mapping
  sync/        Supabase sync engine (load, write-back, realtime) and row mapping (+ tests)
  components/  app shell, sidebar, quick switcher, UI primitives, icons, toasts
  features/    task drawer, sprint setup, complete sprint, dialogs, retro board
  pages/       project board, project tabs, sprint tabs, admin pages
  styles/      SPE Nova tokens and component styles
supabase/
  migrations/  SQL to run in Supabase (profiles, workspace tables, RLS, realtime)
  tests/       RLS scenarios for plain Postgres
```
