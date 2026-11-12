import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, urlDoApp } from '../lib/supabase'
import { useAuth } from '../lib/auth'

function Moldura({ subtitulo, children }: { subtitulo: string; children: ReactNode }) {
  return (
    <div className="entrada">
      <div className="entrada-topo">
        <div className="entrada-logo">R$</div>
        <h1>Paga Fácil</h1>
        <p>{subtitulo}</p>
      </div>
      <div className="entrada-cartao">{children}</div>
    </div>
  )
}

function traduzirErro(msg: string) {
  if (/invalid login credentials/i.test(msg)) return 'E-mail ou senha incorretos.'
  if (/email not confirmed/i.test(msg)) return 'Confirme seu e-mail antes de entrar. Veja sua caixa de entrada.'
  if (/already registered/i.test(msg)) return 'Já existe uma conta com este e-mail.'
  if (/password should be at least/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (/rate limit/i.test(msg)) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
  return 'Não foi possível concluir. Verifique os dados e sua conexão.'
}

export function Entrar() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha })
    setEnviando(false)
    if (error) setErro(traduzirErro(error.message))
  }

  return (
    <Moldura subtitulo="Entre para ver suas finanças">
      <form onSubmit={enviar} style={{ display: 'contents' }}>
        <div className="campo"><label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></div>
        <div className="campo"><label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} /></div>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn btn-principal btn-bloco" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
      <div className="entrada-links">
        <Link to="/criar-conta">Criar conta</Link>
        <Link to="/esqueci-senha">Esqueci minha senha</Link>
      </div>
    </Moldura>
  )
}

export function CriarConta() {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [pronto, setPronto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== confirma) return setErro('As senhas não conferem.')
    setErro(''); setEnviando(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(), password: senha,
      options: { data: { nome: nome.trim() }, emailRedirectTo: urlDoApp() }
    })
    setEnviando(false)
    if (error) return setErro(traduzirErro(error.message))
    if (!data.session) setPronto(true) // precisa confirmar o e-mail
  }

  if (pronto) return (
    <Moldura subtitulo="Quase lá">
      <p>Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail e toque no link para ativar sua conta.</p>
      <Link className="btn btn-bloco" to="/">Voltar para o login</Link>
    </Moldura>
  )

  return (
    <Moldura subtitulo="Crie sua conta gratuita">
      <form onSubmit={enviar} style={{ display: 'contents' }}>
        <div className="campo"><label htmlFor="nome">Nome</label>
          <input id="nome" autoComplete="name" required value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" /></div>
        <div className="campo"><label htmlFor="email">E-mail</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></div>
        <div className="campo"><label htmlFor="senha">Senha</label>
          <input id="senha" type="password" autoComplete="new-password" required value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo de 6 caracteres" /></div>
        <div className="campo"><label htmlFor="confirma">Confirme a senha</label>
          <input id="confirma" type="password" autoComplete="new-password" required value={confirma} onChange={e => setConfirma(e.target.value)} /></div>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn btn-principal btn-bloco" disabled={enviando}>{enviando ? 'Criando…' : 'Criar conta'}</button>
      </form>
      <div className="entrada-links"><Link to="/">Já tenho conta</Link></div>
    </Moldura>
  )
}

export function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro(''); setEnviando(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlDoApp() })
    setEnviando(false)
    if (error) setErro(traduzirErro(error.message))
    else setEnviado(true)
  }

  return (
    <Moldura subtitulo="Recuperar acesso">
      {enviado ? (
        <p>Se existir uma conta com <strong>{email}</strong>, você vai receber um link para criar uma nova senha. Abra o link neste mesmo aparelho.</p>
      ) : (
        <form onSubmit={enviar} style={{ display: 'contents' }}>
          <p className="aviso">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
          <div className="campo"><label htmlFor="email">E-mail</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></div>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn btn-principal btn-bloco" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</button>
        </form>
      )}
      <div className="entrada-links"><Link to="/">Voltar para o login</Link></div>
    </Moldura>
  )
}

/** Aparece depois que a pessoa abre o link de recuperação do e-mail. */
export function NovaSenha() {
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const ir = useNavigate()
  const { concluirRecuperacao } = useAuth()

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.')
    if (senha !== confirma) return setErro('As senhas não conferem.')
    setErro(''); setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)
    if (error) return setErro(traduzirErro(error.message))
    concluirRecuperacao()
    ir('/', { replace: true })
  }

  return (
    <Moldura subtitulo="Crie uma nova senha">
      <form onSubmit={enviar} style={{ display: 'contents' }}>
        <div className="campo"><label htmlFor="senha">Nova senha</label>
          <input id="senha" type="password" autoComplete="new-password" required value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo de 6 caracteres" /></div>
        <div className="campo"><label htmlFor="confirma">Confirme a nova senha</label>
          <input id="confirma" type="password" autoComplete="new-password" required value={confirma} onChange={e => setConfirma(e.target.value)} /></div>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn btn-principal btn-bloco" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</button>
      </form>
    </Moldura>
  )
}
