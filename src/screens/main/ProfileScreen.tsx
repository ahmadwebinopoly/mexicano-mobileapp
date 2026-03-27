import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { navigateToLoginRegister } from '../../navigation/rootNavigationRef';
import { logout as logoutApi } from '../../api/auth';
import { getCurrentUser, type ProfileUser } from '../../api/profile';
import { unregisterFromPushNotifications } from '../../services/pushNotifications';
import { deleteAccount } from '../../api/deleteapi';

const TOAST_DURATION = 2800;

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const [currentUser, setCurrentUser] = useState<ProfileUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const hasRedirectedToLoginRef = useRef(false);

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

  const loadCurrentUser = async () => {
    setLoadingUser(true);
    const user = await getCurrentUser();
    setCurrentUser(user);
    setLoadingUser(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      void loadCurrentUser();
    }, [])
  );

  // If user is logged out, redirect to login screen.
  useEffect(() => {
    if (loadingUser) return;
    if (currentUser) return;
    if (hasRedirectedToLoginRef.current) return;
    hasRedirectedToLoginRef.current = true;
    navigateToLoginRegister();
  }, [loadingUser, currentUser]);

  const handleLogout = async () => {
    await unregisterFromPushNotifications();
    await logoutApi().catch(() => {});
    setCurrentUser(null);
    showToast('Signed out.', 'success');
  };

  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      await unregisterFromPushNotifications().catch(() => {});
      await logoutApi().catch(() => {});
      setCurrentUser(null);
      setDeleteAccountModalVisible(false);
      showToast('Account deleted successfully.', 'success');
      navigation.navigate('Discover');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete account.';
      showToast(msg || 'Failed to delete account.', 'error');
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card – guest vs logged-in user */}
        <View style={styles.headerCard}>
          <View style={styles.headerLeftRow}>
            {currentUser && (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarInitials}>
                  {(currentUser.name || currentUser.email || 'C')
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.headerTextWrap}>
              {currentUser ? (
                <>
                  <Text style={styles.headerTitle}>
                    {currentUser.name && currentUser.name.trim() !== ''
                      ? currentUser.name
                      : 'Customer'}
                  </Text>
                  <Text style={styles.headerSubtitle}>{currentUser.email}</Text>
                  {currentUser.phone ? (
                    <Text style={styles.headerSubtitle}>{currentUser.phone}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.headerTitle}>Hi, guest!</Text>
                  <Text style={styles.headerSubtitle}>Log in to make an order</Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.headerRight}>
            {currentUser ? (
              <Pressable
                style={styles.logoutButton}
                onPress={handleLogout}
                hitSlop={8}
              >
                <Ionicons name="log-out-outline" size={20} color={GOLD} />
              </Pressable>
            ) : (
              <Pressable
                style={styles.signInButton}
                onPress={navigateToLoginRegister}
              >
                <Text style={styles.signInText}>Sign In</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Settings list (only when logged in) */}
        {currentUser ? (
          <>
          <View style={styles.listCard}>
            <Pressable
              style={styles.listItem}
              onPress={() => navigation.getParent()?.navigate('Orders')}
            >
              <View>
                <Text style={styles.listLabel}>My Orders</Text>
                <Text style={styles.listSubLabel}>View your order history</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED_TEXT} />
            </Pressable>

            <View style={styles.listDivider} />

            <Pressable
              style={styles.listItem}
              onPress={() => navigation.getParent()?.navigate('Address')}
            >
              <View>
                <Text style={styles.listLabel}>My Addresses</Text>
                <Text style={styles.listSubLabel}>Saved delivery locations</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED_TEXT} />
            </Pressable>

            <View style={styles.listDivider} />

            <Pressable
              style={styles.listItem}
              onPress={() => navigation.getParent()?.navigate('Wishlist')}
            >
              <View>
                <Text style={styles.listLabel}>Wishlist</Text>
                <Text style={styles.listSubLabel}>Your favorite items</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED_TEXT} />
            </Pressable>

            <View style={styles.listDivider} />

          </View>

          <View style={styles.deleteAccountSection}>
            <Pressable
              style={styles.deleteAccountButton}
              onPress={() => setDeleteAccountModalVisible(true)}
            >
              <Ionicons name="trash-outline" size={18} color="#FF8080" />
              <Text style={styles.deleteAccountText}>Delete account</Text>
            </Pressable>
          </View>
          </>
        ) : null}
      </ScrollView>

      {/* Delete account modal */}
      {currentUser ? (
        <Modal
          visible={deleteAccountModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setDeleteAccountModalVisible(false)}
        >
          <SafeAreaView style={styles.deleteModalBackdrop} edges={['top', 'bottom', 'left', 'right']}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setDeleteAccountModalVisible(false)}
            />
            <Pressable style={styles.deleteModalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.deleteModalIconCircle}>
                <View style={styles.deleteModalIconInner}>
                  <Ionicons name="alert" size={24} color="#FCA5A5" />
                </View>
              </View>

              <Text style={styles.deleteModalTitle}>Are you absolutely sure?</Text>
              <Text style={styles.deleteModalSubtitle}>
                Deleting your profile is a permanent action. All your gastronomic journey data with Mexicano will be erased forever.
              </Text>

              <View style={styles.deleteModalInfoList}>
                <View style={styles.deleteModalInfoRow}>
                  <View style={styles.deleteModalInfoIconWrap}>
                    <Ionicons name="time-outline" size={18} color={GOLD} />
                  </View>
                  <View style={styles.deleteModalInfoTextCol}>
                    <Text style={styles.deleteModalInfoTitle}>Order History</Text>
                    <Text style={styles.deleteModalInfoBody}>All your favorite tacos and past memories.</Text>
                  </View>
                </View>
                <View style={styles.deleteModalInfoRow}>
                  <View style={styles.deleteModalInfoIconWrap}>
                    <Ionicons name="gift-outline" size={18} color={GOLD} />
                  </View>
                  <View style={styles.deleteModalInfoTextCol}>
                    <Text style={styles.deleteModalInfoTitle}>Rewards &amp; Points</Text>
                    <Text style={styles.deleteModalInfoBody}>Your current status and unused salsa tokens.</Text>
                  </View>
                </View>
                <View style={styles.deleteModalInfoRow}>
                  <View style={styles.deleteModalInfoIconWrap}>
                    <Ionicons name="location-outline" size={18} color={GOLD} />
                  </View>
                  <View style={styles.deleteModalInfoTextCol}>
                    <Text style={styles.deleteModalInfoTitle}>Saved Addresses</Text>
                    <Text style={styles.deleteModalInfoBody}>Your home, office, and secret snack spots.</Text>
                  </View>
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.deleteModalPrimaryBtn,
                  pressed && styles.deleteModalBtnPressed,
                ]}
                onPress={() => setDeleteAccountModalVisible(false)}
              >
                <Text style={styles.deleteModalPrimaryText}>Keep My Account</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.deleteModalDangerBtn,
                  pressed && styles.deleteModalBtnPressed,
                ]}
                onPress={() => void handleDeleteAccount()}
                disabled={deletingAccount}
              >
                <Text style={[styles.deleteModalDangerText, deletingAccount && styles.deleteModalDangerTextDisabled]}>
                  {deletingAccount ? 'Deleting…' : 'Delete My Profile'}
                </Text>
              </Pressable>
            </Pressable>
          </SafeAreaView>
        </Modal>
      ) : null}

      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            { bottom: insets.bottom + 88 },
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
  },
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1F403C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.5)',
  },
  avatarInitials: {
    fontSize: 17,
    fontWeight: '700',
    color: GOLD,
  },
  headerTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  headerRight: {
    marginLeft: 8,
  },
  signInButton: {
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInText: {
    fontSize: 13,
    fontWeight: '700',
    color: BG_DARK,
  },
  listCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  listLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  listSubLabel: {
    fontSize: 11,
    color: MUTED_TEXT,
    marginTop: 2,
  },
  listDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  deleteAccountSection: {
    marginTop: 14,
  },
  deleteAccountButton: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteAccountText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FF8080',
  },
  deleteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 29, 27, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: CARD_BG,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.16)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 14,
  },
  deleteModalIconCircle: {
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 10,
  },
  deleteModalIconInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(252, 165, 165, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(252, 165, 165, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_WHITE,
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteModalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: MUTED_TEXT,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  deleteModalInfoList: {
    gap: 10,
    marginBottom: 14,
  },
  deleteModalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  deleteModalInfoIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(254, 203, 77, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalInfoTextCol: {
    flex: 1,
    minWidth: 0,
  },
  deleteModalInfoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT_WHITE,
    marginBottom: 2,
  },
  deleteModalInfoBody: {
    fontSize: 12,
    fontWeight: '500',
    color: MUTED_TEXT,
    lineHeight: 17,
  },
  deleteModalPrimaryBtn: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  deleteModalPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: BG_DARK,
  },
  deleteModalDangerBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 128, 128, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalDangerText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FF8080',
  },
  deleteModalDangerTextDisabled: {
    opacity: 0.7,
  },
  deleteModalBtnPressed: {
    opacity: 0.88,
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
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});
