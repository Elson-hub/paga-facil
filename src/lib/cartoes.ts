import { supabase } from './supabase'

export const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra']

export const CORES_CARTAO = [
  '#1F2933', '#5B3FD1', '#820AD1', '#1E5BD8', '#0F7A5C', '#D64545', '#EC7000', '#E5A50A', '#5F6B7A', '#A35C2D'
]

export type TipoVencimento = 'fixo' | 'variavel'

export interface Cartao {
  id: string
  nome: string
  bandeira: string | null
  limite: number
  conta_pagamento_id: string | null
  dia_fechamento: number
  tipo_vencimento: TipoVencimento
  dia_vencimento: number | null
  dias_apos_fechamento: number | null
  cor: string | null
  ativo: boolean
}

export interface CartaoComUso extends Cartao {
  usado: number
  disponivel: number
}

/** Dia do mês ajustado: dia 31 em mês de 30 dias vira o último dia. */
function dataNoMes(ano: number, mes: number, dia: number) {
  const ultimo = new Date(ano, mes + 1, 0).getDate()
  return new Date(ano, mes, Math.min(dia, ultimo))
}

/**
 * Fechamento e vencimento da fatura em que cai uma compra feita em `data`.
 * Regra: compras até o dia do fechamento (inclusive) entram na fatura que
 * fecha naquele mês; a partir do dia seguinte, na fatura seguinte.
 */
export function faturaDaData(c: Pick<Cartao, 'dia_fechamento' | 'tipo_vencimento' | 'dia_vencimento' | 'dias_apos_fechamento'>, data: Date) {
  const dia = new Date(data.getFullYear(), data.getMonth(), data.getDate())
  let fechamento = dataNoMes(dia.getFullYear(), dia.getMonth(), c.dia_fechamento)
  if (dia > fechamento) fechamento = dataNoMes(dia.getFullYear(), dia.getMonth() + 1, c.dia_fechamento)

  let vencimento: Date
  if (c.tipo_vencimento === 'variavel') {
    vencimento = new Date(fechamento)
    vencimento.setDate(vencimento.getDate() + (c.dias_apos_fechamento ?? 10))
  } else {
    const diaV = c.dia_vencimento ?? 10
    vencimento = diaV > c.dia_fechamento
      ? dataNoMes(fechamento.getFullYear(), fechamento.getMonth(), diaV)
      : dataNoMes(fechamento.getFullYear(), fechamento.getMonth() + 1, diaV)
  }
  return { fechamento, vencimento }
}

export const dataCurta = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

/**
 * Lista os cartões com o limite usado: compras ainda não pagas
 * (inclusive parcelas futuras) menos pagamentos parciais.
 */
export async function listarCartoes(): Promise<CartaoComUso[]> {
  const [cartoes, compras, faturas, pagos] = await Promise.all([
    supabase.from('cartoes').select('id, nome, bandeira, limite, conta_pagamento_id, dia_fechamento, tipo_vencimento, dia_vencimento, dias_apos_fechamento, cor, ativo').order('nome'),
    supabase.from('lancamentos').select('cartao_id, valor, fatura_id').eq('tipo', 'despesa_cartao'),
    supabase.from('faturas').select('id, situacao'),
    supabase.from('pagamentos_fatura').select('fatura_id, valor')
  ])
  if (cartoes.error) throw cartoes.error

  const pagas = new Set((faturas.data ?? []).filter(f => f.situacao === 'paga').map(f => f.id))
  const pagoPorFatura = new Map<string, number>()
  for (const p of pagos.data ?? []) pagoPorFatura.set(p.fatura_id, (pagoPorFatura.get(p.fatura_id) ?? 0) + Number(p.valor))

  const usado = new Map<string, number>()
  const faturasDoCartao = new Map<string, Set<string>>()
  for (const l of compras.data ?? []) {
    if (l.fatura_id && pagas.has(l.fatura_id)) continue
    usado.set(l.cartao_id, (usado.get(l.cartao_id) ?? 0) + Number(l.valor))
    if (l.fatura_id) {
      if (!faturasDoCartao.has(l.cartao_id)) faturasDoCartao.set(l.cartao_id, new Set())
      faturasDoCartao.get(l.cartao_id)!.add(l.fatura_id)
    }
  }

  return (cartoes.data ?? []).map(c => {
    const pagoParcial = [...(faturasDoCartao.get(c.id) ?? [])].reduce((s, f) => s + (pagoPorFatura.get(f) ?? 0), 0)
    const u = Math.max(0, (usado.get(c.id) ?? 0) - pagoParcial)
    return { ...c, limite: Number(c.limite), usado: u, disponivel: Number(c.limite) - u } as CartaoComUso
  })
}

/** True se o cartão já tem compras ou faturas. */
export async function cartaoEmUso(id: string) {
  const [a, b] = await Promise.all([
    supabase.from('lancamentos').select('id', { count: 'exact', head: true }).eq('cartao_id', id),
    supabase.from('faturas').select('id', { count: 'exact', head: true }).eq('cartao_id', id)
  ])
  return (a.count ?? 0) + (b.count ?? 0) > 0
}
