import { asBlob } from 'html-docx-js-typescript'

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const SVG_MIME_TYPE = 'image/svg+xml;charset=utf-8'
const MAX_DOCX_DIAGRAM_WIDTH_PX = 640
const MAX_DOCX_DIAGRAM_HEIGHT_PX = 860
const MAX_DOCX_RASTER_WIDTH_PX = 2400
const MAX_DOCX_RASTER_HEIGHT_PX = 3200

interface DownloadDocxOptions {
  htmlDocument: string
  fileName: string
}

function ensureDocxExtension(fileName: string): string {
  return fileName.toLowerCase().endsWith('.docx') ? fileName : `${fileName}.docx`
}

function getSvgDimension(svg: SVGSVGElement, axis: 'width' | 'height'): number {
  const attributeValue = svg.getAttribute(axis)
  const styleValue = svg.style[axis]
  const viewBox = svg.viewBox.baseVal
  const fallback = axis === 'width' ? viewBox.width : viewBox.height

  const attributeNumber = attributeValue ? Number.parseFloat(attributeValue) : Number.NaN
  if (Number.isFinite(attributeNumber) && attributeNumber > 0 && !attributeValue?.includes('%')) {
    return attributeNumber
  }

  const styleNumber = styleValue ? Number.parseFloat(styleValue) : Number.NaN
  if (Number.isFinite(styleNumber) && styleNumber > 0) {
    return styleNumber
  }

  const maxStyleMatch = (svg.getAttribute('style') ?? '').match(
    axis === 'width' ? /max-width:\s*([\d.]+)px/i : /max-height:\s*([\d.]+)px/i
  )
  const maxStyleNumber = maxStyleMatch ? Number.parseFloat(maxStyleMatch[1]) : Number.NaN
  if (Number.isFinite(maxStyleNumber) && maxStyleNumber > 0) {
    return maxStyleNumber
  }

  if (Number.isFinite(fallback) && fallback > 0) {
    return fallback
  }

  return axis === 'width' ? 800 : 600
}

function constrainDiagramSize(width: number, height: number) {
  const scale = Math.min(
    1,
    MAX_DOCX_DIAGRAM_WIDTH_PX / width,
    MAX_DOCX_DIAGRAM_HEIGHT_PX / height,
  )

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function getRasterDiagramSize(width: number, height: number) {
  const preferredScale = Math.max(2, window.devicePixelRatio || 1)
  const rasterScale = Math.min(
    preferredScale,
    MAX_DOCX_RASTER_WIDTH_PX / width,
    MAX_DOCX_RASTER_HEIGHT_PX / height,
  )

  return {
    width: Math.max(1, Math.round(width * rasterScale)),
    height: Math.max(1, Math.round(height * rasterScale)),
  }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load diagram image for DOCX export.'))
    image.src = src
  })
}

async function svgToPngDataUrl(svg: SVGSVGElement) {
  const width = Math.ceil(getSvgDimension(svg, 'width'))
  const height = Math.ceil(getSvgDimension(svg, 'height'))
  const rasterSize = getRasterDiagramSize(width, height)
  const clone = svg.cloneNode(true) as SVGSVGElement

  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))

  const svgMarkup = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([svgMarkup], { type: SVG_MIME_TYPE })
  const svgUrl = window.URL.createObjectURL(svgBlob)

  try {
    const image = await loadImage(svgUrl)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')

    if (!context) {
      throw new Error('DOCX export could not create a canvas for Mermaid diagrams.')
    }

    canvas.width = rasterSize.width
    canvas.height = rasterSize.height
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, rasterSize.width, rasterSize.height)
    context.drawImage(image, 0, 0, rasterSize.width, rasterSize.height)

    return canvas.toDataURL('image/png')
  } finally {
    window.URL.revokeObjectURL(svgUrl)
  }
}

async function replaceSvgWithImages(htmlDocument: string) {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(htmlDocument, 'text/html')
  const svgElements = Array.from(documentNode.querySelectorAll('svg'))

  await Promise.all(svgElements.map(async (svg) => {
    const sourceSvg = svg as unknown as SVGSVGElement
    const width = Math.ceil(getSvgDimension(sourceSvg, 'width'))
    const height = Math.ceil(getSvgDimension(sourceSvg, 'height'))
    const constrainedSize = constrainDiagramSize(width, height)
    const pngDataUrl = await svgToPngDataUrl(sourceSvg)
    const image = documentNode.createElement('img')
    const mermaidWrapper = svg.closest('pre.mermaid')

    image.setAttribute('src', pngDataUrl)
    image.setAttribute('width', String(constrainedSize.width))
    image.setAttribute('height', String(constrainedSize.height))
    image.setAttribute('alt', svg.getAttribute('aria-label') || 'Diagram')
    image.setAttribute(
      'style',
      `display:block;margin:0 auto;width:${constrainedSize.width}px;height:${constrainedSize.height}px;max-width:100%;page-break-inside:avoid;`
    )

    if (mermaidWrapper) {
      const container = documentNode.createElement('div')
      container.setAttribute(
        'style',
        `margin:1em 0;text-align:center;page-break-inside:avoid;`
      )
      container.appendChild(image)
      mermaidWrapper.replaceWith(container)
      return
    }

    svg.replaceWith(image)
  }))

  return `<!DOCTYPE html>\n${documentNode.documentElement.outerHTML}`
}

export async function downloadDocxDocument({ htmlDocument, fileName }: DownloadDocxOptions) {
  const normalizedDocument = await replaceSvgWithImages(htmlDocument)
  const result = await asBlob(normalizedDocument)
  const blob = result instanceof Blob
    ? result
    : new Blob([result], { type: DOCX_MIME_TYPE })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = ensureDocxExtension(fileName)
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  window.setTimeout(() => window.URL.revokeObjectURL(url), 0)
}
