import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';
import { getToken } from '../../storagetank';
import { getWishlist, removeFromWishlist } from '../../api/wishlist';
import { WishlistScreenSkeleton } from '../../components/skeleton';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

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

export default function WishlistScreen() {
  const navigation = useNavigation<any>();
  const [wishlistItems, setWishlistItems] = useState<WishlistProductLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

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
    return (
      <Pressable
        style={styles.wishlistCard}
        disabled={isRemoving}
        onPress={() => {}}
      >
        <View style={styles.wishlistCardTopRow}>
          <View style={styles.imageCircle}>
            {item.image ? (
              <Image
                source={item.image}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="image-outline" size={18} color="rgba(255,255,255,0.35)" />
            )}
          </View>
          <Pressable
            style={styles.removeHeartBtn}
            hitSlop={6}
            onPress={(e) => {
              e.stopPropagation?.();
              void handleRemove(item.id);
            }}
          >
            <MaterialIcons name="favorite" size={16} color={BG_DARK} />
          </Pressable>
        </View>

        <Text style={styles.wishlistName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.wishlistPrice}>{formatPrice(item.price)}</Text>
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
    gap: 12,
  },
  gridContent: {
    paddingBottom: 24,
  },
  wishlistCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
    padding: 12,
    marginBottom: 12,
  },
  wishlistCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  imageCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  removeHeartBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistName: {
    color: TEXT_WHITE,
    fontSize: 14,
    fontWeight: '800',
  },
  wishlistPrice: {
    marginTop: 4,
    color: GOLD,
    fontSize: 14,
    fontWeight: '800',
  },
});

