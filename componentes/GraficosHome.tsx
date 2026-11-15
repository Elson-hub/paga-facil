import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { reais } from '../lib/formato'
import { paraIso } from '../lib/datas'
import { somarMeses } from '../lib/formato'

interface Linha { tipo: string; valor: number; categoria_id: string | null }
interface Cat { id: string; nome: string; cor: string | null; categoria_pai_id: string | null }

const pct = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : 0)
const MAX_CATEGORIAS = 7

/** Rosca em SVG: cada fatia é um arco desenhado com stroke-dasharray. */
function Rosca({ fatias, centro, legendaCentro }: {
  fatias: { valor: number; cor: string; nome: string }[]; centro: string; legendaCentro: string
}) {
  const total = fatias.reduce((s, f) => s + f.valor, 0)
  const r = 46, c = 2 * Math.PI * r
  let acumulado = 0
  return (
    <svg viewBox="0 0 120 120" className="rosca" role="img"
      aria-label={fatias.map(f => `${f.nome}: ${reais(f.valor)} (${pct(f.valor, total)}%)`).join(', ')}>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--superficie-2)" strokeWidth="16" />
      {total > 0 && fatias.filter(f => f.valor > 0).map(f => {
        const tam = (f.valor / total) * c
        const el = (
          <circle key={f.nome} cx="60" cy="60" r={r} fill="none" stroke={f.cor} strokeWidth="16"
            strokeDasharray={`${Math.max(0, tam - 1.5)} ${c}`} strokeDashoffset={-acumulado}
            transform="rotate(-90 60 60)" />
        )
        acumulado += tam
        return el
      })}
      <text x="60" y="57" textAnchor="middle" className="rosca-legenda">{legendaCentro}</text>
      <text x="60" y="73" textAnchor="middle" className="rosca-valor">{centro}</text>
    </svg>
  )
}

export default function GraficosHome({ mes }: { mes: Date }) {
  const [linhas, setLinhas] = useState<Linha[] | null>(null)
  const [cats, setCats] = useState<Map<string, Cat>>(new Map())
  const [tipoCat, setTipoCat] = useState<'despesa' | 'receita'>('despesa')

  useEffect(() => {
    supabase.from('categorias').select('id, nome, cor, categoria_pai_id')
      .then(({ data }) => setCats(new Map((data ?? []).map(c => [c.id, c as Cat] as [string, Cat]))))
  }, [])

  useEffect(() => {
    let vivo = true
    setLinhas(null)
    // Tudo que vence no mês: receitas, despesas e compras no cartão (pela fatura).
    // O "Saldo da fatura anterior" fica de fora para não contar o mesmo gasto duas vezes.
    supabase.from('lancamentos').select('tipo, valor, categoria_id, pagamento_origem_id')
      .gte('data_vencimento', paraIso(mes)).lt('data_vencimento', paraIso(somarMeses(mes, 1)))
      .then(({ data }) => {
        if (!vivo) return
        setLinhas(((data ?? []) as unknown as (Linha & { pagamento_origem_id: string | null })[])
          .filter(l => !l.pagamento_origem_id)
          .map(l => ({ tipo: l.tipo, valor: Number(l.valor), categoria_id: l.categoria_id })))
      })
    return () => { vivo = false }
  }, [mes])

  const receitas = (linhas ?? []).filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
  const despesas = (linhas ?? []).filter(l => l.tipo !== 'receita').reduce((s, l) => s + l.valor, 0)
  const saldo = receitas - despesas

  // Soma por categoria principal (subcategorias entram na categoria delas).
  const porCategoria = useMemo(() => {
    const soma = new Map<string, { nome: string; cor: string; valor: number }>()
    for (const l of linhas ?? []) {
      if (tipoCat === 'receita' ? l.tipo !== 'receita' : l.tipo === 'receita') continue
      let c = l.categoria_id ? cats.get(l.categoria_id) : undefined
      if (c?.categoria_pai_id) c = cats.get(c.categoria_pai_id) ?? c
      const chave = c?.id ?? 'sem'
      const atual = soma.get(chave) ?? { nome: c?.nome ?? 'Sem categoria', cor: c?.cor ?? '#888780', valor: 0 }
      atual.valor += l.valor
      soma.set(chave, atual)
    }
    const ordenado = [...soma.values()].sort((a, b) => b.valor - a.valor)
    if (ordenado.length <= MAX_CATEGORIAS) return ordenado
    const resto = ordenado.slice(MAX_CATEGORIAS - 1)
    return [...ordenado.slice(0, MAX_CATEGORIAS - 1),
      { nome: `Outras (${resto.length})`, cor: '#888780', valor: resto.reduce((s, x) => s + x.valor, 0) }]
  }, [linhas, cats, tipoCat])

  const totalCat = porCategoria.reduce((s, c) => s + c.valor, 0)
  const maiorCat = porCategoria[0]?.valor ?? 0

  return (
    <>
      <section className="cartao">
        <h2>Receitas × despesas</h2>
        {!linhas ? <p className="aviso">Carregando…</p> : receitas + despesas === 0 ? (
          <p className="aviso" style={{ marginTop: 8 }}>Nenhum lançamento neste mês.</p>
        ) : (
          <div className="grafico-rosca">
            <Rosca
              fatias={[{ nome: 'Receitas', valor: receitas, cor: 'var(--receita)' }, { nome: 'Despesas', valor: despesas, cor: 'var(--despesa)' }]}
              legendaCentro="Saldo" centro={reais(saldo)} />
            <ul className="legenda">
              <li><i style={{ background: 'var(--receita)' }} /><span>Receitas<small>{pct(receitas, receitas + despesas)}%</small></span><b>{reais(receitas)}</b></li>
              <li><i style={{ background: 'var(--despesa)' }} /><span>Despesas<small>{pct(despesas, receitas + despesas)}%</small></span><b>{reais(despesas)}</b></li>
              <li className="legenda-saldo"><span>{saldo >= 0 ? 'Sobra no mês' : 'Falta no mês'}</span><b className={saldo < 0 ? 'negativo' : ''}>{reais(saldo)}</b></li>
            </ul>
          </div>
        )}
        <small className="ajuda">Tudo que vence no mês, pago ou não. Compras no cartão entram pela fatura.</small>
      </section>

      <section className="cartao">
        <div className="titulo-grafico">
          <h2>Por categoria</h2>
          <div className="segmentos mini">
            <button className={tipoCat === 'despesa' ? 'ativo' : ''} onClick={() => setTipoCat('despesa')}>Despesas</button>
            <button className={tipoCat === 'receita' ? 'ativo' : ''} onClick={() => setTipoCat('receita')}>Receitas</button>
          </div>
        </div>
        {!linhas ? <p className="aviso">Carregando…</p> : porCategoria.length === 0 ? (
          <p className="aviso" style={{ marginTop: 8 }}>Nenhuma {tipoCat} neste mês.</p>
        ) : (
          <ul className="barras-cat">
            {porCategoria.map(c => (
              <li key={c.nome}>
                <div className="barras-cat-topo">
                  <span><i style={{ background: c.cor }} />{c.nome}</span>
                  <span><b>{reais(c.valor)}</b><small>{pct(c.valor, totalCat)}%</small></span>
                </div>
                <div className="barra"><i style={{ width: `${maiorCat > 0 ? (c.valor / maiorCat) * 100 : 0}%`, background: c.cor }} /></div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
