export type TemaId = 'azul' | 'verde' | 'roxo' | 'grafite'
export type ModoCor = 'claro' | 'escuro' | 'auto'

export interface Tema {
  id: TemaId
  nome: string
  descricao: string
  principal: string     // cabeçalho e botões principais
  sobrePrincipal: string
  destaque: string      // botão +
  sobreDestaque: string
  receita: string
  despesa: string
}

export const TEMAS: Tema[] = [
  { id: 'azul', nome: 'Azul confiança', descricao: 'Clássico de banco',
    principal: '#1E5BD8', sobrePrincipal: '#FFFFFF', destaque: '#1E5BD8', sobreDestaque: '#FFFFFF',
    receita: '#1F9D55', despesa: '#D64545' },
  { id: 'verde', nome: 'Verde dinheiro', descricao: 'Verde-escuro com amarelo',
    principal: '#0F7A5C', sobrePrincipal: '#FFFFFF', destaque: '#F2B705', sobreDestaque: '#3A2A00',
    receita: '#2E9E6B', despesa: '#D9534F' },
  { id: 'roxo', nome: 'Roxo moderno', descricao: 'Visual de banco digital',
    principal: '#5B3FD1', sobrePrincipal: '#FFFFFF', destaque: '#5B3FD1', sobreDestaque: '#FFFFFF',
    receita: '#18A058', despesa: '#E5484D' },
  { id: 'grafite', nome: 'Grafite e laranja', descricao: 'Sóbrio, com destaque laranja',
    principal: '#1F2933', sobrePrincipal: '#FFFFFF', destaque: '#F07B16', sobreDestaque: '#FFFFFF',
    receita: '#2F9E62', despesa: '#D64545' }
]

export const TEMA_PADRAO: TemaId = 'azul'
const CHAVE_LOCAL = 'pagafacil.aparencia'

export function temaPorId(id: string | null | undefined): Tema {
  return TEMAS.find(t => t.id === id) ?? TEMAS[0]
}

/** Aplica cores e modo na página inteira. */
export function aplicarAparencia(temaId: string, modo: ModoCor) {
  const t = temaPorId(temaId)
  const raiz = document.documentElement
  raiz.style.setProperty('--principal', t.principal)
  raiz.style.setProperty('--sobre-principal', t.sobrePrincipal)
  raiz.style.setProperty('--destaque', t.destaque)
  raiz.style.setProperty('--sobre-destaque', t.sobreDestaque)
  raiz.style.setProperty('--receita', t.receita)
  raiz.style.setProperty('--despesa', t.despesa)
  if (modo === 'auto') raiz.removeAttribute('data-modo')
  else raiz.setAttribute('data-modo', modo)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.principal)
  try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ tema: t.id, modo })) } catch { /* sem armazenamento */ }
}

/** Usa a última aparência deste aparelho enquanto o perfil carrega. */
export function aplicarAparenciaSalva() {
  let tema: string = TEMA_PADRAO
  let modo: ModoCor = 'auto'
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_LOCAL) ?? 'null')
    if (salvo?.tema) tema = salvo.tema
    if (salvo?.modo) modo = salvo.modo
  } catch { /* sem armazenamento */ }
  aplicarAparencia(tema, modo)
}
