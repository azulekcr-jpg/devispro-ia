-- DevisPro AI : schéma initial. À exécuter une fois (SQL Editor de Supabase ou `supabase db push`).

-- ========== Tables ==========
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default '', address text not null default '', phone text not null default '',
  email text not null default '', siret text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, phone text not null default '', email text not null default '', address text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  number text not null,
  issued_on date not null default current_date,
  valid_days int not null default 30,
  status text not null default 'brouillon' check (status in ('brouillon','envoye','accepte','refuse')),
  -- copie des infos au moment de la création : un devis ne change pas si la fiche entreprise/client change
  company_snapshot jsonb not null default '{}'::jsonb,
  client_snapshot jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (company_id, number)
);
create table public.quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position int not null default 0,
  designation text not null default '',
  quantity numeric(12,3) not null default 1,
  unit text not null default 'u',
  unit_price_cents bigint not null default 0,
  vat_rate numeric(4,2) not null default 10 check (vat_rate in (0, 2.1, 5.5, 10, 20))
);
create index on public.clients (company_id);
create index on public.quotes (company_id, created_at desc);
create index on public.quote_lines (quote_id, position);

create table public.quote_counters (
  company_id uuid not null references public.companies(id) on delete cascade,
  year int not null, last_seq int not null default 0,
  primary key (company_id, year)
);
create table public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text unique, stripe_subscription_id text unique,
  plan text, status text not null default 'none',
  current_period_end timestamptz, cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.stripe_events (id text primary key, type text not null, received_at timestamptz not null default now());

-- ========== Mise à jour automatique de updated_at ==========
create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger t_companies before update on public.companies for each row execute function public.touch_updated_at();
create trigger t_clients before update on public.clients for each row execute function public.touch_updated_at();
create trigger t_quotes before update on public.quotes for each row execute function public.touch_updated_at();

-- ========== Sécurité : chaque utilisateur ne voit que ses données ==========
create function public.owns_company(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.companies where id = cid and owner_id = auth.uid())
$$;

alter table public.companies enable row level security;
alter table public.clients enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_lines enable row level security;
alter table public.quote_counters enable row level security;
alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

create policy companies_own on public.companies for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy clients_own on public.clients for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy quotes_own on public.quotes for all using (public.owns_company(company_id)) with check (public.owns_company(company_id));
create policy quote_lines_own on public.quote_lines for all
  using (exists (select 1 from public.quotes q where q.id = quote_id and public.owns_company(q.company_id)))
  with check (exists (select 1 from public.quotes q where q.id = quote_id and public.owns_company(q.company_id)));
-- L'utilisateur peut LIRE son abonnement ; seul le serveur (clé service_role, webhook Stripe) peut l'écrire.
create policy subscriptions_read_own on public.subscriptions for select using (user_id = auth.uid());
-- quote_counters et stripe_events : aucune policy = inaccessibles au navigateur.

-- ========== Numérotation atomique des devis (DEV-2026-001) ==========
create function public.next_quote_number(p_company uuid) returns text
language plpgsql security definer set search_path = public as $$
declare y int := extract(year from now())::int; n int;
begin
  if not public.owns_company(p_company) then raise exception 'forbidden'; end if;
  insert into public.quote_counters (company_id, year, last_seq) values (p_company, y, 1)
  on conflict (company_id, year) do update set last_seq = public.quote_counters.last_seq + 1
  returning last_seq into n;
  return format('DEV-%s-%s', y, lpad(n::text, 3, '0'));
end $$;
revoke all on function public.next_quote_number(uuid) from public;
grant execute on function public.next_quote_number(uuid) to authenticated;

-- ========== À l'inscription : création automatique de la fiche entreprise ==========
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.companies (owner_id, email) values (new.id, coalesce(new.email, ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
