# Hockney — History

## Core Context

**Project:** MD Editor — Vue 3 + TypeScript + Vite + Tailwind CSS Markdown editor with HTML and LaTeX export.
**Repository:** `elvan11/md-editor` | branch: `squad-added` | default: `main`
**Workspace:** `e:\MdEditor\md-editor`

**Test targets:**
- `src/lib/markdown-to-latex.ts` — pure function, excellent unit test candidate
- `src/lib/latex-templates.ts` — `escapeLatex()` and `formatLatexTemplate()` are pure functions, easy to test
- Print output: `getLatexRenderedDocument()` returns an HTML string — can be tested by parsing the output

**No test framework set up yet.** Vitest is the recommended choice (Vite project, zero-config).

**Known edge cases to watch:**
- LaTeX special characters in markdown content: `&`, `%`, `$`, `#`, `_`, `{`, `}`, `~`, `^`, `\`
- Code blocks containing LaTeX special chars — `escapeContentAreas()` should handle these
- Empty markdown input
- Markdown with only a title heading (`# My Title`) — `extractTitle()` should return `"My Title"`
- Custom templates with `{TITLE}` / `{CONTENT}` placeholders missing or malformed
- `renderMode` surviving page reload (localStorage persistence)
- Short content that shouldn't cause extra blank pages in HTML print mode

**Print flow that was fixed:**
- HTML print: `window.print()` on current page; `@media print` CSS hides header, left column, section toolbars to prevent blank extra pages
- LaTeX print: `window.open()` new window with `getLatexRenderedDocument()` output + auto-triggered `win.print()`

## Learnings
