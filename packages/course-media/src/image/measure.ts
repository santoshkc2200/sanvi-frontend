/**
 * Client-side image measurement shared by every uploader in this package:
 * the natural dimensions drive both the local preview and the asset
 * metadata a downstream consumer (e.g. advertising's placement specs)
 * validates against before anything is uploaded.
 */
export function measureImage(file: File): Promise<{ url: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => resolve({ url, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable_image'))
    }
    image.src = url
  })
}
