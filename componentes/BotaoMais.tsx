import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconPlus, IconArrowsExchange, IconMinus, IconCreditCard } from '@tabler/icons-react'

/** Botão + flutuante com as quatro opções de lançamento. */
export default function BotaoMais() {
  const [aberto, setAberto] = useState(false)
  const ir = useNavigate()
  const escolher = (rota: string) => { setAberto(false); ir(rota) }

  return (
    <>
      {aberto && (
        <>
          <div className="fab-fundo" onClick={() => setAberto(false)} />
          <div className="fab-menu" role="menu">
            <button onClick={() => escolher('/novo/transferencia')}>
              <IconArrowsExchange size={20} color="#E5A50A" />Transferência
            </button>
            <button onClick={() => escolher('/novo/receita')}>
              <IconPlus size={20} color="var(--receita)" />Receita
            </button>
            <button onClick={() => escolher('/novo/despesa')}>
              <IconMinus size={20} color="var(--despesa)" />Despesa
            </button>
            <button onClick={() => escolher('/novo/despesa-cartao')}>
              <IconCreditCard size={20} color="var(--principal)" />Despesa cartão
            </button>
          </div>
        </>
      )}
      <button
        className={`fab ${aberto ? 'aberto' : ''}`}
        aria-label={aberto ? 'Fechar' : 'Novo lançamento'}
        onClick={() => setAberto(a => !a)}
      >
        <IconPlus size={28} />
      </button>
    </>
  )
}
