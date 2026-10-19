'use client';

import { useEffect, useState } from 'react';

import { getBrowserClient } from '@/lib/supabase/browser';
import { addDays, zonedToUtc } from '@/lib/time';

import { type BusyRange } from '../lib/slots';

interface BusyState {
  dateKey: string;
  busy: BusyRange[];
  failed: boolean;
}

/**
 * Lịch bận của chi nhánh trong một ngày.
 *  - Hủy request cũ khi đổi ngày (AbortController) → phản hồi cũ không ghi đè lịch mới.
 *  - Tự làm mới khi database phát sự kiện realtime, khi quay lại tab và mỗi 60 giây.
 */
export function useBusySlots(branchId: string, dateKey: string | null, tz: string) {
  const [state, setState] = useState<BusyState | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!dateKey) return;
    const controller = new AbortController();
    const from = zonedToUtc(dateKey, '00:00', tz).toISOString();
    const to = zonedToUtc(addDays(dateKey, 1), '00:00', tz).toISOString();
    void getBrowserClient()
      .rpc('get_branch_busy_slots', { p_branch_id: branchId, p_from: from, p_to: to })
      .abortSignal(controller.signal)
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        if (error || !data) {
          setState({ dateKey, busy: [], failed: true });
          return;
        }
        setState({
          dateKey,
          failed: false,
          busy: data.map((b) => ({
            courtId: b.court_id,
            start: new Date(b.starts_at).getTime(),
            end: new Date(b.ends_at).getTime(),
          })),
        });
      });
    return () => controller.abort();
  }, [branchId, dateKey, tz, version]);

  useEffect(() => {
    const supabase = getBrowserClient();
    const refresh = () => setVersion((v) => v + 1);
    const channel = supabase
      .channel(`branch:${branchId}:availability`)
      .on('broadcast', { event: 'availability_changed' }, refresh)
      .subscribe();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
    };
  }, [branchId]);

  const current = state && state.dateKey === dateKey ? state : null;
  return {
    busy: current?.busy ?? [],
    loading: dateKey === null || current === null,
    failed: current?.failed ?? false,
    refresh: () => setVersion((v) => v + 1),
  };
}
