import { describe, expect, it } from 'vitest'
import { getAlignedScrollTop } from './pane-sync'

describe('getAlignedScrollTop', () => {
  it('maps a clicked vertical position to the equivalent target position', () => {
    expect(getAlignedScrollTop({
      sourceOffset: 300,
      sourceHeight: 1_000,
      targetTop: 2_000,
      targetHeight: 1_500,
      viewportOffset: 250,
      maxScrollTop: 4_000,
    })).toBe(2_200)
  })

  it('clamps a target position beyond the bottom of the page', () => {
    expect(getAlignedScrollTop({
      sourceOffset: 1_000,
      sourceHeight: 1_000,
      targetTop: 4_900,
      targetHeight: 1_500,
      viewportOffset: 250,
      maxScrollTop: 5_000,
    })).toBe(5_000)
  })
})
