import { useEffect, useRef, useState } from 'react'
import { IconFaceId, IconLock } from '@tabler/icons-react'
import { nomeBiometria, pedirBiometria } from '../lib/bloqueio'

/** Tela que cobre o app até a biometria ser confirmada. */
export default function TelaBloqueio({ usuarioId, onDesbloquear, onEntrarComSenha }: {
  usuarioId: string
  onDesbloquear: () => void
  onEntrarComSenha: () => void
}) {
  const [erro, setErro] = useState('')
  const [pedindo, setPedindo] = useState(false)
  const tentouSozinho = useRef(false)
  const nome = nomeBiometria()

  async function desbloquear() {
    setErro(''); setPedindo(true)
    try {
      await pedirBiometria(usuarioId)
      onDesbloquear()
    } catch {
      setErro(`Não foi possível confirmar o ${nome}. Tente de novo.`)
    }
    setPedindo(false)
  }

  // Tenta abrir o Face ID sozinho ao mostrar a tela (alguns aparelhos exigem o toque no botão).
  useEffect(() => {
    if (tentouSozinho.current) return
    tentouSozinho.current = true
    pedirBiometria(usuarioId).then(onDesbloquear).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="tela-bloqueio">
      <div className="entrada-logo">R$</div>
      <h1>Paga Fácil</h1>
      <p><IconLock size={16} style={{ verticalAlign: '-2px' }} /> Bloqueado</p>
      <button className="btn btn-bloco btn-desbloquear" onClick={desbloquear} disabled={pedindo}>
        <IconFaceId size={22} />{pedindo ? 'Aguardando…' : `Desbloquear com ${nome}`}
      </button>
      {erro && <p className="erro-bloqueio">{erro}</p>}
      <button className="link-senha" onClick={onEntrarComSenha}>Entrar com e-mail e senha</button>
    </div>
  )
}
