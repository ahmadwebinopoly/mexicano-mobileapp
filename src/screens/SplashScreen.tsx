import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

interface SplashScreenProps {
  onFinish: () => void;
}

const BG_COLOR = '#152C29';
const TEXT_COLOR = '#FFFFFF';
const BUTTON_BG = '#FECB4D';
const BUTTON_HOVER = '#E5B948';

const WAVE_HEIGHT = 100;

function WaveTop() {
  const { width } = useWindowDimensions();
  const path = `M 0 ${WAVE_HEIGHT} Q ${width * 0.25} 30 ${width * 0.5} 60 T ${width} 50 L ${width} 0 L 0 0 Z`;
  return (
    <Svg
      width={width}
      height={WAVE_HEIGHT}
      style={{ position: 'absolute', top: 0, left: 0, opacity: 0.5 }}
      viewBox={`0 0 ${width} ${WAVE_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Path d={path} fill={TEXT_COLOR} />
    </Svg>
  );
}

function WaveTopLayer2() {
  const { width } = useWindowDimensions();
  const path = `M 0 ${WAVE_HEIGHT} Q ${width * 0.33} 20 ${width * 0.66} 55 T ${width} 45 L ${width} 0 L 0 0 Z`;
  return (
    <Svg
      width={width}
      height={WAVE_HEIGHT}
      style={{ position: 'absolute', top: 0, left: 0, opacity: 0.5 }}
      viewBox={`0 0 ${width} ${WAVE_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Path d={path} fill={TEXT_COLOR} />
    </Svg>
  );
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [buttonPressed, setButtonPressed] = useState(false);

  const handlePressIn = () => setButtonPressed(true);
  const handlePressOut = () => setButtonPressed(false);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Wavy background layers - top section */}
      <View style={styles.waveContainer}>
        <WaveTopLayer2 />
        <WaveTop />
      </View>

      {/* Middle: Logo + Brand + Tagline */}
      <View style={styles.middleSection}>
        <Image
          source={require('../../assets/Splash.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.brandNameContainer}>
          <Text style={styles.brandName}>MEXICANO</Text>
          <View style={styles.brandUnderline} />
        </View>
        <Text style={styles.tagline}>TASTE THE HEAT</Text>
      </View>

      {/* Bottom: CTA Button */}
      <View style={styles.bottomSection}>
        <Pressable
          onPress={onFinish}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.button,
            (pressed || buttonPressed) && styles.buttonHover,
          ]}
        >
          <Text style={styles.buttonText}>Let's Explore</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
    paddingHorizontal: 24,
  },
  waveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: WAVE_HEIGHT,
  },
  middleSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 224, // w-56 = 224px
    marginTop: 64,
    marginBottom: 40,
  },
  brandNameContainer: {
    alignItems: 'center',
  },
  brandName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 36,
    fontWeight: '700',
    color: TEXT_COLOR,
    letterSpacing: 6, // ~0.2em
  },
  brandUnderline: {
    height: 3,
    backgroundColor: BUTTON_BG,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  tagline: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    opacity: 0.9,
    letterSpacing: 4, // ~0.3em
    marginTop: 8,
  },
  bottomSection: {
    paddingBottom: 64,
    alignItems: 'center',
  },
  button: {
    backgroundColor: BUTTON_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 56,
  },
  buttonHover: {
    backgroundColor: BUTTON_HOVER,
  },
  buttonText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});
