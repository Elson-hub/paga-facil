import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { IconArrowLeft, IconRepeat, IconChevronDown } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import CampoValor from '../componentes/CampoValor'
import SeletorTags from '../componentes/SeletorTags'
import EscolhaEscopo from '../componentes/EscolhaEscopo'
import Anexos from '../componentes/Anexos'
import { enviarAnexo } from '../lib/anexos'
import { supabase } from '../lib/supabase'
import { hojeIso, dataBr } from '../lib/datas'
import { reais } from '../lib/formato'
import { listarCategorias, type CategoriaComSubs } from '../lib/categorias'
import {
  criarLancamento, atualizarLancamento, excluirLancamento, buscarLancamento, dividirParcelas, rotuloRecorrencia,
  type TipoLancamento, type Frequencia, type Termino, type Lancamento, type DadosLancamento, type Escopo
} from '../lib/lancamentos'

const CHAVE_CONTA = 'pagafacil.ultimaConta'
type ModoValor = 'total' | 'parcela'

export default function LancamentoForm({ tipoNovo }: { tipoNovo?: TipoLancamento }) {
  const { id } = useParams()
  const ir = useNavigate()
  const novo = !id

  const [original, setOriginal] = useState<Lancamento | null>(null)
  const [tipo, setTipo] = useState<TipoLancamento>(tipoNovo ?? 'despesa')
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [dataLanc, setDataLanc] = useState(hojeIso())
  const [dataVenc, setDataVenc] = useState(hojeIso())
  const [lancIgual, setLancIgual] = useState(true)   // data do lançamento acompanha o vencimento até ser mudada
  const [maisOpcoes, setMaisOpcoes] = useState(false)
  const [pendentes, setPendentes] = useState<File[]>([])
  const [efetivado, setEfetivado] = useState(false)
  const [dataEfet, setDataEfet] = useState(hojeIso())
  const [categorias, setCategorias] = useState<CategoriaComSubs[]>([])
  const [catId, setCatId] = useState('')
  const [subId, setSubId] = useState('')
  const [contaId, setContaId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [observacao, setObservacao] = useState('')
  const [frequencia, setFrequencia] = useState<Frequencia>('nenhuma')
  const [parcelas, setParcelas] = useState(2)
  const [modoValor, setModoValor] = useState<ModoValor>('total')
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
    listarCategorias(tipo).then(l => setCategorias(l.filter(c => c.ativa))).catch(() => setCategorias([]))
  }, [tipo])

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
      setOriginal(l); setTipo(l.tipo); setValor(l.valor); setDescricao(l.descricao)
      setDataLanc(l.data_lancamento ?? l.data_vencimento); setDataVenc(l.data_vencimento); setLancIgual(false)
      if (l.data_lancamento && l.data_lancamento !== l.data_vencimento) setMaisOpcoes(true)
      setEfetivado(l.efetivado); setDataEfet(l.data_efetivacao ?? hojeIso())
      setContaId(l.conta_id ?? ''); setTags(l.tags ?? []); setObservacao(l.observacao ?? '')
      setCarregando(false)
    }).catch(() => { setErro('Lançamento não encontrado.'); setCarregando(false) })
  }, [id])

  // Ao editar: separa a categoria gravada em principal + subcategoria.
  useEffect(() => {
    if (!original?.categoria_id || !categorias.length) return
    const alvo = original.categoria_id
    const principal = categorias.find(c => c.id === alvo || c.subcategorias.some(s => s.id === alvo))
    if (principal) { setCatId(principal.id); setSubId(principal.id === alvo ? '' : alvo) }
  }, [original, categorias])

  const subcategorias = useMemo(
    () => categorias.find(c => c.id === catId)?.subcategorias.filter(s => s.ativa || s.id === subId) ?? [],
    [categorias, catId, subId]
  )

  function mudarVencimento(v: string) {
    setDataVenc(v)
    if (lancIgual) setDataLanc(v)
  }

  function marcarEfetivado(v: boolean) {
    setEfetivado(v)
    if (v) setDataEfet(dataVenc < hojeIso() ? dataVenc : hojeIso())
  }

  const recorrente = !!original?.recorrencia_id
  const ehReceita = tipo === 'receita'
  const palavraEfetivado = ehReceita ? 'Recebida' : 'Paga'
  const parcelado = novo && frequencia === 'parcelado'
  const nParcelas = Math.max(2, Math.min(120, parcelas || 2))
  const valorTotal = parcelado && modoValor === 'parcela' ? Math.round(valor * nParcelas * 100) / 100 : valor
  const valoresParcelas = parcelado && valor > 0 ? dividirParcelas(valorTotal, nParcelas) : []

  function dados(): DadosLancamento {
    return {
      tipo, descricao: descricao.trim(), valor: valorTotal,
      data_lancamento: dataLanc, data_vencimento: dataVenc, efetivado,
      data_efetivacao: efetivado ? dataEfet : null,
      categoria_id: subId || catId || null, conta_id: contaId,
      observacao: observacao.trim(), tags
    }
  }

  function validar() {
    if (valor <= 0) return 'Informe o valor.'
    if (!descricao.trim()) return 'Informe a descrição.'
    if (!dataLanc || !dataVenc) return 'Informe as datas.'
    if (!catId) return 'Escolha a categoria.'
    if (!contaId) return 'Escolha a conta.'
    if (parcelado && (parcelas < 2 || parcelas > 120)) return 'O número de parcelas deve ficar entre 2 e 120.'
    if (novo && (frequencia === 'mensal' || frequencia === 'semanal' || frequencia === 'anual')) {
      if (termino === 'quantidade' && (quantidade < 2 || quantidade > 500)) return 'Informe quantas vezes repete (2 a 500).'
      if (termino === 'data' && (!dataFim || dataFim <= dataVenc)) return 'A data final deve ser depois do primeiro vencimento.'
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
        const ids = await criarLancamento(dados(), { frequencia, parcelas: nParcelas, termino, quantidade, dataFim })
        try { localStorage.setItem(CHAVE_CONTA, contaId) } catch { /* sem armazenamento */ }
        // Os anexos ficam no primeiro lançamento da série.
        try { for (const f of pendentes) await enviarAnexo(ids[0], f) }
        catch { window.alert('O lançamento foi salvo, mas algum anexo não foi enviado. Abra o lançamento e anexe de novo.') }
      } else {
        await atualizarLancamento(original!, dados(), escopo)
      }
      if (novo && continuar) {
        setValor(0); setDescricao(''); setTags([]); setObservacao(''); setEfetivado(false); setFrequencia('nenhuma'); setPendentes([])
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
  const rotuloValor = parcelado ? (modoValor === 'parcela' ? 'Valor da parcela' : 'Valor total') : 'Valor'

  return (
    <>
      <div className={`cabecalho-lanc ${tipo}`}>
        <Topo titulo={titulo} esquerda={voltar} />
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
              <CampoValor id="valor" rotulo={rotuloValor} valor={valor} onChange={v => { setValor(v); setAviso('') }} />

              <div className="campo">
                <label htmlFor="descricao">Descrição</label>
                <input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={80}
                  placeholder={ehReceita ? 'Ex.: Salário de novembro' : 'Ex.: Conta de luz'} />
              </div>

              <div className="campo">
                <label htmlFor="dataVenc">{novo && frequencia !== 'nenhuma' ? '1º vencimento' : 'Vencimento'}</label>
                <input id="dataVenc" type="date" value={dataVenc} onChange={e => mudarVencimento(e.target.value)} required />
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
                <label htmlFor="categoria">Categoria</label>
                <select id="categoria" value={catId} onChange={e => { setCatId(e.target.value); setSubId('') }}>
                  <option value="">Escolher categoria</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="subcategoria">Subcategoria</label>
                <select id="subcategoria" value={subId} onChange={e => setSubId(e.target.value)} disabled={!catId || subcategorias.length === 0}>
                  <option value="">{!catId ? 'Escolha a categoria primeiro' : subcategorias.length === 0 ? 'Esta categoria não tem subcategorias' : 'Nenhuma (opcional)'}</option>
                  {subcategorias.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
                </select>
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
                    <div className="campo">
                      <label>O valor informado é</label>
                      <div className="segmentos" role="radiogroup" aria-label="O valor informado é">
                        <button type="button" role="radio" aria-checked={modoValor === 'total'} className={modoValor === 'total' ? 'ativo' : ''}
                          onClick={() => setModoValor('total')}>Valor total</button>
                        <button type="button" role="radio" aria-checked={modoValor === 'parcela'} className={modoValor === 'parcela' ? 'ativo' : ''}
                          onClick={() => setModoValor('parcela')}>Valor da parcela</button>
                      </div>
                    </div>
                    {valoresParcelas.length > 0 && (
                      <p className="destaque-info">
                        <b>{nParcelas}x de {reais(valoresParcelas[valoresParcelas.length - 1])}</b>
                        {valoresParcelas[0] !== valoresParcelas[valoresParcelas.length - 1] && <> (a 1ª de {reais(valoresParcelas[0])})</>}
                        {' '}= total de <b>{reais(valorTotal)}</b>
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
                        <label htmlFor="fim">Último vencimento</label>
                        <input id="fim" type="date" value={dataFim} min={dataVenc} onChange={e => setDataFim(e.target.value)} />
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

            <section className="cartao formulario">
              <div className="campo">
                <label>Anexos</label>
                <Anexos lancamentoId={original?.id} pendentes={pendentes} onPendentes={setPendentes} />
              </div>
            </section>

            <section className="cartao mais-opcoes">
              <button type="button" className="mais-opcoes-botao" aria-expanded={maisOpcoes} onClick={() => setMaisOpcoes(m => !m)}>
                <span>{maisOpcoes ? 'Menos opções' : 'Ver mais opções'}</span>
                <IconChevronDown size={18} style={{ transform: maisOpcoes ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }} />
              </button>
              {maisOpcoes && (
                <div className="formulario" style={{ paddingTop: 12 }}>
                  <div className="campo">
                    <label htmlFor="dataLanc">Data do lançamento</label>
                    <input id="dataLanc" type="date" value={dataLanc}
                      onChange={e => { setDataLanc(e.target.value); setLancIgual(false) }} required />
                    <small className="ajuda">Quando aconteceu (compra, serviço, venda). Pode ser no passado, para lançamentos retroativos. Se não mudar, fica igual ao vencimento.</small>
                  </div>
                </div>
              )}
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
