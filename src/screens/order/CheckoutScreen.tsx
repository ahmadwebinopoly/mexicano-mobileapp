import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { placeOrder } from '../../api/orders';
import { useCart, type CartItem } from '../../contexts/CartContext';
import { getCurrentUser } from '../../api/profile';
import { getAddress } from '../../api/saveadresss';
import { createPaymentIntent, getStripeConfig, verifyStripePaymentSuccess } from '../../api/stripe';
import { CheckoutScreenSkeleton } from '../../components/skeleton';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

function formatPrice(price: string): string {
  if (price == null || String(price).trim() === '') return '$0.00';
  const p = String(price).trim();
  return p.startsWith('$') ? p : `$${p}`;
}

function parsePrice(p: string): number {
  return parseFloat(String(p).replace(/[$,]/g, '')) || 0;
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
      return `${base} x${item.quantity}`;
    })
    .join(', ');
}

function formatAddress(addr: { address?: string; city?: string; state?: string; zipCode?: string } | null): string {
  if (!addr || !addr.address) return '';
  const parts = [addr.address, addr.city, addr.state, addr.zipCode].filter(Boolean);
  return parts.join(', ');
}

type PaymentMethod = 'cod' | 'stripe';

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const { items, removeItem, updateQuantity, clearCart, total } = useCart();
  const [placing, setPlacing] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginModalDismissed, setLoginModalDismissed] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [cardholderName, setCardholderName] = useState('');
  const [cardDetails, setCardDetails] = useState<CardFieldInput.Details | null>(null);
  const [stripeReady, setStripeReady] = useState(false);
  const [loadingStripe, setLoadingStripe] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
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

    setPlacing(true);
    try {
      const user = await getCurrentUser();
      const address = await getAddress();

      const customer = (user?.name && user.name.trim()) || user?.email || 'Customer';
      const addressStr = formatAddress(address);
      if (!addressStr.trim()) {
        Alert.alert('Address required', 'Please add a delivery address in My Addresses before placing your order.');
        setPlacing(false);
        return;
      }

      let stripePaymentIntentId: string | undefined;

      if (paymentMethod === 'stripe') {
        await ensureStripeIsReady();
        const amount = Number(total.toFixed(2));
        if (Number.isNaN(amount) || amount < 0.5) {
          throw new Error('Minimum card payment amount is 0.50.');
        }

        const paymentIntent = await createPaymentIntent({
          amount,
          currency: 'gbp',
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

      // Place order after Stripe success (Option A) – send correct paymentMethod/paymentStatus so admin shows Stripe/Paid
      // Include both camelCase and snake_case so backend accepts either format
      const payMethod = paymentMethod === 'stripe' ? 'Stripe' : 'COD';
      const payStatus = paymentMethod === 'stripe' ? 'Paid' : 'Pending';
      await placeOrder({
        customer,
        items: formatItemsForOrder(items),
        type: 'Delivery',
        amount: formatPrice(total.toFixed(2)),
        address: addressStr,
        phone: user?.phone?.trim() || '',
        notes: notes.trim() || undefined,
        paymentMethod: payMethod,
        paymentStatus: payStatus,
        payment_method: payMethod,
        payment_status: payStatus,
        paymentId: stripePaymentIntentId,
      });

      clearCart();
      if (paymentMethod === 'stripe') {
        showToast('Payment successful', 'success');
      } else {
        showToast('Order placed', 'success');
      }
      navigation.reset({
        routes: [
          { name: 'Main' },
          { name: 'Orders', params: { showOrderSuccessToast: true } },
        ],
        index: 1,
      });
    } catch (err) {
      Alert.alert('Order failed', err instanceof Error ? err.message : 'Could not place order.');
    } finally {
      setPlacing(false);
    }
  };

  const showLoginGate = !authChecking && !isLoggedIn;

  return (
    <View style={styles.wrapper}>
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={BG_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showSkeleton ? (
          <CheckoutScreenSkeleton />
        ) : (
        <>
        {/* Order summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order summary</Text>
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="shopping-cart" size={40} color="rgba(255,255,255,0.35)" />
              <Text style={styles.emptyStateText}>Your cart is empty</Text>
            </View>
          ) : (
            items.map((cartItem) => (
              <View key={cartItem.id} style={styles.cartRow}>
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
                  <Text style={styles.cartRowName} numberOfLines={1}>{cartItem.name}</Text>
                  {getAddonsSubtitle(cartItem) ? (
                    <Text style={styles.cartRowAddons} numberOfLines={1}>{getAddonsSubtitle(cartItem)}</Text>
                  ) : null}
                  <View style={styles.cartRowBottom}>
                    <Text style={styles.cartRowPrice}>{formatPrice(String(getLineTotal(cartItem).toFixed(2)))}</Text>
                    <View style={styles.quantityRow}>
                      {cartItem.quantity <= 1 ? (
                        <Pressable style={styles.quantityBtn} onPress={() => removeItem(cartItem.id)}>
                          <MaterialIcons name="delete-outline" size={18} color={BG_DARK} />
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.quantityBtn}
                          onPress={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                        >
                          <Text style={styles.quantityBtnText}>−</Text>
                        </Pressable>
                      )}
                      <Text style={styles.quantityNum}>{cartItem.quantity}</Text>
                      <Pressable
                        style={styles.quantityBtn}
                        onPress={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                      >
                        <Text style={styles.quantityBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Order notes – above Payment */}
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

        {/* Payment: Cash on Delivery or Stripe */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
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
            <View style={styles.cardForm}>
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
              <Text style={[styles.cardFormLabel, { marginTop: 12 }]}>Card details</Text>
              <View style={styles.cardFieldWrap}>
                <CardField
                  postalCodeEnabled={false}
                  placeholders={{ number: '4242 4242 4242 4242' }}
                  cardStyle={{
                    backgroundColor: CARD_BG,
                    textColor: '#FFFFFF',
                    placeholderColor: 'rgba(255,255,255,0.6)',
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
          ) : null}
        </View>

        <View style={styles.bottomSpacer} />
        </>
        )}
      </ScrollView>

      {/* Footer – same as OrderDetails/ItemDetail */}
      <View style={styles.bottomBar}>
        <View style={styles.totalWrap}>
          <Text style={styles.totalPrice}>{formatPrice(total.toFixed(2))}</Text>
        </View>
        <Pressable
          style={[styles.placeOrderBtn, (items.length === 0 || !isLoggedIn) && styles.placeOrderBtnDisabled]}
          onPress={handlePlaceOrder}
          disabled={items.length === 0 || !isLoggedIn || placing}
        >
          {placing ? (
            <ActivityIndicator size="small" color={BG_DARK} />
          ) : (
            <Text style={styles.placeOrderBtnText}>
              {paymentMethod === 'stripe' ? 'Pay' : 'Place order'}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>

      {/* Login required modal – same pattern as Profile "My Addresses" */}
      {showLoginGate && !loginModalDismissed && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => navigation.goBack()}
        >
          <Pressable
            style={styles.loginRequiredBackdrop}
            onPress={() => navigation.goBack()}
          >
            <Pressable
              style={styles.loginRequiredCard}
              onPress={(e) => e.stopPropagation()}
            >
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
                    navigateToLoginRegister();
                  }}
                >
                  <Text style={styles.loginRequiredPrimaryText}>Login / Register</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.loginRequiredSecondaryBtn,
                    pressed && styles.loginRequiredBtnPressed,
                  ]}
                  onPress={() => navigation.goBack()}
                >
                  <Text style={styles.loginRequiredSecondaryText}>Not now</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
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
  loginRequiredSecondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  loginRequiredSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: MUTED_TEXT,
  },
  loginRequiredBtnPressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 15,
    color: MUTED_TEXT,
    marginTop: 8,
  },
  cartRow: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.2)',
    alignItems: 'center',
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
  },
  cartRowName: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  cartRowAddons: {
    fontSize: 11,
    color: MUTED_TEXT,
    marginBottom: 4,
  },
  cartRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartRowPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantityBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: BG_DARK,
  },
  quantityNum: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_WHITE,
    minWidth: 20,
    textAlign: 'center',
  },
  paymentOptions: {
    gap: 10,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 14,
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
    marginRight: 14,
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
    marginTop: 14,
    padding: 14,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardFormLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 6,
  },
  cardFieldWrap: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.28)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  cardField: {
    width: '100%',
    height: 44,
  },
  cardInput: {
    backgroundColor: BG_DARK,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  notesInput: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT_WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    minHeight: 72,
    textAlignVertical: 'top',
  },
  bottomSpacer: {
    height: 20,
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
