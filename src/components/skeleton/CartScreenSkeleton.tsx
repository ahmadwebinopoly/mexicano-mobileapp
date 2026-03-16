import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;

export function CartScreenSkeleton() {
  return (
    <View style={styles.content}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <SkeletonBox width={80} height={80} borderRadius={12} />
          <View style={styles.cardBody}>
            <SkeletonBox width="80%" height={16} style={{ marginBottom: 8 }} />
            <SkeletonBox width="50%" height={12} style={{ marginBottom: 8 }} />
            <SkeletonBox width={60} height={14} style={{ marginBottom: 12 }} />
            <View style={styles.quantityRow}>
              <SkeletonBox width={32} height={32} borderRadius={16} />
              <SkeletonBox width={28} height={28} borderRadius={14} />
              <SkeletonBox width={32} height={32} borderRadius={16} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(21,44,41,0.6)',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  cardBody: {
    flex: 1,
    marginLeft: 14,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
