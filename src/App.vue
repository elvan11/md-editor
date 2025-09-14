<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import Button from '@/components/ui/button/Button.vue'
import TurndownService from 'turndown'
// @ts-ignore - types may not be bundled
import { gfm } from 'turndown-plugin-gfm'

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

onMounted(() => {
  // Prefer light mode desktop-first; keep class hooks available for dark if desired
  document.documentElement.classList.remove('dark')
})
</script>

<template>
  <div class="min-h-screen w-full bg-background">
    <header class="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div class="container flex h-14 items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="h-6 w-6 rounded bg-primary/90" aria-hidden="true" />
          <span class="font-semibold tracking-tight">MD Editor</span>
        </div>
        <div class="text-xs text-muted-foreground">Vue 3 • Tailwind • shadcn</div>
      </div>
    </header>

    <main class="container py-6">
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
            <Button size="sm" variant="secondary" @click="copyFormatted">Copy formatted</Button>
          </div>
          <div class="p-3 md:p-4">
            <div
              ref="previewRef"
              class="prose max-w-none leading-relaxed outline-none"
              v-html="renderedHtml"
              :contenteditable="true"
              tabindex="0"
              role="textbox"
              aria-label="Markdown preview. Paste rich text here to convert to Markdown."
              @paste.prevent="onPastePreview"
              @beforeinput="onBeforeInput"
            />
          </div>
        </section>
      </div>
    </main>
  </div>
  <!-- eslint-disable-next-line vue/no-v-html -->
</template>

<style scoped>
.prose :deep(h1) { @apply scroll-m-20 text-4xl font-bold tracking-tight; }
.prose :deep(h2) { @apply scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0; }
.prose :deep(h3) { @apply scroll-m-20 text-xl font-semibold tracking-tight; }
.prose :deep(p) { @apply leading-7; }
.prose :deep(ul) { @apply my-4 ml-6 list-disc; }
.prose :deep(ol) { @apply my-4 ml-6 list-decimal; }
.prose :deep(blockquote) { @apply mt-6 border-l-2 pl-6 italic text-muted-foreground; }
.prose :deep(code) { @apply rounded bg-muted px-1 py-0.5; }
.prose :deep(pre) { @apply my-4 overflow-x-auto rounded bg-muted p-4; }
.prose :deep(a) { @apply text-primary underline underline-offset-4; }
</style>
