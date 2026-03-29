<script setup lang="ts">
import { ref, computed } from 'vue'
import type { LatexTemplate } from '@/lib/latex-templates'

interface Props {
  isOpen: boolean
  templates: LatexTemplate[]
  selectedTemplate: LatexTemplate | null
  onTemplateSelect: (template: LatexTemplate) => void
  onCustomTemplateAdd: (template: LatexTemplate) => void
  onCustomTemplateUpdate: (template: LatexTemplate) => void
  onCustomTemplateDelete: (templateId: string) => void
  onClose: () => void
}

const props = defineProps<Props>()

const activeTab = ref<'templates' | 'custom'>('templates')
const customName = ref('')
const customContent = ref('')
const customDescription = ref('')
const error = ref('')
const deleteConfirmId = ref<string | null>(null)
const editingTemplateId = ref<string | null>(null)

function addCustomTemplate() {
  error.value = ''
  
  if (!customName.value.trim()) {
    error.value = 'Template name is required'
    return
  }
  
  if (!customContent.value.trim()) {
    error.value = 'Template content is required'
    return
  }
  
  if (!customContent.value.includes('{CONTENT}')) {
    error.value = 'Template must include {CONTENT} placeholder'
    return
  }
  
  if (editingTemplateId.value) {
    // Update existing template
    const updatedTemplate: LatexTemplate = {
      id: editingTemplateId.value,
      name: customName.value,
      description: customDescription.value || 'Custom template',
      isCustom: true,
      content: customContent.value,
    }
    props.onCustomTemplateUpdate(updatedTemplate)
  } else {
    // Add new template
    const newTemplate: LatexTemplate = {
      id: `custom-${Date.now()}`,
      name: customName.value,
      description: customDescription.value || 'Custom template',
      isCustom: true,
      content: customContent.value,
    }
    props.onCustomTemplateAdd(newTemplate)
  }
  
  resetForm()
  activeTab.value = 'templates'
}

function resetForm() {
  customName.value = ''
  customContent.value = ''
  customDescription.value = ''
  error.value = ''
  editingTemplateId.value = null
}

const predefinedTemplates = computed(() =>
  props.templates.filter(t => !t.isCustom)
)

const customTemplates = computed(() =>
  props.templates.filter(t => t.isCustom)
)

function editTemplate(template: LatexTemplate, isCopy?: boolean) {
  if (!isCopy) {
    editingTemplateId.value = template.id
    customName.value = template.name
  } else {
    editingTemplateId.value = null
    customName.value = `${template.name} (Copy)`
  }
  customDescription.value = template.description
  customContent.value = template.content
  error.value = ''
  activeTab.value = 'custom'
}

function confirmDeleteTemplate(templateId: string) {
  deleteConfirmId.value = templateId
}

function deleteTemplate() {
  if (deleteConfirmId.value) {
    props.onCustomTemplateDelete(deleteConfirmId.value)
    deleteConfirmId.value = null
  }
}

function cancelDelete() {
  deleteConfirmId.value = null
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
    <div class="bg-card rounded-lg border shadow-lg w-full max-w-2xl max-h-[85vh] flex flex-col">
      <!-- Header -->
      <div class="border-b p-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold">LaTeX Templates</h2>
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
          @click="activeTab = 'templates'"
          :class="[
            'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'templates'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          ]"
        >
          Predefined & Custom
        </button>
        <button
          type="button"
          @click="activeTab = 'custom'"
          :class="[
            'flex-1 px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'custom'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          ]"
        >
          {{ editingTemplateId ? 'Edit Custom Template' : 'Add Custom Template' }}
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-hidden flex flex-col p-4">
        <!-- Templates Tab -->
        <div v-if="activeTab === 'templates'" class="space-y-4 overflow-y-auto flex-1 pr-4">
          <!-- Predefined Templates -->
          <div v-if="predefinedTemplates.length > 0">
            <h3 class="text-sm font-semibold mb-3 text-muted-foreground">Predefined</h3>
            <div class="space-y-2">
              <div
                v-for="template in predefinedTemplates"
                :key="template.id"
                class="relative group"
              >
                <button
                  @click="onTemplateSelect(template)"
                  :class="[
                    'w-full text-left p-3 rounded-md border transition-colors',
                    selectedTemplate?.id === template.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  ]"
                >
                  <div class="font-medium text-sm">{{ template.name }}</div>
                  <div class="text-xs text-muted-foreground mt-1">{{ template.description }}</div>
                </button>
                <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click.stop="editTemplate(template, true)"
                    class="p-1.5 text-xs rounded-md text-primary hover:bg-primary/10 transition-colors"
                    title="Copy to custom template"
                  >
                    ✏️
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Custom Templates -->
          <div v-if="customTemplates.length > 0" class="pt-4 border-t">
            <h3 class="text-sm font-semibold mb-3 text-muted-foreground">Custom</h3>
            <div class="space-y-2">
              <div
                v-for="template in customTemplates"
                :key="template.id"
                class="relative group"
              >
                <button
                  @click="onTemplateSelect(template)"
                  :class="[
                    'w-full text-left p-3 rounded-md border transition-colors',
                    selectedTemplate?.id === template.id
                      ? 'bg-primary/10 border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  ]"
                >
                  <div class="font-medium text-sm">{{ template.name }}</div>
                  <div class="text-xs text-muted-foreground mt-1">{{ template.description }}</div>
                </button>
                <div class="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    @click.stop="editTemplate(template)"
                    class="p-1.5 text-xs rounded-md text-primary hover:bg-primary/10 transition-colors"
                    title="Edit this template"
                  >
                    ✏️
                  </button>
                  <button
                    @click.stop="confirmDeleteTemplate(template.id)"
                    class="p-1.5 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                    title="Delete this template"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div v-if="selectedTemplate" class="pt-4 border-t">
            <h3 class="text-sm font-semibold mb-2">Full Template Content</h3>
            <pre class="bg-muted p-4 rounded text-xs overflow-auto max-h-[50vh] text-muted-foreground whitespace-pre-wrap break-words border">{{ selectedTemplate.content }}</pre>
          </div>
        </div>

        <!-- Custom Tab -->
        <div v-if="activeTab === 'custom'" class="space-y-4 overflow-y-auto flex-1 pr-4">
          <div>
            <label class="block text-sm font-medium mb-1">Template Name</label>
            <input
              v-model="customName"
              type="text"
              placeholder="e.g., My Custom Template"
              class="w-full px-3 py-2 rounded-md border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">Description (optional)</label>
            <input
              v-model="customDescription"
              type="text"
              placeholder="Brief description of your template"
              class="w-full px-3 py-2 rounded-md border bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">LaTeX Template</label>
            <p class="text-xs text-muted-foreground mb-2">
              Use <code class="bg-muted px-1 rounded">{TITLE}</code> for document title and
              <code class="bg-muted px-1 rounded">{CONTENT}</code> for markdown content placeholder
            </p>
            <textarea
              v-model="customContent"
              placeholder="Paste your LaTeX template here..."
              class="w-full h-96 px-3 py-2 rounded-md border bg-background font-mono text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          <div v-if="error" class="p-2 rounded bg-destructive/10 border border-destructive text-sm text-destructive">
            {{ error }}
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t p-4 flex items-center justify-between">
        <button
          v-if="activeTab === 'custom'"
          type="button"
          @click="resetForm"
          class="px-4 py-2 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          Clear
        </button>

        <div class="flex gap-2 ml-auto">
          <button
            type="button"
            @click="onClose"
            class="px-4 py-2 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Close
          </button>
          <button
            v-if="activeTab === 'custom'"
            type="button"
            @click="addCustomTemplate"
            class="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {{ editingTemplateId ? 'Update Template' : 'Add Template' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Dialog -->
    <div v-if="deleteConfirmId" class="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center">
      <div class="bg-card rounded-lg border shadow-lg w-full max-w-sm p-6">
        <h3 class="text-lg font-semibold mb-2">Delete Template?</h3>
        <p class="text-sm text-muted-foreground mb-6">This action cannot be undone. The template will be permanently deleted.</p>
        <div class="flex gap-3 justify-end">
          <button
            @click="cancelDelete"
            class="px-4 py-2 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            @click="deleteTemplate"
            class="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
code {
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
}
</style>
