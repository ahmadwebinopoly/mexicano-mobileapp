import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { submitReview } from '../../api/review';
import { getNetworkErrorMessage } from '../../api/apiConfig';

const BG = '#0B1D1B';
const CARD = '#152C29';
const CARD_MUTED = '#1A2422';
const GOLD = '#FECB4D';
const TEXT = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.65)';
const H_PAD = 20;

const FEEDBACK_TAGS = [
  'Still Hot',
  'Friendly Driver',
  'Extra Salsa',
  'Perfect Spices',
  'Generous Portions',
] as const;

type RouteParams = {
  orderId: string;
  items: string;
  amount: string;
};

function StarRow({
  value,
  onChange,
  size,
  gap = 6,
  align = 'end',
}: {
  value: number;
  onChange: (n: number) => void;
  size: number;
  gap?: number;
  align?: 'center' | 'end';
}) {
  return (
    <View style={[starStyles.row, { gap }, align === 'center' && starStyles.rowCenter]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={4}>
          <Ionicons name={i <= value ? 'star' : 'star-outline'} size={size} color={GOLD} />
        </Pressable>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  rowCenter: {
    justifyContent: 'center',
  },
});

export default function RateYourFeastScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId, items, amount } = (route.params || {}) as RouteParams;

  const [overall, setOverall] = useState(0);
  const [foodQuality, setFoodQuality] = useState(0);
  const [servicesRates, setServicesRates] = useState(0);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const onPickPhotos = () => {
    Alert.alert(
      'Photos',
      'Photo upload from your library will be available in a future update. For now, you can submit your star ratings and written feedback.',
      [{ text: 'OK' }]
    );
  };

  const onSubmit = async () => {
    if (overall < 1) {
      Alert.alert('Rating needed', 'Please rate your overall experience with the stars above.');
      return;
    }
    if (foodQuality < 1 || servicesRates < 1) {
      Alert.alert(
        'Rate all categories',
        'Please give a star rating for Food Quality and for Services — both are required to submit your review.'
      );
      return;
    }
    if (submitting) return;
    if (!orderId || !String(orderId).trim()) {
      Alert.alert('Missing order', 'Please open this screen from Reviews and select an order.');
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({
        orderId: String(orderId).trim(),
        overallRating: overall,
        foodQualityRating: foodQuality >= 1 ? foodQuality : undefined,
        servicesRating: servicesRates >= 1 ? servicesRates : undefined,
        /** Only whitelisted tags — avoids backend errors if a bad value is ever in state. */
        tags: FEEDBACK_TAGS.filter((t) => selectedTags.has(t)),
        comment: comment.trim() || undefined,
      });
      Alert.alert('Thank you!', 'Your review has been submitted. We appreciate your feedback.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Could not submit review', getNetworkErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  const titleLine = items?.trim() || 'Your order';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.topBar}>
            <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color={TEXT} />
            </Pressable>
            <Text style={styles.screenTitle} numberOfLines={1}>
              Rate Your Feast
            </Text>
            <Text style={styles.brandMark}>MEXICANO</Text>
          </View>

          {/* Order summary */}
          <View style={styles.summaryCard}>
            <View style={styles.thumb}>
              <Ionicons name="fast-food" size={36} color={GOLD} />
            </View>
            <View style={styles.summaryText}>
              <Text style={styles.lastOrderLabel}>LAST ORDER</Text>
              <Text style={styles.orderName} numberOfLines={3}>
                {titleLine}
              </Text>
              <Text style={styles.price}>{amount || '—'}</Text>
            </View>
          </View>

          {/* Overall */}
          <Text style={styles.sectionQuestion}>How was your meal?</Text>
          <View style={styles.overallStars}>
            <StarRow value={overall} onChange={setOverall} size={36} gap={10} align="center" />
          </View>

          {/* Detailed */}
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Food Quality</Text>
              <StarRow value={foodQuality} onChange={setFoodQuality} size={18} gap={4} />
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Services Rates</Text>
              <StarRow value={servicesRates} onChange={setServicesRates} size={18} gap={4} />
            </View>
          </View>

          {/* Tags */}
          <Text style={styles.subheading}>What stood out?</Text>
          <View style={styles.chipWrap}>
            {FEEDBACK_TAGS.map((tag) => {
              const on = selectedTags.has(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Photos */}
          <Text style={styles.subheading}>Add photos of your feast</Text>
          <Pressable style={styles.photoBox} onPress={onPickPhotos}>
            <Ionicons name="camera-outline" size={40} color={GOLD} />
            <Text style={styles.photoHint}>Tap to upload photos</Text>
          </Pressable>

          {/* Comment */}
          <Text style={styles.subheading}>Tell us more about your experience...</Text>
          <TextInput
            style={styles.textArea}
            placeholder="The salsa was incredibly fresh and the meat was perfectly seasoned..."
            placeholderTextColor={MUTED}
            multiline
            value={comment}
            onChangeText={setComment}
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={() => void onSubmit()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={BG} />
            ) : (
              <>
                <Text style={styles.submitText}>SUBMIT REVIEW</Text>
                <Ionicons name="send" size={18} color={BG} />
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    flex: 1,
    marginLeft: 12,
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
  },
  brandMark: {
    fontSize: 11,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 2,
  },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.2)',
    gap: 14,
  },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: CARD_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  summaryText: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  lastOrderLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  orderName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT,
    lineHeight: 22,
    marginBottom: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: GOLD,
  },
  sectionQuestion: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    marginBottom: 16,
  },
  overallStars: {
    alignItems: 'center',
    marginBottom: 24,
  },
  detailCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT,
    flex: 1,
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 14,
  },
  subheading: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 22,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: CARD_MUTED,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipOn: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  chipTextOn: {
    color: BG,
  },
  photoBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(254,203,77,0.45)',
    borderRadius: 14,
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  photoHint: {
    marginTop: 10,
    fontSize: 13,
    color: MUTED,
    fontWeight: '600',
  },
  textArea: {
    minHeight: 120,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: TEXT,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: GOLD,
    paddingVertical: 16,
    borderRadius: 999,
    marginBottom: 16,
    minHeight: 52,
  },
  submitBtnDisabled: {
    opacity: 0.85,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '900',
    color: BG,
    letterSpacing: 0.8,
  },
});
