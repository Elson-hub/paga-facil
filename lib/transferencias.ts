import { supabase } from './supabase'

export interface Transferencia {
  id: string
  conta_origem_id: string
  conta_destino_id: string
  data: string
  valor: number
  descricao: string | null
}

const CAMPOS = 'id, conta_origem_id, conta_destino_id, data, valor, descricao'
const normalizar = (t: Record<string, unknown>) => ({ ...t, valor: Number(t.valor) }) as Transferencia

export async function buscarTransferencia(id: string): Promise<Transferencia> {
  const { data, error } = await supabase.from('transferencias').select(CAMPOS).eq('id', id).single()
  if (error || !data) throw error ?? new Error('transferencia')
  return normalizar(data)
}

/** Transferências com data no mês [inicio, fim). */
export async function transferenciasDoMes(inicio: string, fim: string): Promise<Transferencia[]> {
  const { data, error } = await supabase.from('transferencias').select(CAMPOS)
    .gte('data', inicio).lt('data', fim).order('data').order('criado_em')
  if (error) throw error
  return (data ?? []).map(normalizar)
}

export async function salvarTransferencia(dados: Omit<Transferencia, 'id'>, id?: string) {
  const { error } = id
    ? await supabase.from('transferencias').update(dados).eq('id', id)
    : await supabase.from('transferencias').insert(dados)
  if (error) throw error
}

export async function excluirTransferencia(id: string) {
  const { error } = await supabase.from('transferencias').delete().eq('id', id)
  if (error) throw error
}
