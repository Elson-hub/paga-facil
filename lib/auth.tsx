import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { aplicarAparencia, type ModoCor, type TemaId } from './temas'
import { enviarFoto, apagarFoto, linkDaFoto } from './foto'

export interface Perfil {
  id: string
  nome: string
  tema: TemaId
  modo_cor: ModoCor
  foto?: string | null
}

interface Contexto {
  sessao: Session | null
  perfil: Perfil | null
  carregando: boolean
  recuperandoSenha: boolean
  concluirRecuperacao: () => void
  atualizarPerfil: (dados: Partial<Omit<Perfil, 'id'>>) => Promise<string | null>
  /** Link para mostrar a foto do usuário (ou null). */
  fotoUrl: string | null
  /** Troca a foto (arquivo) ou remove (null). Devolve mensagem de erro ou null. */
  trocarFoto: (arquivo: File | null) => Promise<string | null>
  sair: () => Promise<void>
}

const AuthContext = createContext<Contexto>(null as unknown as Contexto)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [recuperandoSenha, setRecuperandoSenha] = useState(false)
  const [fotoUrl, setFotoUrl] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessao(data.session)
      setCarregando(false)
      limparCodigoDaUrl()
    })
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      setSessao(s)
      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true)
      if (evento === 'SIGNED_OUT') { setPerfil(null); setFotoUrl(null); setRecuperandoSenha(false) }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Carrega o perfil (nome e aparência) sempre que o usuário muda.
  const usuarioId = sessao?.user.id
  useEffect(() => {
    if (!usuarioId) return
    supabase.from('perfis').select('*').eq('id', usuarioId).single()
      .then(({ data }) => {
        if (data) {
          setPerfil(data as Perfil)
          aplicarAparencia(data.tema, data.modo_cor)
        }
      })
  }, [usuarioId])

  async function atualizarPerfil(dados: Partial<Omit<Perfil, 'id'>>) {
    if (!perfil) return 'Perfil não carregado.'
    const novo = { ...perfil, ...dados }
    setPerfil(novo)
    aplicarAparencia(novo.tema, novo.modo_cor)
    const { error } = await supabase.from('perfis').update(dados).eq('id', perfil.id)
    return error ? 'Não foi possível salvar. Verifique sua conexão.' : null
  }

  // Link da foto sempre que ela muda.
  const caminhoFoto = perfil?.foto ?? null
  useEffect(() => {
    if (!caminhoFoto) { setFotoUrl(null); return }
    linkDaFoto(caminhoFoto).then(setFotoUrl).catch(() => setFotoUrl(null))
  }, [caminhoFoto])

  async function trocarFoto(arquivo: File | null) {
    if (!perfil) return 'Perfil não carregado.'
    const antiga = perfil.foto ?? null
    try {
      const nova = arquivo ? await enviarFoto(perfil.id, arquivo) : null
      const { error } = await supabase.from('perfis').update({ foto: nova }).eq('id', perfil.id)
      if (error) { if (nova) await apagarFoto(nova); throw error }
      setPerfil({ ...perfil, foto: nova })
      if (antiga) apagarFoto(antiga).catch(() => {})
      return null
    } catch {
      return arquivo ? 'Não foi possível salvar a foto. Tente outra imagem ou verifique sua conexão.' : 'Não foi possível remover a foto.'
    }
  }

  async function sair() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{
      sessao, perfil, carregando, recuperandoSenha,
      concluirRecuperacao: () => setRecuperandoSenha(false), atualizarPerfil, fotoUrl, trocarFoto, sair
    }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Remove o ?code=... deixado pelos links de e-mail, para não ficar na barra. */
function limparCodigoDaUrl() {
  const url = new URL(window.location.href)
  if (url.searchParams.has('code')) {
    url.searchParams.delete('code')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }
}
