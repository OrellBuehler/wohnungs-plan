# Paraglide i18n -- Complete

## Summary

Full i18n support using Paraglide JS with English (base) and German locales. All user-facing strings have been extracted to message files, and a language switcher component is available in the sidebar.

## What Was Done

- Installed `@inlang/paraglide-js` with Vite plugin (cookie-based locale strategy)
- Created `project.inlang/settings.json` with `en` + `de` locales
- Extracted all user-facing strings across 37+ Svelte components into `messages/en.json` (486 keys)
- Added German translations in `messages/de.json`
- Built `LanguageSwitcher.svelte` component in the app sidebar
- Locale-aware formatting utilities in `$lib/utils/format.ts` and `$lib/utils/currency.ts`

## Usage

```typescript
import * as m from '$lib/paraglide/messages';
import { getLocale } from '$lib/paraglide/runtime';
```

Locale detection order: cookie, browser preference, fallback to `en`.
