import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';
import { getToken } from '../../storagetank';
import { getWishlist, removeFromWishlist } from '../../api/wishlist';
import { WishlistScreenSkeleton } from '../../components/skeleton';
import { getProductReviewsSummary } from '../../api/review';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 16;

type WishlistProductLike = {
  productId?: number;
  id?: number | string;
  name?: string;
  title?: string;
  price?: string;
  image?: string | { uri: string } | null;
  [key: string]: unknown;
};

function normalizeWishlistProduct(item: WishlistProductLike) {
  const anyItem = item as any;
  const productId =
    item.productId ??
    anyItem.product_id ??
    anyItem.productID ??
    item.id ??
    anyItem.id;
  const id = productId != null ? String(productId) : '';
  const name = item.name ?? item.title ?? anyItem.productName ?? anyItem.product_name ?? 'Item';
  const price =
    item.price != null
      ? String(item.price)
      : anyItem.productPrice != null
        ? String(anyItem.productPrice)
        : anyItem.product_price != null
          ? String(anyItem.product_price)
          : '';

  const img = item.image ?? anyItem.image_url ?? anyItem.imageUrl ?? anyItem.productImage ?? anyItem.product_image;
  const image =
    typeof img === 'string' && img.trim()
      ? { uri: img.trim() }
      : img && typeof img === 'object' && (img as { uri?: string }).uri
        ? { uri: String((img as { uri: string }).uri) }
        : null;

  return { id, name, price, image };
}

function formatPrice(price: string): string {
  if (price == null) return '$0.00';
  const p = String(price).trim();
  if (!p) return '$0.00';
  return p.startsWith('$') ? p : `$${p}`;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatReviewCountCompact(count: number): string {
  return String(Math.max(0, Math.round(count)));
}

function clampRating0to5(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function getStarIconNames(avg: number): Array<React.ComponentProps<typeof MaterialIcons>['name']> {
  const a = clampRating0to5(avg);
  const rounded = Math.round(a * 2) / 2;
  const full = Math.floor(rounded);
  const half = rounded - full >= 0.5 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
  return [
    ...Array.from({ length: full }, () => 'star' as const),
    ...Array.from({ length: half }, () => 'star-half' as const),
    ...Array.from({ length: empty }, () => 'star-border' as const),
  ];
}

export default function WishlistScreen() {
  const navigation = useNavigation<any>();
  const [wishlistItems, setWishlistItems] = useState<WishlistProductLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [ratingById, setRatingById] = useState<Record<string, { avg: number; count: number }>>({});

  const loadWishlist = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getToken();
      if (!token) {
        navigateToLoginRegister();
        setWishlistItems([]);
        return;
      }
      const data = await getWishlist();
      const maybe = data as any;
      const items =
        Array.isArray(maybe) ? maybe :
        Array.isArray(maybe?.items) ? maybe.items :
        Array.isArray(maybe?.data) ? maybe.data :
        Array.isArray(maybe?.data?.items) ? maybe.data.items :
        [];
      setWishlistItems(items);
    } catch {
      setError('Failed to load wishlist.');
      setWishlistItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadWishlist();
    }, [loadWishlist])
  );

  const normalized = useMemo(
    () => wishlistItems.map(normalizeWishlistProduct).filter((x) => x.id),
    [wishlistItems]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = normalized.map((p) => String(p.id).trim()).filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) setRatingById({});
          return;
        }
        const summary = await getProductReviewsSummary(ids);
        if (cancelled) return;
        const next: Record<string, { avg: number; count: number }> = {};
        Object.entries(summary.items || {}).forEach(([id, row]) => {
          const count = parseOptionalNumber((row as { count?: unknown }).count) ?? 0;
          const avg = parseOptionalNumber((row as { averageOverall?: unknown }).averageOverall) ?? 0;
          if (count > 0 && avg > 0) next[String(id).trim()] = { avg, count };
        });
        setRatingById(next);
      } catch {
        if (!cancelled) setRatingById({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [normalized]);

  const handleRemove = useCallback(
    async (productIdStr: string) => {
      try {
        setRemovingIds((prev) => new Set([...prev, productIdStr]));
        const productIdNum = Number(productIdStr);
        if (!Number.isFinite(productIdNum)) return;

        await removeFromWishlist(productIdNum);
        await loadWishlist();
      } catch {
        // ignore
      } finally {
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(productIdStr);
          return next;
        });
      }
    },
    [loadWishlist]
  );

  const renderItem = ({ item }: { item: ReturnType<typeof normalizeWishlistProduct> }) => {
    const isRemoving = removingIds.has(item.id);
    const stat = ratingById[String(item.id).trim()];
    const ratingText =
      stat && stat.avg > 0 ? `${stat.avg.toFixed(1)} (${formatReviewCountCompact(stat.count)})` : '';
    return (
      <Pressable
        style={styles.productGridCard}
        disabled={isRemoving}
        onPress={() => {}}
      >
        <View style={styles.productGridTopRow}>
          {stat && stat.avg > 0 ? (
            <View style={styles.productGridTopLeftRow}>
              <View style={styles.productGridStarsRow}>
                {getStarIconNames(stat.avg).map((name, i) => (
                  <MaterialIcons key={`${item.id}-star-${i}-${name}`} name={name} size={16} color={GOLD} />
                ))}
              </View>
              {ratingText ? (
                <Text style={styles.productGridRating} numberOfLines={1}>
                  {ratingText}
                </Text>
              ) : null}
            </View>
          ) : (
            <View />
          )}
        </View>

        <View style={styles.productGridImageCircle}>
          {item.image ? (
            <Image source={item.image} style={styles.productGridImageCircleImg} resizeMode="cover" />
          ) : (
            <View style={styles.productGridImageCircleSkeleton}>
              <MaterialIcons name="image-not-supported" size={22} color="rgba(255,255,255,0.35)" />
            </View>
          )}
        </View>

        <Text style={styles.productGridName} numberOfLines={1}>
          {item.name}
        </Text>

        <View style={styles.productGridBottomRow}>
          <Text style={styles.productGridPrice}>{formatPrice(item.price)}</Text>
          <Pressable
            style={styles.productGridHeartBtn}
            hitSlop={8}
            disabled={isRemoving}
            onPress={(e) => {
              e.stopPropagation?.();
              void handleRemove(item.id);
            }}
            accessibilityLabel="Remove from wishlist"
          >
            <MaterialIcons name="favorite" size={16} color={BG_DARK} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={BG_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        {loading ? (
          <WishlistScreenSkeleton itemCount={wishlistItems.length} />
        ) : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{error}</Text>
            <Text style={styles.emptySubtitle}>Please try again.</Text>
          </View>
        ) : normalized.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="heart-outline" size={38} color={GOLD} />
            <Text style={styles.emptyTitle}>No wishlist items</Text>
            <Text style={styles.emptySubtitle}>Save products using the heart icon.</Text>
          </View>
        ) : (
          <FlatList
            data={normalized}
            keyExtractor={(it) => it.id}
            numColumns={2}
            columnWrapperStyle={styles.gridColumnWrapper}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gridContent}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 6,
  },
  backBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 32,
  },
  content: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_WHITE,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: MUTED_TEXT,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  gridColumnWrapper: {
    justifyContent: 'space-between',
    gap: 0,
  },
  gridContent: {
    paddingBottom: 24,
  },
  productGridCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    height: 248,
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
  productGridStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  productGridRating: {
    fontSize: 11,
    fontWeight: '700',
    color: TEXT_WHITE,
    opacity: 0.85,
  },
  productGridImageCircle: {
    width: 126,
    height: 126,
    borderRadius: 63,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
    overflow: 'hidden',
  },
  productGridImageCircleImg: {
    width: '100%',
    height: '100%',
  },
  productGridImageCircleSkeleton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  productGridName: {
    width: '100%',
    textAlign: 'left',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 6,
  },
  productGridBottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  productGridPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: GOLD,
    lineHeight: 18,
  },
  productGridHeartBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

