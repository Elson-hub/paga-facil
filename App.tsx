import { useEffect, useRef, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './componentes/Layout'
import { Entrar, CriarConta, EsqueciSenha, NovaSenha } from './paginas/Entrada'
import Home from './paginas/Home'
import Aparencia from './paginas/Aparencia'
import MinhaConta from './paginas/MinhaConta'
import EmBreve from './paginas/EmBreve'
import Contas from './paginas/Contas'
import ContaForm from './paginas/ContaForm'
import Categorias from './paginas/Categorias'
import CategoriaForm from './paginas/CategoriaForm'
import Cartoes from './paginas/Cartoes'
import CartaoForm from './paginas/CartaoForm'
import Tags from './paginas/Tags'
import Lancamentos from './paginas/Lancamentos'
import LancamentoForm from './paginas/LancamentoForm'
import CompraCartaoForm from './paginas/CompraCartaoForm'
import Fatura from './paginas/Fatura'
import TransferenciaForm from './paginas/TransferenciaForm'
import TelaBloqueio from './componentes/TelaBloqueio'
import { bloqueioAtivo } from './lib/bloqueio'

/** Tempo em segundo plano depois do qual o app volta a pedir o Face ID. */
const TRAVAR_APOS_MS = 60 * 1000

function Rotas() {
  const { sessao, carregando, recuperandoSenha, sair } = useAuth()
  const uid = sessao?.user.id
  const [liberado, setLiberado] = useState(false)
  const verificado = useRef<string | null>(null)

  // Ao abrir o app já logado: trava se o bloqueio estiver ligado neste aparelho.
  // Quem acabou de entrar com e-mail e senha não precisa do Face ID.
  useEffect(() => {
    if (carregando) return
    if (!uid) { verificado.current = 'sem-sessao'; return }
    if (verificado.current === uid) return
    setLiberado(verificado.current === 'sem-sessao' || !bloqueioAtivo(uid))
    verificado.current = uid
  }, [uid, carregando])

  // Volta a travar quando o app fica um tempo em segundo plano.
  useEffect(() => {
    let escondidoEm = 0
    const mudou = () => {
      if (document.hidden) escondidoEm = Date.now()
      else if (escondidoEm && Date.now() - escondidoEm > TRAVAR_APOS_MS) setLiberado(false)
    }
    document.addEventListener('visibilitychange', mudou)
    return () => document.removeEventListener('visibilitychange', mudou)
  }, [])

  if (carregando) return <div className="carregando">Carregando…</div>

  if (recuperandoSenha) return <NovaSenha />

  if (!sessao) return (
    <Routes>
      <Route path="/criar-conta" element={<CriarConta />} />
      <Route path="/esqueci-senha" element={<EsqueciSenha />} />
      <Route path="*" element={<Entrar />} />
    </Routes>
  )

  if (uid && bloqueioAtivo(uid) && (!liberado || verificado.current !== uid)) {
    return <TelaBloqueio usuarioId={uid} onDesbloquear={() => setLiberado(true)} onEntrarComSenha={sair} />
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="lancamentos" element={<Lancamentos />} />
        <Route path="lancamentos/:id" element={<LancamentoForm key="editar" />} />
        <Route path="novo/receita" element={<LancamentoForm key="receita" tipoNovo="receita" />} />
        <Route path="novo/despesa" element={<LancamentoForm key="despesa" tipoNovo="despesa" />} />
        <Route path="novo/transferencia" element={<TransferenciaForm key="nova-transf" />} />
        <Route path="transferencias/:id" element={<TransferenciaForm key="editar-transf" />} />
        <Route path="novo/despesa-cartao" element={<CompraCartaoForm key="nova-compra" />} />
        <Route path="compras/:id" element={<CompraCartaoForm key="editar-compra" />} />
        <Route path="cartoes/:id/fatura" element={<Fatura />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="categorias/nova" element={<CategoriaForm />} />
        <Route path="categorias/:id" element={<CategoriaForm />} />
        <Route path="contas" element={<Contas />} />
        <Route path="contas/nova" element={<ContaForm />} />
        <Route path="contas/:id" element={<ContaForm />} />
        <Route path="cartoes" element={<Cartoes />} />
        <Route path="cartoes/novo" element={<CartaoForm />} />
        <Route path="cartoes/:id" element={<CartaoForm />} />
        <Route path="tags" element={<Tags />} />
        <Route path="aparencia" element={<Aparencia />} />
        <Route path="backup" element={<EmBreve titulo="Backup" quando="na fase 2" />} />
        <Route path="open-finance" element={<EmBreve titulo="Open Finance" quando="na fase 2" />} />
        <Route path="minha-conta" element={<MinhaConta />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Rotas />
      </HashRouter>
    </AuthProvider>
  )
}
