import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import type { PublicShiftStatus } from '@/types/database';

interface BroadcastPayload {
  shift_id: string;
  capacity: number;
  effective_capacity: number;
  active_count: number;
  available_count: number;
  is_full: boolean;
  status: string;
}

/**
 * Lädt den öffentlichen Belegungsstatus aller Schichten einer Veranstaltung
 * und hält ihn über Supabase Realtime (Broadcast from Database) live aktuell,
 * ohne dass die Seite neu geladen werden muss (Abschnitt 61).
 */
export function useEventShiftStatus(eventId: string | null) {
  const [shifts, setShifts] = useState<PublicShiftStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const shiftsRef = useRef<PublicShiftStatus[]>([]);

  const load = useCallback(async () => {
    if (!eventId) return;
    const { data, error } = await supabase
      .from('public_shift_status')
      .select('*')
      .eq('event_id', eventId)
      .order('date', { ascending: true })
      .order('display_order', { ascending: true });

    if (!error && data) {
      shiftsRef.current = data as PublicShiftStatus[];
      setShifts(data as PublicShiftStatus[]);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!eventId) return;
    const channel = supabase.channel(`event:${eventId}`);
    channel
      .on('broadcast', { event: 'shift_status_changed' }, (msg) => {
        const payload = msg.payload as BroadcastPayload;
        shiftsRef.current = shiftsRef.current.map((s) =>
          s.shift_id === payload.shift_id
            ? {
                ...s,
                capacity: payload.capacity,
                effective_capacity: payload.effective_capacity,
                active_count: payload.active_count,
                available_count: payload.available_count,
                is_full: payload.is_full,
                status: payload.status as PublicShiftStatus['status'],
              }
            : s
        );
        setShifts([...shiftsRef.current]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return { shifts, loading, refresh: load };
}
