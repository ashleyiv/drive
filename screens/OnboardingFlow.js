import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
} from 'react-native';

import onboardSteering from '../assets/onboard-steering.png';
import onboardGeo from '../assets/onboard-geo.png';
import onboardVoice from '../assets/onboard-voice.png';

const onboardingScreens = [
  {
    title: 'Steering Behavior Monitoring',
    description: 'Monitor unusual or unsafe steering behavior',
    image: onboardSteering,
  },
  {
    title: 'Geolocation Tracking',
    description: "Record the vehicle's location during drowsiness events",
    image: onboardGeo,
  },
  {
    title: 'Voice Input for Alarm Activation',
    description: 'Voice-based alert prompts that help increase driver awareness',
    image: onboardVoice,
  },
];

export default function OnboardingFlow({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < onboardingScreens.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const currentScreen = onboardingScreens[currentIndex];

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.illustrationWrapper}>
          <View style={styles.illustrationBox}>
            <Image
              source={currentScreen.image}
              style={styles.illustrationImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={styles.title}>{currentScreen.title}</Text>
        <Text style={styles.description}>{currentScreen.description}</Text>
      </View>

      <View style={styles.footer}>
        {/* Dots */}
        <View style={styles.dotsContainer}>
          {onboardingScreens.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>

        <Pressable style={styles.button} onPress={handleNext}>
          <Text style={styles.buttonText}>
            {currentIndex === onboardingScreens.length - 1
              ? 'Get Started'
              : 'Next'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 24,
    paddingTop: 64,
    paddingBottom: 32,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationWrapper: {
    marginBottom: 60,
  },
  illustrationBox: {
    width: 200,
    height: 200,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationImage: {
    width: 350,
    height: 350,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'WorkSans_700Bold',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 12,
    maxWidth: 280,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#6B7280',
    maxWidth: 280,
  },
  footer: {
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: {
    width: 32,
    backgroundColor: '#1E3A8A',
  },
  inactiveDot: {
    width: 8,
    backgroundColor: '#D1D5DB',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#1E3A8A',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
