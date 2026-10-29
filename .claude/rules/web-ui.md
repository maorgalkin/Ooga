---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/App.tsx"
  - "src/index.css"
  - "tailwind.config.js"
  - "index.html"
---

# Web UI (React + Tailwind)

- Theme colours are `purple`, `blue`, `green`, `indigo`. The PostCSS build only includes a class built at runtime (`` `bg-${color}-500` ``) if it matches a `safelist` pattern in `tailwind.config.js`; prefer passing full class names as props, and extend the safelist when you can't.
- `index.html` also loads the Tailwind Play CDN (a "temporary fallback") in dev and production alike. It generates missing classes in the browser, so it hides safelist gaps everywhere. Don't rely on it: to check a change, run `npm run build && npm run preview` with `cdn.tailwindcss.com` blocked in the browser's devtools (Network → Block request URL).
- Every visual change gets `dark:` variants (dark mode follows the OS).
- Mobile matters: the app is used on iPhones. Keep tap targets comfortable (the nav buttons use `min-h-[38px]`), keep long-press and swipe paths working, and expect iOS Safari quirks with date inputs and touch scrolling (`git log --grep=iOS`, `docs/learning/` and `learning/` record past fixes).
- Modals: no scrollbars, `flex flex-col`, compact spacing (`space-y-3`), destructive or secondary action on the left, primary on the right, render through a portal like `AddTransaction` does.
- Recharts 3: `<Pie>` has no `activeIndex` prop; the active slice follows the tooltip. Animate with framer-motion, icons from lucide-react.
- Text from banks is often Hebrew: give it `dir="auto"` and `truncate` with a `title`, as `DuplicatesBubble` and `ImportReviewStep` do.
- Accessibility: every input has a `<label htmlFor>`; icon-only buttons get an `aria-label`; toggles and popovers expose `aria-expanded` / `role="dialog"` (see `DuplicatesBubble`).
- Write UI text by the `microcopy` skill. Don't add new `alert()`/`confirm()` calls: show errors inline next to the action, and use a confirm modal for destructive actions.
- Money goes through `formatCurrencyFromSettings`, dates through `getUserLocale()`; no new hard-coded `'en-US'` formatters.
