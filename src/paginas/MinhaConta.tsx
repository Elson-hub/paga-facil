import { useEffect, useState, type FormEvent } from 'react'
import Topo from '../componentes/Topo'
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
      </div>
    </>
  )
}
