import { createNavigationContainerRef } from '@react-navigation/native';

export const rootNavigationRef = createNavigationContainerRef();

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
      nav.navigate('LoginRegister', params);
    } else {
      nav.navigate('LoginRegister');
    }
  }
}
