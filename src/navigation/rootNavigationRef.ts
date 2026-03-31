import { createNavigationContainerRef } from '@react-navigation/native';

export const rootNavigationRef = createNavigationContainerRef();

let pendingPushOrderId: string | null = null;

export function navigateToCart(): void {
  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate('Cart' as never);
  }
}

/** Pass `returnTo: 'Checkout'` when opening auth from the checkout login gate. */
export function navigateToLoginRegister(params?: { returnTo?: 'Checkout' }): void {
  if (rootNavigationRef.isReady()) {
    const nav = rootNavigationRef as { navigate: (name: string, p?: object) => void };
    if (params?.returnTo) {
      nav.navigate('Login', params);
    } else {
      nav.navigate('Login');
    }
  }
}

export function navigateToOrderFromPush(orderId: string): void {
  const id = String(orderId ?? '').trim();
  if (!id) return;
  if (!rootNavigationRef.isReady()) {
    pendingPushOrderId = id;
    return;
  }
  pendingPushOrderId = null;
  (rootNavigationRef as any).navigate('ViewOrderDetails', { orderId: id });
}

export function flushPendingPushNavigation(): void {
  if (!pendingPushOrderId) return;
  if (!rootNavigationRef.isReady()) return;
  const id = pendingPushOrderId;
  pendingPushOrderId = null;
  (rootNavigationRef as any).navigate('ViewOrderDetails', { orderId: id });
}
