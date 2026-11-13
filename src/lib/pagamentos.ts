import { supabase } from './supabase'
import { dataNoMes, paraIso } from './datas'
import { faturaDaCompra } from './compras'
import type { Cartao } from './cartoes'

export interface Pagamento {
  id: string
  fatura_id: string
  conta_id: string
  data: string
  valor: number
}

const centavos = (v: number) => Math.round(v * 100)

/** Pagamentos já feitos numa fatura. */
export async function listarPagamentos(faturaId: string): Promise<Pagamento[]> {
  const { data, error } = await supabase.from('pagamentos_fatura')
    .select('id, fatura_id, conta_id, data, valor').eq('fatura_id', faturaId).order('data')
  if (error) throw error
  return (data ?? []).map(p => ({ ...p, valor: Number(p.valor) }))
}

/** Busca (ou cria) a fatura seguinte à `mesRef` do cartão. */
async function faturaSeguinte(cartao: Cartao, mesRef: string) {
  const [a, m] = mesRef.split('-').map(Number)
  const f = faturaDaCompra(cartao, paraIso(dataNoMes(a, m, cartao.dia_fechamento)))
  const buscar = () => supabase.from('faturas').select('id, data_vencimento')
    .eq('cartao_id', cartao.id).eq('mes_referencia', f.mes_referencia).maybeSingle()
  const existente = await buscar()
  if (existente.data) return existente.data
  const nova = await supabase.from('faturas').insert({ cartao_id: cartao.id, ...f }).select('id, data_vencimento').single()
  if (nova.data) return nova.data
  const denovo = await buscar()
  if (denovo.data) return denovo.data
  throw nova.error ?? new Error('fatura')
}

/**
 * Registra o pagamento. Se pagar menos que o total, a fatura fica "paga em
 * parte" e o restante entra na fatura seguinte como "Saldo da fatura anterior".
 */
export async function pagarFatura(p: {
  cartao: Cartao
  fatura: { id: string; mes_referencia: string; data_vencimento: string }
  total: number
  jaPago: number
  valor: number
  conta_id: string
  data: string
}) {
  const { data: pg, error } = await supabase.from('pagamentos_fatura')
    .insert({ fatura_id: p.fatura.id, conta_id: p.conta_id, data: p.data, valor: p.valor })
    .select('id').single()
  if (error || !pg) throw error

  const pago = p.jaPago + p.valor
  const restante = (centavos(p.total) - centavos(pago)) / 100
  const situacao = restante <= 0 ? 'paga' : 'paga_parcial'

  try {
    const r = await supabase.from('faturas').update({ valor_total: p.total, valor_pago: pago, situacao }).eq('id', p.fatura.id)
    if (r.error) throw r.error
    if (restante > 0) {
      const prox = await faturaSeguinte(p.cartao, p.fatura.mes_referencia)
      const ins = await supabase.from('lancamentos').insert({
        tipo: 'despesa_cartao', descricao: 'Saldo da fatura anterior', valor: restante,
        data_lancamento: p.fatura.data_vencimento, data_vencimento: prox.data_vencimento, efetivado: false,
        cartao_id: p.cartao.id, conta_id: null, fatura_id: prox.id, pagamento_origem_id: pg.id,
        observacao: 'Restante do pagamento parcial'
      })
      if (ins.error) throw ins.error
    }
  } catch (e) {
    // Não deixa pagamento pela metade: desfaz e devolve o erro.
    await supabase.from('pagamentos_fatura').delete().eq('id', pg.id)
    await supabase.from('faturas').update({ valor_pago: p.jaPago, situacao: p.jaPago > 0 ? 'paga_parcial' : 'aberta' }).eq('id', p.fatura.id)
    throw e
  }
}

/** Desfaz um pagamento (o saldo levado para a fatura seguinte é apagado junto). */
export async function desfazerPagamento(pagamento: Pagamento, total: number) {
  const { error } = await supabase.from('pagamentos_fatura').delete().eq('id', pagamento.id)
  if (error) throw error
  const restantes = await listarPagamentos(pagamento.fatura_id)
  const pago = restantes.reduce((s, x) => s + x.valor, 0)
  const situacao = pago <= 0 ? 'aberta' : centavos(pago) >= centavos(total) ? 'paga' : 'paga_parcial'
  await supabase.from('faturas').update({ valor_pago: pago, situacao }).eq('id', pagamento.fatura_id)
}

/** Fatura quitada: paga toda, ou paga em parte com o restante levado para a seguinte. */
export const faturaQuitada = (situacao: string | null | undefined) => situacao === 'paga' || situacao === 'paga_parcial'
