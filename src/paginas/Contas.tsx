import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconBuildingBank, IconChevronRight } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { listarContas, categoriaConta, type ContaComSaldo } from '../lib/contas'
import { reais } from '../lib/formato'

export default function Contas() {
  const [contas, setContas] = useState<ContaComSaldo[] | null>(null)
  const [erro, setErro] = useState('')
  const [verInativas, setVerInativas] = useState(false)
  const ir = useNavigate()

  useEffect(() => {
    listarContas().then(setContas).catch(() => setErro('Não foi possível carregar as contas.'))
  }, [])

  const ativas = (contas ?? []).filter(c => c.ativa)
  const inativas = (contas ?? []).filter(c => !c.ativa)
  const lista = verInativas ? inativas : ativas
  const total = ativas.reduce((s, c) => s + c.saldo_atual, 0)
  const totalCheque = ativas.reduce((s, c) => s + c.limite_cheque_especial, 0)

  return (
    <>
      <Topo titulo="Contas bancárias" />
      <div className="pagina">
        {erro && <p className="erro">{erro}</p>}
        {!contas && !erro && <p className="aviso">Carregando…</p>}

        {contas && contas.length === 0 && (
          <section className="cartao vazio">
            <IconBuildingBank size={32} />
            <strong>Nenhuma conta cadastrada</strong>
            <span>Cadastre sua conta corrente, poupança ou a carteira com o saldo de hoje.</span>
            <button className="btn btn-principal" onClick={() => ir('/contas/nova')}>Cadastrar conta</button>
          </section>
        )}

        {contas && contas.length > 0 && (
          <>
            <section className="cartao resumo-contas">
              <div><small>Saldo em contas</small><strong className={total < 0 ? 'negativo' : ''}>{reais(total)}</strong></div>
              {totalCheque > 0 && <div><small>Disponível com cheque especial</small><span>{reais(total + totalCheque)}</span></div>}
            </section>

            {inativas.length > 0 && (
              <div className="segmentos">
                <button className={!verInativas ? 'ativo' : ''} onClick={() => setVerInativas(false)}>Ativas ({ativas.length})</button>
                <button className={verInativas ? 'ativo' : ''} onClick={() => setVerInativas(true)}>Desativadas ({inativas.length})</button>
              </div>
            )}

            <section className="cartao lista">
              {lista.map(c => {
                const cat = categoriaConta(c.tipo)
                return (
                  <button key={c.id} className="item-lista" onClick={() => ir(`/contas/${c.id}`)}>
                    <span className="bolinha" style={{ background: cat.cor }}><IconBuildingBank size={20} /></span>
                    <span className="nome">{c.descricao}
                      <small>{cat.nome}{c.limite_cheque_especial > 0 ? ` · cheque especial ${reais(c.limite_cheque_especial)}` : ''}</small>
                    </span>
                    <span className={`valor ${c.saldo_atual < 0 ? 'negativo' : ''}`}>{reais(c.saldo_atual)}</span>
                    <IconChevronRight size={18} color="var(--texto-3)" />
                  </button>
                )
              })}
              {lista.length === 0 && <p className="aviso" style={{ padding: 8 }}>Nenhuma conta aqui.</p>}
            </section>
          </>
        )}
      </div>
      <button className="fab" aria-label="Nova conta" onClick={() => ir('/contas/nova')}><IconPlus size={28} /></button>
    </>
  )
}
