import type { DashboardConfig, DashboardPalette, DashboardBranding } from "@openseat/domain";
import type React from "react";

export interface ResolvedTheme {
  palette: Required<DashboardPalette>;
  branding: DashboardBranding;
  cssVars: React.CSSProperties;
}

export const PLATFORM_PALETTE: Required<DashboardPalette> = {
  primary: "#C41E3A",
  sidebar: "#ffffff",
  sidebarText: "#374151",
  surface: "#FEF2F2",
  accent: "#F87171",
};

export function resolveTheme(
  config: DashboardConfig | undefined,
  opts: { isSuperAdmin: boolean; hasRestaurant: boolean },
): ResolvedTheme {
  // Super admin without a restaurant context → platform default theme
  if (opts.isSuperAdmin && !opts.hasRestaurant) {
    return buildTheme(PLATFORM_PALETTE, {});
  }

  const legacyPrimary = config?.accentColor;
  const legacyLogo = config?.logo;

  const palette: Required<DashboardPalette> = {
    primary: config?.palette?.primary ?? legacyPrimary ?? PLATFORM_PALETTE.primary,
    sidebar: config?.palette?.sidebar ?? PLATFORM_PALETTE.sidebar,
    sidebarText: config?.palette?.sidebarText ?? PLATFORM_PALETTE.sidebarText,
    surface: config?.palette?.surface ?? PLATFORM_PALETTE.surface,
    accent: config?.palette?.accent ?? legacyPrimary ?? PLATFORM_PALETTE.accent,
  };

  const branding: DashboardBranding = {
    logo: config?.branding?.logo ?? legacyLogo,
    wordmark: config?.branding?.wordmark,
    tagline: config?.branding?.tagline,
  };

  return buildTheme(palette, branding);
}

function buildTheme(
  palette: Required<DashboardPalette>,
  branding: DashboardBranding,
): ResolvedTheme {
  return {
    palette,
    branding,
    cssVars: {
      "--brand-primary": palette.primary,
      "--brand-sidebar": palette.sidebar,
      "--brand-sidebar-text": palette.sidebarText,
      "--brand-surface": palette.surface,
      "--brand-accent": palette.accent,
    } as React.CSSProperties,
  };
}
