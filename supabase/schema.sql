create type user_role as enum ('owner', 'supervisor', 'worker');
create type stock_movement_type as enum ('in', 'out', 'production_deduction');
create type shift_name as enum ('morning', 'evening', 'night');

create table factories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  factory_id uuid not null references factories(id) on delete cascade,
  name text not null,
  role user_role not null default 'worker',
  phone text,
  created_at timestamptz not null default now()
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id) on delete cascade,
  name text not null,
  unit text not null,
  current_stock numeric(12, 3) not null default 0 check (current_stock >= 0),
  low_stock_threshold numeric(12, 3) not null default 0 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id) on delete cascade,
  name text not null,
  unit text not null,
  daily_target numeric(12, 3) not null default 0 check (daily_target >= 0),
  created_at timestamptz not null default now()
);

create table boms (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  version integer not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (product_id, version)
);

create unique index one_active_bom_per_product on boms(product_id) where is_active;

create table bom_line_items (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references boms(id) on delete cascade,
  material_id uuid not null references materials(id) on delete restrict,
  qty_per_unit numeric(12, 3) not null check (qty_per_unit > 0),
  unique (bom_id, material_id)
);

create table production_entries (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  bom_id uuid not null references boms(id) on delete restrict,
  quantity_produced numeric(12, 3) not null check (quantity_produced >= 0),
  quantity_rejected numeric(12, 3) not null default 0 check (quantity_rejected >= 0),
  reject_reason text,
  shift shift_name not null,
  downtime_minutes integer not null default 0 check (downtime_minutes >= 0),
  downtime_reason text,
  entry_date date not null default current_date,
  entered_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  edited_by uuid references profiles(id) on delete set null,
  edited_at timestamptz
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references materials(id) on delete restrict,
  type stock_movement_type not null,
  quantity numeric(12, 3) not null check (quantity > 0),
  reference_id uuid,
  note text,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index materials_factory_id_idx on materials(factory_id);
create index products_factory_id_idx on products(factory_id);
create index production_entries_factory_date_idx on production_entries(factory_id, entry_date desc);
create index stock_movements_material_created_idx on stock_movements(material_id, created_at desc);

-- Accounts & Finance foundation
create type finance_role as enum ('owner', 'finance_manager', 'accountant', 'supervisor', 'storekeeper', 'operator');
create type journal_status as enum ('draft', 'posted', 'reversed');
create type finance_action as enum ('create', 'edit', 'approve', 'reverse', 'payment', 'export');

create table chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id) on delete cascade,
  code text not null,
  name text not null,
  account_group text not null check (account_group in ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id uuid references chart_of_accounts(id) on delete restrict,
  is_system boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (factory_id, code)
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id) on delete cascade,
  voucher_number text not null,
  entry_date date not null,
  narration text not null,
  source_module text not null,
  source_record_id uuid,
  status journal_status not null default 'draft',
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (factory_id, voucher_number)
);

create table journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references journal_entries(id) on delete cascade,
  account_id uuid not null references chart_of_accounts(id) on delete restrict,
  debit_paise bigint not null default 0 check (debit_paise >= 0),
  credit_paise bigint not null default 0 check (credit_paise >= 0),
  narration text,
  check ((debit_paise > 0 and credit_paise = 0) or (credit_paise > 0 and debit_paise = 0))
);

create table finance_audit_logs (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid not null references factories(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete restrict,
  user_name text not null,
  role finance_role not null,
  action finance_action not null,
  module text not null,
  record_id uuid not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create table account_settings (
  factory_id uuid primary key references factories(id) on delete cascade,
  fiscal_year_start date not null default make_date(extract(year from current_date)::integer, 4, 1),
  invoice_prefix text not null default 'INV',
  voucher_prefix text not null default 'JV',
  inventory_valuation text not null default 'weighted_average' check (inventory_valuation in ('weighted_average', 'fifo')),
  default_payment_terms_days integer not null default 15 check (default_payment_terms_days >= 0),
  locked_until date,
  updated_at timestamptz not null default now()
);

create index journal_entries_factory_date_idx on journal_entries(factory_id, entry_date desc);
create index journal_lines_account_idx on journal_lines(account_id);
create index finance_audit_logs_factory_created_idx on finance_audit_logs(factory_id, created_at desc);

create or replace function validate_balanced_journal(entry_id uuid)
returns void language plpgsql as $$
declare debit_total bigint; credit_total bigint;
begin
  select coalesce(sum(debit_paise), 0), coalesce(sum(credit_paise), 0)
    into debit_total, credit_total from journal_lines where journal_entry_id = entry_id;
  if debit_total = 0 or debit_total <> credit_total then
    raise exception 'Journal entry must have equal non-zero debit and credit totals';
  end if;
end;
$$;

-- CRM foundation: customers remain shared with Accounts; CRM adds pipeline records.
create type crm_lead_stage as enum ('new', 'contacted', 'qualified', 'quotation_sent', 'negotiation', 'won', 'lost');
create type crm_lead_temperature as enum ('hot', 'warm', 'cold');

create table if not exists parties (
  id uuid primary key default gen_random_uuid(), factory_id uuid not null references factories(id) on delete cascade,
  name text not null, type text not null default 'Customer', phone text, city text, gstin text, credit_limit_paise bigint not null default 0,
  credit_period_days integer not null default 15, status text not null default 'active', created_at timestamptz not null default now()
);

alter table parties add column if not exists crm_owner_id uuid references profiles(id) on delete set null;
alter table parties add column if not exists customer_type text;
alter table parties add column if not exists dormant_after_days integer not null default 90;

create table crm_leads (
  id uuid primary key default gen_random_uuid(), factory_id uuid not null references factories(id) on delete cascade,
  lead_number text not null, company_name text not null, contact_name text, phone text, email text, city text,
  source text not null, product_interest jsonb not null default '[]', expected_value_paise bigint not null default 0 check (expected_value_paise >= 0),
  stage crm_lead_stage not null default 'new', temperature crm_lead_temperature not null default 'warm', owner_id uuid references profiles(id) on delete set null,
  customer_id uuid, next_follow_up_at timestamptz, expected_close_date date, notes text, source_module text not null default 'crm', source_record_id uuid,
  created_by uuid not null references profiles(id) on delete restrict, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  unique (factory_id, lead_number)
);

create table crm_stage_history (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references crm_leads(id) on delete cascade,
  from_stage crm_lead_stage, to_stage crm_lead_stage not null, reason text, changed_by uuid not null references profiles(id) on delete restrict, created_at timestamptz not null default now()
);

create table crm_follow_ups (
  id uuid primary key default gen_random_uuid(), factory_id uuid not null references factories(id) on delete cascade,
  lead_id uuid references crm_leads(id) on delete set null, customer_id uuid, type text not null, priority text not null default 'normal',
  due_at timestamptz not null, assigned_to uuid references profiles(id) on delete set null, notes text, outcome text, status text not null default 'open',
  source_module text not null default 'crm', source_record_id uuid, created_by uuid not null references profiles(id) on delete restrict, created_at timestamptz not null default now()
);

create table crm_settings (
  factory_id uuid primary key references factories(id) on delete cascade,
  stages jsonb not null default '[{"name":"New","probability":10},{"name":"Contacted","probability":20},{"name":"Qualified","probability":40},{"name":"Quotation Sent","probability":60},{"name":"Negotiation","probability":75},{"name":"Won","probability":100},{"name":"Lost","probability":0}]',
  lead_sources jsonb not null default '["IndiaMART","JustDial","Website","Referral","Exhibition","Walk-in","Cold Call","WhatsApp","Other"]',
  lost_reasons jsonb not null default '["Price","Competitor","No response","Delivery time","Quality","Other"]',
  dormant_days integer not null default 90, minimum_margin_percent numeric(5,2) not null default 18, complaint_sla_hours integer not null default 48, updated_at timestamptz not null default now()
);

create index crm_leads_factory_stage_idx on crm_leads(factory_id, stage);
create index crm_leads_owner_followup_idx on crm_leads(owner_id, next_follow_up_at);
create index crm_followups_due_idx on crm_follow_ups(factory_id, due_at, status);
