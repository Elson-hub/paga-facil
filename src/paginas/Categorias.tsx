import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconPlus, IconChevronDown, IconChevronRight, IconCategory } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { listarCategorias, IconeCategoria, type CategoriaComSubs, type TipoCategoria } from '../lib/categorias'

export default function Categorias() {
  const [parametros, setParametros] = useSearchParams()
  const tipo: TipoCategoria = parametros.get('tipo') === 'receita' ? 'receita' : 'despesa'
  const [lista, setLista] = useState<CategoriaComSubs[] | null>(null)
  const [erro, setErro] = useState('')
  const [abertas, setAbertas] = useState<Set<string>>(new Set())
  const [verInativas, setVerInativas] = useState(false)
  const ir = useNavigate()

  useEffect(() => {
    setLista(null); setErro('')
    listarCategorias(tipo).then(setLista).catch(() => setErro('Não foi possível carregar as categorias.'))
  }, [tipo])

  const alternar = (id: string) => setAbertas(a => {
    const n = new Set(a)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  const visiveis = (lista ?? []).filter(c => verInativas || c.ativa)
  const temInativas = (lista ?? []).some(c => !c.ativa || c.subcategorias.some(s => !s.ativa))

  return (
    <>
      <Topo titulo="Categorias" />
      <div className="pagina">
        <section className="cartao" style={{ padding: 0 }}>
          <div className="abas" style={{ margin: 0 }}>
            <button className={tipo === 'despesa' ? 'ativa despesa' : ''} onClick={() => setParametros({ tipo: 'despesa' }, { replace: true })}>Despesas</button>
            <button className={tipo === 'receita' ? 'ativa receita' : ''} onClick={() => setParametros({ tipo: 'receita' }, { replace: true })}>Receitas</button>
          </div>

          {erro && <p className="erro" style={{ padding: 16 }}>{erro}</p>}
          {!lista && !erro && <p className="aviso" style={{ padding: 16 }}>Carregando…</p>}

          {lista && visiveis.length === 0 && (
            <div className="vazio">
              <IconCategory size={32} />
              <strong>Nenhuma categoria de {tipo}</strong>
              <button className="btn btn-principal" onClick={() => ir(`/categorias/nova?tipo=${tipo}`)}>Criar categoria</button>
            </div>
          )}

          <div className="lista">
            {visiveis.map(c => {
              const subs = c.subcategorias.filter(s => verInativas || s.ativa)
              const aberta = abertas.has(c.id)
              return (
                <div key={c.id} className={`grupo-cat ${c.ativa ? '' : 'inativa'}`}>
                  <div className="linha-cat">
                    <button className="item-lista" onClick={() => ir(`/categorias/${c.id}`)}>
                      <IconeCategoria icone={c.icone} cor={c.cor} />
                      <span className="nome">{c.nome}
                        <small>
                          {subs.length === 0 ? 'Sem subcategorias' : `${subs.length} subcategoria${subs.length > 1 ? 's' : ''}`}
                          {!c.ativa && ' · desativada'}
                        </small>
                      </span>
                    </button>
                    <button className="icone-btn" aria-label={aberta ? 'Recolher subcategorias' : 'Ver subcategorias'}
                      aria-expanded={aberta} onClick={() => alternar(c.id)}>
                      {aberta ? <IconChevronDown size={20} /> : <IconChevronRight size={20} />}
                    </button>
                  </div>

                  {aberta && (
                    <div className="subs">
                      {subs.map(s => (
                        <button key={s.id} className={`item-sub ${s.ativa ? '' : 'inativa'}`} onClick={() => ir(`/categorias/${s.id}`)}>
                          <span className="ponto" style={{ background: c.cor || '#888780' }} />
                          <span className="nome">{s.nome}{!s.ativa && <small> · desativada</small>}</span>
                          <IconChevronRight size={16} color="var(--texto-3)" />
                        </button>
                      ))}
                      <button className="item-sub novo" onClick={() => ir(`/categorias/nova?tipo=${tipo}&pai=${c.id}`)}>
                        <IconPlus size={16} />Nova subcategoria
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {temInativas && (
          <label className="interruptor">
            <input type="checkbox" checked={verInativas} onChange={e => setVerInativas(e.target.checked)} />
            <span>Mostrar desativadas</span>
          </label>
        )}
      </div>
      <button className="fab" aria-label="Nova categoria" onClick={() => ir(`/categorias/nova?tipo=${tipo}`)}><IconPlus size={28} /></button>
    </>
  )
}
