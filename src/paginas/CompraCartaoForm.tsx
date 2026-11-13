import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { IconArrowLeft, IconRepeat, IconCreditCard } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import CampoValor from '../componentes/CampoValor'
import SeletorTags from '../componentes/SeletorTags'
import EscolhaEscopo from '../componentes/EscolhaEscopo'
import Anexos from '../componentes/Anexos'
import { enviarAnexo } from '../lib/anexos'
import { hojeIso, dataBr, deIso } from '../lib/datas'
import { reais } from '../lib/formato'
import { listarCategorias, type CategoriaComSubs } from '../lib/categorias'
import { listarCartoes, type CartaoComUso } from '../lib/cartoes'
import { criarCompra, atualizarCompra, faturaDaCompra, dataDaParcela } from '../lib/compras'
import {
  excluirLancamento, buscarLancamento, dividirParcelas, rotuloRecorrencia,
  type Frequencia, type Termino, type Lancamento, type Escopo
} from '../lib/lancamentos'

const CHAVE_CARTAO = 'pagafacil.ultimoCartao'
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const nomeFatura = (mesRef: string) => { const d = deIso(mesRef); return `${MESES[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : ''}` }

export default function CompraCartaoForm() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const ir = useNavigate()
  const novo = !id

  const [original, setOriginal] = useState<Lancamento | null>(null)
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [dataCompra, setDataCompra] = useState(hojeIso())
  const [cartoes, setCartoes] = useState<CartaoComUso[] | null>(null)
  const [cartaoId, setCartaoId] = useState('')
  const [categorias, setCategorias] = useState<CategoriaComSubs[]>([])
  const [catId, setCatId] = useState('')
  const [subId, setSubId] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [observacao, setObservacao] = useState('')
  const [frequencia, setFrequencia] = useState<Frequencia>('nenhuma')
  const [parcelas, setParcelas] = useState(2)
  const [modoValor, setModoValor] = useState<'total' | 'parcela'>('total')
  const [termino, setTermino] = useState<Termino>('nunca')
  const [quantidade, setQuantidade] = useState(12)
  const [dataFim, setDataFim] = useState('')
  const [pendentes, setPendentes] = useState<File[]>([])
  const [continuar, setContinuar] = useState(false)

  const [carregando, setCarregando] = useState(!novo)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [escopoPara, setEscopoPara] = useState<'editar' | 'excluir' | null>(null)

  useEffect(() => {
    listarCategorias('despesa').then(l => setCategorias(l.filter(c => c.ativa))).catch(() => setCategorias([]))
    listarCartoes().then(lista => {
      const ativos = lista.filter(c => c.ativo)
      setCartoes(ativos)
      if (!novo) return
      let preferido = parametros.get('cartao') ?? ''
      if (!preferido) { try { preferido = localStorage.getItem(CHAVE_CARTAO) ?? '' } catch { /* sem armazenamento */ } }
      setCartaoId(ativos.some(c => c.id === preferido) ? preferido : ativos[0]?.id ?? '')
    }).catch(() => setCartoes([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novo])

  useEffect(() => {
    if (!id) return
    buscarLancamento(id).then(l => {
      setOriginal(l); setValor(l.valor); setDescricao(l.descricao); setDataCompra(l.data_lancamento)
      setCartaoId(l.cartao_id ?? ''); setTags(l.tags ?? []); setObservacao(l.observacao ?? '')
      setCarregando(false)
    }).catch(() => { setErro('Compra não encontrada.'); setCarregando(false) })
  }, [id])

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

  const cartao = cartoes?.find(c => c.id === cartaoId)
  const recorrente = !!original?.recorrencia_id
  const parcelado = novo && frequencia === 'parcelado'
  const nParcelas = Math.max(2, Math.min(120, parcelas || 2))
  const valorTotal = parcelado && modoValor === 'parcela' ? Math.round(valor * nParcelas * 100) / 100 : valor
  const valoresParcelas = parcelado && valor > 0 ? dividirParcelas(valorTotal, nParcelas) : []

  // Prévia de em qual fatura a compra (ou a 1ª e a última parcela) vai cair.
  const previa = useMemo(() => {
    if (!cartao || !dataCompra) return null
    const n = parcelado ? nParcelas : 1
    const inicio = novo ? 0 : (original?.parcela_numero ?? 1) - 1   // ao editar uma parcela, mostra a fatura dela
    const primeira = faturaDaCompra(cartao, dataDaParcela(cartao, dataCompra, inicio))
    const ultima = faturaDaCompra(cartao, dataDaParcela(cartao, dataCompra, inicio + n - 1))
    return { primeira, ultima, varias: n > 1 }
  }, [cartao, dataCompra, novo, parcelado, nParcelas, original])

  const passaLimite = !!cartao && novo && valorTotal > cartao.disponivel

  function validar() {
    if (valor <= 0) return 'Informe o valor.'
    if (!descricao.trim()) return 'Informe a descrição.'
    if (!cartaoId) return 'Escolha o cartão.'
    if (!dataCompra) return 'Informe a data da compra.'
    if (!catId) return 'Escolha a categoria.'
    if (parcelado && (parcelas < 2 || parcelas > 120)) return 'O número de parcelas deve ficar entre 2 e 120.'
    if (novo && frequencia === 'mensal') {
      if (termino === 'quantidade' && (quantidade < 2 || quantidade > 500)) return 'Informe quantas vezes repete (2 a 500).'
      if (termino === 'data' && (!dataFim || dataFim <= dataCompra)) return 'A data final deve ser depois da compra.'
    }
    return ''
  }

  const dados = () => ({
    descricao: descricao.trim(), valor: valorTotal, data_compra: dataCompra, cartao_id: cartaoId,
    categoria_id: subId || catId || null, observacao: observacao.trim(), tags
  })

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
        const ids = await criarCompra(dados(), { frequencia, parcelas: nParcelas, termino, quantidade, dataFim })
        try { localStorage.setItem(CHAVE_CARTAO, cartaoId) } catch { /* sem armazenamento */ }
        try { for (const f of pendentes) await enviarAnexo(ids[0], f) }
        catch { window.alert('A compra foi salva, mas algum anexo não foi enviado. Abra a compra e anexe de novo.') }
      } else {
        await atualizarCompra({
          id: original!.id, recorrencia_id: original!.recorrencia_id, data_vencimento: original!.data_vencimento,
          data_lancamento: original!.data_lancamento, cartao_id: original!.cartao_id ?? null, parcela_numero: original!.parcela_numero
        }, dados(), escopo)
      }
      if (novo && continuar) {
        setValor(0); setDescricao(''); setTags([]); setObservacao(''); setFrequencia('nenhuma'); setPendentes([])
        setAviso('Compra salva. Pode lançar a próxima.')
        setSalvando(false)
        listarCartoes().then(l => setCartoes(l.filter(c => c.ativo))).catch(() => {})
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
    if (escopo === 'este' && !recorrente && !window.confirm('Excluir esta compra?')) return
    try { await excluirLancamento(original, escopo); ir(-1) }
    catch { setErro('Não foi possível excluir.') }
  }

  const voltar = <button type="button" className="icone-btn" aria-label="Voltar" onClick={() => ir(-1)}><IconArrowLeft size={22} /></button>
  const rotuloValor = parcelado ? (modoValor === 'parcela' ? 'Valor da parcela' : 'Valor total') : 'Valor'

  return (
    <>
      <div className="cabecalho-lanc despesa">
        <Topo titulo={novo ? 'Despesa no cartão' : 'Editar compra'} esquerda={voltar} />
        {original && recorrente && <div className="selo-rec"><IconRepeat size={14} />{rotuloRecorrencia(original)}</div>}
      </div>

      <div className="pagina">
        {carregando ? <p className="aviso">Carregando…</p> : (
          <form className="formulario" onSubmit={salvar}>
            {aviso && <p className="sucesso caixa-aviso">{aviso}</p>}
            {cartoes && cartoes.length === 0 && (
              <p className="erro caixa-aviso">Você ainda não tem cartão cadastrado. <Link to="/cartoes/novo">Cadastrar cartão</Link></p>
            )}

            <section className="cartao formulario">
              <CampoValor id="valor" rotulo={rotuloValor} valor={valor} onChange={v => { setValor(v); setAviso('') }} />
              <div className="campo">
                <label htmlFor="descricao">Descrição</label>
                <input id="descricao" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={80} placeholder="Ex.: Mercado, Farmácia, Passagem" />
              </div>
              <div className="campo">
                <label htmlFor="cartao">Cartão</label>
                <select id="cartao" value={cartaoId} onChange={e => setCartaoId(e.target.value)}>
                  {cartoes?.length === 0 && <option value="">Nenhum cartão</option>}
                  {cartoes?.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="campo">
                <label htmlFor="dataCompra">Data da compra</label>
                <input id="dataCompra" type="date" value={dataCompra} onChange={e => setDataCompra(e.target.value)} required />
              </div>

              {previa && (
                <div className="destaque-info fatura-previa">
                  <IconCreditCard size={18} />
                  <span>
                    {previa.varias
                      ? <>1ª parcela na fatura de <b>{nomeFatura(previa.primeira.mes_referencia)}</b> (vence {dataBr(previa.primeira.data_vencimento)}), última na de <b>{nomeFatura(previa.ultima.mes_referencia)}</b>.</>
                      : <>Entra na fatura de <b>{nomeFatura(previa.primeira.mes_referencia)}</b>, que fecha em {dataBr(previa.primeira.data_fechamento)} e vence em <b>{dataBr(previa.primeira.data_vencimento)}</b>.</>}
                    {cartao && novo && <><br />Limite disponível: <b className={passaLimite ? 'negativo' : ''}>{reais(cartao.disponivel)}</b>{passaLimite && ' — esta compra passa do limite.'}</>}
                  </span>
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
            </section>

            {novo && (
              <section className="cartao formulario">
                <div className="campo">
                  <label htmlFor="freq">Repetição</label>
                  <select id="freq" value={frequencia} onChange={e => setFrequencia(e.target.value as Frequencia)}>
                    <option value="nenhuma">À vista (não se repete)</option>
                    <option value="parcelado">Parcelado</option>
                    <option value="mensal">Todo mês (assinatura)</option>
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
                        {' '}= total de <b>{reais(valorTotal)}</b>, uma parcela em cada fatura.
                      </p>
                    )}
                  </>
                )}

                {frequencia === 'mensal' && (
                  <>
                    <div className="campo">
                      <label htmlFor="termino">Termina</label>
                      <select id="termino" value={termino} onChange={e => setTermino(e.target.value as Termino)}>
                        <option value="nunca">Nunca (até cancelar)</option>
                        <option value="quantidade">Depois de alguns meses</option>
                        <option value="data">Em uma data</option>
                      </select>
                    </div>
                    {termino === 'quantidade' && (
                      <div className="campo">
                        <label htmlFor="qtd">Quantos meses, contando o primeiro</label>
                        <input id="qtd" type="number" inputMode="numeric" min={2} max={500} value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} />
                      </div>
                    )}
                    {termino === 'data' && (
                      <div className="campo">
                        <label htmlFor="fim">Última cobrança</label>
                        <input id="fim" type="date" value={dataFim} min={dataCompra} onChange={e => setDataFim(e.target.value)} />
                      </div>
                    )}
                    <small className="ajuda">Para assinaturas como streaming e aplicativos: a cobrança entra em toda fatura.</small>
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

            {erro && <p className="erro">{erro}</p>}
            {novo && (
              <label className="interruptor linha-interruptor">
                <span>Salvar e continuar lançando</span>
                <input type="checkbox" role="switch" checked={continuar} onChange={e => setContinuar(e.target.checked)} />
              </label>
            )}
            <button className="btn btn-bloco btn-tipo despesa" disabled={salvando || cartoes?.length === 0}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            {!novo && original && (
              <button type="button" className="btn btn-bloco" style={{ color: 'var(--despesa)' }}
                onClick={() => recorrente ? setEscopoPara('excluir') : excluir('este')}>Excluir</button>
            )}
          </form>
        )}
      </div>

      <EscolhaEscopo aberta={escopoPara !== null} acao={escopoPara ?? 'editar'} onFechar={() => setEscopoPara(null)}
        onEscolher={e => escopoPara === 'excluir' ? excluir(e) : gravar(e)} />
    </>
  )
}
