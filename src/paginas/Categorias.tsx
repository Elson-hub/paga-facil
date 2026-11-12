import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { IconPlus, IconChevronRight, IconCategory } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { listarCategorias, IconeCategoria, type CategoriaComSubs, type TipoCategoria } from '../lib/categorias'

export default function Categorias() {
  const [parametros, setParametros] = useSearchParams()
  const tipo: TipoCategoria = parametros.get('tipo') === 'receita' ? 'receita' : 'despesa'
  const [lista, setLista] = useState<CategoriaComSubs[] | null>(null)
  const [erro, setErro] = useState('')
  const [verInativas, setVerInativas] = useState(false)
  const ir = useNavigate()

  useEffect(() => {
    setLista(null); setErro('')
    listarCategorias(tipo).then(setLista).catch(() => setErro('Não foi possível carregar as categorias.'))
  }, [tipo])

  const visiveis = (lista ?? []).filter(c => verInativas || c.ativa)
  const temInativas = (lista ?? []).some(c => !c.ativa)

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
              const subs = c.subcategorias.filter(s => s.ativa)
              return (
                <button key={c.id} className={`item-lista item-cat ${c.ativa ? '' : 'inativa'}`} onClick={() => ir(`/categorias/${c.id}`)}>
                  <IconeCategoria icone={c.icone} cor={c.cor} />
                  <span className="nome">
                    {c.nome}{!c.ativa && <small style={{ display: 'inline' }}> · desativada</small>}
                    {subs.length > 0 ? (
                      <span className="chips">
                        {subs.map(s => <span key={s.id} className="chip">{s.nome}</span>)}
                      </span>
                    ) : <small>Sem subcategorias</small>}
                  </span>
                  <IconChevronRight size={18} color="var(--texto-3)" />
                </button>
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
