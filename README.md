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

## What's in this module

| Area | What you can do |
| --- | --- |
| **Project Board** (`/projects`) | All / Favorites / My projects, status + tribe filters, search, grid or list view, recently opened, create a project. Each card shows the active sprint, its goal and progress, and one click opens the board. |
| **Project › Overview** | Active sprint (goal, progress by status, working days left), **Needs attention** with a next step for every item, backlog / release / quality metrics, my tasks in the sprint. |
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

## Code map

```
src/
  domain/      types, date & working-day math, sprint rules, seed data (+ unit tests)
  store/       Zustand store with localStorage persistence (+ unit tests)
  components/  app shell, sidebar, quick switcher, UI primitives, icons, toasts
  features/    task drawer, sprint setup, complete sprint, dialogs, retro board
  pages/       project board, project tabs, sprint tabs, admin pages
  styles/      SPE Nova tokens and component styles
```
