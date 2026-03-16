import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;
const MAP_HEIGHT = 200;
const DAYS_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export function VisitScreenSkeleton() {
  const mapWidth = Dimensions.get('window').width - HORIZONTAL_PADDING * 2 - 32;

  return (
    <View style={styles.content}>
      {/* Store Location section */}
      <View style={styles.section}>
        <SkeletonBox width={120} height={14} borderRadius={4} style={styles.sectionTitle} />
        <SkeletonBox width={100} height={11} borderRadius={4} style={styles.label} />
        <SkeletonBox width="100%" height={36} borderRadius={8} style={styles.fieldBox} />
        <SkeletonBox width={85} height={11} borderRadius={4} style={styles.label} />
        <SkeletonBox width="100%" height={36} borderRadius={8} style={styles.fieldBox} />
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <SkeletonBox width={35} height={11} borderRadius={4} style={styles.label} />
            <SkeletonBox width="100%" height={36} borderRadius={8} style={styles.fieldBox} />
          </View>
          <View style={styles.rowItemSmall}>
            <SkeletonBox width={40} height={11} borderRadius={4} style={styles.label} />
            <SkeletonBox width="100%" height={36} borderRadius={8} style={styles.fieldBox} />
          </View>
          <View style={styles.rowItemSmall}>
            <SkeletonBox width={55} height={11} borderRadius={4} style={styles.label} />
            <SkeletonBox width="100%" height={36} borderRadius={8} style={styles.fieldBox} />
          </View>
        </View>
        <SkeletonBox width={mapWidth} height={MAP_HEIGHT} borderRadius={10} style={styles.mapContainer} />
        <SkeletonBox width={110} height={12} borderRadius={4} style={styles.mapLink} />
      </View>

      {/* Operating Hours section */}
      <View style={styles.section}>
        <SkeletonBox width={130} height={14} borderRadius={4} style={styles.sectionTitle} />
        {DAYS_ORDER.map((day) => (
          <View key={day} style={styles.hoursRow}>
            <SkeletonBox width={70} height={12} borderRadius={4} />
            <SkeletonBox width={50} height={20} borderRadius={999} />
            <SkeletonBox width={80} height={11} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 6,
    paddingBottom: 24,
  },
  section: {
    backgroundColor: 'rgba(21,44,41,0.8)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.2)',
  },
  sectionTitle: {
    marginBottom: 10,
  },
  label: {
    marginBottom: 4,
  },
  fieldBox: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  rowItem: {
    flex: 1.4,
  },
  rowItemSmall: {
    flex: 1,
  },
  mapContainer: {
    marginTop: 6,
  },
  mapLink: {
    marginTop: 6,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(31,64,60,0.6)',
  },
});
