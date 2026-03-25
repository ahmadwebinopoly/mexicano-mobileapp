import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getNetworkErrorMessage } from '../../api/apiConfig';
import {
  getMyOrders,
  startOrdersPolling,
  stopOrdersPolling,
  type MyOrdersResponse,
  type Order,
} from '../../api/myorder';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';

type RouteParams = {
  orderId: string;
};

type StatusStep = { key: string; label: string };

const STATUS_STEPS: StatusStep[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'out for delivery', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
];

function normalizeStatus(status: string | undefined): string {
  return (status || '').trim().toLowerCase();
}

function getStatusIndex(status: string | undefined): number {
  const s = normalizeStatus(status);
  if (s.includes('cancel')) return 5;
  if (s.includes('deliver')) return 4;
  if (s.includes('out') && s.includes('deliver')) return 3;
  if (s.includes('ready')) return 2;
  if (s.includes('prepar')) return 1;
  if (s.includes('pending')) return 0;
  return -1;
}

function getStatusColor(status: string | undefined): string {
  const s = normalizeStatus(status);
  if (s === 'pending' || s.includes('pending')) return '#F59E0B';
  if (s === 'preparing' || s.includes('prepar')) return '#3B82F6';
  if (s === 'ready' || s.includes('ready')) return '#8B5CF6';
  if (s.includes('out') && s.includes('deliver')) return '#06B6D4';
  if (s === 'delivered' || s.includes('deliver')) return '#22C55E';
  if (s === 'cancelled' || s.includes('cancel')) return '#EF4444';
  return '#A3A3A3';
}

function formatDate(dateStr: string) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function ViewOrderDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { orderId } = (route.params || {}) as RouteParams;

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentStepIndex = useMemo(() => getStatusIndex(order?.status), [order?.status]);
  const statusColor = useMemo(() => getStatusColor(order?.status), [order?.status]);
  const orderImageUri = useMemo(() => {
    if (!order) return null;
    const imageValue = (order as Order & { image?: string; imageUrl?: string; itemImage?: string }).image
      || (order as Order & { image?: string; imageUrl?: string; itemImage?: string }).imageUrl
      || (order as Order & { image?: string; imageUrl?: string; itemImage?: string }).itemImage;
    if (!imageValue || typeof imageValue !== 'string') return null;
    const trimmed = imageValue.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, [order]);

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
        2000,
      );

      return () => {
        isMounted = false;
        stopOrdersPolling();
      };
    }, [findOrderInResponse])
  );

  const openInGoogleMaps = () => {
    if (!order?.address) return;
    const url = `https://www.google.com/maps?q=${encodeURIComponent(order.address)}`;
    Linking.openURL(url).catch(() => {});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color={GOLD} />
          <Text style={styles.loadingText}>Loading order…</Text>
        </View>
      </SafeAreaView>
    );
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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color={TEXT_WHITE} />
          </Pressable>
          <Text style={styles.headerTitle}>Order details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order detail</Text>
          <View style={styles.orderDetailsRow}>
            <View style={styles.orderImageWrap}>
              {orderImageUri ? (
                <Image source={{ uri: orderImageUri }} style={styles.orderImage} resizeMode="cover" />
              ) : (
                <View style={styles.orderImagePlaceholder}>
                  <Ionicons name="fast-food-outline" size={22} color={GOLD} />
                </View>
              )}
            </View>
            <View style={styles.orderDetailsTextWrap}>
              <Text style={styles.orderItemName} numberOfLines={2}>
                {order.items || 'Order item'}
              </Text>
              <Text style={styles.orderSub}>{formatDate(order.date || order.createdAt)}</Text>
              <View style={styles.metaPill}>
                <Ionicons
                  name={order.type === 'Delivery' ? 'bicycle-outline' : order.type === 'Dine In' ? 'restaurant-outline' : 'bag-handle-outline'}
                  size={14}
                  color={GOLD}
                />
                <Text style={styles.metaPillText}>{order.type}</Text>
              </View>
            </View>
            <Text style={styles.amountText}>{order.amount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order progress</Text>
          <View style={styles.orderTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.orderTitle}>Order {order.id}</Text>
              <Text style={styles.orderSub}>
                {formatDate(order.date || order.createdAt)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20', borderColor: statusColor + '40' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>{order.status}</Text>
            </View>
          </View>

          <View style={styles.progressWrap}>
            <View style={styles.segmentsRow}>
              {STATUS_STEPS.map((step, idx) => {
                const active = idx <= currentStepIndex;
                return (
                  <View
                    // eslint-disable-next-line react/no-array-index-key
                    key={step.key}
                    style={[styles.segment, active && { backgroundColor: statusColor }]}
                  />
                );
              })}
            </View>
            <View style={styles.labelsRow}>
              {STATUS_STEPS.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                return (
                  <View key={step.key} style={styles.labelWrap}>
                    <Text style={[styles.labelText, isActive && { color: statusColor }]} numberOfLines={1}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order location</Text>
          <Text style={styles.sectionSub}>
            Where we will deliver.
          </Text>

          <View style={styles.addressBlock}>
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={16} color={GOLD} />
              <Text style={styles.addressText}>
                {order.address || '—'}
              </Text>
            </View>

            {order.address ? (
              <Pressable style={styles.secondaryBtn} onPress={openInGoogleMaps}>
                <Ionicons name="map-outline" size={18} color={TEXT_WHITE} />
                <Text style={styles.secondaryBtnText}>Open in Google Maps</Text>
              </Pressable>
            ) : null}
          </View>

          {order.phone ? (
            <View style={styles.detailRow}>
              <Ionicons name="call-outline" size={16} color={MUTED_TEXT} />
              <Text style={styles.detailValue}>{order.phone}</Text>
            </View>
          ) : null}

          {order.notes ? (
            <View style={styles.detailRow}>
              <Ionicons name="document-text-outline" size={16} color={MUTED_TEXT} />
              <Text style={styles.detailValue}>{order.notes}</Text>
            </View>
          ) : null}
        </View>

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
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 14,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.20)',
    padding: 14,
  },
  orderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  orderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  orderSub: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  orderDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  orderImageWrap: {
    width: 66,
    height: 66,
    borderRadius: 12,
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
  orderDetailsTextWrap: {
    flex: 1,
    gap: 6,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  statusBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  progressWrap: {
    marginTop: 14,
    gap: 8,
  },
  segmentsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  labelsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  labelWrap: {
    flex: 1,
  },
  labelText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(254,203,77,0.10)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
    color: GOLD,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginBottom: 12,
  },
  addressBlock: {
    backgroundColor: 'rgba(21,44,41,0.65)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    color: TEXT_WHITE,
    lineHeight: 18,
  },
  secondaryBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  secondaryBtnText: {
    color: TEXT_WHITE,
    fontSize: 12,
    fontWeight: '700',
  },
  detailRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailValue: {
    color: TEXT_WHITE,
    fontSize: 13,
    flex: 1,
  },
  bottomSpacer: {
    height: 16,
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

