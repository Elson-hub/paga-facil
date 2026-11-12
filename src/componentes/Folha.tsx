import { useEffect, type ReactNode } from 'react'
import { IconX } from '@tabler/icons-react'

/** Painel que sobe de baixo (no computador, aparece centralizado). */
export default function Folha({ titulo, aberta, onFechar, children }: {
  titulo: string; aberta: boolean; onFechar: () => void; children: ReactNode
}) {
  useEffect(() => {
    if (!aberta) return
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar() }
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = '' }
  }, [aberta, onFechar])

  if (!aberta) return null
  return (
    <div className="folha-fundo" onClick={onFechar}>
      <div className="folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={e => e.stopPropagation()}>
        <div className="folha-topo">
          <strong>{titulo}</strong>
          <button type="button" className="icone-btn" aria-label="Fechar" onClick={onFechar}><IconX size={20} /></button>
        </div>
        <div className="folha-corpo">{children}</div>
      </div>
    </div>
  )
}
