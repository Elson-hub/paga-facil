import { createContext, useContext, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import {
  IconHome, IconList, IconCategory, IconBuildingBank, IconCreditCard, IconTag,
  IconPalette, IconCloudUpload, IconPlugConnected, IconUser, IconLogout
} from '@tabler/icons-react'
import { useAuth } from '../lib/auth'
import Avatar from './Avatar'

const MenuContext = createContext<() => void>(() => {})
/** Abre o menu lateral (usado pelo botão ☰ do cabeçalho). */
export const useAbrirMenu = () => useContext(MenuContext)

export default function Layout() {
  const { sessao, perfil, sair, fotoUrl } = useAuth()
  const [aberto, setAberto] = useState(false)
  const fechar = () => setAberto(false)
  const t = 20

  return (
    <MenuContext.Provider value={() => setAberto(true)}>
      <div className="app">
        {aberto && <div className="menu-fundo" onClick={fechar} />}
        <nav className={`menu ${aberto ? 'aberto' : ''}`} onClick={e => (e.target as HTMLElement).closest('a') && fechar()}>
          <NavLink to="/minha-conta" className="menu-usuario">
            <Avatar url={fotoUrl} nome={perfil?.nome || sessao?.user.email || ''} tamanho={44} />
            <span className="menu-usuario-texto">
              <strong>{perfil?.nome || 'Paga Fácil'}</strong>
              <span>{sessao?.user.email}</span>
            </span>
          </NavLink>
          <NavLink to="/" end><IconHome size={t} />Início</NavLink>
          <NavLink to="/lancamentos"><IconList size={t} />Lançamentos</NavLink>

          <div className="menu-grupo">Cadastros</div>
          <NavLink to="/categorias"><IconCategory size={t} />Categorias</NavLink>
          <NavLink to="/contas"><IconBuildingBank size={t} />Contas bancárias</NavLink>
          <NavLink to="/cartoes"><IconCreditCard size={t} />Cartões de crédito</NavLink>
          <NavLink to="/tags"><IconTag size={t} />Tags</NavLink>

          <div className="menu-grupo">Ferramentas</div>
          <NavLink to="/aparencia"><IconPalette size={t} />Aparência</NavLink>
          <NavLink to="/backup"><IconCloudUpload size={t} />Backup<span className="selo">em breve</span></NavLink>
          <NavLink to="/open-finance"><IconPlugConnected size={t} />Open Finance<span className="selo">em breve</span></NavLink>

          <div className="menu-grupo">Conta</div>
          <NavLink to="/minha-conta"><IconUser size={t} />Minha conta</NavLink>
          <button className="menu-item" onClick={sair}><IconLogout size={t} />Sair</button>
        </nav>
        <main className="conteudo">
          <Outlet />
        </main>
      </div>
    </MenuContext.Provider>
  )
}
