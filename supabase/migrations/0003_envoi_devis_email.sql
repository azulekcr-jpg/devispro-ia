-- DevisPro AI : journal des envois de devis par e-mail (traçabilité et limite horaire). À exécuter après 0002.
create table public.quote_emails (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid references public.quotes(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  to_email text not null,
  status text not null check (status in ('envoye', 'echec')),
  provider_id text not null default '',
  error text not null default '',
  created_at timestamptz not null default now()
);
create index on public.quote_emails (company_id, created_at desc);

alter table public.quote_emails enable row level security;
create policy quote_emails_read_own on public.quote_emails for select using (public.owns_company(company_id));
create policy quote_emails_insert_own on public.quote_emails for insert with check (public.owns_company(company_id));
