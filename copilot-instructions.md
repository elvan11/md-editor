# Copilot Instructions for md-editor

## Documentation Organization

When creating documentation, guides, or analysis files, **always place them in the `/docs` folder** rather than the project root.

### Directory Structure
- `/docs` - All analysis documents, guides, improvement plans, and technical documentation
- Root level - Only config files (package.json, tsconfig.json, vite.config.ts, etc.), source files (src/), and high-level README

### File Placement Rules

| File Type | Location |
|-----------|----------|
| README, setup guide | Root or `/docs` |
| Implementation guides | `/docs` |
| Improvement proposals | `/docs` |
| Analysis documents | `/docs` |
| API documentation | `/docs` |
| Architecture notes | `/docs` |
| Configuration files | Root |
| Source code | `/src`, `/public`, `/supabase` |

### Examples

✅ **Correct:**
- `docs/PDF_PARSING_IMPROVEMENTS.md`
- `docs/IMPROVEMENTS_SUMMARY.md`
- `docs/ARCHITECTURE.md`
- `docs/API_REFERENCE.md`

❌ **Incorrect:**
- `PDF_PARSING_IMPROVEMENTS.md` (in root)
- `IMPROVEMENTS_SUMMARY.md` (in root)

## When Creating Documentation

Before creating any `.md` file, check:
1. Is this documentation/analysis/guide? → Place in `/docs`
2. Is this a critical project file (README, LICENSE, CONTRIBUTING)? → May go in root
3. Is this source code or config? → Use appropriate folder (`/src`, root, etc.)

## Future Enhancements to Document

When working on PDF parsing or other features, create guides in:
- `docs/PDF_PARSING_GUIDE.md` - PDF parsing implementation details
- `docs/LATEX_SUPPORT.md` - LaTeX template system documentation
- `docs/DEVELOPMENT.md` - Development setup and workflow

---

**Last updated:** March 30, 2026
