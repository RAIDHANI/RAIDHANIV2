// ============================================================
// RAIDHANI - sheets-sync Edge Function
// Supabase Database Webhook (tabel `orders`, event INSERT/UPDATE)
// -> Google Sheets API v4 (Service Account, JWT Bearer flow)
//
// Cara aktifkan (lihat docs/BACKEND_SETUP.md untuk detail lengkap):
//   1. supabase functions deploy sheets-sync
//   2. supabase secrets set GOOGLE_SERVICE_ACCOUNT_EMAIL=... \
//        GOOGLE_PRIVATE_KEY="..." GOOGLE_SHEET_ID=... GOOGLE_SHEET_NAME=Orders
//   3. Supabase Dashboard -> Database -> Webhooks -> New webhook:
//        table: orders, events: Insert + Update,
//        target: URL fungsi ini (dari hasil `functions deploy`)
//
// Prinsip desain: fire-and-forget. Kegagalan sinkron ke Sheets TIDAK
// PERNAH boleh menggagalkan atau menahan proses checkout pelanggan —
// webhook ini dipanggil Supabase secara async, di luar jalur request
// checkout utama. Kegagalan cukup dicatat ke tabel `sync_failures`
// (migrasi 0005) supaya admin bisa rekonsiliasi manual sesekali.
// ============================================================

import { createClient } from 'npm:@supabase/supabase-js@2';

const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL') ?? '';
const GOOGLE_PRIVATE_KEY = (Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n');
const GOOGLE_SHEET_ID = Deno.env.get('GOOGLE_SHEET_ID') ?? '';
const SHEET_NAME = Deno.env.get('GOOGLE_SHEET_NAME') ?? 'Orders';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Urutan kolom di sheet tujuan — baris 1 harus diisi header yang sama
// urutannya secara manual satu kali saat membuat spreadsheet.
const COLUMNS = [
  'order_id', 'created_at', 'product_name', 'color', 'size', 'qty',
  'unit_price', 'total_price', 'coupon_code', 'buyer_name',
  'buyer_whatsapp', 'buyer_address', 'buyer_city_district',
  'buyer_postal_code', 'status', 'payment_proof_url'
];

function rowFromOrder(order: Record<string, unknown>): string[] {
  return COLUMNS.map((key) => {
    const v = order[key];
    return v === null || v === undefined ? '' : String(v);
  });
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64Url(input: string | ArrayBuffer): string {
  let binary: string;
  if (typeof input === 'string') {
    binary = input;
  } else {
    const bytes = new Uint8Array(input);
    binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

// Google Service Account JWT Bearer flow (RFC 7523) — ditulis manual
// pakai Web Crypto API bawaan Deno supaya fungsi ini tidak bergantung
// pada library eksternal untuk langkah paling kritikal (autentikasi).
async function getGoogleAccessToken(): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodeJson = (obj: unknown) => base64Url(JSON.stringify(obj));
  const unsigned = `${encodeJson(header)}.${encodeJson(claim)}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(GOOGLE_PRIVATE_KEY),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${base64Url(signatureBuf)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!res.ok) {
    throw new Error(`Gagal ambil access token Google: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function appendRow(accessToken: string, row: string[]) {
  const range = `${SHEET_NAME}!A:P`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });
  if (!res.ok) throw new Error(`Sheets append gagal: ${res.status} ${await res.text()}`);
}

async function updateRow(accessToken: string, orderId: string, row: string[]) {
  // Cari baris dengan order_id yang cocok di kolom A, lalu timpa baris itu.
  const readRange = `${SHEET_NAME}!A:A`;
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(readRange)}`;
  const readRes = await fetch(readUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!readRes.ok) throw new Error(`Sheets read gagal: ${readRes.status} ${await readRes.text()}`);

  const readData = await readRes.json();
  const values: string[][] = readData.values ?? [];
  const rowIndex = values.findIndex((r) => r[0] === orderId);

  if (rowIndex === -1) {
    // Baris belum ada (mis. webhook INSERT sebelumnya sempat gagal) -> append.
    await appendRow(accessToken, row);
    return;
  }

  const sheetRowNumber = rowIndex + 1; // Sheets 1-indexed
  const updateRange = `${SHEET_NAME}!A${sheetRowNumber}:P${sheetRowNumber}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(updateRange)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });
  if (!res.ok) throw new Error(`Sheets update gagal: ${res.status} ${await res.text()}`);
}

async function logFailure(orderId: string | null, payload: unknown, errorMessage: string) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    await supabase.from('sync_failures').insert({
      source: 'sheets-sync',
      order_id: orderId,
      payload,
      error_message: errorMessage
    });
  } catch (e) {
    console.error('Gagal mencatat sync_failures:', e);
  }
}

Deno.serve(async (req: Request) => {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const record = (payload.record ?? null) as Record<string, unknown> | null;
  const type = payload.type as string | undefined; // 'INSERT' | 'UPDATE'

  if (!record) {
    return new Response('OK (no record)', { status: 200 });
  }

  try {
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_SHEET_ID) {
      throw new Error('Secret Google Sheets belum lengkap (set via `supabase secrets set`).');
    }

    const accessToken = await getGoogleAccessToken();
    const row = rowFromOrder(record);

    if (type === 'UPDATE') {
      await updateRow(accessToken, String(record.order_id), row);
    } else {
      await appendRow(accessToken, row);
    }
  } catch (err) {
    await logFailure((record?.order_id as string) ?? null, payload, (err as Error).message);
  }

  // Selalu balas 200: kegagalan sudah dicatat di sync_failures, tidak
  // perlu Supabase retry webhook ini berkali-kali.
  return new Response('OK', { status: 200 });
});
