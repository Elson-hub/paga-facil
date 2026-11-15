import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { IconArrowLeft, IconCheck, IconPlus, IconTrash, IconRefresh } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { supabase } from '../lib/supabase'
import { ICONES, CORES, IconeCategoria, categoriaEmUso, type TipoCategoria } from '../lib/categorias'

/** Uma linha da lista de subcategorias no formulário. */
interface Sub {
  chave: string          // identificador só da tela
  id?: string            // existe no banco?
  nome: string
  nomeOriginal?: string
  ativa: boolean
  removida?: boolean
}

let contador = 0
const novaChave = () => `n${++contador}`

export default function CategoriaForm() {
  const { id: idParam } = useParams()
  const [parametros] = useSearchParams()
  const ir = useNavigate()

  const [id, setId] = useState(idParam)
  const nova = !id
  const [tipo, setTipo] = useState<TipoCategoria>(parametros.get('tipo') === 'receita' ? 'receita' : 'despesa')
  const [nome, setNome] = useState('')
  const [icone, setIcone] = useState('dots')
  const [cor, setCor] = useState(CORES[0])
  const [ativa, setAtiva] = useState(true)
  const [subs, setSubs] = useState<Sub[]>([])
  const [carregando, setCarregando] = useState(!!idParam)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const ultimoCampo = useRef<HTMLInputElement>(null)
  const [focarNova, setFocarNova] = useState(false)

  // Ao editar: carrega a categoria e as subcategorias. Se o link for de uma
  // subcategoria, abre a categoria principal dela.
  useEffect(() => {
    if (!idParam) return
    ;(async () => {
      const { data: cat, error } = await supabase.from('categorias')
        .select('id, nome, tipo, icone, cor, categoria_pai_id, ativa').eq('id', idParam).single()
      if (error || !cat) { setErro('Categoria não encontrada.'); setCarregando(false); return }
      if (cat.categoria_pai_id) { ir(`/categorias/${cat.categoria_pai_id}`, { replace: true }); return }
      const { data: filhas } = await supabase.from('categorias')
        .select('id, nome, ativa').eq('categoria_pai_id', cat.id).order('nome')
      setId(cat.id); setNome(cat.nome); setTipo(cat.tipo)
      setIcone(cat.icone || 'dots'); setCor(cat.cor || CORES[0]); setAtiva(cat.ativa)
      setSubs((filhas ?? []).map(s => ({ chave: s.id, id: s.id, nome: s.nome, nomeOriginal: s.nome, ativa: s.ativa })))
      setCarregando(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam])

  useEffect(() => {
    if (focarNova) { ultimoCampo.current?.focus(); setFocarNova(false) }
  }, [focarNova, subs])

  const mudarSub = (chave: string, dados: Partial<Sub>) =>
    setSubs(lista => lista.map(s => s.chave === chave ? { ...s, ...dados } : s))

  function adicionarSub() {
    setSubs(lista => [...lista, { chave: novaChave(), nome: '', ativa: true }])
    setFocarNova(true)
  }

  function removerSub(s: Sub) {
    if (s.id) mudarSub(s.chave, { removida: true })
    else setSubs(lista => lista.filter(x => x.chave !== s.chave))
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Informe o nome da categoria.')
    const mantidas = subs.filter(s => !s.removida && s.nome.trim())
    const nomes = mantidas.map(s => s.nome.trim().toLocaleLowerCase('pt-BR'))
    if (new Set(nomes).size !== nomes.length) return setErro('Há subcategorias com o mesmo nome.')
    setErro(''); setSalvando(true)

    try {
      // 1. A categoria principal
      const dados = { nome: nome.trim(), tipo, icone, cor, ativa, categoria_pai_id: null }
      let catId = id
      if (nova) {
        const { data, error } = await supabase.from('categorias').insert(dados).select('id').single()
        if (error || !data) throw error
        catId = data.id
      } else {
        const { error } = await supabase.from('categorias').update(dados).eq('id', id)
        if (error) throw error
      }

      // 2. Subcategorias removidas: exclui, ou desativa se já foram usadas
      for (const s of subs.filter(s => s.removida && s.id)) {
        const r = (await categoriaEmUso([s.id!]))
          ? await supabase.from('categorias').update({ ativa: false }).eq('id', s.id)
          : await supabase.from('categorias').delete().eq('id', s.id)
        if (r.error) throw r.error
      }

      // 3. Subcategorias renomeadas ou reativadas
      for (const s of mantidas.filter(s => s.id)) {
        const r = await supabase.from('categorias').update({ nome: s.nome.trim(), ativa: s.ativa, tipo }).eq('id', s.id)
        if (r.error) throw r.error
      }

      // 4. Subcategorias novas
      const novas = mantidas.filter(s => !s.id).map(s => ({ nome: s.nome.trim(), tipo, categoria_pai_id: catId }))
      if (novas.length) {
        const r = await supabase.from('categorias').insert(novas)
        if (r.error) throw r.error
      }

      ir(`/categorias?tipo=${tipo}`, { replace: true })
    } catch {
      setErro('Não foi possível salvar. Verifique sua conexão e tente de novo.')
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!id) return
    setErro('')
    const ids = [id, ...subs.filter(s => s.id).map(s => s.id!)]
    if (await categoriaEmUso(ids)) {
      if (window.confirm('Esta categoria já foi usada em lançamentos, por isso não pode ser excluída. Deseja desativá-la? Ela deixa de aparecer para novos lançamentos, mas o histórico é mantido.')) {
        const { error } = await supabase.from('categorias').update({ ativa: false }).in('id', ids)
        if (error) return setErro('Não foi possível desativar.')
        ir(`/categorias?tipo=${tipo}`, { replace: true })
      }
      return
    }
    const qtd = ids.length - 1
    if (!window.confirm(`Excluir "${nome}"${qtd ? ` e suas ${qtd} subcategoria(s)` : ''}? Esta ação não pode ser desfeita.`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) return setErro('Não foi possível excluir.')
    ir(`/categorias?tipo=${tipo}`, { replace: true })
  }

  const voltar = (
    <button className="icone-btn" aria-label="Voltar" onClick={() => ir(`/categorias?tipo=${tipo}`)}><IconArrowLeft size={22} /></button>
  )
  const visiveis = subs.filter(s => !s.removida)

  return (
    <>
      <Topo titulo={nova ? 'Nova categoria' : 'Editar categoria'} esquerda={voltar} />
      <div className="pagina">
        {carregando ? <p className="aviso">Carregando…</p> : (
          <form className="formulario" onSubmit={salvar}>
            <section className="cartao formulario">
              {nova && (
                <div className="segmentos" role="radiogroup" aria-label="Tipo">
                  <button type="button" role="radio" aria-checked={tipo === 'despesa'} className={tipo === 'despesa' ? 'ativo' : ''}
                    onClick={() => setTipo('despesa')}>Despesa</button>
                  <button type="button" role="radio" aria-checked={tipo === 'receita'} className={tipo === 'receita' ? 'ativo' : ''}
                    onClick={() => setTipo('receita')}>Receita</button>
                </div>
              )}

              <div className="previa-cat">
                <IconeCategoria icone={icone} cor={cor} tamanho={48} />
                <div className="campo" style={{ flex: 1 }}>
                  <label htmlFor="nome">Nome da categoria</label>
                  <input id="nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={40}
                    placeholder="Ex.: Alimentação" autoFocus={nova} />
                </div>
              </div>
            </section>

            <section className="cartao formulario">
              <div className="titulo-secao">
                <h2>Subcategorias</h2>
                <small>{visiveis.length === 0 ? 'Opcional' : `${visiveis.length}`}</small>
              </div>

              {visiveis.length === 0 && (
                <p className="aviso">Use subcategorias para detalhar os gastos. Ex.: em Alimentação, "Supermercado" e "Restaurante".</p>
              )}

              <div className="lista-subs">
                {visiveis.map((s, i) => (
                  <div key={s.chave} className={`linha-sub ${s.ativa ? '' : 'inativa'}`}>
                    <span className="ponto" style={{ background: cor }} />
                    <input value={s.nome} maxLength={40} placeholder="Nome da subcategoria"
                      ref={i === visiveis.length - 1 ? ultimoCampo : undefined}
                      aria-label={`Subcategoria ${i + 1}`}
                      onChange={e => mudarSub(s.chave, { nome: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarSub() } }} />
                    {!s.ativa ? (
                      <button type="button" className="icone-btn" aria-label={`Reativar ${s.nome}`} title="Reativar"
                        onClick={() => mudarSub(s.chave, { ativa: true })}><IconRefresh size={18} /></button>
                    ) : (
                      <button type="button" className="icone-btn" aria-label={`Remover ${s.nome || 'subcategoria'}`}
                        onClick={() => removerSub(s)}><IconTrash size={18} color="var(--texto-3)" /></button>
                    )}
                  </div>
                ))}
              </div>
              {visiveis.some(s => !s.ativa) && <small className="ajuda">As subcategorias apagadas estão desativadas. Toque em ↻ para reativar.</small>}

              <button type="button" className="btn btn-bloco" onClick={adicionarSub}>
                <IconPlus size={18} />Adicionar subcategoria
              </button>
            </section>

            <section className="cartao formulario">
              <div className="campo">
                <label>Ícone</label>
                <div className="grade-icones">
                  {Object.entries(ICONES).map(([nomeIcone, Ic]) => (
                    <button key={nomeIcone} type="button" aria-label={nomeIcone} aria-pressed={icone === nomeIcone}
                      onClick={() => setIcone(nomeIcone)}
                      style={icone === nomeIcone ? { background: cor, color: '#fff', borderColor: cor } : undefined}>
                      <Ic size={20} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="campo">
                <label>Cor</label>
                <div className="grade-cores">
                  {CORES.map(c => (
                    <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={cor === c}
                      style={{ background: c }} onClick={() => setCor(c)}>
                      {cor === c && <IconCheck size={18} color="#fff" />}
                    </button>
                  ))}
                </div>
              </div>
              {!nova && (
                <label className="interruptor">
                  <input type="checkbox" checked={ativa} onChange={e => setAtiva(e.target.checked)} />
                  <span>Categoria ativa</span>
                </label>
              )}
            </section>

            {erro && <p className="erro">{erro}</p>}
            <button className="btn btn-principal btn-bloco" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            {!nova && (
              <button type="button" className="btn btn-bloco" style={{ color: 'var(--despesa)' }} onClick={excluir}>Excluir categoria</button>
            )}
          </form>
        )}
      </div>
    </>
  )
}
