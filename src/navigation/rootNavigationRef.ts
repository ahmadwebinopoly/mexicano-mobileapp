import { createNavigationContainerRef } from '@react-navigation/native';

export const rootNavigationRef = createNavigationContainerRef();

export function navigateToCart(): void {
  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate('Cart' as never);
  }
}

export function navigateToLoginRegister(): void {
  if (rootNavigationRef.isReady()) {
    rootNavigationRef.navigate('LoginRegister' as never);
  }
}
