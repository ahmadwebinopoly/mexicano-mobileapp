import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;
const IMAGE_HORIZONTAL_PADDING = 8;

interface ItemDetailScreenSkeletonProps {
  /** When true, skip the hero image (parent already shows it). */
  skipImage?: boolean;
}

export function ItemDetailScreenSkeleton({ skipImage = false }: ItemDetailScreenSkeletonProps = {}) {
  return (
    <View style={styles.content}>
      {!skipImage && (
        <View style={styles.imageWrap}>
          <SkeletonBox width="100%" height="100%" borderRadius={16} style={styles.absoluteFill} />
        </View>
      )}

      <View style={styles.detailSection}>
        <View style={styles.titleRow}>
          <SkeletonBox width="65%" height={22} style={{ marginRight: 12 }} />
          <SkeletonBox width={70} height={18} />
        </View>
        <SkeletonBox width="90%" height={14} style={{ marginBottom: 12 }} />
        <View style={styles.metaRow}>
          <SkeletonBox width={60} height={14} />
          <SkeletonBox width={80} height={14} />
          <SkeletonBox width={40} height={14} />
        </View>
        <View style={styles.deliveryRow}>
          <View style={{ flex: 1 }}>
            <SkeletonBox width="70%" height={14} style={{ marginBottom: 6 }} />
            <SkeletonBox width="90%" height={12} />
          </View>
          <SkeletonBox width={70} height={36} borderRadius={10} />
        </View>
      </View>

      <View style={styles.addonsSection}>
        <SkeletonBox width={160} height={18} style={{ marginBottom: 14 }} />
        <View style={styles.addonsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.addonCard}>
              <SkeletonBox width={64} height={64} borderRadius={32} style={{ alignSelf: 'center', marginBottom: 8 }} />
              <SkeletonBox width="80%" height={14} style={{ marginBottom: 6 }} />
              <SkeletonBox width={50} height={14} />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  absoluteFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  imageWrap: {
    marginHorizontal: IMAGE_HORIZONTAL_PADDING,
    marginTop: 12,
    marginBottom: 16,
    width: '100%',
    aspectRatio: 16 / 10,
    maxHeight: 260,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(21,44,41,0.6)',
    position: 'relative',
  },
  detailSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(31,64,60,0.6)',
    borderRadius: 12,
    padding: 14,
  },
  addonsSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
  },
  addonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  addonCard: {
    width: '48%',
    backgroundColor: 'rgba(21,44,41,0.6)',
    borderRadius: 16,
    padding: 12,
  },
});
