import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { ItemDetailParamItem } from './ItemDetailScreen';
import { getMenuItems, getCachedMenuItems, type MenuItem as ApiMenuItem } from '../../api/Menu';
import { getNetworkErrorMessage } from '../../api/apiConfig';
import { MenuScreenSkeleton } from '../../components/skeleton/MenuScreenSkeleton';
import { addToWishlist } from '../../api/wishlist';
import { getProductReviewsSummary } from '../../api/review';
import { getToken } from '../../storagetank';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';
import { useCart } from '../../contexts/CartContext';

type Nav = { navigate: (name: string) => void; getParent: () => { navigate: (name: string, params: object) => void } | null };

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const SEARCH_BG = '#1F403C';
const GOLD = '#FECB4D';
const GOLD_MUTED = '#E5B948';
const TEXT_WHITE = '#FFFFFF';

const HORIZONTAL_PADDING = 20;
const TOAST_DURATION = 2400;

function formatPrice(price: string): string {
  if (price == null || String(price).trim() === '') return '$0.00';
  const p = String(price).trim();
  return p.startsWith('$') ? p : `$${p}`;
}

/** Raw addon from items API (linked to menu item). */
type MenuAddonRaw = { id: string; name?: string; price?: string; [key: string]: unknown };

export interface MenuProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  rating?: string;
  ratingValue?: number | null;
  reviewsCount?: number | null;
  time: string;
  /** API image URL when present; null = no image → show skeleton */
  image: { uri: string } | null;
  /** Cooking time from API (e.g. "10-15 mins") */
  cookingTime?: string;
  /** Linked add-ons from the items API */
  addons?: MenuAddonRaw[];
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

interface ProductCardProps {
  item: MenuProduct;
  onPress: (item: MenuProduct) => void;
  onWishlistPress: (item: MenuProduct) => void;
  onQuickAdd: (item: MenuProduct) => void;
  wishlistUpdating: boolean;
}

function parseOptionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatReviewCountCompact(count: number): string {
  return String(Math.max(0, Math.round(count)));
}

function getDisplayRating(item: MenuProduct): string {
  const ratingValue = parseOptionalNumber(item.ratingValue);
  const reviewsCount = parseOptionalNumber(item.reviewsCount);
  if (ratingValue != null && ratingValue > 0) {
    return `${ratingValue.toFixed(1)} (${formatReviewCountCompact(reviewsCount ?? 0)})`;
  }
  return '';
}

function clampRating0to5(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

function getStarIconNames(avg: number): Array<React.ComponentProps<typeof Ionicons>['name']> {
  const a = clampRating0to5(avg);
  const rounded = Math.round(a * 2) / 2;
  const full = Math.floor(rounded);
  const half = rounded - full >= 0.5 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
  return [
    ...Array.from({ length: full }, () => 'star' as const),
    ...Array.from({ length: half }, () => 'star-half' as const),
    ...Array.from({ length: empty }, () => 'star-outline' as const),
  ];
}

function getStarIconNamesForItem(item: MenuProduct): Array<React.ComponentProps<typeof Ionicons>['name']> {
  const avg = parseOptionalNumber(item.ratingValue);
  if (avg == null || avg <= 0) {
    return Array.from({ length: 5 }, () => 'star-outline' as const);
  }
  return getStarIconNames(avg);
}

const ProductCard = memo(function ProductCard({
  item,
  onPress,
  onWishlistPress,
  onQuickAdd,
  wishlistUpdating,
}: ProductCardProps) {
  return (
    <Pressable
      style={styles.productCard}
      onPress={() => onPress(item)}
    >
      <Pressable
        style={styles.wishBtn}
        onPress={(e) => {
          e.stopPropagation();
          onWishlistPress(item);
        }}
        hitSlop={8}
        accessibilityLabel="Add to wishlist"
        disabled={wishlistUpdating}
      >
        <Ionicons name="heart-outline" size={17} color={BG_DARK} />
      </Pressable>

      <Pressable
        style={styles.addBtn}
        onPress={(e) => {
          e.stopPropagation();
          onQuickAdd(item);
        }}
        hitSlop={8}
        accessibilityLabel="Quick add to cart"
      >
        <MaterialIcons name="add" size={16} color={BG_DARK} />
      </Pressable>

      <View style={styles.productImageWrap}>
        {item.image ? (
          <Image
            source={item.image}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.productImageSkeleton}>
            <MaterialIcons name="image-not-supported" size={40} color="rgba(255,255,255,0.35)" />
          </View>
        )}
      </View>
      <View style={styles.productInfo}>
        <View style={styles.productTopRow}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
        </View>
        <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.productMetaRow}>
          <View style={styles.metaItem}>
            <View style={styles.metaStarsRow}>
              {getStarIconNamesForItem(item).map((name, i) => (
                <Ionicons key={`${item.id}-star-${i}-${name}`} name={name} size={13} color="#F8AC01" />
              ))}
            </View>
            {getDisplayRating(item) ? (
              <Text style={styles.metaText} numberOfLines={1}>{getDisplayRating(item)}</Text>
            ) : null}
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="access-time" size={14} color={GOLD} />
            <Text style={styles.metaText} numberOfLines={1}>{item.time}</Text>
          </View>
          <View style={styles.metaSpacer} />
        </View>
      </View>
    </Pressable>
  );
});

/** Resolve cooking time from API (cookingTime, cooking_time, prepTime, preparationTime, time); format number as "X min". */
function getCookingTime(item: ApiMenuItem & { cookingTime?: string | number; cooking_time?: string | number; prepTime?: string | number; preparationTime?: string | number }): string {
  const raw =
    item.cookingTime ??
    item.cooking_time ??
    item.prepTime ??
    item.preparationTime ??
    item.time;
  if (raw == null || raw === '') return '20-30min';
  if (typeof raw === 'number') return `${raw} min`;
  return String(raw).trim() || '20-30min';
}

function mapApiItemToMenuProduct(item: ApiMenuItem & { addons?: unknown[] }): MenuProduct {
  const raw = item.image;
  const image =
    raw && typeof raw === 'string' && raw.trim().length > 0
      ? { uri: raw.trim() }
      : raw && typeof raw === 'object' && raw.uri && String(raw.uri).trim().length > 0
        ? { uri: String(raw.uri).trim() }
        : null;
  const addons = Array.isArray(item.addons) ? (item.addons as MenuAddonRaw[]) : undefined;
  const cookingTimeStr = getCookingTime(item);
  return {
    id: String(item.id),
    name: String(item.name ?? ''),
    description: item.description != null ? String(item.description) : 'Delicious Mexican-style dish.',
    price: item.price != null ? String(item.price) : '',
    rating: item.rating != null ? String(item.rating) : undefined,
    time: cookingTimeStr,
    cookingTime: cookingTimeStr,
    image,
    addons,
  };
}

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [menuProducts, setMenuProducts] = useState<MenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<Nav>();
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const [ratingById, setRatingById] = useState<Record<string, { avg: number; count: number }>>({});

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(TOAST_DURATION - 400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toast, toastOpacity]);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  }, []);

  const handleItemPress = useCallback((item: MenuProduct) => {
    navigation.getParent()?.navigate('ItemDetail', { item: item as unknown as ItemDetailParamItem });
  }, [navigation]);

  const handleAddToWishlist = useCallback(
    async (item: MenuProduct) => {
      const idStr = String(item.id);
      const productIdNum = Number(item.id);
      if (!Number.isFinite(productIdNum)) {
        showToast('Invalid product id', 'error');
        return;
      }

      const token = await getToken();
      if (!token) {
        showToast('Please login to use wishlist', 'error');
        navigateToLoginRegister();
        return;
      }

      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.add(idStr);
        return next;
      });

      try {
        await addToWishlist(productIdNum);
        showToast('Added to wishlist', 'success');
      } catch (e) {
        const msg = getNetworkErrorMessage(e);
        if (/already|exists|duplicate/i.test(msg)) {
          showToast('Already in wishlist', 'error');
        } else {
          showToast(msg, 'error');
        }
      } finally {
        setUpdatingIds((prev) => {
          const next = new Set(prev);
          next.delete(idStr);
          return next;
        });
      }
    },
    [showToast]
  );

  const handleQuickAddToCart = useCallback(
    (item: MenuProduct) => {
      addItem({
        productId: String(item.id),
        name: item.name,
        price: item.price,
        image: item.image,
        addons: [],
        quantity: 1,
      });
      showToast('Added to cart', 'success');
    },
    [addItem, showToast]
  );

  useEffect(() => {
    const cached = getCachedMenuItems();
    if (cached && cached.length > 0) {
      setMenuProducts(cached.map(mapApiItemToMenuProduct));
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }
    let cancelled = false;
    (async () => {
      try {
        const items = await getMenuItems();
        if (cancelled) return;
        setMenuProducts(items.map(mapApiItemToMenuProduct));
      } catch (e) {
        if (!cancelled) {
          setError(getNetworkErrorMessage(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = menuProducts.map((p) => String(p.id).trim()).filter(Boolean);
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
  }, [menuProducts]);

  const filteredProducts = useMemo(() => {
    const base = menuProducts.map((p) => {
      const stat = ratingById[String(p.id).trim()];
      return stat
        ? { ...p, ratingValue: stat.avg, reviewsCount: stat.count }
        : { ...p, ratingValue: null, reviewsCount: null };
    });
    const q = normalizeSearchText(searchQuery);
    if (!q) return base;
    return base.filter(
      (p) =>
        normalizeSearchText(p.name).includes(q) ||
        normalizeSearchText(p.description).includes(q)
    );
  }, [menuProducts, searchQuery, ratingById]);

  const renderProductItem = useCallback(
    ({ item }: { item: MenuProduct }) => {
      const isUpdating = updatingIds.has(String(item.id));
      return (
        <ProductCard
          item={item}
          onPress={handleItemPress}
          onWishlistPress={handleAddToWishlist}
          onQuickAdd={handleQuickAddToCart}
          wishlistUpdating={isUpdating}
        />
      );
    },
    [handleAddToWishlist, handleItemPress, handleQuickAddToCart, updatingIds]
  );

  const keyExtractor = useCallback((item: MenuProduct) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header: compact, search only (same look as DiscoverScreen) */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={22} color={GOLD} style={styles.searchIcon} />
          <TextInput
            placeholder="Search at Mexicano..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Product List */}
      <FlatList
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        data={!loading && !error ? filteredProducts : []}
        keyExtractor={keyExtractor}
        renderItem={renderProductItem}
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <>
        {error ? (
          <View style={styles.apiError}>
            <Text style={styles.apiErrorText}>{error}</Text>
          </View>
        ) : null}
        {loading ? (
          <MenuScreenSkeleton />
        ) : null}
        {!loading && !error && filteredProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              {searchQuery.trim() ? 'No results found' : 'No menu items yet'}
            </Text>
          </View>
        ) : null}
          </>
        )}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
      />

      {/* Wishlist toast */}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            { bottom: insets.bottom + 90 },
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
            {
              opacity: toastOpacity,
            },
          ]}
        >
          <Text style={styles.toastText} numberOfLines={2}>{toast.message}</Text>
        </Animated.View>
      ) : null}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  header: {
    backgroundColor: BG_DARK,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: HORIZONTAL_PADDING,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SEARCH_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_WHITE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 24,
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  apiError: {
    padding: 24,
    alignItems: 'center',
  },
  apiErrorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  productCard: {
    marginBottom: 16,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
    position: 'relative',
  },
  addBtn: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 8,
  },
  wishBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 8,
  },
  productImageWrap: {
    width: '100%',
    height: 160,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImageSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 16,
  },
  productTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  productName: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginRight: 8,
  },
  productPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
  },
  productDesc: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  metaText: {
    fontSize: 10,
    color: TEXT_WHITE,
  },
  metaSpacer: {
    flex: 1,
  },
  bottomSpacer: {
    height: 96,
  },
  toast: {
    position: 'absolute',
    left: HORIZONTAL_PADDING,
    right: HORIZONTAL_PADDING,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignSelf: 'center',
    maxWidth: '100%',
    zIndex: 9999,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
  },
  toastError: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
