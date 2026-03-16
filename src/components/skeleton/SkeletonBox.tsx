import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';

const SKELETON_COLOR = 'rgba(255,255,255,0.12)';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle;
  pulse?: boolean;
}

export function SkeletonBox({
  width,
  height,
  borderRadius = 8,
  style,
  pulse = true,
}: SkeletonBoxProps) {
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!pulse) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity, pulse]);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: width ?? '100%',
          height: height ?? 20,
          borderRadius,
          opacity: pulse ? opacity : 1,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: SKELETON_COLOR,
  },
});
