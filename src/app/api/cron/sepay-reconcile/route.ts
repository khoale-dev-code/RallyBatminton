import { timingSafeEqual } from 'node:crypto';

import { NextResponse, type NextRequest } from 'next/server';

import { runSepayReconcile } from '@/features/payments/reconcile';
import { getCronSecret } from '@/lib/env.server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header ?? '');
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Đối soát định kỳ. Gọi bởi Supabase pg_cron (mỗi 15 phút, 17_reconcile_cron_optional.sql)
 * hoặc Vercel Cron (vercel.json) với header "Authorization: Bearer <CRON_SECRET>".
 */
async function handle(request: NextRequest) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ ok: false, message: 'CRON_SECRET chưa cấu hình' }, { status: 503 });
  if (!authorized(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ ok: false, message: 'unauthorized' }, { status: 401 });
  }
  const source = (request.headers.get('user-agent') ?? '').includes('vercel-cron') ? 'vercel' : 'cron';
  const result = await runSepayReconcile(source);
  return NextResponse.json(result, { status: result.ok ? 200 : 502, headers: { 'Cache-Control': 'no-store' } });
}

export const GET = handle;
export const POST = handle;
