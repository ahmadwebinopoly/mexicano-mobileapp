import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SkeletonBox } from './SkeletonBox';

export function ContactScreenSkeleton() {
  return (
    <View style={styles.content}>
      <SkeletonBox width={140} height={18} borderRadius={4} style={styles.title} />
      <SkeletonBox width={90} height={12} borderRadius={4} style={styles.label} />
      <SkeletonBox width="100%" height={40} borderRadius={10} style={styles.input} />
      <SkeletonBox width={100} height={12} borderRadius={4} style={styles.label} />
      <SkeletonBox width="100%" height={40} borderRadius={10} style={styles.input} />
      <SkeletonBox width={85} height={12} borderRadius={4} style={styles.label} />
      <SkeletonBox width="100%" height={80} borderRadius={10} style={styles.messageInput} />
      <SkeletonBox width="100%" height={44} borderRadius={10} style={styles.submitButton} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    marginBottom: 12,
  },
  label: {
    marginBottom: 4,
  },
  input: {
    marginBottom: 12,
  },
  messageInput: {
    marginBottom: 12,
  },
  submitButton: {
    marginTop: 4,
    marginBottom: 24,
  },
});
