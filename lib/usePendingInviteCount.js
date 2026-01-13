import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export function usePendingInviteCount({ enabled = true } = {}) {
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

      const { count: c, error } = await supabase
        .from('emergency_contact_requests')
        .select('id', { count: 'exact', head: true })
        .eq('target_id', me.id)
        .eq('status', 'pending');

      if (error) throw error;
      if (mounted.current) setCount(c || 0);
    } catch (e) {
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

      channel = supabase
        .channel('pending-invites-badge')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'emergency_contact_requests',
            filter: `target_id=eq.${me.id}`,
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
  }, [enabled]);

  return { count, reload: load };
}
