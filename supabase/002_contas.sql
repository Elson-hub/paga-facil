-- =====================================================================
-- Paga Fácil — ajuste do cadastro de contas bancárias (entrega 2)
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Rodar uma única vez, depois do 001_banco_inicial.sql.
-- =====================================================================
begin;

-- "Nome" passa a se chamar "Descrição", como na tela.
alter table public.contas rename column nome to descricao;

-- Limite do cheque especial (0 = sem cheque especial).
alter table public.contas
  add column limite_cheque_especial numeric(12,2) not null default 0
  check (limite_cheque_especial >= 0);

-- Categorias da conta: inclui "outros".
alter table public.contas drop constraint if exists contas_tipo_check;
alter table public.contas
  add constraint contas_tipo_check
  check (tipo in ('corrente','poupanca','carteira','investimento','outros'));

commit;
