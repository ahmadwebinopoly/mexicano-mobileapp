import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { submitReview } from '../../api/review';

const BG = '#0B1D1B';
const CARD = '#152C29';
const CARD_MUTED = '#1A2422';
const GOLD = '#FECB4D';
const TEXT = '#FFFFFF';
const MUTED = 'rgba(255,255,255,0.65)';
const H_PAD = 20;

type RouteParams = {
  orderId: string;
  items: string;
  amount: string;
  orderType?: string;
};

type ReviewMode = 'delivery' | 'dining' | 'takeaway';

function getReviewMode(orderType?: string): ReviewMode {
  const t = String(orderType ?? '').trim().toLowerCase();
  if (t.includes('deliver')) return 'delivery';
  if (t.includes('dine')) return 'dining';
  return 'takeaway';
}

function modeExperienceLabels(mode: ReviewMode): [string, string, string] {
  if (mode === 'delivery') return ['Food Quality', 'Delivery Speed', 'Packaging'];
  if (mode === 'dining') return ['Food Quality', 'Staff Service', 'Ambience'];
  return ['Food Quality', 'Pickup Speed', 'Packaging'];
}

function modeTags(mode: ReviewMode): string[] {
  if (mode === 'delivery') return ['Perfect Spice', 'Flavorful', 'Portion Size'];
  if (mode === 'dining') return ['Great Service', 'Fresh', 'Portion Size'];
  return ['Ready on Time', 'Well Packed', 'Flavorful'];
}

function StarPicker({
  value,
  onChange,
  size = 24,
  gap = 6,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: number;
  gap?: number;
}) {
  return (
    <View style={[starStyles.row, { gap }]}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange(i)} hitSlop={6}>
          <Ionicons name="star" size={size} color={i <= value ? GOLD : 'rgba(255,255,255,0.18)'} />
        </Pressable>
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default function RateYourFeastScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId, items, orderType } = (route.params || {}) as RouteParams;
  const mode = useMemo(() => getReviewMode(orderType), [orderType]);
  const labels = useMemo(() => modeExperienceLabels(mode), [mode]);
  const tags = useMemo(() => modeTags(mode), [mode]);

  const [dishRating, setDishRating] = useState(0);
  const [tagSelected, setTagSelected] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [commentInputHeight, setCommentInputHeight] = useState(92);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [experienceRatings, setExperienceRatings] = useState<Record<string, number>>({
    a: 0,
    b: 0,
    c: 0,
  });

  useEffect(() => {
    setExperienceRatings({ a: 0, b: 0, c: 0 });
    setTagSelected(null);
    setDishRating(0);
  }, [mode]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const titleLine = items?.trim() || 'AI Pastor Tacos (3)';
  const reviewOrderType = useMemo<'Delivery' | 'Pickup' | 'Dine In'>(() => {
    if (mode === 'delivery') return 'Delivery';
    if (mode === 'dining') return 'Dine In';
    return 'Pickup';
  }, [mode]);

  const canSubmit = dishRating > 0 && experienceRatings.a > 0 && experienceRatings.b > 0 && experienceRatings.c > 0 && !!orderId?.trim();

  const handleSubmit = async () => {
    if (!orderId?.trim()) {
      Alert.alert('Missing order', 'Order id is missing. Please open review from your order details.');
      return;
    }
    if (!canSubmit) {
      Alert.alert('Incomplete review', 'Please rate all required fields before submitting.');
      return;
    }

    const experience =
      mode === 'delivery'
        ? {
            foodQuality: experienceRatings.a,
            deliverySpeed: experienceRatings.b,
            packaging: experienceRatings.c,
          }
        : mode === 'dining'
          ? {
              foodQuality: experienceRatings.a,
              staffService: experienceRatings.b,
              ambience: experienceRatings.c,
            }
          : {
              foodQuality: experienceRatings.a,
              pickupSpeed: experienceRatings.b,
              packaging: experienceRatings.c,
            };

    try {
      setSubmitting(true);
      const res = await submitReview({
        orderId: String(orderId),
        orderType: reviewOrderType,
        dishRating,
        dishTag: tagSelected ?? undefined,
        comment: comment.trim() || undefined,
        experience,
      });
      setToastMessage(res.message || 'Review posted successfully.');
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => {
        navigation.goBack();
      }, 1200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to submit review.';
      Alert.alert('Review failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
              <Ionicons name="arrow-back" size={24} color={TEXT} />
            </Pressable>
            <Text style={styles.screenTitle} numberOfLines={1}>
              Rate Your Feast
            </Text>
            <Text style={styles.brandMark}>MEXICANO</Text>
          </View>

          <Text style={styles.sectionHeading}>How was the experience?</Text>
          <View style={styles.experienceCard}>
            <View style={styles.experienceRow}>
              <Text style={styles.experienceLabel}>{labels[0]}</Text>
              <StarPicker
                value={experienceRatings.a}
                onChange={(n) => setExperienceRatings((prev) => ({ ...prev, a: n }))}
              />
            </View>
            <View style={styles.experienceRow}>
              <Text style={styles.experienceLabel}>{labels[1]}</Text>
              <StarPicker
                value={experienceRatings.b}
                onChange={(n) => setExperienceRatings((prev) => ({ ...prev, b: n }))}
              />
            </View>
            <View style={styles.experienceRow}>
              <Text style={styles.experienceLabel}>{labels[2]}</Text>
              <StarPicker
                value={experienceRatings.c}
                onChange={(n) => setExperienceRatings((prev) => ({ ...prev, c: n }))}
              />
            </View>
          </View>

          <View style={styles.rateDishHeader}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={20} color={GOLD} />
            <Text style={styles.rateDishTitle}>Rate Your Dishes</Text>
          </View>

          <View style={styles.dishCard}>
            <View style={styles.dishTopRow}>
              <View style={styles.dishThumbWrap}>
                <Image
                  source={{ uri: 'https://placehold.co/80x80/png' }}
                  style={styles.dishThumb}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.dishContent}>
                <Text style={styles.dishName} numberOfLines={1}>{titleLine}</Text>
                <StarPicker value={dishRating} onChange={setDishRating} size={30} gap={7} />
              </View>
            </View>

            <View style={styles.tagRow}>
              {tags.map((tag) => {
                const active = tagSelected === tag;
                return (
                  <Pressable
                    key={tag}
                    onPress={() => setTagSelected(active ? null : tag)}
                    style={[styles.tagChip, active && styles.tagChipActive]}
                  >
                    <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.commentWrap}>
            <Text style={styles.commentLabel}>Comment (optional)</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Share your experience..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              multiline
              textAlignVertical="top"
              style={[styles.commentInput, { height: commentInputHeight }]}
              onContentSizeChange={(e) => {
                const next = Math.max(92, Math.min(180, Math.ceil(e.nativeEvent.contentSize.height) + 20));
                setCommentInputHeight(next);
              }}
            />
          </View>

          <Pressable
            style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={BG} />
            ) : (
              <Text style={styles.submitBtnText}>Submit review</Text>
            )}
          </Pressable>

          {toastMessage ? (
            <View style={styles.toast}>
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 8,
    paddingBottom: 30,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    marginBottom: 10,
  },
  screenTitle: {
    flex: 1,
    marginLeft: 14,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
  },
  brandMark: {
    fontSize: 14,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 0.5,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 10,
  },
  experienceCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 18,
  },
  experienceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  experienceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT,
  },
  rateDishHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  rateDishTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
  },
  dishCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 22,
  },
  dishTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  dishThumbWrap: {
    width: 54,
    height: 54,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: CARD_MUTED,
    marginRight: 12,
  },
  dishThumb: {
    width: '100%',
    height: '100%',
  },
  dishContent: {
    flex: 1,
    gap: 8,
  },
  dishName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagChip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  tagChipActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT,
  },
  tagTextActive: {
    color: BG,
  },
  commentWrap: {
    marginTop: -2,
    marginBottom: 12,
  },
  commentLabel: {
    color: TEXT,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  commentInput: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    color: TEXT,
    fontSize: 14,
    lineHeight: 20,
  },
  submitBtn: {
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: GOLD,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitBtnDisabled: {
    opacity: 0.55,
  },
  submitBtnText: {
    color: BG,
    fontSize: 15,
    fontWeight: '800',
  },
  toast: {
    marginTop: 10,
    backgroundColor: 'rgba(34,197,94,0.95)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
