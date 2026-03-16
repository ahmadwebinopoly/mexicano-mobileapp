import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCart, type CartItem } from '../../contexts/CartContext';
import { CartScreenSkeleton } from '../../components/skeleton';

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

export default function CartScreen() {
  const navigation = useNavigation<any>();
  const { items, removeItem, updateQuantity, total } = useCart();
  const [showSkeleton, setShowSkeleton] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowSkeleton(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={BG_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>Cart</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Cart items list */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showSkeleton ? (
          <CartScreenSkeleton />
        ) : items.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="shopping-cart" size={56} color="rgba(255,255,255,0.35)" />
            <Text style={styles.emptyStateTitle}>Your cart is empty</Text>
            <Text style={styles.emptyStateSub}>Add items from the menu to see them here.</Text>
          </View>
        ) : (
          items.map((cartItem) => (
            <View key={cartItem.id} style={styles.cartCard}>
              <View style={styles.cartCardImageWrap}>
                {cartItem.image ? (
                  <Image
                    source={cartItem.image}
                    style={styles.cartCardImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.cartCardImageSkeleton}>
                    <MaterialIcons name="image-not-supported" size={28} color="rgba(255,255,255,0.35)" />
                  </View>
                )}
              </View>
              <View style={styles.cartCardBody}>
                <Text style={styles.cartCardName} numberOfLines={1}>
                  {cartItem.name}
                </Text>
                {getAddonsSubtitle(cartItem) ? (
                  <Text style={styles.cartCardAddons} numberOfLines={2}>
                    {getAddonsSubtitle(cartItem)}
                  </Text>
                ) : null}
                <Text style={styles.cartCardPrice}>
                  {formatPrice(String(getLineTotal(cartItem).toFixed(2)))}
                </Text>
                <View style={styles.quantityRow}>
                  {cartItem.quantity <= 1 ? (
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => removeItem(cartItem.id)}
                    >
                      <MaterialIcons name="delete-outline" size={20} color={BG_DARK} />
                    </Pressable>
                  ) : (
                    <Pressable
                      style={styles.quantityBtn}
                      onPress={() => updateQuantity(cartItem.id, cartItem.quantity - 1)}
                    >
                      <Text style={styles.quantityBtnText}>−</Text>
                    </Pressable>
                  )}
                  <View style={styles.quantityBadge}>
                    <Text style={styles.quantityText}>{cartItem.quantity}</Text>
                  </View>
                  <Pressable
                    style={styles.quantityBtn}
                    onPress={() => updateQuantity(cartItem.id, cartItem.quantity + 1)}
                  >
                    <Text style={styles.quantityBtnText}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Footer – same as OrderDetails/ItemDetail footer */}
      <View style={styles.bottomBar}>
        <View style={styles.totalWrap}>
          <Text style={styles.totalPrice}>{formatPrice(total.toFixed(2))}</Text>
        </View>
        <Pressable
          style={[styles.checkoutBtn, items.length === 0 && styles.checkoutBtnDisabled]}
          onPress={() => {
            if (items.length === 0) return;
            navigation.navigate('Checkout');
          }}
          disabled={items.length === 0}
        >
          <Text style={styles.checkoutBtnText}>Proceed to checkout</Text>
        </Pressable>
      </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginTop: 16,
  },
  emptyStateSub: {
    fontSize: 14,
    color: MUTED_TEXT,
    marginTop: 8,
  },
  cartCard: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
    borderLeftWidth: 3,
    borderLeftColor: GOLD,
    alignItems: 'center',
  },
  cartCardImageWrap: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cartCardImage: {
    width: '100%',
    height: '100%',
  },
  cartCardImageSkeleton: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCardBody: {
    flex: 1,
    marginLeft: 14,
  },
  cartCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  cartCardAddons: {
    fontSize: 12,
    fontWeight: '400',
    color: MUTED_TEXT,
    marginBottom: 4,
  },
  cartCardPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
    marginBottom: 10,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: BG_DARK,
  },
  quantityBadge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BG_DARK,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
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
  checkoutBtn: {
    backgroundColor: GOLD,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  checkoutBtnDisabled: {
    opacity: 0.85,
  },
  checkoutBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: BG_DARK,
  },
});
