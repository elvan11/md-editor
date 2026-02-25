<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import Button from '@/components/ui/button/Button.vue'
import TurndownService from 'turndown'
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
// @ts-ignore - types may not be bundled
import { gfm } from 'turndown-plugin-gfm'

const MAX_PDF_BYTES = 10 * 1024 * 1024
const MAX_PDF_PAGES = 100

type PdfTextSegment = {
  text: string
  x: number
  width: number
  fontSize: number
}

type ExtractedLine = {
  text: string
  hasTabs: boolean
  fontSize: number
  breakAfter: boolean
}

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: true,
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
  return DOMPurify.sanitize(raw)
})

const previewRef = ref<HTMLDivElement | null>(null)
const isImportingPdf = ref(false)
const importStatus = ref('')
const importError = ref('')
const dragDepth = ref(0)
const isDraggingPdf = computed(() => dragDepth.value > 0)

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

function extractLinesFromPdfTextContent(textContent: any): ExtractedLine[] {
  const rowMap = new Map<number, PdfTextSegment[]>()

  for (const rawItem of textContent.items || []) {
    const text = String((rawItem as any).str || '').replace(/\s+/g, ' ').trim()
    if (!text) continue

    const transform = Array.isArray((rawItem as any).transform) ? (rawItem as any).transform : []
    const x = Number(transform[4] || 0)
    const y = Number(transform[5] || 0)
    const width = Number((rawItem as any).width || Math.max(4, text.length * 4))
    const fontSize = Math.abs(Number(transform[0] || transform[3] || (rawItem as any).height || 12))

    const yKey = quantizeY(y)
    const segments = rowMap.get(yKey) || []
    segments.push({ text, x, width, fontSize })
    rowMap.set(yKey, segments)
  }

  const rows = Array.from(rowMap.entries())
    .map(([y, segments]) => ({ y, segments: segments.sort((a, b) => a.x - b.x) }))
    .sort((a, b) => b.y - a.y)

  const lines: ExtractedLine[] = []
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]
    let text = ''
    let hasTabs = false
    let previousEnd = 0
    let previousCharWidth = 5

    row.segments.forEach((segment, segmentIndex) => {
      if (segmentIndex > 0) {
        const gap = segment.x - previousEnd
        const tabThreshold = Math.max(24, previousCharWidth * 6)
        const spaceThreshold = Math.max(6, previousCharWidth * 1.75)
        if (gap > tabThreshold) {
          text += '\t'
          hasTabs = true
        } else if (gap > spaceThreshold) {
          text += ' '
        }
      }
      text += segment.text
      previousEnd = segment.x + segment.width
      previousCharWidth = segment.width / Math.max(segment.text.length, 1)
    })

    const normalized = text.replace(/[ \t]+$/g, '').replace(/[ ]{2,}/g, ' ')
    if (!normalized) continue

    const avgFontSize = row.segments.reduce((sum, segment) => sum + segment.fontSize, 0) / row.segments.length
    const nextRow = rows[i + 1]
    const rowGap = nextRow ? Math.abs(row.y - nextRow.y) : 0
    const breakAfter = rowGap > avgFontSize * 1.7

    lines.push({
      text: normalized,
      hasTabs,
      fontSize: avgFontSize,
      breakAfter,
    })
  }

  return lines
}

function looksLikeHeading(text: string, fontSize: number, bodyFontSize: number): boolean {
  const plain = text.trim()
  if (!plain) return false
  if (plain.length > 90) return false
  if (/^[-*]\s+/.test(plain)) return false
  if (/^\d+[\.\)]\s+/.test(plain)) return false
  if (plain.includes('\t')) return false

  const ratio = fontSize / Math.max(bodyFontSize, 1)
  if (ratio < 1.28) return false

  const wordCount = plain.split(/\s+/).length
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

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
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

    const normalized = normalizeListPrefix(line.text.trim())
    if (!normalized) {
      out.push('')
      continue
    }

    if (looksLikeHeading(normalized, line.fontSize, bodyFontSize)) {
      const level = headingLevel(line.fontSize, bodyFontSize)
      out.push(`${'#'.repeat(level)} ${normalized}`)
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
      normalizeWhitespace: true,
      disableCombineTextItems: false,
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

onMounted(() => {
  mql = window.matchMedia('(prefers-color-scheme: dark)')
  mqlHandler = () => {
    if (themeMode.value === 'auto') applyTheme('auto')
  }
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', mqlHandler)
  else if (typeof (mql as any).addListener === 'function') (mql as any).addListener(mqlHandler)
  // Ensure applied on mount
  applyTheme(themeMode.value)
})

onBeforeUnmount(() => {
  if (mql && mqlHandler) {
    if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', mqlHandler)
    else if (typeof (mql as any).removeListener === 'function') (mql as any).removeListener(mqlHandler)
  }
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
      <div v-if="importStatus || importError" class="mb-4 rounded-md border bg-card p-3 text-sm">
        <p v-if="importStatus" class="text-muted-foreground">{{ importStatus }}</p>
        <p v-if="importError" class="text-destructive">{{ importError }}</p>
      </div>
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <!-- Left: Markdown input -->
          <section class="flex flex-col rounded-lg border bg-card shadow-sm">
            <div class="flex items-center justify-between border-b p-3 md:p-4">
              <h2 class="text-sm font-medium tracking-tight">Markdown</h2>
              <span class="text-xs text-muted-foreground">Editable</span>
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
          <div class="flex items-center justify-between gap-2 border-b p-3 md:p-4">
            <h2 class="text-sm font-medium tracking-tight">Preview</h2>
            <div class="flex items-center gap-2">
              <span class="hidden text-xs text-muted-foreground sm:inline">Drop PDF anywhere to import</span>
              <Button size="sm" variant="secondary" @click="copyFormatted">Copy formatted</Button>
            </div>
          </div>
          <div class="p-3 md:p-4">
            <div
              ref="previewRef"
              class="print-content prose max-w-none leading-relaxed outline-none"
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
  </div>
  <!-- eslint-disable-next-line vue/no-v-html -->
</template>

<style scoped>
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
</style>
