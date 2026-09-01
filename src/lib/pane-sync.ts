type AlignedScrollInput = {
  sourceOffset: number
  sourceHeight: number
  targetTop: number
  targetHeight: number
  viewportOffset: number
  maxScrollTop: number
}

export function getAlignedScrollTop({
  sourceOffset,
  sourceHeight,
  targetTop,
  targetHeight,
  viewportOffset,
  maxScrollTop,
}: AlignedScrollInput): number {
  const progress = sourceHeight > 0
    ? Math.min(1, Math.max(0, sourceOffset / sourceHeight))
    : 0
  const targetPosition = targetTop + targetHeight * progress - viewportOffset

  return Math.min(maxScrollTop, Math.max(0, targetPosition))
}
