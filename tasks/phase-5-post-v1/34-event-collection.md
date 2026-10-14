# FC-34 — Events collection (concerts, festivals, parties)

**Phase:** 5 — Post-v1 follow-ups · **Depends on:** FC-13, FC-14, FC-15, FC-18, FC-19, FC-20 · **Category:**
`event` (new) · **Platforms:** web, desktop

## Goal
Let a user keep a collection of the events they went to or plan to go to: concerts, festivals, parties, club
nights, theatre, sports and similar. Each event holds its date, venue, line-up, poster and the user's tickets
(type, price, seat, a photo or scan of each ticket). No public database covers events well, so **everything is
entered by hand**. Events show up in the gallery, item page, dashboard and exports like any other item.

## Decisions
- **A built-in category, not a custom collection.** FC-13's custom collections have fixed generic fields, which
  don't fit events (dates, venue, line-up, several tickets). `event` becomes a new `item_category` value with
  its own typed fields, filters and dashboard card. Every event has `provider = 'custom'`, no `external_id` and
  no `custom_collection_id`.
- **One row = one event the user attends.** As with other custom items, the `collection_items` row is both the
  item and the copy:
  - **Event** (`custom_data`): what anyone at the event would see (name, type, dates, venue, line-up, poster).
  - **Attendance** (`details`, typed like the other categories in FC-15): the user's own tickets, attendance
    and memories.
- **Event fields** (`custom_data`):
  - `title` (required), `eventType`: Concert, Festival, Party, Club night, Theatre, Comedy, Sport,
    Conference, Exhibition, Other.
  - `startDate` (required) and `endDate` (multi-day festivals); `startTime` and `doorsTime`, optional.
  - `venue`, `city`, `country` (ISO code), `address`.
  - `lineup`: a list of `{ name, role, setTime? }`. The role is Headliner, Support, DJ, Guest or Other. The
    order of the list is the billing order.
  - `organizer` (promoter / festival brand), `tour` (e.g. "Eras Tour"), `website`, `description`.
  - `imageUrl`: the poster, used as the cover.
- **Ticket fields** (`details.tickets`, a list, because one visit often has several tickets, e.g. two
  standing tickets or a weekend pass plus parking):
  - `ticketType`: General admission, Standing, Seated, VIP, Day pass, Weekend pass, Backstage, Guest list,
    Other.
  - `price`, `fees`.
  - `section`, `row`, `seat`.
  - `ticketNumber`, `seller` (Ticketmaster, Eventim, box office, …), `purchasedAt`.
  - `medium`: Paper, E-ticket, Mobile, Wristband.
  - `images`: up to 4 photos or scans per ticket (front / back).
- **Attendance fields** (`details`): `attendance` is Attended, Missed, Cancelled or Postponed, and is empty while
  the event is upcoming. Also `companions` (free text), `rating` (1–5) and `setlistUrl` (e.g. setlist.fm).
- **Fields every row already has:**
  - `purchase_price` is the total paid: the sum of the tickets' prices and fees, computed by core and written
    on save, so stats and exports work unchanged.
  - `currency` is one currency for the whole event, used by every ticket.
  - `quantity` is the number of tickets. `format` is the main ticket medium (`Paper ticket`, `E-ticket`,
    `Wristband`).
  - `estimated_value` is the stub's collector value, optional.
  - `acquired_at`, notes and tags.
- **Ownership for events:**
  - `owned`: I have a ticket.
  - `wishlist`: I want to go.
  - `sold`: the ticket was resold or given away.
  - `preordered` and `loaned_out` aren't offered for events.

  The status the UI shows comes from ownership, `attendance` and the date: Upcoming, Attended, Missed,
  Cancelled, Want to go.
- **Ticket images are private.** A ticket scan often has a valid barcode or QR code, so ticket images go in a
  **private** bucket, `event-tickets`, and are shown through short-lived signed URLs. The poster is public-safe
  and uses FC-13's `custom-images` bucket.
- **Dates are local to the event.** `startDate` / `endDate` are plain `YYYY-MM-DD` and times are `HH:mm`, with no
  time zone: a concert at 20:00 in Tokyo stays 20:00. "Upcoming" compares `endDate ?? startDate` with today in the
  user's time zone (the time zone `collection_stats` already takes).
- **Suggestions come from the user's own data.** Venue, city, organizer and artist fields suggest values from the
  user's earlier events (a `event_suggestions` RPC), so the same artist or venue is spelled the same way and
  filters group it.

## Subtasks

### Database
- [ ] Migration: `alter type item_category add value 'event'` (in its own migration, because a new enum value
      can't be used in the same transaction).
- [ ] Checks: `category = 'event'` ⇒ `provider = 'custom'` and `custom_collection_id is null`. Update
      `collection_items_provider_category` and FC-13's custom-collection check for the new value. Check
      that `ownership` is not `preordered` / `loaned_out` for events.
- [ ] Index for the gallery's date sort and the "upcoming" filter: an expression index on
      `(custom_data ->> 'startDate')` for `category = 'event'` rows.
- [ ] Filtering (`collection_item_filter_flags` + `collectionFilterSchema`):
  - `eventType`, `eventYear`, `artist` (matches any `lineup[].name`, case-insensitive), `venue`, `city`.
  - `eventStatus`: upcoming / attended / missed / want to go.

  Counts in `collection_facets` for type, year, city and the top artists. Keep the helpers inlinable (scalar
  arguments, no subqueries, no `set search_path`), as the FC-18 note in `CLAUDE.md` requires; check with
  `explain` that the facets stay fast.
- [ ] Stats (`collection_stats`):
  - Events attended in total and this year, and the next upcoming event.
  - Total spent on tickets (per currency, like the existing value totals).
  - Most-seen artists, venues and cities (top 5), and events per year.
- [ ] `event_suggestions(field, prefix)` RPC: distinct venues / cities / organizers / artist names from the
      user's own events, top 10 by use. `security invoker`, so RLS applies.
- [ ] Storage bucket `event-tickets`:
  - **Not public.** Per-user folder (`<user id>/<file>`), RLS on `storage.objects` like the avatars bucket.
  - Images only, max 1 MB.
- [ ] Deleting an event, and deleting the account, also removes its ticket images (Storage API). Undo of a
      delete (`restoreItem`) keeps them until the undo window ends.
- [ ] `pnpm db:push` → `pnpm db:types`.

### Core (`packages/core`)
- [ ] Category: add `event` to `ITEM_CATEGORIES` and the design tokens (`category-event`).
      `CATEGORY_META.event`: label "Event", plural "Events", icon `ticket`, portrait cover (posters).
      `FORMATS_BY_CATEGORY.event`: `Paper ticket`, `E-ticket`, `Wristband`.
- [ ] `EVENT_TYPES`, `TICKET_TYPES`, `TICKET_MEDIA`, `LINEUP_ROLES`, `ATTENDANCE_STATUSES` with labels.
- [ ] `eventDataSchema` for `custom_data`:
  - Length limits, dates as `YYYY-MM-DD` with `endDate >= startDate`, times as `HH:mm`.
  - `lineup` at most 200 entries, `country` an ISO 3166-1 alpha-2 code.
  - `imageUrl` an `https` URL or a `custom-images` path.
- [ ] `EventDetails` copy-details schema in `copy-details.ts`:
  - `tickets` (at most 20, each with at most 4 `event-tickets` paths), `attendance`, `companions`, `rating`,
    `setlistUrl`.
  - Its patch schema and the `parseDetails` branch.
- [ ] Pure helpers, with tests:
  - `eventTotalPrice(tickets)` (price + fees) and `eventTicketCount`.
  - `eventStatus(item, today)`: Upcoming / Attended / Missed / Cancelled / Want to go.
  - `formatEventDates`: "12 Jul 2026", "10–13 Jul 2026", "30 Jun – 2 Jul 2026".
  - `headliners(lineup)`.
- [ ] Normalize an event row to `NormalizedItem` on read:
  - Title, poster as image, `releaseYear` from `startDate`.
  - Subtitle "Headliner · Venue, City", creators from the headliners.

  Cards, search badges and exports then need no special case.
- [ ] Gallery badges (`copy-badges.ts`): the event status, and the ticket type when there is only one ticket.

### Data layer (`packages/collection`)
- [ ] Repository: `addEvent` (no gateway call, `source = 'manual'`) and `updateEvent` for `custom_data` +
      `details`. Both write `purchase_price` and `quantity` from the tickets. Add `getEventSuggestions`.
- [ ] `restoreItem` restores events (`custom_data`, `details`).
- [ ] Hooks: `useAddEvent`, `useUpdateEvent` (optimistic, like the others) and `useEventSuggestions`
      (debounced, cached per field and prefix).
- [ ] Ticket image helpers:
  - Upload: compress to WebP on the client (reuse FC-13's helper), then store under `event-tickets/<user id>/`.
  - Read: `getTicketImageUrls` returns signed URLs, valid 1 hour and cached by TanStack Query a bit shorter.
  - Remove: delete an image when its ticket or event is deleted.
- [ ] Events never call `/api/items/batch` (keep a test, as for custom items).

### Web UI (`apps/web`)
- [ ] Navigation and search page: an "Events" tab with no provider search. It has an "Add event" button and a
      short explanation that events are entered by hand.
- [ ] Add-event form, in sections:
  - **Event:** name, type, dates and times, venue, city, country, organizer, tour, website, description,
    poster (upload or URL).
  - **Line-up:** add / remove / drag to reorder artists with a role and set time. Paste a comma- or
    line-separated list to add many at once.
  - **Tickets:** add several tickets, each with type, price, fees, seat, seller, medium, ticket number and
    photos. The total price is shown live.
  - **You:** ownership (I have tickets / Want to go), attendance, rating, companions, notes, tags.
  - Venue, city, organizer and artist fields suggest from `useEventSuggestions`.
  - "Add another" and "Duplicate event" (copies venue / organizer / line-up for a festival's next day or a
    tour's next date).
- [ ] Event item page (FC-19 layout):
  - Poster, the dates, venue with a map link (a plain link to OpenStreetMap / Google Maps search, no embedded
    map), line-up grouped by role, tickets with their images in a lightbox, status, and the setlist link.
  - Every field editable in place with autosave, like the other items.
- [ ] Gallery: events sort by event date (newest first) by default. Filters for type, year, status, artist,
      venue and city (FC-18 filter panel). The card shows the poster, title, date and venue.
- [ ] Dashboard: an "Events" card with events attended (all time / this year), the next upcoming event, total
      spent on tickets and the top artists.
- [ ] Ticket images are never in public URLs, in `next/image` `remotePatterns` or in the page HTML for longer
      than the signed URL lives. Load them through the signed-URL hook.

### Export and docs
- [ ] CSV (FC-25) and PDF (FC-26), if they are done by then: event columns are date, type, venue, city, headliners,
      ticket count, total price, and status. Ticket images are not exported.
- [ ] Update `tasks/README.md` (product summary, categories), `CLAUDE.md` (core / collection packages, the
      `event-tickets` bucket) and the README.

## Acceptance criteria
- A user can add a concert with its date, venue, line-up, poster and two tickets with prices and photos. The total
  price is the sum of the tickets, and the event shows up in the gallery, item page and dashboard.
- A multi-day festival shows its date range. An event in the future shows as Upcoming, and as Attended once the
  user marks it.
- Filtering by artist finds every event where that artist was on the line-up, with correct counts. The same for
  type, year, venue, city and status.
- Venue and artist fields suggest values the user entered before.
- An event added in the browser appears in the desktop app without a reload (realtime).
- Ticket images can only be opened by their owner, and only through a signed URL. A copied image link stops
  working after it expires (RLS / Storage tests in `pnpm test:rls`).
- Deleting an event can be undone. Once the undo window has passed, its ticket images are gone from Storage.

## Notes
- Keep images small (the free tier has 1 GB of Storage); ticket and poster photos are compressed to WebP on the
  client before upload.
- **Why no provider:** Songkick, Bandsintown, Ticketmaster Discovery and setlist.fm each cover only part of
  the events (mostly concerts, and mostly future ones). Most have strict terms or need a partnership. The fields
  above are close to setlist.fm's (artist, venue, city, date), so a later import stays possible.
- **Backlog:**
  - Import past concerts from setlist.fm ("attended" list) or Songkick.
  - Link line-up artists to Discogs artist IDs, so the music collection and events connect ("you own 3 albums
    by this artist").
  - Read the date, venue and price from a ticket photo or e-ticket PDF with OCR.
  - Add memorabilia photos (wristbands, merch) as an image gallery per event.
  - A calendar / map view of events.
  - Reminders for upcoming events, through desktop notifications.
- Data from a ticket (names, barcodes) is personal. Don't log `details.tickets` or image paths in the gateway or
  in error reports.
