import Folha from './Folha'
import type { Escopo } from '../lib/lancamentos'

/** Pergunta se a ação vale só para este lançamento, para os próximos ou para todos da série. */
export default function EscolhaEscopo({ aberta, acao, onEscolher, onFechar }: {
  aberta: boolean
  acao: 'editar' | 'excluir'
  onEscolher: (e: Escopo) => void
  onFechar: () => void
}) {
  const verbo = acao === 'editar' ? 'Alterar' : 'Excluir'
  return (
    <Folha titulo={acao === 'editar' ? 'Aplicar a alteração em' : 'Excluir quais lançamentos?'} aberta={aberta} onFechar={onFechar}>
      <div className="opcoes-escopo">
        <button type="button" className="btn btn-bloco" onClick={() => onEscolher('este')}>{verbo} só este</button>
        <button type="button" className="btn btn-bloco" onClick={() => onEscolher('proximos')}>{verbo} este e os próximos</button>
        <button type="button" className="btn btn-bloco" onClick={() => onEscolher('todos')}>{verbo} todos da série</button>
        {acao === 'editar' && <p className="ajuda">A data e a situação (pago/recebido) mudam só neste lançamento.</p>}
      </div>
    </Folha>
  )
}
