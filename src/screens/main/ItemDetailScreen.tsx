import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  ActivityIndicator,
  TextInput,
  Platform,
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
/** Match Discover `scrollContent` horizontal inset for add-on grid alignment. */
const GRID_PADDING = 16;
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

type ItemDetailRoute = RouteProp<RootStackParamList, 'ItemDetail'>;

export default function ItemDetailScreen() {
  const navigation = useNavigation<ItemDetailNavigationProp>();
  const route = useRoute<ItemDetailRoute>();
  const { addItem, items: cartItems, updateItemDetails } = useCart();
  const item = route.params?.item;
  const editingCartItemId = route.params?.cartItemId;
  const editingCartItem = editingCartItemId ? cartItems.find((c) => c.id === editingCartItemId) : undefined;
  const isEditingCartItem = Boolean(editingCartItemId && editingCartItem);
  const addons: AddonItem[] = useMemo(() => (item?.addons ?? []).map(normalizeAddonFromItem), [item?.addons]);
  const addonGridRows = useMemo(() => {
    const rows: { left?: AddonItem; right?: AddonItem }[] = [];
    for (let i = 0; i < addons.length; i += 2) {
      rows.push({ left: addons[i], right: addons[i + 1] });
    }
    return rows;
  }, [addons]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<Set<string>>(new Set());
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [instructionsInputHeight, setInstructionsInputHeight] = useState(44);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    if (!isEditingCartItem || !editingCartItem) return;
    setSpecialInstructions(String(editingCartItem.instructions ?? ''));
    setQuantity(Math.max(1, Math.floor(editingCartItem.quantity || 1)));
    const next = new Set<string>();
    (editingCartItem.addons || []).forEach((a) => {
      if (a?.id != null) next.add(String(a.id));
    });
    setSelectedAddonIds(next);
    // Only run when the cart item id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCartItemId]);

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

  const chooseAddress = useCallback(async (addressId: string) => {
    try {
      await setAddressAsDefault(addressId);
      const def = await getAddress();
      setDefaultAddress(def);
      setChooseAddressModalVisible(false);
    } catch {
      // keep current selection on failure
    }
  }, []);

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

  const toggleAddon = useCallback((id: string) => {
    setSelectedAddonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const getAddonsSignature = (addonsList: Array<{ id?: string; name?: string; price?: string }>): string => {
    return addonsList
      .map((a) => ({
        id: String(a.id ?? '').trim(),
        name: String(a.name ?? '').trim(),
        price: String(a.price ?? '').trim(),
      }))
      .sort((a, b) => {
        if (a.id !== b.id) return a.id.localeCompare(b.id);
        if (a.name !== b.name) return a.name.localeCompare(b.name);
        return a.price.localeCompare(b.price);
      })
      .map((a) => `${a.id}|${a.name}|${a.price}`)
      .join('||');
  };

  const selectedAddonsList = useMemo(() => {
    return addons
      .filter((a) => selectedAddonIds.has(a.id))
      .map((a) => ({
        id: a.id,
        name: String(a.name ?? '').trim() || a.id,
        price: String(a.price ?? ''),
        image: a.image ?? null,
      }));
  }, [addons, selectedAddonIds]);

  const selectedInstructionsTrim = String(specialInstructions ?? '').trim();
  const selectedAddonsSig = useMemo(() => getAddonsSignature(selectedAddonsList), [selectedAddonsList]);

  const isAlreadyInCart = useMemo(() => {
    if (isEditingCartItem) return false;
    const productId = item?.id != null ? String(item.id) : '';
    if (!productId) return false;

    return cartItems.some((ci) => {
      if (String(ci.productId) !== productId) return false;
      const sig = getAddonsSignature(ci.addons as Array<{ id?: string; name?: string; price?: string }>);
      if (sig !== selectedAddonsSig) return false;
      const prevInstr = String(ci.instructions ?? '').trim();
      return prevInstr === selectedInstructionsTrim;
    });
  }, [cartItems, isEditingCartItem, item?.id, selectedAddonsSig, selectedInstructionsTrim]);

  const mainPrice = useMemo(
    () => (item?.price ? parseFloat(String(item.price).replace(/[$,]/g, '')) || 0 : 0),
    [item?.price]
  );
  const addonsTotal = useMemo(() => {
    return addons
      .filter((a) => selectedAddonIds.has(a.id))
      .reduce((sum, a) => sum + (parseFloat(String(a.price).replace(/[$,]/g, '')) || 0), 0);
  }, [addons, selectedAddonIds]);
  const total = useMemo(() => (mainPrice + addonsTotal) * Math.max(1, quantity), [addonsTotal, mainPrice, quantity]);

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
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
          <Text style={styles.instructionsTitle}>Add Notes</Text>
          <TextInput
            value={specialInstructions}
            onChangeText={(v) => {
              setSpecialInstructions(v);
            }}
            placeholder="Add Notes"
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

        {/* Choose add-ons — same 2-column grid + card height as Discover menu */}
        <View style={styles.addonsSection}>
          <Text style={styles.addonsTitle}>Add-ons</Text>
          {addons.length === 0 ? (
            <Text style={styles.addonsEmpty}>No add-ons for this item</Text>
          ) : (
            <View style={styles.addonsGrid}>
              {addonGridRows.map((row, rowIndex) => {
                const isLastRow = rowIndex === addonGridRows.length - 1;
                return (
                  <View
                    key={`addon-row-${rowIndex}`}
                    style={[styles.addonGridRow, isLastRow && styles.addonGridRowLast]}
                  >
                    {[row.left, row.right].map((addon, col) => {
                      if (!addon) {
                        return <View key={`addon-empty-${rowIndex}-${col}`} style={styles.addonGridCell} />;
                      }
                      const img = addon.image;
                      const imageUri =
                        typeof img === 'string'
                          ? img.trim()
                          : img && typeof img === 'object' && (img as { uri?: string }).uri
                            ? String((img as { uri: string }).uri)
                            : null;
                      const isSelected = selectedAddonIds.has(addon.id);
                      return (
                        <Pressable
                          key={addon.id}
                          onPress={() => toggleAddon(addon.id)}
                          style={[
                            styles.addonGridCard,
                            styles.addonGridCell,
                            isSelected && styles.addonGridCardSelected,
                          ]}
                        >
                          <View style={styles.addonGridTopRow}>
                            <View style={styles.addonGridTopSpacer} />
                            {isSelected ? (
                              <MaterialIcons name="check-circle" size={18} color={GOLD} />
                            ) : (
                              <View style={styles.addonGridTopPlaceholder} />
                            )}
                          </View>
                          <View style={styles.addonGridImageCircle}>
                            {imageUri ? (
                              <Image
                                source={{ uri: imageUri }}
                                style={styles.addonGridImageCircleImg}
                                resizeMode="cover"
                              />
                            ) : (
                              <View style={styles.addonGridImageCircleSkeleton}>
                                <MaterialIcons
                                  name="image-not-supported"
                                  size={22}
                                  color="rgba(255,255,255,0.35)"
                                />
                              </View>
                            )}
                          </View>
                          <Text style={styles.addonGridName} numberOfLines={1}>
                            {addon.name}
                          </Text>
                          <View style={styles.addonGridBottomRow}>
                            <Text style={styles.addonGridPrice}>{formatPrice(addon.price)}</Text>
                            <View style={styles.addonGridToggleBtn}>
                              <MaterialIcons name={isSelected ? 'check' : 'add'} size={14} color={BG_DARK} />
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>

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
        <View style={styles.qtyStepper}>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            hitSlop={8}
            accessibilityLabel="Decrease quantity"
          >
            <Text style={styles.qtyBtnText}>−</Text>
          </Pressable>
          <View style={styles.qtyBadge}>
            <Text style={styles.qtyBadgeText}>{quantity}</Text>
          </View>
          <Pressable
            style={styles.qtyBtn}
            onPress={() => setQuantity((q) => Math.min(99, q + 1))}
            hitSlop={8}
            accessibilityLabel="Increase quantity"
          >
            <Text style={styles.qtyBtnText}>+</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.addToCartBtn, addingToCart && styles.addToCartBtnDisabled]}
          onPress={async () => {
            if (!item || addingToCart) return;
            if (isEditingCartItem && editingCartItemId) {
              setAddingToCart(true);
              updateItemDetails(editingCartItemId, {
                quantity,
                addons: selectedAddonsList,
                instructions: specialInstructions.trim() || undefined,
              });
              await new Promise((r) => setTimeout(r, 200));
              setAddingToCart(false);
              navigation.navigate('Cart');
              return;
            }
            if (isAlreadyInCart) {
              navigation.navigate('Cart');
              return;
            }

            setAddingToCart(true);
            addItem({
              productId: item.id,
              name: item.name,
              price: item.price,
              image: item.image,
              addons: selectedAddonsList,
              instructions: specialInstructions.trim() || undefined,
              quantity,
            });
            await new Promise((r) => setTimeout(r, 500));
            setAddingToCart(false);
            navigation.navigate('Cart');
          }}
          disabled={addingToCart}
        >
          <Text style={styles.addToCartBtnText}>
            {addingToCart
              ? isEditingCartItem
                ? 'Updating…'
                : 'Adding…'
              : isEditingCartItem
                ? 'Update Cart'
                : isAlreadyInCart
                  ? 'Already in cart'
                  : 'Add To Cart'}
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
    paddingHorizontal: GRID_PADDING,
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
    width: '100%',
  },
  addonGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 0,
    marginBottom: 10,
    width: '100%',
  },
  addonGridRowLast: {
    marginBottom: 0,
  },
  addonGridCell: {
    width: '48%',
  },
  /** Match Discover `productGridCard` — fixed height + circular image. */
  addonGridCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 12,
    height: 248,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  addonGridCardSelected: {
    borderColor: GOLD,
    borderWidth: 2,
    backgroundColor: 'rgba(254, 203, 77, 0.08)',
  },
  addonGridTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addonGridTopSpacer: {
    flex: 1,
  },
  addonGridTopPlaceholder: {
    width: 18,
    height: 18,
  },
  addonGridImageCircle: {
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
  addonGridImageCircleImg: {
    width: '100%',
    height: '100%',
  },
  addonGridImageCircleSkeleton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  addonGridName: {
    width: '100%',
    textAlign: 'left',
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 6,
  },
  addonGridBottomRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  addonGridPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: GOLD,
    lineHeight: 18,
  },
  addonGridToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
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
    gap: 10,
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
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: BG_DARK,
    includeFontPadding: false,
  },
  qtyBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  qtyBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_WHITE,
    includeFontPadding: false,
  },
});
