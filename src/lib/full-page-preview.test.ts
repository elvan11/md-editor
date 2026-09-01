import { describe, expect, it } from 'vitest'
import { openFullPagePreview } from './full-page-preview'

describe('openFullPagePreview', () => {
  it('writes the rendered document to a new tab without printing or closing it', () => {
    const document = {
      writeCalls: [] as string[],
      closed: false,
      write(html: string) { this.writeCalls.push(html) },
      close() { this.closed = true },
    }
    const tab = { document }
    const open = (url?: string, target?: string) => {
      expect(url).toBe('')
      expect(target).toBe('_blank')
      return tab
    }

    openFullPagePreview('<!doctype html><title>Preview</title>', open)

    expect(document.writeCalls).toEqual(['<!doctype html><title>Preview</title>'])
    expect(document.closed).toBe(true)
    expect('print' in tab).toBe(false)
  })

  it('does nothing when the browser blocks the new tab', () => {
    expect(() => openFullPagePreview('<p>Preview</p>', () => null)).not.toThrow()
  })
})
