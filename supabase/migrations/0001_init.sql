-- ============================================================
-- 0001_init.sql: Skema Awal & Kebijakan Keamanan RAIDHANI
-- Single Source of Truth PRD v2.1 (Bagian 7 & 24)
-- ============================================================

-- 1. TABEL PRODUCTS
create table if not exists products (
  id text primary key,
  sku text,
  name text not null,
  tagline text,
  description text,
  price_normal integer not null,
  price_promo integer,
  currency text default 'IDR',
  colors jsonb not null,
  sizes text[] not null,
  stock_status text not null default 'in_stock',
  stock_count integer default 10,
  badge text,
  is_published boolean default true,
  rating numeric(3,2) default 4.90,
  review_count integer default 0,
  updated_at timestamptz default now()
);

-- 2. TABEL COUPONS
create table if not exists coupons (
  code text primary key,
  discount_type text not null, -- 'fixed_amount' | 'fixed_price'
  discount_value integer not null,
  quota_max integer not null,
  quota_used integer not null default 0,
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- 3. SEQUENCE ORDER ID
create sequence if not exists order_seq start 1;

-- 4. TABEL ORDERS
create table if not exists orders (
  order_id text primary key,
  product_id text references products(id),
  product_name text not null,
  color text not null,
  size text not null,
  qty integer not null default 1,
  unit_price integer not null,
  total_price integer not null,
  coupon_code text references coupons(code),
  buyer_name text not null,
  buyer_whatsapp text not null,
  buyer_address text not null,
  buyer_city_district text not null,
  buyer_postal_code text not null,
  buyer_notes text,
  consent_pdp boolean not null,
  status text not null default 'pending', -- 'pending' | 'lunas' | 'dikirim' | 'selesai'
  created_at timestamptz default now()
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
alter table products enable row level security;
alter table coupons enable row level security;
alter table orders enable row level security;

-- Policy Products: Baca publik hanya yang terbit
drop policy if exists "products_public_read" on products;
create policy "products_public_read" on products 
  for select using (is_published = true);

-- Policy Products Admin: Akses penuh untuk staf terautentikasi
drop policy if exists "products_admin_all" on products;
create policy "products_admin_all" on products 
  for all using (auth.role() = 'authenticated');

-- Policy Coupons Admin: Akses penuh untuk staf terautentikasi
-- (Publik memvalidasi via RPC function atomik redeem_coupon)
drop policy if exists "coupons_admin_all" on coupons;
create policy "coupons_admin_all" on coupons 
  for all using (auth.role() = 'authenticated');

-- Policy Orders Admin: Akses baca & tulis penuh untuk staf terautentikasi
drop policy if exists "orders_admin_all" on orders;
create policy "orders_admin_all" on orders 
  for all using (auth.role() = 'authenticated');

-- ============================================================
-- Function: redeem_coupon (Atomik, aman race condition)
-- ============================================================
create or replace function redeem_coupon(p_code text, p_original_price integer) 
returns table(valid boolean, final_price integer, message text) 
language plpgsql 
security definer as $$
declare 
  c coupons%rowtype;
begin 
  select * into c from coupons where code = upper(p_code) for update; 
  if not found then 
    return query select false, p_original_price, 'Kode kupon tidak ditemukan.'; 
    return; 
  end if; 
  if not c.is_active then 
    return query select false, p_original_price, 'Kupon sudah tidak aktif.'; 
    return; 
  end if; 
  if now() < c.valid_from or now() > c.valid_until then 
    return query select false, p_original_price, 'Kupon di luar masa berlaku.'; 
    return; 
  end if; 
  if c.quota_used >= c.quota_max then 
    return query select false, p_original_price, 'Kuota kupon telah habis terpakai.'; 
    return; 
  end if; 
  
  -- Tambah kuota terpakai
  update coupons set quota_used = quota_used + 1 where code = c.code; 
  
  if c.discount_type = 'fixed_price' then 
    return query select true, c.discount_value, 'Kupon berhasil diterapkan!'; 
  else 
    return query select true, greatest(p_original_price - c.discount_value, 0), 'Kupon berhasil diterapkan!'; 
  end if; 
end; 
$$;

-- ============================================================
-- Function: create_order (Membangkitkan order_id dan menyimpan order)
-- ============================================================
create or replace function create_order(order_data jsonb) 
returns text 
language plpgsql 
security definer as $$
declare 
  new_id text; 
begin 
  new_id := 'RDH-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('order_seq')::text, 4, '0'); 
  
  insert into orders ( 
    order_id, 
    product_id, 
    product_name, 
    color, 
    size, 
    qty, 
    unit_price, 
    total_price, 
    coupon_code, 
    buyer_name, 
    buyer_whatsapp, 
    buyer_address, 
    buyer_city_district, 
    buyer_postal_code, 
    buyer_notes, 
    consent_pdp 
  ) select 
    new_id, 
    order_data->>'product_id', 
    order_data->>'product_name', 
    order_data->>'color', 
    order_data->>'size', 
    coalesce((order_data->>'qty')::integer, 1), 
    (order_data->>'unit_price')::integer, 
    (order_data->>'total_price')::integer, 
    order_data->>'coupon_code', 
    order_data->>'buyer_name', 
    order_data->>'buyer_whatsapp', 
    order_data->>'buyer_address', 
    order_data->>'buyer_city_district', 
    order_data->>'buyer_postal_code', 
    order_data->>'buyer_notes', 
    (order_data->>'consent_pdp')::boolean; 
    
  return new_id; 
end; 
$$;

-- ============================================================
-- Seed Coupons Awal
-- ============================================================
insert into coupons (code, discount_type, discount_value, quota_max, quota_used, valid_from, valid_until, is_active)
values 
  ('RAIDHANI100K', 'fixed_amount', 100000, 200, 114, now() - interval '7 days', now() + interval '90 days', true),
  ('FREESHIP', 'fixed_amount', 25000, 100, 78, now() - interval '7 days', now() + interval '60 days', true)
on conflict (code) do nothing;
