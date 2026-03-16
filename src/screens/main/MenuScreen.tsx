import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { ItemDetailParamItem } from './ItemDetailScreen';
import { getMenuItems, getCachedMenuItems, type MenuItem as ApiMenuItem } from '../../api/Menu';
import { MenuScreenSkeleton } from '../../components/skeleton/MenuScreenSkeleton';

type Nav = { navigate: (name: string) => void; getParent: () => { navigate: (name: string, params: object) => void } | null };

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const SEARCH_BG = '#1F403C';
const GOLD = '#FECB4D';
const GOLD_MUTED = '#E5B948';
const TEXT_WHITE = '#FFFFFF';

const HORIZONTAL_PADDING = 20;

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
  rating: string;
  time: string;
  /** API image URL when present; null = no image → show skeleton */
  image: { uri: string } | null;
  /** Cooking time from API (e.g. "10-15 mins") */
  cookingTime?: string;
  /** Linked add-ons from the items API */
  addons?: MenuAddonRaw[];
}

interface ProductCardProps {
  item: MenuProduct;
  onPress: (item: MenuProduct) => void;
}

const ProductCard = memo(function ProductCard({ item, onPress }: ProductCardProps) {
  return (
    <Pressable
      style={styles.productCard}
      onPress={() => onPress(item)}
    >
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
        <Pressable style={styles.heartButton}>
          <Ionicons name="heart" size={16} color={BG_DARK} />
        </Pressable>
      </View>
      <View style={styles.productInfo}>
        <View style={styles.productTopRow}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
        </View>
        <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.productMetaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={14} color="#F8AC01" />
            <Text style={styles.metaText} numberOfLines={1}>{item.rating}</Text>
          </View>
          <View style={styles.metaItem}>
            <MaterialIcons name="access-time" size={14} color={GOLD} />
            <Text style={styles.metaText} numberOfLines={1}>{item.time}</Text>
          </View>
          <View style={styles.metaSpacer} />
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+</Text>
          </Pressable>
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
    rating: item.rating != null ? String(item.rating) : '4.9 (10K+)',
    time: cookingTimeStr,
    cookingTime: cookingTimeStr,
    image,
    addons,
  };
}

export default function MenuScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [menuProducts, setMenuProducts] = useState<MenuProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<Nav>();

  const handleItemPress = useCallback((item: MenuProduct) => {
    navigation.getParent()?.navigate('ItemDetail', { item: item as unknown as ItemDetailParamItem });
  }, [navigation]);

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
          setError(e instanceof Error ? e.message : 'Failed to load menu');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const deferredSearch = useDeferredValue(searchQuery);

  const filteredProducts = useMemo(() => {
    if (!deferredSearch.trim()) return menuProducts;
    const q = deferredSearch.toLowerCase().trim();
    return menuProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [menuProducts, deferredSearch]);

  const renderProductItem = useCallback(
    ({ item }: { item: MenuProduct }) => <ProductCard item={item} onPress={handleItemPress} />,
    [handleItemPress]
  );

  const keyExtractor = useCallback((item: MenuProduct) => item.id, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
  heartButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
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
  metaText: {
    fontSize: 10,
    color: TEXT_WHITE,
  },
  metaSpacer: {
    flex: 1,
  },
  addButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GOLD_MUTED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  bottomSpacer: {
    height: 96,
  },
});
