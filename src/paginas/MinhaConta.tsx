import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconAlertTriangle } from '@tabler/icons-react'
import Topo from '../componentes/Topo'
import Folha from '../componentes/Folha'
import { redefinirConta } from '../lib/redefinir'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { biometriaDisponivel, bloqueioAtivo, ativarBloqueio, desativarBloqueio, nomeBiometria } from '../lib/bloqueio'

export default function MinhaConta() {
  const { sessao, perfil, atualizarPerfil, sair } = useAuth()
  const [nome, setNome] = useState('')
  const [msgNome, setMsgNome] = useState('')
  const [senha, setSenha] = useState('')
  const [msgSenha, setMsgSenha] = useState<{ ok: boolean; texto: string } | null>(null)

  const uid = sessao?.user.id
  const [temBiometria, setTemBiometria] = useState<boolean | null>(null)
  const [travaLigada, setTravaLigada] = useState(bloqueioAtivo(uid))
  const [msgTrava, setMsgTrava] = useState<{ ok: boolean; texto: string } | null>(null)
  const biometria = nomeBiometria()
  const ir = useNavigate()
  const [redefinindo, setRedefinindo] = useState(false)
  const [confirmacao, setConfirmacao] = useState('')
  const [apagando, setApagando] = useState(false)
  const [msgRedefinir, setMsgRedefinir] = useState<{ ok: boolean; texto: string } | null>(null)
  const PALAVRA = 'APAGAR'

  async function confirmarRedefinicao() {
    if (confirmacao.trim().toUpperCase() !== PALAVRA) return
    setApagando(true); setMsgRedefinir(null)
    try {
      await redefinirConta()
      setRedefinindo(false); setConfirmacao('')
      window.alert('Pronto. O Paga Fácil voltou às configurações de fábrica.')
      ir('/', { replace: true })
    } catch {
      setMsgRedefinir({ ok: false, texto: 'Não foi possível redefinir. Nada foi apagado. Verifique sua conexão e tente de novo.' })
    }
    setApagando(false)
  }

  useEffect(() => { setNome(perfil?.nome ?? '') }, [perfil?.nome])
  useEffect(() => { biometriaDisponivel().then(setTemBiometria) }, [])
  useEffect(() => { setTravaLigada(bloqueioAtivo(uid)) }, [uid])

  async function alternarTrava(ligar: boolean) {
    if (!uid) return
    setMsgTrava(null)
    if (!ligar) {
      desativarBloqueio(uid); setTravaLigada(false)
      setMsgTrava({ ok: true, texto: 'Bloqueio desligado neste aparelho.' })
      return
    }
    try {
      await ativarBloqueio(uid, sessao?.user.email ?? 'usuario')
      setTravaLigada(true)
      setMsgTrava({ ok: true, texto: `Pronto! Ao abrir o app, ele vai pedir o ${biometria}.` })
    } catch {
      setMsgTrava({ ok: false, texto: `Não foi possível ativar o ${biometria}. Confira se ele está ligado nos ajustes do aparelho e tente de novo.` })
    }
  }

  async function salvarNome(e: FormEvent) {
    e.preventDefault()
    const erro = await atualizarPerfil({ nome: nome.trim() })
    setMsgNome(erro ?? 'Nome salvo.')
  }

  async function trocarSenha(e: FormEvent) {
    e.preventDefault()
    if (senha.length < 6) return setMsgSenha({ ok: false, texto: 'A senha precisa ter pelo menos 6 caracteres.' })
    const { error } = await supabase.auth.updateUser({ password: senha })
    setSenha('')
    setMsgSenha(error ? { ok: false, texto: 'Não foi possível trocar a senha.' } : { ok: true, texto: 'Senha alterada.' })
  }

  return (
    <>
      <Topo titulo="Minha conta" />
      <div className="pagina">
        <form className="cartao" onSubmit={salvarNome} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2>Dados</h2>
          <div className="campo"><label htmlFor="nome">Nome</label>
            <input id="nome" value={nome} onChange={e => { setNome(e.target.value); setMsgNome('') }} /></div>
          <div className="campo"><label htmlFor="email">E-mail</label>
            <input id="email" value={sessao?.user.email ?? ''} disabled /></div>
          {msgNome && <p className="aviso">{msgNome}</p>}
          <button className="btn btn-principal">Salvar</button>
        </form>

        <form className="cartao" onSubmit={trocarSenha} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h2>Trocar senha</h2>
          <div className="campo"><label htmlFor="senha">Nova senha</label>
            <input id="senha" type="password" autoComplete="new-password" value={senha}
              onChange={e => { setSenha(e.target.value); setMsgSenha(null) }} placeholder="Mínimo de 6 caracteres" /></div>
          {msgSenha && <p className={msgSenha.ok ? 'sucesso' : 'erro'}>{msgSenha.texto}</p>}
          <button className="btn">Trocar senha</button>
        </form>

        <section className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Segurança</h2>
          {temBiometria === false ? (
            <p className="aviso">Este aparelho ou navegador não oferece {biometria} para o app. No iPhone, use o app instalado na tela de início (iOS 16 ou mais novo).</p>
          ) : (
            <>
              <label className="interruptor linha-interruptor">
                <span>Bloquear com {biometria}</span>
                <input type="checkbox" role="switch" checked={travaLigada} disabled={temBiometria === null}
                  onChange={e => alternarTrava(e.target.checked)} />
              </label>
              <small className="ajuda">
                Ao abrir o app, ou ao voltar depois de 1 minuto fora dele, o {biometria} é pedido. Vale só para este aparelho.
              </small>
            </>
          )}
          {msgTrava && <p className={msgTrava.ok ? 'sucesso' : 'erro'}>{msgTrava.texto}</p>}
        </section>

        <button className="btn btn-bloco" onClick={sair} style={{ color: 'var(--despesa)' }}>Sair da conta</button>

        <section className="cartao zona-perigo">
          <h2>Configurações de fábrica</h2>
          <p className="aviso">Apaga todos os seus dados financeiros e deixa o app como no primeiro acesso.</p>
          <button className="btn btn-bloco btn-perigo" onClick={() => { setConfirmacao(''); setMsgRedefinir(null); setRedefinindo(true) }}>
            Redefinir para configurações de fábrica
          </button>
        </section>

        <Folha titulo="Redefinir o Paga Fácil?" aberta={redefinindo} onFechar={() => !apagando && setRedefinindo(false)}>
          <div className="formulario" style={{ padding: '8px 6px' }}>
            <div className="alerta-perigo">
              <IconAlertTriangle size={22} />
              <div>
                <strong>Esta ação apaga tudo e não pode ser desfeita.</strong>
                <ul>
                  <li>Todos os lançamentos (receitas, despesas, compras no cartão) e seus anexos</li>
                  <li>Contas bancárias, cartões, faturas e pagamentos</li>
                  <li>Transferências e tags</li>
                  <li>Suas categorias: voltam a ser as padrão, com as subcategorias sugeridas</li>
                </ul>
                <small>Continuam: seu login, nome, cor do app e o bloqueio com {biometria}.</small>
              </div>
            </div>
            <div className="campo">
              <label htmlFor="confirma">Para confirmar, digite <b>{PALAVRA}</b></label>
              <input id="confirma" value={confirmacao} onChange={e => setConfirmacao(e.target.value)} autoComplete="off" autoCapitalize="characters" />
            </div>
            {msgRedefinir && <p className={msgRedefinir.ok ? 'sucesso' : 'erro'}>{msgRedefinir.texto}</p>}
            <button type="button" className="btn btn-bloco btn-perigo-cheio" onClick={confirmarRedefinicao}
              disabled={apagando || confirmacao.trim().toUpperCase() !== PALAVRA}>
              {apagando ? 'Apagando…' : 'Apagar tudo e redefinir'}
            </button>
            <button type="button" className="btn btn-bloco" onClick={() => setRedefinindo(false)} disabled={apagando}>Cancelar</button>
          </div>
        </Folha>
      </div>
    </>
  )
}
