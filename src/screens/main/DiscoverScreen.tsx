import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  ScrollView,
  SectionList,
  TextInput,
  Dimensions,
  Linking,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type ImageSourcePropType,
  type ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  getMenuItems,
  getMenuCategories,
  type MenuItem as ApiMenuItem,
  type MenuCategory,
} from '../../api/discoverScreen';
import { getPromotionsBanners } from '../../api/banner&prommation';
import { getNetworkErrorMessage } from '../../api/apiConfig';
import { navigateToCart, navigateToLoginRegister } from '../../navigation/rootNavigationRef';
import { DiscoverScreenSkeleton } from '../../components/skeleton';
import { SkeletonBox } from '../../components/skeleton';
import { getAddress, saveAddress, updateAddress } from '../../api/saveadresss';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getVisit } from '../../api/content';
import * as Location from 'expo-location';
import { getToken } from '../../storagetank';
import { getWishlist } from '../../api/wishlist';
import { getOrderModes } from '../../api/orderModes';
import { useCart } from '../../contexts/CartContext';
import { getProductReviewsSummary } from '../../api/review';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const SEARCH_BG = '#1F403C';
const GOLD = '#FECB4D';
const GOLD_MUTED = '#E5B948';
const TEXT_WHITE = '#FFFFFF';

const ONBOARDING_ORDER_MODE_KEY = 'onboarding_order_mode';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;
const BANNER_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;
const BANNER_HEIGHT = 160;
/** Visible sliver of previous/next banner on left/right (peek carousel). */
const BANNER_PEEK = 20;
const BANNER_GAP = 10;
/** Card width when multiple banners: viewport minus both peeks. */
const BANNER_CARD_WIDTH = BANNER_WIDTH - 2 * BANNER_PEEK;
const BANNER_SNAP_INTERVAL = BANNER_CARD_WIDTH + BANNER_GAP;
const SEARCH_WRAP_HEIGHT = 12 + 44 + 10; // searchWrap paddingTop + searchBar height + paddingBottom
const TABS_WRAP_HEIGHT = 50; // tab pills + paddingBottom so in-flow tabs are fully off screen before sticky shows
const STICKY_TABS_THRESHOLD = BANNER_HEIGHT + SEARCH_WRAP_HEIGHT + TABS_WRAP_HEIGHT;
const TOAST_DURATION = 2400;

type OrderMode = 'delivery' | 'dining' | 'takeaway';

type DiscoverGridRow = { id: string; left?: DiscoverMenuItem; right?: DiscoverMenuItem };

type Coordinates = { latitude: number; longitude: number };

function toGridRows(items: DiscoverMenuItem[]): DiscoverGridRow[] {
  const rows: DiscoverGridRow[] = [];
  for (let i = 0; i < items.length; i += 2) {
    const left = items[i];
    const right = items[i + 1];
    const id = right ? `${left.id}__${right.id}` : `${left.id}__single`;
    rows.push({ id, left, right });
  }
  return rows;
}

function coerceFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(from: Coordinates, to: Coordinates): number {
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function extractCoordinatesFromMapsUrl(mapsUrl: string | undefined): Coordinates | null {
  if (!mapsUrl) return null;
  const decoded = decodeURIComponent(mapsUrl);
  const patterns = [
    /[?&](?:q|query|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),/i,
  ];
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
}

function resolveRestaurantAddress(location: {
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  mapsUrl?: string;
  map_url?: string;
} | null | undefined): string {
  if (!location) return '';
  const fromParts = [location.address, location.city]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(', ');
  if (fromParts) return fromParts;

  const rawMapUrl = (location.mapsUrl || location.map_url || '').trim();
  if (!rawMapUrl) return '';
  try {
    const parsed = new URL(rawMapUrl);
    const q = parsed.searchParams.get('q');
    if (!q) return '';
    const decoded = decodeURIComponent(q).replace(/\+/g, ' ').trim();
    return decoded;
  } catch {
    return '';
  }
}

async function readOrderModeFromStorage(): Promise<OrderMode> {
  try {
    const saved = await AsyncStorage.getItem(ONBOARDING_ORDER_MODE_KEY);
    if (saved === 'delivery' || saved === 'dining' || saved === 'takeaway') return saved;
  } catch {
    // ignore
  }
  return 'delivery';
}

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

function getDisplayRating(item: DiscoverMenuItem): string {
  const ratingValue = parseOptionalNumber(item.ratingValue);
  const reviewsCount = parseOptionalNumber(item.reviewsCount);

  if (ratingValue != null && ratingValue > 0) {
    const ratingText = ratingValue.toFixed(1);
    return `${ratingText} (${formatReviewCountCompact(reviewsCount ?? 0)})`;
  }
  return '';
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

function getStarIconNamesForItem(
  item: DiscoverMenuItem
): Array<React.ComponentProps<typeof MaterialIcons>['name']> {
  const avg = parseOptionalNumber(item.ratingValue);
  if (avg == null || avg <= 0) {
    return Array.from({ length: 5 }, () => 'star-border' as const);
  }
  return getStarIconNames(avg);
}

/** Raw addon from items API (linked to menu item). */
type DiscoverAddonRaw = { id: string; name?: string; price?: string; [key: string]: unknown };

export interface DiscoverMenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  rating?: string;
  ratingValue?: number | null;
  reviewsCount?: number | null;
  /** Only API image URL; null = no image → show skeleton */
  image: { uri: string } | null;
  /** Cooking time from API (e.g. "10-15 mins") */
  cookingTime?: string;
  /** Linked add-ons from the items API */
  addons?: DiscoverAddonRaw[];
}

function mapApiItemToDiscover(item: ApiMenuItem & { addons?: unknown[]; cookingTime?: string }): DiscoverMenuItem {
  const raw = item.image;
  const image =
    raw && typeof raw === 'string' && raw.trim().length > 0
      ? { uri: raw.trim() }
      : raw && typeof raw === 'object' && raw.uri && String(raw.uri).trim().length > 0
        ? { uri: String(raw.uri).trim() }
        : null;
  const addons = Array.isArray(item.addons)
    ? (item.addons as DiscoverAddonRaw[])
    : undefined;
  const cookingTime = item.cookingTime != null && String(item.cookingTime).trim() !== '' ? String(item.cookingTime).trim() : undefined;
  const ratingSource = item as unknown as Record<string, unknown>;
  const ratingRaw = ratingSource.rating;
  const ratingValue =
    parseOptionalNumber(ratingSource.ratingValue) ??
    parseOptionalNumber(ratingSource.rating_value) ??
    parseOptionalNumber(ratingSource.avgRating) ??
    parseOptionalNumber(ratingSource.avg_rating) ??
    parseOptionalNumber(ratingSource.averageRating) ??
    parseOptionalNumber(ratingSource.average_rating) ??
    parseOptionalNumber(ratingRaw);
  const reviewsCount =
    parseOptionalNumber(ratingSource.reviewsCount) ??
    parseOptionalNumber(ratingSource.reviews_count) ??
    parseOptionalNumber(ratingSource.reviewCount) ??
    parseOptionalNumber(ratingSource.review_count) ??
    parseOptionalNumber(ratingSource.totalReviews) ??
    parseOptionalNumber(ratingSource.total_reviews) ??
    parseOptionalNumber(ratingSource.ratingsCount) ??
    parseOptionalNumber(ratingSource.ratings_count);
  const rating = ratingRaw != null ? String(ratingRaw) : undefined;
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? 'Delicious Mexican-style dish.',
    price: item.price,
    rating,
    ratingValue,
    reviewsCount,
    image,
    cookingTime,
    addons,
  };
}

function itemsForCategory(
  items: ApiMenuItem[],
  category: MenuCategory
): DiscoverMenuItem[] {
  return items
    .filter((i) => {
      const categoryId = (i as ApiMenuItem & { categoryId?: string; category?: string }).categoryId;
      const categoryName = (i as ApiMenuItem & { category?: string }).category;
      return (
        categoryId === category.id ||
        (categoryName && categoryName.toLowerCase() === category.name.toLowerCase())
      );
    })
    .map(mapApiItemToDiscover);
}

function defaultCategoryIndex(categories: MenuCategory[]): number {
  const breakfastIndex = categories.findIndex(
    (c) => c.name.toLowerCase() === 'breakfast'
  );
  return breakfastIndex >= 0 ? breakfastIndex : 0;
}

function buildMenuSections(
  categories: MenuCategory[],
  allItems: ApiMenuItem[]
): { title: string; items: DiscoverMenuItem[] }[] {
  return categories.map((cat) => ({
    title: cat.name,
    items: itemsForCategory(allItems, cat),
  }));
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const { addItem, itemCount, items: cartItems } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [orderMode, setOrderMode] = useState<OrderMode>('delivery');
  const [customerLocationLabel, setCustomerLocationLabel] = useState<string>('');
  const [deliveryLatitude, setDeliveryLatitude] = useState<number | null>(null);
  const [deliveryLongitude, setDeliveryLongitude] = useState<number | null>(null);
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryZipCode, setDeliveryZipCode] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [restaurantState, setRestaurantState] = useState('');
  const [restaurantZipCode, setRestaurantZipCode] = useState('');
  const [restaurantMapsUrl, setRestaurantMapsUrl] = useState<string | null>(null);
  const [bannerSources, setBannerSources] = useState<Array<{ id: string; source: ImageSourcePropType }>>([]);
  const [bannerLoading, setBannerLoading] = useState(true);
  const [showHeaderModeModal, setShowHeaderModeModal] = useState(false);
  const [modalSelectedMode, setModalSelectedMode] = useState<OrderMode>('delivery');
  const [defaultAddressId, setDefaultAddressId] = useState<string | null>(null);
  const [deliveryModalAddress, setDeliveryModalAddress] = useState('');
  const [deliveryModalLabel, setDeliveryModalLabel] = useState('Home');
  const [deliveryModalLatitude, setDeliveryModalLatitude] = useState<number | null>(null);
  const [deliveryModalLongitude, setDeliveryModalLongitude] = useState<number | null>(null);
  const [deliveryModalCity, setDeliveryModalCity] = useState('');
  const [deliveryModalState, setDeliveryModalState] = useState('');
  const [deliveryModalZipCode, setDeliveryModalZipCode] = useState('');
  const [deliveryAddressInputHeight, setDeliveryAddressInputHeight] = useState(58);
  const [deliveryFetchingLocation, setDeliveryFetchingLocation] = useState(false);
  const [deliverySaving, setDeliverySaving] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [allItems, setAllItems] = useState<ApiMenuItem[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());
  const [wishlistUpdatingIds, setWishlistUpdatingIds] = useState<Set<string>>(new Set());
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const restaurantCoordsRef = useRef<Coordinates | null>(null);
  const restaurantCoordsInFlightRef = useRef<Promise<Coordinates | null> | null>(null);

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

  const loadWishlist = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) {
        setIsLoggedIn(false);
        setWishlistIds(new Set());
        return;
      }
      setIsLoggedIn(true);
      const data = await getWishlist();
      const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
      const ids = new Set<string>();
      items.forEach((it: any) => {
        const rawId = it?.productId ?? it?.id;
        if (rawId != null) ids.add(String(rawId));
      });
      setWishlistIds(ids);
    } catch {
      setIsLoggedIn(false);
      setWishlistIds(new Set());
    }
  }, []);

  const loadHeaderStateForMode = useCallback(async (mode: OrderMode) => {
    if (mode === 'delivery') {
      setRestaurantName('');
      setRestaurantMapsUrl(null);

      try {
        const address = await getAddress();
        setDefaultAddressId(address?.id ?? null);
        setCustomerLocationLabel(address?.customerLocation?.trim() || '');
        setDeliveryLatitude(coerceFiniteNumber(address?.latitude));
        setDeliveryLongitude(coerceFiniteNumber(address?.longitude));
        setFullAddress(address?.address?.trim() || '');
        setDeliveryCity(address?.city?.trim() || '');
        setDeliveryState(address?.state?.trim() || '');
        setDeliveryZipCode(address?.zipCode?.trim() || '');
      } catch {
        setDefaultAddressId(null);
        setCustomerLocationLabel('');
        setDeliveryLatitude(null);
        setDeliveryLongitude(null);
        setFullAddress('');
        setDeliveryCity('');
        setDeliveryState('');
        setDeliveryZipCode('');
      }
      return;
    }

    // dining + takeaway: show restaurant location (store name) in the header.
    setCustomerLocationLabel('');
    setDeliveryLatitude(null);
    setDeliveryLongitude(null);
    setFullAddress('');

    try {
      const visit = await getVisit();
      setRestaurantName(visit.location?.name || '');
      setRestaurantAddress(resolveRestaurantAddress(visit.location));
      setRestaurantState((visit.location?.state || '').trim());
      setRestaurantZipCode((visit.location?.zip || '').trim());
      setRestaurantMapsUrl(visit.location?.mapsUrl ?? null);
    } catch {
      setRestaurantName('');
      setRestaurantAddress('');
      setRestaurantState('');
      setRestaurantZipCode('');
      setRestaurantMapsUrl(null);
    }
  }, []);

  const openHeaderModeModal = useCallback(async () => {
    try {
      const mode = await readOrderModeFromStorage();
      setOrderMode(mode);
      await loadHeaderStateForMode(mode);
    } catch {
      // If storage read fails, keep current UI state.
    } finally {
      setShowHeaderModeModal(true);
    }
  }, [loadHeaderStateForMode]);

  const onSelectHeaderMode = useCallback(
    async (mode: OrderMode) => {
      setOrderMode(mode);
      try {
        await AsyncStorage.setItem(ONBOARDING_ORDER_MODE_KEY, mode);
      } catch {
        // ignore storage errors
      }
      await loadHeaderStateForMode(mode);
    },
    [loadHeaderStateForMode]
  );

  const handleItemPress = (item: DiscoverMenuItem) => {
    navigation.getParent()?.navigate('ItemDetail', { item });
  };

  const handleQuickAdd = useCallback(
    (item: DiscoverMenuItem) => {
      const alreadyInCart = cartItems.some((ci) => {
        if (String(ci.productId) !== String(item.id)) return false;
        const addonsEmpty = !Array.isArray(ci.addons) || ci.addons.length === 0;
        const instructionsEmpty = String(ci.instructions ?? '').trim().length === 0;
        return addonsEmpty && instructionsEmpty;
      });
      if (alreadyInCart) {
        showToast(`${item.name} is already in cart`, 'error');
        return;
      }
      addItem({
        productId: String(item.id),
        name: item.name,
        price: item.price,
        image: item.image,
        addons: [],
        quantity: 1,
      });
      showToast(`${item.name} is added to cart`, 'success');
    },
    [addItem, cartItems, showToast]
  );
  const mainListRef = useRef<SectionList<DiscoverGridRow>>(null);
  const tabsScrollRef = useRef<ScrollView>(null);
  const stickyTabsScrollRef = useRef<ScrollView>(null);
  /** Multi-banner carousel: open on 2nd slide (1 peek left, 3 peek right when n ≥ 3). */
  const bannerCarouselRef = useRef<ScrollView>(null);
  const bannerDefaultScrollKeyRef = useRef<string | null>(null);
  const [showStickyTabs, setShowStickyTabs] = useState(false);

  useEffect(() => {
    bannerDefaultScrollKeyRef.current = null;
  }, [bannerSources]);
  const prevStickyRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [dishRatingStats, setDishRatingStats] = useState<Record<string, { avg: number; count: number }>>({});

  // Fetch per-product summary directly by ids.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ids = allItems.map((it) => String(it.id ?? '').trim()).filter(Boolean);
        if (ids.length === 0) {
          if (!cancelled) setDishRatingStats({});
          return;
        }
        const summary = await getProductReviewsSummary(ids);
        if (cancelled) return;
        const stats: Record<string, { avg: number; count: number }> = {};
        Object.entries(summary.items || {}).forEach(([id, row]) => {
          const count = parseOptionalNumber((row as { count?: unknown }).count) ?? 0;
          const avg = parseOptionalNumber((row as { averageOverall?: unknown }).averageOverall) ?? 0;
          if (count > 0 && avg > 0) {
            stats[String(id).trim()] = { avg, count };
          }
        });
        setDishRatingStats(stats);
      } catch {
        if (!cancelled) setDishRatingStats({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allItems]);

  const menuSections = React.useMemo(
    () => {
      const base = buildMenuSections(categories, allItems);
      // Overlay dynamic ratings where possible (prefer product id, fallback to name).
      return base.map((section) => ({
        ...section,
        items: section.items.map((it) => {
          const idKey = String(it.id ?? '').trim();
          const stat = idKey ? dishRatingStats[idKey] : undefined;
          if (!stat || !(stat.count > 0) || !(stat.avg > 0)) return it;
          return {
            ...it,
            ratingValue: stat.avg,
            reviewsCount: stat.count,
          };
        }),
      }));
    },
    [categories, allItems, dishRatingStats]
  );

  const isSearching = searchQuery.trim().length > 0;
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMenuSections = React.useMemo(() => {
    if (!isSearching) return menuSections;
    return menuSections
      .map((section) => ({
        ...section,
        items: section.items.filter((it) => {
          const name = it.name?.toLowerCase() ?? '';
          const desc = it.description?.toLowerCase() ?? '';
          return name.includes(normalizedQuery) || desc.includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [isSearching, menuSections, normalizedQuery]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cats, items] = await Promise.all([getMenuCategories(), getMenuItems()]);
        if (cancelled) return;
        setCategories(cats);
        setAllItems(items);
        if (cats.length > 0) {
          setActiveTabIndex(defaultCategoryIndex(cats));
        }
      } catch (e) {
        if (!cancelled) setError(getNetworkErrorMessage(e));
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
        if (!cancelled) setBannerLoading(true);
        const apiBanners: Array<{ id?: string | number; image?: string; active?: boolean }> =
          await getPromotionsBanners();
        if (cancelled) return;
        const mapped =
          Array.isArray(apiBanners) && apiBanners.length > 0
            ? apiBanners
                .filter((b) => (b.active == null ? true : Boolean(b.active)) && typeof b.image === 'string' && b.image.trim().length > 0)
                .map((b, idx) => ({
                  id: String(b.id ?? idx),
                  source: { uri: b.image },
                }))
            : [];
        setBannerSources(mapped);
      } catch {
        if (!cancelled) setBannerSources([]);
      } finally {
        if (!cancelled) setBannerLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          // Keep wishlist/login state fresh whenever user visits this screen.
          await loadWishlist();

          const mode = await readOrderModeFromStorage();
          if (!active) return;
          setOrderMode(mode);

          if (mode === 'delivery') {
            setRestaurantName('');
            setRestaurantMapsUrl(null);

            const address = await getAddress();
            if (!active) return;
            setDefaultAddressId(address?.id ?? null);
            setCustomerLocationLabel(address?.customerLocation?.trim() || '');
            setDeliveryLatitude(coerceFiniteNumber(address?.latitude));
            setDeliveryLongitude(coerceFiniteNumber(address?.longitude));
            setFullAddress(address?.address?.trim() || '');
            setDeliveryCity(address?.city?.trim() || '');
            setDeliveryState(address?.state?.trim() || '');
            setDeliveryZipCode(address?.zipCode?.trim() || '');
            return;
          }

          // dining + takeaway: show restaurant location (store name) in the header.
          setCustomerLocationLabel('');
          setDeliveryLatitude(null);
          setDeliveryLongitude(null);
          setFullAddress('');

          const visit = await getVisit();
          if (!active) return;
          setRestaurantName(visit.location?.name || '');
          setRestaurantAddress(resolveRestaurantAddress(visit.location));
          setRestaurantState((visit.location?.state || '').trim());
          setRestaurantZipCode((visit.location?.zip || '').trim());
          setRestaurantMapsUrl(visit.location?.mapsUrl ?? null);
        } catch {
          if (!active) return;
          // Fallback to delivery address if mode/location fetch fails.
          setOrderMode('delivery');
          setDefaultAddressId(null);
          setCustomerLocationLabel('');
          setDeliveryLatitude(null);
          setDeliveryLongitude(null);
          setDeliveryCity('');
          setDeliveryState('');
          setDeliveryZipCode('');
          setRestaurantName('');
          setRestaurantAddress('');
          setRestaurantState('');
          setRestaurantZipCode('');
          setRestaurantMapsUrl(null);

          try {
            const address = await getAddress();
            if (!active) return;
            setDefaultAddressId(address?.id ?? null);
            setCustomerLocationLabel(address?.customerLocation?.trim() || '');
            setDeliveryLatitude(coerceFiniteNumber(address?.latitude));
            setDeliveryLongitude(coerceFiniteNumber(address?.longitude));
            setFullAddress(address?.address?.trim() || '');
            setDeliveryCity(address?.city?.trim() || '');
            setDeliveryState(address?.state?.trim() || '');
            setDeliveryZipCode(address?.zipCode?.trim() || '');
          } catch {
            setFullAddress('');
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [loadWishlist])
  );

  const openMapForCurrentMode = useCallback(() => {
    if (orderMode === 'delivery') {
      const lat = deliveryLatitude;
      const lng = deliveryLongitude;
      if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        const url = `https://www.google.com/maps?q=${lat},${lng}`;
        Linking.openURL(url).catch(() => {});
        return;
      }

      if (fullAddress) {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
        Linking.openURL(url).catch(() => {});
      }
      return;
    }

    if (restaurantMapsUrl) {
      const url = restaurantMapsUrl.replace(/&output=embed/, '');
      Linking.openURL(url).catch(() => {});
    }
  }, [deliveryLatitude, deliveryLongitude, fullAddress, orderMode, restaurantMapsUrl]);

  const headerLocationText =
    orderMode === 'delivery'
      ? (fullAddress || customerLocationLabel || 'Your location')
      : (restaurantName || 'Restaurant');
  const headerModeLabel =
    orderMode === 'delivery'
      ? 'Deliver to'
      : orderMode === 'takeaway'
        ? 'Pick up from'
        : 'Dining in';
  const restaurantLine2 = restaurantAddress;
  const restaurantLine3 = [restaurantState, restaurantZipCode]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' ');
  const restaurantModalLocationText = [restaurantName, restaurantLine2, restaurantLine3]
    .filter((v) => (v || '').trim().length > 0)
    .join('\n');

  useEffect(() => {
    if (!showHeaderModeModal) return;
    setModalSelectedMode(orderMode);
    setDeliveryModalAddress(fullAddress);
    setDeliveryModalLabel(customerLocationLabel || 'Home');
    setDeliveryModalLatitude(deliveryLatitude);
    setDeliveryModalLongitude(deliveryLongitude);
    setDeliveryModalCity(deliveryCity);
    setDeliveryModalState(deliveryState);
    setDeliveryModalZipCode(deliveryZipCode);
  }, [
    showHeaderModeModal,
    orderMode,
    fullAddress,
    customerLocationLabel,
    deliveryLatitude,
    deliveryLongitude,
    deliveryCity,
    deliveryState,
    deliveryZipCode,
  ]);

  // If user switches back to DELIVERY inside the modal, show the currently selected address again.
  useEffect(() => {
    if (!showHeaderModeModal) return;
    if (modalSelectedMode !== 'delivery') return;
    setDeliveryModalAddress(fullAddress);
    setDeliveryModalLabel(customerLocationLabel || 'Home');
    setDeliveryModalLatitude(deliveryLatitude);
    setDeliveryModalLongitude(deliveryLongitude);
    setDeliveryModalCity(deliveryCity);
    setDeliveryModalState(deliveryState);
    setDeliveryModalZipCode(deliveryZipCode);
  }, [
    showHeaderModeModal,
    modalSelectedMode,
    fullAddress,
    customerLocationLabel,
    deliveryLatitude,
    deliveryLongitude,
    deliveryCity,
    deliveryState,
    deliveryZipCode,
  ]);

  const fetchDeliveryLocationInModal = useCallback(async () => {
    try {
      setDeliveryFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to fetch your location.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setDeliveryModalLatitude(lat);
      setDeliveryModalLongitude(lng);

      const reverseGeo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (reverseGeo && reverseGeo.length > 0) {
        const place = reverseGeo[0];
        const parts = [
          place.name,
          place.street,
          place.district,
          place.city,
          place.region,
          place.postalCode,
          place.country,
        ].filter(Boolean);
        const resolvedAddress = parts.join(', ');
        if (resolvedAddress) setDeliveryModalAddress(resolvedAddress);
        setDeliveryModalCity(place.city ?? place.subregion ?? '');
        setDeliveryModalState(place.region ?? '');
        setDeliveryModalZipCode(place.postalCode ?? '');
      }
    } catch {
      Alert.alert('Error', 'Failed to fetch current location. Please try again.');
    } finally {
      setDeliveryFetchingLocation(false);
    }
  }, []);

  const getRestaurantCoords = useCallback(async (): Promise<Coordinates | null> => {
    if (restaurantCoordsRef.current) return restaurantCoordsRef.current;
    if (restaurantCoordsInFlightRef.current) return restaurantCoordsInFlightRef.current;

    const req = (async () => {
      try {
        const visit = await getVisit();
        const fromMap = extractCoordinatesFromMapsUrl(visit.location?.mapsUrl);
        if (fromMap) {
          restaurantCoordsRef.current = fromMap;
          return fromMap;
        }

        const addressParts = [
          visit.location?.address,
          visit.location?.city,
          visit.location?.state,
          visit.location?.zip,
        ]
          .map((value) => (value ? value.trim() : ''))
          .filter(Boolean);

        if (addressParts.length === 0) return null;
        const geocoded = await Location.geocodeAsync(addressParts.join(', '));
        const first = geocoded[0];
        if (!first) return null;

        const coords = { latitude: first.latitude, longitude: first.longitude };
        restaurantCoordsRef.current = coords;
        return coords;
      } catch {
        return null;
      }
    })();

    restaurantCoordsInFlightRef.current = req;
    try {
      return await req;
    } finally {
      restaurantCoordsInFlightRef.current = null;
    }
  }, []);

  const applyModeSelection = useCallback(async () => {
    try {
      if (modalSelectedMode === 'delivery') {
        if (!deliveryModalAddress.trim()) {
          Alert.alert('Missing Address', 'Please enter your delivery address.');
          return;
        }

        const finalLat = deliveryModalLatitude ?? deliveryLatitude ?? null;
        const finalLng = deliveryModalLongitude ?? deliveryLongitude ?? null;
        if (finalLat == null || finalLng == null) {
          Alert.alert('Missing Location', 'Please fetch your location first.');
          return;
        }

        // Same as onboarding: enforce delivery radius if enabled by admin.
        const modes = await getOrderModes();
        if (modes.deliveryRadiusEnabled) {
          const restaurantCoords = await getRestaurantCoords();
          const radiusKm = modes.deliveryRadiusKm ?? 10;
          if (!restaurantCoords) {
            // If restaurant coordinates can't be resolved, don't block checkout.
            // (Geocoding/maps URL may be unavailable on some devices/networks.)
          } else {
            const userCoords: Coordinates = { latitude: finalLat, longitude: finalLng };
            const distanceKm = calculateDistanceKm(userCoords, restaurantCoords);
            if (distanceKm > radiusKm) {
              Alert.alert(
                'Out of delivery radius',
                `Sorry, we currently deliver only within ${radiusKm} km from our restaurant.`
              );
              return;
            }
          }
        }

        setDeliverySaving(true);
        const payload = {
          latitude: finalLat,
          longitude: finalLng,
          address: deliveryModalAddress.trim(),
          customerLocation: deliveryModalLabel.trim() || 'Home',
          city:
            deliveryModalCity.trim() ||
            deliveryCity.trim() ||
            deliveryModalAddress.split(',').map((p) => p.trim()).find(Boolean) ||
            'Unknown City',
          state: deliveryModalState.trim() || deliveryState.trim() || undefined,
          // Backend currently rejects null zipCode, so send a safe fallback.
          zipCode: deliveryModalZipCode.trim() || deliveryZipCode.trim() || '00000',
          isDefault: true,
        };
        if (defaultAddressId) {
          await updateAddress(defaultAddressId, payload);
        } else {
          await saveAddress(payload);
        }
      }
      await onSelectHeaderMode(modalSelectedMode);
      setShowHeaderModeModal(false);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update location settings.');
    } finally {
      setDeliverySaving(false);
    }
  }, [
    modalSelectedMode,
    deliveryModalAddress,
    deliveryModalLatitude,
    deliveryModalLongitude,
    deliveryLatitude,
    deliveryLongitude,
    deliveryModalLabel,
    defaultAddressId,
    onSelectHeaderMode,
    getRestaurantCoords,
  ]);

  const ensureRestaurantDetailsForModal = useCallback(async () => {
    if (restaurantName.trim() && restaurantAddress.trim()) return;
    try {
      const visit = await getVisit();
      setRestaurantName(visit.location?.name || '');
      setRestaurantAddress(resolveRestaurantAddress(visit.location));
      setRestaurantState((visit.location?.state || '').trim());
      setRestaurantZipCode((visit.location?.zip || '').trim());
      setRestaurantMapsUrl(visit.location?.mapsUrl ?? null);
    } catch {
      // Keep current values/placeholders if API fails.
    }
  }, [restaurantName, restaurantAddress]);

  const openRestaurantMapFromModal = useCallback(() => {
    if (restaurantMapsUrl) {
      const url = restaurantMapsUrl.replace(/&output=embed/, '');
      Linking.openURL(url).catch(() => {});
      return;
    }
    if (restaurantAddress) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurantAddress)}`;
      Linking.openURL(url).catch(() => {});
    }
  }, [restaurantMapsUrl, restaurantAddress]);

  const openDeliveryMapFromModal = useCallback(() => {
    const lat = deliveryModalLatitude ?? deliveryLatitude;
    const lng = deliveryModalLongitude ?? deliveryLongitude;
    if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
      const url = `https://www.google.com/maps?q=${lat},${lng}`;
      Linking.openURL(url).catch(() => {});
      return;
    }

    const q = deliveryModalAddress.trim();
    if (q) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
      Linking.openURL(url).catch(() => {});
    }
  }, [
    deliveryModalLatitude,
    deliveryModalLongitude,
    deliveryLatitude,
    deliveryLongitude,
    deliveryModalAddress,
  ]);

  const scrollTabsToIndex = useCallback((index: number) => {
    const estimatedTabWidth = 110;
    const x = Math.max(0, index * estimatedTabWidth - SCREEN_WIDTH / 2 + estimatedTabWidth / 2);
    tabsScrollRef.current?.scrollTo({ x, animated: true });
    stickyTabsScrollRef.current?.scrollTo({ x, animated: true });
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const sticky = y >= STICKY_TABS_THRESHOLD;
      if (sticky !== prevStickyRef.current) {
        prevStickyRef.current = sticky;
        setShowStickyTabs(sticky);
      }
    },
    []
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (isSearching) return;
      const firstVisible = viewableItems.find(
        (token) => token.isViewable && typeof token.section?.title === 'string'
      );
      if (!firstVisible?.section?.title) return;
      const index = menuSections.findIndex((s) => s.title === firstVisible.section.title);
      if (index >= 0) {
        setActiveTabIndex((prev) => {
          if (prev === index) return prev;
          scrollTabsToIndex(index);
          return index;
        });
      }
    },
    [isSearching, menuSections, scrollTabsToIndex]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 35,
  }).current;

  const onTabPress = useCallback(
    (index: number) => {
      mainListRef.current?.scrollToLocation({
        sectionIndex: index,
        itemIndex: 0,
        animated: true,
        viewOffset: showStickyTabs ? 60 : 0,
      });
      setActiveTabIndex(index);
      scrollTabsToIndex(index);
    },
    [scrollTabsToIndex, showStickyTabs]
  );

  const bannerCarouselItems = useMemo(() => {
    // For 3+ banners, render a looping list to avoid empty peek space on ends.
    if (bannerSources.length >= 3) {
      const first = bannerSources[0];
      const last = bannerSources[bannerSources.length - 1];
      return [last, ...bannerSources, first];
    }
    return bannerSources;
  }, [bannerSources]);

  const bannerLoopEnabled = bannerSources.length >= 3;

  /** Default scroll position:
   * - 1 banner: no carousel
   * - 2 banners: start at first (so 2nd peeks on right)
   * - 3+ banners: start at "2nd real banner" (index 2 in looped array)
   */
  const onBannerCarouselContentSizeChange = useCallback(() => {
    if (bannerSources.length <= 1) return;
    const key = bannerSources.map((b) => b.id).join('|');
    if (bannerDefaultScrollKeyRef.current === key) return;
    bannerDefaultScrollKeyRef.current = key;
    // If only 2 banners exist, start on the 1st banner so the 2nd peeks on the right.
    if (bannerSources.length === 2) {
      bannerCarouselRef.current?.scrollTo({ x: 0, animated: false });
      return;
    }
    // For 3+ banners (looped), start on the 2nd *real* banner (index 2).
    bannerCarouselRef.current?.scrollTo({ x: BANNER_SNAP_INTERVAL * 2, animated: false });
  }, [bannerSources]);

  const onBannerCarouselMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!bannerLoopEnabled) return;
      const x = e.nativeEvent.contentOffset.x;
      const index = Math.round(x / BANNER_SNAP_INTERVAL);
      const n = bannerSources.length; // real count
      if (n < 3) return;

      // looped array indices:
      // 0 = last (dup), 1..n = real, n+1 = first (dup)
      if (index === 0) {
        // jumped to dup last -> go to real last
        bannerCarouselRef.current?.scrollTo({ x: BANNER_SNAP_INTERVAL * n, animated: false });
      } else if (index === n + 1) {
        // jumped to dup first -> go to real first
        bannerCarouselRef.current?.scrollTo({ x: BANNER_SNAP_INTERVAL * 1, animated: false });
      }
    },
    [bannerLoopEnabled, bannerSources.length]
  );

  const renderTabs = () => (
    <ScrollView
      ref={tabsScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContentInFlow}
    >
      {categories.map((cat, index) => (
        <Pressable
          key={cat.id}
          onPress={() => onTabPress(index)}
          style={[
            styles.tabPill,
            activeTabIndex === index && styles.tabPillActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTabIndex === index && styles.tabTextActive,
            ]}
            numberOfLines={1}
          >
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderStickyTabs = () => (
    <ScrollView
      ref={stickyTabsScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContentSticky}
    >
      {categories.map((cat, index) => (
        <Pressable
          key={`sticky-${cat.id}`}
          onPress={() => onTabPress(index)}
          style={[
            styles.tabPill,
            activeTabIndex === index && styles.tabPillActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTabIndex === index && styles.tabTextActive,
            ]}
            numberOfLines={1}
          >
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const deliveryModalHasLocation =
    deliveryModalLatitude != null &&
    deliveryModalLongitude != null &&
    Number.isFinite(deliveryModalLatitude) &&
    Number.isFinite(deliveryModalLongitude);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View
        style={styles.header}
        onLayout={(e) => {
          setHeaderHeight(e.nativeEvent.layout.height);
        }}
      >
        <View style={styles.headerCenter}>
          <View style={styles.headerLocationWrap}>
            <Pressable style={styles.headerPinBtn} onPress={openMapForCurrentMode}>
              <Ionicons name="location" size={24} color={GOLD} />
            </Pressable>

            <Pressable
              style={styles.headerLocationTextWrap}
              onPress={() => void openHeaderModeModal()}
            >
              <View style={styles.headerModeRow}>
                <Text style={styles.headerModeLabel}>{headerModeLabel}</Text>
                <MaterialIcons name="keyboard-arrow-down" size={20} color={GOLD} />
              </View>
              <Text style={styles.headerLocationName} numberOfLines={1}>
                {headerLocationText}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.headerRightActions}>
          {isLoggedIn ? (
            <Pressable
              style={styles.headerWishlistBtn}
              onPress={() => navigation.getParent()?.navigate('Wishlist')}
              hitSlop={8}
            >
              <MaterialIcons name="favorite" size={16} color={BG_DARK} />
              {wishlistIds.size > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>
                    {wishlistIds.size > 99 ? '99+' : String(wishlistIds.size)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}

          <Pressable style={styles.headerIconBtn} onPress={navigateToCart} hitSlop={8}>
            <Ionicons name="cart-outline" size={17} color={BG_DARK} />
            {itemCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {itemCount > 99 ? '99+' : String(itemCount)}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      {/* Header mode picker modal */}
      <Modal
        visible={showHeaderModeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowHeaderModeModal(false)}
      >
        <SafeAreaView style={styles.modalBackdrop} edges={['top', 'bottom', 'left', 'right']}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setShowHeaderModeModal(false)}
          />

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardWrap}
          >
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <Image
                source={require('../../../assets/Splash.png')}
                style={styles.modalLogo}
                resizeMode="contain"
              />
              <Text style={styles.modalTitle}>Select your order type</Text>

              <View style={styles.modalSegmentRow}>
                <Pressable
                  style={[styles.modalSegmentBtn, modalSelectedMode === 'delivery' && styles.modalSegmentBtnActive]}
                  onPress={() => setModalSelectedMode('delivery')}
                >
                  <Text style={[styles.modalSegmentText, modalSelectedMode === 'delivery' && styles.modalSegmentTextActive]}>
                    DELIVERY
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSegmentBtn, modalSelectedMode === 'takeaway' && styles.modalSegmentBtnActive]}
                  onPress={() => {
                    setModalSelectedMode('takeaway');
                    void ensureRestaurantDetailsForModal();
                  }}
                >
                  <Text style={[styles.modalSegmentText, modalSelectedMode === 'takeaway' && styles.modalSegmentTextActive]}>
                    PICK-UP
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.modalSegmentBtn, modalSelectedMode === 'dining' && styles.modalSegmentBtnActive]}
                  onPress={() => {
                    setModalSelectedMode('dining');
                    void ensureRestaurantDetailsForModal();
                  }}
                >
                  <Text style={[styles.modalSegmentText, modalSelectedMode === 'dining' && styles.modalSegmentTextActive]}>
                    DINE-IN
                  </Text>
                </Pressable>
              </View>

              {modalSelectedMode === 'delivery' ? (
                <>
                  <Text style={styles.modalSubtitle}>Please select your location</Text>
                  <Pressable
                    style={[styles.modalLocationBtn, deliveryFetchingLocation && styles.modalLocationBtnDisabled]}
                    onPress={() => void fetchDeliveryLocationInModal()}
                    disabled={deliveryFetchingLocation}
                  >
                    {deliveryFetchingLocation ? (
                      <ActivityIndicator size="small" color={BG_DARK} />
                    ) : (
                      <>
                        <MaterialIcons name="my-location" size={20} color={BG_DARK} />
                        <Text style={styles.modalLocationBtnText}>Use Current Location</Text>
                      </>
                    )}
                  </Pressable>
                  {deliveryModalHasLocation ? (
                    <>
                      <TextInput
                        style={styles.modalInput}
                        value={deliveryModalCity}
                        onChangeText={setDeliveryModalCity}
                        placeholder="City"
                        placeholderTextColor="rgba(11,29,27,0.4)"
                      />
                      <View style={styles.deliveryAddressFieldWrap}>
                        <TextInput
                          style={[
                            styles.modalInput,
                            styles.modalInputMultiline,
                            styles.deliveryAddressInput,
                            { minHeight: Math.max(58, deliveryAddressInputHeight) },
                          ]}
                          value={deliveryModalAddress}
                          onChangeText={setDeliveryModalAddress}
                          placeholder="Full address"
                          placeholderTextColor="rgba(11,29,27,0.4)"
                          multiline
                          numberOfLines={2}
                          onContentSizeChange={(e) => {
                            const h = e.nativeEvent.contentSize.height;
                            setDeliveryAddressInputHeight(Math.min(140, Math.max(58, h + 18)));
                          }}
                        />
                        <Pressable
                          style={styles.deliveryAddressMapIconBtn}
                          onPress={openDeliveryMapFromModal}
                        >
                          <MaterialIcons name="open-in-new" size={14} color={GOLD} />
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.modalSubtitle}>Restaurant details</Text>
                  <View style={styles.deliveryAddressFieldWrap}>
                    <TextInput
                      style={[
                        styles.modalInput,
                        styles.modalInputMultiline,
                        styles.deliveryAddressInput,
                      ]}
                      value={restaurantModalLocationText || 'Restaurant address'}
                      editable={false}
                      placeholder="Restaurant address"
                      placeholderTextColor="rgba(11,29,27,0.4)"
                      multiline
                    />
                    <Pressable
                      style={styles.deliveryAddressMapIconBtn}
                      onPress={openRestaurantMapFromModal}
                    >
                      <MaterialIcons name="open-in-new" size={14} color={GOLD} />
                    </Pressable>
                  </View>
                </>
              )}

              {modalSelectedMode !== 'delivery' || deliveryModalHasLocation ? (
                <Pressable
                  style={[
                    styles.modalSelectBtn,
                    modalSelectedMode === 'delivery' && deliverySaving && styles.modalLocationBtnDisabled,
                  ]}
                  onPress={() => void applyModeSelection()}
                  disabled={modalSelectedMode === 'delivery' && deliverySaving}
                >
                  {modalSelectedMode === 'delivery' && deliverySaving ? (
                    <ActivityIndicator size="small" color={BG_DARK} />
                  ) : (
                    <Text style={styles.modalSelectBtnText}>Select</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Sticky tabs – visible when scrolled past banner + search */}
      {showStickyTabs && categories.length > 0 && !isSearching ? (
        <View style={[styles.stickyTabsWrap, { top: headerHeight }]}>
          {renderStickyTabs()}
        </View>
      ) : null}

      {/* Single scroll: Banner → Search → Tabs → Menu content */}
      <SectionList
        ref={mainListRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          showStickyTabs && !isSearching && { paddingTop: TABS_WRAP_HEIGHT },
        ]}
        sections={
          loading
            ? []
            : (isSearching ? filteredMenuSections : menuSections).map((section) => ({
                title: section.title,
                data: toGridRows(section.items),
              }))
        }
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => {
          if (section.data.length === 0) return null;
          return (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          );
        }}
        renderItem={({ item: row, section, index }) => {
          const isLastRow = index === section.data.length - 1;
          const left = row.left;
          const right = row.right;
          return (
            <View style={[styles.menuGridRow, isLastRow && styles.menuGridRowLast]}>
              {left ? (
                <Pressable
                  style={[styles.productGridCard, styles.menuGridCell]}
                  onPress={() => handleItemPress(left)}
                >
                  <View style={styles.productGridTopRow}>
                    <View style={styles.productGridTopLeftRow}>
                      <View style={styles.productGridStarsRow}>
                        {getStarIconNamesForItem(left).map((name, i) => (
                          <MaterialIcons key={`${left.id}-star-${i}-${name}`} name={name} size={16} color={GOLD} />
                        ))}
                      </View>
                      {getDisplayRating(left) ? (
                        <Text style={styles.productGridRating} numberOfLines={1}>
                          {getDisplayRating(left)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.productGridImageCircle}>
                    {left.image ? (
                      <Image source={left.image} style={styles.productGridImageCircleImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.productGridImageCircleSkeleton}>
                        <MaterialIcons name="image-not-supported" size={22} color="rgba(255,255,255,0.35)" />
                      </View>
                    )}
                  </View>

                  <Text style={styles.productGridName} numberOfLines={1}>
                    {left.name}
                  </Text>

                  <View style={styles.productGridBottomRow}>
                    <Text style={styles.productGridPrice}>{formatPrice(left.price)}</Text>
                    <Pressable
                      style={styles.productGridAddBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleQuickAdd(left);
                      }}
                      hitSlop={8}
                      accessibilityLabel="Quick add to cart"
                    >
                      <MaterialIcons name="add" size={14} color={BG_DARK} />
                    </Pressable>
                  </View>
                </Pressable>
              ) : null}

              {right ? (
                <Pressable
                  style={[styles.productGridCard, styles.menuGridCell]}
                  onPress={() => handleItemPress(right)}
                >
                  <View style={styles.productGridTopRow}>
                    <View style={styles.productGridTopLeftRow}>
                      <View style={styles.productGridStarsRow}>
                        {getStarIconNamesForItem(right).map((name, i) => (
                          <MaterialIcons key={`${right.id}-star-${i}-${name}`} name={name} size={16} color={GOLD} />
                        ))}
                      </View>
                      {getDisplayRating(right) ? (
                        <Text style={styles.productGridRating} numberOfLines={1}>
                          {getDisplayRating(right)}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.productGridImageCircle}>
                    {right.image ? (
                      <Image source={right.image} style={styles.productGridImageCircleImg} resizeMode="cover" />
                    ) : (
                      <View style={styles.productGridImageCircleSkeleton}>
                        <MaterialIcons name="image-not-supported" size={22} color="rgba(255,255,255,0.35)" />
                      </View>
                    )}
                  </View>

                  <Text style={styles.productGridName} numberOfLines={1}>
                    {right.name}
                  </Text>

                  <View style={styles.productGridBottomRow}>
                    <Text style={styles.productGridPrice}>{formatPrice(right.price)}</Text>
                    <Pressable
                      style={styles.productGridAddBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleQuickAdd(right);
                      }}
                      hitSlop={8}
                      accessibilityLabel="Quick add to cart"
                    >
                      <MaterialIcons name="add" size={14} color={BG_DARK} />
                    </Pressable>
                  </View>
                </Pressable>
              ) : null}
            </View>
          );
        }}
        stickySectionHeadersEnabled={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={48}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={(
          <>
            {/* Banner (scrolls away) */}
            <View style={[styles.bannerWrap, bannerSources.length === 1 ? styles.bannerWrapSingle : null]}>
              {bannerLoading ? (
                <View style={styles.bannerLoadingWrap}>
                  <View style={styles.bannerLoadingSkeletonWrap}>
                    <SkeletonBox
                      width={bannerSources.length === 1 ? SCREEN_WIDTH : BANNER_WIDTH}
                      height={BANNER_HEIGHT}
                      borderRadius={bannerSources.length === 1 ? 0 : 12}
                    />
                  </View>
                </View>
              ) : bannerSources.length > 0 ? (
                <View style={styles.bannerInnerWrap}>
                  {bannerSources.length === 1 ? (
                    <View style={[styles.bannerSlide, styles.bannerSlideSingle]}>
                      <Image source={bannerSources[0].source} style={styles.bannerImage} resizeMode="cover" />
                    </View>
                  ) : (
                    <ScrollView
                      ref={bannerCarouselRef}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      snapToInterval={BANNER_SNAP_INTERVAL}
                      snapToAlignment="start"
                      disableIntervalMomentum
                      scrollEventThrottle={16}
                      contentContainerStyle={styles.bannerCarouselContent}
                      onContentSizeChange={onBannerCarouselContentSizeChange}
                      onMomentumScrollEnd={onBannerCarouselMomentumEnd}
                    >
                      {bannerCarouselItems.map((b, index) => (
                        <View
                          key={`${b.id}-${index}`}
                          style={[
                            styles.bannerSlidePeek,
                            index < bannerCarouselItems.length - 1 ? { marginRight: BANNER_GAP } : null,
                          ]}
                        >
                          <Image source={b.source} style={styles.bannerImage} resizeMode="cover" />
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </View>
              ) : (
                // No banners from API: keep banner area but render nothing.
                <View />
              )}
            </View>

            {/* Search bar (scrolls away) */}
            <View style={styles.searchWrap}>
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

            {/* Menu tabs in flow (scrolls away) */}
            <View style={styles.tabsWrap}>
              {!isSearching ? renderTabs() : null}
            </View>

            {/* Menu items / skeleton / error */}
            {error ? (
              <View style={styles.apiError}>
                <Text style={styles.apiErrorText}>{error}</Text>
              </View>
            ) : null}
            {loading ? (
              <DiscoverScreenSkeleton />
            ) : null}
          </>
        )}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
      >
      </SectionList>

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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_DARK,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingRight: 10,
  },
  headerLocationWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  headerPinBtn: {
    width: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  headerLocationTextWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  headerModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  headerModeLabel: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    fontWeight: '700',
    color: GOLD,
    marginRight: 2,
  },
  headerLocationName: {
    fontSize: 10,
    fontWeight: '500',
    color: GOLD,
    minWidth: 0,
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerWishlistBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadge: {
    position: 'absolute',
    top: -5,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFC107',
    borderWidth: 2,
    borderColor: BG_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerBadgeText: {
    color: BG_DARK,
    fontSize: 10,
    fontWeight: '900',
    includeFontPadding: false,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: BG_DARK,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: 'rgba(254, 203, 77, 0.45)',
    alignItems: 'center',
  },
  modalKeyboardWrap: {
    width: '100%',
    alignItems: 'center',
  },
  modalLogo: {
    width: 56,
    height: 56,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 14,
  },
  modalSubtitle: {
    width: '100%',
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 10,
    marginTop: 6,
  },
  modalSegmentRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  modalSegmentBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    alignItems: 'center',
  },
  modalSegmentBtnActive: {
    backgroundColor: GOLD,
  },
  modalSegmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
  },
  modalSegmentTextActive: {
    color: BG_DARK,
  },
  modalLocationBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 10,
  },
  modalLocationBtnDisabled: {
    opacity: 0.7,
  },
  modalLocationBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: BG_DARK,
  },
  modalInput: {
    width: '100%',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.25)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT_WHITE,
    marginBottom: 10,
  },
  modalInputMultiline: {
    minHeight: 58,
    textAlignVertical: 'top',
  },
  modalMapInput: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalMapInputText: {
    flex: 1,
    fontSize: 14,
    color: TEXT_WHITE,
  },
  deliveryAddressFieldWrap: {
    width: '100%',
    position: 'relative',
  },
  deliveryAddressInput: {
    marginBottom: 0,
    paddingRight: 44,
  },
  deliveryAddressMapIconBtn: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(254, 203, 77, 0.10)',
  },
  modalSelectBtn: {
    width: '100%',
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalSelectBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  bannerWrap: {
    height: BANNER_HEIGHT,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    overflow: 'hidden',
  },
  // When backend returns only 1 banner, show it full-width (no card container).
  bannerWrapSingle: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    marginHorizontal: -HORIZONTAL_PADDING,
  },
  bannerSlide: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerSlideSingle: {
    width: SCREEN_WIDTH,
    borderRadius: 0,
  },
  bannerCarouselContent: {
    paddingHorizontal: BANNER_PEEK,
    alignItems: 'center',
  },
  bannerSlidePeek: {
    width: BANNER_CARD_WIDTH,
    height: BANNER_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
  },
  bannerInnerWrap: {
    flex: 1,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerLoadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLoadingSkeletonWrap: {
    width: '100%',
    height: '100%',
  },
  searchWrap: {
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: BG_DARK,
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
  tabsWrap: {
    backgroundColor: BG_DARK,
    paddingBottom: 10,
  },
  /** In ListHeader: SectionList `scrollContent` already applies horizontal padding — do not pad left again. */
  tabsContentInFlow: {
    paddingLeft: 0,
    paddingRight: HORIZONTAL_PADDING + 32,
    gap: 8,
  },
  /** Sticky row is `position: 'absolute'` (not inside padded scroll content) — match section title inset. */
  tabsContentSticky: {
    paddingLeft: HORIZONTAL_PADDING,
    paddingRight: HORIZONTAL_PADDING + 32,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.30)',
  },
  tabPillActive: {
    backgroundColor: GOLD,
    borderColor: 'transparent',
  },
  tabText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  tabTextActive: {
    color: BG_DARK,
  },
  stickyTabsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: BG_DARK,
    zIndex: 10,
    paddingVertical: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  /** Equal vertical space above and below each category title (between grids). */
  section: {
    marginTop: 12,
    marginBottom: 12,
  },
  emptySectionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  menuRow: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 10,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
    alignItems: 'center',
  },
  menuGridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 0,
    marginBottom: 10,
    width: '100%',
  },
  menuGridRowLast: {
    marginBottom: 0,
  },
  menuGridCell: {
    width: '48%',
  },
  menuRowLast: {
    marginBottom: 0,
  },
  productGridCard: {
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
  productGridAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    justifyContent: 'center',
  },
  menuRowName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  menuRowDesc: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  menuRowBottom: {
    marginTop: 6,
  },
  menuRowPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuRowImageWrap: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  menuRowImage: {
    width: '100%',
    height: '100%',
  },
  menuRowImageSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiError: {
    padding: 24,
    alignItems: 'center',
  },
  apiErrorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
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
