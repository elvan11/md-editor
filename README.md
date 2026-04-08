# MD Editor

A fast, split-view Markdown editor with live preview, rich paste handling, and print-friendly output.

## Features
- Live 50/50 editor + preview layout
- Markdown preview rendered with sanitized HTML
- Paste rich text into the preview to convert to Markdown
- One-click "Copy formatted" for Google Docs and other editors
- PDF import with automatic Markdown conversion
- Mermaid diagram support in live preview and print output
- LaTeX export with customizable templates
- Print view shows only the rendered Markdown content
- Light / dark / auto theme toggle

## Usage
1. Type Markdown in the left editor.
2. Preview updates instantly on the right.
3. Paste rich text into the preview area to convert it into Markdown.
4. Click "Copy formatted" to copy rich HTML + plain text.
5. Print from the browser; only the formatted content is included.

## Development
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Tech Stack
- Vue 3 + TypeScript
- Vite
- Tailwind CSS
- Markdown-It + DOMPurify

## License
MIT

## Changelog

### 2026-04-08
- Mermaid diagram support in live preview (HTML + LaTeX modes)
- Mermaid diagrams in HTML and LaTeX print output
- Uses `default` (light) mermaid theme for print compatibility

### 2026-03-30
- Enhanced PDF parsing with font weight detection and improved markdown generation
- Refactored code structure for improved readability and maintainability

### 2026-03-29
- Added LaTeX preview modal for rendering LaTeX content
- Added LaTeX template management component for predefined and custom templates
- Implemented Markdown to LaTeX conversion

### 2026-02-25
- Enhanced print styles for headings with improved layout and margin adjustments

### 2026-02-20
- Added PDF import functionality with drag-and-drop support
- Automatic PDF text extraction and Markdown conversion
- User feedback for import status and errors
- Added Supabase integration and configuration files

### 2026-01-22
- Updated README with comprehensive project description, features, and tech stack
- Enhanced print styles for Markdown content

### 2025-09-15
- Added initial HTML structure, CSS styles, and SVG assets
- Implemented theme switching and UI components
- Added GitHub Actions workflow for deploying to GitHub Pages
- Updated workflow to use Node.js 20 with type checking
- Added deployment documentation
- Fixed SVG path coordinates

### 2025-09-14
- Initialized markdown editor project with Vue 3 and Vite
