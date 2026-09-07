-- ============================================================
-- 0005_sync_failures.sql: Log Kegagalan Sinkronisasi Google Sheets
-- Sync ke Sheets bersifat fire-and-forget (lihat
-- supabase/functions/sheets-sync) — kegagalan TIDAK BOLEH
-- menggagalkan checkout pelanggan, cukup dicatat di sini supaya
-- admin bisa rekonsiliasi manual sesekali.
-- ============================================================

create table if not exists sync_failures (
  id bigint generated always as identity primary key,
  source text not null default 'sheets-sync',
  order_id text,
  payload jsonb,
  error_message text,
  created_at timestamptz default now()
);

alter table sync_failures enable row level security;

drop policy if exists "sync_failures_admin_all" on sync_failures;
create policy "sync_failures_admin_all" on sync_failures
  for all using (auth.role() = 'authenticated');

-- Edge Function memakai service_role key (bypass RLS) untuk insert,
-- jadi tidak perlu policy insert terpisah untuk anon di sini.
