import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getMyOrders, startOrdersPolling, stopOrdersPolling, type Order } from '../../api/myorder';
import { getNetworkErrorMessage } from '../../api/apiConfig';
import { getToken } from '../../storagetank';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';
import { OrdersScreenSkeleton } from '../../components/skeleton';

const TOAST_DURATION = 2800;

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

type OrderTab = 'current' | 'history';

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [activeTab, setActiveTab] = useState<OrderTab>('current');
  const [currentOrders, setCurrentOrders] = useState<Order[]>([]);
  const [historyOrders, setHistoryOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

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

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  useFocusEffect(
    useCallback(() => {
      const showOrderSuccess = route.params?.showOrderSuccessToast;
      if (showOrderSuccess) {
        showToast('Order placed successfully', 'success');
        navigation.setParams({ showOrderSuccessToast: false });
      }
    }, [route.params?.showOrderSuccessToast, navigation])
  );

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      const startPolling = async () => {
        const token = await getToken();
        if (!token) {
          setIsAuthenticated(false);
          setCurrentOrders([]);
          setHistoryOrders([]);
          setLoading(false);
          return;
        }
        setIsAuthenticated(true);

        startOrdersPolling(
          (data) => {
            if (isMounted) {
              setCurrentOrders(data.current);
              setHistoryOrders(data.history);
              setLoading(false);
            }
          },
          (error) => {
            if (isMounted) {
              console.log('[OrdersScreen] Polling error:', error.message);
              if (error.message.includes('Not authenticated')) {
                setIsAuthenticated(false);
                stopOrdersPolling();
              }
              setLoading(false);
            }
          },
          2000,
        );
      };

      void startPolling();

      return () => {
        isMounted = false;
        stopOrdersPolling();
      };
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      if (!token) {
        setIsAuthenticated(false);
        setCurrentOrders([]);
        setHistoryOrders([]);
        return;
      }
      const response = await getMyOrders();
      setCurrentOrders(response.current);
      setHistoryOrders(response.history);
    } catch (e) {
      const msg = getNetworkErrorMessage(e);
      if (!msg.includes('Not authenticated')) {
        showToast(msg, 'error');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const orders = activeTab === 'current' ? currentOrders : historyOrders;

  const formatDate = (dateStr: string) => {
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
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'pending') return '#F59E0B';
    if (s === 'preparing') return '#3B82F6';
    if (s === 'ready') return '#8B5CF6';
    if (s === 'out for delivery') return '#06B6D4';
    if (s === 'delivered') return '#22C55E';
    if (s === 'cancelled') return '#EF4444';
    return MUTED_TEXT;
  };

  const renderLoginPrompt = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="person-circle-outline" size={48} color={GOLD} />
      </View>
      <Text style={styles.emptyTitle}>Login required</Text>
      <Text style={styles.emptySubtitle}>
        Please sign in to view your orders
      </Text>
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
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons
          name={activeTab === 'current' ? 'receipt-outline' : 'time-outline'}
          size={48}
          color={GOLD}
        />
      </View>
      <Text style={styles.emptyTitle}>
        {activeTab === 'current' ? 'No current orders' : 'No order history'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'current'
          ? 'Your active orders will appear here'
          : 'Your past orders will appear here'}
      </Text>
    </View>
  );

  const renderOrderCard = (order: Order) => (
    <Pressable key={order.id} style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>Order {order.id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(order.status) }]}>
            {order.status}
          </Text>
        </View>
      </View>
      <View style={styles.orderMeta}>
        <View style={styles.orderTypeBadge}>
          <Ionicons
            name={order.type === 'Delivery' ? 'bicycle-outline' : order.type === 'Dine In' ? 'restaurant-outline' : 'bag-handle-outline'}
            size={14}
            color={GOLD}
          />
          <Text style={styles.orderTypeText}>{order.type}</Text>
        </View>
      </View>
      <View style={styles.orderItems}>
        <Text style={styles.orderItemText}>{order.items}</Text>
      </View>
      {order.address && (
        <View style={styles.orderAddressRow}>
          <Ionicons name="location-outline" size={14} color={MUTED_TEXT} />
          <Text style={styles.orderAddressText} numberOfLines={1}>{order.address}</Text>
        </View>
      )}
      <View style={styles.orderFooter}>
        <Text style={styles.orderDate}>{order.date || formatDate(order.createdAt)}</Text>
        <Text style={styles.orderTotal}>{order.amount}</Text>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BG_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>My Orders</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'current' && styles.tabActive]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
            Current Orders
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            History
          </Text>
        </Pressable>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GOLD}
            colors={[GOLD]}
          />
        }
      >
        {loading ? (
          <OrdersScreenSkeleton />
        ) : !isAuthenticated ? (
          renderLoginPrompt()
        ) : orders.length === 0 ? (
          renderEmptyState()
        ) : (
          orders.map(renderOrderCard)
        )}
      </ScrollView>

      {/* Toast */}
      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            { bottom: insets.bottom + 24 },
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
            { opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
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
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 16,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.25)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: 'rgba(254,203,77,0.25)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED_TEXT,
  },
  tabTextActive: {
    color: GOLD,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 8,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
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
  },
  emptySubtitle: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: 'center',
    paddingHorizontal: 40,
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
  orderCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.25)',
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  orderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  orderTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 203, 77, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: GOLD,
  },
  orderItems: {
    marginBottom: 10,
  },
  orderItemText: {
    fontSize: 13,
    color: MUTED_TEXT,
    lineHeight: 18,
  },
  orderAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  orderAddressText: {
    fontSize: 12,
    color: MUTED_TEXT,
    flex: 1,
  },
  orderFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 12,
  },
  orderDate: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: GOLD,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});
