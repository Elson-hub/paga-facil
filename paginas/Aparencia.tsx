import { useState } from 'react'
import { IconCheck } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import { useAuth } from '../lib/auth'
import { TEMAS, type ModoCor, type TemaId } from '../lib/temas'

const MODOS: { id: ModoCor; nome: string }[] = [
  { id: 'claro', nome: 'Claro' },
  { id: 'escuro', nome: 'Escuro' },
  { id: 'auto', nome: 'Automático' }
]

export default function Aparencia() {
  const { perfil, atualizarPerfil } = useAuth()
  const [erro, setErro] = useState('')
  const temaAtual = perfil?.tema ?? 'azul'
  const modoAtual = perfil?.modo_cor ?? 'auto'

  async function salvar(dados: { tema?: TemaId; modo_cor?: ModoCor }) {
    setErro('')
    const e = await atualizarPerfil(dados)
    if (e) setErro(e)
  }

  return (
    <>
      <Topo titulo="Aparência" />
      <div className="pagina">
        <section className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2>Cor do app</h2>
          <div className="temas">
            {TEMAS.map(t => (
              <button
                key={t.id}
                className={`tema ${temaAtual === t.id ? 'escolhido' : ''}`}
                onClick={() => salvar({ tema: t.id })}
                aria-pressed={temaAtual === t.id}
              >
                <div className="tema-mini" aria-hidden="true">
                  <div className="t" style={{ background: t.principal }}>Novembro</div>
                  <div className="c">R$ 2.480,00</div>
                  <div className="l"><span>Receitas</span><span style={{ color: t.receita }}>R$ 8.800</span></div>
                  <div className="l"><span>Despesas</span><span style={{ color: t.despesa }}>R$ 3.567</span></div>
                  <div className="f" style={{ background: t.destaque }} />
                </div>
                <span className="tema-nome">
                  {t.nome}
                  {temaAtual === t.id && <IconCheck size={18} color="var(--principal)" />}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2>Modo</h2>
          <div className="segmentos" role="radiogroup" aria-label="Modo de cor">
            {MODOS.map(m => (
              <button key={m.id} role="radio" aria-checked={modoAtual === m.id}
                className={modoAtual === m.id ? 'ativo' : ''} onClick={() => salvar({ modo_cor: m.id })}>
                {m.nome}
              </button>
            ))}
          </div>
          <p className="aviso">Automático segue a configuração do celular ou do computador.</p>
        </section>
        {erro && <p className="erro">{erro}</p>}
      </div>
    </>
  )
}
