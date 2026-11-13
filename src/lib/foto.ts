import { supabase } from './supabase'

const BUCKET = 'anexos'
const TAMANHO = 400

/** Recorta o centro da imagem em quadrado e reduz para 400×400 em JPEG. */
async function prepararFoto(arquivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(arquivo)
  const lado = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = TAMANHO
  canvas.height = TAMANHO
  canvas.getContext('2d')!.drawImage(
    bitmap, (bitmap.width - lado) / 2, (bitmap.height - lado) / 2, lado, lado, 0, 0, TAMANHO, TAMANHO
  )
  const blob: Blob | null = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.85))
  if (!blob) throw new Error('imagem')
  return blob
}

/** Envia a nova foto e devolve o caminho guardado. */
export async function enviarFoto(usuarioId: string, arquivo: File): Promise<string> {
  const blob = await prepararFoto(arquivo)
  const caminho = `${usuarioId}/perfil/foto-${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(caminho, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return caminho
}

export async function apagarFoto(caminho: string) {
  await supabase.storage.from(BUCKET).remove([caminho])
}

/** Link temporário (1 dia) para mostrar a foto. */
export async function linkDaFoto(caminho: string): Promise<string | null> {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 60 * 60 * 24)
  return data?.signedUrl ?? null
}
