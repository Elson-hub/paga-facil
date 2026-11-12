import { useEffect, useMemo, useState } from 'react'
import { IconChevronRight, IconSearch } from '@tabler/icons-react'
import Folha from './Folha'
import { listarCategorias, IconeCategoria, type CategoriaComSubs, type TipoCategoria } from '../lib/categorias'

interface Props {
  tipo: TipoCategoria
  valor: string | null
  onChange: (id: string) => void
}

/** Campo de categoria: abre a lista de categorias e subcategorias do tipo. */
export default function SeletorCategoria({ tipo, valor, onChange }: Props) {
  const [lista, setLista] = useState<CategoriaComSubs[]>([])
  const [aberta, setAberta] = useState(false)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    listarCategorias(tipo).then(l => setLista(l.filter(c => c.ativa))).catch(() => setLista([]))
  }, [tipo])

  // Encontra a categoria (e a principal, se for subcategoria) escolhida.
  const escolhida = useMemo(() => {
    for (const c of lista) {
      if (c.id === valor) return { principal: c, sub: null }
      const s = c.subcategorias.find(x => x.id === valor)
      if (s) return { principal: c, sub: s }
    }
    return null
  }, [lista, valor])

  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const filtrada = lista.map(c => {
    const subs = c.subcategorias.filter(s => s.ativa)
    if (!termo) return { ...c, subs }
    const casaPrincipal = c.nome.toLocaleLowerCase('pt-BR').includes(termo)
    const subsCasam = subs.filter(s => s.nome.toLocaleLowerCase('pt-BR').includes(termo))
    return casaPrincipal ? { ...c, subs } : subsCasam.length ? { ...c, subs: subsCasam } : null
  }).filter(Boolean) as (CategoriaComSubs & { subs: CategoriaComSubs['subcategorias'] })[]

  const escolher = (id: string) => { onChange(id); setAberta(false); setBusca('') }

  return (
    <>
      <button type="button" className="campo-botao" onClick={() => setAberta(true)} aria-haspopup="dialog">
        {escolhida ? (
          <>
            <IconeCategoria icone={escolhida.principal.icone} cor={escolhida.principal.cor} tamanho={30} />
            <span className="texto">
              {escolhida.sub ? escolhida.sub.nome : escolhida.principal.nome}
              {escolhida.sub && <small>{escolhida.principal.nome}</small>}
            </span>
          </>
        ) : <span className="texto vazio-txt">Escolher categoria</span>}
        <IconChevronRight size={18} color="var(--texto-3)" />
      </button>

      <Folha titulo="Categoria" aberta={aberta} onFechar={() => setAberta(false)}>
        <div className="busca">
          <IconSearch size={18} color="var(--texto-3)" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar categoria" aria-label="Buscar categoria" />
        </div>
        {filtrada.map(c => (
          <div key={c.id} className="opcao-cat">
            <button type="button" className={`opcao-principal ${valor === c.id ? 'marcada' : ''}`} onClick={() => escolher(c.id)}>
              <IconeCategoria icone={c.icone} cor={c.cor} tamanho={34} />
              <span>{c.nome}</span>
            </button>
            {c.subs.length > 0 && (
              <div className="opcao-subs">
                {c.subs.map(s => (
                  <button type="button" key={s.id} className={`chip-opcao ${valor === s.id ? 'marcada' : ''}`}
                    style={valor === s.id ? { background: c.cor || undefined, borderColor: c.cor || undefined } : undefined}
                    onClick={() => escolher(s.id)}>{s.nome}</button>
                ))}
              </div>
            )}
          </div>
        ))}
        {filtrada.length === 0 && <p className="aviso" style={{ padding: 12 }}>Nenhuma categoria encontrada.</p>}
      </Folha>
    </>
  )
}
