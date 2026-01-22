# MD Editor

A fast, split-view Markdown editor with live preview, rich paste handling, and print-friendly output.

## Features
- Live 50/50 editor + preview layout
- Markdown preview rendered with sanitized HTML
- Paste rich text into the preview to convert to Markdown
- One-click “Copy formatted” for Google Docs and other editors
- Print view shows only the rendered Markdown content
- Light / dark / auto theme toggle

## Usage
1. Type Markdown in the left editor.
2. Preview updates instantly on the right.
3. Paste rich text into the preview area to convert it into Markdown.
4. Click “Copy formatted” to copy rich HTML + plain text.
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
