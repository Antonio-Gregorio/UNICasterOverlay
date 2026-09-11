/**
 * Prepara uma imagem escolhida pelo usuário para virar data URL.
 *
 * O redimensionamento não é cosmético: estas imagens vão para o localStorage,
 * que tem poucos MB no total. Guardar o arquivo original estouraria a cota com
 * meia dúzia de itens.
 */
export interface UploadedImage {
  dataUrl: string
  width: number
  height: number
}

export function fileToImage(
  file: File,
  { maxSize, square = false }: { maxSize: number; square?: boolean }
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      // "contain": a proporção de uma logo é imprevisível e distorcer é feio.
      const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))

      // Quadrado para insígnias que precisam de caixa fixa; livre para logo de
      // evento, que costuma ser larga e ficaria com tarja em volta.
      const canvas = document.createElement('canvas')
      canvas.width = square ? maxSize : w
      canvas.height = square ? maxSize : h
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('canvas indisponível'))
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)

      resolve({
        dataUrl: canvas.toDataURL('image/webp', 0.9),
        width: canvas.width,
        height: canvas.height,
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('não foi possível ler a imagem'))
    }
    img.src = url
  })
}
