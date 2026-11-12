-- =====================================================================
-- Paga Fácil — APAGA as tabelas do app para recomeçar do zero.
-- Use somente enquanto não houver dados reais cadastrados.
-- Depois de rodar este, rode de novo o 001_banco_inicial.sql.
-- =====================================================================
begin;

drop trigger if exists ao_criar_usuario on auth.users;

drop table if exists
  public.pagamentos_fatura,
  public.transferencias,
  public.lancamento_tags,
  public.lancamentos,
  public.faturas,
  public.recorrencias,
  public.tags,
  public.categorias,
  public.cartoes,
  public.contas,
  public.perfis
  cascade;

drop function if exists public.ao_criar_usuario();
drop function if exists public.tocar_alterado_em();

commit;
