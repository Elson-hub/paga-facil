import { supabase } from './supabase'
import { dataNoMes, deIso, paraIso, hojeIso } from './datas'
import { apagarArquivosDos } from './anexos'

export type TipoLancamento = 'receita' | 'despesa'
export type Frequencia = 'nenhuma' | 'semanal' | 'mensal' | 'anual' | 'parcelado'
export type Termino = 'nunca' | 'quantidade' | 'data'
export type Escopo = 'este' | 'proximos' | 'todos'

export interface Recorrencia {
  frequencia: Frequencia
  parcelas: number          // usado no parcelado
  termino: Termino          // usado em semanal/mensal/anual
  quantidade: number        // quantas vezes, quando termino = 'quantidade'
  dataFim: string           // quando termino = 'data'
}

export interface DadosLancamento {
  tipo: TipoLancamento
  descricao: string
  valor: number             // no parcelado, é o valor TOTAL
  data_lancamento: string
  data_vencimento: string
  efetivado: boolean
  data_efetivacao: string | null
  categoria_id: string | null
  conta_id: string
  observacao: string
  tags: string[]
}

export interface Lancamento {
  id: string
  tipo: TipoLancamento
  descricao: string
  valor: number
  data_lancamento: string
  data_vencimento: string
  efetivado: boolean
  data_efetivacao: string | null
  categoria_id: string | null
  conta_id: string | null
  cartao_id?: string | null
  fatura_id?: string | null
  recorrencia_id: string | null
  parcela_numero: number | null
  observacao: string | null
  recorrencia?: { frequencia: Frequencia; total_parcelas: number | null; data_fim: string | null; quantidade: number | null } | null
  tags?: string[]
}

/** Quantos meses à frente as recorrências sem fim ficam geradas. */
const HORIZONTE_MESES = 12

/** Data da n-ésima ocorrência (n = 0 é a primeira), sempre calculada a partir do início. */
export function dataDaOcorrencia(inicio: string, frequencia: Frequencia, n: number): string {
  const d = deIso(inicio)
  if (frequencia === 'semanal') return paraIso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * n))
  if (frequencia === 'anual') return paraIso(dataNoMes(d.getFullYear() + n, d.getMonth(), d.getDate()))
  return paraIso(dataNoMes(d.getFullYear(), d.getMonth() + n, d.getDate())) // mensal e parcelado
}

/** Divide um total em parcelas; a diferença de centavos fica na primeira. */
export function dividirParcelas(total: number, parcelas: number): number[] {
  const centavos = Math.round(total * 100)
  const base = Math.floor(centavos / parcelas)
  const resto = centavos - base * parcelas
  return Array.from({ length: parcelas }, (_, i) => (base + (i === 0 ? resto : 0)) / 100)
}

/** Datas que devem existir para uma recorrência, até o limite (fim, quantidade ou horizonte). */
export function datasDaRecorrencia(inicio: string, r: Recorrencia, aPartirDe = 0): string[] {
  if (r.frequencia === 'nenhuma') return [inicio]
  if (r.frequencia === 'parcelado') return Array.from({ length: r.parcelas }, (_, i) => dataDaOcorrencia(inicio, 'parcelado', i))
  const limite = r.termino === 'data' ? r.dataFim
    : r.termino === 'nunca' ? paraIso(dataNoMes(new Date().getFullYear(), new Date().getMonth() + HORIZONTE_MESES, new Date().getDate()))
    : null
  const maxVezes = r.termino === 'quantidade' ? r.quantidade : 1000
  const datas: string[] = []
  for (let n = aPartirDe; n < maxVezes; n++) {
    const d = dataDaOcorrencia(inicio, r.frequencia, n)
    if (limite && d > limite) break
    datas.push(d)
  }
  return datas
}

async function gravarTags(ids: string[], tags: string[]) {
  if (!ids.length) return
  const del = await supabase.from('lancamento_tags').delete().in('lancamento_id', ids)
  if (del.error) throw del.error
  if (!tags.length) return
  const linhas = ids.flatMap(l => tags.map(t => ({ lancamento_id: l, tag_id: t })))
  const ins = await supabase.from('lancamento_tags').insert(linhas)
  if (ins.error) throw ins.error
}

/** Cria um lançamento (e todas as ocorrências, se for recorrente ou parcelado). */
/** Cria e devolve os ids, em ordem (o primeiro é o lançamento informado). */
export async function criarLancamento(d: DadosLancamento, r: Recorrencia): Promise<string[]> {
  let recorrenciaId: string | null = null
  if (r.frequencia !== 'nenhuma') {
    const { data, error } = await supabase.from('recorrencias').insert({
      frequencia: r.frequencia,
      total_parcelas: r.frequencia === 'parcelado' ? r.parcelas : null,
      data_inicio: d.data_vencimento,
      data_fim: r.frequencia !== 'parcelado' && r.termino === 'data' ? r.dataFim : null,
      quantidade: r.frequencia !== 'parcelado' && r.termino === 'quantidade' ? r.quantidade : null
    }).select('id').single()
    if (error || !data) throw error
    recorrenciaId = data.id
  }

  const datas = datasDaRecorrencia(d.data_vencimento, r)
  const valores = r.frequencia === 'parcelado' ? dividirParcelas(d.valor, r.parcelas) : datas.map(() => d.valor)
  // Parcelado: todas as parcelas têm a data da compra. Recorrente: cada
  // ocorrência mantém a mesma distância entre lançamento e vencimento.
  const distancia = Math.round((deIso(d.data_vencimento).getTime() - deIso(d.data_lancamento).getTime()) / 864e5)
  const lancDe = (venc: string) => {
    if (r.frequencia === 'parcelado') return d.data_lancamento
    const x = deIso(venc); x.setDate(x.getDate() - distancia); return paraIso(x)
  }
  const linhas = datas.map((data, i) => ({
    tipo: d.tipo,
    descricao: d.descricao,
    valor: valores[i],
    data_lancamento: i === 0 ? d.data_lancamento : lancDe(data),
    data_vencimento: data,
    // Só a primeira ocorrência pode já nascer efetivada.
    efetivado: i === 0 ? d.efetivado : false,
    data_efetivacao: i === 0 && d.efetivado ? d.data_efetivacao : null,
    categoria_id: d.categoria_id,
    conta_id: d.conta_id,
    recorrencia_id: recorrenciaId,
    parcela_numero: r.frequencia === 'parcelado' ? i + 1 : null,
    observacao: d.observacao || null
  }))
  const { data: criados, error } = await supabase.from('lancamentos').insert(linhas).select('id, data_vencimento')
  if (error) throw error
  const ids = [...(criados ?? [])].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)).map(c => c.id)
  await gravarTags(ids, d.tags)
  return ids
}

/** Ids afetados por uma edição/exclusão conforme o escopo escolhido. */
async function idsDoEscopo(l: Lancamento, escopo: Escopo): Promise<string[]> {
  if (escopo === 'este' || !l.recorrencia_id) return [l.id]
  let q = supabase.from('lancamentos').select('id').eq('recorrencia_id', l.recorrencia_id)
  if (escopo === 'proximos') q = q.gte('data_vencimento', l.data_vencimento)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map(x => x.id)
}

/** Salva a edição. Data e situação mudam só no próprio lançamento; o resto vale para o escopo. */
export async function atualizarLancamento(original: Lancamento, d: DadosLancamento, escopo: Escopo) {
  const comum = {
    descricao: d.descricao, valor: d.valor, categoria_id: d.categoria_id,
    conta_id: d.conta_id, observacao: d.observacao || null
  }
  const ids = await idsDoEscopo(original, escopo)
  const r1 = await supabase.from('lancamentos').update(comum).in('id', ids)
  if (r1.error) throw r1.error
  const r2 = await supabase.from('lancamentos').update({
    data_lancamento: d.data_lancamento, data_vencimento: d.data_vencimento, efetivado: d.efetivado,
    data_efetivacao: d.efetivado ? d.data_efetivacao : null
  }).eq('id', original.id)
  if (r2.error) throw r2.error
  await gravarTags(ids, d.tags)
}

/** Exclui conforme o escopo. Ao excluir "este e os próximos", a recorrência para de gerar novos. */
export async function excluirLancamento(l: Lancamento, escopo: Escopo) {
  const ids = await idsDoEscopo(l, escopo)
  await apagarArquivosDos(ids)
  const { error } = await supabase.from('lancamentos').delete().in('id', ids)
  if (error) throw error
  if (!l.recorrencia_id || escopo === 'este') return
  if (escopo === 'todos') {
    await supabase.from('recorrencias').delete().eq('id', l.recorrencia_id)
  } else {
    const ontem = deIso(l.data_vencimento); ontem.setDate(ontem.getDate() - 1)
    await supabase.from('recorrencias').update({ data_fim: paraIso(ontem), quantidade: null }).eq('id', l.recorrencia_id)
  }
}

/** Marca/desmarca como pago (despesa) ou recebido (receita). */
export async function alternarEfetivado(l: Pick<Lancamento, 'id' | 'efetivado' | 'data_vencimento'>) {
  const hoje = hojeIso()
  const efetivar = !l.efetivado
  const { error } = await supabase.from('lancamentos').update({
    efetivado: efetivar,
    data_efetivacao: efetivar ? (l.data_vencimento < hoje ? l.data_vencimento : hoje) : null
  }).eq('id', l.id)
  if (error) throw error
}

const CAMPOS = 'id, tipo, descricao, valor, data_lancamento, data_vencimento, efetivado, data_efetivacao, categoria_id, conta_id, cartao_id, fatura_id, recorrencia_id, parcela_numero, observacao, recorrencia:recorrencias(frequencia, total_parcelas, data_fim, quantidade)'

export async function buscarLancamento(id: string): Promise<Lancamento> {
  const [{ data, error }, tags] = await Promise.all([
    supabase.from('lancamentos').select(CAMPOS).eq('id', id).single(),
    supabase.from('lancamento_tags').select('tag_id').eq('lancamento_id', id)
  ])
  if (error || !data) throw error
  return { ...(data as unknown as Lancamento), valor: Number(data.valor), tags: (tags.data ?? []).map(t => t.tag_id) }
}

/** Receitas e despesas (não de cartão) com vencimento no mês. */
export async function listarDoMes(inicio: string, fim: string): Promise<Lancamento[]> {
  const { data, error } = await supabase.from('lancamentos').select(CAMPOS)
    .in('tipo', ['receita', 'despesa']).gte('data_vencimento', inicio).lt('data_vencimento', fim)
    .order('data_vencimento').order('criado_em')
  if (error) throw error
  return (data ?? []).map(l => ({ ...(l as unknown as Lancamento), valor: Number(l.valor) }))
}

let extensao: Promise<void> | null = null
/**
 * Recorrências sem fim: garante lançamentos gerados até 12 meses à frente.
 * Roda uma vez por abertura do app.
 */
export function estenderRecorrencias(): Promise<void> {
  if (!extensao) extensao = (async () => {
    const { data: recs } = await supabase.from('recorrencias').select('id, frequencia, data_inicio')
      .is('data_fim', null).is('quantidade', null).neq('frequencia', 'parcelado')
    for (const r of recs ?? []) {
      const { data: ultimo } = await supabase.from('lancamentos')
        .select('id, tipo, descricao, valor, data_lancamento, data_vencimento, categoria_id, conta_id, cartao_id, observacao')
        .eq('recorrencia_id', r.id).order('data_vencimento', { ascending: false }).limit(1).maybeSingle()
      if (!ultimo) continue
      if (ultimo.tipo === 'despesa_cartao') {
        const { estenderCompraMensal } = await import('./compras')
        await estenderCompraMensal(r.id, r.data_inicio, ultimo)
        continue
      }
      const rec: Recorrencia = { frequencia: r.frequencia, parcelas: 0, termino: 'nunca', quantidade: 0, dataFim: '' }
      const novas = datasDaRecorrencia(r.data_inicio, rec).filter(d => d > ultimo.data_vencimento)
      if (!novas.length) continue
      const { data: tags } = await supabase.from('lancamento_tags').select('tag_id').eq('lancamento_id', ultimo.id)
      const { data: criados } = await supabase.from('lancamentos').insert(novas.map(d => ({
        tipo: ultimo.tipo, descricao: ultimo.descricao, valor: ultimo.valor, data_lancamento: d, data_vencimento: d,
        efetivado: false, categoria_id: ultimo.categoria_id, conta_id: ultimo.conta_id,
        recorrencia_id: r.id, observacao: ultimo.observacao
      }))).select('id')
      await gravarTags((criados ?? []).map(c => c.id), (tags ?? []).map(t => t.tag_id))
    }
  })().catch(() => { extensao = null })
  return extensao
}

/** Texto curto da recorrência, ex.: "Parcela 3 de 10", "Mensal". */
export function rotuloRecorrencia(l: Lancamento) {
  const r = l.recorrencia
  if (!r) return ''
  if (r.frequencia === 'parcelado') return `Parcela ${l.parcela_numero} de ${r.total_parcelas}`
  return { semanal: 'Semanal', mensal: 'Mensal', anual: 'Anual' }[r.frequencia as 'semanal' | 'mensal' | 'anual'] ?? ''
}
