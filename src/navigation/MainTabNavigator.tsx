import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import DiscoverScreen from '../screens/main/DiscoverScreen';
import MenuScreen from '../screens/main/MenuScreen';
import ContactScreen from '../screens/extra/ContactScreen';
import StoryScreen from '../screens/extra/StoryScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import { startOrdersPolling, stopOrdersPolling, type Order } from '../api/myorder';
import { parseOrderItemLines } from '../api/discoverScreen';
import { getToken } from '../storagetank';
import AsyncStorage from '@react-native-async-storage/async-storage';

const Tab = createBottomTabNavigator();

const TAB_BAR_BG = '#152C29';
const BG_DARK = '#0B1D1B';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.72)';
const TRACKER_DISMISSED_CANCELLED_ORDER_ID_KEY = 'tracker_dismissed_cancelled_order_id';

function normalizeStatus(status: string | undefined): string {
  return (status || '').trim().toLowerCase();
}

function mapStatusToFiveStepIndex(status: string | undefined): number {
  const s = normalizeStatus(status);
  if (s.includes('deliver') && !s.includes('out')) return 4;
  if (s.includes('out') && s.includes('deliver')) return 3;
  if (s.includes('ready')) return 2;
  if (s.includes('prepar')) return 1;
  if (s.includes('pending')) return 0;
  return 0;
}

function getStatusBadgeLabel(status: string | undefined): string {
  const s = normalizeStatus(status);
  if (s.includes('out') && s.includes('deliver')) return 'IN TRANSIT';
  if (s.includes('ready')) return 'READY';
  if (s.includes('prepar')) return 'PREPARING';
  if (s.includes('pending')) return 'ORDER IN PROGRESS';
  if (s.includes('cancel')) return 'CANCELLED';
  return 'ORDER IN PROGRESS';
}

function getExactStatusLabel(status: string | undefined): string {
  const raw = String(status ?? '').trim();
  if (raw) {
    const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return normalized
      .split(' ')
      .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
      .join(' ');
  }
  return 'Pending';
}

function isTrackableStatus(status: string | undefined): boolean {
  const s = normalizeStatus(status);
  if (!s) return false;
  if (s.includes('deliver') && !s.includes('out')) return false; // Delivered
  if (s.includes('complete') || s.includes('completed')) return false; // Completed
  if (s.includes('done') || s.includes('finish')) return false; // Finished
  return true; // Pending/Preparing/Ready/Out for delivery
}

function trackerIconForOrderType(type: string | undefined): React.ComponentProps<typeof Ionicons>['name'] {
  const t = String(type ?? '').trim().toLowerCase();
  if (t.includes('deliver')) return 'bicycle-outline';
  if (t.includes('dine')) return 'restaurant-outline';
  return 'bag-handle-outline';
}

const TRACK_STEPS: { key: string; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'out', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

const CANCELLED_STEP: { key: string; label: string } = { key: 'cancelled', label: 'Cancelled' };
const CANCELLED_COLOR = '#EF4444';

function StatusProgressLine({
  steps,
  activeIndex,
  cancelledKey,
}: {
  steps: { key: string; label: string }[];
  activeIndex: number;
  cancelledKey?: string;
}) {
  const cancelKey = cancelledKey ?? 'cancelled';
  const cancelledActive = steps[activeIndex]?.key === cancelKey;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressRow}>
        {steps.map((step, i) => {
          const reached = activeIndex >= i;
          const segReachedColor = cancelledActive ? CANCELLED_COLOR : GOLD;
          const left =
            i === 0 ? 'transparent' : activeIndex >= i ? segReachedColor : 'rgba(255,255,255,0.14)';
          const right =
            i === steps.length - 1 ? 'transparent' : activeIndex > i ? segReachedColor : 'rgba(255,255,255,0.14)';

          const isCancelStep = step.key === cancelKey;
          const isCurrent = activeIndex === i;
          const dotFill =
            isCancelStep && isCurrent ? CANCELLED_COLOR : reached ? GOLD : 'transparent';
          const borderColor =
            isCancelStep && isCurrent ? CANCELLED_COLOR : reached ? GOLD : 'rgba(255,255,255,0.28)';
          return (
            <View key={step.key} style={styles.progressCol}>
              <View style={styles.trackRow}>
                <View style={[styles.trackSeg, { backgroundColor: left }]} />
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: dotFill, borderColor },
                  ]}
                />
                <View style={[styles.trackSeg, { backgroundColor: right }]} />
              </View>
              <Text
                style={[
                  styles.progressLabel,
                  {
                    color: isCancelStep && isCurrent ? CANCELLED_COLOR : reached ? GOLD : 'rgba(255,255,255,0.34)',
                    fontWeight: isCancelStep && isCurrent ? '800' : undefined,
                  },
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

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BAR_BG,
    height: 80,
    paddingBottom: 5,
    paddingTop: 5,
    paddingLeft: 5,
    paddingRight: 5,
    borderTopWidth: 0,
    position: 'absolute',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerBarWrap: {
    position: 'absolute',
    left: 28,
    right: 28,
    zIndex: 30,
  },
  trackerBar: {
    backgroundColor: GOLD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(11,29,27,0.2)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trackerBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  trackerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(21,44,41,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(21,44,41,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  trackerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: TAB_BAR_BG,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  trackerEta: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  trackBtn: {
    marginLeft: 12,
    backgroundColor: TAB_BAR_BG,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  trackBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: GOLD,
  },
  dismissBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TAB_BAR_BG,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  trackBtnTextCancelled: {
    color: TEXT_WHITE,
  },
  cancelBanner: {
    marginTop: 10,
    marginHorizontal: 14,
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBannerText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,12,11,0.72)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#0F2A27',
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.16)',
    borderBottomWidth: 0,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  modalTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_WHITE,
    textAlign: 'left',
  },
  modalHeaderStatus: {
    fontSize: 12,
    fontWeight: '800',
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  modalEta: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 8,
    textAlign: 'left',
  },
  itemsPanel: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    overflow: 'hidden',
  },
  itemsPanelHeader: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  itemsPanelHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemSingleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  itemSingleRowPressable: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  itemLeftWrap: {
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  modalOrderLineBlock: {
    width: '100%',
  },
  modalItemInstruction: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '600',
    color: MUTED_TEXT,
    lineHeight: 15,
  },
  itemText: {
    color: TEXT_WHITE,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  itemPrice: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '800',
  },
  itemRightWrap: {
    alignItems: 'flex-end',
    marginLeft: 10,
    minWidth: 78,
  },
  itemViewBtn: {
    marginTop: 6,
    backgroundColor: 'rgba(254,203,77,0.14)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemViewBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 0.2,
  },
  progressWrap: {
    paddingVertical: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  progressCol: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 6,
  },
  trackSeg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
  },
  progressLabel: {
    fontSize: 8,
    color: MUTED_TEXT,
    textAlign: 'center',
    lineHeight: 10,
    paddingHorizontal: 1,
  },
  modalItems: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED_TEXT,
  },
  detailsBtn: {
    marginLeft: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: GOLD,
  },
});

export default function MainTabNavigator() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dismissedCancelledOrderId, setDismissedCancelledOrderId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const syncAuthState = async () => {
      const token = await getToken();
      if (!mounted) return;
      const ok = !!token;
      setIsAuthenticated(ok);
      if (!ok) {
        setActiveOrders([]);
        setTrackingOpen(false);
      }
    };

    void syncAuthState();
    const id = setInterval(() => {
      void syncAuthState();
    }, 1200);

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    startOrdersPolling(
      (data) => {
        void (async () => {
          const token = await getToken();
          if (!token) {
            setIsAuthenticated(false);
            setActiveOrders([]);
            setTrackingOpen(false);
            return;
          }
          setIsAuthenticated(true);

          const current = Array.isArray(data.current) ? data.current : [];
          const history = Array.isArray(data.history) ? data.history : [];

          // Some backends move cancelled orders to `history`. Include cancelled orders from both lists
          // so the tracker can turn red even after cancellation.
          const trackableCurrent = current.filter((o) => isTrackableStatus(o.status));
          const trackableCancelledHistory = history.filter((o) => normalizeStatus(o.status).includes('cancel'));

          const trackable = [...trackableCurrent, ...trackableCancelledHistory];

          const sorted = [...trackable].sort((a, b) => {
            const ta = new Date(a.date || a.createdAt).getTime();
            const tb = new Date(b.date || b.createdAt).getTime();
            return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
          });
          setActiveOrders(sorted);
        })();
      },
      () => {
        setIsAuthenticated(false);
        setActiveOrders([]);
        setTrackingOpen(false);
      },
      2000
    );

    return () => {
      stopOrdersPolling();
    };
  }, []);

  const trackerBottom = useMemo(() => 82, []);
  const activeOrder = activeOrders[0] ?? null;
  const hasSingleActiveOrder = activeOrders.length === 1;
  const hasMultipleActiveOrders = activeOrders.length > 1;
  const isCancelled = useMemo(
    () => normalizeStatus(activeOrder?.status).includes('cancel'),
    [activeOrder?.status]
  );
  const shouldHideTrackerBar = useMemo(() => {
    if (!activeOrder) return false;
    if (!isCancelled) return false;
    if (!dismissedCancelledOrderId) return false;
    return String(activeOrder.id) === String(dismissedCancelledOrderId);
  }, [activeOrder, isCancelled, dismissedCancelledOrderId]);
  const activeIndex = useMemo(() => {
    if (isCancelled) return TRACK_STEPS.length; // last index (cancelled)
    return mapStatusToFiveStepIndex(activeOrder?.status);
  }, [activeOrder?.status, isCancelled]);
  const badge = useMemo(() => getStatusBadgeLabel(activeOrder?.status), [activeOrder?.status]);
  const currentStatusLabel = useMemo(
    () => getExactStatusLabel(activeOrder?.status),
    [activeOrder?.status]
  );
  const etaText = useMemo(() => {
    if (!activeOrder) return 'Order in process';
    if (isCancelled) return 'Order cancelled';
    if (normalizeStatus(activeOrder.status).includes('out')) return 'Arriving soon';
    if (normalizeStatus(activeOrder.status).includes('ready')) return 'Ready now';
    return 'Order in process';
  }, [activeOrder, isCancelled]);
  const modalOrderLines = useMemo(() => parseOrderItemLines(activeOrder?.items || ''), [activeOrder?.items]);
  const trackerIconName = useMemo(
    () => trackerIconForOrderType(activeOrder?.type),
    [activeOrder?.type]
  );

  // Guardrail: modal is only for a single active order.
  useEffect(() => {
    if (!hasSingleActiveOrder && trackingOpen) {
      setTrackingOpen(false);
    }
  }, [hasSingleActiveOrder, trackingOpen]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(TRACKER_DISMISSED_CANCELLED_ORDER_ID_KEY)
      .then((v) => {
        if (cancelled) return;
        setDismissedCancelledOrderId(v ? String(v) : null);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // If an order becomes cancelled, ensure the tracking modal is not left open.
  useEffect(() => {
    if (isCancelled) setTrackingOpen(false);
  }, [isCancelled]);

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.label,
          tabBarActiveTintColor: '#FFC107',
          tabBarInactiveTintColor: '#FFFFFF',
          tabBarIcon: ({ color }) => {
            let icon;

            switch (route.name) {
              case 'Discover':
                icon = <FontAwesome5 name="compass" size={20} color={color} />;
                break;
              case 'Menu':
                icon = <MaterialIcons name="menu-book" size={20} color={color} />;
                break;
              case 'Story':
                icon = <Ionicons name="book-outline" size={20} color={color} />;
                break;
              case 'Contact':
                icon = <Ionicons name="chatbubble-outline" size={20} color={color} />;
                break;
              case 'Profile':
                icon = <Ionicons name="person-outline" size={20} color={color} />;
                break;
              default:
                icon = null;
            }

            return <View style={styles.iconContainer}>{icon}</View>;
          },
        })}
      >
        <Tab.Screen name="Discover" component={DiscoverScreen} />
        <Tab.Screen name="Menu" component={MenuScreen} />
        <Tab.Screen name="Story" component={StoryScreen} />
        <Tab.Screen name="Contact" component={ContactScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>

      {isAuthenticated && activeOrder && !shouldHideTrackerBar ? (
        <View pointerEvents="box-none" style={[styles.trackerBarWrap, { bottom: trackerBottom }]}>
          <Pressable
            style={[
              styles.trackerBar,
              isCancelled && {
                backgroundColor: CANCELLED_COLOR,
                borderColor: 'rgba(239,68,68,0.35)',
              },
            ]}
            onPress={() => {
              if (isCancelled) return;
              if (hasMultipleActiveOrders) {
                navigation.navigate('Orders', { initialTab: 'current' });
                return;
              }
              if (hasSingleActiveOrder) {
                setTrackingOpen(true);
              }
            }}
          >
            <View style={styles.trackerBarLeft}>
              <View style={styles.trackerIconWrap}>
                <Ionicons name={trackerIconName} size={18} color={TAB_BAR_BG} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trackerBadgeText}>{badge}</Text>
                <Text style={styles.trackerEta} numberOfLines={1}>
                  {etaText}
                </Text>
              </View>
            </View>
            {!isCancelled ? (
              <View style={styles.trackBtn}>
                <Text style={styles.trackBtnText}>TRACK</Text>
              </View>
            ) : (
              <Pressable
                style={styles.dismissBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  setTrackingOpen(false);
                  if (activeOrder) {
                    const orderId = String(activeOrder.id);
                    setDismissedCancelledOrderId(orderId);
                    AsyncStorage.setItem(TRACKER_DISMISSED_CANCELLED_ORDER_ID_KEY, orderId).catch(() => {});
                  }
                }}
              >
                <Ionicons name="close" size={20} color={TEXT_WHITE} />
              </Pressable>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal
        visible={isAuthenticated && trackingOpen && !!activeOrder && hasSingleActiveOrder}
        transparent
        animationType="slide"
        onRequestClose={() => setTrackingOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTrackingOpen(false)}>
          <Pressable
            style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 10) + 10 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalTop}>
              <View style={styles.modalTopLeft}>
                <Text style={styles.modalTitle}>Order Tracker</Text>
                <Text
                  style={[
                    styles.modalHeaderStatus,
                    isCancelled && { color: CANCELLED_COLOR },
                  ]}
                >
                  {currentStatusLabel}
                </Text>
              </View>
              <Pressable onPress={() => setTrackingOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={TEXT_WHITE} />
              </Pressable>
            </View>
            <Text style={styles.modalEta}>Order Status: {currentStatusLabel}</Text>

            {isCancelled ? (
              <View style={styles.cancelBanner}>
                <Ionicons name="close-circle" size={16} color={CANCELLED_COLOR} />
                <Text style={styles.cancelBannerText}>This order was cancelled.</Text>
              </View>
            ) : null}

            <StatusProgressLine
              steps={isCancelled ? [...TRACK_STEPS, CANCELLED_STEP] : TRACK_STEPS}
              activeIndex={activeIndex}
              cancelledKey="cancelled"
            />

            <View style={styles.itemsPanel}>
              <View style={styles.itemsPanelHeader}>
                <Text style={styles.itemsPanelHeaderText}>
                  {activeOrders.length > 1
                    ? `Orders in progress (${activeOrders.length})`
                    : modalOrderLines.length > 1
                      ? `Order items (${modalOrderLines.length})`
                      : 'Order item'}
                </Text>
              </View>
              {activeOrders.map((order, idx) => {
                const lines = parseOrderItemLines(order.items || '');
                return (
                  <View key={order.id} style={[styles.itemSingleRow, idx > 0 && styles.itemSingleRowPressable]}>
                    <View style={styles.itemLeftWrap}>
                      {lines.map((line, li) => (
                        <View key={`${order.id}-line-${li}`} style={styles.modalOrderLineBlock}>
                          <Text style={styles.itemText} numberOfLines={3}>
                            {line.title} ×{line.quantity}
                          </Text>
                          {line.instruction ? (
                            <Text style={styles.modalItemInstruction} numberOfLines={3}>
                              Instruction: {line.instruction}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                      <Text style={styles.modalItems}>Order #{order.id}</Text>
                    </View>
                    <View style={styles.itemRightWrap}>
                      <Text style={styles.itemPrice}>{order.amount || '—'}</Text>
                      <Pressable
                        style={styles.itemViewBtn}
                        onPress={() => {
                          setTrackingOpen(false);
                          navigation.navigate('ViewOrderDetails', { orderId: String(order.id) });
                        }}
                      >
                        <Text style={styles.itemViewBtnText}>Details</Text>
                        <Ionicons name="chevron-forward" size={14} color={GOLD} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {activeOrders.length === 0 ? (
                <View style={styles.itemSingleRow}>
                  <View style={styles.itemLeftWrap}>
                    <Text style={styles.itemText} numberOfLines={4}>
                      {(modalOrderLines.length > 0
                        ? modalOrderLines.map((l) => `${l.title} ×${l.quantity}`).join(', ')
                        : activeOrder?.items) || 'Your order'}
                    </Text>
                  </View>
                  <Text style={styles.itemPrice}>{activeOrder?.amount || '—'}</Text>
                </View>
              ) : null}
            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
