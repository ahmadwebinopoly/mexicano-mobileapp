import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

const HORIZONTAL_PADDING = 20;

export function StoryScreenSkeleton() {
  return (
    <View style={styles.content}>
      <SkeletonBox width={120} height={19} borderRadius={4} style={styles.title} />
      <View style={styles.contentBox}>
        <SkeletonBox width="100%" height={15} borderRadius={4} style={styles.bodyLine} />
        <SkeletonBox width="95%" height={15} borderRadius={4} style={styles.bodyLine} />
        <SkeletonBox width="88%" height={15} borderRadius={4} style={styles.bodyLine} />
        <SkeletonBox width="92%" height={15} borderRadius={4} style={styles.bodyLine} />
        <SkeletonBox width="75%" height={15} borderRadius={4} style={styles.bodyLineLast} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    marginBottom: 16,
  },
  contentBox: {
    backgroundColor: 'rgba(21,44,41,0.8)',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.2)',
  },
  bodyLine: {
    marginBottom: 12,
  },
  bodyLineLast: {
    marginBottom: 0,
  },
});
