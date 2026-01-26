// driveash/lib/useNotificationBadgeCount.js
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { usePendingInviteCount } from './usePendingInviteCount';

export function useNotificationBadgeCount({ enabled = true } = {}) {
  const { count: pendingInvites, reload: reloadInvites } = usePendingInviteCount({ enabled });
  const [unreadWarnings, setUnreadWarnings] = useState(0);
  const mounted = useRef(true);

  const loadUnreadWarnings = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user;
      if (!me?.id) {
        if (mounted.current) setUnreadWarnings(0);
        return;
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', me.id)
        .eq('type', 'warning')
        .eq('source_table', 'driver_warnings')
        .is('read_at', null);

      if (error) throw error;
      if (mounted.current) setUnreadWarnings(count || 0);
    } catch (e) {
      if (mounted.current) setUnreadWarnings(0);
    }
  };

  const reload = async () => {
    await Promise.all([reloadInvites?.(), loadUnreadWarnings()]);
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let channel;

    (async () => {
      await reload();

      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user;
      if (!me?.id) return;

      // Realtime for notifications badge
      channel = supabase
        .channel(`notif-badge-${me.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${me.id}`,
          },
          () => {
            loadUnreadWarnings();
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return {
    count: (pendingInvites || 0) + (unreadWarnings || 0),
    pendingInvites: pendingInvites || 0,
    unreadWarnings: unreadWarnings || 0,
    reload,
  };
}
