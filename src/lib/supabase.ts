import { createClient } from '@supabase/supabase-js'

// Dados públicos do projeto Supabase (podem ficar no app: quem protege os
// dados são as regras de segurança do banco). Nunca coloque aqui a chave secreta.
const SUPABASE_URL = 'https://wencqcgotbxmugrhixmz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_STpmxsgoli6yhnQTU--HDw_uTlKd5ew'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

/** Endereço base do app (para os links enviados por e-mail). */
export const urlDoApp = () => window.location.origin + import.meta.env.BASE_URL
