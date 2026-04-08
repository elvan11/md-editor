# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.0.0] - 2026-04-08

### Added
- Mermaid diagram support in live preview (HTML + LaTeX modes)
- Mermaid diagrams in HTML and LaTeX print output — uses `default` (light) theme for print compatibility
- Enhanced PDF parsing with font weight detection and improved Markdown generation
- LaTeX preview modal for rendering LaTeX content
- LaTeX template management component for predefined and custom templates
- Markdown to LaTeX conversion
- PDF import functionality with drag-and-drop support
- Automatic PDF text extraction and Markdown conversion
- User feedback for import status and errors
- Supabase integration and configuration files
- Live 50/50 editor + preview layout
- Paste rich text into the preview to convert it into Markdown
- One-click "Copy formatted" for Google Docs and other editors
- Light / dark / auto theme toggle

### Changed
- Refactored code structure for improved readability and maintainability
- Enhanced print styles for headings with improved layout and margin adjustments
- Enhanced print styles for Markdown content
- Updated workflow to use Node.js 20 with type checking

### Fixed
- Fixed SVG path coordinates

---

*Earlier history (2025-09-14 – 2026-03-30) is included in this release as the project predates semantic versioning.*
