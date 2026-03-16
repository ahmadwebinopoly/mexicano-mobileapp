import React, { createContext, useContext, useCallback, useState } from 'react';

export type CartAddon = { id: string; name: string; price: string };

export type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: string;
  image: { uri: string } | null;
  quantity: number;
  addons: CartAddon[];
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
};

const CartContext = createContext<CartContextValue | null>(null);

let cartItemId = 0;
function nextCartId() {
  cartItemId += 1;
  return `cart-${Date.now()}-${cartItemId}`;
}

function parsePrice(p: string): number {
  return parseFloat(String(p).replace(/[$,]/g, '')) || 0;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback(
    (item: Omit<CartItem, 'id' | 'quantity'> & { quantity?: number }) => {
      const quantity = item.quantity ?? 1;
      const addons = Array.isArray(item.addons) ? item.addons : [];
      setItems((prev) => [
        ...prev,
        {
          ...item,
          id: nextCartId(),
          quantity,
          addons,
        },
      ]);
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity < 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const total = items.reduce((sum, i) => {
    const main = parsePrice(i.price) * i.quantity;
    const addonsList = Array.isArray(i.addons) ? i.addons : [];
    const addonsSum = addonsList.reduce((a, ad) => a + parsePrice(ad.price) * i.quantity, 0);
    return sum + main + addonsSum;
  }, 0);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const value: CartContextValue = {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    itemCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
