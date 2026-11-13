import { supabase } from './supabase'
import { deIso, paraIso, dataNoMes } from './datas'
import { faturaDaData, type Cartao } from './cartoes'
import { datasDaRecorrencia, dividirParcelas, type Recorrencia, type Escopo } from './lancamentos'

type RegraCartao = Pick<Cartao, 'id' | 'dia_fechamento' | 'tipo_vencimento' | 'dia_vencimento' | 'dias_apos_fechamento'>

export interface DadosCompra {
  descricao: string
  valor: number            // no parcelado, é o valor TOTAL
  data_compra: string
  cartao_id: string
  categoria_id: string | null
  observacao: string
  tags: string[]
}

export interface Fatura {
  id: string
  cartao_id: string
  mes_referencia: string   // dia 1 do mês em que a fatura fecha
  data_fechamento: string
  data_vencimento: string
  situacao: 'aberta' | 'fechada' | 'paga' | 'paga_parcial'
  valor_pago: number
}

/** Mês de referência e datas da fatura em que cai uma compra feita em `data`. */
export function faturaDaCompra(cartao: RegraCartao, data: string) {
  const { fechamento, vencimento } = faturaDaData(cartao, deIso(data))
  return {
    mes_referencia: paraIso(new Date(fechamento.getFullYear(), fechamento.getMonth(), 1)),
    data_fechamento: paraIso(fechamento),
    data_vencimento: paraIso(vencimento)
  }
}

/**
 * Data de referência da fatura da parcela `i` (0 = primeira): o dia de
 * fechamento, `i` meses depois da fatura da compra. Assim cada parcela cai
 * sempre na fatura seguinte, mesmo em meses curtos.
 */
export function dataDaParcela(cartao: RegraCartao, dataCompra: string, i: number) {
  if (i === 0) return dataCompra
  const [a, m] = faturaDaCompra(cartao, dataCompra).mes_referencia.split('-').map(Number)
  return paraIso(dataNoMes(a, m - 1 + i, cartao.dia_fechamento))
}

/** Busca a fatura do mês; se ainda não existir, cria. */
async function obterFatura(cartao: RegraCartao, data: string): Promise<{ id: string; data_vencimento: string }> {
  const f = faturaDaCompra(cartao, data)
  const buscar = () => supabase.from('faturas').select('id, data_vencimento')
    .eq('cartao_id', cartao.id).eq('mes_referencia', f.mes_referencia).maybeSingle()
  const existente = await buscar()
  if (existente.data) return existente.data
  const nova = await supabase.from('faturas').insert({ cartao_id: cartao.id, ...f }).select('id, data_vencimento').single()
  if (nova.data) return nova.data
  // Outra tela pode ter criado a mesma fatura ao mesmo tempo.
  const denovo = await buscar()
  if (denovo.data) return denovo.data
  throw nova.error ?? new Error('fatura')
}

async function regraDoCartao(id: string): Promise<RegraCartao> {
  const { data, error } = await supabase.from('cartoes')
    .select('id, dia_fechamento, tipo_vencimento, dia_vencimento, dias_apos_fechamento').eq('id', id).single()
  if (error || !data) throw error ?? new Error('cartao')
  return data as RegraCartao
}

async function gravarTags(ids: string[], tags: string[]) {
  if (!ids.length) return
  await supabase.from('lancamento_tags').delete().in('lancamento_id', ids)
  if (!tags.length) return
  const r = await supabase.from('lancamento_tags').insert(ids.flatMap(l => tags.map(t => ({ lancamento_id: l, tag_id: t }))))
  if (r.error) throw r.error
}

/**
 * Datas das ocorrências de uma compra: no parcelado, uma por mês a partir da
 * compra (cada uma cai na fatura seguinte); no mensal, cada mês é uma nova compra.
 */
export function datasDaCompra(dataCompra: string, r: Recorrencia): string[] {
  if (r.frequencia === 'parcelado') {
    return datasDaRecorrencia(dataCompra, { ...r, frequencia: 'mensal', termino: 'quantidade', quantidade: r.parcelas })
  }
  return datasDaRecorrencia(dataCompra, r)
}

/** Cria a compra (e as parcelas ou repetições), cada uma ligada à sua fatura. Devolve os ids em ordem. */
export async function criarCompra(d: DadosCompra, r: Recorrencia): Promise<string[]> {
  const cartao = await regraDoCartao(d.cartao_id)
  let recorrenciaId: string | null = null
  if (r.frequencia !== 'nenhuma') {
    const { data, error } = await supabase.from('recorrencias').insert({
      frequencia: r.frequencia,
      total_parcelas: r.frequencia === 'parcelado' ? r.parcelas : null,
      data_inicio: d.data_compra,
      data_fim: r.frequencia !== 'parcelado' && r.termino === 'data' ? r.dataFim : null,
      quantidade: r.frequencia !== 'parcelado' && r.termino === 'quantidade' ? r.quantidade : null
    }).select('id').single()
    if (error || !data) throw error
    recorrenciaId = data.id
  }

  const datas = datasDaCompra(d.data_compra, r)
  const valores = r.frequencia === 'parcelado' ? dividirParcelas(d.valor, r.parcelas) : datas.map(() => d.valor)
  const linhas: Record<string, unknown>[] = []
  for (let i = 0; i < datas.length; i++) {
    const fatura = await obterFatura(cartao, r.frequencia === 'parcelado' ? dataDaParcela(cartao, d.data_compra, i) : datas[i])
    linhas.push({
      tipo: 'despesa_cartao', descricao: d.descricao, valor: valores[i],
      data_lancamento: r.frequencia === 'parcelado' ? d.data_compra : datas[i],
      data_vencimento: fatura.data_vencimento, efetivado: false,
      categoria_id: d.categoria_id, cartao_id: d.cartao_id, conta_id: null, fatura_id: fatura.id,
      recorrencia_id: recorrenciaId, parcela_numero: r.frequencia === 'parcelado' ? i + 1 : null,
      observacao: d.observacao || null
    })
  }
  const { data: criados, error } = await supabase.from('lancamentos').insert(linhas).select('id, data_vencimento, parcela_numero')
  if (error) throw error
  const ids = [...(criados ?? [])]
    .sort((a, b) => (a.parcela_numero ?? 0) - (b.parcela_numero ?? 0) || a.data_vencimento.localeCompare(b.data_vencimento))
    .map(c => c.id)
  await gravarTags(ids, d.tags)
  return ids
}

export interface CompraOriginal {
  id: string
  recorrencia_id: string | null
  data_vencimento: string
  data_lancamento: string
  cartao_id: string | null
  parcela_numero: number | null
}

/**
 * Salva a edição. Descrição, valor, categoria, observação e tags valem para o
 * escopo; data da compra e cartão mudam só neste (e a fatura é recalculada).
 */
export async function atualizarCompra(o: CompraOriginal, d: DadosCompra, escopo: Escopo) {
  let ids = [o.id]
  if (o.recorrencia_id && escopo !== 'este') {
    let q = supabase.from('lancamentos').select('id').eq('recorrencia_id', o.recorrencia_id)
    if (escopo === 'proximos') q = q.gte('data_vencimento', o.data_vencimento)
    const { data, error } = await q
    if (error) throw error
    ids = (data ?? []).map(x => x.id)
  }
  const r1 = await supabase.from('lancamentos').update({
    descricao: d.descricao, valor: d.valor, categoria_id: d.categoria_id, observacao: d.observacao || null
  }).in('id', ids)
  if (r1.error) throw r1.error

  if (d.data_compra !== o.data_lancamento || d.cartao_id !== o.cartao_id) {
    const cartao = await regraDoCartao(d.cartao_id)
    // Numa parcela, a fatura segue a posição dela: parcela n cai n−1 faturas depois da compra.
    const fatura = await obterFatura(cartao, dataDaParcela(cartao, d.data_compra, (o.parcela_numero ?? 1) - 1))
    const r2 = await supabase.from('lancamentos').update({
      data_lancamento: d.data_compra, cartao_id: d.cartao_id, fatura_id: fatura.id, data_vencimento: fatura.data_vencimento
    }).eq('id', o.id)
    if (r2.error) throw r2.error
  }
  await gravarTags(ids, d.tags)
}

/** Gera as próximas repetições mensais de uma compra no cartão sem data para acabar. */
export async function estenderCompraMensal(recorrenciaId: string, dataInicio: string, ultimo: {
  id: string; descricao: string; valor: number; data_lancamento: string; categoria_id: string | null; cartao_id: string; observacao: string | null
}) {
  const cartao = await regraDoCartao(ultimo.cartao_id)
  const novas = datasDaRecorrencia(dataInicio, { frequencia: 'mensal', parcelas: 0, termino: 'nunca', quantidade: 0, dataFim: '' })
    .filter(d => d > ultimo.data_lancamento)
  if (!novas.length) return
  const linhas: Record<string, unknown>[] = []
  for (const d of novas) {
    const f = await obterFatura(cartao, d)
    linhas.push({
      tipo: 'despesa_cartao', descricao: ultimo.descricao, valor: ultimo.valor, data_lancamento: d,
      data_vencimento: f.data_vencimento, efetivado: false, categoria_id: ultimo.categoria_id,
      cartao_id: ultimo.cartao_id, conta_id: null, fatura_id: f.id, recorrencia_id: recorrenciaId, observacao: ultimo.observacao
    })
  }
  const { data: criados } = await supabase.from('lancamentos').insert(linhas).select('id')
  const { data: tags } = await supabase.from('lancamento_tags').select('tag_id').eq('lancamento_id', ultimo.id)
  await gravarTags((criados ?? []).map(c => c.id), (tags ?? []).map(t => t.tag_id))
}

export interface ItemFatura {
  id: string
  descricao: string
  valor: number
  data_lancamento: string
  categoria_id: string | null
  parcela_numero: number | null
  total_parcelas: number | null
  frequencia: string | null
}

/** Fatura de um cartão num mês (pode não existir ainda) e as compras dela. */
export async function carregarFatura(cartaoId: string, mesReferencia: string) {
  const { data: fatura } = await supabase.from('faturas')
    .select('id, cartao_id, mes_referencia, data_fechamento, data_vencimento, situacao, valor_pago')
    .eq('cartao_id', cartaoId).eq('mes_referencia', mesReferencia).maybeSingle()
  if (!fatura) return { fatura: null, itens: [] as ItemFatura[] }
  const { data, error } = await supabase.from('lancamentos')
    .select('id, descricao, valor, data_lancamento, categoria_id, parcela_numero, recorrencia:recorrencias(frequencia, total_parcelas)')
    .eq('fatura_id', fatura.id).order('data_lancamento', { ascending: false }).order('criado_em', { ascending: false })
  if (error) throw error
  const itens: ItemFatura[] = ((data ?? []) as unknown as Record<string, any>[]).map(l => {
    const rec = Array.isArray(l.recorrencia) ? l.recorrencia[0] : l.recorrencia
    return {
      id: l.id, descricao: l.descricao, valor: Number(l.valor), data_lancamento: l.data_lancamento,
      categoria_id: l.categoria_id, parcela_numero: l.parcela_numero,
      total_parcelas: rec?.total_parcelas ?? null, frequencia: rec?.frequencia ?? null
    }
  })
  return { fatura: { ...fatura, valor_pago: Number(fatura.valor_pago) } as Fatura, itens }
}
