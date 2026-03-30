# Copilot Instructions for md-editor

## Commands

```bash
npm run dev        # start dev server (Vite, http://localhost:5173/md-editor/)
npm run build      # type-check (vue-tsc) + Vite production build
npm run preview    # preview production build locally
```

There are no test or lint scripts.

## Architecture

Single-page Vue 3 app — a split-view Markdown editor with live preview, PDF import, rich paste (HTML→Markdown), LaTeX export, and print support.

**Key files:**
- `src/App.vue` — the entire application (48 KB). All state, logic, event handlers, and the template live here. There are no Vuex/Pinia stores.
- `src/components/LatexTemplateDialog.vue` — modal for managing LaTeX templates (select built-ins, add/edit/delete custom ones)
- `src/components/LatexPreviewDialog.vue` — modal showing generated LaTeX source + a rendered preview
- `src/components/ui/button/Button.vue` — shadcn-style Button primitive
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `src/lib/latex-templates.ts` — built-in LaTeX template definitions (`LatexTemplate` interface, `{CONTENT}` placeholder convention)
- `src/lib/markdown-to-latex.ts` — Markdown AST → LaTeX string conversion

**Path alias:** `@` resolves to `src/` (configured in `vite.config.ts`).

**Deployment:** GitHub Pages via `.github/workflows/pages.yml`. Vite `base` is `/md-editor/`.

## Key Conventions

### Vue style
- Use `<script setup lang="ts">` (Composition API) for all components.
- Props are typed with `defineProps<Props>()` using an inline interface — no runtime validators.
- Reactive state: `ref` for primitives/objects, `computed` for derived values, `watch` for side effects with persistence (localStorage).

### Tailwind + theming
- All colors are CSS variables mapped through Tailwind (`hsl(var(--primary))`, etc.) — do **not** hardcode color values.
- Dark mode is class-based (`darkMode: ["class"]`). The `dark` class is toggled on `<html>` by `applyTheme()` in `App.vue`. Theme persists in `localStorage` under the key `"theme"`.
- Use the `cn()` helper from `@/lib/utils` for conditional/merged class strings.

### LaTeX templates
- Every template **must** include a `{CONTENT}` placeholder where the converted Markdown body is injected.
- Built-in templates live in `src/lib/latex-templates.ts`. Custom templates are stored in `localStorage` under `"latexTemplates"`.

### PDF parsing
- `pdfjs-dist` worker is loaded via `?url` import: `import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'`.
- Text extraction reconstructs lines from raw PDF segments by grouping on quantized Y coordinates and computing per-row font sizes, bold detection, and inter-line gaps. The threshold constants (`MAX_PDF_BYTES = 10 MB`, `MAX_PDF_PAGES = 100`) are enforced before extraction begins.

### HTML → Markdown (paste)
- `TurndownService` is configured once at module level with `headingStyle: 'atx'`, `codeBlockStyle: 'fenced'`, `emDelimiter: '*'`, `bulletListMarker: '-'`, and the GFM plugin.
- Custom Turndown rules for `table`, `span`, `div`/`p` are registered on the same instance — add new rules there, don't create a second instance.
- All pasted HTML is sanitized with DOMPurify **before** conversion.

### Markdown rendering
- `MarkdownIt` instance is module-level, options: `html: false`, `linkify: true`, `typographer: true`, `breaks: true`.
- Rendered output is always passed through `DOMPurify.sanitize()` before being set as `innerHTML`.

### Documentation placement
- All analysis docs, guides, improvement plans, and architecture notes go in `/docs`.
- Only config files, `README.md`, and top-level project files belong at the repo root.

### Supabase
- The `supabase` package is a **devDependency** (CLI only). There is no Supabase client in the runtime code — do not add `@supabase/supabase-js` imports without a clear backend integration plan.
