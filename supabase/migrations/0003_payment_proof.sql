-- ============================================================
-- 0003_payment_proof.sql: Konfirmasi Pembayaran Tier 1
-- (Upload Bukti Transfer Langsung dari Web)
-- ============================================================

alter table orders add column if not exists payment_proof_url text;
alter table orders add column if not exists payment_method text default 'Transfer Bank (BSI/BCA)';

-- ============================================================
-- Function: attach_payment_proof
-- Menempelkan URL bukti transfer ke order tertentu.
-- Dibuat sebagai RPC security definer (pola sama seperti
-- create_order & redeem_coupon) supaya customer anonim BISA
-- menempelkan bukti ke order miliknya SENDIRI tanpa perlu
-- login/tanpa membuka akses UPDATE penuh ke tabel orders
-- (yang lewat RLS orders_admin_all hanya boleh untuk staf).
-- ============================================================
create or replace function attach_payment_proof(p_order_id text, p_proof_url text)
returns void
language plpgsql
security definer as $$
begin
  update orders set payment_proof_url = p_proof_url where order_id = p_order_id;
end;
$$;

grant execute on function attach_payment_proof(text, text) to anon, authenticated;
