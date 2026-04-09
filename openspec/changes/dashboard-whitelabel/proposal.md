## Why

OpenSeat already stores a small `dashboardConfig` object per restaurant with `accentColor`, `logo`, `visiblePages`, and a few feature flags. That is enough for light customization, but it is not a real white-label dashboard.

Right now the dashboard still feels like one global OpenSeat app with a restaurant name stamped on top:
- most UI surfaces still use hard-coded amber/gray classes
- there is no full restaurant brand kit (palette, surfaces, typography treatment, login/header treatment)
- the current feature toggles are mostly stored but not consistently enforced in the UI
- there is no preview/guardrail layer to keep owner changes readable and accessible

As OpenSeat expands beyond BFF Ra'anana, each restaurant needs a dashboard that feels like its own operational system while still running on the shared platform. This matters for perceived product quality, owner trust, and future reseller/white-label sales.

## What Changes

This change upgrades dashboard customization from light theming to restaurant-grade white-labeling.

It introduces:
- a structured dashboard brand kit per restaurant
- runtime theme tokens consumed across dashboard pages/components
- settings UI for brand management with preview and validation
- consistent enforcement of restaurant-configured page/feature visibility alongside role-based access

## Capabilities

New capabilities:
- `dashboard-brand-kit` — store a richer restaurant dashboard brand profile
- `dashboard-theme-runtime` — render dashboard UI from restaurant theme tokens instead of hard-coded brand colors
- `dashboard-brand-settings` — owner/admin editing, preview, and validation for white-label settings

Modified capabilities:
- `settings-editor` — extend restaurant settings beyond accent/logo into full dashboard brand config
- `dashboard-navigation` — merge role-based access with restaurant-level page/feature visibility consistently

## Impact

Product:
- Restaurant owners see a branded system that feels built for them.
- Future sales demos can show multiple restaurants on the same platform with clearly different visual identities.

Engineering:
- Requires expanding `DashboardConfig` in shared domain types and restaurant persistence.
- Requires replacing scattered hard-coded accent styling in dashboard UI with theme tokens/CSS variables.
- Requires explicit rules for fallback theme values and contrast validation.

Rollout:
- Existing restaurants should continue to work with safe defaults.
- Current `accentColor` and `logo` data must be migrated forward into the new brand kit shape without breaking the dashboard.
