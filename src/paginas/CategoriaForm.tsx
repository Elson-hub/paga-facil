import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { supabase } from '../lib/supabase'
import {
  ICONES, CORES, IconeCategoria, listarCategorias, categoriaEmUso,
  type CategoriaComSubs, type TipoCategoria
} from '../lib/categorias'

export default function CategoriaForm() {
  const { id } = useParams()
  const [parametros] = useSearchParams()
  const nova = !id
  const ir = useNavigate()

  const [tipo, setTipo] = useState<TipoCategoria>(parametros.get('tipo') === 'receita' ? 'receita' : 'despesa')
  const [nome, setNome] = useState('')
  const [paiId, setPaiId] = useState(parametros.get('pai') ?? '')
  const [icone, setIcone] = useState('dots')
  const [cor, setCor] = useState(CORES[0])
  const [ativa, setAtiva] = useState(true)
  const [principais, setPrincipais] = useState<CategoriaComSubs[]>([])
  const [temSubs, setTemSubs] = useState(false)
  const [carregando, setCarregando] = useState(!nova)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  // Ao editar: carrega a categoria.
  useEffect(() => {
    if (nova) return
    supabase.from('categorias').select('nome, tipo, icone, cor, categoria_pai_id, ativa').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErro('Categoria não encontrada.'); setCarregando(false); return }
        setNome(data.nome); setTipo(data.tipo); setPaiId(data.categoria_pai_id ?? '')
        setIcone(data.icone || 'dots'); setCor(data.cor || CORES[0]); setAtiva(data.ativa)
        setCarregando(false)
      })
  }, [id, nova])

  // Categorias principais do tipo (para escolher de qual esta é subcategoria).
  useEffect(() => {
    listarCategorias(tipo).then(lista => {
      setPrincipais(lista.filter(c => c.id !== id))
      setTemSubs(!!id && (lista.find(c => c.id === id)?.subcategorias.length ?? 0) > 0)
    }).catch(() => setPrincipais([]))
  }, [tipo, id])

  const ehSub = paiId !== ''
  const pai = principais.find(c => c.id === paiId)
  const titulo = nova ? (ehSub ? 'Nova subcategoria' : 'Nova categoria') : (ehSub ? 'Editar subcategoria' : 'Editar categoria')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Informe o nome.')
    setErro(''); setSalvando(true)
    const dados = {
      nome: nome.trim(), tipo, ativa,
      categoria_pai_id: ehSub ? paiId : null,
      icone: ehSub ? null : icone,
      cor: ehSub ? null : cor
    }
    const { error } = nova
      ? await supabase.from('categorias').insert(dados)
      : await supabase.from('categorias').update(dados).eq('id', id)
    setSalvando(false)
    if (error) return setErro('Não foi possível salvar. Verifique sua conexão e tente de novo.')
    ir(`/categorias?tipo=${tipo}`, { replace: true })
  }

  async function excluir() {
    if (!id) return
    setErro('')
    const { data: subs } = await supabase.from('categorias').select('id').eq('categoria_pai_id', id)
    const ids = [id, ...(subs ?? []).map(s => s.id)]
    if (await categoriaEmUso(ids)) {
      if (window.confirm('Esta categoria já foi usada em lançamentos, por isso não pode ser excluída. Deseja desativá-la? Ela deixa de aparecer para novos lançamentos, mas o histórico é mantido.')) {
        const { error } = await supabase.from('categorias').update({ ativa: false }).in('id', ids)
        if (error) return setErro('Não foi possível desativar.')
        ir(`/categorias?tipo=${tipo}`, { replace: true })
      }
      return
    }
    const aviso = ids.length > 1
      ? `Excluir "${nome}" e suas ${ids.length - 1} subcategoria(s)? Esta ação não pode ser desfeita.`
      : `Excluir "${nome}"? Esta ação não pode ser desfeita.`
    if (!window.confirm(aviso)) return
    const { error } = await supabase.from('categorias').delete().eq('id', id)
    if (error) return setErro('Não foi possível excluir.')
    ir(`/categorias?tipo=${tipo}`, { replace: true })
  }

  const voltar = (
    <button className="icone-btn" aria-label="Voltar" onClick={() => ir(`/categorias?tipo=${tipo}`)}><IconArrowLeft size={22} /></button>
  )

  return (
    <>
      <Topo titulo={titulo} esquerda={voltar} />
      <div className="pagina">
        {carregando ? <p className="aviso">Carregando…</p> : (
          <form className="cartao formulario" onSubmit={salvar}>
            {nova && !ehSub && (
              <div className="segmentos" role="radiogroup" aria-label="Tipo">
                <button type="button" role="radio" aria-checked={tipo === 'despesa'} className={tipo === 'despesa' ? 'ativo' : ''}
                  onClick={() => { setTipo('despesa'); setPaiId('') }}>Despesa</button>
                <button type="button" role="radio" aria-checked={tipo === 'receita'} className={tipo === 'receita' ? 'ativo' : ''}
                  onClick={() => { setTipo('receita'); setPaiId('') }}>Receita</button>
              </div>
            )}

            <div className="previa-cat">
              <IconeCategoria icone={ehSub ? pai?.icone ?? null : icone} cor={ehSub ? pai?.cor ?? null : cor} tamanho={48} />
              <div>
                <strong>{nome || (ehSub ? 'Subcategoria' : 'Categoria')}</strong>
                <small>{ehSub && pai ? `Subcategoria de ${pai.nome}` : `Categoria de ${tipo}`}</small>
              </div>
            </div>

            <div className="campo">
              <label htmlFor="nome">Nome</label>
              <input id="nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={40}
                placeholder={ehSub ? 'Ex.: Supermercado, Restaurante' : 'Ex.: Alimentação, Moradia'} autoFocus={nova} />
            </div>

            <div className="campo">
              <label htmlFor="pai">Subcategoria de</label>
              <select id="pai" value={paiId} onChange={e => setPaiId(e.target.value)} disabled={temSubs}>
                <option value="">Nenhuma (é uma categoria principal)</option>
                {principais.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              {temSubs && <small className="ajuda">Esta categoria tem subcategorias, por isso continua como principal.</small>}
            </div>

            {!ehSub && (
              <>
                <div className="campo">
                  <label>Ícone</label>
                  <div className="grade-icones">
                    {Object.entries(ICONES).map(([nomeIcone, Ic]) => (
                      <button key={nomeIcone} type="button" aria-label={nomeIcone} aria-pressed={icone === nomeIcone}
                        className={icone === nomeIcone ? 'escolhido' : ''} onClick={() => setIcone(nomeIcone)}
                        style={icone === nomeIcone ? { background: cor, color: '#fff' } : undefined}>
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
              </>
            )}
            {ehSub && <small className="ajuda">A subcategoria usa o ícone e a cor da categoria principal.</small>}

            {!nova && (
              <label className="interruptor">
                <input type="checkbox" checked={ativa} onChange={e => setAtiva(e.target.checked)} />
                <span>{ehSub ? 'Subcategoria ativa' : 'Categoria ativa'}</span>
              </label>
            )}

            {erro && <p className="erro">{erro}</p>}

            <button className="btn btn-principal btn-bloco" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            {!nova && (
              <button type="button" className="btn btn-bloco" style={{ color: 'var(--despesa)' }} onClick={excluir}>Excluir</button>
            )}
          </form>
        )}
      </div>
    </>
  )
}
