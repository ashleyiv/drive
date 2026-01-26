// driveash/components/BottomNav.js
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Easing } from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import useTheme from '../theme/useTheme';
import { supabase } from '../lib/supabase';
import { usePendingInviteCount } from '../lib/usePendingInviteCount';


function clampBadgeText(n) {
  if (!n || n <= 0) return null;
  if (n > 20) return '20+';
  return String(n);
}

/**
 * Props:
 * - variant: 'driver' | 'emergency'
 * - activeKey: string (which tab is active)
 * - onNavigate: function(route: string, params?: any)
 * - notificationCount: number (shows badge on notifications tab if present)
 * - theme: optional (for Menu dark-mode theme compatibility)
 * - tabs: optional override to define custom tabs (ex: Location screen with 5 tabs)
 */
export default function BottomNav({
  variant = 'driver',
  activeKey,
  onNavigate,
  notificationCount, // optional override
  theme,
  tabs,
}) {
  const hasOverride = typeof notificationCount === 'number';

  // ✅ For emergency: compute badge globally here (works on ALL pages)
  const { count: pendingInviteCount } = usePendingInviteCount({
    enabled: variant === 'emergency' && !hasOverride,
    direction: 'incoming',
  });

  const [unreadWarningsCount, setUnreadWarningsCount] = useState(0);
  const mountedRef = useRef(true);

  const loadUnreadWarningsCount = async () => {
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user;
      if (!me?.id) {
        if (mountedRef.current) setUnreadWarningsCount(0);
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
      if (mountedRef.current) setUnreadWarningsCount(count || 0);
    } catch (e) {
      if (mountedRef.current) setUnreadWarningsCount(0);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Only auto-badge for emergency variant, unless overridden by prop
    if (variant !== 'emergency' || hasOverride) return;

    let channel;

    (async () => {
      await loadUnreadWarningsCount();

      const { data: userRes } = await supabase.auth.getUser();
      const me = userRes?.user;
      if (!me?.id) return;

      channel = supabase
        .channel(`notif-badge-global-${me.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_id=eq.${me.id}`,
          },
          () => {
            loadUnreadWarningsCount();
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, hasOverride]);

  const computedCount =
    variant === 'emergency'
      ? (pendingInviteCount || 0) + (unreadWarningsCount || 0)
      : 0;

  const effectiveCount = hasOverride ? notificationCount : computedCount;

  const badgeText = clampBadgeText(effectiveCount);


  // Animation (bounce) when notificationCount increases
  const prevCountRef = useRef(notificationCount);
  const notifScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const prev = prevCountRef.current ?? 0;
    const next = effectiveCount ?? 0;

    if (next > prev && activeKey !== 'notifications') {


      notifScale.setValue(1);
      Animated.sequence([
        Animated.timing(notifScale, {
          toValue: 1.18,
          duration: 140,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(notifScale, {
          toValue: 1,
          duration: 160,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }

       prevCountRef.current = next;
  }, [effectiveCount, activeKey, notifScale]);


  const defaultTabs = useMemo(() => {
    if (variant === 'emergency') {
      return [
        {
          key: 'drivers',
          label: 'Drivers',
          route: 'ec-dashboard',
          icon: (color) => <FontAwesome5 name="users" size={22} color={color} />,
        },
        {
          key: 'notifications',
          label: 'Notifications',
          route: 'ec-notifications',
          icon: (color) => <Feather name="bell" size={22} color={color} />,
          showBadge: true,
        },
        {
          key: 'settings',
          label: 'Settings',
          route: 'ec-settings',
          icon: (color) => <Feather name="settings" size={22} color={color} />,
        },
      ];
    }

    // driver
    return [
      {
        key: 'home',
        label: 'Home',
        route: 'dashboard',
        icon: (color) => <Feather name="home" size={20} color={color} />,
      },
      {
        key: 'history',
        label: 'History',
        route: 'history',
        icon: (color) => <Feather name="clock" size={20} color={color} />,
      },
      {
        key: 'contacts',
        label: 'Contacts',
        route: 'contacts',
        icon: (color) => <Feather name="users" size={20} color={color} />,
      },
      {
        key: 'menu',
        label: 'Menu',
        route: 'menu',
        icon: (color) => <Feather name="menu" size={20} color={color} />,
      },
    ];
  }, [variant]);

  const finalTabs = tabs && Array.isArray(tabs) ? tabs : defaultTabs;

  // Theme-aware colors (only used if you pass theme from Menu.js)
  const colors = {
    navBg: theme?.background ?? '#fff',
    border: theme?.borderColor ?? '#E5E7EB',
    activeBg: theme?.navActiveBackground ?? '#3B82F6',
    activeIcon: theme?.navActiveText ?? '#fff',
    inactiveIcon: theme?.navInactiveText ?? '#3B82F6',
    label: theme?.navInactiveText ?? '#3B82F6',
  };

  return (
    <View style={[styles.nav, { backgroundColor: colors.navBg, borderColor: colors.border }]}>
      {finalTabs.map((t) => {
        const isActive = t.key === activeKey;
        const iconColor = isActive ? colors.activeIcon : colors.inactiveIcon;

        const shouldAnimateNotif = t.key === 'notifications' && t.showBadge;
        const iconWrapStyle = shouldAnimateNotif ? { transform: [{ scale: notifScale }] } : null;

        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => (isActive ? null : onNavigate?.(t.route))}
            disabled={isActive}
            activeOpacity={0.85}
            style={styles.item}
          >
            <Animated.View
              style={[
                styles.iconCircle,
                { backgroundColor: isActive ? colors.activeBg : colors.navBg },
                iconWrapStyle,
              ]}
            >
              <View style={styles.iconInner}>
                {t.icon(iconColor)}

                {/* Badge (only if this tab wants badge AND we have count) */}
                {t.showBadge && badgeText ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeText}</Text>
                  </View>
                ) : null}
              </View>
            </Animated.View>

            <Text style={[styles.label, { color: colors.label, fontWeight: isActive ? '800' : '600' }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  item: { alignItems: 'center' },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  label: {
    fontSize: 12,
    marginTop: 6,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    height: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 26,
  },
  badgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '900',
  },
});
