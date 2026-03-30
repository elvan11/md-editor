# PDF Parsing Improvements Guide

## Key Enhancements Needed

### 1. Capture Font Weight Information
**Problem:** Current code ignores font weight (boldness) from PDF text items.

**Solution:** Modify `PdfTextSegment` type and extraction:

```typescript
type PdfTextSegment = {
  text: string
  x: number
  width: number
  fontSize: number
  isBold: boolean  // ADD THIS
  fontName: string // ADD THIS (to detect font type)
}
```

In `extractLinesFromPdfTextContent`, capture boldness:
```typescript
const fontName = String((rawItem as any).fontName || '').toUpperCase()
const isBold = fontName.includes('BOLD') || fontName.includes('HEAVY')
```

### 2. Update `ExtractedLine` Type
```typescript
type ExtractedLine = {
  text: string
  hasTabs: boolean
  fontSize: number
  breakAfter: boolean
  isBold: boolean  // ADD THIS
  fontName: string // ADD THIS
}
```

### 3. Improve Heading Detection with Bold
```typescript
function looksLikeHeading(
  text: string,
  fontSize: number,
  isBold: boolean,
  bodyFontSize: number
): boolean {
  const plain = text.trim()
  if (!plain) return false
  if (plain.length > 90) return false
  if (/^[-*]\s+/.test(plain)) return false
  if (/^\d+[\.\)]\s+/.test(plain)) return false
  if (plain.includes('\t')) return false

  const ratio = fontSize / Math.max(bodyFontSize, 1)
  
  // Bold + slightly larger = heading
  if (isBold && ratio >= 1.05) return true
  
  // Significantly larger = heading
  if (ratio < 1.28) return false

  const wordCount = plain.split(/\s+/).length
  return wordCount <= 14
}
```

### 4. Extract Links from PDF Annotations
After getting page.getTextContent(), also fetch annotations:

```typescript
// Add this inside pdfToMarkdown loop
const annotations = await page.getAnnotations()
const linkMap = buildLinkMap(annotations, textContent)

// Then pass linkMap to markdown generation
```

### 5. Better List Detection
Enhance `normalizeListPrefix` to handle more bullet variations and preserve indentation:

```typescript
const BULLET_CHARS = '•◦▪▸►‣·–−—‐'

function detectListItem(text: string, indentation: number): { isList: boolean; level: number; cleanText: string } {
  const trimmed = text.trimStart()
  const indent = (text.length - trimmed.length) / 2 // rough level
  
  // Check for bullets
  if (new RegExp(`^[${BULLET_CHARS}]\\s+`).test(trimmed)) {
    return {
      isList: true,
      level: Math.floor(indent),
      cleanText: trimmed.replace(new RegExp(`^[${BULLET_CHARS}]\\s+`), '- ')
    }
  }
  
  // Check for numbered lists: "1. " or "1) "
  if (/^\d+[.\)]\s+/.test(trimmed)) {
    return {
      isList: true,
      level: Math.floor(indent),
      cleanText: trimmed // Keep the number
    }
  }
  
  return { isList: false, level: 0, cleanText: text }
}
```

### 6. Detect Typography/Styling Blocks
Add detection for special blocks (warnings, notes):

```typescript
function detectBlockType(
  lines: ExtractedLine[],
  startIndex: number
): 'warning' | 'note' | 'code' | 'normal' {
  if (startIndex >= lines.length) return 'normal'
  
  const firstLine = lines[startIndex].text.toLowerCase()
  const isWarning = /^(warning|⚠|caution|important)/.test(firstLine)
  const isNote = /^(note|📌|remark|info|ℹ)/.test(firstLine)
  const isCode = /^(```|code:)/.test(firstLine)
  
  if (isWarning) return 'warning'
  if (isNote) return 'note'
  if (isCode) return 'code'
  return 'normal'
}
```

### 7. Enhanced Markdown Generation
Update `linesToMarkdown` to use bold and block types:

```typescript
function linesToMarkdown(lines: ExtractedLine[], bodyFontSize: number): string {
  const out: string[] = []

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    
    // Skip empty lines
    if (!line.text.trim()) {
      out.push('')
      continue
    }

    // Handle tabs (tables)
    if (line.hasTabs) {
      const block: ExtractedLine[] = [line]
      while (i + 1 < lines.length && lines[i + 1].hasTabs) {
        block.push(lines[i + 1])
        i += 1
      }
      out.push(...tabbedBlockToMarkdownTable(block))
      out.push('')
      continue
    }

    let normalized = line.text.trim()
    if (!normalized) {
      out.push('')
      continue
    }

    // Check if this is a heading (bold + font size OR just font size)
    if (looksLikeHeading(normalized, line.fontSize, line.isBold, bodyFontSize)) {
      const level = headingLevel(line.fontSize, bodyFontSize)
      out.push(`${'#'.repeat(level)} ${normalized}`)
      out.push('')
      i += 1
      continue
    }

    // Check for list items
    const listInfo = detectListItem(normalized, 0)
    if (listInfo.isList) {
      out.push(listInfo.cleanText)
    } else if (line.isBold) {
      // If it's bold but not a heading, make it bold in markdown
      out.push(`**${normalized}**`)
    } else {
      out.push(normalized)
    }

    if (line.breakAfter) {
      out.push('')
    }
  }

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}
```

### 8. Link Extraction Helper
```typescript
function buildLinkMap(annotations: any[], textContent: any): Map<string, string> {
  const linkMap = new Map<string, string>()
  
  for (const annotation of annotations) {
    if (annotation.subtype === 'Link' && annotation.url) {
      // Try to match text near the link position
      for (const item of textContent.items) {
        if (item.transform[4] === annotation.x) {
          linkMap.set(item.str, annotation.url)
        }
      }
    }
  }
  
  return linkMap
}
```

## Implementation Steps

1. **Update type definitions** (PdfTextSegment, ExtractedLine)
2. **Enhance text extraction** to capture font weight
3. **Improve heading detection** with bold consideration
4. **Add list item detection** 
5. **Enhance markdown generation** to use all new information
6. **Test** with your Scrive PDF - should now show:
   - ✅ Bold headers properly formatted
   - ✅ Bullet lists with proper dashes
   - ✅ Better section breaks
   - ✅ Numbered lists preserved

## Alternative: Use pdf-parse Library

For even better extraction, consider adding `pdf-parse`:

```bash
npm install pdf-parse
```

This extracts metadata including font information, making bold detection more reliable.

## Testing

After implementation, test with your Scrive PDF to verify:
- Headers are bold and at correct levels
- Lists use proper markdown syntax
- Spacing matches document structure
- Special blocks (warnings) are detected
