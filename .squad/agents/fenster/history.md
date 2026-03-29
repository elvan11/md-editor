# Fenster — History

## Core Context

**Project:** MD Editor — Vue 3 + TypeScript + Vite + Tailwind CSS Markdown editor with HTML and LaTeX export.
**Repository:** `elvan11/md-editor` | branch: `squad-added` | default: `main`
**Workspace:** `e:\MdEditor\md-editor`

**My files:**
- `src/lib/latex-templates.ts` — `LatexTemplate` interface, `DEFAULT_LATEX_TEMPLATES` (article/report/book), `getDefaultTemplate()`, `formatLatexTemplate(template, title, content)`, `escapeLatex()`
- `src/lib/markdown-to-latex.ts` — `markdownToLatex(markdown)` handles headings, bold/italic, code blocks (`lstlisting`), inline code (`lstinline`), links (`\href`), blockquotes (`quote` env), lists (`itemize`/`enumerate`), HR (`\hrulefill`), then `escapeContentAreas()`
- `src/lib/utils.ts` — shared utilities
- `supabase/config.toml` — Supabase local config

**Key functions in App.vue that I own:**
- `getLatexTemplateCss(template: LatexTemplate): string` — returns base CSS (Palatino serif, A4 layout, heading styles, code/table styles) + template-specific overrides
- `getLatexRenderedDocument(html: string, title: string): string` — full `<!DOCTYPE html>` string with embedded CSS, title block, rendered content; used for both print window and preview iframe
- `openLatexPreview()` — sets `generatedLatex` (raw .tex) and `latexPreviewHtmlDoc` (styled HTML doc), shows dialog
- `printCurrentMode()` — HTML: `window.print()`; LaTeX: `window.open()` + writes `getLatexRenderedDocument()` + auto-triggers `win.print()`
- `downloadLatex()`, `copyLatex()`, `extractTitle()`, `escapeHtml()`

**Template system:**
- Templates use `{TITLE}` and `{CONTENT}` placeholders in a LaTeX preamble
- Three built-in: `article` (default), `report`, `book`
- Custom templates stored in localStorage as JSON
- `selectedLatexTemplate` ref, stored in localStorage key `selectedLatexTemplate`

## Learnings
