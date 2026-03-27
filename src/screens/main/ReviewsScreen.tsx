import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getMyOrders, type Order } from '../../api/myorder';
import { getNetworkErrorMessage } from '../../api/apiConfig';
import { getToken } from '../../storagetank';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

/** Terminal success: complete / delivered — not cancelled, not in-progress delivery. */
function isOrderCompleteStatus(status: string | undefined): boolean {
  const s = (status || '').trim().toLowerCase();
  if (!s || s.includes('cancel')) return false;
  if (s === 'complete' || s.includes('completed')) return true;
  if (s.includes('out') && s.includes('deliver')) return false;
  if (s.includes('deliver')) return true;
  return false;
}

function sortOrdersNewestFirst(a: Order, b: Order): number {
  const ta = new Date(a.date || a.createdAt).getTime();
  const tb = new Date(b.date || b.createdAt).getTime();
  return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
}

export default function ReviewsScreen() {
  const navigation = useNavigation<any>();
  const [completeOrders, setCompleteOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setErrorMsg(null);
    const token = await getToken();
    if (!token) {
      setIsAuthenticated(false);
      setCompleteOrders([]);
      setLoading(false);
      return;
    }
    setIsAuthenticated(true);
    try {
      const data = await getMyOrders();
      const all = [...(data.current || []), ...(data.history || [])];
      const filtered = all.filter((o) => isOrderCompleteStatus(o.status)).sort(sortOrdersNewestFirst);
      setCompleteOrders(filtered);
    } catch (e) {
      const msg = getNetworkErrorMessage(e);
      if (msg.includes('Not authenticated')) {
        setIsAuthenticated(false);
        setCompleteOrders([]);
      } else {
        setErrorMsg(msg);
        setCompleteOrders([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadOrders();
    } finally {
      setRefreshing(false);
    }
  };

  const showOrdersHint =
    !loading && isAuthenticated && !errorMsg && completeOrders.length > 0;

  const renderOrderCard = (order: Order) => (
    <Pressable
      key={order.id}
      style={styles.reviewRowCard}
      onPress={() =>
        navigation.navigate('RateYourFeast', {
          orderId: String(order.id),
          items: order.items || '',
          amount: order.amount || '',
        })
      }
    >
      <View style={styles.reviewRowMain}>
        <View style={styles.reviewIconWrap}>
          <Ionicons name="restaurant-outline" size={22} color={GOLD} />
        </View>
        <View style={styles.reviewRowBody}>
          <Text style={styles.reviewItems} numberOfLines={4}>
            {order.items?.trim() || 'Order'}
          </Text>
        </View>
        <Text style={styles.reviewAmount}>{order.amount || '—'}</Text>
      </View>
      <View style={styles.reviewRowFooter}>
        <View style={styles.reviewHintRow}>
          <Ionicons name="star-outline" size={14} color={GOLD} />
          <Text style={styles.reviewHint}>Rate your feast</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={MUTED_TEXT} />
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={BG_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Reviews</Text>
        <View style={styles.headerSpacer} />
      </View>

      {showOrdersHint ? (
        <View
          style={styles.hintCard}
          accessible
          accessibilityLabel="Completed orders. Tap any order below to rate your meal and leave a review."
        >
          <View style={styles.hintIconWrap}>
            <Ionicons name="sparkles" size={22} color={GOLD} />
          </View>
          <View style={styles.hintTextCol}>
            <Text style={styles.hintTitle}>Completed orders</Text>
            <Text style={styles.hintBody}>
              Tap any order below to rate your meal and leave a review.
            </Text>
          </View>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={GOLD} colors={[GOLD]} />
        }
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={GOLD} />
          </View>
        ) : !isAuthenticated ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="person-circle-outline" size={48} color={GOLD} />
            </View>
            <Text style={styles.emptyTitle}>Login required</Text>
            <Text style={styles.emptySubtitle}>Sign in to see orders you can review.</Text>
            <Pressable
              style={styles.loginButton}
              onPress={() => {
                navigation.goBack();
                setTimeout(() => navigateToLoginRegister(), 100);
              }}
            >
              <Text style={styles.loginButtonText}>Login / Register</Text>
            </Pressable>
          </View>
        ) : errorMsg ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Could not load orders</Text>
            <Text style={styles.emptySubtitle}>{errorMsg}</Text>
            <Pressable style={styles.loginButton} onPress={() => void loadOrders()}>
              <Text style={styles.loginButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : completeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="star-outline" size={48} color={GOLD} />
            </View>
            <Text style={styles.emptyTitle}>No completed orders yet</Text>
            <Text style={styles.emptySubtitle}>
              When an order is marked complete or delivered, it will appear here for review.
            </Text>
          </View>
        ) : (
          completeOrders.map(renderOrderCard)
        )}
      </ScrollView>
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
  backButton: {
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
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: HORIZONTAL_PADDING,
    marginTop: 8,
    marginBottom: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.22)',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  hintIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(254,203,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintTextCol: {
    flex: 1,
    minWidth: 0,
  },
  hintTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: TEXT_WHITE,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  hintBody: {
    fontSize: 13,
    fontWeight: '500',
    color: MUTED_TEXT,
    lineHeight: 19,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 4,
    paddingBottom: 32,
  },
  centered: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 8,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(254, 203, 77, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 20,
  },
  loginButton: {
    marginTop: 24,
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  loginButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: BG_DARK,
  },
  reviewRowCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.22)',
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
  },
  reviewRowMain: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reviewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(254,203,77,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewRowBody: {
    flex: 1,
    minWidth: 0,
  },
  reviewItems: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
    lineHeight: 20,
  },
  reviewAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: GOLD,
    marginLeft: 4,
  },
  reviewRowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  reviewHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reviewHint: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED_TEXT,
  },
});
