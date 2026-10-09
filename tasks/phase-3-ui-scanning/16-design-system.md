# FC-16 — Design system & shared UI

**Phase:** 3 — Core Interfaces · **Depends on:** FC-02 · **Platforms:** web, desktop

## Goal
A clean, modern look built with Tailwind CSS + shadcn/ui and driven by shared design tokens (SRS §2 UI Component
Library). The same UI serves the browser and the Electron desktop app.

## Subtasks
- [x] Design tokens in the shared Tailwind preset: color palette (light + dark), category accent colors, typography scale, spacing, radius, shadows
- [x] Category metadata map in `packages/core` (label, icon, accent color) for Movie, TV, Music, Video Game, Board Game, Funko
- [x] Icon set: `lucide-react`
- [x] Core components:
  - [x] `ItemCard` (cover art, title, year, category badge, ownership badge)
  - [x] `ItemGrid` (responsive grid, virtualized for large collections, e.g. `@tanstack/react-virtual`)
  - [x] `CategoryBadge`, `OwnershipBadge`, `TagChip`
  - [x] `EmptyState`, `ErrorState`, loading skeletons
  - [x] `CoverImage` with blur placeholder + fallback artwork per category
- [x] Responsive breakpoints (narrow browser window / tablet, laptop, large desktop)
- [x] Desktop-app polish: draggable title-bar area, native-feeling scrollbars, no text selection on UI chrome
- [x] Accessibility: focus rings, color contrast AA, labels on icon buttons, keyboard navigation

## Acceptance criteria
- Components render correctly in light and dark mode in the browser and the desktop app.
- A 1,000-item grid scrolls smoothly (virtualization).
