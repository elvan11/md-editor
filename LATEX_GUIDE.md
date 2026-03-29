# LaTeX Support - User Guide

## Overview
Your MD Editor now supports LaTeX export and preview! You can create professional documents with proper LaTeX formatting while working with Markdown syntax.

## Getting Started

### 1. **LaTeX Toolbar** (in the Preview section)
Located right below the preview pane, you'll see:
- **Preview** - Opens LaTeX preview dialog
- **Print** - Prints LaTeX source code
- **Download** - Downloads as `.tex` file
- **Copy** - Copies LaTeX to clipboard
- **Manage** - Opens template manager

### 2. **Three Built-in Templates**

#### Article
- Standard document class
- Good for papers and articles
- Single-column layout
- Table of contents support

#### Report
- Professional report style
- Includes header/footer with page numbers
- Date generated on each page
- Title page support

#### Book
- Book chapter style
- Two-sided page setup (inner/outer margins)
- Chapter-based organization
- Fancy header/footer styling

### 3. **Using Custom Templates**

Click **Manage** to open the template manager and add your own LaTeX template:

1. Go to the "Add Custom Template" tab
2. Enter a template name
3. Add optional description
4. Paste your LaTeX template

**Required placeholders:**
- `{TITLE}` - Where the document title goes (extracted from first H1)
- `{CONTENT}` - Where your markdown content converts to LaTeX

Example:
```latex
\documentclass{article}
\usepackage{geometry}

\title{{TITLE}}

\begin{document}
\maketitle
{CONTENT}
\end{document}
```

### 4. **Markdown to LaTeX Conversion**

Your markdown is automatically converted:
- `# Heading 1` → `\chapter*{...}`
- `## Heading 2` → `\section*{...}`
- `### Heading 3` → `\subsubsection*{...}`
- `**bold**` → `\textbf{...}`
- `*italic*` → `\textit{...}`
- `` `code` `` → `\lstinline{...}`
- ` ```lang\ncode\n``` ` → `\begin{lstlisting}...\end{lstlisting}`
- `[link](url)` → `\href{url}{link}`
- `> quote` → `\begin{quote}...\end{quote}`
- `- list items` → `\begin{itemize}...\end{itemize}`
- `1. numbered items` → `\begin{enumerate}...\end{enumerate}`

### 5. **Preview**

Click **Preview** to see how your LaTeX document will look:
- **Preview tab**: Shows rendered HTML version (approximate)
- **Source tab**: Shows raw LaTeX code for editing in external editors
- Download or copy the LaTeX directly from the preview

### 6. **Print**

Two print options are available:
- **Print (HTML)** - Your original markdown rendered as HTML
- **Print (LaTeX)** - Prints the LaTeX source code in a new window

### 7. **Persistence**

Your selections are automatically saved:
- ✅ Selected template preference
- ✅ Any custom templates you create
- All saved in your browser's localStorage

## Tips & Tricks

1. **Test Your LaTeX**: Use the Preview tab to verify the output before downloading
2. **Custom Packages**: Add any LaTeX packages you need in your custom templates
3. **Document Title**: The first H1 heading (`# Title`) becomes your document title
4. **Code Highlighting**: Code blocks support syntax highlighting with `\lstlisting`
5. **Full Control**: Copy the LaTeX source and edit it further in a LaTeX editor like Overleaf

## Troubleshooting

**"Template must include {CONTENT} placeholder"**
- Make sure your custom template has `{CONTENT}` exactly as shown

**LaTeX not looking right in preview**
- The HTML preview is simplified; download and compile in a LaTeX editor for full accuracy
- Complex LaTeX features may not show in HTML preview

**Missing fonts/packages**
- The templates include common packages, but you can add more in custom templates
- Ensure your LaTeX editor has the required packages installed

## Next Steps

1. Try the built-in templates
2. Create a custom template with your preferred styling
3. Download and compile the `.tex` file in a LaTeX editor (e.g., Overleaf, MiKTeX, TeX Live)
4. Share your templates with others!
