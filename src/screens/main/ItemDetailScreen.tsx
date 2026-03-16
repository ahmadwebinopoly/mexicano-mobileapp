import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { AddonItem } from '../../api/itemDetail';
import { useCart } from '../../contexts/CartContext';
import { ItemDetailScreenSkeleton, SkeletonBox } from '../../components/skeleton';

type ItemDetailNavigationProp = NativeStackNavigationProp<RootStackParamList, 'ItemDetail'>;

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const SEARCH_BG = '#1F403C';
const GOLD = '#FECB4D';
const GOLD_MUTED = '#E5B948';
const TEXT_WHITE = '#FFFFFF';

const HORIZONTAL_PADDING = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ADDON_CARD_WIDTH = (SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - 12) / 2;

/** Raw addon from items API (e.g. { id, name, price }). */
export type ItemDetailAddonRaw = {
  id: string;
  name?: string;
  price?: string;
  image?: string | { uri: string };
  [key: string]: unknown;
};

export type ItemDetailParamItem = {
  id: string;
  name: string;
  description: string;
  price: string;
  image: { uri: string } | null;
  rating?: string;
  /** Cooking/prep time from API (e.g. "10-15 mins"). */
  cookingTime?: string;
  time?: string;
  /** Linked add-ons from the items API (only these are shown). */
  addons?: ItemDetailAddonRaw[];
};

function formatPrice(price: string): string {
  if (price == null || String(price).trim() === '') return '$0.00';
  const p = String(price).trim();
  return p.startsWith('$') ? p : `$${p}`;
}

/** Normalize raw addon from items API to AddonItem for display. */
function normalizeAddonFromItem(raw: ItemDetailAddonRaw): AddonItem {
  const id = raw.id != null ? String(raw.id) : '';
  const name = raw.name != null ? String(raw.name) : '';
  const price = raw.price != null ? String(raw.price) : '';
  const img = raw.image;
  const image =
    typeof img === 'string' && img.trim()
      ? img.trim()
      : img && typeof img === 'object' && (img as { uri?: string }).uri
        ? { uri: String((img as { uri: string }).uri) }
        : undefined;
  return { ...raw, id, name, price, image } as AddonItem;
}

type ItemDetailRoute = RouteProp<{ ItemDetail: { item: ItemDetailParamItem } }, 'ItemDetail'>;

export default function ItemDetailScreen() {
  const navigation = useNavigation<ItemDetailNavigationProp>();
  const route = useRoute<ItemDetailRoute>();
  const { addItem } = useCart();
  const item = route.params?.item;
  const addons: AddonItem[] = (item?.addons ?? []).map(normalizeAddonFromItem);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [addingToCart, setAddingToCart] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setShowSkeleton(false), 450);
    return () => clearTimeout(t);
  }, [item]);

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mainPrice = item?.price ? parseFloat(String(item.price).replace(/[$,]/g, '')) || 0 : 0;
  const addonsTotal = addons
    .filter((a) => selectedAddonIds.has(a.id))
    .reduce((sum, a) => sum + (parseFloat(String(a.price).replace(/[$,]/g, '')) || 0), 0);
  const total = mainPrice + addonsTotal;

  if (!item) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={['top', 'bottom', 'left', 'right']}>
        <Text style={styles.errorText}>No item data</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BG_DARK} />
        </Pressable>
      </SafeAreaView>
    );
  }

  if (showSkeleton) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.imageContainer}>
          <View style={styles.imageWrap}>
            <View style={styles.heroImageSkeleton} />
          </View>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={TEXT_WHITE} />
          </Pressable>
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ItemDetailScreenSkeleton skipImage />
        </ScrollView>
        <View style={styles.bottomBar}>
          <SkeletonBox width={80} height={28} borderRadius={14} style={{ opacity: 0.9 }} />
          <SkeletonBox width={140} height={48} borderRadius={14} pulse={false} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image container – contained with padding and radius */}
        <View style={styles.imageContainer}>
          <View style={styles.imageWrap}>
            {item.image ? (
              <Image source={item.image} style={styles.heroImage} resizeMode="cover" />
            ) : (
              <View style={styles.heroImageSkeleton}>
                <MaterialIcons name="image-not-supported" size={48} color="rgba(255,255,255,0.35)" />
              </View>
            )}
          </View>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={TEXT_WHITE} />
          </Pressable>
        </View>

        {/* Item details */}
        <View style={styles.detailSection}>
          <View style={styles.titleRow}>
            <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
          </View>
          <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="star" size={14} color="#F8AC01" />
              <Text style={styles.metaText}>{item.rating ?? '4.9 (10K+)'}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="access-time" size={14} color={GOLD} />
              <Text style={styles.metaText}>{item.cookingTime ?? item.time ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Choose add-ons */}
        <View style={styles.addonsSection}>
          <Text style={styles.addonsTitle}>Add-ons</Text>
          {addons.length === 0 ? (
            <Text style={styles.addonsEmpty}>No add-ons for this item</Text>
          ) : (
            <View style={styles.addonsGrid}>
              {addons.map((addon) => {
                const img = addon.image;
                const imageUri = typeof img === 'string' ? img : (img && (img as { uri?: string }).uri) ? (img as { uri: string }).uri : null;
                const isSelected = selectedAddonIds.has(addon.id);
                return (
                  <Pressable
                    key={addon.id}
                    onPress={() => toggleAddon(addon.id)}
                    style={[styles.addonCard, isSelected && styles.addonCardSelected]}
                  >
                    <View style={styles.addonImageWrap}>
                      {imageUri ? (
                        <Image source={{ uri: imageUri }} style={styles.addonImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.addonImageSkeleton}>
                          <MaterialIcons name="image-not-supported" size={22} color="rgba(255,255,255,0.35)" />
                        </View>
                      )}
                    </View>
                    <Text style={styles.addonName} numberOfLines={2}>{addon.name}</Text>
                    <Text style={styles.addonPrice}>{formatPrice(addon.price)}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Add to cart section – last of screen, within safe area */}
      <View style={styles.bottomBar}>
        <View style={styles.totalWrap}>
          <Text style={styles.totalPrice}>{formatPrice(String(total.toFixed(2)))}</Text>
        </View>
        <Pressable
          style={[styles.addToCartBtn, addingToCart && styles.addToCartBtnDisabled]}
          onPress={async () => {
            if (!item || addingToCart) return;
            setAddingToCart(true);
            const selectedAddonsList = addons
              .filter((a) => selectedAddonIds.has(a.id))
              .map((a) => ({ id: a.id, name: String(a.name ?? '').trim() || a.id, price: String(a.price ?? '') }));
            addItem({
              productId: item.id,
              name: item.name,
              price: item.price,
              image: item.image,
              addons: selectedAddonsList,
              quantity: 1,
            });
            await new Promise((r) => setTimeout(r, 500));
            navigation.navigate('Cart');
          }}
          disabled={addingToCart}
        >
          <Text style={styles.addToCartBtnText}>{addingToCart ? 'Adding…' : 'Add To Cart'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    color: TEXT_WHITE,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imageContainer: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 16,
    position: 'relative',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    maxHeight: 240,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroImageSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: HORIZONTAL_PADDING + 8,
    top: 24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  itemName: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginRight: 12,
  },
  itemPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 18,
    fontWeight: '700',
    color: GOLD,
  },
  itemDesc: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: TEXT_WHITE,
  },
  addonsSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 8,
  },
  addonsTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 12,
  },
  addonsEmpty: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    paddingVertical: 12,
  },
  addonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addonCard: {
    width: ADDON_CARD_WIDTH,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  addonCardSelected: {
    borderColor: GOLD,
    backgroundColor: 'rgba(254, 203, 77, 0.08)',
  },
  addonImageWrap: {
    width: 56,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  addonImage: {
    width: '100%',
    height: '100%',
  },
  addonImageSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addonName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 4,
    textAlign: 'center',
  },
  addonPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  bottomSpacer: {
    height: 24,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: BG_DARK,
    borderTopWidth: 1,
    borderTopColor: 'rgba(229,185,72,0.2)',
  },
  totalWrap: {
    flex: 1,
  },
  totalPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: GOLD,
  },
  addToCartBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addToCartBtnDisabled: {
    opacity: 0.85,
  },
  addToCartBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: BG_DARK,
  },
});
