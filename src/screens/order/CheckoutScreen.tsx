import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { CardField, confirmPayment, initStripe, type CardFieldInput } from '@stripe/stripe-react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyDiscount } from '../../api/discounts';
import { placeOrder } from '../../api/orders';
import { getAppCurrency, getNetworkErrorMessage } from '../../api/apiConfig';
import { useCart, type CartItem } from '../../contexts/CartContext';
import { getCurrentUser } from '../../api/profile';
import { getAddress } from '../../api/saveadresss';
import { createPaymentIntent, getStripeConfig, verifyStripePaymentSuccess } from '../../api/stripe';
import { getOrderModes } from '../../api/orderModes';
import { CheckoutScreenSkeleton } from '../../components/skeleton';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const SEARCH_BG = '#1F403C';
/** Shared surface for cardholder + Stripe CardField — sits above BG_DARK so fields read as one layer. */
const STRIPE_FIELD_SURFACE = '#122722';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

type OrderMode = 'delivery' | 'dining' | 'takeaway' | null;
const ONBOARDING_ORDER_MODE_KEY = 'onboarding_order_mode';

/** Read mode saved by OnBoardingScreen — must be fresh at place-order time (avoid default 'delivery' race). */
async function readOrderModeFromStorage(): Promise<'delivery' | 'dining' | 'takeaway'> {
  try {
    const saved = await AsyncStorage.getItem(ONBOARDING_ORDER_MODE_KEY);
    if (saved === 'delivery' || saved === 'dining' || saved === 'takeaway') {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return 'delivery';
}

function formatPrice(price: string): string {
  if (price == null || String(price).trim() === '') return '$0.00';
  const p = String(price).trim();
  return p.startsWith('$') ? p : `$${p}`;
}

function parsePrice(p: string): number {
  return parseFloat(String(p).replace(/[$,]/g, '')) || 0;
}

function parsePositiveNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function getLineTotal(item: CartItem): number {
  const addonsList = Array.isArray(item.addons) ? item.addons : [];
  const main = parsePrice(item.price) * item.quantity;
  const addonsSum = addonsList.reduce((sum, ad) => sum + parsePrice(ad.price) * item.quantity, 0);
  return main + addonsSum;
}

function getAddonsSubtitle(item: CartItem): string {
  const addons = Array.isArray(item.addons) ? item.addons : [];
  if (addons.length === 0) return '';
  const names = addons.map((a) => (a.name && String(a.name).trim()) || a.id || '').filter(Boolean);
  return names.length > 0 ? names.join(', ') : '';
}

function formatItemsForOrder(items: CartItem[]): string {
  return items
    .map((item) => {
      const addons = getAddonsSubtitle(item);
      const base = item.name + (addons ? ` (${addons})` : '');
      const instruction = String(item.instructions ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      return `${base} x${item.quantity}${instruction ? ` [Notes: ${instruction}]` : ''}`;
    })
    .join(', ');
}

function formatAddress(addr: { address?: string; city?: string; state?: string; zipCode?: string } | null): string {
  if (!addr || !addr.address) return '';
  const parts = [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean);
  return parts.join(', ');
}

function normalizeOrderErrorMessage(error: unknown): string {
  const raw = getNetworkErrorMessage(error);
  const text = String(raw ?? '').trim();

  // Sometimes backend message is returned as raw JSON string:
  // {"message":"Delivery radius is disabled by admin"}
  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown };
    const backendMsg =
      (typeof parsed.message === 'string' && parsed.message.trim()) ||
      (typeof parsed.error === 'string' && parsed.error.trim()) ||
      '';
    if (backendMsg) {
      if (/delivery radius.*disabled.*admin/i.test(backendMsg)) {
        return 'Delivery is currently unavailable. Please choose Pick-up or Dining.';
      }
      return backendMsg;
    }
  } catch {
    // raw text is not JSON; continue below
  }

  if (/delivery radius.*disabled.*admin/i.test(text)) {
    return 'Delivery is currently unavailable. Please choose Pick-up or Dining.';
  }

  return text || 'Order failed. Please try again.';
}

type PaymentMethod = 'cod' | 'stripe';

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const appCurrency = useMemo(() => getAppCurrency(), []);
  const { items, clearCart, total } = useCart();
  const [placing, setPlacing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginModalDismissed, setLoginModalDismissed] = useState(false);
  const [notes, setNotes] = useState('');
  const [discountCode, setDiscountCode] = useState('');
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountApplying, setDiscountApplying] = useState(false);
  const [discountPreview, setDiscountPreview] = useState<{
    finalAmount: number;
    discountAmount: number;
    subtotalAtApply: number;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cardholderName, setCardholderName] = useState('');
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [orderMode, setOrderMode] = useState<OrderMode>(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  /** Extra bottom padding while keyboard is open so Stripe CardField + inputs scroll above the keyboard. */
  const [keyboardBottomInset, setKeyboardBottomInset] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: { endCoordinates: { height: number } }) =>
      setKeyboardBottomInset(e.endCoordinates.height);
    const onHide = () => setKeyboardBottomInset(0);
    const subShow = Keyboard.addListener(showEvt, onShow);
    const subHide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
  }, []);

  const loadOrderMode = React.useCallback(async () => {
    const mode = await readOrderModeFromStorage();
    setOrderMode(mode);
  }, []);

  // Load selected service option (delivery / dining / takeaway) from onboarding.
  useEffect(() => {
    void loadOrderMode();
  }, [loadOrderMode]);

  // Re-read when returning to checkout so mode matches onboarding (e.g. after app resume).
  useFocusEffect(
    React.useCallback(() => {
      void loadOrderMode();
    }, [loadOrderMode])
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const modes = await getOrderModes();
        if (cancelled) return;
        const fee = parsePositiveNumber(modes.deliveryFee);
        setDeliveryFee(fee ?? 0);
      } catch {
        if (!cancelled) setDeliveryFee(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toast, toastOpacity]);

  const checkAuth = async () => {
    setAuthChecking(true);
    const user = await getCurrentUser();
    setAuthChecking(false);
    setIsLoggedIn(!!user);
  };

  useFocusEffect(
    React.useCallback(() => {
      checkAuth();
      setLoginModalDismissed(false);
    }, [])
  );

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const cartSubtotal = Number(total.toFixed(2));
  const discountPreviewValid = useMemo(() => {
    if (!discountApplied || !discountPreview || !discountCode.trim()) return false;
    return Math.abs(discountPreview.subtotalAtApply - cartSubtotal) < 0.005;
  }, [discountApplied, discountPreview, discountCode, cartSubtotal]);

  const orderToCharge = useMemo(() => {
    if (!discountPreviewValid || !discountPreview) return cartSubtotal;
    return Math.max(0, discountPreview.finalAmount);
  }, [discountPreviewValid, discountPreview, cartSubtotal]);

  const effectiveDeliveryFee = useMemo(() => {
    return orderMode === 'delivery' ? deliveryFee : 0;
  }, [orderMode, deliveryFee]);

  const payableTotal = useMemo(() => {
    return Math.max(0, orderToCharge + effectiveDeliveryFee);
  }, [orderToCharge, effectiveDeliveryFee]);

  useEffect(() => {
    if (!discountPreview) return;
    if (Math.abs(discountPreview.subtotalAtApply - cartSubtotal) > 0.005) {
      setDiscountApplied(false);
      setDiscountPreview(null);
    }
  }, [cartSubtotal, discountPreview]);

  const handleApplyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) {
      showToast('Enter a discount code', 'error');
      return;
    }
    if (!isLoggedIn) {
      showToast('Sign in to apply a discount code', 'error');
      return;
    }
    setDiscountApplying(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        showToast('Sign in to apply a discount code', 'error');
        return;
      }
      const sub = total.toFixed(2);
      const result = await applyDiscount({
        code,
        subtotal: sub,
        currency: appCurrency,
        customerId: user.id,
      });
      const subNum = parseFloat(sub);
      setDiscountPreview({
        finalAmount: result.finalAmount,
        discountAmount: result.discountAmount,
        subtotalAtApply: subNum,
      });
      setDiscountApplied(true);
      Keyboard.dismiss();
      showToast('Discount applied', 'success');
    } catch (err) {
      setDiscountApplied(false);
      setDiscountPreview(null);
      showToast(getNetworkErrorMessage(err), 'error');
    } finally {
      setDiscountApplying(false);
    }
  };

  const ensureStripeIsReady = async () => {
    if (stripeReady) return;
    if (loadingStripe) return;

    setLoadingStripe(true);
    try {
      const config = await getStripeConfig();
      if (!config.configured || !config.publishableKey) {
        throw new Error('Stripe is not configured right now. Please choose Cash on Delivery.');
      }
      await initStripe({
        publishableKey: config.publishableKey,
      });
      setStripeReady(true);
    } finally {
      setLoadingStripe(false);
    }
  };

  useEffect(() => {
    if (paymentMethod !== 'stripe' || stripeReady || loadingStripe) return;
    void ensureStripeIsReady().catch((err) => {
      const message = err instanceof Error ? err.message : 'Unable to initialize Stripe.';
      showToast(message, 'error');
    });
  }, [loadingStripe, paymentMethod, stripeReady]);

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      Alert.alert('Empty cart', 'Add items to your cart first.');
      return;
    }

    if (!isLoggedIn) {
      Alert.alert('Login required', 'Please sign in to place an order.');
      return;
    }

    if (paymentMethod === null) {
      Alert.alert('Payment method', 'Please select how you would like to pay.');
      return;
    }

    if (paymentMethod === 'stripe') {
      const nameTrim = cardholderName.trim();
      if (!nameTrim) {
        Alert.alert('Card details', 'Please enter the cardholder name.');
        return;
      }
      if (!cardDetails?.complete) {
        Alert.alert('Card details', 'Please enter valid card details. Test card: 4242 4242 4242 4242');
        return;
      }
    }

    // Capture before any await — avoids wrong method if state changed mid-flow.
    const payModeSelected: PaymentMethod = paymentMethod;

    setPlacing(true);
    try {
      const user = await getCurrentUser();
      const customer = (user?.name && user.name.trim()) || user?.email || 'Customer';
      // Always read from storage here — state may still be null or stale 'delivery' before async load finishes.
      const mode = await readOrderModeFromStorage();
      const requiresAddress = mode === 'delivery';

      let addressStr = '';
      let addressLat: number | undefined;
      let addressLng: number | undefined;
      if (requiresAddress) {
        const address = await getAddress();
        addressStr = formatAddress(address);
        addressLat =
          address && typeof (address as any).latitude === 'number' && Number.isFinite((address as any).latitude)
            ? (address as any).latitude
            : undefined;
        addressLng =
          address && typeof (address as any).longitude === 'number' && Number.isFinite((address as any).longitude)
            ? (address as any).longitude
            : undefined;
        if (!addressStr.trim()) {
          Alert.alert(
            'Address required',
            'Please add a delivery address in My Addresses before placing your order.'
          );
          setPlacing(false);
          return;
        }
      }

      let stripePaymentIntentId: string | undefined;

      if (payModeSelected === 'stripe') {
        await ensureStripeIsReady();
        const amount = Number(payableTotal.toFixed(2));
        if (Number.isNaN(amount) || amount < 0.5) {
          throw new Error('Minimum card payment amount is 0.50.');
        }

        const paymentIntent = await createPaymentIntent({
          amount,
          currency: appCurrency as any,
          metadata: {
            userId: String(user?.id ?? ''),
            customer,
          },
        });
        stripePaymentIntentId = paymentIntent.paymentIntentId;

        const { error } = await confirmPayment(paymentIntent.clientSecret, {
          paymentMethodType: 'Card',
          paymentMethodData: {
            billingDetails: {
              name: cardholderName.trim(),
              email: user?.email,
              phone: user?.phone,
            },
          },
        });
        if (error) {
          throw new Error(error.message || 'Payment could not be completed.');
        }

        const verification = await verifyStripePaymentSuccess(paymentIntent.paymentIntentId);
        if (!verification.success) {
          throw new Error(
            verification.status
              ? `Payment is not completed (${verification.status}).`
              : 'Payment is not completed.'
          );
        }
      }

      // Place order after Stripe success — payMethod/payStatus must match payModeSelected (placeOrder adds snake_case too).
      const payMethod = payModeSelected === 'stripe' ? 'Stripe' : 'COD';
      const payStatus = payModeSelected === 'stripe' ? 'Paid' : 'Pending';
      // Backend expects distinct types (see myorder Order.type): Delivery | Pickup | Dine In
      const orderTypePayload: 'Delivery' | 'Pickup' | 'Dine In' =
        mode === 'delivery' ? 'Delivery' : mode === 'dining' ? 'Dine In' : 'Pickup';
      const addressPayload = requiresAddress
        ? addressStr
        : mode === 'dining'
          ? 'Dine In'
          : 'Take away';
      const placedOrder = await placeOrder({
        customer,
        items: formatItemsForOrder(items),
        type: orderTypePayload,
        amount: formatPrice(payableTotal.toFixed(2)),
        address: addressPayload,
        latitude: requiresAddress ? addressLat : undefined,
        longitude: requiresAddress ? addressLng : undefined,
        phone: user?.phone?.trim() || '',
        notes: notes.trim() || undefined,
        discountCode: discountPreviewValid ? discountCode.trim() : undefined,
        paymentMethod: payMethod,
        paymentStatus: payStatus,
        paymentId: stripePaymentIntentId,
      });
      const placedOrderIdRaw =
        placedOrder?.orderId ??
        placedOrder?.id ??
        (typeof placedOrder?._id === 'string' ? placedOrder._id : undefined);
      const placedOrderId = placedOrderIdRaw != null ? String(placedOrderIdRaw).trim() : '';

      clearCart();
      if (payModeSelected === 'stripe') {
        showToast('Payment successful', 'success');
      } else {
        showToast('Order placed', 'success');
      }
      if (placedOrderId) {
        navigation.reset({
          routes: [
            { name: 'Main' },
            { name: 'ViewOrderDetails', params: { orderId: placedOrderId } },
          ],
          index: 1,
        });
      } else {
        navigation.reset({
          routes: [
            { name: 'Main' },
            { name: 'Orders', params: { showOrderSuccessToast: true } },
          ],
          index: 1,
        });
      }
    } catch (err) {
      showToast(normalizeOrderErrorMessage(err), 'error');
    } finally {
      setPlacing(false);
    }
  };

  const showLoginGate = !authChecking && !isLoggedIn;

  const scrollBottomPadding =
    8 + keyboardBottomInset + (keyboardBottomInset > 0 ? Math.max(insets.bottom, 8) : 0);

  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + 4 : 0;

  return (
    <View style={styles.wrapper}>
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={BG_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {showSkeleton ? (
          <CheckoutScreenSkeleton />
        ) : (
        <>
        {/* Order summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order summary</Text>
          {items.length === 0 ? (
            <View style={[styles.panel, styles.emptyState]}>
              <MaterialIcons name="shopping-cart" size={40} color="rgba(255,255,255,0.35)" />
              <Text style={styles.emptyStateText}>Your cart is empty</Text>
            </View>
          ) : (
            <View style={styles.summaryPanel}>
              {items.map((cartItem, index) => (
                <View
                  key={cartItem.id}
                  style={[styles.cartRow, index < items.length - 1 && styles.cartRowDivider]}
                >
                  <View style={styles.cartRowImageWrap}>
                    {cartItem.image ? (
                      <Image source={cartItem.image} style={styles.cartRowImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.cartRowSkeleton}>
                        <MaterialIcons name="image-not-supported" size={20} color="rgba(255,255,255,0.35)" />
                      </View>
                    )}
                  </View>
                  <View style={styles.cartRowBody}>
                    <View style={styles.cartRowTitleRow}>
                      <Text style={styles.cartRowName} numberOfLines={2}>
                        {cartItem.name}
                      </Text>
                      <View style={styles.cartRowPriceBlock}>
                        <Text style={styles.cartRowPrice}>
                          {formatPrice(String(getLineTotal(cartItem).toFixed(2)))}
                        </Text>
                        <Text style={styles.qtyReadonly}>×{cartItem.quantity}</Text>
                      </View>
                    </View>
                    {String(cartItem.instructions ?? '').trim() ? (
                      <TextInput
                        editable={false}
                        multiline
                        scrollEnabled={false}
                        value={`Notes: ${String(cartItem.instructions).trim()}`}
                        style={styles.cartNotesField}
                      />
                    ) : null}
                    {Array.isArray(cartItem.addons) && cartItem.addons.length > 0 ? (
                      <View style={styles.cartAddonList}>
                        {cartItem.addons.map((addon) => (
                          <View key={`${cartItem.id}-${addon.id}`} style={styles.cartAddonRow}>
                            <View style={styles.cartAddonImageWrap}>
                              {addon.image ? (
                                <Image
                                  source={typeof addon.image === 'string' ? { uri: addon.image } : addon.image}
                                  style={styles.cartAddonImage}
                                  resizeMode="cover"
                                />
                              ) : (
                                <MaterialIcons name="image-not-supported" size={14} color="rgba(255,255,255,0.45)" />
                              )}
                            </View>
                            <View style={styles.cartAddonMeta}>
                              <Text style={styles.cartAddonName} numberOfLines={1}>
                                {addon.name}
                              </Text>
                              <View style={styles.cartAddonMetaRow}>
                                <Text style={styles.cartAddonPrice}>
                                  {formatPrice(String((parsePrice(addon.price) * cartItem.quantity).toFixed(2)))}
                                </Text>
                                <Text style={styles.cartAddonQty}>×{cartItem.quantity}</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Extra salsa, no onions, etc."
            placeholderTextColor={MUTED_TEXT}
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discount code</Text>
          <View style={styles.discountRow}>
            <TextInput
              style={styles.discountInput}
              placeholder="Enter code"
              placeholderTextColor={MUTED_TEXT}
              value={discountCode}
              onChangeText={(t) => {
                setDiscountCode(t);
                setDiscountApplied(false);
                setDiscountPreview(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleApplyDiscount}
            />
            <Pressable
              style={({ pressed }) => [
                styles.discountSendBtn,
                pressed && styles.discountSendBtnPressed,
                discountApplying && styles.discountSendBtnDisabled,
              ]}
              onPress={() => void handleApplyDiscount()}
              hitSlop={6}
              disabled={discountApplying}
              accessibilityLabel="Apply discount code"
            >
              {discountApplying ? (
                <ActivityIndicator size="small" color={BG_DARK} />
              ) : (
                <Ionicons name="send" size={20} color={BG_DARK} />
              )}
            </Pressable>
          </View>
          {discountPreviewValid && discountPreview ? (
            <Text style={styles.discountAppliedHint}>
              {discountPreview.discountAmount > 0
                ? `You save ${formatPrice(discountPreview.discountAmount.toFixed(2))} — new total ${formatPrice(payableTotal.toFixed(2))}.`
                : `New total ${formatPrice(payableTotal.toFixed(2))}.`}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <View style={styles.panel}>
          <View style={styles.paymentOptions}>
            <Pressable
              style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('cod')}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={styles.paymentIconWrap}>
                  <MaterialIcons name="payments" size={24} color={paymentMethod === 'cod' ? BG_DARK : GOLD} />
                </View>
                <View>
                  <Text style={styles.paymentOptionTitle}>Cash on Delivery</Text>
                  <Text style={styles.paymentOptionSub}>Pay when you receive your order</Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              style={[styles.paymentOption, paymentMethod === 'stripe' && styles.paymentOptionSelected]}
              onPress={() => setPaymentMethod('stripe')}
            >
              <View style={styles.paymentOptionLeft}>
                <View style={styles.paymentIconWrap}>
                  <Ionicons name="card" size={24} color={paymentMethod === 'stripe' ? BG_DARK : GOLD} />
                </View>
                <View>
                  <Text style={styles.paymentOptionTitle}>Pay with Stripe</Text>
                  <Text style={styles.paymentOptionSub}>Credit / debit card</Text>
                </View>
              </View>
            </Pressable>
          </View>

          {paymentMethod === 'stripe' ? (
            loadingStripe || !stripeReady ? (
              <View style={styles.cardForm}>
                <Text style={styles.cardFormLabel}>Loading payment form…</Text>
                <View style={[styles.cardFieldWrap, { alignItems: 'center', paddingVertical: 12 }]}>
                  <ActivityIndicator size="small" color={GOLD} />
                </View>
              </View>
            ) : (
              <View style={styles.cardForm}>
                <View style={styles.cardFormBlock}>
                  <Text style={styles.cardFormLabel}>Cardholder name</Text>
                  <TextInput
                    style={styles.cardInput}
                    placeholder="Name on card"
                    placeholderTextColor={MUTED_TEXT}
                    value={cardholderName}
                    onChangeText={setCardholderName}
                    selectionColor={TEXT_WHITE}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </View>
                <View style={styles.cardFormBlock}>
                  <Text style={styles.cardFormLabel}>Card details</Text>
                  <View style={styles.cardFieldWrap}>
                    <CardField
                      postalCodeEnabled={false}
                      placeholders={{ number: '4242 4242 4242 4242' }}
                      cardStyle={{
                        backgroundColor: STRIPE_FIELD_SURFACE,
                        textColor: TEXT_WHITE,
                        placeholderColor: 'rgba(255,255,255,0.55)',
                        borderColor: 'transparent',
                        borderWidth: 0,
                        borderRadius: 8,
                        textErrorColor: '#FF6B6B',
                        fontSize: 15,
                      }}
                      style={styles.cardField}
                      onCardChange={setCardDetails}
                    />
                  </View>
                </View>
              </View>
            )
          ) : null}
          </View>
        </View>

        {items.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Total bill</Text>
            <View style={styles.totalBillPanel}>
              <View style={styles.totalBillRow}>
                <Text style={styles.totalBillRowLabel}>Subtotal</Text>
                <Text style={styles.totalBillRowAmount}>{formatPrice(cartSubtotal.toFixed(2))}</Text>
              </View>
              {discountPreviewValid && discountPreview && discountPreview.discountAmount > 0 ? (
                <View style={[styles.totalBillRow, styles.totalBillRowDiscount]}>
                  <Text style={styles.totalBillRowLabel}>Discount</Text>
                  <Text style={styles.totalBillRowAmountDiscount}>
                    −{formatPrice(discountPreview.discountAmount.toFixed(2))}
                  </Text>
                </View>
              ) : null}
              {effectiveDeliveryFee > 0 ? (
                <View style={styles.totalBillRow}>
                  <Text style={styles.totalBillRowLabel}>Delivery charges</Text>
                  <Text style={styles.totalBillRowAmount}>{formatPrice(effectiveDeliveryFee.toFixed(2))}</Text>
                </View>
              ) : null}
              <View style={styles.totalBillDivider} />
              <View style={styles.totalBillRowGrand}>
                <Text style={styles.totalBillGrandLabel}>Total</Text>
                <Text style={styles.totalBillGrandAmount}>{formatPrice(payableTotal.toFixed(2))}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.bottomSpacer} />
        </>
        )}
      </ScrollView>

      {/* Footer – same as OrderDetails/ItemDetail */}
      <View style={styles.bottomBar}>
        <View style={styles.totalWrap}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalPrice}>{formatPrice(payableTotal.toFixed(2))}</Text>
        </View>
        <Pressable
          style={[
            styles.placeOrderBtn,
            (items.length === 0 || !isLoggedIn || paymentMethod === null) && styles.placeOrderBtnDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={items.length === 0 || !isLoggedIn || placing || paymentMethod === null}
        >
          {placing ? (
            <ActivityIndicator size="small" color={BG_DARK} />
          ) : (
            <Text style={styles.placeOrderBtnText}>
              {paymentMethod === 'stripe' ? 'Pay' : paymentMethod === 'cod' ? 'Place order' : 'Select payment'}
            </Text>
          )}
        </Pressable>
      </View>
      </KeyboardAvoidingView>
    </SafeAreaView>

      {/* Login required modal – same pattern as Profile "My Addresses" */}
      {showLoginGate && !loginModalDismissed && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => navigation.goBack()}
        >
          <SafeAreaView style={styles.loginRequiredBackdrop} edges={['top', 'bottom', 'left', 'right']}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setLoginModalDismissed(true)}
            />
            <Pressable
              style={styles.loginRequiredCard}
              onPress={(e) => e.stopPropagation()}
            >
              <Pressable
                style={styles.loginRequiredCloseBtn}
                onPress={() => setLoginModalDismissed(true)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={TEXT_WHITE} />
              </Pressable>
              <View style={styles.loginRequiredIconWrap}>
                <Ionicons name="person-circle-outline" size={44} color={GOLD} />
              </View>
              <Text style={styles.loginRequiredTitle}>Login required</Text>
              <Text style={styles.loginRequiredMessage}>
                Please sign in or create an account to proceed with checkout.
              </Text>
              <View style={styles.loginRequiredButtons}>
                <Pressable
                  style={({ pressed }) => [
                    styles.loginRequiredPrimaryBtn,
                    pressed && styles.loginRequiredBtnPressed,
                  ]}
                  onPress={() => {
                    setLoginModalDismissed(true);
                    navigateToLoginRegister({ returnTo: 'Checkout' });
                  }}
                >
                  <Text style={styles.loginRequiredPrimaryText}>Login / Register</Text>
                </Pressable>
              </View>
            </Pressable>
          </SafeAreaView>
        </Modal>
      )}

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
            { opacity: toastOpacity },
          ]}
        >
          <Text style={styles.toastText} numberOfLines={2}>
            {toast.message}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loginRequiredBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 29, 27, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loginRequiredCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
  loginRequiredCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    zIndex: 2,
  },
  loginRequiredIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(254, 203, 77, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  loginRequiredTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_WHITE,
    textAlign: 'center',
    marginBottom: 10,
  },
  loginRequiredMessage: {
    fontSize: 15,
    lineHeight: 22,
    color: MUTED_TEXT,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  loginRequiredButtons: {
    gap: 12,
  },
  loginRequiredPrimaryBtn: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginRequiredPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: BG_DARK,
  },
  loginRequiredBtnPressed: {
    opacity: 0.85,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
    paddingBottom: 8,
  },
  section: {
    marginBottom: 14,
  },
  panel: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.22)',
    padding: 10,
  },
  summaryPanel: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.22)',
    overflow: 'hidden',
  },
  totalBillPanel: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  totalBillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalBillRowDiscount: {
    marginTop: 4,
  },
  totalBillRowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED_TEXT,
  },
  totalBillRowAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  totalBillRowAmountDiscount: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
  },
  totalBillDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 8,
  },
  totalBillRowGrand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalBillGrandLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  totalBillGrandAmount: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: GOLD,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyStateText: {
    fontSize: 15,
    color: MUTED_TEXT,
    marginTop: 8,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cartRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  cartRowImageWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cartRowImage: {
    width: '100%',
    height: '100%',
  },
  cartRowSkeleton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartRowBody: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  cartRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  cartRowName: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  cartRowPriceBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  cartNotesField: {
    backgroundColor: SEARCH_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    minHeight: 44,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_WHITE,
    lineHeight: 18,
    textAlignVertical: 'top',
  },
  cartAddonList: {
    gap: 6,
    marginTop: 0,
    marginBottom: 0,
  },
  cartAddonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(254,203,77,0.16)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cartAddonImageWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(254,203,77,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  cartAddonImage: {
    width: '100%',
    height: '100%',
  },
  cartAddonMeta: {
    flex: 1,
  },
  cartAddonName: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  cartAddonMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartAddonPrice: {
    fontSize: 11,
    fontWeight: '700',
    color: GOLD,
  },
  cartAddonQty: {
    fontSize: 11,
    fontWeight: '700',
    color: MUTED_TEXT,
  },
  cartRowPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
  },
  qtyReadonly: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  paymentOptions: {
    gap: 8,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: BG_DARK,
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  paymentOptionSelected: {
    borderColor: GOLD,
    backgroundColor: 'rgba(254, 203, 77, 0.08)',
  },
  paymentOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(254, 203, 77, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  paymentOptionSub: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  cardForm: {
    marginTop: 10,
    padding: 12,
    backgroundColor: BG_DARK,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.22)',
    gap: 14,
  },
  cardFormBlock: {
    gap: 6,
  },
  cardFormLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 0,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  cardFieldWrap: {
    backgroundColor: STRIPE_FIELD_SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardField: {
    width: '100%',
    height: 44,
  },
  cardInput: {
    backgroundColor: STRIPE_FIELD_SURFACE,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_WHITE,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.35)',
  },
  notesInput: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: TEXT_WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  discountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  discountInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  discountSendBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountSendBtnDisabled: {
    opacity: 0.55,
  },
  discountSendBtnPressed: {
    opacity: 0.88,
  },
  discountAppliedHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(254,203,77,0.85)',
  },
  bottomSpacer: {
    height: 8,
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
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  totalPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: GOLD,
  },
  placeOrderBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderBtnDisabled: {
    opacity: 0.85,
  },
  placeOrderBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: BG_DARK,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 28,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    zIndex: 40,
    elevation: 8,
  },
  toastSuccess: {
    backgroundColor: 'rgba(38, 170, 98, 0.95)',
  },
  toastError: {
    backgroundColor: 'rgba(188, 66, 66, 0.95)',
  },
  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
