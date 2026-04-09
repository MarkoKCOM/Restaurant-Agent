## Context

Current dashboard customization is split across a few places:
- `packages/domain/src/types.ts` defines a minimal `DashboardConfig`
- `apps/api/src/db/schema.ts` stores `restaurants.dashboardConfig` as JSONB
- `apps/dashboard/src/components/Layout.tsx` uses `accentColor`, `logo`, and `visiblePages`
- `apps/dashboard/src/pages/SettingsPage.tsx` lets admins edit accent color, logo URL, visible pages, and feature toggles

This is a useful starting point, but it is still shallow:
- only the sidebar active state actually responds to the brand color in a meaningful way
- many pages and cards still hard-code amber for badges, buttons, or highlights
- logo handling is header-only
- feature toggles are configured in settings but not enforced consistently across dashboard surfaces

## Goals

1. Give each restaurant a recognizable white-label dashboard identity.
2. Keep one shared codebase and component system.
3. Preserve role-based access control as the first filter, then apply restaurant-configured visibility/features as the second filter.
4. Ensure old restaurants with only `accentColor`/`logo` still render correctly.

## Non-Goals

- Full per-restaurant custom layouts or component-level forks
- Separate dashboard builds per tenant
- Marketing site/widget rebrand in this change (those can be aligned later)

## Proposed Model

Expand `DashboardConfig` into a structured brand kit.

Suggested shape:

```ts
interface DashboardBrandPalette {
  primary?: string;
  primaryText?: string;
  secondary?: string;
  secondaryText?: string;
  surface?: string;
  surfaceAlt?: string;
  sidebar?: string;
  sidebarText?: string;
  sidebarActive?: string;
  sidebarActiveText?: string;
  danger?: string;
  success?: string;
  warning?: string;
}

interface DashboardBranding {
  logo?: string;
  iconLogo?: string;
  wordmark?: string;
  loginImage?: string;
  tagline?: string;
}

interface DashboardConfig {
  language?: "he" | "en";
  visiblePages?: string[];
  features?: { ... };
  branding?: DashboardBranding;
  palette?: DashboardBrandPalette;
  density?: "comfortable" | "compact";
  accentColor?: string; // legacy compatibility
  logo?: string;        // legacy compatibility
}
```

Notes:
- Keep legacy `accentColor` and `logo` as compatibility inputs during migration.
- Runtime theme resolver maps legacy values into the richer palette if the new keys are absent.
- White-labeling is restaurant-scoped only; super admin remains platform-branded until a restaurant context is chosen.

## Runtime Theming

Introduce a small theme resolver in the dashboard app:
- input: current restaurant `dashboardConfig`
- output: normalized theme tokens with safe defaults
- application: CSS custom properties on the app root

Example token set:
- `--brand-primary`
- `--brand-primary-text`
- `--brand-surface`
- `--brand-surface-alt`
- `--brand-sidebar`
- `--brand-sidebar-text`
- `--brand-sidebar-active`
- `--brand-sidebar-active-text`
- `--brand-danger`
- `--brand-success`
- `--brand-warning`

Pages/components then consume semantic tokens instead of OpenSeat-specific color classes wherever the styling is restaurant-facing.

## Access + Visibility Merge Rule

Page visibility should be the intersection of:
1. role permission
2. restaurant visible pages
3. feature-level enablement where relevant

This avoids the current ambiguity where role-based access exists, but restaurant settings may imply pages/features that are not actually wired consistently.

Proposed rule:
- role decides whether a user may ever see a page/action
- restaurant config decides whether that page/action is enabled for this tenant/package/brand setup
- hidden features must not merely disappear visually; server-side guards remain authoritative

## Settings UX

Enhance Settings → Dashboard Customization into a proper brand editor:
- palette inputs with color pickers + hex entry
- logo/wordmark/icon inputs with preview
- login/header preview cards
- reset to defaults
- contrast validation warnings before save

Minimum first release fields:
- primary color
- sidebar color
- surface accent
- logo
- wordmark/tagline

## Migration Strategy

For existing restaurants:
- if `dashboardConfig.palette` is missing and `accentColor` exists, map it to `palette.primary`
- if `dashboardConfig.branding` is missing and `logo` exists, map it to `branding.logo`
- leave stored legacy values in place initially for backward compatibility

No DB migration is required if the config remains JSONB, but shared types and resolvers must handle both legacy and new shapes.

## Files Likely Affected

Shared/domain:
- `packages/domain/src/types.ts`

API:
- restaurant update/read route validation and normalization
- any schema validation added around `dashboardConfig`

Dashboard:
- `apps/dashboard/src/components/Layout.tsx`
- `apps/dashboard/src/pages/SettingsPage.tsx`
- shared buttons/cards/badges that currently hard-code amber classes
- auth/layout helpers that derive visible pages and features

## Risks

1. Theme drift: partial migration could leave mixed amber and branded colors.
2. Invalid owner-entered palettes: low contrast or unreadable states.
3. Feature-toggle confusion: toggles stored in config but not enforced uniformly.

## Mitigations

- Centralize theme resolution in one helper.
- Use semantic utility classes or CSS variables rather than page-by-page color hacks.
- Add validation and fallback logic before persisting theme config.
- Add targeted dashboard tests for role x feature x branding combinations.
