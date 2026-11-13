import { supabase } from './supabase'

/**
 * Volta a conta para as configurações de fábrica:
 * 1. apaga os arquivos anexados (fotos e PDFs) guardados no Supabase;
 * 2. no banco, apaga lançamentos, contas, cartões, faturas, pagamentos,
 *    transferências, tags e categorias, e recria as categorias padrão
 *    (tudo numa transação só, pela função redefinir_conta).
 */
export async function redefinirConta() {
  const { data: anexos } = await supabase.from('lancamento_anexos').select('caminho')
  const caminhos = (anexos ?? []).map(a => a.caminho as string)
  for (let i = 0; i < caminhos.length; i += 100) {
    await supabase.storage.from('anexos').remove(caminhos.slice(i, i + 100))
  }
  const { error } = await supabase.rpc('redefinir_conta')
  if (error) throw error
}
