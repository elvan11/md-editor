# Dallas — History

## Core Context

**Project:** MD Editor — Vue 3 + TypeScript + Vite + Tailwind CSS Markdown editor with HTML and LaTeX export.
**Repository:** `elvan11/md-editor` | branch: `squad-added` | default: `main`
**Workspace:** `e:\MdEditor\md-editor`

**My files:**
- `src/App.vue` — template section, `<style scoped>` block, UI interaction handlers
- `src/components/LatexPreviewDialog.vue` — modal with iframe preview tab and source tab
- `src/components/LatexTemplateDialog.vue` — template selector/adder modal
- `src/components/ui/button/Button.vue` — Button component (shadcn pattern)

**UI structure I own:**
- Two-column layout: left textarea (markdown input), right preview pane
- Preview pane header: `Preview` label → `[HTML][LaTeX]` toggle → template name pill (LaTeX mode only) → spacer → `Drop PDF` hint → `Print` button → `Copy formatted` button
- LaTeX action bar (v-if `renderMode === 'latex'`): `LaTeX export:` label → `Preview / Source` → `Download .tex` → `Copy .tex` → spacer → `Manage templates`
- Preview div: `class="max-w-none leading-relaxed outline-none prose print-content"` (HTML) or `"... latex-preview"` (LaTeX)

**Scoped CSS I own in App.vue:**
- `.prose :deep(...)` rules — heading sizes, paragraph spacing, lists, code, blockquote, links
- `.latex-preview :deep(...)` rules — Palatino serif font, A4-like spacing, LaTeX-style heading hierarchy
- `@media print` block — hides header, left column, section toolbars; makes preview full-width; page-break rules

**Known issue fixed:** HTML print was generating a blank extra page. Fixed by adding comprehensive `@media print` rules that strip all layout / padding and expose only the `.print-content` div.

## Learnings
