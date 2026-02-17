# Roadmap: Wohnungs-Plan — UX Polish Milestone

## Overview

This milestone adds four cross-cutting polish layers to an existing production-ready floorplanner PWA: internationalization (English + German), mobile UX hardening, systematic error and loading state coverage, and visual design consistency. The sequence is deliberate — i18n infrastructure unblocks all string work, error handling must exist before visual polish can style it, and mobile and visual passes run last to edit the final component state without being overwritten.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: i18n Infrastructure** - Wire Paraglide and Sonner; language switcher visible and locale-persisting
- [ ] **Phase 2: String Extraction** - All UI strings translated; German UI fully usable
- [ ] **Phase 3: Error Handling + Loading States** - No silent failures; every error surfaces; upload progress visible
- [ ] **Phase 4: Mobile UX Hardening** - Touch targets, keyboard handling, offline indicator audited across all routes
- [ ] **Phase 5: Visual Design Polish** - Consistent spacing, typography, empty states, and animations throughout

## Phase Details

### Phase 1: i18n Infrastructure
**Goal**: Paraglide and Sonner are wired into the app so locale detection, persistence, and toast notifications work end-to-end before any string extraction begins
**Depends on**: Nothing (first phase)
**Requirements**: I18N-01, I18N-03, I18N-07, I18N-08, I18N-09
**Success Criteria** (what must be TRUE):
  1. User sees a language switcher in the sidebar showing "Deutsch" and "English"; clicking it switches the UI language immediately
  2. Selected language persists after closing and reopening the browser (cookie survives session)
  3. The HTML `lang` attribute in the document reflects the active locale (e.g., `lang="de"` after switching to German)
  4. On first visit with no cookie, the app auto-detects browser language and starts in the matching locale
  5. A toast notification can be triggered from any component and displays correctly styled in the root layout
**Plans**: 2 plans
Plans:
- [ ] 01-01-PLAN.md — Merge Paraglide worktree branch, install Sonner, verify build
- [ ] 01-02-PLAN.md — Human verification of language switching, persistence, and toast

### Phase 2: String Extraction
**Goal**: Every user-visible string in the app is translated into both English and German with no raw English visible in the German UI
**Depends on**: Phase 1
**Requirements**: I18N-02, I18N-04, I18N-05, I18N-06, I18N-10
**Success Criteria** (what must be TRUE):
  1. Switching to German and navigating every route produces no visible English strings (including canvas labels, aria-labels, placeholders, and tooltips)
  2. Dimension values display with German decimal comma in German locale (e.g., "3,5 m" not "3.5 m")
  3. Relative timestamps display in German ("vor 2 Minuten") when locale is set to German
  4. Form validation errors (required field, invalid input) display in German when locale is set to German
  5. Item counts and other quantities use correct German plural forms ("1 Element", "2 Elemente")
**Plans**: TBD

### Phase 3: Error Handling + Loading States
**Goal**: Every API error surfaces to the user as a visible toast, upload progress is visible, and destructive actions require confirmation — no silent failures
**Depends on**: Phase 1
**Requirements**: ERRH-01, ERRH-02, ERRH-03, ERRH-04, ERRH-05, ERRH-06, ERRH-07, VISD-03
**Success Criteria** (what must be TRUE):
  1. Disconnecting the network during a save and then performing an action produces a visible toast error (no silent failure)
  2. Uploading a floorplan or item image shows a progress indicator while the upload is in flight
  3. Clicking delete on a project or item opens a shadcn Dialog asking for confirmation instead of firing the native browser `confirm()` popup
  4. Visiting a project URL while logged out redirects to the login page with a message explaining why (not a blank page or generic error)
  5. The project list shows skeleton loading cards while data is fetching instead of a blank flash
  6. The offline sync queue displays a badge with the count of pending changes when the device is offline
**Plans**: TBD

### Phase 4: Mobile UX Hardening
**Goal**: The app is fully usable on a phone with no content cut off, no frustratingly small tap targets, and an offline indicator visible when disconnected
**Depends on**: Phase 3
**Requirements**: MOBI-01, MOBI-02, MOBI-03, MOBI-04, MOBI-05, MOBI-06
**Success Criteria** (what must be TRUE):
  1. Every button, link, and interactive control on every route has a tap target of at least 44px (verifiable via DevTools mobile inspector)
  2. No route shows content clipped by the browser address bar or bottom navigation chrome on iOS Safari or Android Chrome
  3. Tapping a text input inside a sheet or form on mobile scrolls it into view above the virtual keyboard
  4. Every interactive element produces visible tap feedback (ripple, highlight, or press state) when tapped on a touch device
  5. No route scrolls horizontally at 375px viewport width
  6. When the device goes offline, a banner appears indicating offline status; it disappears when connectivity is restored
**Plans**: TBD

### Phase 5: Visual Design Polish
**Goal**: The app has a consistent, polished appearance with uniform spacing, clear visual hierarchy, meaningful empty states, and subtle motion throughout
**Depends on**: Phases 2, 3, 4
**Requirements**: VISD-01, VISD-02, VISD-04, VISD-05, VISD-06
**Success Criteria** (what must be TRUE):
  1. All pages use a consistent 4px/8px spacing rhythm — no arbitrary gaps or padding inconsistencies visible between screens
  2. Heading levels have a clear size progression; body text, labels, and captions are visually distinct
  3. Every list or grid that can be empty shows an icon, an explanation of why it is empty, and a call-to-action button (e.g., "No projects yet — Create your first project")
  4. A saving/syncing indicator is visible in the header during active data writes and disappears when the write completes
  5. Adding or removing an item from the canvas produces a visible slide-in or fade-out animation
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. i18n Infrastructure | 0/2 | Not started | - |
| 2. String Extraction | 0/? | Not started | - |
| 3. Error Handling + Loading States | 0/? | Not started | - |
| 4. Mobile UX Hardening | 0/? | Not started | - |
| 5. Visual Design Polish | 0/? | Not started | - |
