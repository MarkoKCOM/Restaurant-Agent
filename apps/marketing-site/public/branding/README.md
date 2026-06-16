# OpenSeat — Brand Bundle

Everything you need to apply the **OpenSlot** mark across the web, product, and social.

## Contents

```
branding/
├── mark/                              # The mark alone, 120×120 viewBox
│   ├── openseat-mark.svg              # Primary — red square, paper chair
│   ├── openseat-mark-dark.svg         # Dark square, red chair
│   ├── openseat-mark-white.svg        # Red square, white chair (high contrast)
│   ├── openseat-mark-reverse.svg      # Red square, white chair (1-color safe)
│   ├── openseat-mark-mono-ink.svg     # Transparent bg, ink chair
│   ├── openseat-mark-mono-white.svg   # Transparent bg, white chair
│   └── openseat-construction.svg      # Clear-space / construction diagram
│
├── wordmark/                          # Mark + "OpenSeat" lockup
│   ├── openseat-wordmark.svg          # Primary horizontal (ink text, red mark)
│   ├── openseat-wordmark-dark.svg     # Horizontal, dark background variant
│   ├── openseat-wordmark-mono.svg     # Ink-only
│   ├── openseat-wordmark-white.svg    # On red / brand background
│   ├── openseat-stacked.svg           # Stacked lockup (mark over name), light
│   └── openseat-stacked-dark.svg      # Stacked lockup, dark
│
├── avatar/                            # Circular-safe social profile images
│   ├── openseat-avatar.svg            # Centred mark, red field
│   ├── openseat-avatar-ink.svg        # Ink field variant
│   └── openseat-avatar-200/400/512.png
│
├── tokens/
│   ├── tokens.css                     # CSS custom properties (--os-*)
│   └── tokens.json                    # Same tokens as JSON
│
├── email/
│   └── signature.html                 # HTML email signature block
│
├── Brand Guide.html                   # Visual one-page brand guide (open this!)
│
├── favicon/
│   ├── favicon.ico                    # Multi-res ICO (16 / 32 / 48)
│   ├── favicon.svg                    # Modern SVG favicon (preferred)
│   ├── favicon-dark.svg               # prefers-color-scheme: dark variant
│   ├── favicon-16.png                 # Legacy sizes
│   ├── favicon-32.png
│   ├── favicon-48.png
│   ├── favicon-64.png
│   ├── apple-touch-icon.svg
│   ├── apple-touch-icon-180.png       # iOS home screen
│   ├── android-chrome-192.png         # PWA / Android
│   └── android-chrome-512.png
│
├── png/                               # Transparent-ready mark rasters
│   ├── openseat-mark-16/32/48/64/96/128/192/256/512/1024.png
│   ├── openseat-mark-dark-128/256/512.png
│   └── openseat-mark-white-128/256/512.png
│
└── social/
    ├── og-image.svg                   # 1200×630 Open Graph preview
    └── og-image.png
```

---

## Brand tokens

```css
--brand:       #C41E3A;   /* Primary red  */
--brand-600:   #A01830;   /* Hover */
--brand-50:    #FEF2F2;   /* Tint */
--ink:         #1A0F10;   /* Near-black */
--paper:       #FBF7F4;   /* Warm off-white */
--accent-warm: #FFF7ED;   /* Launch/pilot bg */
```

**Type**
- Display: **Fraunces** 600–700, letter-spacing `-0.02em`
- UI / body: **Heebo** 400–700
- Accent / mono: **IBM Plex Mono** 400–500

---

## Wiring into the site

Drop the files into your public folder, then add to `<head>`:

```html
<link rel="icon" href="/branding/favicon/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/branding/favicon/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/branding/favicon/apple-touch-icon-180.png">
<link rel="manifest" href="/site.webmanifest">

<!-- Social -->
<meta property="og:image" content="/branding/social/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
```

**site.webmanifest**:
```json
{
  "name": "OpenSeat",
  "short_name": "OpenSeat",
  "icons": [
    { "src": "/branding/favicon/android-chrome-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/branding/favicon/android-chrome-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#C41E3A",
  "background_color": "#FBF7F4",
  "display": "standalone"
}
```

---

## Usage rules

**Do**
- Keep clear space ≥ 25% of mark height on all sides.
- Use on paper (`#FBF7F4`), white, or ink (`#1A0F10`) backgrounds.
- Use the **reverse** variant on red brand panels.
- Use the **mono** variant when only one ink color is available (engraving, embroidery, single-color print).

**Don't**
- Don't recolor the chair to a non-brand color.
- Don't stretch, skew, or rotate the mark.
- Don't add drop-shadows or bevels.
- Don't place the primary mark on busy photography — use `-reverse` or `-mono-white` on dark imagery.

**Minimum sizes**
- Digital: 16px (use `favicon.svg` or `favicon-16.png`)
- Print: 10mm
- Wordmark minimum: 88px wide digital / 24mm print

---

## Questions / next

If you want additional variants (horizontal wordmark, social avatar at different crops, animated intro, email-signature block, or a print-ready vector PDF), let me know.
