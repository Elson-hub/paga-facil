import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { IconArrowLeft, IconChevronLeft, IconChevronRight, IconPencil, IconPlus, IconReceipt, IconRepeat } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { supabase } from '../lib/supabase'
import { reais } from '../lib/formato'
import { dataBr, hojeIso, paraIso, dataNoMes } from '../lib/datas'
import { IconeCategoria } from '../lib/categorias'
import { type Cartao } from '../lib/cartoes'
import { carregarFatura, faturaDaCompra, type Fatura as TFatura, type ItemFatura } from '../lib/compras'
import { estenderRecorrencias } from '../lib/lancamentos'

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const chave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

interface InfoCategoria { nome: string; icone: string | null; cor: string | null; principal?: string }

export default function Fatura() {
  const { id } = useParams()
  const [parametros, setParametros] = useSearchParams()
  const ir = useNavigate()

  const [cartao, setCartao] = useState<Cartao | null>(null)
  const [fatura, setFatura] = useState<TFatura | null>(null)
  const [itens, setItens] = useState<ItemFatura[] | null>(null)
  const [categorias, setCategorias] = useState<Map<string, InfoCategoria>>(new Map())
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('cartoes').select('id, nome, bandeira, limite, conta_pagamento_id, dia_fechamento, tipo_vencimento, dia_vencimento, dias_apos_fechamento, cor, ativo')
      .eq('id', id).single().then(({ data, error }) => {
        if (error || !data) setErro('Cartão não encontrado.')
        else setCartao({ ...data, limite: Number(data.limite) } as Cartao)
      })
    supabase.from('categorias').select('id, nome, icone, cor, categoria_pai_id').then(({ data }) => {
      const porId = new Map((data ?? []).map(c => [c.id, c] as [string, typeof c]))
      const m = new Map<string, InfoCategoria>()
      for (const c of data ?? []) {
        const pai = c.categoria_pai_id ? porId.get(c.categoria_pai_id) : null
        m.set(c.id, pai ? { nome: c.nome, icone: pai.icone, cor: pai.cor, principal: pai.nome } : { nome: c.nome, icone: c.icone, cor: c.cor })
      }
      setCategorias(m)
    })
  }, [id])

  // Mês da fatura: o do link, ou a fatura aberta hoje.
  const mesRef = useMemo(() => {
    const p = parametros.get('mes')
    if (p && /^\d{4}-\d{2}$/.test(p)) return `${p}-01`
    return cartao ? faturaDaCompra(cartao, hojeIso()).mes_referencia : null
  }, [parametros, cartao])

  // Datas desta fatura, mesmo que ela ainda não exista no banco.
  const datas = useMemo(() => {
    if (!cartao || !mesRef) return null
    const [a, m] = mesRef.split('-').map(Number)
    return faturaDaCompra(cartao, paraIso(dataNoMes(a, m - 1, cartao.dia_fechamento)))
  }, [cartao, mesRef])

  useEffect(() => {
    if (!id || !mesRef) return
    setItens(null)
    estenderRecorrencias()
      .then(() => carregarFatura(id, mesRef))
      .then(r => { setFatura(r.fatura); setItens(r.itens) })
      .catch(() => setErro('Não foi possível carregar a fatura.'))
  }, [id, mesRef])

  function mudarMes(delta: number) {
    if (!mesRef) return
    const [a, m] = mesRef.split('-').map(Number)
    setParametros({ mes: chave(new Date(a, m - 1 + delta, 1)) }, { replace: true })
  }

  const total = (itens ?? []).reduce((s, i) => s + i.valor, 0)
  const hoje = hojeIso()
  const situacao = fatura?.situacao === 'paga' ? 'Paga'
    : fatura?.situacao === 'paga_parcial' ? 'Paga em parte'
    : datas && hoje > datas.data_fechamento ? (hoje > datas.data_vencimento ? 'Vencida' : 'Fechada') : 'Aberta'
  const corSituacao = situacao === 'Paga' ? 'var(--receita)' : situacao === 'Vencida' ? 'var(--despesa)' : situacao === 'Fechada' ? '#E5A50A' : 'var(--principal)'

  const voltar = <button className="icone-btn" aria-label="Voltar" onClick={() => ir('/cartoes')}><IconArrowLeft size={22} /></button>
  const editar = <button className="icone-btn" aria-label="Editar cartão" onClick={() => ir(`/cartoes/${id}`)}><IconPencil size={20} /></button>
  const [anoRef, mesNum] = (mesRef ?? '0000-01').split('-').map(Number)

  return (
    <>
      <div className="cabecalho-fatura" style={{ background: cartao?.cor || 'var(--principal)' }}>
        <Topo titulo={cartao?.nome ?? 'Fatura'} esquerda={voltar} direita={editar} />
        <div className="seletor-mes">
          <button className="icone-btn" aria-label="Fatura anterior" onClick={() => mudarMes(-1)}><IconChevronLeft /></button>
          <strong>Fatura de {MESES[mesNum - 1]}{anoRef !== new Date().getFullYear() ? ` ${anoRef}` : ''}</strong>
          <button className="icone-btn" aria-label="Próxima fatura" onClick={() => mudarMes(1)}><IconChevronRight /></button>
        </div>
        <div className="fatura-total">
          <small>Total da fatura</small>
          <strong>{reais(total)}</strong>
          <span className="selo-situacao" style={{ color: corSituacao }}>{situacao}</span>
        </div>
      </div>

      <div className="pagina sobe-pouco">
        {erro && <p className="erro">{erro}</p>}
        {datas && (
          <section className="cartao datas-fatura">
            <div><small>Fecha em</small><strong>{dataBr(datas.data_fechamento)}</strong></div>
            <div><small>Vence em</small><strong>{dataBr(datas.data_vencimento)}</strong></div>
            {fatura && fatura.valor_pago > 0 && <div><small>Pago</small><strong style={{ color: 'var(--receita)' }}>{reais(fatura.valor_pago)}</strong></div>}
          </section>
        )}

        {!itens && !erro && <p className="aviso">Carregando…</p>}
        {itens && itens.length === 0 && (
          <section className="cartao vazio">
            <IconReceipt size={32} />
            <strong>Nenhuma compra nesta fatura</strong>
            <span>Toque no + para lançar uma despesa neste cartão.</span>
          </section>
        )}

        {itens && itens.length > 0 && (
          <section className="cartao lista">
            {itens.map(i => {
              const cat = i.categoria_id ? categorias.get(i.categoria_id) : undefined
              const selo = i.parcela_numero && i.total_parcelas ? `${i.parcela_numero}/${i.total_parcelas}` : i.frequencia === 'mensal' ? 'Mensal' : ''
              return (
                <button key={i.id} className="item-lista" onClick={() => ir(`/compras/${i.id}`)}>
                  <IconeCategoria icone={cat?.icone ?? null} cor={cat?.cor ?? null} />
                  <span className="nome">
                    {i.descricao}
                    <small>{dataBr(i.data_lancamento)} · {cat ? (cat.principal ? `${cat.principal} › ${cat.nome}` : cat.nome) : 'Sem categoria'}</small>
                    {selo && <span className="marcadores"><span className="marcador"><IconRepeat size={12} />{selo}</span></span>}
                  </span>
                  <span className="valor" style={{ color: 'var(--despesa)' }}>{reais(i.valor)}</span>
                </button>
              )
            })}
          </section>
        )}
      </div>
      <button className="fab" aria-label="Nova despesa no cartão" onClick={() => ir(`/novo/despesa-cartao?cartao=${id}`)}><IconPlus size={28} /></button>
    </>
  )
}
