# UI System Inventory

Quick inventory of common interactive elements and alignment with brand palette.

## Palette and tokens
- Primary brand colors: #FF8895 (pink), #D72638 (red), #3A7FFF (blue), #2D9B66 (green)
- Tailwind config present; recommend adding semantic tokens (e.g., `--color-primary`, `--color-accent`, `--color-success`, `--color-danger`) mapped to the above for consistency.

## Buttons
- Component: `src/components/ui/Button.tsx`
  - Variants: `primary`, `secondary`, `ghost`, `outline`, `success`, `danger`
  - Sizes: `sm`, `md`, `lg`
  - Usage: Widely used (CoursePlayer controls, navigation, actions)
- Gaps & recs:
  - Map `primary/secondary/success/danger` to semantic tokens referencing brand palette.
  - Ensure focus ring uses accessible contrast (recommend 2px ring with offset and WCAG AA).

## Modals/Dialogs
- Observed patterns: local modal state in CoursePlayer for quiz (`showQuizModal`).
- Recs:
  - Consider a shared `Modal` component (focus trap, aria-labelledby/aria-describedby, escape/overlay click handling) for consistency.

## Forms and inputs
- Inputs scattered in admin and org workspace components.
- Recs:
  - Centralize text inputs, selects, textareas under `components/ui/` with consistent label, help text, error display, and sizes.
  - Add accessible field grouping and `aria-invalid` on errors.

## Alerts/Toasts
- `react-hot-toast` integrated; custom `Toast.tsx` present.
- Recs: standardize success/error/info variants to tokenized colors.

## Accessibility
- Buttons: ensure `:focus-visible` treatment across variants.
- Modals: ensure focus trapping and role="dialog" with aria attributes.
- Forms: use proper labels and described-by IDs for errors.

## Next Steps
- Introduce a `ui` index exporting Button and future `Modal`, `Input`, `Select`.
- Add CSS variables/tokens in Tailwind theme for brand mappings.
- Audit for direct `<button>` usage and replace with `Button` where appropriate to reduce drift.
