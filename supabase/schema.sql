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
