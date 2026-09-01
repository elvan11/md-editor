import { describe, expect, it } from 'vitest'
import { getScreenPreviewLayoutCss } from './screen-preview-layout'

describe('getScreenPreviewLayoutCss', () => {
  it('adds page-like side margins only when the document is viewed on screen', () => {
    expect(getScreenPreviewLayoutCss()).toContain(`@media screen {
  body.html-preview { padding: 2rem; }
  .page-wrap { max-width: 210mm; padding: 20mm; }
}`)
  })
})
