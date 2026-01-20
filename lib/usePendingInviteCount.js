// driveash/lib/usePendingInviteCount.js
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export function usePendingInviteCount({ enabled = true, direction = 'incoming' } = {}) {
  const [count, setCount] = useState(0);
  const mounted = useRef(true);

  const load = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user;
      if (!me?.id) {
        if (mounted.current) setCount(0);
        return;
      }

      let q = supabase
        .from('emergency_contact_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');

      q = direction === 'outgoing'
        ? q.eq('requester_id', me.id)
        : q.eq('target_id', me.id);

      const { count: c, error } = await q;

      if (error) throw error;
      if (mounted.current) setCount(c || 0);
    } catch (e) {
      // silent: we don't want badge logic to crash screens
      if (mounted.current) setCount(0);
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let channel;

    (async () => {
      await load();

      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user;
      if (!me?.id) return;

      const filter =
        direction === 'outgoing'
          ? `requester_id=eq.${me.id}`
          : `target_id=eq.${me.id}`;

      channel = supabase
        .channel(`pending-invites-badge-${direction}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'emergency_contact_requests',
            filter,
          },
          () => {
            load();
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, direction]);
  return { count, reload: load };
}
