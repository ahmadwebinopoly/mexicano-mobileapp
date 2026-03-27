import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const CARD_BG = '#152C29';

function WishlistGridCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <SkeletonBox width={56} height={56} borderRadius={28} />
        <SkeletonBox width={28} height={28} borderRadius={14} />
      </View>
      <SkeletonBox width="72%" height={14} borderRadius={4} style={styles.nameLine} />
      <SkeletonBox width="42%" height={14} borderRadius={4} />
    </View>
  );
}

type WishlistScreenSkeletonProps = {
  itemCount?: number;
};

export function WishlistScreenSkeleton({ itemCount = 0 }: WishlistScreenSkeletonProps) {
  const count = Number.isFinite(itemCount) && itemCount > 0 ? Math.floor(itemCount) : 2;
  const placeholders = Array.from({ length: count }, (_, i) => i);

  return (
    <View style={styles.gridWrap}>
      {placeholders.map((i) => (
        <View key={i} style={styles.cell}>
          <WishlistGridCardSkeleton />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 24,
    gap: 12,
  },
  cell: {
    width: '48%',
  },
  card: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
    padding: 12,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nameLine: {
    marginBottom: 8,
  },
});

