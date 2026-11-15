import { useEffect, useState, type FormEvent } from 'react'
import { IconPlus, IconPencil, IconTrash, IconCheck, IconX, IconTag } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { supabase } from '../lib/supabase'

const CORES_TAG = ['#1E5BD8', '#5B3FD1', '#D4537E', '#D64545', '#E8833A', '#E5A50A', '#1F9D55', '#2F9E8F', '#5F6B7A']

interface Tag { id: string; nome: string; cor: string | null; usos: number }

function SeletorCor({ valor, onChange }: { valor: string; onChange: (c: string) => void }) {
  return (
    <div className="grade-cores pequena">
      {CORES_TAG.map(c => (
        <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={valor === c} style={{ background: c }} onClick={() => onChange(c)}>
          {valor === c && <IconCheck size={14} color="#fff" />}
        </button>
      ))}
    </div>
  )
}

const mensagemErro = (e: { code?: string } | null) =>
  e?.code === '23505' ? 'Já existe uma tag com esse nome.' : 'Não foi possível salvar. Verifique sua conexão.'

export default function Tags() {
  const [tags, setTags] = useState<Tag[] | null>(null)
  const [erro, setErro] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [novaCor, setNovaCor] = useState(CORES_TAG[0])
  const [editando, setEditando] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editCor, setEditCor] = useState(CORES_TAG[0])

  async function carregar() {
    const [t, usos] = await Promise.all([
      supabase.from('tags').select('id, nome, cor').order('nome'),
      supabase.from('lancamento_tags').select('tag_id')
    ])
    if (t.error) return setErro('Não foi possível carregar as tags.')
    const contagem = new Map<string, number>()
    for (const u of usos.data ?? []) contagem.set(u.tag_id, (contagem.get(u.tag_id) ?? 0) + 1)
    setTags((t.data ?? []).map(x => ({ ...x, usos: contagem.get(x.id) ?? 0 }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
  }
  useEffect(() => { carregar() }, [])

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!novoNome.trim()) return
    setErro('')
    const { error } = await supabase.from('tags').insert({ nome: novoNome.trim(), cor: novaCor })
    if (error) return setErro(mensagemErro(error))
    setNovoNome('')
    carregar()
  }

  function comecarEdicao(t: Tag) {
    setEditando(t.id); setEditNome(t.nome); setEditCor(t.cor || CORES_TAG[0]); setErro('')
  }

  async function salvarEdicao() {
    if (!editando || !editNome.trim()) return
    const { error } = await supabase.from('tags').update({ nome: editNome.trim(), cor: editCor }).eq('id', editando)
    if (error) return setErro(mensagemErro(error))
    setEditando(null)
    carregar()
  }

  async function excluir(t: Tag) {
    const aviso = t.usos > 0
      ? `A tag "${t.nome}" está em ${t.usos} lançamento(s). Ao excluir, ela é retirada deles (os lançamentos continuam). Excluir?`
      : `Excluir a tag "${t.nome}"?`
    if (!window.confirm(aviso)) return
    const { error } = await supabase.from('tags').delete().eq('id', t.id)
    if (error) return setErro('Não foi possível excluir.')
    carregar()
  }

  return (
    <>
      <Topo titulo="Tags" />
      <div className="pagina">
        <form className="cartao formulario" onSubmit={criar}>
          <h2>Nova tag</h2>
          <p className="aviso">Tags são marcadores livres para agrupar lançamentos de categorias diferentes. Ex.: "Viagem Natal", "Reforma", "Trabalho".</p>
          <div className="linha-nova-tag">
            <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome da tag" maxLength={30} aria-label="Nome da nova tag" />
            <button className="btn btn-principal" disabled={!novoNome.trim()}><IconPlus size={18} />Criar</button>
          </div>
          <SeletorCor valor={novaCor} onChange={setNovaCor} />
        </form>

        {erro && <p className="erro">{erro}</p>}

        <section className="cartao lista">
          {!tags && <p className="aviso" style={{ padding: 8 }}>Carregando…</p>}
          {tags && tags.length === 0 && (
            <div className="vazio"><IconTag size={28} /><span>Nenhuma tag ainda.</span></div>
          )}
          {tags?.map(t => editando === t.id ? (
            <div key={t.id} className="linha-tag editando">
              <div className="linha-nova-tag">
                <input value={editNome} onChange={e => setEditNome(e.target.value)} maxLength={30} autoFocus aria-label="Nome da tag"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarEdicao() } if (e.key === 'Escape') setEditando(null) }} />
                <button type="button" className="icone-btn" aria-label="Salvar" onClick={salvarEdicao}><IconCheck size={20} color="var(--receita)" /></button>
                <button type="button" className="icone-btn" aria-label="Cancelar" onClick={() => setEditando(null)}><IconX size={20} /></button>
              </div>
              <SeletorCor valor={editCor} onChange={setEditCor} />
            </div>
          ) : (
            <div key={t.id} className="linha-tag">
              <span className="tag" style={{ background: t.cor || CORES_TAG[0] }}>{t.nome}</span>
              <small>{t.usos === 0 ? 'Não usada' : `${t.usos} lançamento${t.usos > 1 ? 's' : ''}`}</small>
              <button className="icone-btn" aria-label={`Editar ${t.nome}`} onClick={() => comecarEdicao(t)}><IconPencil size={18} /></button>
              <button className="icone-btn" aria-label={`Excluir ${t.nome}`} onClick={() => excluir(t)}><IconTrash size={18} color="var(--texto-3)" /></button>
            </div>
          ))}
        </section>
      </div>
    </>
  )
}
