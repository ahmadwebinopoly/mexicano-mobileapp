import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;

export function CheckoutScreenSkeleton() {
  return (
    <View style={styles.content}>
      <SkeletonBox width={140} height={14} style={styles.sectionTitle} />
      {[1, 2].map((i) => (
        <View key={i} style={styles.cartRow}>
          <SkeletonBox width={56} height={56} borderRadius={10} />
          <View style={styles.cartRowBody}>
            <SkeletonBox width="75%" height={15} style={{ marginBottom: 6 }} />
            <SkeletonBox width="40%" height={11} style={{ marginBottom: 8 }} />
            <View style={styles.row}>
              <SkeletonBox width={50} height={14} />
              <View style={styles.quantityRow}>
                <SkeletonBox width={28} height={28} borderRadius={14} />
                <SkeletonBox width={20} height={14} />
                <SkeletonBox width={28} height={28} borderRadius={14} />
              </View>
            </View>
          </View>
        </View>
      ))}

      <SkeletonBox width={120} height={14} style={[styles.sectionTitle, { marginTop: 24 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 20,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  cartRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(21,44,41,0.6)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    alignItems: 'center',
  },
  cartRowBody: {
    flex: 1,
    marginLeft: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
