import React from 'react';
import { View, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonBox } from './SkeletonBox';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const TEXT_WHITE = '#FFFFFF';
const HORIZONTAL_PADDING = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 220;
const MAP_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;

/** Mirrors ViewOrderDetailsScreen layout while order data is loading (no API delay). */
export function ViewOrderDetailsScreenSkeleton() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={BG_DARK} />
          </Pressable>
          <SkeletonBox width={130} height={18} borderRadius={6} style={styles.headerTitleSkeleton} />
          <View style={styles.headerRightSpacer} />
        </View>

        {/* Placed time — compactTimeCard */}
        <View style={styles.compactTimeCard}>
          <SkeletonBox width="72%" height={14} borderRadius={6} />
        </View>

        {/* Order summary — cardCompact */}
        <View style={styles.cardCompact}>
          <SkeletonBox width={120} height={16} borderRadius={6} style={{ marginBottom: 8 }} />
          <View style={styles.summaryHeroRow}>
            <SkeletonBox width={72} height={72} borderRadius={14} />
            <View style={styles.summaryTextCol}>
              <SkeletonBox width="100%" height={14} borderRadius={6} style={{ marginBottom: 8 }} />
              <SkeletonBox width="85%" height={14} borderRadius={6} style={{ marginBottom: 10 }} />
              <SkeletonBox width={88} height={24} borderRadius={8} />
            </View>
            <SkeletonBox width={56} height={22} borderRadius={8} />
          </View>
          <View style={styles.lineItemsSkeleton}>
            <View style={styles.lineItemRowSk}>
              <SkeletonBox width={6} height={6} borderRadius={3} />
              <SkeletonBox width="88%" height={13} borderRadius={6} />
            </View>
            <View style={styles.lineItemRowSk}>
              <SkeletonBox width={6} height={6} borderRadius={3} />
              <SkeletonBox width="72%" height={13} borderRadius={6} />
            </View>
          </View>
          <View style={styles.totalRow}>
            <SkeletonBox width={48} height={18} borderRadius={6} />
            <SkeletonBox width={72} height={22} borderRadius={8} />
          </View>
        </View>

        {/* Progress — cardCompact + StatusProgressLine area */}
        <View style={styles.cardCompact}>
          <View style={styles.cardHeaderRow}>
            <SkeletonBox width={88} height={16} borderRadius={6} />
            <SkeletonBox width={72} height={28} borderRadius={10} />
          </View>
          <View style={styles.progressSkeleton}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.progressCol}>
                <View style={styles.progressTrackRow}>
                  <View style={styles.trackSegFill}>
                    <SkeletonBox width="100%" height={3} borderRadius={2} />
                  </View>
                  <SkeletonBox width={11} height={11} borderRadius={6} />
                  <View style={styles.trackSegFill}>
                    <SkeletonBox width="100%" height={3} borderRadius={2} />
                  </View>
                </View>
                <SkeletonBox width="100%" height={8} borderRadius={4} style={{ marginTop: 8 }} />
              </View>
            ))}
          </View>
        </View>

        {/* Rate Your Feast button placeholder */}
        <View style={styles.addReviewWrap}>
          <SkeletonBox width="100%" height={44} borderRadius={12} />
        </View>

        {/* Location */}
        <View style={styles.cardCompact}>
          <View style={styles.sectionTitleRow}>
            <SkeletonBox width={16} height={16} borderRadius={8} />
            <SkeletonBox width={160} height={17} borderRadius={6} />
          </View>
          <SkeletonBox width="92%" height={12} borderRadius={6} style={{ marginBottom: 10 }} />
          <SkeletonBox width="100%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
          <SkeletonBox width="78%" height={14} borderRadius={6} style={{ marginBottom: 14 }} />
          <View style={styles.editMapRow}>
            <SkeletonBox width={140} height={15} borderRadius={6} />
            <SkeletonBox width={14} height={14} borderRadius={7} />
          </View>
        </View>

        {/* Map */}
        <View style={styles.mapSection}>
          <View style={styles.mapHeader}>
            <SkeletonBox width={100} height={17} borderRadius={6} />
            <SkeletonBox width={96} height={30} borderRadius={999} />
          </View>
          <View style={styles.mapContainer}>
            <SkeletonBox
              width={MAP_WIDTH}
              height={MAP_HEIGHT}
              borderRadius={14}
              style={styles.mapInner}
            />
          </View>
          <View style={styles.viewLargerMap}>
            <SkeletonBox width={120} height={15} borderRadius={6} />
          </View>
        </View>

        {/* Notes card placeholder */}
        <View style={styles.cardCompact}>
          <SkeletonBox width={52} height={12} borderRadius={6} style={{ marginBottom: 8 }} />
          <SkeletonBox width="94%" height={14} borderRadius={6} style={{ marginBottom: 6 }} />
          <SkeletonBox width="72%" height={14} borderRadius={6} />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FECB4D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightSpacer: {
    width: 32,
    height: 32,
  },
  headerTitleSkeleton: {
    flex: 1,
    marginHorizontal: 12,
    alignSelf: 'center',
    maxWidth: 200,
  },
  compactTimeCard: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.15)',
  },
  cardCompact: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.15)',
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  addReviewWrap: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginTop: 2,
    marginBottom: 10,
  },
  summaryHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 4,
  },
  summaryTextCol: {
    flex: 1,
    minWidth: 0,
  },
  lineItemsSkeleton: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  lineItemRowSk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  totalRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(254,203,77,0.25)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSkeleton: {
    marginTop: 8,
    paddingVertical: 6,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  progressCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
    paddingHorizontal: 1,
  },
  progressTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  trackSegFill: {
    flex: 1,
    minWidth: 4,
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  editMapRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mapSection: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mapContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0a1614',
    alignItems: 'center',
  },
  mapInner: {
    alignSelf: 'center',
  },
  viewLargerMap: {
    marginTop: 10,
    alignItems: 'center',
  },
  bottomSpacer: {
    height: 24,
  },
});
