import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconRepeat } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import SeletorCategoria from '../componentes/SeletorCategoria'
import SeletorTags from '../componentes/SeletorTags'
import EscolhaEscopo from '../componentes/EscolhaEscopo'
import { supabase } from '../lib/supabase'
import { hojeIso, dataBr } from '../lib/datas'
import { reais } from '../lib/formato'
import {
  criarLancamento, atualizarLancamento, excluirLancamento, buscarLancamento, dividirParcelas, rotuloRecorrencia,
  type TipoLancamento, type Frequencia, type Termino, type Lancamento, type DadosLancamento, type Escopo
} from '../lib/lancamentos'

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const CHAVE_CONTA = 'pagafacil.ultimaConta'

/** Valor em destaque no topo, digitado como calculadora. */
function ValorGrande({ valor, onChange }: { valor: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  const texto = fmt.format(valor)
  useLayoutEffect(() => {
    const el = ref.current
    if (el && document.activeElement === el) el.setSelectionRange(texto.length, texto.length)
  }, [texto])
  return (
    <div className="valor-grande">
      <span>R$</span>
      <input ref={ref} inputMode="numeric" aria-label="Valor" value={texto}
        onChange={e => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 12) || '0') / 100)}
        onFocus={e => { const el = e.target; requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length)) }}
        onClick={e => { const el = e.currentTarget; el.setSelectionRange(el.value.length, el.value.length) }} />
    </div>
  )
}

export default function LancamentoForm({ tipoNovo }: { tipoNovo?: TipoLancamento }) {
  const { id } = useParams()
  const ir = useNavigate()
  const novo = !id

  const [original, setOriginal] = useState<Lancamento | null>(null)
  const [tipo, setTipo] = useState<TipoLancamento>(tipoNovo ?? 'despesa')
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(hojeIso())
  const [efetivado, setEfetivado] = useState(false)
  const [dataEfet, setDataEfet] = useState(hojeIso())
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [contaId, setContaId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [observacao, setObservacao] = useState('')
  const [frequencia, setFrequencia] = useState<Frequencia>('nenhuma')
  const [parcelas, setParcelas] = useState(2)
  const [termino, setTermino] = useState<Termino>('nunca')
  const [quantidade, setQuantidade] = useState(12)
  const [dataFim, setDataFim] = useState('')
  const [continuar, setContinuar] = useState(false)

  const [contas, setContas] = useState<{ id: string; descricao: string }[] | null>(null)
  const [carregando, setCarregando] = useState(!novo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [escopoPara, setEscopoPara] = useState<'editar' | 'excluir' | null>(null)

  useEffect(() => { if (tipoNovo) setTipo(tipoNovo) }, [tipoNovo])

  useEffect(() => {
    supabase.from('contas').select('id, descricao').eq('ativa', true).order('descricao').then(({ data: c }) => {
      setContas(c ?? [])
      if (novo && c?.length) {
        let ultima = ''
        try { ultima = localStorage.getItem(CHAVE_CONTA) ?? '' } catch { /* sem armazenamento */ }
        setContaId(c.some(x => x.id === ultima) ? ultima : c[0].id)
      }
    })
  }, [novo])

  useEffect(() => {
    if (!id) return
    buscarLancamento(id).then(l => {
      setOriginal(l); setTipo(l.tipo); setValor(l.valor); setDescricao(l.descricao); setData(l.data_vencimento)
      setEfetivado(l.efetivado); setDataEfet(l.data_efetivacao ?? hojeIso()); setCategoriaId(l.categoria_id)
      setContaId(l.conta_id ?? ''); setTags(l.tags ?? []); setObservacao(l.observacao ?? '')
      setCarregando(false)
    }).catch(() => { setErro('Lançamento não encontrado.'); setCarregando(false) })
  }, [id])

  // Ao marcar como efetivado, sugere a data do vencimento (se já passou) ou hoje.
  function marcarEfetivado(v: boolean) {
    setEfetivado(v)
    if (v) setDataEfet(data < hojeIso() ? data : hojeIso())
  }

  const recorrente = !!original?.recorrencia_id
  const ehReceita = tipo === 'receita'
  const palavraEfetivado = ehReceita ? 'Recebida' : 'Paga'

  function dados(): DadosLancamento {
    return {
      tipo, descricao: descricao.trim(), valor, data_vencimento: data, efetivado,
      data_efetivacao: efetivado ? dataEfet : null, categoria_id: categoriaId, conta_id: contaId,
      observacao: observacao.trim(), tags
    }
  }

  function validar() {
    if (valor <= 0) return 'Informe o valor.'
    if (!descricao.trim()) return 'Informe a descrição.'
    if (!categoriaId) return 'Escolha a categoria.'
    if (!contaId) return 'Escolha a conta.'
    if (frequencia === 'parcelado' && (parcelas < 2 || parcelas > 120)) return 'O número de parcelas deve ficar entre 2 e 120.'
    if (novo && frequencia !== 'nenhuma' && frequencia !== 'parcelado') {
      if (termino === 'quantidade' && (quantidade < 2 || quantidade > 500)) return 'Informe quantas vezes repete (2 a 500).'
      if (termino === 'data' && (!dataFim || dataFim <= data)) return 'A data final deve ser depois da primeira data.'
    }
    return ''
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    const problema = validar()
    if (problema) return setErro(problema)
    setErro('')
    if (!novo && recorrente) return setEscopoPara('editar')
    await gravar('este')
  }

  async function gravar(escopo: Escopo) {
    setEscopoPara(null); setSalvando(true)
    try {
      if (novo) {
        await criarLancamento(dados(), { frequencia, parcelas, termino, quantidade, dataFim })
        try { localStorage.setItem(CHAVE_CONTA, contaId) } catch { /* sem armazenamento */ }
      } else {
        await atualizarLancamento(original!, dados(), escopo)
      }
      if (novo && continuar) {
        setValor(0); setDescricao(''); setTags([]); setObservacao(''); setEfetivado(false); setFrequencia('nenhuma')
        setAviso(`${ehReceita ? 'Receita' : 'Despesa'} salva. Pode lançar a próxima.`)
        setSalvando(false)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      ir(-1)
    } catch {
      setErro('Não foi possível salvar. Verifique sua conexão e tente de novo.')
      setSalvando(false)
    }
  }

  async function excluir(escopo: Escopo) {
    if (!original) return
    setEscopoPara(null)
    if (escopo === 'este' && !recorrente && !window.confirm('Excluir este lançamento?')) return
    try { await excluirLancamento(original, escopo); ir(-1) }
    catch { setErro('Não foi possível excluir.') }
  }

  const voltar = <button type="button" className="icone-btn" aria-label="Voltar" onClick={() => ir(-1)}><IconArrowLeft size={22} /></button>
  const titulo = novo ? (ehReceita ? 'Nova receita' : 'Nova despesa') : (ehReceita ? 'Editar receita' : 'Editar despesa')
  const valoresParcelas = frequencia === 'parcelado' && valor > 0 ? dividirParcelas(valor, Math.max(2, parcelas)) : []

  return (
    <>
      <div className={`cabecalho-lanc ${tipo}`}>
        <Topo titulo={titulo} esquerda={voltar} />
        <ValorGrande valor={valor} onChange={v => { setValor(v); setAviso('') }} />
        {original && recorrente && <div className="selo-rec"><IconRepeat size={14} />{rotuloRecorrencia(original)}</div>}
      </div>

      <div className="pagina">
        {carregando ? <p className="aviso">Carregando…</p> : (
          <form className="formulario" onSubmit={salvar}>
            {aviso && <p className="sucesso caixa-aviso">{aviso}</p>}

            {contas && contas.length === 0 && (
              <p className="erro caixa-aviso">Você ainda não tem conta cadastrada. <Link to="/contas/nova">Cadastrar conta</Link></p>
            )}

            <section className="cartao formulario">
              <div className="campo">
                <label htmlFor="descricao">Descrição</label>
                <input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={80}
                  placeholder={ehReceita ? 'Ex.: Salário de novembro' : 'Ex.: Conta de luz'} />
              </div>

              <div className="campo">
                <label htmlFor="data">{novo && frequencia !== 'nenhuma' ? 'Data da primeira' : 'Data de vencimento'}</label>
                <input id="data" type="date" value={data} onChange={e => setData(e.target.value)} required />
              </div>

              <label className="interruptor linha-interruptor">
                <span>{palavraEfetivado}</span>
                <input type="checkbox" role="switch" checked={efetivado} onChange={e => marcarEfetivado(e.target.checked)} />
              </label>
              {efetivado && (
                <div className="campo">
                  <label htmlFor="dataEfet">Data em que foi {ehReceita ? 'recebida' : 'paga'}</label>
                  <input id="dataEfet" type="date" value={dataEfet} onChange={e => setDataEfet(e.target.value)} max={hojeIso()} />
                </div>
              )}
            </section>

            <section className="cartao formulario">
              <div className="campo">
                <label>Categoria</label>
                <SeletorCategoria tipo={tipo} valor={categoriaId} onChange={setCategoriaId} />
              </div>
              <div className="campo">
                <label htmlFor="conta">Conta</label>
                <select id="conta" value={contaId} onChange={e => setContaId(e.target.value)}>
                  {contas?.length === 0 && <option value="">Nenhuma conta</option>}
                  {contas?.map(c => <option key={c.id} value={c.id}>{c.descricao}</option>)}
                </select>
              </div>
            </section>

            {novo && (
              <section className="cartao formulario">
                <div className="campo">
                  <label htmlFor="freq">Repetição</label>
                  <select id="freq" value={frequencia} onChange={e => setFrequencia(e.target.value as Frequencia)}>
                    <option value="nenhuma">Não se repete</option>
                    <option value="mensal">Todo mês</option>
                    <option value="semanal">Toda semana</option>
                    <option value="anual">Todo ano</option>
                    <option value="parcelado">Parcelado</option>
                  </select>
                </div>

                {frequencia === 'parcelado' && (
                  <>
                    <div className="campo">
                      <label htmlFor="parcelas">Número de parcelas</label>
                      <input id="parcelas" type="number" inputMode="numeric" min={2} max={120} value={parcelas}
                        onChange={e => setParcelas(Number(e.target.value))} />
                    </div>
                    {valoresParcelas.length > 0 && (
                      <p className="destaque-info">
                        <b>{parcelas}x de {reais(valoresParcelas[valoresParcelas.length - 1])}</b>
                        {valoresParcelas[0] !== valoresParcelas[valoresParcelas.length - 1] && <> (a 1ª de {reais(valoresParcelas[0])})</>}
                        {' '}— o valor acima é o total.
                      </p>
                    )}
                  </>
                )}

                {(frequencia === 'mensal' || frequencia === 'semanal' || frequencia === 'anual') && (
                  <>
                    <div className="campo">
                      <label htmlFor="termino">Termina</label>
                      <select id="termino" value={termino} onChange={e => setTermino(e.target.value as Termino)}>
                        <option value="nunca">Nunca (sem data para acabar)</option>
                        <option value="quantidade">Depois de algumas vezes</option>
                        <option value="data">Em uma data</option>
                      </select>
                    </div>
                    {termino === 'quantidade' && (
                      <div className="campo">
                        <label htmlFor="qtd">Quantas vezes, contando a primeira</label>
                        <input id="qtd" type="number" inputMode="numeric" min={2} max={500} value={quantidade}
                          onChange={e => setQuantidade(Number(e.target.value))} />
                      </div>
                    )}
                    {termino === 'data' && (
                      <div className="campo">
                        <label htmlFor="fim">Última data</label>
                        <input id="fim" type="date" value={dataFim} min={data} onChange={e => setDataFim(e.target.value)} />
                      </div>
                    )}
                    {termino === 'nunca' && <small className="ajuda">O app mantém sempre os próximos 12 meses lançados.</small>}
                  </>
                )}
              </section>
            )}

            <section className="cartao formulario">
              <div className="campo">
                <label>Tags</label>
                <SeletorTags valor={tags} onChange={setTags} />
              </div>
              <div className="campo">
                <label htmlFor="obs">Observação</label>
                <textarea id="obs" rows={2} value={observacao} onChange={e => setObservacao(e.target.value)} maxLength={500} />
              </div>
            </section>

            {erro && <p className="erro">{erro}</p>}

            {novo && (
              <label className="interruptor linha-interruptor">
                <span>Salvar e continuar lançando</span>
                <input type="checkbox" role="switch" checked={continuar} onChange={e => setContinuar(e.target.checked)} />
              </label>
            )}
            <button className={`btn btn-bloco btn-tipo ${tipo}`} disabled={salvando || contas?.length === 0}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
            {!novo && original && (
              <>
                <button type="button" className="btn btn-bloco" style={{ color: 'var(--despesa)' }}
                  onClick={() => recorrente ? setEscopoPara('excluir') : excluir('este')}>Excluir</button>
                {original.efetivado && original.data_efetivacao && (
                  <p className="ajuda" style={{ textAlign: 'center' }}>{palavraEfetivado} em {dataBr(original.data_efetivacao)}</p>
                )}
              </>
            )}
          </form>
        )}
      </div>

      <EscolhaEscopo aberta={escopoPara !== null} acao={escopoPara ?? 'editar'} onFechar={() => setEscopoPara(null)}
        onEscolher={e => escopoPara === 'excluir' ? excluir(e) : gravar(e)} />
    </>
  )
}
