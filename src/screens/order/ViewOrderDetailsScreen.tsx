import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebView = require('react-native-webview').WebView;
import { getApiBaseUrl, getNetworkErrorMessage } from '../../api/apiConfig';
import { getVisit, type VisitLocation } from '../../api/content';
import {
  getMyOrders,
  startOrdersPolling,
  stopOrdersPolling,
  type MyOrdersResponse,
  type Order,
} from '../../api/myorder';
import { getAddress, type Address } from '../../api/saveadresss';
import {
  getCachedMenuItems,
  getMenuItemImageUrlString,
  getMenuItems,
  parseMenuItemsFromApiJson,
  type MenuItem,
} from '../../api/Menu';
import { ViewOrderDetailsScreenSkeleton } from '../../components/skeleton';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 220;
const MAP_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;

type RouteParams = {
  orderId: string;
};

function normalizeStatus(status: string | undefined): string {
  return (status || '').trim().toLowerCase();
}

/** Active order: Pending → … → Delivered (indices 0–4). Cancelled is not shown in the bar until the order is cancelled. */
function mapStatusToFiveStepIndex(status: string | undefined): number {
  const s = normalizeStatus(status);
  if (s.includes('deliver') && !s.includes('out')) return 4;
  if (s.includes('out') && s.includes('deliver')) return 3;
  if (s.includes('ready')) return 2;
  if (s.includes('prepar')) return 1;
  if (s.includes('pending')) return 0;
  return 0;
}

function getStatusColor(status: string | undefined): string {
  const s = normalizeStatus(status);
  if (s === 'pending' || s.includes('pending')) return '#F59E0B';
  if (s === 'preparing' || s.includes('prepar')) return '#3B82F6';
  if (s === 'ready' || s.includes('ready')) return '#8B5CF6';
  if (s.includes('out') && s.includes('deliver')) return '#06B6D4';
  if (s === 'delivered' || (s.includes('deliver') && !s.includes('out'))) return '#22C55E';
  if (s === 'cancelled' || s.includes('cancel')) return '#EF4444';
  return '#A3A3A3';
}

function parseToDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
    const n = Number(trimmed);
    if (!Number.isNaN(n)) {
      const ms = n < 1e12 ? n * 1000 : n;
      const d2 = new Date(ms);
      if (!Number.isNaN(d2.getTime())) return d2;
    }
  }
  return null;
}

function formatOrderDateTime(order: Order): string {
  const o = order as Order & {
    updatedAt?: string;
    created_at?: string;
    orderDate?: string;
    timestamp?: number;
  };
  const candidates: unknown[] = [
    o.createdAt,
    o.date,
    o.updatedAt,
    o.created_at,
    o.orderDate,
    o.timestamp,
  ];
  for (const raw of candidates) {
    const d = parseToDate(raw);
    if (d) {
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  return '—';
}

/** Shorter date/time for compact header row. */
function formatOrderPlacedCompact(order: Order): string {
  const o = order as Order & { updatedAt?: string; created_at?: string; orderDate?: string; timestamp?: number };
  const candidates: unknown[] = [o.createdAt, o.date, o.updatedAt, o.created_at, o.orderDate, o.timestamp];
  for (const raw of candidates) {
    const d = parseToDate(raw);
    if (d) {
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
  }
  return '—';
}

function asNonEmptyString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

function imageFromObject(v: unknown): string | null {
  if (!v || typeof v !== 'object') return null;
  const obj = v as Record<string, unknown>;
  return asNonEmptyString(obj.url) || asNonEmptyString(obj.uri) || asNonEmptyString(obj.path);
}

function normalizeImageUri(raw: string, apiBase: string): string {
  const s = raw.trim();
  if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  const base = apiBase.replace(/\/+$/, '');
  if (s.startsWith('/')) return `${base}${s}`;
  return `${base}/${s.replace(/^\/+/, '')}`;
}

function resolveOrderImageUri(order: Order): string | null {
  const apiBase = getApiBaseUrl();
  const o = order as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    o.image,
    o.imageUrl,
    o.itemImage,
    o.productImage,
    o.thumbnail,
    o.thumbnailUrl,
    o.menuItemImage,
    o.item_image,
    o.product_image,
  ];
  for (const c of candidates) {
    const str = asNonEmptyString(c) || imageFromObject(c);
    if (str) return normalizeImageUri(str, apiBase);
  }
  return null;
}

function formatRestaurantAddress(loc: VisitLocation | null): string {
  if (!loc) return '—';
  const line2 = [loc.city, loc.state, loc.zip].filter((x) => x && String(x).trim()).join(', ');
  const parts = [loc.address, line2].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

function isDeliveryOrder(order: Order): boolean {
  const t = (order.type || '').trim();
  return t === 'Delivery' || t.toLowerCase() === 'delivery';
}

/** Same line as Checkout / AddressScreen: street + city + state + zip */
function formatSavedAddressLine(addr: Address | null): string {
  if (!addr || !String(addr.address || '').trim()) return '';
  const parts = [addr.address, addr.city, addr.state, addr.zipCode].filter((x) => x && String(x).trim());
  return parts.join(', ');
}

const FIVE_STATUS_STEPS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'out', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const CANCELLED_STEP: { key: string; label: string } = { key: 'cancelled', label: 'Cancelled' };

/** Segments like "Burrito (extras) x2" — split on `, ` like checkout join. */
function parseOrderItemSegments(items: string): string[] {
  if (!items?.trim()) return [];
  return items
    .split(/,\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s*x\d+\s*$/i, '').trim())
    .filter(Boolean);
}

/** Compare order line text to menu names (spacing / punctuation tolerant). */
function normalizeMatchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Match order lines to GET /api/menu/items — uses same image fields as MenuScreen after Menu.ts coalesce fix. */
function resolveImageFromMenuItems(orderItemsText: string, menu: MenuItem[]): string | null {
  const apiBase = getApiBaseUrl();
  if (!menu.length) return null;
  const segments = parseOrderItemSegments(orderItemsText);
  const lineCandidates: string[] = [];
  for (const seg of segments) {
    lineCandidates.push(seg.split('(')[0].trim(), seg.trim());
  }
  for (const line of lineCandidates) {
    const key = normalizeMatchKey(line);
    if (!key) continue;
    for (const m of menu) {
      const nameKey = normalizeMatchKey(m.name || '');
      if (!nameKey) continue;
      const exact = key === nameKey;
      const contains = key.includes(nameKey) || nameKey.includes(key);
      const prefix = key.startsWith(nameKey) || nameKey.startsWith(key);
      if (exact || contains || prefix) {
        const raw = getMenuItemImageUrlString(m);
        if (raw) return normalizeImageUri(raw, apiBase);
      }
    }
  }
  return null;
}

function splitItemsSummary(items: string): string[] {
  if (!items || !items.trim()) return [];
  return items
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildMapHtml(embedUrl: string): string {
  const safe = embedUrl.replace(/"/g, '&quot;');
  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #0B1D1B; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe src="${safe}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
</body>
</html>
`.trim();
}

type ProgressStep = { key: string; label: string };

/** Dots align with labels: each step is a column (track + label). */
function StatusProgressLine({
  steps,
  activeIndex,
}: {
  steps: ProgressStep[];
  activeIndex: number;
}) {
  const lineColor = 'rgba(255,255,255,0.14)';
  const gold = GOLD;
  const cancelColor = '#EF4444';
  const n = steps.length;

  return (
    <View style={progressStyles.wrap}>
      <View style={progressStyles.stepsRow}>
        {steps.map((step, i) => {
          const isCancelStep = step.key === 'cancelled';
          const reached = activeIndex >= i;
          const isCurrent = activeIndex === i;
          const dotFill = isCancelStep && isCurrent ? cancelColor : reached ? gold : 'transparent';
          const borderCol =
            isCancelStep && isCurrent ? cancelColor : reached ? gold : 'rgba(255,255,255,0.28)';
          const segLeftColor = i === 0 ? 'transparent' : activeIndex >= i ? gold : lineColor;
          const segRightColor = i === n - 1 ? 'transparent' : activeIndex > i ? gold : lineColor;

          return (
            <View key={step.key} style={progressStyles.stepColumn}>
              <View style={progressStyles.trackRow}>
                <View style={[progressStyles.trackSeg, { backgroundColor: segLeftColor }]} />
                <View
                  style={[
                    progressStyles.dot,
                    {
                      backgroundColor: dotFill,
                      borderColor: borderCol,
                    },
                  ]}
                />
                <View style={[progressStyles.trackSeg, { backgroundColor: segRightColor }]} />
              </View>
              <Text
                style={[
                  progressStyles.stepLabel,
                  !reached && { color: 'rgba(255,255,255,0.32)' },
                  reached && !isCurrent && { color: 'rgba(254,203,77,0.55)' },
                  isCurrent && !isCancelStep && { color: GOLD, fontWeight: '700' },
                  isCurrent && isCancelStep && { color: cancelColor, fontWeight: '700' },
                ]}
                numberOfLines={2}
              >
                {step.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const progressStyles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    paddingVertical: 6,
    minHeight: 72,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepColumn: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 8,
  },
  trackSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    minHeight: 3,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  stepLabel: {
    fontSize: 8,
    color: MUTED_TEXT,
    textAlign: 'center',
    lineHeight: 10,
    width: '100%',
    paddingHorizontal: 1,
  },
});

export default function ViewOrderDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = (route.params || {}) as RouteParams;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderImageFailed, setOrderImageFailed] = useState(false);
  const [menuResolvedImageUri, setMenuResolvedImageUri] = useState<string | null>(null);
  const [restaurantLocation, setRestaurantLocation] = useState<VisitLocation | null>(null);
  /** Default saved address (My Addresses) — enriches delivery map/text when order snapshot is missing; same API as AddressScreen */
  const [savedDefaultAddress, setSavedDefaultAddress] = useState<Address | null>(null);

  const displayImageUri = useMemo(() => {
    if (menuResolvedImageUri) return menuResolvedImageUri;
    if (order?.items?.trim()) {
      const cached = getCachedMenuItems();
      if (cached?.length) {
        const fromCache = resolveImageFromMenuItems(order.items, cached);
        if (fromCache) return fromCache;
      }
    }
    return order ? resolveOrderImageUri(order) : null;
  }, [order, menuResolvedImageUri]);

  const statusColor = useMemo(() => getStatusColor(order?.status), [order?.status]);
  const delivery = order ? isDeliveryOrder(order) : true;
  const cancelled = useMemo(
    () => normalizeStatus(order?.status).includes('cancel'),
    [order?.status]
  );
  const fiveStepIndex = useMemo(() => mapStatusToFiveStepIndex(order?.status), [order?.status]);
  const progressSteps = useMemo(
    () => (cancelled ? [...FIVE_STATUS_STEPS, CANCELLED_STEP] : FIVE_STATUS_STEPS),
    [cancelled]
  );
  const progressActiveIndex = useMemo(
    () => (cancelled ? FIVE_STATUS_STEPS.length : fiveStepIndex),
    [cancelled, fiveStepIndex]
  );

  const deliveryAddressLine = useMemo(() => {
    const fromOrder = order?.address?.trim();
    if (fromOrder) return fromOrder;
    const fromSaved = formatSavedAddressLine(savedDefaultAddress);
    return fromSaved || '—';
  }, [order?.address, savedDefaultAddress]);

  const mapEmbedUrl = useMemo(() => {
    if (!order) return '';
    if (delivery) {
      const line = order.address?.trim() || formatSavedAddressLine(savedDefaultAddress);
      if (line) {
        return `https://maps.google.com/maps?q=${encodeURIComponent(line)}&output=embed`;
      }
      if (savedDefaultAddress != null && Number.isFinite(savedDefaultAddress.latitude) && Number.isFinite(savedDefaultAddress.longitude)) {
        const { latitude: lat, longitude: lng } = savedDefaultAddress;
        return `https://maps.google.com/maps?q=${lat},${lng}&output=embed`;
      }
      return 'https://maps.google.com/maps?q=Mexicano+restaurant&output=embed';
    }
    if (restaurantLocation?.mapsUrl) {
      return restaurantLocation.mapsUrl;
    }
    const addr = formatRestaurantAddress(restaurantLocation);
    if (addr && addr !== '—') {
      return `https://maps.google.com/maps?q=${encodeURIComponent(addr)}&output=embed`;
    }
    return 'https://maps.google.com/maps?q=Mexicano+restaurant&output=embed';
  }, [order, delivery, restaurantLocation, savedDefaultAddress]);

  const mapHtml = useMemo(() => buildMapHtml(mapEmbedUrl), [mapEmbedUrl]);

  useEffect(() => {
    setOrderImageFailed(false);
  }, [order?.id, displayImageUri]);

  useEffect(() => {
    if (!order?.items?.trim()) {
      setMenuResolvedImageUri(null);
      return;
    }
    let aborted = false;
    void (async () => {
      try {
        const base = getApiBaseUrl();
        let menu: MenuItem[] = [];
        try {
          menu = await getMenuItems();
        } catch {
          const res = await fetch(`${base.replace(/\/+$/, '')}/api/menu/items`);
          const text = await res.text();
          if (!res.ok) throw new Error(text || String(res.status));
          let json: unknown = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = null;
          }
          menu = parseMenuItemsFromApiJson(json);
        }
        if (aborted) return;
        const uri = resolveImageFromMenuItems(order.items, menu);
        setMenuResolvedImageUri(uri);
      } catch {
        if (!aborted) setMenuResolvedImageUri(null);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [order?.id, order?.items]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const visit = await getVisit();
        if (mounted) setRestaurantLocation(visit.location);
      } catch {
        if (mounted) setRestaurantLocation(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Delivery: load default address (same as AddressScreen / checkout) for map + display fallback
  useFocusEffect(
    useCallback(() => {
      if (!order || !isDeliveryOrder(order)) {
        setSavedDefaultAddress(null);
        return;
      }
      let cancelled = false;
      void (async () => {
        try {
          const a = await getAddress();
          if (!cancelled) setSavedDefaultAddress(a);
        } catch {
          if (!cancelled) setSavedDefaultAddress(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [order?.id, order?.type])
  );

  const findOrderInResponse = useCallback(
    (data: MyOrdersResponse): Order | null => {
      const all = [...(data.current || []), ...(data.history || [])];
      const found = all.find((o) => String(o.id) === String(orderId));
      return found || null;
    },
    [orderId]
  );

  useEffect(() => {
    let isMounted = true;
    const bootstrap = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const data = await getMyOrders();
        if (!isMounted) return;
        setOrder(findOrderInResponse(data));
      } catch (e) {
        if (!isMounted) return;
        setErrorMsg(getNetworkErrorMessage(e));
        setOrder(null);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, [findOrderInResponse]);

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      setErrorMsg(null);

      startOrdersPolling(
        (data) => {
          if (!isMounted) return;
          const found = findOrderInResponse(data);
          setOrder(found);
          setLoading(false);
        },
        (error) => {
          if (!isMounted) return;
          setLoading(false);
          setErrorMsg(error.message);
          setOrder(null);
        },
        2000
      );

      return () => {
        isMounted = false;
        stopOrdersPolling();
      };
    }, [findOrderInResponse])
  );

  const openMapExternal = useCallback(() => {
    const url = mapEmbedUrl.replace(/&output=embed/, '');
    Linking.openURL(url).catch(() => {});
  }, [mapEmbedUrl]);

  const openAddressMaps = useCallback(() => {
    if (!order) return;
    if (delivery) {
      const line = order.address?.trim() || formatSavedAddressLine(savedDefaultAddress);
      if (line) {
        Linking.openURL(`https://www.google.com/maps?q=${encodeURIComponent(line)}`).catch(() => {});
        return;
      }
      if (savedDefaultAddress != null && Number.isFinite(savedDefaultAddress.latitude) && Number.isFinite(savedDefaultAddress.longitude)) {
        const { latitude, longitude } = savedDefaultAddress;
        Linking.openURL(`https://www.google.com/maps?q=${latitude},${longitude}`).catch(() => {});
      }
      return;
    }
    const q = formatRestaurantAddress(restaurantLocation);
    if (!q || q === '—') return;
    Linking.openURL(`https://www.google.com/maps?q=${encodeURIComponent(q)}`).catch(() => {});
  }, [order, delivery, restaurantLocation, savedDefaultAddress]);

  if (loading) {
    return <ViewOrderDetailsScreenSkeleton />;
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorTitle}>Could not load order</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <Text style={styles.errorTitle}>Order not found</Text>
          <Text style={styles.errorText}>This order may have been removed.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const itemLines = splitItemsSummary(order.items || '');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={18} color={TEXT_WHITE} />
          </Pressable>
          <Text style={styles.headerTitle}>Order status</Text>
          <Pressable style={styles.headerIconBtn} hitSlop={8} accessibilityLabel="Help">
            <Ionicons name="help-circle-outline" size={20} color={TEXT_WHITE} />
          </Pressable>
        </View>

        {cancelled ? (
          <View style={styles.cancelBanner}>
            <Ionicons name="close-circle" size={16} color="#FCA5A5" />
            <Text style={styles.cancelBannerText}>This order was cancelled.</Text>
          </View>
        ) : null}

        {/* Compact: placed time */}
        <View style={styles.compactTimeCard}>
          <Text style={styles.placedLine}>
            <Text style={styles.placedLabel}>Placed </Text>
            <Text style={styles.placedValue}>{formatOrderPlacedCompact(order)}</Text>
          </Text>
        </View>

        {/* Order summary — directly under placed time */}
        <View style={styles.cardCompact}>
          <Text style={styles.sectionTitle}>Order summary</Text>
          <View style={styles.summaryHeroRow}>
            <View style={styles.orderImageWrap}>
              {displayImageUri && !orderImageFailed ? (
                <Image
                  key={displayImageUri}
                  source={{ uri: displayImageUri }}
                  style={styles.orderImage}
                  resizeMode="cover"
                  onError={() => setOrderImageFailed(true)}
                />
              ) : (
                <View style={styles.orderImagePlaceholder}>
                  <Ionicons name="fast-food-outline" size={22} color={GOLD} />
                </View>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.orderItemTitle} numberOfLines={3}>
                {order.items || 'Your order'}
              </Text>
              <View style={styles.typePillSmall}>
                <Ionicons
                  name={
                    order.type === 'Delivery'
                      ? 'bicycle-outline'
                      : order.type === 'Dine In'
                        ? 'restaurant-outline'
                        : 'bag-handle-outline'
                  }
                  size={11}
                  color={GOLD}
                />
                <Text style={styles.typePillSmallText}>{order.type}</Text>
              </View>
            </View>
            <Text style={styles.amountLarge}>{order.amount}</Text>
          </View>

          {itemLines.length > 1 ? (
            <View style={styles.lineItems}>
              {itemLines.map((line, idx) => (
                <View key={`${idx}-${line.slice(0, 24)}`} style={styles.lineItemRow}>
                  <Text style={styles.lineItemBullet}>•</Text>
                  <Text style={styles.lineItemText}>{line}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{order.amount}</Text>
          </View>
        </View>

        {/* Progress — 5 steps; Cancelled column only when order is cancelled */}
        <View style={styles.cardCompact}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>Progress</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '55' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
            </View>
          </View>
          <StatusProgressLine steps={progressSteps} activeIndex={progressActiveIndex} />
        </View>

        {/* Location */}
        <View style={styles.cardCompact}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="location-outline" size={16} color={GOLD} />
            <Text style={styles.sectionTitleInline}>
              {delivery ? 'Delivery address' : 'Restaurant location'}
            </Text>
          </View>
          <Text style={styles.sectionSub}>
            {delivery ? 'Where we’re bringing your order.' : 'Pick up or dine at our location.'}
          </Text>
          {delivery ? (
            <Text style={styles.addressBlockText}>{deliveryAddressLine}</Text>
          ) : (
            <>
              {restaurantLocation?.name ? (
                <Text style={styles.restaurantName}>{restaurantLocation.name}</Text>
              ) : null}
              <Text style={styles.addressBlockText}>{formatRestaurantAddress(restaurantLocation)}</Text>
            </>
          )}
          <Pressable style={styles.editMapBtn} onPress={openAddressMaps}>
            <Text style={styles.editMapBtnText}>Open in Google Maps</Text>
            <Ionicons name="chevron-forward" size={14} color={GOLD} />
          </Pressable>
        </View>

        {/* Map */}
        <View style={styles.mapSection}>
          <View style={styles.mapHeader}>
            <Text style={styles.mapTitle}>{delivery ? 'Map' : 'Restaurant map'}</Text>
            <View style={styles.liveBadge}>
              <Ionicons name="navigate-outline" size={12} color={GOLD} />
              <Text style={styles.liveBadgeText}>{delivery ? 'Delivery' : 'Pickup'}</Text>
            </View>
          </View>
          <View style={styles.mapContainer}>
            <WebView
              source={{ html: mapHtml }}
              style={[styles.mapWebView, { width: MAP_WIDTH, height: MAP_HEIGHT }]}
              javaScriptEnabled
              domStorageEnabled
              originWhitelist={['*']}
              mixedContentMode="compatibility"
              scrollEnabled={false}
            />
          </View>
          <Pressable style={styles.viewLargerMap} onPress={openMapExternal}>
            <Text style={styles.viewLargerMapText}>View larger map</Text>
          </Pressable>
        </View>

        {order.notes ? (
          <View style={styles.cardCompact}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{order.notes}</Text>
          </View>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_WHITE,
    letterSpacing: 0.3,
  },
  cancelBanner: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  cancelBannerText: {
    color: '#FCA5A5',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  compactTimeCard: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.15)',
  },
  placedLine: {
    fontSize: 12,
    lineHeight: 16,
  },
  placedLabel: {
    color: MUTED_TEXT,
    fontWeight: '600',
  },
  placedValue: {
    color: TEXT_WHITE,
    fontWeight: '700',
  },
  cardCompact: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.15)',
    padding: 12,
  },
  card: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.18)',
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitleInline: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_WHITE,
  },
  sectionSub: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginBottom: 8,
    lineHeight: 18,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  addressBlockText: {
    fontSize: 14,
    color: TEXT_WHITE,
    lineHeight: 22,
    fontWeight: '600',
  },
  restaurantName: {
    fontSize: 15,
    fontWeight: '800',
    color: GOLD,
    marginBottom: 6,
  },
  editMapBtn: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editMapBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  mapSection: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 16,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  mapTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_WHITE,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254,203,77,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.35)',
  },
  liveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  mapContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#0a1614',
  },
  mapWebView: {
    alignSelf: 'center',
  },
  viewLargerMap: {
    marginTop: 10,
    alignItems: 'center',
  },
  viewLargerMapText: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
  },
  summaryHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 8,
  },
  orderImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  orderImage: {
    width: '100%',
    height: '100%',
  },
  orderImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
    lineHeight: 20,
  },
  typePillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: 'rgba(254,203,77,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typePillSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: GOLD,
  },
  amountLarge: {
    fontSize: 17,
    fontWeight: '800',
    color: GOLD,
  },
  lineItems: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  lineItemBullet: {
    color: MUTED_TEXT,
    fontSize: 14,
  },
  lineItemText: {
    flex: 1,
    fontSize: 13,
    color: MUTED_TEXT,
    lineHeight: 18,
  },
  totalRow: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(254,203,77,0.25)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_WHITE,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: GOLD,
  },
  notesLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED_TEXT,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notesText: {
    fontSize: 14,
    color: TEXT_WHITE,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 24,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 12,
  },
  loadingText: {
    color: TEXT_WHITE,
    fontSize: 13,
    fontWeight: '700',
  },
  errorTitle: {
    color: TEXT_WHITE,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  errorText: {
    color: MUTED_TEXT,
    fontSize: 13,
    textAlign: 'center',
  },
  primaryBtn: {
    marginTop: 10,
    backgroundColor: GOLD,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: BG_DARK,
    fontSize: 13,
    fontWeight: '800',
  },
});
