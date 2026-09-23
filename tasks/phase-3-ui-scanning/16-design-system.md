# FC-16 — Design system & shared UI

**Phase:** 3 — Core Interfaces · **Depends on:** FC-02 · **Platforms:** web, desktop

## Goal
A clean, modern look built with Tailwind CSS + shadcn/ui and driven by shared design tokens (SRS §2 UI Component
Library). The same UI serves the browser and the Electron desktop app.

## Subtasks
- [ ] Design tokens in the shared Tailwind preset: color palette (light + dark), category accent colors, typography scale, spacing, radius, shadows
- [ ] Category metadata map in `packages/core` (label, icon, accent color) for Movie, TV, Music, Video Game, Board Game, Funko
- [ ] Icon set: `lucide-react`
- [ ] Core components:
  - [ ] `ItemCard` (cover art, title, year, category badge, ownership badge)
  - [ ] `ItemGrid` (responsive grid, virtualized for large collections, e.g. `@tanstack/react-virtual`)
  - [ ] `CategoryBadge`, `OwnershipBadge`, `TagChip`
  - [ ] `EmptyState`, `ErrorState`, loading skeletons
  - [ ] `CoverImage` with blur placeholder + fallback artwork per category
- [ ] Responsive breakpoints (narrow browser window / tablet, laptop, large desktop)
- [ ] Desktop-app polish: draggable title-bar area, native-feeling scrollbars, no text selection on UI chrome
- [ ] Accessibility: focus rings, color contrast AA, labels on icon buttons, keyboard navigation

## Acceptance criteria
- Components render correctly in light and dark mode in the browser and the desktop app.
- A 1,000-item grid scrolls smoothly (virtualization).
