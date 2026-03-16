import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;

export function OrdersScreenSkeleton() {
  return (
    <View style={styles.content}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.headerRow}>
            <SkeletonBox width={110} height={16} />
            <SkeletonBox width={74} height={22} borderRadius={8} />
          </View>

          <SkeletonBox width={88} height={22} borderRadius={6} style={{ marginBottom: 10 }} />

          <SkeletonBox width="94%" height={13} style={{ marginBottom: 6 }} />
          <SkeletonBox width="72%" height={13} style={{ marginBottom: 10 }} />

          <View style={styles.addressRow}>
            <SkeletonBox width={14} height={14} borderRadius={7} />
            <SkeletonBox width="76%" height={12} />
          </View>

          <View style={styles.footerRow}>
            <SkeletonBox width={120} height={12} />
            <SkeletonBox width={56} height={16} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 18,
  },
  card: {
    backgroundColor: 'rgba(21,44,41,0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.2)',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingTop: 12,
    marginTop: 2,
  },
});
