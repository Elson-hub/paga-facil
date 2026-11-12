import { supabase } from './supabase'

export interface Anexo {
  id: string
  lancamento_id: string
  caminho: string
  nome: string
  tipo: string | null
  tamanho: number | null
}

const BUCKET = 'anexos'
export const LIMITE_BYTES = 10 * 1024 * 1024
export const TIPOS_ACEITOS = 'image/*,application/pdf'

export const ehImagem = (tipo: string | null) => !!tipo && tipo.startsWith('image/')

export function tamanhoLegivel(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Fotos grandes (ex.: da câmera do celular) são reduzidas para no máximo 1800 px. */
async function compactar(arquivo: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size < 1.5 * 1024 * 1024) return arquivo
  try {
    const bitmap = await createImageBitmap(arquivo)
    const escala = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * escala)
    canvas.height = Math.round(bitmap.height * escala)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob: Blob | null = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', 0.82))
    if (!blob || blob.size >= arquivo.size) return arquivo
    return new File([blob], arquivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return arquivo
  }
}

const nomeSeguro = (nome: string) =>
  nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80)

/** Envia o arquivo e registra no lançamento. */
export async function enviarAnexo(lancamentoId: string, original: File): Promise<Anexo> {
  const arquivo = await compactar(original)
  if (arquivo.size > LIMITE_BYTES) throw new Error('grande')
  const { data: sessao } = await supabase.auth.getSession()
  const uid = sessao.session?.user.id
  if (!uid) throw new Error('sessao')
  const caminho = `${uid}/${lancamentoId}/${Date.now()}-${nomeSeguro(arquivo.name)}`
  const up = await supabase.storage.from(BUCKET).upload(caminho, arquivo, { contentType: arquivo.type || undefined })
  if (up.error) throw up.error
  const { data, error } = await supabase.from('lancamento_anexos').insert({
    lancamento_id: lancamentoId, caminho, nome: original.name, tipo: arquivo.type || null, tamanho: arquivo.size
  }).select('id, lancamento_id, caminho, nome, tipo, tamanho').single()
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([caminho])
    throw error
  }
  return data
}

export async function listarAnexos(lancamentoId: string): Promise<Anexo[]> {
  const { data, error } = await supabase.from('lancamento_anexos')
    .select('id, lancamento_id, caminho, nome, tipo, tamanho').eq('lancamento_id', lancamentoId).order('criado_em')
  if (error) throw error
  return data ?? []
}

/** Links temporários (10 minutos) para ver os arquivos. */
export async function linksDosAnexos(caminhos: string[]): Promise<Map<string, string>> {
  if (!caminhos.length) return new Map()
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(caminhos, 600)
  return new Map((data ?? []).filter(d => d.signedUrl && d.path).map(d => [d.path as string, d.signedUrl]))
}

export async function excluirAnexo(a: Anexo) {
  const r = await supabase.storage.from(BUCKET).remove([a.caminho])
  if (r.error) throw r.error
  const { error } = await supabase.from('lancamento_anexos').delete().eq('id', a.id)
  if (error) throw error
}

/** Apaga os arquivos guardados dos lançamentos (usado antes de excluí-los). */
export async function apagarArquivosDos(lancamentoIds: string[]) {
  if (!lancamentoIds.length) return
  const { data } = await supabase.from('lancamento_anexos').select('caminho').in('lancamento_id', lancamentoIds)
  const caminhos = (data ?? []).map(a => a.caminho)
  if (caminhos.length) await supabase.storage.from(BUCKET).remove(caminhos)
}

/** Quais lançamentos da lista têm anexo (para mostrar o clipe). */
export async function lancamentosComAnexo(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const { data } = await supabase.from('lancamento_anexos').select('lancamento_id').in('lancamento_id', ids)
  return new Set((data ?? []).map(a => a.lancamento_id))
}
