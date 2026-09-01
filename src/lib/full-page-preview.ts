type PreviewTab = {
  document: Pick<Document, 'write' | 'close'>
}

type OpenTab = (url?: string, target?: string) => PreviewTab | null

export function openFullPagePreview(
  documentHtml: string,
  openTab: OpenTab = (url, target) => window.open(url, target),
) {
  const tab = openTab('', '_blank')
  if (!tab) return

  tab.document.write(documentHtml)
  tab.document.close()
}
