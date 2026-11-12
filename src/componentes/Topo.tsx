import type { ReactNode } from 'react'
import { IconMenu2 } from '@tabler/icons-react'
import { useAbrirMenu } from './Layout'

interface Props {
  titulo?: string
  /** Substitui o botão do menu (ex.: botão Voltar). */
  esquerda?: ReactNode
  centro?: ReactNode
  direita?: ReactNode
  estendido?: boolean
}

/** Cabeçalho colorido com o botão do menu (só aparece no celular). */
export default function Topo({ titulo, esquerda, centro, direita, estendido }: Props) {
  const abrirMenu = useAbrirMenu()
  return (
    <header className={`topo ${estendido ? 'estendido' : ''}`}>
      {esquerda ?? (
        <button className="icone-btn so-celular" aria-label="Abrir menu" onClick={abrirMenu}>
          <IconMenu2 size={22} />
        </button>
      )}
      {centro ?? <h1>{titulo}</h1>}
      {direita ?? <span className="espaco" />}
    </header>
  )
}
