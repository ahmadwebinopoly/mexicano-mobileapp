import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getStory } from '../../api/content';
import { StoryScreenSkeleton } from '../../components/skeleton';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const HORIZONTAL_PADDING = 20;

export default function StoryScreen() {
  const [story, setStory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const text = await getStory();
        if (!cancelled) setStory(text || '');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load story');
          setStory('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Brand Story</Text>
        {loading ? (
          <StoryScreenSkeleton />
        ) : error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.contentBox}>
            <Text style={styles.body}>{story || 'No story content yet.'}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 16,
  },
  contentBox: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: TEXT_WHITE,
  },
  errorWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
});
