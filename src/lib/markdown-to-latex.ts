/**
 * Convert Markdown to LaTeX
 */

export function markdownToLatex(markdown: string): string {
  let latex = markdown
    // Headers (must be before other replacements)
    .replace(/^### (.*?)$/gm, '\\subsubsection*{$1}')
    .replace(/^## (.*?)$/gm, '\\section*{$1}')
    .replace(/^# (.*?)$/gm, '\\chapter*{$1}')
    
    // Emphasis and strong
    .replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}')
    .replace(/__(.*?)__/g, '\\textbf{$1}')
    .replace(/\*(.*?)\*/g, '\\textit{$1}')
    .replace(/_(.*?)_/g, '\\textit{$1}')
    .replace(/~~(.*?)~~/g, '\\sout{$1}')
    
    // Code blocks (before inline code)
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_match, lang, code) => {
      const language = lang ? `[language=${lang}]` : ''
      const escapedCode = escapeCodeBlock(code.trim())
      return `\\begin{lstlisting}${language}\n${escapedCode}\n\\end{lstlisting}\n`
    })
    
    // Inline code
    .replace(/`([^`]+?)`/g, '\\lstinline{$1}')
    
    // Links
    .replace(/\[([^\]]+?)\]\(([^\)]+?)\)/g, '\\href{$2}{$1}')
    
    // Blockquotes
    .replace(/^> (.*?)$/gm, '\\begin{quote}\n$1\n\\end{quote}')
    
    // Horizontal rules
    .replace(/^---+$/gm, '\\noindent\\hrulefill')
    
    // Line breaks
    .replace(/\n\n+/g, '\n\n')
  
  // Lists - more sophisticated handling
  latex = handleLists(latex)
  
  // Escape remaining LaTeX special characters in regular text content
  latex = escapeContentAreas(latex)
  
  return latex.trim()
}

function escapeContentAreas(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  
  for (const line of lines) {
    // Don't escape lines that are already LaTeX commands or empty
    if (line.trim().startsWith('\\') || line.trim() === '') {
      result.push(line)
      continue
    }
    
    // Escape special characters in regular text
    let escaped = line
      .replace(/\\/g, '\\textbackslash{}')  // \ first
      .replace(/\$/g, '\\$')  // $
      .replace(/%/g, '\\%')  // %
      .replace(/&/g, '\\&')  // &
      .replace(/#/g, '\\#')  // #
      .replace(/\^/g, '\\^{}')  // ^
      .replace(/~/g, '\\textasciitilde{}')  // ~
    
    result.push(escaped)
  }
  
  return result.join('\n')
}

function handleLists(text: string): string {
  const lines = text.split('\n')
  let result: string[] = []
  let inUnorderedList = false
  let inOrderedList = false
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    // Unordered list detection (-, *, +)
    const unorderedMatch = trimmed.match(/^[-*+]\s+(.*)$/)
    if (unorderedMatch) {
      if (!inUnorderedList) {
        result.push('\\begin{itemize}')
        inUnorderedList = true
      }
      result.push(`  \\item ${unorderedMatch[1]}`)
      continue
    }
    
    // Ordered list detection (1., 2., etc)
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/)
    if (orderedMatch) {
      if (!inOrderedList) {
        result.push('\\begin{enumerate}')
        inOrderedList = true
      }
      result.push(`  \\item ${orderedMatch[1]}`)
      continue
    }
    
    // Close lists if we're no longer in a list
    if ((inUnorderedList || inOrderedList) && !unorderedMatch && !orderedMatch && trimmed !== '') {
      if (inUnorderedList) result.push('\\end{itemize}')
      if (inOrderedList) result.push('\\end{enumerate}')
      inUnorderedList = false
      inOrderedList = false
      result.push(line)
    } else if (trimmed === '' && (inUnorderedList || inOrderedList)) {
      // Keep blank lines within lists if next line is also a list item
      if (!lines[i + 1]?.trim().match(/^[-*+\d]/)) {
        if (inUnorderedList) result.push('\\end{itemize}')
        if (inOrderedList) result.push('\\end{enumerate}')
        inUnorderedList = false
        inOrderedList = false
      }
      result.push('')
    } else if (trimmed !== '' || (!inUnorderedList && !inOrderedList)) {
      result.push(line)
    }
  }
  
  // Close any open lists at the end
  if (inUnorderedList) result.push('\\end{itemize}')
  if (inOrderedList) result.push('\\end{enumerate}')
  
  return result.join('\n')
}

function escapeCodeBlock(code: string): string {
  return code
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([{}])/g, '\\$1')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&/g, '\\&')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
}

export function escapeLatexContent(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\$/g, '\\$')
    .replace(/%/g, '\\%')
    .replace(/&/g, '\\&')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/([{}])/g, '\\$1')
}
