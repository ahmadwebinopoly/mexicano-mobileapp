import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ADDON_CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - 10) / 2;
const ADDON_SKELETON_COUNT = 6;

/**
 * Skeleton for OrderDetailsScreen. Add-ons use a fixed grid of placeholders
 * so layout stays correct whether admin has few or many add-ons.
 */
export function OrderDetailsScreenSkeleton() {
  return (
    <View style={styles.content}>
      <View style={styles.imageContainer}>
        <View style={styles.imageWrap}>
          <SkeletonBox width="100%" height="100%" borderRadius={16} style={StyleSheet.absoluteFill} />
        </View>
      </View>

      <View style={styles.detailSection}>
        <View style={styles.titleRow}>
          <SkeletonBox width="60%" height={20} style={{ marginRight: 12 }} />
          <SkeletonBox width={56} height={18} />
        </View>
        <SkeletonBox width="92%" height={13} style={{ marginBottom: 6 }} />
        <SkeletonBox width="78%" height={13} style={{ marginBottom: 10 }} />
        <View style={styles.metaRow}>
          <SkeletonBox width={58} height={12} />
          <SkeletonBox width={72} height={12} />
        </View>
      </View>

      <View style={styles.addonsSection}>
        <SkeletonBox width={80} height={16} style={styles.addonsTitle} />
        <View style={styles.addonsGrid}>
          {Array.from({ length: ADDON_SKELETON_COUNT }, (_, i) => (
            <View key={i} style={styles.addonCard}>
              <SkeletonBox width={56} height={56} borderRadius={12} style={styles.addonImage} />
              <SkeletonBox width="80%" height={12} style={{ marginBottom: 4 }} />
              <SkeletonBox width={36} height={13} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.bottomSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  imageContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 16,
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    maxHeight: 240,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(21,44,41,0.6)',
    position: 'relative',
  },
  detailSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  addonsSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 8,
  },
  addonsTitle: {
    marginBottom: 12,
  },
  addonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addonCard: {
    width: ADDON_CARD_WIDTH,
    backgroundColor: 'rgba(21,44,41,0.6)',
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  addonImage: {
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 24,
  },
});
