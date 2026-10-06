-- DevisPro AI : paramètres d'entreprise, logo, remise et objet des devis. À exécuter après 0001.
alter table public.companies
  add column legal_form text not null default '',
  add column vat_number text not null default '',
  add column rcs text not null default '',
  add column insurance text not null default '',
  add column vat_exempt boolean not null default false,
  add column default_vat_rate numeric(4,2) not null default 10 check (default_vat_rate in (0, 2.1, 5.5, 10, 20)),
  add column default_valid_days int not null default 30 check (default_valid_days between 1 and 365),
  add column default_note text not null default '',
  -- logo réduit côté navigateur (data URL), 300 000 caractères maximum
  add column logo_data text not null default '' check (length(logo_data) <= 300000);

alter table public.quotes
  add column subject text not null default '',
  add column discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  add constraint quotes_valid_days_check check (valid_days between 1 and 365);
