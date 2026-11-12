import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconChevronLeft, IconChevronRight, IconCircle, IconCircleCheckFilled, IconRepeat, IconReceipt, IconPaperclip } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import BotaoMais from '../componentes/BotaoMais'
import { supabase } from '../lib/supabase'
import { reais, nomeDoMes, somarMeses } from '../lib/formato'
import { paraIso, hojeIso, diaAmigavel } from '../lib/datas'
import { IconeCategoria } from '../lib/categorias'
import { lancamentosComAnexo } from '../lib/anexos'
import { listarDoMes, alternarEfetivado, estenderRecorrencias, rotuloRecorrencia, type Lancamento } from '../lib/lancamentos'

type FiltroTipo = 'todos' | 'receita' | 'despesa'
type FiltroSituacao = 'todas' | 'pendente' | 'efetivada'

interface InfoCategoria { nome: string; icone: string | null; cor: string | null; principal?: string }

function mesDoParametro(p: string | null) {
  if (p && /^\d{4}-\d{2}$/.test(p)) { const [a, m] = p.split('-').map(Number); return new Date(a, m - 1, 1) }
  return somarMeses(new Date(), 0)
}

export default function Lancamentos() {
  const [parametros, setParametros] = useSearchParams()
  const mes = mesDoParametro(parametros.get('mes'))
  const tipo = (parametros.get('tipo') as FiltroTipo) || 'todos'
  const situacao = (parametros.get('situacao') as FiltroSituacao) || 'todas'
  const ir = useNavigate()

  const [lista, setLista] = useState<Lancamento[] | null>(null)
  const [categorias, setCategorias] = useState<Map<string, InfoCategoria>>(new Map())
  const [contas, setContas] = useState<Map<string, string>>(new Map())
  const [erro, setErro] = useState('')
  const [comAnexo, setComAnexo] = useState<Set<string>>(new Set())

  const mudar = (novos: Record<string, string>) => {
    const p = new URLSearchParams(parametros)
    for (const [k, v] of Object.entries(novos)) p.set(k, v)
    setParametros(p, { replace: true })
  }
  const chaveMes = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    supabase.from('categorias').select('id, nome, icone, cor, categoria_pai_id').then(({ data }) => {
      const porId = new Map((data ?? []).map(c => [c.id, c]))
      const m = new Map<string, InfoCategoria>()
      for (const c of data ?? []) {
        const pai = c.categoria_pai_id ? porId.get(c.categoria_pai_id) : null
        m.set(c.id, pai ? { nome: c.nome, icone: pai.icone, cor: pai.cor, principal: pai.nome } : { nome: c.nome, icone: c.icone, cor: c.cor })
      }
      setCategorias(m)
    })
    supabase.from('contas').select('id, descricao').then(({ data }) => setContas(new Map((data ?? []).map(c => [c.id, c.descricao]))))
  }, [])

  const carregar = useCallback(async () => {
    setErro('')
    try {
      await estenderRecorrencias()
      const l = await listarDoMes(paraIso(mes), paraIso(somarMeses(mes, 1)))
      setLista(l)
      lancamentosComAnexo(l.map(x => x.id)).then(setComAnexo).catch(() => {})
    } catch { setErro('Não foi possível carregar os lançamentos.') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveMes])

  useEffect(() => { setLista(null); carregar() }, [carregar])

  async function alternar(l: Lancamento) {
    setLista(ls => ls?.map(x => x.id === l.id ? { ...x, efetivado: !x.efetivado } : x) ?? null)
    try { await alternarEfetivado(l) } catch { setErro('Não foi possível atualizar.'); carregar() }
  }

  const hoje = hojeIso()
  const filtrada = useMemo(() => (lista ?? []).filter(l =>
    (tipo === 'todos' || l.tipo === tipo) &&
    (situacao === 'todas' || (situacao === 'pendente' ? !l.efetivado : l.efetivado))
  ), [lista, tipo, situacao])

  const totais = useMemo(() => {
    let rec = 0, desp = 0
    for (const l of filtrada) { if (l.tipo === 'receita') rec += l.valor; else desp += l.valor }
    return { rec, desp }
  }, [filtrada])

  const porDia = useMemo(() => {
    const g = new Map<string, Lancamento[]>()
    for (const l of filtrada) { if (!g.has(l.data_vencimento)) g.set(l.data_vencimento, []); g.get(l.data_vencimento)!.push(l) }
    return [...g.entries()]
  }, [filtrada])

  return (
    <>
      <Topo centro={
        <div className="seletor-mes">
          <button className="icone-btn" aria-label="Mês anterior" onClick={() => mudar({ mes: chaveDe(somarMeses(mes, -1)) })}><IconChevronLeft /></button>
          <strong>{nomeDoMes(mes)}</strong>
          <button className="icone-btn" aria-label="Próximo mês" onClick={() => mudar({ mes: chaveDe(somarMeses(mes, 1)) })}><IconChevronRight /></button>
        </div>
      } />
      <div className="pagina">
        <div className="filtros">
          <div className="segmentos">
            {(['todos', 'receita', 'despesa'] as FiltroTipo[]).map(t => (
              <button key={t} className={tipo === t ? 'ativo' : ''} onClick={() => mudar({ tipo: t })}>
                {{ todos: 'Todos', receita: 'Receitas', despesa: 'Despesas' }[t]}
              </button>
            ))}
          </div>
          <div className="segmentos">
            {(['todas', 'pendente', 'efetivada'] as FiltroSituacao[]).map(s => (
              <button key={s} className={situacao === s ? 'ativo' : ''} onClick={() => mudar({ situacao: s })}>
                {{ todas: 'Todas', pendente: 'Pendentes', efetivada: 'Pagas/recebidas' }[s]}
              </button>
            ))}
          </div>
        </div>

        <section className="cartao totais-lanc">
          {tipo !== 'despesa' && <div><small>Receitas</small><strong style={{ color: 'var(--receita)' }}>{reais(totais.rec)}</strong></div>}
          {tipo !== 'receita' && <div><small>Despesas</small><strong style={{ color: 'var(--despesa)' }}>{reais(totais.desp)}</strong></div>}
          {tipo === 'todos' && <div><small>Saldo</small><strong className={totais.rec - totais.desp < 0 ? 'negativo' : ''}>{reais(totais.rec - totais.desp)}</strong></div>}
        </section>

        {erro && <p className="erro">{erro}</p>}
        {!lista && !erro && <p className="aviso">Carregando…</p>}
        {lista && filtrada.length === 0 && (
          <section className="cartao vazio">
            <IconReceipt size={32} />
            <strong>Nenhum lançamento</strong>
            <span>Toque no + para lançar uma receita ou despesa.</span>
          </section>
        )}

        {porDia.map(([dia, itens]) => (
          <section key={dia} className="grupo-dia">
            <h3>{diaAmigavel(dia)}</h3>
            <div className="cartao lista">
              {itens.map(l => {
                const cat = l.categoria_id ? categorias.get(l.categoria_id) : undefined
                const atrasado = !l.efetivado && l.data_vencimento < hoje
                const rec = rotuloRecorrencia(l)
                const anexo = comAnexo.has(l.id)
                return (
                  <div key={l.id} className="item-lanc">
                    <button className="item-lista" onClick={() => ir(`/lancamentos/${l.id}`)}>
                      <IconeCategoria icone={cat?.icone ?? null} cor={cat?.cor ?? null} />
                      <span className="nome">
                        {l.descricao}
                        <small>
                          {cat ? (cat.principal ? `${cat.principal} › ${cat.nome}` : cat.nome) : 'Sem categoria'}
                          {l.conta_id && contas.get(l.conta_id) ? ` · ${contas.get(l.conta_id)}` : ''}
                        </small>
                        {(rec || atrasado || anexo) && (
                          <span className="marcadores">
                            {rec && <span className="marcador"><IconRepeat size={12} />{rec}</span>}
                            {anexo && <span className="marcador"><IconPaperclip size={12} />Anexo</span>}
                            {atrasado && <span className="marcador atrasado">Atrasada</span>}
                          </span>
                        )}
                      </span>
                      <span className="valor" style={{ color: l.tipo === 'receita' ? 'var(--receita)' : 'var(--despesa)' }}>
                        {l.tipo === 'despesa' ? '−' : '+'} {reais(l.valor)}
                      </span>
                    </button>
                    <button className={`check-efetivar ${l.efetivado ? 'feito' : ''}`} onClick={() => alternar(l)}
                      aria-label={l.efetivado ? `Marcar ${l.descricao} como pendente` : `Marcar ${l.descricao} como ${l.tipo === 'receita' ? 'recebida' : 'paga'}`}
                      title={l.efetivado ? (l.tipo === 'receita' ? 'Recebida' : 'Paga') : 'Pendente'}>
                      {l.efetivado
                        ? <IconCircleCheckFilled size={26} color={l.tipo === 'receita' ? 'var(--receita)' : 'var(--despesa)'} />
                        : <IconCircle size={26} color="var(--texto-3)" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <BotaoMais />
    </>
  )
}

const chaveDe = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
