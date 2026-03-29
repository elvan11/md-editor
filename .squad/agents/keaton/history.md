# Keaton — History

## Core Context

**Project:** MD Editor — Vue 3 + TypeScript + Vite + Tailwind CSS Markdown editor with HTML and LaTeX export.
**Repository:** `elvan11/md-editor` | branch: `squad-added` | default: `main`
**Workspace:** `e:\MdEditor\md-editor`

**Key files:**
- `src/App.vue` — main application (~1000 lines), all editor logic and UI
- `src/lib/latex-templates.ts` — LaTeX template definitions and utilities
- `src/lib/markdown-to-latex.ts` — Markdown to LaTeX converter
- `src/components/LatexPreviewDialog.vue` — preview dialog (uses iframe + `previewHtmlDoc` prop)
- `src/components/LatexTemplateDialog.vue` — template manager dialog
- `src/components/ui/button/Button.vue` — shadcn-style button component
- `supabase/config.toml` — Supabase local config

**Architecture decisions made so far:**
- **Render mode:** `renderMode` ref (`'html' | 'latex'`) drives the entire preview and print pipeline; persisted to localStorage
- **LaTeX rendering:** No actual LaTeX compilation — markdown is converted to styled HTML that mimics a compiled LaTeX document (Palatino serif, A4 margins, section styles)
- **Print strategy:** HTML mode → `window.print()` on current page with `@media print` CSS that hides all UI chrome; LaTeX mode → `window.open()` + `getLatexRenderedDocument()` + auto-print
- **Preview dialog:** Uses `<iframe :srcdoc="previewHtmlDoc">` for accurate WYSIWYG; `previewHtmlDoc` is the same styled HTML doc used for printing

## Learnings
