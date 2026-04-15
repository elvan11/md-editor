<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import Button from '@/components/ui/button/Button.vue'
import LatexTemplateDialog from '@/components/LatexTemplateDialog.vue'
import LatexPreviewDialog from '@/components/LatexPreviewDialog.vue'
import TurndownService from 'turndown'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
// @ts-ignore - types may not be bundled
import { gfm } from 'turndown-plugin-gfm'
import { DEFAULT_LATEX_TEMPLATES, getDefaultTemplate, formatLatexTemplate, type LatexTemplate } from '@/lib/latex-templates'
import { markdownToLatex } from '@/lib/markdown-to-latex'
import { downloadDocxDocument } from '@/lib/docx-export'
import mermaid from 'mermaid'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGES = 100

type PdfTextSegment = {
  text: string
  x: number
  width: number
  fontSize: number
  isBold: boolean
  fontName: string
}

type ExtractedLine = {
  text: string
  hasTabs: boolean
  fontSize: number
  breakAfter: boolean
  isBold: boolean
  boldPrefix: boolean
  startX: number
  fontName: string
}

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
})

// Override fence renderer to support Mermaid diagrams
const _origFence = md.renderer.rules.fence
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = (token.info || '').trim().split(/\s+/)[0].toLowerCase()
  if (lang === 'mermaid') {
    const escaped = md.utils.escapeHtml(token.content.trim())
    const dataSource = escaped.replace(/"/g, '&quot;')
    return `<pre class="mermaid" data-source="${dataSource}">${escaped}</pre>\n`
  }
  if (_origFence) return _origFence(tokens, idx, options, env, self)
  return self.renderToken(tokens, idx, options)
}

// LaTeX Templates State
const templates = ref<LatexTemplate[]>([
  ...DEFAULT_LATEX_TEMPLATES,
])
const selectedLatexTemplate = ref<LatexTemplate>(getDefaultTemplate())
const showTemplateDialog = ref(false)
const showLatexPreview = ref(false)
const generatedLatex = ref('')
const latexPreviewHtmlDoc = ref('')

type RenderMode = 'html' | 'latex'
const RENDER_MODE_KEY = 'renderMode'
const renderMode = ref<RenderMode>(
  (localStorage.getItem(RENDER_MODE_KEY) as RenderMode) === 'latex' ? 'latex' : 'html'
)

watch(renderMode, (mode) => {
  try { localStorage.setItem(RENDER_MODE_KEY, mode) } catch (_) {}
})

const mdInput = ref<string>(`# Markdown Editor

Live preview on the right. Try editing this text.

## Features

- 50/50 split layout (desktop-first)
- Instant preview while typing
- One-click rich copy for Google Docs

### Formatting examples

**Bold**, _italic_, and \`code\`.

> Blockquotes work too.

1. Ordered list
2. Keeps formatting when pasted into Google Docs

[Vue](https://vuejs.org/) • [Tailwind](https://tailwindcss.com/)`)

const renderedHtml = computed(() => {
  const raw = md.render(mdInput.value)
  return DOMPurify.sanitize(raw, { ADD_ATTR: ['data-source'] })
})

const previewRef = ref<HTMLDivElement | null>(null)
const previewActionsMenuRef = ref<HTMLDivElement | null>(null)
const isImportingPdf = ref(false)
const importStatus = ref('')
const importError = ref('')
const exportError = ref('')
const previewActionsMenuOpen = ref(false)
const dragDepth = ref(0)
const isDraggingPdf = computed(() => dragDepth.value > 0)

// Mermaid helpers — always use the light theme so diagrams are legible on any background
// and print cleanly regardless of the app's dark/light mode.
function initMermaid() {
  mermaid.initialize({ startOnLoad: false, theme: 'default' })
}

async function runMermaid() {
  if (!previewRef.value) return
  const elements = Array.from(
    previewRef.value.querySelectorAll<HTMLElement>('.mermaid:not([data-processed])')
  )
  if (elements.length === 0) return
  try {
    await mermaid.run({ nodes: elements })
  } catch (e) {
    console.warn('Mermaid render error:', e)
  }
}

async function reinitAndRerunMermaid() {
  initMermaid()
  if (!previewRef.value) return
  // Restore original source text so mermaid can re-render
  previewRef.value.querySelectorAll<HTMLElement>('.mermaid[data-processed]').forEach(el => {
    const src = el.dataset.source
    if (src) {
      el.innerHTML = src
      el.removeAttribute('data-processed')
    }
  })
  await nextTick()
  await runMermaid()
}

// Re-run mermaid after every markdown render update
watch(renderedHtml, () => { nextTick().then(() => runMermaid()) })

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
})
td.use(gfm)

// Add custom table handling for Google Docs complex tables
td.addRule('tables', {
  filter: 'table',
  replacement: function (content, node) {
    const rows = Array.from(node.querySelectorAll('tr'))
    if (rows.length === 0) return content
    
    let markdown = '\n'
    
    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('td, th'))
      if (cells.length === 0) return
      
      // Create the row
      const cellTexts = cells.map(cell => {
        // Get text content and clean it up
        let text = cell.textContent || ''
        text = text.trim().replace(/\s+/g, ' ')
        return text || ' '
      })
      
      markdown += '| ' + cellTexts.join(' | ') + ' |\n'
      
      // Add header separator after first row
      if (rowIndex === 0) {
        markdown += '| ' + cellTexts.map(() => '---').join(' | ') + ' |\n'
      }
    })
    
    return markdown + '\n'
  }
})

// Improve handling of complex styled elements
td.addRule('cleanSpans', {
  filter: ['span'],
  replacement: function (content) {
    return content
  }
})

td.addRule('cleanDivs', {
  filter: ['div', 'p'],
  replacement: function (content, node) {
    return content + '\n'
  }
})

function onPastePreview(e: ClipboardEvent) {
  if (!e.clipboardData) return
  e.preventDefault()
  const html = e.clipboardData.getData('text/html')
  const text = e.clipboardData.getData('text/plain')
  
  try {
    if (html) {
      // Clean and sanitize the HTML
      let cleanHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['table', 'tbody', 'thead', 'tr', 'td', 'th', 'p', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br'],
        ALLOWED_ATTR: ['href']
      })
      
      // Convert to markdown
      const mdOut = td.turndown(cleanHtml)
      
      // Clean up extra newlines and spaces
      const cleanedMd = mdOut
        .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
        .replace(/^\s+|\s+$/g, '')   // Trim whitespace
        .replace(/\|\s*\|\s*\|/g, '| | |') // Fix empty table cells
      
      mdInput.value = cleanedMd
    } else if (text) {
      mdInput.value = text
    }
  } catch (err) {
    console.error('Error converting HTML to Markdown:', err)
    // Fallback to plain text
    if (text) {
      mdInput.value = text
    } else {
      // If no plain text, try to extract text from HTML
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = DOMPurify.sanitize(html)
      mdInput.value = tempDiv.textContent || tempDiv.innerText || ''
    }
  }
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
}

function pickPdfFile(fileList: FileList | null): File | null {
  if (!fileList) return null
  for (const file of Array.from(fileList)) {
    if (isPdfFile(file)) return file
  }
  return null
}

function getMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

function quantizeY(value: number): number {
  return Math.round(value / 2) * 2
}

function isFontBold(fontName: string): boolean {
  const upper = String(fontName || '').toUpperCase()
  return upper.includes('BOLD') || upper.includes('HEAVY') || upper.includes('BLACK') || /[Ww]eight.*[67]/i.test(fontName)
}

const BULLET_CHARS = '•◦▪▸►‣·–−—‐'

function detectListItem(text: string): { isListItem: boolean; cleanText: string } {
  const trimmed = text.trimStart()
  
  // Check for bullet points
  if (new RegExp(`^[${BULLET_CHARS}]\\s+`).test(trimmed)) {
    return {
      isListItem: true,
      cleanText: trimmed.replace(new RegExp(`^[${BULLET_CHARS}]\\s+`), '- ')
    }
  }
  
  // Check for numbered lists
  if (/^\d+[.)]\s+/.test(trimmed)) {
    return {
      isListItem: true,
      cleanText: trimmed
    }
  }
  
  return { isListItem: false, cleanText: text }
}

function extractLinesFromPdfTextContent(textContent: any): ExtractedLine[] {
  // textContent.styles maps internal PDF font IDs (e.g. "g_d0_f0") to readable properties.
  // We must use this to get the actual font family name — the raw fontName on each item
  // is an opaque internal reference, not "Inter-Bold" or "Helvetica-Bold".
  const styles: Record<string, { fontFamily?: string }> = (textContent as any).styles || {}
  const rowMap = new Map<number, PdfTextSegment[]>()

  for (const rawItem of textContent.items || []) {
    // Don't trim — leading/trailing spaces in PDF items encode word boundaries.
    // Only collapse runs of multiple spaces to one.
    const text = String((rawItem as any).str || '').replace(/ {2,}/g, ' ')
    if (!text) continue

    const transform = Array.isArray((rawItem as any).transform) ? (rawItem as any).transform : []
    const x = Number(transform[4] || 0)
    const y = Number(transform[5] || 0)
    const width = Number((rawItem as any).width || 0)
    const fontSize = Math.abs(Number(transform[0] || transform[3] || (rawItem as any).height || 12))
    const internalFontName = String((rawItem as any).fontName || '')
    // Resolve to readable font family (e.g. "Inter-Bold") via the styles map.
    const resolvedFamily = String(styles[internalFontName]?.fontFamily || internalFontName)
    const isBold = isFontBold(resolvedFamily)

    const yKey = quantizeY(y)
    const segments = rowMap.get(yKey) || []
    segments.push({ text, x, width, fontSize, isBold, fontName: resolvedFamily })
    rowMap.set(yKey, segments)
  }

  const rows = Array.from(rowMap.entries())
    .map(([y, segments]) => ({ y, segments: segments.sort((a, b) => a.x - b.x) }))
    .sort((a, b) => b.y - a.y)

  // Compute the document's typical inter-line gap (body text line height).
  // We take the 40th-percentile of all positive gaps so that large inter-paragraph
  // or inter-section gaps don't inflate the "normal" baseline.
  // A real paragraph break is when a gap is >= 1.5x that typical value.
  const allGaps = rows
    .slice(0, -1)
    .map((row, i) => Math.abs(row.y - rows[i + 1].y))
    .filter(g => g > 0)
  const sortedGaps = [...allGaps].sort((a, b) => a - b)
  const typicalGap = sortedGaps.length > 0
    ? sortedGaps[Math.floor(sortedGaps.length * 0.4)]
    : 14
  const breakThreshold = typicalGap * 1.5

  const lines: ExtractedLine[] = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    let text = ''
    let hasTabs = false
    let hasAnyBold = false

    // Pre-compute font size using only segments that contain visible text.
    // This is used for gap thresholds and avoids being skewed by whitespace items.
    const visibleSegs = row.segments.filter(s => s.text.trim().length > 0)
    const rowFontSize = visibleSegs.length > 0
      ? visibleSegs.reduce((sum, s) => sum + s.fontSize, 0) / visibleSegs.length
      : 12

    let previousEnd = 0

    row.segments.forEach((segment) => {
      const isWhitespace = segment.text.trim() === ''

      if (isWhitespace) {
        // Space-only items mark word boundaries; insert a space and advance position.
        if (text.length > 0 && !text.endsWith(' ') && !text.endsWith('\t')) {
          text += ' '
        }
        previousEnd = segment.x + segment.width
        return
      }

      if (previousEnd > 0) {
        const gap = segment.x - previousEnd
        // A word space in typical fonts is ~0.25 em.
        // 0.1 em catches any real gap while ignoring sub-0.05 em kerning adjustments.
        const spaceThreshold = rowFontSize * 0.1
        const tabThreshold = rowFontSize * 2.5
        const alreadySpaced = text.endsWith(' ') || text.endsWith('\t')
        const segLeadsSpace = segment.text.startsWith(' ')

        if (gap > tabThreshold && !alreadySpaced) {
          text += '\t'
          hasTabs = true
        } else if (gap > spaceThreshold && !alreadySpaced && !segLeadsSpace) {
          text += ' '
        }
      }

      // If we already have a trailing space, strip the segment's own leading space
      // to avoid doubling up.
      const segText = (text.endsWith(' ') || text.endsWith('\t'))
        ? segment.text.trimStart()
        : segment.text
      text += segText
      previousEnd = segment.x + segment.width
      if (segment.isBold) hasAnyBold = true
    })

    const normalized = text.replace(/[ \t]+$/g, '').replace(/ {2,}/g, ' ').trim()
    if (!normalized) continue

    const dominantFont = visibleSegs[0]?.fontName || ''
    const boldPrefix = visibleSegs[0]?.isBold ?? false
    const startX = visibleSegs[0]?.x ?? 0
    const nextRow = rows[i + 1]
    const rowGap = nextRow ? Math.abs(row.y - nextRow.y) : 0
    const breakAfter = rowGap > breakThreshold

    lines.push({
      text: normalized,
      hasTabs,
      fontSize: rowFontSize,
      breakAfter,
      isBold: hasAnyBold,
      boldPrefix,
      startX,
      fontName: dominantFont,
    })
  }

  return lines
}

function looksLikeHeading(text: string, fontSize: number, isBoldOrFontSize: number | boolean, bodyFontSizeOrUndefined?: number): boolean {
  // Handle both old and new call signatures for backward compatibility
  let isBold = false
  let bodyFontSize = 12
  
  if (typeof isBoldOrFontSize === 'boolean') {
    isBold = isBoldOrFontSize
    bodyFontSize = bodyFontSizeOrUndefined || 12
  } else {
    bodyFontSize = isBoldOrFontSize
  }

  const plain = text.trim()
  if (!plain) return false
  if (plain.length > 120) return false
  if (/^[-*]\s+/.test(plain)) return false
  if (/^\d+[\.\)]\s+/.test(plain)) return false
  if (plain.includes('\t')) return false
  if (new RegExp(`^[${BULLET_CHARS}]`).test(plain)) return false
  // Inline bold labels like "Type of partner: some long text" are not headings.
  // A colon followed by more content (not just end-of-string) is a strong indicator.
  if (/:\s+\S/.test(plain)) return false

  const ratio = fontSize / Math.max(bodyFontSize, 1)
  const wordCount = plain.split(/\s+/).length

  // Bold + same/similar size: short standalone lines are headings
  if (isBold && ratio >= 0.9 && wordCount <= 10) return true
  
  // Non-bold needs to be significantly larger
  if (ratio < 1.2) return false

  return wordCount <= 14
}

function headingLevel(fontSize: number, bodyFontSize: number): number {
  const ratio = fontSize / Math.max(bodyFontSize, 1)
  if (ratio >= 1.95) return 1
  if (ratio >= 1.65) return 2
  return 3
}

function normalizeListPrefix(text: string): string {
  return text
    .replace(/^[•◦▪▸►‣]\s*/u, '- ')
    .replace(/^\((\d+)\)\s+/, '$1. ')
}

function isMonospaceFont(fontName: string): boolean {
  const lower = String(fontName || '').toLowerCase()
  return (
    lower.includes('mono') ||
    lower.includes('courier') ||
    lower.includes('consolas') ||
    lower.includes('code') ||
    lower.includes('fixed') ||
    lower.includes('typewriter') ||
    lower.includes('fira') ||
    lower.includes('inconsolata') ||
    lower.includes('menlo') ||
    lower.includes('monaco') ||
    lower.includes('lucida console')
  )
}

function extractLineNumber(text: string): { num: number; rest: string } | null {
  // Matches "42 <code line>" but NOT "42. list item" or "42) list item"
  const m = text.match(/^(\d+)\s+(.+)/)
  if (!m) return null
  return { num: parseInt(m[1], 10), rest: m[2] }
}

function detectCodeLanguage(code: string): string {
  if (/<\!doctype\s+html/i.test(code) || /<html[\s>]/i.test(code)) return 'html'
  if (/^\s*(import\s|export\s|const\s|let\s|var\s|function\s|class\s)/m.test(code) || /=>\s*[{(]/.test(code)) return 'javascript'
  if (/^\s*(def |class |import |from )\w/m.test(code)) return 'python'
  if (/^\s*(public|private|protected|class|interface|void)\s+/m.test(code)) return 'java'
  return ''
}

function looksLikeCodeContent(text: string): boolean {
  return /[<>{};()\[\]=\/\\]/.test(text) ||
    /^\s*(import|export|const|let|var|function|class|def|return|if|for|while|elif|else)\b/.test(text) ||
    /^#!/.test(text)
}

function splitTabbedColumns(text: string): string[] {
  return text.split('\t').map((part) => part.trim())
}

function fallbackTabbedBlock(block: ExtractedLine[]): string[] {
  return block.map((line) => normalizeListPrefix(line.text.replace(/\t+/g, ' ').replace(/[ ]{2,}/g, ' ').trim()))
}

function tabbedBlockToMarkdownTable(block: ExtractedLine[]): string[] {
  const rows = block.map((line) => splitTabbedColumns(line.text))
  const minCols = Math.min(...rows.map((row) => row.length))
  const maxCols = Math.max(...rows.map((row) => row.length))

  if (rows.length < 2 || maxCols < 2 || maxCols - minCols > 1) {
    return fallbackTabbedBlock(block)
  }

  const colCount = maxCols
  const paddedRows = rows.map((row) => {
    const normalized = row.map((cell) => cell.replace(/\|/g, '\\|').trim())
    while (normalized.length < colCount) normalized.push('')
    return normalized.slice(0, colCount)
  })

  const header = `| ${paddedRows[0].join(' | ')} |`
  const divider = `| ${Array.from({ length: colCount }, () => '---').join(' | ')} |`
  const body = paddedRows.slice(1).map((row) => `| ${row.join(' | ')} |`)

  return [header, divider, ...body]
}

function linesToMarkdown(lines: ExtractedLine[], bodyFontSize: number): string {
  const out: string[] = []
  let buffer: string[] = []
  let inList = false

  // Compute the document's left margin and list-indent threshold.
  // Lines clearly to the right of the left margin are likely list items.
  const nonEmptyXs = lines.filter(l => l.text.trim()).map(l => l.startX).sort((a, b) => a - b)
  const leftMargin = nonEmptyXs[Math.floor(nonEmptyXs.length * 0.1)] ?? 0
  const listIndentMin = leftMargin + bodyFontSize * 0.4

  // Detect "ShortLabel: description" patterns used in definition-style bullet lists.
  // Works even when font metadata doesn't expose bold, and even when the
  // PDF bullet glyph isn't mapped to a Unicode bullet character.
  function asLabelItem(text: string): RegExpMatchArray | null {
    // Label: capitalised, no colon inside it, ≤68 chars, ≤9 words.
    const m = text.match(/^([A-Z][^:\n]{0,67}):\s+(\S.+)/)
    if (!m) return null
    const words = m[1].trim().split(/\s+/).length
    return words <= 9 ? m : null
  }

  function flushBuffer(tight = false) {
    if (buffer.length === 0) return
    out.push(buffer.join(' '))
    if (!tight) out.push('')
    buffer = []
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]

    // ── Tables ────────────────────────────────────────────────────────────────
    if (line.hasTabs) {
      flushBuffer()
      inList = false
      const block: ExtractedLine[] = [line]
      while (i + 1 < lines.length && lines[i + 1].hasTabs) {
        block.push(lines[i + 1])
        i += 1
      }
      out.push(...tabbedBlockToMarkdownTable(block))
      out.push('')
      continue
    }

    const trimmed = line.text.trim()
    if (!trimmed) {
      flushBuffer()
      inList = false
      continue
    }

    // ── Code block (monospace font OR sequential line-numbered listing) ──────
    {
      const isMonospace = isMonospaceFont(line.fontName)
      const firstNum = extractLineNumber(trimmed)
      const nextTrimmed = (lines[i + 1]?.text ?? '').trim()
      const secondNum = extractLineNumber(nextTrimmed)
      // Require at least two consecutive numbered lines AND code-like content
      // to avoid treating "1 First item / 2 Second item" prose as code.
      const isSequential =
        firstNum !== null &&
        secondNum !== null &&
        secondNum.num === firstNum.num + 1 &&
        (looksLikeCodeContent(firstNum.rest) || looksLikeCodeContent(secondNum.rest))

      if (isMonospace || isSequential) {
        flushBuffer()
        inList = false

        const useLineNumbers = isSequential && !isMonospace
        const codeLines: string[] = []
        let expectedNum = firstNum?.num ?? 1

        while (i < lines.length) {
          const cur = lines[i]
          const curTrimmed = cur.text.trim()
          if (!curTrimmed) { i++; continue }

          const curNum = extractLineNumber(curTrimmed)
          const curIsMono = isMonospaceFont(cur.fontName)

          if (useLineNumbers) {
            if (curNum && curNum.num === expectedNum) {
              codeLines.push(curNum.rest)
              expectedNum++
              i++
            } else {
              break
            }
          } else {
            if (!curIsMono) break
            codeLines.push(curTrimmed)
            i++
          }
        }
        i-- // compensate for outer loop i += 1

        if (codeLines.length > 0) {
          const lang = detectCodeLanguage(codeLines.join('\n'))
          out.push(`\`\`\`${lang}`)
          out.push(...codeLines)
          out.push('```')
          out.push('')
        }
        continue
      }
    }

    // ── Headings ──────────────────────────────────────────────────────────────
    if (looksLikeHeading(trimmed, line.fontSize, line.isBold, bodyFontSize)) {
      flushBuffer()
      inList = false
      const level = headingLevel(line.fontSize, bodyFontSize)
      out.push(`${'#'.repeat(level)} ${trimmed}`)
      out.push('')
      continue
    }

    // ── Explicit bullet / numbered list item ──────────────────────────────────
    const listDetection = detectListItem(trimmed)
    if (listDetection.isListItem) {
      if (inList) flushBuffer(true)
      else flushBuffer(false)
      inList = true
      const clean = listDetection.cleanText
      // Promote bold label inside item if font data supports it
      const boldLabel = line.boldPrefix
        ? clean.match(/^(-\s+|\d+\.\s+)([^:]{1,60}):\s+(.+)/)
        : null
      buffer = [boldLabel ? `${boldLabel[1]}**${boldLabel[2]}:** ${boldLabel[3]}` : clean]
      if (line.breakAfter) { flushBuffer(false); inList = false }
      continue
    }

    // ── Label-style item: "ShortLabel: description" ───────────────────────────
    // Primary signal: text pattern. Guard: line is indented, OR first segment
    // is bold (font-based detection), OR label is very short (≤4 words, very
    // unlikely to be a prose sentence).
    const labelM = asLabelItem(trimmed)
    if (labelM) {
      const labelWords = labelM[1].trim().split(/\s+/).length
      const isIndented = line.startX >= listIndentMin
      if (isIndented || line.boldPrefix || labelWords <= 4) {
        if (inList) flushBuffer(true)
        else flushBuffer(false)
        inList = true
        buffer = [`- **${labelM[1].trim()}:** ${labelM[2]}`]
        if (line.breakAfter) { flushBuffer(false); inList = false }
        continue
      }
    }

    // ── Body text / list-item continuation ────────────────────────────────────
    buffer.push(line.isBold ? `**${trimmed}**` : trimmed)
    if (line.breakAfter) {
      flushBuffer(false)
      inList = false
    }
  }

  flushBuffer()

  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
}

async function pdfToMarkdown(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise

  if (pdf.numPages > MAX_PDF_PAGES) {
    throw new Error(`This PDF has ${pdf.numPages} pages. Limit is ${MAX_PDF_PAGES}.`)
  }

  const pages: ExtractedLine[][] = []
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
    importStatus.value = `Reading page ${pageNo}/${pdf.numPages}...`
    const page = await pdf.getPage(pageNo)
    const textContent = await page.getTextContent({
      disableCombineTextItems: true,
    })
    pages.push(extractLinesFromPdfTextContent(textContent))
  }

  const allLines = pages.flat()
  if (allLines.length === 0) {
    throw new Error('No selectable text was found. This PDF may be scanned; OCR is not enabled yet.')
  }

  const bodyFontCandidates = allLines
    .filter((line) => line.text.length >= 20 && !line.hasTabs)
    .map((line) => line.fontSize)
  const fallbackFontCandidates = allLines.map((line) => line.fontSize)
  const bodyFontSize = getMedian(bodyFontCandidates.length > 0 ? bodyFontCandidates : fallbackFontCandidates) || 12

  const perPageMarkdown = pages.map((pageLines) => linesToMarkdown(pageLines, bodyFontSize)).filter(Boolean)
  return perPageMarkdown.join('\n\n---\n\n').trim()
}

async function importPdf(file: File) {
  importError.value = ''
  importStatus.value = ''

  if (!isPdfFile(file)) {
    importError.value = 'Only PDF files are supported.'
    return
  }

  if (file.size > MAX_PDF_BYTES) {
    importError.value = `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limit is 10 MB.`
    return
  }

  isImportingPdf.value = true
  try {
    importStatus.value = 'Loading PDF parser...'
    const markdown = await pdfToMarkdown(file)
    mdInput.value = markdown
    importStatus.value = `Imported ${file.name}`
  } catch (err) {
    console.error('PDF import failed:', err)
    importError.value = err instanceof Error ? err.message : 'PDF import failed.'
    importStatus.value = ''
  } finally {
    isImportingPdf.value = false
  }
}

function onDragEnterPdf(e: DragEvent) {
  if (!e.dataTransfer) return
  if (!Array.from(e.dataTransfer.types).includes('Files')) return
  dragDepth.value += 1
}

function onDragOverPdf(e: DragEvent) {
  if (!e.dataTransfer) return
  e.preventDefault()
  e.dataTransfer.dropEffect = 'copy'
}

function onDragLeavePdf() {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

async function onDropPdf(e: DragEvent) {
  e.preventDefault()
  dragDepth.value = 0

  const file = pickPdfFile(e.dataTransfer?.files || null)
  if (!file) {
    importError.value = 'Drop a PDF file to import.'
    return
  }

  await importPdf(file)
}

function onBeforeInput(e: InputEvent) {
  const allowed = ['insertFromPaste', 'insertFromDrop']
  // Block typing/formatting in the preview; allow paste/drop only
  if (!allowed.includes((e as any).inputType)) {
    e.preventDefault()
  }
}

async function copyFormatted() {
  const html = renderedHtml.value
  const text = mdInput.value

  // Highlight content visually by selecting it (optional UX)
  if (previewRef.value) {
    const range = document.createRange()
    range.selectNodeContents(previewRef.value)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  try {
    if (navigator.clipboard && (window as any).ClipboardItem) {
      const data = new (window as any).ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })
      await navigator.clipboard.write([data])
    } else {
      // Fallback: execCommand copy of selection (may lose rich formatting in some browsers)
      document.execCommand('copy')
    }
  } catch (e) {
    // Fallback to plain text if rich copy fails
    await navigator.clipboard.writeText(text)
  }
}

// Build template-specific CSS for the LaTeX-styled render
function getLatexTemplateCss(template: LatexTemplate): string {
  const base = `
    *, *::before, *::after { box-sizing: border-box; }
    body {
      font-family: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.55;
      color: #000;
      background: #fff;
    }
    .page-wrap {
      max-width: 170mm;
      margin: 0 auto;
      padding: 20mm 0;
    }
    .doc-title {
      font-size: 1.9em;
      font-weight: bold;
      text-align: center;
      margin-bottom: 0.15em;
      margin-top: 0;
    }
    .doc-date {
      text-align: center;
      color: #555;
      font-size: 0.85em;
      margin-bottom: 2.5em;
    }
    h1 { font-size: 1.5em; font-weight: bold; margin-top: 2em; margin-bottom: 0.4em; }
    h2 { font-size: 1.25em; font-weight: bold; margin-top: 1.5em; margin-bottom: 0.35em; }
    h3 { font-size: 1.1em; font-weight: bold; margin-top: 1.2em; margin-bottom: 0.3em; }
    h4, h5, h6 { font-size: 1em; font-weight: bold; margin-top: 1em; margin-bottom: 0.25em; }
    p { margin: 0.6em 0; }
    ul, ol { margin: 0.6em 0 0.6em 2.5em; }
    li { margin: 0.2em 0; line-height: 1.5; }
    code {
      font-family: "Courier New", "Lucida Console", monospace;
      font-size: 0.82em;
      background: #f4f4f4;
      padding: 0.1em 0.3em;
      border-radius: 2px;
    }
    pre {
      font-family: "Courier New", "Lucida Console", monospace;
      font-size: 0.82em;
      background: #f4f4f4;
      border: 1px solid #ddd;
      border-left: 3px solid #999;
      padding: 0.8em 1em;
      border-radius: 2px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code { background: none; padding: 0; font-size: 1em; }
    blockquote {
      margin: 0.8em 0;
      padding: 0.1em 0 0.1em 1em;
      border-left: 3px solid #aaa;
      font-style: italic;
      color: #444;
    }
    hr { border: none; border-top: 1px solid #bbb; margin: 1.5em 0; }
    a { color: #000066; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th { border-bottom: 2px solid #000; padding: 0.3em 0.6em; text-align: left; font-weight: bold; }
    td { border-bottom: 1px solid #ccc; padding: 0.3em 0.6em; }
    strong { font-weight: bold; }
    em { font-style: italic; }
    del { text-decoration: line-through; color: #999; }
    img { max-width: 100%; }
    pre.mermaid { background: none !important; border: none !important; padding: 0 !important; margin: 1em 0; }
    pre.mermaid svg { max-width: 100%; height: auto; display: block; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      pre { page-break-inside: avoid; }
      pre.mermaid { background: none !important; border: none !important; }
      h1, h2, h3, h4 { page-break-after: avoid; }
    }
  `
  const overrides: Record<string, string> = {
    article: `
      h2 { border-bottom: 0.5pt solid #ccc; padding-bottom: 0.15em; }
      @media print { @page { size: A4; margin: 25mm; } }
    `,
    report: `
      .doc-title { font-size: 2.2em; font-weight: 700; }
      h1 { font-size: 1.6em; border-bottom: 1pt solid #333; padding-bottom: 0.15em; }
      h2 { font-size: 1.35em; border-bottom: 0.5pt solid #aaa; padding-bottom: 0.15em; }
      .page-wrap { max-width: 160mm; }
      @media print { @page { size: A4; margin: 28mm; } }
    `,
    book: `
      body { font-size: 12pt; }
      .doc-title { font-size: 2.4em; font-weight: bold; text-align: left; border-bottom: 2pt solid #000; padding-bottom: 0.2em; }
      h1 { font-size: 2em; border-bottom: 1.5pt solid #000; padding-bottom: 0.2em; margin-top: 3em; }
      h2 { font-size: 1.5em; margin-top: 2.5em; }
      .page-wrap { max-width: 155mm; }
      @media print { @page { size: A4; margin: 25mm 20mm 30mm 30mm; } }
    `,
  }
  return base + (overrides[template.id] ?? '')
}

// Build a complete HTML document for LaTeX-styled print/preview
function getLatexRenderedDocument(html: string, title: string): string {
  const css = getLatexTemplateCss(selectedLatexTemplate.value)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="page-wrap">
    <div class="doc-content">${html}</div>
  </div>
</body>
</html>`
}

function openLatexPreview() {
  const title = extractTitle(mdInput.value) || 'Document'
  const latexSrc = markdownToLatex(mdInput.value)
  generatedLatex.value = formatLatexTemplate(selectedLatexTemplate.value, title, latexSrc)
  latexPreviewHtmlDoc.value = getLatexRenderedDocument(renderedHtml.value, title)
  showLatexPreview.value = true
}

function downloadLatex() {
  const latexContent = markdownToLatex(mdInput.value)
  const formattedLatex = formatLatexTemplate(
    selectedLatexTemplate.value,
    extractTitle(mdInput.value) || 'Document',
    latexContent
  )
  
  const element = document.createElement('a')
  element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(formattedLatex)}`)
  element.setAttribute('download', 'document.tex')
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

function copyLatex() {
  const latexContent = markdownToLatex(mdInput.value)
  const formattedLatex = formatLatexTemplate(
    selectedLatexTemplate.value,
    extractTitle(mdInput.value) || 'Document',
    latexContent
  )
  navigator.clipboard.writeText(formattedLatex)
}

function extractTitle(markdown: string): string {
  const match = markdown.match(/^#\s+(.+?)$/m)
  return match ? match[1].trim() : ''
}

function getSafeDocumentFileStem(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'document'
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function onTemplateSelect(template: LatexTemplate) {
  selectedLatexTemplate.value = template
  // Save selected template preference
  try {
    localStorage.setItem('selectedLatexTemplate', template.id)
  } catch (_) {}
}

function onCustomTemplateAdd(template: LatexTemplate) {
  templates.value.push(template)
  selectedLatexTemplate.value = template
  
  // Save custom templates to localStorage
  const customTemplates = templates.value.filter(t => t.isCustom)
  try {
    localStorage.setItem('customLatexTemplates', JSON.stringify(customTemplates))
  } catch (_) {}
}

function onCustomTemplateUpdate(template: LatexTemplate) {
  // Find and update the template
  const templateIndex = templates.value.findIndex(t => t.id === template.id)
  if (templateIndex !== -1) {
    templates.value[templateIndex] = template
    
    // If the updated template was selected, update the selection
    if (selectedLatexTemplate.value?.id === template.id) {
      selectedLatexTemplate.value = template
    }
    
    // Save custom templates to localStorage
    const customTemplates = templates.value.filter(t => t.isCustom)
    try {
      localStorage.setItem('customLatexTemplates', JSON.stringify(customTemplates))
    } catch (_) {}
  }
}

function onCustomTemplateDelete(templateId: string) {
  // Find and remove the template
  const templateToDelete = templates.value.find(t => t.id === templateId)
  if (templateToDelete?.isCustom) {
    templates.value = templates.value.filter(t => t.id !== templateId)
    
    // If the deleted template was selected, select default
    if (selectedLatexTemplate.value?.id === templateId) {
      selectedLatexTemplate.value = getDefaultTemplate()
    }
    
    // Save custom templates to localStorage
    const customTemplates = templates.value.filter(t => t.isCustom)
    try {
      localStorage.setItem('customLatexTemplates', JSON.stringify(customTemplates))
    } catch (_) {}
  }
}

async function copyMarkdown() {
  await navigator.clipboard.writeText(mdInput.value)
}

function getCurrentRenderedDocument() {
  const title = extractTitle(mdInput.value) || 'Document'
  const liveHtml = previewRef.value ? previewRef.value.innerHTML : renderedHtml.value
  const documentHtml = renderMode.value === 'html'
    ? getHtmlRenderedDocument(liveHtml, title)
    : getLatexRenderedDocument(liveHtml, title)

  return { title, documentHtml }
}

async function downloadCurrentModeDocx() {
  exportError.value = ''

  try {
    const { title, documentHtml } = getCurrentRenderedDocument()
    const fileName = `${getSafeDocumentFileStem(title)}-${renderMode.value}`
    await downloadDocxDocument({ htmlDocument: documentHtml, fileName })
  } catch (error) {
    exportError.value = error instanceof Error ? error.message : 'DOCX export failed.'
  }
}

// Build a clean HTML document for HTML-mode printing
function getHtmlRenderedDocument(html: string, title: string): string {
  const safeTitle = escapeHtml(title)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4; margin: 20mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #111;
      background: #fff;
      padding: 0;
    }
    h1 { font-size: 2em; font-weight: 700; margin-top: 0.8em; margin-bottom: 0.4em; }
    h2 { font-size: 1.5em; font-weight: 600; margin-top: 1em; margin-bottom: 0.3em; border-bottom: 1px solid #ddd; padding-bottom: 0.2em; }
    h3 { font-size: 1.25em; font-weight: 600; margin-top: 0.9em; margin-bottom: 0.2em; }
    h4 { font-size: 1.1em; font-weight: 600; margin-top: 0.8em; margin-bottom: 0.2em; }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    p { margin: 0.5em 0; }
    ul, ol { margin: 0.5em 0 0.5em 2em; }
    li { margin: 0.15em 0; }
    blockquote { margin: 0.7em 0; padding: 0.1em 0 0.1em 1em; border-left: 3px solid #bbb; color: #555; font-style: italic; }
    code { font-family: "Courier New", monospace; font-size: 0.85em; background: #f3f3f3; padding: 0.1em 0.3em; border-radius: 3px; }
    pre { font-family: "Courier New", monospace; font-size: 0.85em; background: #f3f3f3; border: 1px solid #ddd; padding: 0.8em 1em; border-radius: 3px; overflow-x: auto; margin: 0.7em 0; }
    pre code { background: none; padding: 0; }
    pre.mermaid { background: none; border: none; padding: 0.5em 0; text-align: center; }
    pre.mermaid svg { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid #ccc; margin: 1em 0; }
    a { color: #0066cc; }
    table { border-collapse: collapse; width: 100%; margin: 0.7em 0; }
    th { border-bottom: 2px solid #999; padding: 0.3em 0.6em; text-align: left; font-weight: 600; }
    td { border-bottom: 1px solid #ddd; padding: 0.3em 0.6em; }
    h1, h2, h3 { page-break-after: avoid; }
    pre, blockquote, table { page-break-inside: avoid; }
  </style>
</head>
<body>${html}</body>
</html>`
}

// Unified print: both modes open a clean new window with only the content.
function printCurrentMode() {
  const { documentHtml } = getCurrentRenderedDocument()
  const win = window.open('', '_blank', 'width=1400,height=1150')
  if (!win) return
  win.document.write(documentHtml)
  win.document.close()
  win.addEventListener('load', () => {
    setTimeout(() => { win.print(); win.close() }, 250)
  })
  setTimeout(() => {
    if (!win.closed) { win.print(); win.close() }
  }, 800)
}

// Theme switching (auto | light | dark)
type ThemeMode = 'auto' | 'light' | 'dark'
const THEME_STORAGE_KEY = 'theme'
const themeMode = ref<ThemeMode>(((localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode) || 'auto'))

let mql: MediaQueryList | null = null
let mqlHandler: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null = null

function applyTheme(mode: ThemeMode) {
  // Also call the global helper from index.html if present to keep in sync
  if (typeof (window as any).__setTheme === 'function') {
    ;(window as any).__setTheme(mode)
    return
  }
  // Fallback: directly toggle class
  if (!mql) mql = window.matchMedia('(prefers-color-scheme: dark)')
  if (mode === 'dark') document.documentElement.classList.add('dark')
  else if (mode === 'light') document.documentElement.classList.remove('dark')
  else document.documentElement.classList.toggle('dark', !!mql.matches)
}

function setTheme(mode: ThemeMode) {
  themeMode.value = mode
}

watch(themeMode, (mode) => {
  try {
    if (mode === 'auto') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch (_) {}
  applyTheme(mode)
})

watch(renderMode, () => {
  previewActionsMenuOpen.value = false
})

function togglePreviewActionsMenu() {
  previewActionsMenuOpen.value = !previewActionsMenuOpen.value
}

function closePreviewActionsMenu() {
  previewActionsMenuOpen.value = false
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!previewActionsMenuRef.value) return
  if (previewActionsMenuRef.value.contains(event.target as Node)) return
  closePreviewActionsMenu()
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closePreviewActionsMenu()
  }
}

onMounted(() => {
  mql = window.matchMedia('(prefers-color-scheme: dark)')
  mqlHandler = () => {
    if (themeMode.value === 'auto') applyTheme('auto')
  }
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', mqlHandler)
  else if (typeof (mql as any).addListener === 'function') (mql as any).addListener(mqlHandler)
  // Ensure applied on mount
  applyTheme(themeMode.value)
  // Initialize mermaid and render any diagrams in the initial content
  initMermaid()
  nextTick().then(() => runMermaid())
  
  // Load custom LaTeX templates from localStorage
  try {
    const saved = localStorage.getItem('customLatexTemplates')
    if (saved) {
      const customTemplates = JSON.parse(saved) as LatexTemplate[]
      templates.value = [...DEFAULT_LATEX_TEMPLATES, ...customTemplates]
    }
    
    // Restore selected template preference
    const selectedId = localStorage.getItem('selectedLatexTemplate')
    if (selectedId) {
      const found = templates.value.find(t => t.id === selectedId)
    if (found) {
      selectedLatexTemplate.value = found
    }
  }
  } catch (_) {}

  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
})

onBeforeUnmount(() => {
  if (mql && mqlHandler) {
    if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', mqlHandler)
    else if (typeof (mql as any).removeListener === 'function') (mql as any).removeListener(mqlHandler)
  }
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
})
</script>

<template>
  <div
    class="relative min-h-screen w-full bg-background bg-app-gradient"
    @dragenter="onDragEnterPdf"
    @dragover.prevent="onDragOverPdf"
    @dragleave="onDragLeavePdf"
    @drop="onDropPdf"
  >
    <header class="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div class="container flex h-14 items-center justify-between">
        <div class="flex items-center gap-2">
          <img src="/md-editor.svg" alt="MD Editor" class="h-6 w-6" aria-hidden="true" />
          <span class="font-semibold tracking-tight">MD Editor</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="hidden text-xs text-muted-foreground sm:inline">Theme</span>
          <div class="inline-flex rounded-md border bg-background p-0.5">
            <button
              type="button"
              class="px-2.5 py-1 text-xs rounded-md transition-colors"
              :class="themeMode === 'auto' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              @click="setTheme('auto')"
              :aria-pressed="themeMode === 'auto'"
            >Auto</button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs rounded-md transition-colors"
              :class="themeMode === 'light' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              @click="setTheme('light')"
              :aria-pressed="themeMode === 'light'"
            >Light</button>
            <button
              type="button"
              class="px-2.5 py-1 text-xs rounded-md transition-colors"
              :class="themeMode === 'dark' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
              @click="setTheme('dark')"
              :aria-pressed="themeMode === 'dark'"
            >Dark</button>
          </div>
        </div>
      </div>
    </header>

    <main class="container py-6">
      <div v-if="importStatus || importError || exportError" class="mb-4 rounded-md border bg-card p-3 text-sm">
        <p v-if="importStatus" class="text-muted-foreground">{{ importStatus }}</p>
        <p v-if="importError" class="text-destructive">{{ importError }}</p>
        <p v-if="exportError" class="text-destructive">{{ exportError }}</p>
      </div>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <!-- Left: Markdown input -->
          <section class="flex flex-col rounded-lg border bg-card shadow-sm">
            <div class="flex items-center justify-between border-b p-3 md:p-4">
              <h2 class="text-sm font-medium tracking-tight">Markdown</h2>
              <div class="flex items-center gap-2">
                <span class="text-xs text-muted-foreground">Editable</span>
                <Button size="sm" variant="secondary" @click="copyMarkdown">Copy Markdown</Button>
              </div>
            </div>
            <div class="p-3 md:p-4">
              <textarea
                v-model="mdInput"
                class="min-h-[65vh] w-full resize-vertical rounded-md border bg-background p-3 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                spellcheck="false"
                placeholder="Type your Markdown here..."
              />
            </div>
          </section>

          <!-- Right: Preview -->
          <section class="flex flex-col rounded-lg border bg-card shadow-sm">
          <!-- Header row: title, mode selector, action buttons -->
          <div class="flex flex-wrap items-center gap-2 border-b p-3 md:p-4">
            <h2 class="text-sm font-medium tracking-tight">Preview</h2>
            <!-- Mode toggle -->
            <div class="inline-flex rounded-md border bg-background p-0.5">
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md transition-colors"
                :class="renderMode === 'html'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                :aria-pressed="renderMode === 'html'"
                @click="renderMode = 'html'"
              >HTML</button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md transition-colors"
                :class="renderMode === 'latex'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
                :aria-pressed="renderMode === 'latex'"
                @click="renderMode = 'latex'"
              >LaTeX</button>
            </div>
            <!-- Template name pill (only in LaTeX mode) -->
            <button
              v-if="renderMode === 'latex'"
              type="button"
              class="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              title="Change template"
              @click="showTemplateDialog = true"
            >
              <span>{{ selectedLatexTemplate.name }}</span>
              <span class="opacity-60">▾</span>
            </button>
            <div class="flex-1" />
            <span class="hidden text-xs text-muted-foreground sm:inline">Drop PDF to import</span>
            <div ref="previewActionsMenuRef" class="relative">
              <Button
                size="sm"
                variant="secondary"
                :aria-expanded="previewActionsMenuOpen"
                aria-haspopup="menu"
                @click="togglePreviewActionsMenu"
              >
                <span class="text-base leading-none" aria-hidden="true">☰</span>
                <span class="sr-only">Open preview actions</span>
              </Button>
              <div
                v-if="previewActionsMenuOpen"
                class="absolute right-0 top-full z-20 mt-2 min-w-44 rounded-md border bg-popover p-1 shadow-md"
                role="menu"
                aria-label="Preview actions"
              >
                <button
                  type="button"
                  class="flex w-full rounded-sm px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  role="menuitem"
                  @click="closePreviewActionsMenu(); printCurrentMode()"
                >
                  Print
                </button>
                <button
                  type="button"
                  class="flex w-full rounded-sm px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  role="menuitem"
                  @click="closePreviewActionsMenu(); downloadCurrentModeDocx()"
                >
                  Download .docx
                </button>
                <button
                  type="button"
                  class="flex w-full rounded-sm px-3 py-2 text-left text-sm text-popover-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  role="menuitem"
                  @click="closePreviewActionsMenu(); copyFormatted()"
                >
                  Copy formatted
                </button>
              </div>
            </div>
          </div>

          <!-- LaTeX action bar (only in LaTeX mode) -->
          <div v-if="renderMode === 'latex'" class="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5">
            <span class="text-xs text-muted-foreground">LaTeX export:</span>
            <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" @click="openLatexPreview">Preview / Source</Button>
            <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" @click="downloadLatex">Download .tex</Button>
            <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" @click="copyLatex">Copy .tex</Button>
            <div class="flex-1" />
            <Button size="sm" variant="ghost" class="h-6 px-2 text-xs" @click="showTemplateDialog = true">Manage templates</Button>
          </div>

          <div class="p-3 md:p-4">
            <div
              ref="previewRef"
              :class="[
                'max-w-none leading-relaxed outline-none',
                renderMode === 'html' ? 'print-content prose' : 'latex-preview'
              ]"
              v-html="renderedHtml"
              :contenteditable="true"
              tabindex="0"
              role="textbox"
              aria-label="Markdown preview. Paste rich text here to convert to Markdown."
              @paste.prevent="onPastePreview"
              @beforeinput="onBeforeInput"
              @drop.prevent
            />
          </div>
        </section>
      </div>
    </main>
    <div
      v-if="isDraggingPdf || isImportingPdf"
      class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-background/70 backdrop-blur-sm"
    >
      <div class="rounded-lg border bg-card px-5 py-4 text-center shadow-lg">
        <p class="text-sm font-medium">{{ isImportingPdf ? 'Importing PDF...' : 'Drop PDF to import' }}</p>
        <p class="mt-1 text-xs text-muted-foreground">Up to 10 MB and 100 pages</p>
      </div>
    </div>

    <!-- LaTeX Template Dialog -->
    <LatexTemplateDialog
      :is-open="showTemplateDialog"
      :templates="templates"
      :selected-template="selectedLatexTemplate"
      @template-select="onTemplateSelect"
      @custom-template-add="onCustomTemplateAdd"
      @custom-template-update="onCustomTemplateUpdate"
      @custom-template-delete="onCustomTemplateDelete"
      @close="showTemplateDialog = false"
    />

    <!-- LaTeX Preview Dialog -->
    <LatexPreviewDialog
      :is-open="showLatexPreview"
      :latex-content="generatedLatex"
      :preview-html-doc="latexPreviewHtmlDoc"
      @close="showLatexPreview = false"
    />
  </div>
  <!-- eslint-disable-next-line vue/no-v-html -->
</template>

<style scoped>
/* ─── HTML mode prose styles ────────────────────────────────────── */
.prose :deep(h1) { @apply scroll-m-20 text-3xl font-bold tracking-tight; }
.prose :deep(h2) { @apply scroll-m-20 border-b pb-2 text-xl font-semibold tracking-tight first:mt-0; }
.prose :deep(h3) { @apply scroll-m-20 text-lg font-semibold tracking-tight; }
.prose :deep(h1) { margin-top: 1.2em; }
.prose :deep(h2) { margin-top: 1.1em; }
.prose :deep(h3) { margin-top: 1em; }
.prose :deep(h4) { margin-top: 0.9em; }
.prose :deep(h5) { margin-top: 0.8em; }
.prose :deep(h6) { margin-top: 0.7em; }
.prose :deep(:where(h1, h2, h3, h4, h5, h6):first-child) { margin-top: 0; }
.prose :deep(p) { @apply leading-7; }
.prose :deep(p + p) { @apply mt-4; }
.prose :deep(hr) { @apply my-8 border-border; }
.prose :deep(ul) { @apply my-4 ml-6 list-disc; }
.prose :deep(ol) { @apply my-4 ml-6 list-decimal; }
.prose :deep(blockquote) { @apply mt-6 border-l-2 pl-6 italic text-muted-foreground; }
.prose :deep(code) { @apply rounded bg-muted px-1 py-0.5; }
.prose :deep(pre) { @apply my-4 overflow-x-auto rounded bg-muted p-4; }
.prose :deep(a) { @apply text-primary underline underline-offset-4; }

/* ─── LaTeX mode preview styles ─────────────────────────────────── */
.latex-preview {
  font-family: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1a1a1a;
  background: #fff;
  padding: 1.8em 2em;
  border-radius: 3px;
}
/* Headings */
.latex-preview :deep(h1) {
  font-size: 1.7em; font-weight: bold;
  margin-top: 1.8em; margin-bottom: 0.4em;
}
.latex-preview :deep(h2) {
  font-size: 1.3em; font-weight: bold;
  border-bottom: 1px solid #ccc; padding-bottom: 0.15em;
  margin-top: 1.5em; margin-bottom: 0.35em;
}
.latex-preview :deep(h3) {
  font-size: 1.1em; font-weight: bold;
  margin-top: 1.2em; margin-bottom: 0.3em;
}
.latex-preview :deep(:where(h1, h2, h3, h4, h5, h6):first-child) { margin-top: 0; }
/* Body text */
.latex-preview :deep(p) { margin: 0.6em 0; line-height: 1.6; }
/* Lists */
.latex-preview :deep(ul) { margin: 0.6em 0 0.6em 2.2em; list-style: disc; }
.latex-preview :deep(ol) { margin: 0.6em 0 0.6em 2.2em; list-style: decimal; }
.latex-preview :deep(li) { margin: 0.2em 0; line-height: 1.5; }
/* Inline code / verbatim */
.latex-preview :deep(code) {
  font-family: "Courier New", "Lucida Console", monospace;
  font-size: 0.82em;
  background: #f4f4f4;
  padding: 0.1em 0.3em;
  border-radius: 2px;
}
/* Block code (listing) */
.latex-preview :deep(pre) {
  font-family: "Courier New", "Lucida Console", monospace;
  font-size: 0.82em;
  background: #f4f4f4;
  border: 1px solid #ddd;
  border-left: 3px solid #999;
  padding: 0.85em 1em;
  border-radius: 2px;
  overflow-x: auto;
  margin: 1em 0;
}
.latex-preview :deep(pre code) { background: none; padding: 0; font-size: 1em; }
/* Blockquote */
.latex-preview :deep(blockquote) {
  margin: 0.8em 0; padding: 0.1em 0 0.1em 1em;
  border-left: 3px solid #aaa; font-style: italic; color: #444;
}
/* Rule */
.latex-preview :deep(hr) { border: none; border-top: 1px solid #bbb; margin: 1.5em 0; }
/* Links */
.latex-preview :deep(a) { color: #000066; text-decoration: underline; }
/* Tables */
.latex-preview :deep(table) { border-collapse: collapse; width: 100%; margin: 1em 0; }
.latex-preview :deep(th) { border-bottom: 2px solid #000; padding: 0.3em 0.6em; text-align: left; font-weight: bold; }
.latex-preview :deep(td) { border-bottom: 1px solid #ccc; padding: 0.3em 0.6em; }

/* Mermaid diagram containers */
.prose :deep(pre.mermaid),
.latex-preview :deep(pre.mermaid) {
  background: transparent;
  border: none;
  padding: 0.5rem 0;
  text-align: center;
  overflow-x: auto;
}
.prose :deep(pre.mermaid svg),
.latex-preview :deep(pre.mermaid svg) {
  max-width: 100%;
  height: auto;
}
</style>
