/**
 * Converte um <svg> da tela em PNG para download.
 *
 * O caminho é serializar o SVG e desenhá-lo num canvas. Só que um SVG carregado
 * como imagem **não busca sub-recursos**: qualquer `<image href="/algo.png">`
 * sairia em branco. Por isso cada href externo é convertido em data URI antes
 * da serialização — é a diferença entre exportar a peça e exportar o fundo.
 */
export async function svgToPngBlob(svg: SVGSVGElement, scale = 1): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement
  await inlineImages(clone)

  const viewBox = svg.viewBox.baseVal
  const width = Math.round((viewBox.width || svg.clientWidth) * scale)
  const height = Math.round((viewBox.height || svg.clientHeight) * scale)
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  const source = new XMLSerializer().serializeToString(clone)
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`

  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas indisponível')
  ctx.drawImage(image, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('falha ao gerar o PNG'))), 'image/png')
  })
}

/** Troca todo href externo por data URI, para o SVG virar autossuficiente. */
async function inlineImages(root: SVGSVGElement) {
  const images = [...root.querySelectorAll('image')]
  const cache = new Map<string, Promise<string>>()

  await Promise.all(
    images.map(async (node) => {
      const href = node.getAttribute('href') ?? node.getAttribute('xlink:href')
      if (!href || href.startsWith('data:')) return
      cache.set(href, cache.get(href) ?? toDataUrl(href))
      const dataUrl = await cache.get(href)!
      node.setAttribute('href', dataUrl)
      node.removeAttribute('xlink:href')
    })
  )
}

async function toDataUrl(url: string): Promise<string> {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`não consegui ler ${url}`))
    reader.readAsDataURL(blob)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('não consegui rasterizar o SVG'))
    img.src = src
  })
}

/** Dispara o download de um blob com o nome dado. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Revogar cedo demais cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
