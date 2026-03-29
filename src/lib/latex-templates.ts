/**
 * LaTeX Templates for Markdown to LaTeX conversion
 */

export interface LatexTemplate {
  id: string
  name: string
  description: string
  isCustom: boolean
  content: string
}

export const DEFAULT_LATEX_TEMPLATES: LatexTemplate[] = [
  {
    id: 'article',
    name: 'Article',
    description: 'Standard article document class',
    isCustom: false,
    content: `\\documentclass[11pt,a4paper]{article}
\\usepackage[utf-8]{inputenc}
\\usepackage[margin=1in]{geometry}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{listings}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{amsmath}

% Define colors for code
\\definecolor{codegreen}{rgb}{0,0.6,0}
\\definecolor{codegray}{rgb}{0.5,0.5,0.5}
\\definecolor{codepurple}{rgb}{0.58,0,0.82}
\\definecolor{backcolour}{rgb}{0.95,0.95,0.95}

% Code listing style
\\lstdefinestyle{mystyle}{
    backgroundcolor=\\color{backcolour},
    commentstyle=\\color{codegreen},
    keywordstyle=\\color{codepurple},
    numberstyle=\\tiny\\color{codegray},
    stringstyle=\\color{codepurple},
    basicstyle=\\ttfamily\\footnotesize,
    breakatwhitespace=false,
    breaklines=true,
    captionpos=b,
    keepspaces=true,
    numbers=left,
    numbersep=5pt,
    showspaces=false,
    showstringspaces=false,
    showtabs=false,
    tabsize=2
}
\\lstset{style=mystyle}

% Header and Footer
\\pagestyle{fancy}
\\lhead{\\textit{MD Editor Export}}
\\rhead{}
\\lfoot{\\today}
\\rfoot{\\thepage}

\\hypersetup{colorlinks=true, linkcolor=blue, urlcolor=blue}

\\title{{{TITLE}}}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents
\\newpage

{CONTENT}

\\end{document}`,
  },
  {
    id: 'report',
    name: 'Report',
    description: 'Professional report with title page',
    isCustom: false,
    content: `\\documentclass[11pt,a4paper]{report}
\\usepackage[utf-8]{inputenc}
\\usepackage[margin=1.25in]{geometry}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{listings}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{amsmath}
\\usepackage{lastpage}

% Define colors
\\definecolor{codegreen}{rgb}{0,0.6,0}
\\definecolor{codegray}{rgb}{0.5,0.5,0.5}
\\definecolor{codepurple}{rgb}{0.58,0,0.82}
\\definecolor{backcolour}{rgb}{0.95,0.95,0.95}
\\definecolor{linkcolor}{rgb}{0, 0, 0.5}

% Code listing style
\\lstdefinestyle{mystyle}{
    backgroundcolor=\\color{backcolour},
    commentstyle=\\color{codegreen},
    keywordstyle=\\color{codepurple},
    numberstyle=\\tiny\\color{codegray},
    stringstyle=\\color{codepurple},
    basicstyle=\\ttfamily\\footnotesize,
    breakatwhitespace=false,
    breaklines=true,
    captionpos=b,
    keepspaces=true,
    numbers=left,
    numbersep=5pt,
    showspaces=false,
    showstringspaces=false,
    showtabs=false,
    tabsize=2
}
\\lstset{style=mystyle}

% Header and Footer
\\pagestyle{fancy}
\\lhead{}
\\chead{\\textbf{Professional Report}}
\\rhead{}
\\lfoot{Generated: \\today}
\\cfoot{}
\\rfoot{\\thepage\\ / \\pageref{LastPage}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0.4pt}

\\hypersetup{colorlinks=true, linkcolor=linkcolor, urlcolor=linkcolor}

\\title{{\\LARGE \\textbf{{TITLE}}}}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle
\\tableofcontents
\\newpage

{CONTENT}

\\end{document}`,
  },
  {
    id: 'book',
    name: 'Book',
    description: 'Book-style document with chapters',
    isCustom: false,
    content: `\\documentclass[12pt,a4paper]{book}
\\usepackage[utf-8]{inputenc}
\\usepackage[margin=1in,inner=1.5in,outer=0.75in]{geometry}
\\usepackage{hyperref}
\\usepackage{xcolor}
\\usepackage{listings}
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{amsmath}
\\usepackage{biblatex}
\\usepackage{array}

% Define colors
\\definecolor{codegreen}{rgb}{0,0.6,0}
\\definecolor{codegray}{rgb}{0.5,0.5,0.5}
\\definecolor{codepurple}{rgb}{0.58,0,0.82}
\\definecolor{backcolour}{rgb}{0.95,0.95,0.95}

% Code listing style
\\lstdefinestyle{mystyle}{
    backgroundcolor=\\color{backcolour},
    commentstyle=\\color{codegreen},
    keywordstyle=\\color{codepurple},
    numberstyle=\\tiny\\color{codegray},
    stringstyle=\\color{codepurple},
    basicstyle=\\ttfamily\\footnotesize,
    breakatwhitespace=false,
    breaklines=true,
    captionpos=b,
    keepspaces=true,
    numbers=left,
    numbersep=5pt,
    showspaces=false,
    showstringspaces=false,
    showtabs=false,
    tabsize=2
}
\\lstset{style=mystyle}

% Page styling
\\pagestyle{fancy}
\\fancyhead[LE,RO]{\\thepage}
\\fancyhead[RE]{Chapter \\thechapter}
\\fancyhead[LO]{\\leftmark}
\\fancyfoot[C]{}

\\hypersetup{colorlinks=true, linkcolor=blue, urlcolor=blue}

\\title{{\\Huge \\textbf{{TITLE}}}}
\\author{}
\\date{\\today}

\\begin{document}

\\maketitle
\\frontmatter
\\tableofcontents
\\mainmatter

{CONTENT}

\\end{document}`,
  },
]

export function getDefaultTemplate(): LatexTemplate {
  return DEFAULT_LATEX_TEMPLATES[0]
}

export function formatLatexTemplate(template: LatexTemplate, title: string, content: string): string {
  return template.content
    .replace('{TITLE}', escapeLatex(title))
    .replace('{CONTENT}', content)
}

export function escapeLatex(text: string): string {
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}~^])/g, '\\$1')
    .replace(/\n/g, ' ')
}
