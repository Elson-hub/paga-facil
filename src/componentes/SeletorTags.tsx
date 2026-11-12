import { useEffect, useState } from 'react'
import { IconPlus } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'

interface Tag { id: string; nome: string; cor: string | null }

/** Tags do lançamento: toca para marcar/desmarcar; dá para criar uma nova na hora. */
export default function SeletorTags({ valor, onChange }: { valor: string[]; onChange: (ids: string[]) => void }) {
  const [tags, setTags] = useState<Tag[]>([])
  const [nova, setNova] = useState('')
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('tags').select('id, nome, cor').order('nome').then(({ data }) => setTags(data ?? []))
  }, [])

  const alternar = (id: string) => onChange(valor.includes(id) ? valor.filter(v => v !== id) : [...valor, id])

  async function criar() {
    const nome = nova.trim()
    if (!nome) return
    setErro('')
    const existente = tags.find(t => t.nome.toLocaleLowerCase('pt-BR') === nome.toLocaleLowerCase('pt-BR'))
    if (existente) { if (!valor.includes(existente.id)) onChange([...valor, existente.id]); setNova(''); setCriando(false); return }
    const { data, error } = await supabase.from('tags').insert({ nome, cor: '#5F6B7A' }).select('id, nome, cor').single()
    if (error || !data) return setErro('Não foi possível criar a tag.')
    setTags(t => [...t, data])
    onChange([...valor, data.id])
    setNova(''); setCriando(false)
  }

  return (
    <div className="seletor-tags">
      {tags.map(t => {
        const marcada = valor.includes(t.id)
        return (
          <button key={t.id} type="button" aria-pressed={marcada} className={`chip-opcao ${marcada ? 'marcada' : ''}`}
            style={marcada ? { background: t.cor || '#5F6B7A', borderColor: t.cor || '#5F6B7A' } : undefined}
            onClick={() => alternar(t.id)}>{t.nome}</button>
        )
      })}
      {criando ? (
        <span className="nova-tag-inline">
          <input value={nova} onChange={e => setNova(e.target.value)} placeholder="Nova tag" maxLength={30} autoFocus aria-label="Nome da nova tag"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); criar() } if (e.key === 'Escape') setCriando(false) }}
            onBlur={() => { if (!nova.trim()) setCriando(false) }} />
          <button type="button" className="btn" onClick={criar}>Criar</button>
        </span>
      ) : (
        <button type="button" className="chip-opcao adicionar" onClick={() => setCriando(true)}><IconPlus size={14} />Tag</button>
      )}
      {erro && <p className="erro">{erro}</p>}
    </div>
  )
}
