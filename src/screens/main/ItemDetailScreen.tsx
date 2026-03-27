import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  Modal,
  ActivityIndicator,
  Dimensions,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import type { AddonItem } from '../../api/itemDetail';
import { useCart } from '../../contexts/CartContext';
import { ItemDetailScreenSkeleton, SkeletonBox } from '../../components/skeleton';
import { getProductReviewsSummary } from '../../api/review';
import {
  getAllAddresses,
  getAddress,
  setAddressAsDefault,
  type Address,
} from '../../api/saveadresss';
import { getToken } from '../../storagetank';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
const ONBOARDING_ORDER_MODE_KEY = 'onboarding_order_mode';
type OrderMode = 'delivery' | 'dining' | 'takeaway';

/** Raw addon from items API (e.g. { id, name, price }). */
export type ItemDetailAddonRaw = {
  id?: string | number;
  _id?: string | number;
  addonId?: string | number;
  name?: string;
  title?: string;
  itemName?: string;
  price?: string;
  amount?: string | number;
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
  ratingValue?: number | null;
  reviewsCount?: number | null;
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

/** Normalize raw addon from items API to AddonItem for display. */
function normalizeAddonFromItem(raw: ItemDetailAddonRaw): AddonItem {
  const idValue = raw.id ?? raw._id ?? raw.addonId;
  const nameValue = raw.name ?? raw.title ?? raw.itemName;
  const priceValue = raw.price ?? raw.amount;
  const id =
    idValue != null
      ? String(idValue)
      : `${String(nameValue ?? '').trim()}-${String(priceValue ?? '').trim()}`;
  const name = nameValue != null ? String(nameValue) : '';
  const price = priceValue != null ? String(priceValue) : '';
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
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [instructionsInputHeight, setInstructionsInputHeight] = useState(44);
  const [addingToCart, setAddingToCart] = useState(false);
  const [itemAdded, setItemAdded] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [defaultAddress, setDefaultAddress] = useState<Address | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(true);
  const [chooseAddressModalVisible, setChooseAddressModalVisible] = useState(false);
  const [orderMode, setOrderMode] = useState<OrderMode>('delivery');
  const [productRating, setProductRating] = useState<{ avg: number; count: number } | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(ONBOARDING_ORDER_MODE_KEY);
          if (!active) return;
          if (raw === 'delivery' || raw === 'dining' || raw === 'takeaway') {
            setOrderMode(raw);
          } else {
            setOrderMode('delivery');
          }
        } catch {
          if (active) setOrderMode('delivery');
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const chooseAddress = async (addressId: string) => {
    try {
      await setAddressAsDefault(addressId);
      const def = await getAddress();
      setDefaultAddress(def);
      setChooseAddressModalVisible(false);
    } catch {
      // keep current selection on failure
    }
  };

  useEffect(() => {
    if (!item) return;
    const t = setTimeout(() => setShowSkeleton(false), 450);
    return () => clearTimeout(t);
  }, [item]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = String(item?.id ?? '').trim();
        if (!id) {
          if (!cancelled) setProductRating(null);
          return;
        }
        const summary = await getProductReviewsSummary([id]);
        if (cancelled) return;
        const row = summary.items?.[id];
        const count = parseOptionalNumber((row as { count?: unknown } | undefined)?.count) ?? 0;
        const avg = parseOptionalNumber((row as { averageOverall?: unknown } | undefined)?.averageOverall) ?? 0;
        if (count > 0 && avg > 0) {
          setProductRating({ avg, count });
        } else {
          setProductRating(null);
        }
      } catch {
        if (!cancelled) setProductRating(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [item?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (orderMode !== 'delivery') {
          if (!cancelled) {
            setAddresses([]);
            setDefaultAddress(null);
            setAddressesLoading(false);
          }
          return;
        }

        const token = await getToken();
        if (!token) {
          if (!cancelled) {
            setAddresses([]);
            setDefaultAddress(null);
            setAddressesLoading(false);
          }
          return;
        }
        setAddressesLoading(true);
        const [all, def] = await Promise.all([getAllAddresses(), getAddress()]);
        if (cancelled) return;
        setAddresses(all);
        setDefaultAddress(def);
      } catch {
        if (cancelled) return;
        setAddresses([]);
        setDefaultAddress(null);
      } finally {
        if (!cancelled) setAddressesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderMode]);

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setItemAdded(false);
  };

  useEffect(() => {
    setItemAdded(false);
  }, [item?.id]);

  const mainPrice = item?.price ? parseFloat(String(item.price).replace(/[$,]/g, '')) || 0 : 0;
  const addonsTotal = addons
    .filter((a) => selectedAddonIds.has(a.id))
    .reduce((sum, a) => sum + (parseFloat(String(a.price).replace(/[$,]/g, '')) || 0), 0);
  const total = mainPrice + addonsTotal;

  if (!item) {
    return (
      <SafeAreaView style={[styles.container, styles.centered]} edges={['top', 'bottom']}>
        <Text style={styles.errorText}>No item data</Text>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={18} color={BG_DARK} />
        </Pressable>
      </SafeAreaView>
    );
  }

  if (showSkeleton) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.imageContainer}>
          <View style={styles.imageWrap}>
            <View style={styles.heroImageSkeleton} />
          </View>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={18} color={TEXT_WHITE} />
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
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
            <Ionicons name="arrow-back" size={18} color={TEXT_WHITE} />
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
              <View style={styles.metaStarsRow}>
                {(
                  productRating
                    ? getStarIconNames(productRating.avg)
                    : Array.from({ length: 5 }, () => 'star-outline' as const)
                ).map((name, i) => (
                  <Ionicons key={`${item.id}-star-${i}-${name}`} name={name} size={13} color="#F8AC01" />
                ))}
              </View>
              {productRating ? (
                <Text style={styles.metaText}>
                  {`${productRating.avg.toFixed(1)} (${formatReviewCountCompact(productRating.count)})`}
                </Text>
              ) : null}
            </View>
            <View style={styles.metaItem}>
              <MaterialIcons name="access-time" size={14} color={GOLD} />
              <Text style={styles.metaText}>{item.cookingTime ?? item.time ?? '—'}</Text>
            </View>
          </View>
        </View>

        {/* Delivery location bar (uses saved addresses) */}
        {orderMode === 'delivery' && defaultAddress ? (
          <View style={styles.deliveryBar}>
            <View style={styles.deliveryBarLeft}>
              <Ionicons name="location-outline" size={18} color={GOLD} />
              <View style={styles.deliveryBarTextWrap}>
                <Text style={styles.deliveryBarTitle} numberOfLines={1}>
                  {defaultAddress.customerLocation || 'Delivery'}
                </Text>
                <Text style={styles.deliveryBarSubtitle} numberOfLines={2}>
                  {formatDeliveryAddress(defaultAddress)}
                </Text>
              </View>
            </View>

            {addresses.length > 1 ? (
              <Pressable
                style={styles.deliveryBarChangeBtn}
                onPress={() => setChooseAddressModalVisible(true)}
              >
                <Text style={styles.deliveryBarChangeText}>Choose</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>Special instructions</Text>
          <TextInput
            value={specialInstructions}
            onChangeText={(v) => {
              setSpecialInstructions(v);
              setItemAdded(false);
            }}
            placeholder="Add notes for this item (optional)"
            placeholderTextColor="rgba(255,255,255,0.45)"
            multiline
            textAlignVertical="top"
            style={[styles.instructionsInput, { height: instructionsInputHeight }]}
            onContentSizeChange={(e) => {
              const h = Math.ceil(e.nativeEvent.contentSize.height) + 14;
              setInstructionsInputHeight(Math.max(44, Math.min(180, h)));
            }}
          />
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

      {/* Choose delivery address modal */}
      <Modal
        visible={orderMode === 'delivery' && chooseAddressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setChooseAddressModalVisible(false)}
      >
        <SafeAreaView style={styles.modalBackdrop} edges={['top', 'bottom']}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setChooseAddressModalVisible(false)}
          />
          <View style={styles.addressModalCard}>
            <Text style={styles.addressModalTitle}>Choose delivery address</Text>
            <Text style={styles.addressModalSubtitle}>Select one of your saved locations</Text>

            {addressesLoading ? (
              <View style={styles.addressModalLoading}>
                <ActivityIndicator size="small" color={GOLD} />
              </View>
            ) : (
              <ScrollView
                style={styles.addressModalScroll}
                contentContainerStyle={styles.addressModalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {addresses.map((addr) => {
                  const isSelected = addr.id === defaultAddress?.id;
                  return (
                    <Pressable
                      key={addr.id}
                      style={[styles.addressOption, isSelected && styles.addressOptionSelected]}
                      onPress={() => void chooseAddress(addr.id)}
                    >
                      <Ionicons name="location-outline" size={18} color={GOLD} />
                      <View style={styles.addressOptionTextWrap}>
                        <Text style={styles.addressOptionTitle} numberOfLines={1}>
                          {addr.customerLocation || 'Delivery'}
                        </Text>
                        <Text style={styles.addressOptionSubtitle} numberOfLines={2}>
                          {formatDeliveryAddress(addr)}
                        </Text>
                      </View>
                      {isSelected ? (
                        <MaterialIcons name="check-circle" size={18} color={GOLD} />
                      ) : (
                        <MaterialIcons name="chevron-right" size={18} color="rgba(255,255,255,0.35)" />
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>
      </Modal>

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
              .map((a) => ({
                id: a.id,
                name: String(a.name ?? '').trim() || a.id,
                price: String(a.price ?? ''),
                image: a.image ?? null,
              }));
            addItem({
              productId: item.id,
              name: item.name,
              price: item.price,
              image: item.image,
              addons: selectedAddonsList,
              instructions: specialInstructions.trim() || undefined,
              quantity: 1,
            });
            await new Promise((r) => setTimeout(r, 500));
            setAddingToCart(false);
            setItemAdded(true);
            navigation.navigate('Cart');
          }}
          disabled={addingToCart}
        >
          <Text style={styles.addToCartBtnText}>
            {addingToCart ? 'Adding…' : itemAdded ? 'Added' : 'Add To Cart'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function formatDeliveryAddress(addr: Address): string {
  const parts = [
    addr.address?.trim(),
    addr.state?.trim(),
    addr.zipCode?.trim(),
  ].filter(Boolean);
  return parts.join(', ');
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
    paddingHorizontal: 0,
    paddingTop: 12,
    paddingBottom: 16,
    position: 'relative',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 280,
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
    left: 12,
    top: 18,
    width: 34,
    height: 34,
    borderRadius: 17,
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
  metaStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
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
  instructionsSection: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 4,
  },
  instructionsTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 10,
  },
  instructionsInput: {
    backgroundColor: SEARCH_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_WHITE,
    lineHeight: 18,
  },
  deliveryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: HORIZONTAL_PADDING,
    marginTop: 10,
    marginBottom: 6,
  },
  deliveryBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    backgroundColor: 'rgba(254, 203, 77, 0.08)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  deliveryBarTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  deliveryBarTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  deliveryBarSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
  deliveryBarChangeBtn: {
    marginLeft: 10,
    backgroundColor: GOLD,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  deliveryBarChangeText: {
    fontSize: 13,
    fontWeight: '800',
    color: BG_DARK,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  addressModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.25)',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 10,
    maxHeight: '80%',
  },
  addressModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  addressModalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 12,
  },
  addressModalLoading: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressModalScroll: {
    width: '100%',
    flexGrow: 0,
  },
  addressModalScrollContent: {
    paddingBottom: 10,
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    marginBottom: 10,
  },
  addressOptionSelected: {
    borderColor: 'rgba(254,203,77,0.65)',
    backgroundColor: 'rgba(254,203,77,0.10)',
  },
  addressOptionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  addressOptionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  addressOptionSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
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
