# UI System Refresh

## UI Audit Report

| Component Area | Current Issue | Recommendation | Impact | Effort |
| --- | --- | --- | --- | --- |
| Navigation (Admin & LMS) | Off-brand grays, inconsistent hover/active states, light-only backgrounds | Apply brand tokens for background/text, unify hover/active states, add elevated surfaces for dark mode readiness | High | Medium |
| Header & Global Chrome | Transparent text contrast, no theme toggle, CTA buttons mismatched | Introduce theme toggle, reuse gradient CTA, align typography and spacing with tokens | High | Medium |
| Forms & Inputs | Default Tailwind borders, inconsistent focus/validation styling | Centralize field styling with border, focus, success/error tokens for accessibility | High | Medium |
| Modals | Raw white surfaces, missing focus affordances | Elevate with surface tokens, border, focus-visible buttons, accessible close control | Medium | Low |
| Feedback (Toasts/Loading) | Hard-coded colors, low-contrast spinners | Bind states to semantic tokens, reuse surface-elevated backgrounds, consistent motion | Medium | Low |
| Data Widgets & Cards | Gradients with system colors, no dark mode fallback | Replace with token-based surfaces, subtle shadows, standard spacing | High | Medium |
| Dark Mode Support | No theme provider, many literal color classes | Add ThemeProvider, CSS variables, override legacy classes, provide toggle | High | Medium |
| Documentation | Prior reports lacked consolidated design guidance | Add refreshed design token & dark/light guidelines in docs | Medium | Low |

## Design System Tokens

Core tokens are defined in [`src/theme/tokens.ts`](../src/theme/tokens.ts) and surfaced via Tailwind CSS variables in [`src/index.css`](../src/index.css).

- **Color Palette**
  - Primary: `#FF8895` (sunrise) with strong/soft variants
  - Secondary: `#D72638` (deep red)
  - Accent/Info: `#3A7FFF`
  - Success: `#2D9B66`
  - Warning: `#F5A524`
  - Danger: `#D72638`
  - Surfaces: `background`, `surface`, `surface-subtle`, `surface-elevated`, `surface-inverse`
  - Overlays: `overlay-soft`, `overlay`, `overlay-strong` for scrims and video tinting
  - Text: `foreground`, `foreground-subtle`, `muted`
  - Border: `border`, `border-subtle`
  - Footer palette for high-contrast footers
- **Typography**
  - Headings: Montserrat 700/600 (H1 2.25rem, H2 1.75rem, H3 1.5rem)
  - Body: Lato 1rem/400, Small 0.875rem/400
  - Accent: Quicksand for optional highlights
- **Radii**: 6px / 8px / 10px / 12px / 16px / 20px aligned to buttons, inputs, cards, modals
- **Shadows**: Card, modal, focus states tuned for light/dark
- **Motion**: Durations `fast` (150ms), `brand` (220ms), `slow` (320ms) with consistent `ease` curves

## Component Library Updates

- **Theming**: Added `ThemeProvider` with system preference syncing, manual overrides, and new `ThemeToggle` control for Admin & marketing headers.
- **Global Styles**: Rebuilt `index.css` with brand typography, CSS variables for light/dark palettes, utility overrides to keep legacy Tailwind classes usable in dark mode.
- **Buttons & Inputs**: Standardized focus rings, spacing, and state tokens in `FormComponents`, `LoadingComponents`, and CTA links.
- **Feedback**: Reworked `Toast` and `Loading` elements to reuse semantic color tokens and shared surfaces.
- **Layouts**: Refreshed `AdminLayout` and `LMSLayout` navigation, cards, and top bars to align with the design system and dark-mode surfaces.
- **Modal**: Elevated surfaces, accessible focus handling, and consistent close affordances.
- **Documentation**: Captured the design language, tokens, and guidelines in this report for future contributors.

## Dark & Light Mode Guidelines

1. Theme is controlled via the new `ThemeProvider`. Use the `useTheme` hook when components need to query or update the preference.
2. Prefer semantic classes (`bg-surface`, `text-muted`, `border-border-subtle`) over literal color names. They automatically switch between light and dark palettes.
3. Gradients should reference tokenized colors (`from-primary`, `to-secondary`) or use neutral surfaces with borders. Avoid hard-coded Tailwind palette values.
4. Always provide a focus state with `focus-visible:shadow-focus` or the `focus-ring` utility for interactive elements.
5. When adding new surfaces, choose from the radius scale (buttons 12px, cards 16px, modals 16-20px) and reuse `shadow-card`/`shadow-modal` for elevation.
6. For imagery or icons, ensure contrast against both background tokens; prefer using `text-foreground`, `text-muted`, or semantic colors.

## Before & After Highlights

- **Navigation**: Sidebars now use branded surfaces with consistent active indicators and hover states, replacing flat grays and light-only backgrounds.
- **Header**: Marketing header includes the theme toggle, unified CTA gradient, and improved contrast across viewports.
- **Forms**: Inputs, selects, textareas, and toggles use shared padding, border, and validation patterns tied to semantic tokens.
- **Modals & Feedback**: Dialogs and toast notifications share elevation, surface, and focus treatments, ensuring parity in both portals.
- **Dark Mode Readiness**: CSS variables and utility overrides keep legacy Tailwind classes readable while new semantic utilities guarantee contrast in dark contexts.

Refer to the updated components and styles for examples when extending the interface.
