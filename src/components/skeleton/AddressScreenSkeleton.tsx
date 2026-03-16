import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;

export function AddressScreenSkeleton() {
  return (
    <View style={styles.content}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.labelRow}>
              <SkeletonBox width={20} height={20} borderRadius={10} />
              <SkeletonBox width={90} height={16} />
              {i === 1 ? <SkeletonBox width={56} height={20} borderRadius={8} /> : null}
            </View>
            <View style={styles.actionsRow}>
              <SkeletonBox width={28} height={28} borderRadius={14} />
              <SkeletonBox width={28} height={28} borderRadius={14} />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <SkeletonBox width={16} height={16} borderRadius={8} />
            <View style={styles.fieldContent}>
              <SkeletonBox width={90} height={10} style={{ marginBottom: 6 }} />
              <SkeletonBox width="96%" height={14} style={{ marginBottom: 5 }} />
              <SkeletonBox width="78%" height={14} />
            </View>
          </View>

          <View style={styles.fieldRow}>
            <SkeletonBox width={16} height={16} borderRadius={8} />
            <View style={styles.fieldContent}>
              <SkeletonBox width={72} height={10} style={{ marginBottom: 6 }} />
              <SkeletonBox width="62%" height={14} />
            </View>
          </View>

          <SkeletonBox width="100%" height={40} borderRadius={10} style={{ marginTop: 2 }} />
          {i !== 1 ? <SkeletonBox width="100%" height={40} borderRadius={10} style={{ marginTop: 10 }} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: 'rgba(21,44,41,0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.18)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  fieldContent: {
    flex: 1,
  },
});
