import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

// Match DiscoverScreen layout exactly (scrollContent padding is applied by parent ScrollView).
const CARD_BG = '#152C29';
const SECTION_MARGIN_BOTTOM = 20;
const SECTION_TITLE_MARGIN_BOTTOM = 10;
const MENU_ROW_PADDING = 10;
const MENU_ROW_MARGIN_BOTTOM = 10;
const MENU_ROW_BORDER_RADIUS = 14;
const MENU_ROW_TEXT_MARGIN_RIGHT = 8;
const IMAGE_SIZE = 68;
const IMAGE_BORDER_RADIUS = 10;
const BOTTOM_SPACER_HEIGHT = 96;

export function DiscoverScreenSkeleton() {
  return (
    <>
      <View style={styles.section}>
        <SkeletonBox width={100} height={16} style={styles.sectionTitle} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.menuRow}>
            <View style={styles.menuRowText}>
              <SkeletonBox width="72%" height={14} style={styles.line1} />
              <SkeletonBox width="90%" height={10} style={styles.line2} />
              <SkeletonBox width={48} height={12} style={styles.line3} />
            </View>
            <View style={styles.menuRowRight}>
              <SkeletonBox
                width={IMAGE_SIZE}
                height={IMAGE_SIZE}
                borderRadius={IMAGE_BORDER_RADIUS}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <SkeletonBox width={90} height={16} style={styles.sectionTitle} />
        {[1, 2].map((i) => (
          <View key={i} style={styles.menuRow}>
            <View style={styles.menuRowText}>
              <SkeletonBox width="68%" height={14} style={styles.line1} />
              <SkeletonBox width="85%" height={10} style={styles.line2} />
              <SkeletonBox width={44} height={12} style={styles.line3} />
            </View>
            <View style={styles.menuRowRight}>
              <SkeletonBox
                width={IMAGE_SIZE}
                height={IMAGE_SIZE}
                borderRadius={IMAGE_BORDER_RADIUS}
              />
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
    marginBottom: SECTION_MARGIN_BOTTOM,
  },
  sectionTitle: {
    marginBottom: SECTION_TITLE_MARGIN_BOTTOM,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: MENU_ROW_BORDER_RADIUS,
    padding: MENU_ROW_PADDING,
    marginBottom: MENU_ROW_MARGIN_BOTTOM,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
  },
  menuRowText: {
    flex: 1,
    minWidth: 0,
    marginRight: MENU_ROW_TEXT_MARGIN_RIGHT,
    justifyContent: 'center',
  },
  line1: {
    marginBottom: 2,
  },
  line2: {
    marginBottom: 6,
  },
  line3: {
    marginTop: 0,
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
