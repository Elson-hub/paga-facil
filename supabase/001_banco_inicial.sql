-- =====================================================================
-- Paga Fácil — banco de dados inicial
-- Como usar: Supabase → SQL Editor → New query → colar tudo → Run.
-- Pode ser executado uma única vez num projeto novo.
-- Tudo roda numa transação: se algo falhar, nada fica pela metade.
-- =====================================================================
begin;

-- ---------- Função utilitária: atualiza o campo alterado_em ----------
create or replace function public.tocar_alterado_em()
returns trigger language plpgsql as $$
begin
  new.alterado_em := now();
  return new;
end $$;

-- ---------- Perfis (1 por usuário do login) ----------
create table public.perfis (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '',
  tema        text not null default 'azul'
              check (tema in ('azul','verde','roxo','grafite')),
  modo_cor    text not null default 'auto'
              check (modo_cor in ('claro','escuro','auto')),
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz not null default now()
);

-- ---------- Contas bancárias ----------
create table public.contas (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome               text not null,
  banco              text,
  tipo               text not null default 'corrente'
                     check (tipo in ('corrente','poupanca','carteira','investimento')),
  saldo_inicial      numeric(12,2) not null default 0,
  data_saldo_inicial date not null default current_date,
  cor                text,
  ativa              boolean not null default true,
  criado_em          timestamptz not null default now(),
  alterado_em        timestamptz not null default now()
);

-- ---------- Cartões de crédito ----------
create table public.cartoes (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome                 text not null,
  bandeira             text,
  limite               numeric(12,2) not null default 0,
  conta_pagamento_id   uuid references public.contas(id) on delete set null,
  dia_fechamento       smallint not null check (dia_fechamento between 1 and 31),
  tipo_vencimento      text not null default 'fixo' check (tipo_vencimento in ('fixo','variavel')),
  dia_vencimento       smallint check (dia_vencimento between 1 and 31),
  dias_apos_fechamento smallint check (dias_apos_fechamento between 1 and 60),
  cor                  text,
  ativo                boolean not null default true,
  criado_em            timestamptz not null default now(),
  alterado_em          timestamptz not null default now(),
  constraint cartao_vencimento_ok check (
    (tipo_vencimento = 'fixo'     and dia_vencimento is not null) or
    (tipo_vencimento = 'variavel' and dias_apos_fechamento is not null)
  )
);

-- ---------- Categorias e subcategorias ----------
create table public.categorias (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome             text not null,
  tipo             text not null check (tipo in ('receita','despesa')),
  icone            text,
  cor              text,
  categoria_pai_id uuid references public.categorias(id) on delete cascade,
  ativa            boolean not null default true,
  criado_em        timestamptz not null default now(),
  alterado_em      timestamptz not null default now()
);

-- ---------- Tags ----------
create table public.tags (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome        text not null,
  cor         text,
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz not null default now(),
  unique (usuario_id, nome)
);

-- ---------- Regras de recorrência ----------
create table public.recorrencias (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  frequencia     text not null check (frequencia in ('semanal','mensal','anual','parcelado')),
  total_parcelas smallint check (total_parcelas between 2 and 120),
  data_inicio    date not null,
  data_fim       date,
  quantidade     smallint,
  criado_em      timestamptz not null default now(),
  alterado_em    timestamptz not null default now()
);

-- ---------- Faturas de cartão ----------
create table public.faturas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cartao_id       uuid not null references public.cartoes(id) on delete cascade,
  mes_referencia  date not null,            -- sempre o dia 1 do mês da fatura
  data_fechamento date not null,
  data_vencimento date not null,
  valor_total     numeric(12,2) not null default 0,
  valor_pago      numeric(12,2) not null default 0,
  situacao        text not null default 'aberta'
                  check (situacao in ('aberta','fechada','paga','paga_parcial')),
  criado_em       timestamptz not null default now(),
  alterado_em     timestamptz not null default now(),
  unique (cartao_id, mes_referencia)
);

-- ---------- Lançamentos (receita, despesa, despesa de cartão) ----------
create table public.lancamentos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo            text not null check (tipo in ('receita','despesa','despesa_cartao')),
  descricao       text not null default '',
  valor           numeric(12,2) not null check (valor > 0),
  data_vencimento date not null,
  efetivado       boolean not null default false,
  data_efetivacao date,
  categoria_id    uuid references public.categorias(id) on delete set null,
  conta_id        uuid references public.contas(id) on delete restrict,
  cartao_id       uuid references public.cartoes(id) on delete restrict,
  fatura_id       uuid references public.faturas(id) on delete set null,
  recorrencia_id  uuid references public.recorrencias(id) on delete set null,
  parcela_numero  smallint,
  observacao      text,
  criado_em       timestamptz not null default now(),
  alterado_em     timestamptz not null default now(),
  constraint lancamento_destino_ok check (
    (tipo = 'despesa_cartao' and cartao_id is not null and conta_id is null) or
    (tipo <> 'despesa_cartao' and conta_id is not null and cartao_id is null)
  )
);

create table public.lancamento_tags (
  lancamento_id uuid not null references public.lancamentos(id) on delete cascade,
  tag_id        uuid not null references public.tags(id) on delete cascade,
  usuario_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (lancamento_id, tag_id)
);

-- ---------- Transferências entre contas ----------
create table public.transferencias (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conta_origem_id  uuid not null references public.contas(id) on delete restrict,
  conta_destino_id uuid not null references public.contas(id) on delete restrict,
  data             date not null,
  valor            numeric(12,2) not null check (valor > 0),
  descricao        text,
  criado_em        timestamptz not null default now(),
  alterado_em      timestamptz not null default now(),
  check (conta_origem_id <> conta_destino_id)
);

-- ---------- Pagamentos de fatura ----------
create table public.pagamentos_fatura (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fatura_id   uuid not null references public.faturas(id) on delete cascade,
  conta_id    uuid not null references public.contas(id) on delete restrict,
  data        date not null,
  valor       numeric(12,2) not null check (valor > 0),
  criado_em   timestamptz not null default now(),
  alterado_em timestamptz not null default now()
);

-- ---------- Índices para as consultas do mês ----------
create index on public.lancamentos (usuario_id, data_vencimento);
create index on public.lancamentos (fatura_id);
create index on public.lancamentos (recorrencia_id);
create index on public.transferencias (usuario_id, data);
create index on public.pagamentos_fatura (usuario_id, data);
create index on public.faturas (usuario_id, data_vencimento);
create index on public.categorias (usuario_id, tipo);

-- ---------- alterado_em automático ----------
do $$
declare t text;
begin
  foreach t in array array['perfis','contas','cartoes','categorias','tags','recorrencias',
                           'faturas','lancamentos','transferencias','pagamentos_fatura']
  loop
    execute format('create trigger %I_alterado_em before update on public.%I
                    for each row execute function public.tocar_alterado_em()', t, t);
  end loop;
end $$;

-- ---------- Segurança: cada usuário só vê os próprios dados ----------
alter table public.perfis enable row level security;
create policy "perfil proprio" on public.perfis
  for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['contas','cartoes','categorias','tags','recorrencias','faturas',
                           'lancamentos','lancamento_tags','transferencias','pagamentos_fatura']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "dados proprios" on public.%I for all
                    using (usuario_id = auth.uid()) with check (usuario_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- Novo usuário: cria perfil e categorias padrão ----------
create or replace function public.ao_criar_usuario()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', ''));

  insert into public.categorias (usuario_id, nome, tipo, icone, cor) values
    (new.id, 'Alimentação',        'despesa', 'tools-kitchen-2', '#E8833A'),
    (new.id, 'Moradia',            'despesa', 'home',            '#8E6CD8'),
    (new.id, 'Transporte',         'despesa', 'car',             '#3B82C4'),
    (new.id, 'Saúde',              'despesa', 'heartbeat',       '#D64545'),
    (new.id, 'Educação',           'despesa', 'school',          '#2F9E8F'),
    (new.id, 'Lazer',              'despesa', 'mood-smile',      '#E5A50A'),
    (new.id, 'Compras',            'despesa', 'shopping-bag',    '#D4537E'),
    (new.id, 'Contas e serviços',  'despesa', 'file-invoice',    '#5F6B7A'),
    (new.id, 'Impostos e taxas',   'despesa', 'receipt-tax',     '#A35C2D'),
    (new.id, 'Pets',               'despesa', 'paw',             '#7A9A3A'),
    (new.id, 'Outros',             'despesa', 'dots',            '#888780'),
    (new.id, 'Salário',            'receita', 'briefcase',       '#1F9D55'),
    (new.id, 'Freelance',          'receita', 'device-laptop',   '#2E8BC0'),
    (new.id, 'Investimentos',      'receita', 'trending-up',     '#0F7A5C'),
    (new.id, 'Presente',           'receita', 'gift',            '#D4537E'),
    (new.id, 'Reembolso',          'receita', 'receipt-refund',  '#5B3FD1'),
    (new.id, 'Outros',             'receita', 'dots',            '#888780');

  return new;
end $$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

commit;
