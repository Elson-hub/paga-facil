import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconCreditCard } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { listarCartoes, faturaDaData, dataCurta, type CartaoComUso } from '../lib/cartoes'
import { reais } from '../lib/formato'

export default function Cartoes() {
  const [cartoes, setCartoes] = useState<CartaoComUso[] | null>(null)
  const [erro, setErro] = useState('')
  const [verInativos, setVerInativos] = useState(false)
  const ir = useNavigate()

  useEffect(() => {
    listarCartoes().then(setCartoes).catch(() => setErro('Não foi possível carregar os cartões.'))
  }, [])

  const visiveis = (cartoes ?? []).filter(c => verInativos ? !c.ativo : c.ativo)
  const inativos = (cartoes ?? []).filter(c => !c.ativo).length

  return (
    <>
      <Topo titulo="Cartões de crédito" />
      <div className="pagina">
        {erro && <p className="erro">{erro}</p>}
        {!cartoes && !erro && <p className="aviso">Carregando…</p>}

        {cartoes && cartoes.length === 0 && (
          <section className="cartao vazio">
            <IconCreditCard size={32} />
            <strong>Nenhum cartão cadastrado</strong>
            <span>Cadastre seus cartões com limite, fechamento e vencimento para controlar as faturas.</span>
            <button className="btn btn-principal" onClick={() => ir('/cartoes/novo')}>Cadastrar cartão</button>
          </section>
        )}

        {inativos > 0 && (
          <div className="segmentos">
            <button className={!verInativos ? 'ativo' : ''} onClick={() => setVerInativos(false)}>Ativos</button>
            <button className={verInativos ? 'ativo' : ''} onClick={() => setVerInativos(true)}>Desativados ({inativos})</button>
          </div>
        )}

        <div className="grade-cartoes">
          {visiveis.map(c => {
            const { fechamento, vencimento } = faturaDaData(c, new Date())
            const uso = c.limite > 0 ? Math.min(100, (c.usado / c.limite) * 100) : 0
            return (
              <button key={c.id} className="cartao-credito" onClick={() => ir(`/cartoes/${c.id}`)}>
                <div className="cc-frente" style={{ background: c.cor || '#1F2933' }}>
                  <div className="cc-topo"><strong>{c.nome}</strong><span>{c.bandeira}</span></div>
                  <div className="cc-datas">
                    <span><small>Fecha</small>{dataCurta(fechamento)}</span>
                    <span><small>Vence</small>{dataCurta(vencimento)}</span>
                  </div>
                </div>
                <div className="cc-limite">
                  <div className="cc-linha"><span>Disponível</span><strong className={c.disponivel < 0 ? 'negativo' : ''}>{reais(c.disponivel)}</strong></div>
                  <div className="barra"><i style={{ width: `${uso}%`, background: uso > 90 ? 'var(--despesa)' : 'var(--principal)' }} /></div>
                  <div className="cc-linha pequeno"><span>Usado {reais(c.usado)}</span><span>Limite {reais(c.limite)}</span></div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <button className="fab" aria-label="Novo cartão" onClick={() => ir('/cartoes/novo')}><IconPlus size={28} /></button>
    </>
  )
}
