import { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import driveLogo from '../assets/drivelogo.png'; // Make sure this path is correct

export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.logoWrapper}>
        <View style={styles.logoCircle}>
          <Image source={driveLogo} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={styles.title}>D.R.I.V.E</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoWrapper: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoImage: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: '600',
    letterSpacing: 2,
    color: '#102671',
  },
});
