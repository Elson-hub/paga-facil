import { supabase } from './supabase'

export type CategoriaConta = 'corrente' | 'poupanca' | 'carteira' | 'investimento' | 'outros'

export const CATEGORIAS_CONTA: { id: CategoriaConta; nome: string; cor: string }[] = [
  { id: 'corrente', nome: 'Conta corrente', cor: '#1E5BD8' },
  { id: 'poupanca', nome: 'Poupança', cor: '#1F9D55' },
  { id: 'carteira', nome: 'Carteira (dinheiro)', cor: '#E5A50A' },
  { id: 'investimento', nome: 'Investimento', cor: '#5B3FD1' },
  { id: 'outros', nome: 'Outros', cor: '#5F6B7A' }
]

export const categoriaConta = (id: string) =>
  CATEGORIAS_CONTA.find(c => c.id === id) ?? CATEGORIAS_CONTA[4]

export interface Conta {
  id: string
  descricao: string
  tipo: CategoriaConta
  saldo_inicial: number
  limite_cheque_especial: number
  ativa: boolean
}

export interface ContaComSaldo extends Conta {
  saldo_atual: number
}

/**
 * Lista as contas com o saldo atual: saldo inicial + receitas e despesas
 * efetivadas + transferências recebidas − enviadas − faturas pagas.
 */
export async function listarContas(): Promise<ContaComSaldo[]> {
  const [contas, lanc, transf, pagos] = await Promise.all([
    supabase.from('contas').select('id, descricao, tipo, saldo_inicial, limite_cheque_especial, ativa').order('descricao'),
    supabase.from('lancamentos').select('conta_id, tipo, valor').eq('efetivado', true).not('conta_id', 'is', null),
    supabase.from('transferencias').select('conta_origem_id, conta_destino_id, valor'),
    supabase.from('pagamentos_fatura').select('conta_id, valor')
  ])
  if (contas.error) throw contas.error

  const mov = new Map<string, number>()
  const somar = (id: string | null, v: number) => { if (id) mov.set(id, (mov.get(id) ?? 0) + v) }
  for (const l of lanc.data ?? []) somar(l.conta_id, l.tipo === 'receita' ? Number(l.valor) : -Number(l.valor))
  for (const t of transf.data ?? []) { somar(t.conta_origem_id, -Number(t.valor)); somar(t.conta_destino_id, Number(t.valor)) }
  for (const p of pagos.data ?? []) somar(p.conta_id, -Number(p.valor))

  return (contas.data ?? []).map(c => ({
    ...c,
    saldo_inicial: Number(c.saldo_inicial),
    limite_cheque_especial: Number(c.limite_cheque_especial),
    saldo_atual: Number(c.saldo_inicial) + (mov.get(c.id) ?? 0)
  })) as ContaComSaldo[]
}

/** True se a conta já foi usada em algum lançamento, transferência, fatura ou cartão. */
export async function contaEmUso(id: string): Promise<boolean> {
  const contar = (q: PromiseLike<{ count: number | null }>) => q.then(r => r.count ?? 0)
  const totais = await Promise.all([
    contar(supabase.from('lancamentos').select('id', { count: 'exact', head: true }).eq('conta_id', id)),
    contar(supabase.from('transferencias').select('id', { count: 'exact', head: true }).or(`conta_origem_id.eq.${id},conta_destino_id.eq.${id}`)),
    contar(supabase.from('pagamentos_fatura').select('id', { count: 'exact', head: true }).eq('conta_id', id)),
    contar(supabase.from('cartoes').select('id', { count: 'exact', head: true }).eq('conta_pagamento_id', id))
  ])
  return totais.some(n => n > 0)
}
