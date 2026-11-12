import { useEffect, useState, type FormEvent } from 'react'
import Topo from '../componentes/Topo'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function MinhaConta() {
  const { sessao, perfil, atualizarPerfil, sair } = useAuth()
  const [nome, setNome] = useState('')
  const [msgNome, setMsgNome] = useState('')
  const [senha, setSenha] = useState('')
  const [msgSenha, setMsgSenha] = useState<{ ok: boolean; texto: string } | null>(null)

  useEffect(() => { setNome(perfil?.nome ?? '') }, [perfil?.nome])

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

        <button className="btn btn-bloco" onClick={sair} style={{ color: 'var(--despesa)' }}>Sair da conta</button>
      </div>
    </>
  )
}
