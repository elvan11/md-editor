<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  isOpen: boolean
  latexContent: string
  previewHtmlDoc: string
  onClose: () => void
}

const props = defineProps<Props>()

const activeTab = ref<'rendered' | 'source'>('rendered')

function downloadLatex() {
  const element = document.createElement('a')
  element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(props.latexContent)}`)
  element.setAttribute('download', 'document.tex')
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

function copyLatex() {
  navigator.clipboard.writeText(props.latexContent)
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div class="bg-card rounded-lg border shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="border-b p-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">LaTeX Preview</h2>
        <button
          type="button"
          @click="onClose"
          class="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <span class="text-xl">&times;</span>
        </button>
      </div>

      <!-- Tabs -->
      <div class="border-b flex">
        <button
          type="button"
          @click="activeTab = 'rendered'"
          :class="[
            'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'rendered'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          ]"
        >
          Preview
        </button>
        <button
          type="button"
          @click="activeTab = 'source'"
          :class="[
            'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'source'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          ]"
        >
          LaTeX Source
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden flex flex-col p-4">
        <!-- Rendered Preview (iframe for accurate WYSIWYG) -->
        <iframe
          v-if="activeTab === 'rendered'"
          :srcdoc="previewHtmlDoc"
          class="w-full flex-1 rounded border bg-white"
          style="min-height: 60vh; height: 60vh;"
          sandbox="allow-same-origin"
        />

        <!-- Source Code -->
        <div v-if="activeTab === 'source'" class="bg-muted p-4 rounded border overflow-auto" style="min-height: 60vh; height: 60vh;">
          <pre class="font-mono text-sm text-foreground whitespace-pre-wrap break-words">{{ latexContent }}</pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t p-4 flex items-center justify-between">
        <div class="flex gap-2">
          <button
            type="button"
            @click="downloadLatex"
            class="px-4 py-2 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Download .tex
          </button>
          <button
            type="button"
            @click="copyLatex"
            class="px-4 py-2 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Copy LaTeX
          </button>
        </div>
        <button
          type="button"
          @click="onClose"
          class="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<!-- Styles live inside the iframe document via getLatexRenderedDocument CSS -->
