// driveash/components/ModeSwitchLoadingScreen.js
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';

export default function ModeSwitchLoadingScreen({
  title = 'Loading…',
  subtitle = 'Switching…',
  durationMs = 1800,
  onDone,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);
const onDoneRef = useRef(onDone);

// keep latest onDone without restarting the animation
useEffect(() => {
  onDoneRef.current = onDone;
}, [onDone]);


useEffect(() => {
  doneRef.current = false;
  progress.setValue(0);

  const anim = Animated.timing(progress, {
    toValue: 1,
    duration: durationMs,
    easing: Easing.inOut(Easing.ease),
    useNativeDriver: false,
  });

  anim.start(({ finished }) => {
    if (!finished) return;
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current?.(); // ✅ use ref so re-renders don't restart animation
  });

  return () => {
    try {
      anim.stop();
    } catch {}
  };
}, [durationMs]); // ✅ DO NOT depend on onDone / progress


  const barWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={{ flex: 1, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>{title}</Text>
      <Text style={{ marginTop: 6, fontSize: 12, fontWeight: '700', color: '#6B7280' }}>{subtitle}</Text>

      <View
        style={{
          marginTop: 22,
          width: 220,
          height: 8,
          backgroundColor: '#E5E7EB',
          borderRadius: 999,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={{
            height: 8,
            width: barWidth,
            backgroundColor: '#2563EB',
            borderRadius: 999,
          }}
        />
      </View>
    </View>
  );
}
