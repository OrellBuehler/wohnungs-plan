# Requirements: Wohnungs-Plan UX Polish

**Defined:** 2026-02-17
**Core Value:** Users can visually plan and iterate on their apartment/house layout with accurate dimensions, seeing exactly what fits where.

## v1 Requirements

Requirements for UX polish milestone. Each maps to roadmap phases.

### Internationalization

- [ ] **I18N-01**: User can switch between English and German via a visible language switcher
- [ ] **I18N-02**: All UI strings display in the selected language (no raw English in German UI)
- [ ] **I18N-03**: Locale persists across sessions via cookie
- [ ] **I18N-04**: Numbers and measurements formatted per locale (3,5 m in DE, 3.5 m in EN)
- [ ] **I18N-05**: Dates and relative times formatted per locale ("vor 2 Minuten" in DE)
- [ ] **I18N-06**: Form validation messages translated
- [ ] **I18N-07**: HTML `lang` attribute updates dynamically per locale
- [ ] **I18N-08**: Browser language auto-detected on first visit
- [ ] **I18N-09**: Language switcher shows native names ("Deutsch", "English")
- [ ] **I18N-10**: German plural forms handled correctly

### Mobile UX

- [ ] **MOBI-01**: All interactive elements have touch targets ≥ 44px
- [ ] **MOBI-02**: No content cut off by mobile browser chrome on any route
- [ ] **MOBI-03**: Virtual keyboard does not obscure active input fields
- [ ] **MOBI-04**: Tap feedback on all interactive elements
- [ ] **MOBI-05**: No horizontal scroll on any fixed-width layout
- [ ] **MOBI-06**: Offline indicator banner when navigator.onLine is false

### Visual Design

- [ ] **VISD-01**: Consistent spacing rhythm (4px/8px grid) across all pages
- [ ] **VISD-02**: Consistent text hierarchy (primary font size per heading level)
- [ ] **VISD-03**: Loading skeletons on project list and data-fetching views
- [ ] **VISD-04**: Empty states with icon, explanation text, and CTA on all screens
- [ ] **VISD-05**: Saving/sync indicator visible during data writes
- [ ] **VISD-06**: Subtle animations on item add/remove (slide in, fade out)

### Error Handling

- [ ] **ERRH-01**: Network errors show user-visible toast message (no silent failures)
- [ ] **ERRH-02**: Form submission errors displayed inline with the form
- [ ] **ERRH-03**: Project load failure shows error with retry CTA
- [ ] **ERRH-04**: Upload progress indicator for floorplan/image uploads
- [ ] **ERRH-05**: Destructive actions use shadcn Dialog confirmation (not native confirm())
- [ ] **ERRH-06**: 401 responses redirect to login with meaningful message
- [ ] **ERRH-07**: Offline queue shows pending changes count badge

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### i18n

- **I18N-V2-01**: Additional languages beyond EN/DE
- **I18N-V2-02**: Translated server-side error messages

### Mobile UX

- **MOBI-V2-01**: Haptic feedback on item select
- **MOBI-V2-02**: Photo capture button for item images
- **MOBI-V2-03**: Pull-to-refresh on project list

### Visual Design

- **VISD-V2-01**: Dark mode support
- **VISD-V2-02**: Skeleton screens for all data-fetching components
- **VISD-V2-03**: Project card thumbnail loading shimmer

### Error Handling

- **ERRH-V2-01**: Canvas error boundary with fallback UI
- **ERRH-V2-02**: Retry button on transient errors

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| URL-based locale routing (`/de/...`) | Cookie strategy chosen; would require route refactor |
| RTL layout support | Not needed for EN/DE |
| More than 2 languages | Infrastructure supports it; add in future milestone |
| Dark mode | Major audit; separate milestone |
| Undo/redo system | Major architectural change; separate feature |
| Conflict resolution UI | Requires real-time lock protocol changes |
| Custom illustration/icon set | Lucide is consistent; replacement is branding decision |
| Crash reporting (Sentry) | Infrastructure decision, not UI polish |
| Native app features | PWA is the target |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| I18N-01 | — | Pending |
| I18N-02 | — | Pending |
| I18N-03 | — | Pending |
| I18N-04 | — | Pending |
| I18N-05 | — | Pending |
| I18N-06 | — | Pending |
| I18N-07 | — | Pending |
| I18N-08 | — | Pending |
| I18N-09 | — | Pending |
| I18N-10 | — | Pending |
| MOBI-01 | — | Pending |
| MOBI-02 | — | Pending |
| MOBI-03 | — | Pending |
| MOBI-04 | — | Pending |
| MOBI-05 | — | Pending |
| MOBI-06 | — | Pending |
| VISD-01 | — | Pending |
| VISD-02 | — | Pending |
| VISD-03 | — | Pending |
| VISD-04 | — | Pending |
| VISD-05 | — | Pending |
| VISD-06 | — | Pending |
| ERRH-01 | — | Pending |
| ERRH-02 | — | Pending |
| ERRH-03 | — | Pending |
| ERRH-04 | — | Pending |
| ERRH-05 | — | Pending |
| ERRH-06 | — | Pending |
| ERRH-07 | — | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 0
- Unmapped: 29 ⚠️

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 after initial definition*
