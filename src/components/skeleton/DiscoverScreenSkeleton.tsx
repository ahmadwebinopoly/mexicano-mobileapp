import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

// Match DiscoverScreen grid card layout (padding is applied by parent).
const CARD_BG = '#152C29';
const SECTION_MARGIN_TOP = 8;
const SECTION_MARGIN_BOTTOM = 6;
const SECTION_TITLE_MARGIN_BOTTOM = 6;

const GRID_CELL_WIDTH = '48%';
const CARD_BORDER_COLOR = 'rgba(229,185,72,0.3)';
const CARD_BORDER_WIDTH = 1;
const CARD_BORDER_RADIUS = 16;
const CARD_MIN_HEIGHT = 155;
const CARD_PADDING = 12;

const CIRCLE_SIZE = 80;
const CIRCLE_RADIUS = 40;
const HEART_SIZE = 26;

const BOTTOM_SPACER_HEIGHT = 96;

function GridCardSkeleton({ keyPrefix }: { keyPrefix: string }) {
  return (
    <View style={styles.productGridCard}>
      {/* Top row: star + rating (left) and heart button (right) */}
      <View style={styles.productGridTopRow}>
        <View style={styles.productGridTopLeftRow}>
          <SkeletonBox
            width={16}
            height={16}
            borderRadius={8}
            key={`${keyPrefix}-star`}
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            pulse={true}
          />
          <SkeletonBox
            width={72}
            height={12}
            borderRadius={6}
            key={`${keyPrefix}-rating`}
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
            pulse={true}
          />
        </View>

        <SkeletonBox
          width={HEART_SIZE}
          height={HEART_SIZE}
          borderRadius={HEART_SIZE / 2}
          key={`${keyPrefix}-heart`}
          style={{ backgroundColor: 'rgba(254, 203, 77, 0.18)' }}
          pulse={true}
        />
      </View>

      {/* Image circle */}
      <View style={styles.productGridImageCircle}>
        <SkeletonBox
          width="100%"
          height="100%"
          borderRadius={CIRCLE_RADIUS}
          key={`${keyPrefix}-img`}
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          pulse={true}
        />
      </View>

      {/* Name */}
      <SkeletonBox
        width="92%"
        height={14}
        borderRadius={7}
        key={`${keyPrefix}-name`}
        style={{ marginTop: 2, backgroundColor: 'rgba(255,255,255,0.08)' }}
        pulse={true}
      />

      {/* Bottom row: price only */}
      <View style={styles.productGridBottomRow}>
        <SkeletonBox
          width={64}
          height={12}
          borderRadius={6}
          key={`${keyPrefix}-price`}
          style={{ backgroundColor: 'rgba(254,203,77,0.35)' }}
          pulse={true}
        />
      </View>
    </View>
  );
}

export function DiscoverScreenSkeleton() {
  return (
    <>
      <View style={styles.section}>
        <SkeletonBox width={100} height={16} style={styles.sectionTitle} />
        {[0, 1, 2].map((row) => (
          <View key={`row-${row}`} style={styles.menuGridRow}>
            <View style={styles.menuGridCell}>
              <GridCardSkeleton keyPrefix={`r${row}-l`} />
            </View>
            <View style={styles.menuGridCell}>
              <GridCardSkeleton keyPrefix={`r${row}-r`} />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <SkeletonBox width={90} height={16} style={styles.sectionTitle} />
        {[0, 1].map((row) => (
          <View key={`row2-${row}`} style={styles.menuGridRow}>
            <View style={styles.menuGridCell}>
              <GridCardSkeleton keyPrefix={`r2${row}-l`} />
            </View>
            <View style={styles.menuGridCell}>
              <GridCardSkeleton keyPrefix={`r2${row}-r`} />
            </View>
          </View>
        ))}
      </View>
      <View style={{ height: BOTTOM_SPACER_HEIGHT }} />
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: SECTION_MARGIN_TOP,
    marginBottom: SECTION_MARGIN_BOTTOM,
  },
  sectionTitle: {
    marginBottom: SECTION_TITLE_MARGIN_BOTTOM,
  },

  menuGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  menuGridCell: {
    width: GRID_CELL_WIDTH,
  },

  productGridCard: {
    backgroundColor: CARD_BG,
    borderRadius: CARD_BORDER_RADIUS,
    borderWidth: CARD_BORDER_WIDTH,
    borderColor: CARD_BORDER_COLOR,
    paddingVertical: CARD_PADDING,
    paddingHorizontal: CARD_PADDING,
    minHeight: CARD_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },

  productGridTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productGridTopLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  productGridImageCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 4,
    overflow: 'hidden',
  },

  productGridBottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
