import { useMemo, useState } from 'react'
import { IconPlus, IconCheck } from '@tabler/icons-react'
import Folha from './Folha'
import { supabase } from '../lib/supabase'
import { CORES, IconeCategoria, listarCategorias, type CategoriaComSubs, type TipoCategoria } from '../lib/categorias'

interface Props {
  tipo: TipoCategoria
  categorias: CategoriaComSubs[]
  setCategorias: (l: CategoriaComSubs[]) => void
  catId: string
  setCatId: (id: string) => void
  subId: string
  setSubId: (id: string) => void
}

/**
 * Campos Categoria e Subcategoria do lançamento, cada um com um botão +
 * para criar uma nova na hora, sem sair do lançamento.
 */
export default function CamposCategoria({ tipo, categorias, setCategorias, catId, setCatId, subId, setSubId }: Props) {
  const [criando, setCriando] = useState<'categoria' | 'subcategoria' | null>(null)
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState(CORES[0])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const principal = categorias.find(c => c.id === catId)
  const subcategorias = useMemo(
    () => principal?.subcategorias.filter(s => s.ativa || s.id === subId) ?? [],
    [principal, subId]
  )

  function abrir(o: 'categoria' | 'subcategoria') {
    setNome(''); setErro(''); setCor(CORES[categorias.length % CORES.length]); setCriando(o)
  }

  async function criar() {
    const n = nome.trim()
    if (!n) return setErro('Informe o nome.')
    const igual = (x: string) => x.toLocaleLowerCase('pt-BR') === n.toLocaleLowerCase('pt-BR')
    const lista = criando === 'categoria' ? categorias : principal?.subcategorias ?? []
    const existente = lista.find(x => igual(x.nome))
    if (existente) {
      // Já existe: só seleciona (reativando, se estava desativada).
      if (!existente.ativa) await supabase.from('categorias').update({ ativa: true }).eq('id', existente.id)
      await recarregar(criando === 'categoria' ? existente.id : catId, criando === 'subcategoria' ? existente.id : '')
      setCriando(null)
      return
    }
    setErro(''); setSalvando(true)
    const dados = criando === 'categoria'
      ? { nome: n, tipo, icone: 'dots', cor, categoria_pai_id: null }
      : { nome: n, tipo, categoria_pai_id: catId }
    const { data, error } = await supabase.from('categorias').insert(dados).select('id').single()
    setSalvando(false)
    if (error || !data) return setErro('Não foi possível criar. Verifique sua conexão.')
    await recarregar(criando === 'categoria' ? data.id : catId, criando === 'subcategoria' ? data.id : '')
    setCriando(null)
  }

  async function recarregar(novaCat: string, novaSub: string) {
    try {
      const l = await listarCategorias(tipo)
      setCategorias(l.filter(c => c.ativa))
    } catch { /* mantém a lista atual */ }
    setCatId(novaCat)
    setSubId(novaSub)
  }

  return (
    <>
      <div className="campo">
        <label htmlFor="categoria">Categoria</label>
        <div className="linha-com-mais">
          <select id="categoria" value={catId} onChange={e => { setCatId(e.target.value); setSubId('') }}>
            <option value="">Escolher categoria</option>
            {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <button type="button" className="btn-mais" aria-label="Criar categoria" title="Criar categoria" onClick={() => abrir('categoria')}>
            <IconPlus size={20} />
          </button>
        </div>
      </div>

      <div className="campo">
        <label htmlFor="subcategoria">Subcategoria</label>
        <div className="linha-com-mais">
          <select id="subcategoria" value={subId} onChange={e => setSubId(e.target.value)} disabled={!catId || subcategorias.length === 0}>
            <option value="">{!catId ? 'Escolha a categoria primeiro' : subcategorias.length === 0 ? 'Nenhuma ainda — toque no +' : 'Nenhuma (opcional)'}</option>
            {subcategorias.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <button type="button" className="btn-mais" aria-label="Criar subcategoria" title="Criar subcategoria"
            disabled={!catId} onClick={() => abrir('subcategoria')}>
            <IconPlus size={20} />
          </button>
        </div>
      </div>

      <Folha titulo={criando === 'categoria' ? `Nova categoria de ${tipo}` : `Nova subcategoria em ${principal?.nome ?? ''}`}
        aberta={criando !== null} onFechar={() => !salvando && setCriando(null)}>
        <div className="formulario" style={{ padding: '8px 6px' }}>
          <div className="previa-cat">
            <IconeCategoria icone={criando === 'categoria' ? 'dots' : principal?.icone ?? null}
              cor={criando === 'categoria' ? cor : principal?.cor ?? null} tamanho={44} />
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor="nomeNova">Nome</label>
              <input id="nomeNova" value={nome} onChange={e => setNome(e.target.value)} maxLength={40} autoFocus
                placeholder={criando === 'categoria' ? 'Ex.: Filhos, Viagens' : 'Ex.: Escola, Farmácia'}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criar() } }} />
            </div>
          </div>

          {criando === 'categoria' && (
            <div className="campo">
              <label>Cor</label>
              <div className="grade-cores">
                {CORES.map(c => (
                  <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={cor === c} style={{ background: c }} onClick={() => setCor(c)}>
                    {cor === c && <IconCheck size={18} color="#fff" />}
                  </button>
                ))}
              </div>
              <small className="ajuda">O ícone e as subcategorias podem ser ajustados depois em Menu → Categorias.</small>
            </div>
          )}

          {erro && <p className="erro">{erro}</p>}
          <button type="button" className="btn btn-principal btn-bloco" disabled={salvando} onClick={criar}>
            {salvando ? 'Criando…' : criando === 'categoria' ? 'Criar e usar esta categoria' : 'Criar e usar esta subcategoria'}
          </button>
        </div>
      </Folha>
    </>
  )
}
