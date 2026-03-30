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
import * as ImagePicker from 'expo-image-picker';
import { submitReview } from '../../api/review';
import { getMenuItems, type MenuItem } from '../../api/discoverScreen';
import { parseOrderItemLines } from '../../utils/orderItemsSummary';

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

function baseProductNameFromOrderLine(title: string): string {
  const t = title.trim();
  const idx = t.indexOf(' (');
  if (idx === -1) return t;
  return t.slice(0, idx).trim();
}

function resolveMenuImageUri(menuItems: MenuItem[], lineTitle: string): string {
  const full = lineTitle.trim().toLowerCase();
  const base = baseProductNameFromOrderLine(lineTitle).trim().toLowerCase();
  for (const m of menuItems) {
    const n = String(m.name ?? '').trim().toLowerCase();
    if (n === full || n === base) {
      const raw = m.image;
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
      if (raw && typeof raw === 'object' && 'uri' in raw && typeof (raw as { uri?: unknown }).uri === 'string') {
        return String((raw as { uri: string }).uri).trim();
      }
    }
  }
  return '';
}

function aggregateDishRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;
  const avg = ratings.reduce((s, r) => s + r, 0) / ratings.length;
  return Math.max(1, Math.min(5, Math.round(avg)));
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

  const [lineRatings, setLineRatings] = useState<number[]>([]);
  /** Per dish line: multiple tag labels can be selected */
  const [lineTags, setLineTags] = useState<string[][]>([]);
  const [lineComments, setLineComments] = useState<string[]>([]);
  const [lineCommentVisible, setLineCommentVisible] = useState<boolean[]>([]);
  const [linePhotoDataUrls, setLinePhotoDataUrls] = useState<string[][]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [menuCatalog, setMenuCatalog] = useState<MenuItem[]>([]);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [experienceRatings, setExperienceRatings] = useState<Record<string, number>>({
    a: 0,
    b: 0,
    c: 0,
  });

  useEffect(() => {
    setExperienceRatings({ a: 0, b: 0, c: 0 });
  }, [mode]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const parsedLines = useMemo(() => parseOrderItemLines(items || ''), [items]);

  const lineImageUris = useMemo(
    () => parsedLines.map((line) => resolveMenuImageUri(menuCatalog, line.title)),
    [parsedLines, menuCatalog]
  );

  const reviewOrderType = useMemo<'Delivery' | 'Pickup' | 'Dine In'>(() => {
    if (mode === 'delivery') return 'Delivery';
    if (mode === 'dining') return 'Dine In';
    return 'Pickup';
  }, [mode]);

  useEffect(() => {
    const n = parsedLines.length;
    setLineRatings(Array.from({ length: n }, () => 0));
    setLineTags(Array.from({ length: n }, () => []));
    setLineComments(Array.from({ length: n }, () => ''));
    setLineCommentVisible(Array.from({ length: n }, () => false));
    setLinePhotoDataUrls(Array.from({ length: n }, () => []));
  }, [items]);

  const allDishLinesRated =
    parsedLines.length > 0 &&
    lineRatings.length === parsedLines.length &&
    parsedLines.every((_, i) => (lineRatings[i] ?? 0) > 0);

  const canSubmit =
    allDishLinesRated &&
    experienceRatings.a > 0 &&
    experienceRatings.b > 0 &&
    experienceRatings.c > 0 &&
    !!orderId?.trim();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await getMenuItems();
        if (!cancelled) setMenuCatalog(list);
      } catch {
        if (!cancelled) setMenuCatalog([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const dishRating = aggregateDishRating(lineRatings);
      const allSelectedTags = Array.from(new Set(lineTags.flat().filter(Boolean)));
      const dishTag = allSelectedTags.length > 0 ? allSelectedTags.join(', ') : undefined;
      const commentParts = parsedLines
        .map((line, idx) => {
          const c = String(lineComments[idx] ?? '').trim();
          if (!c) return null;
          return `${baseProductNameFromOrderLine(line.title)}: ${c}`;
        })
        .filter(Boolean);
      const reviewComment = commentParts.join('\n').trim() || undefined;
      const photoUrls = linePhotoDataUrls.flat().filter(Boolean);
      const res = await submitReview({
        orderId: String(orderId),
        orderType: reviewOrderType,
        dishRating,
        dishTag,
        comment: reviewComment,
        photoUrls: photoUrls.length ? photoUrls : undefined,
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

  const uriToDataUrl = async (uri: string): Promise<string> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      return await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(String(reader.result ?? uri));
        reader.onerror = () => reject(new Error('Failed to convert image'));
        reader.readAsDataURL(blob);
      });
    } catch {
      return uri;
    }
  };

  const toggleLineCommentVisible = (idx: number) => {
    setLineCommentVisible((prev) => {
      const next = [...prev];
      next[idx] = !Boolean(next[idx]);
      return next;
    });
  };

  const handlePickLineImage = async (idx: number) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access to upload images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.7,
        selectionLimit: 1,
      } as any);

      if (result.canceled) return;

      const asset = result.assets?.[0];
      const uri = asset?.uri;
      if (!uri) return;

      const dataUrl = await uriToDataUrl(uri);
      setLinePhotoDataUrls((prev) => {
        const next = [...prev];
        const existing = next[idx] ?? [];
        next[idx] = [...existing, dataUrl];
        return next;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to pick image.';
      Alert.alert('Image error', msg);
    }
  };

  const removeLinePhoto = (lineIdx: number, photoIdx: number) => {
    setLinePhotoDataUrls((prev) => {
      const next = [...prev];
      const list = [...(next[lineIdx] ?? [])];
      list.splice(photoIdx, 1);
      next[lineIdx] = list;
      return next;
    });
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

        {parsedLines.length === 0 ? (
          <Text style={styles.dishEmptyHint}>No order items to rate.</Text>
        ) : null}

        {parsedLines.map((line, idx) => {
          const uri = lineImageUris[idx] || '';
          const rating = lineRatings[idx] ?? 0;
          const selectedForLine = lineTags[idx] ?? [];
          return (
            <View
              key={`dish-${idx}-${String(line.title).slice(0, 32)}`}
              style={[
                styles.dishCard,
                idx < parsedLines.length - 1 ? styles.dishCardSpaced : styles.dishCardLast,
              ]}
            >
              <View style={styles.dishTopRow}>
                <View style={styles.dishThumbWrap}>
                  {uri ? (
                    <Image source={{ uri }} style={styles.dishThumb} resizeMode="cover" />
                  ) : (
                    <View style={styles.dishThumbFallback}>
                      <Ionicons name="image-outline" size={20} color={MUTED} />
                    </View>
                  )}
                </View>
                <View style={styles.dishContent}>
                  <Text style={styles.dishName} numberOfLines={2}>
                    {baseProductNameFromOrderLine(line.title)}
                    <Text style={styles.dishQtyText}>
                      {' '}
                      ×{line.quantity}
                    </Text>
                  </Text>
                  <StarPicker
                    value={rating}
                    onChange={(n) =>
                      setLineRatings((prev) => {
                        const next = [...prev];
                        next[idx] = n;
                        return next;
                      })
                    }
                    size={28}
                    gap={6}
                  />
                </View>
              </View>

              <View style={styles.tagRow}>
                {tags.map((tag) => {
                  const active = selectedForLine.includes(tag);
                  return (
                    <Pressable
                      key={`${idx}-${tag}`}
                      onPress={() =>
                        setLineTags((prev) => {
                          const next = [...prev];
                          const row = [...(next[idx] ?? [])];
                          const pos = row.indexOf(tag);
                          if (pos >= 0) row.splice(pos, 1);
                          else row.push(tag);
                          next[idx] = row;
                          return next;
                        })
                      }
                      style={[styles.tagChip, active && styles.tagChipActive]}
                    >
                      <Text style={[styles.tagText, active && styles.tagTextActive]}>{tag}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.lineOptionalArea}>
                <Pressable
                  onPress={() => toggleLineCommentVisible(idx)}
                  style={({ pressed }) => [styles.lineActionBtn, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.lineActionText}>Add comment</Text>
                  <Ionicons
                    name={lineCommentVisible[idx] ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={GOLD}
                    style={{ marginLeft: 'auto' }}
                  />
                </Pressable>

                {lineCommentVisible[idx] ? (
                  <TextInput
                    value={lineComments[idx] ?? ''}
                    onChangeText={(v) =>
                      setLineComments((prev) => {
                        const next = [...prev];
                        next[idx] = v;
                        return next;
                      })
                    }
                    placeholder="Share your experience..."
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    multiline
                    textAlignVertical="top"
                    style={[styles.commentInput, { height: 92 }]}
                  />
                ) : null}

                <Pressable
                  onPress={() => void handlePickLineImage(idx)}
                  style={({ pressed }) => [styles.lineActionBtn, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="image-outline" size={18} color={GOLD} />
                  <Text style={styles.lineActionText}>
                    {linePhotoDataUrls[idx]?.length ? 'Add another image' : 'Add image'}
                  </Text>
                </Pressable>

                {linePhotoDataUrls[idx]?.length ? (
                  <View style={styles.photoGrid}>
                    {linePhotoDataUrls[idx].map((p, pIdx) => (
                      <View key={`photo-${idx}-${pIdx}`} style={styles.photoThumbWrap}>
                        <Image source={{ uri: p }} style={styles.photoThumb} />
                        <Pressable
                          hitSlop={8}
                          onPress={() => removeLinePhoto(idx, pIdx)}
                          style={styles.photoRemoveBtn}
                        >
                          <Ionicons name="close" size={16} color={BG} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

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
  dishEmptyHint: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 16,
  },
  dishCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginBottom: 0,
  },
  dishCardSpaced: {
    marginBottom: 14,
  },
  dishCardLast: {
    marginBottom: 22,
  },
  dishTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  dishThumbFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_MUTED,
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
  dishQtyText: {
    fontWeight: '800',
    color: GOLD,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  lineOptionalArea: {
    marginTop: 10,
  },
  lineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.25)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  lineActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: GOLD,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 2,
  },
  photoThumb: {
    width: 68,
    height: 68,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  photoThumbWrap: {
    position: 'relative',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
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
