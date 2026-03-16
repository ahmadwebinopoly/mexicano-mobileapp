import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const CARD_BG = 'rgba(255, 255, 255, 0.08)';

export function OnBoardingScreenSkeleton() {
  return (
    <View style={styles.content}>
      {/* Brand section skeleton */}
      <View style={styles.brandSection}>
        <SkeletonBox width={220} height={150} borderRadius={8} style={styles.logo} />
        <SkeletonBox width={180} height={32} borderRadius={6} style={styles.brandName} />
        <SkeletonBox width={120} height={3} borderRadius={2} style={styles.underline} />
        <SkeletonBox width={140} height={14} borderRadius={4} style={styles.tagline} />
      </View>

      {/* Cards section skeleton */}
      <View style={styles.cardsSection}>
        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <SkeletonBox width={40} height={40} borderRadius={8} style={styles.cardIcon} />
            <SkeletonBox width="80%" height={16} borderRadius={4} style={styles.cardTitle} />
            <SkeletonBox width="100%" height={12} borderRadius={4} style={styles.cardDesc} />
            <SkeletonBox width="60%" height={12} borderRadius={4} />
          </View>
          <View style={styles.card}>
            <SkeletonBox width={40} height={40} borderRadius={8} style={styles.cardIcon} />
            <SkeletonBox width="75%" height={16} borderRadius={4} style={styles.cardTitle} />
            <SkeletonBox width="100%" height={12} borderRadius={4} style={styles.cardDesc} />
            <SkeletonBox width="55%" height={12} borderRadius={4} />
          </View>
        </View>
        <View style={styles.cardFull}>
          <SkeletonBox width={40} height={40} borderRadius={8} style={styles.cardIcon} />
          <SkeletonBox width="70%" height={16} borderRadius={4} style={styles.cardTitle} />
          <SkeletonBox width="100%" height={12} borderRadius={4} style={styles.cardDesc} />
          <SkeletonBox width="85%" height={12} borderRadius={4} />
        </View>
      </View>

      {/* Continue button skeleton */}
      <View style={styles.bottomSection}>
        <SkeletonBox width={160} height={48} borderRadius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logo: {
    marginBottom: 28,
  },
  brandName: {
    marginBottom: 4,
  },
  underline: {
    marginBottom: 6,
  },
  tagline: {
    marginTop: 0,
  },
  cardsSection: {
    gap: 16,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardFull: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    marginBottom: 8,
  },
  cardDesc: {
    marginBottom: 8,
  },
  bottomSection: {
    paddingTop: 32,
    paddingBottom: 64,
    alignItems: 'center',
  },
});
