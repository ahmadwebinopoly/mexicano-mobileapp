import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

// Match MenuScreen scroll content and product card layout exactly.
const HORIZONTAL_PADDING = 20;
const CARD_BG = '#152C29';
const PRODUCT_IMAGE_HEIGHT = 160;
const PRODUCT_INFO_PADDING = 16;
const PRODUCT_CARD_MARGIN_BOTTOM = 16;
const PRODUCT_TOP_ROW_MARGIN_BOTTOM = 4;
const PRODUCT_DESC_MARGIN_BOTTOM = 8;
const PRODUCT_META_ROW_MARGIN_TOP = 8;
const META_GAP = 12;
const ADD_BUTTON_SIZE = 24;
const BOTTOM_SPACER_HEIGHT = 96;

export function MenuScreenSkeleton() {
  return (
    <>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.productCard}>
          <View style={styles.productImageWrap}>
            <SkeletonBox
              width="100%"
              height={PRODUCT_IMAGE_HEIGHT}
              borderRadius={0}
              style={StyleSheet.absoluteFill}
            />
          </View>
          <View style={styles.productInfo}>
            <View style={styles.productTopRow}>
              <SkeletonBox width="60%" height={14} borderRadius={4} />
              <SkeletonBox width={48} height={12} borderRadius={4} />
            </View>
            <SkeletonBox width="100%" height={10} borderRadius={4} style={styles.descLine} />
            <SkeletonBox width="85%" height={10} borderRadius={4} style={styles.descLine} />
            <View style={styles.productMetaRow}>
              <SkeletonBox width={56} height={10} borderRadius={4} />
              <SkeletonBox width={52} height={10} borderRadius={4} />
              <View style={styles.metaSpacer} />
              <SkeletonBox width={ADD_BUTTON_SIZE} height={ADD_BUTTON_SIZE} borderRadius={ADD_BUTTON_SIZE / 2} />
            </View>
          </View>
        </View>
      ))}
      <View style={{ height: BOTTOM_SPACER_HEIGHT }} />
    </>
  );
}

const styles = StyleSheet.create({
  productCard: {
    marginBottom: PRODUCT_CARD_MARGIN_BOTTOM,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
  },
  productImageWrap: {
    height: PRODUCT_IMAGE_HEIGHT,
    backgroundColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  productInfo: {
    padding: PRODUCT_INFO_PADDING,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: PRODUCT_TOP_ROW_MARGIN_BOTTOM,
  },
  descLine: {
    marginBottom: 4,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: META_GAP,
    marginTop: PRODUCT_META_ROW_MARGIN_TOP,
  },
  metaSpacer: {
    flex: 1,
  },
});
