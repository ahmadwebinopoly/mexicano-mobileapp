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
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const [currentUser, setCurrentUser] = useState<ProfileUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

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

  const handleLogout = async () => {
    await unregisterFromPushNotifications();
    await logoutApi().catch(() => {});
    setCurrentUser(null);
    showToast('Signed out.', 'success');
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

        {/* Settings list */}
        <View style={styles.listCard}>
          <Pressable
            style={styles.listItem}
            onPress={() => {
              if (currentUser) {
                navigation.getParent()?.navigate('Orders');
              } else {
                showToast('Please login first', 'error');
              }
            }}
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
            onPress={() => {
              if (currentUser) {
                navigation.getParent()?.navigate('Address');
              } else {
                showToast('Please login first', 'error');
              }
            }}
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
            onPress={() => setLanguageModalVisible(true)}
          >
            <View>
              <Text style={styles.listLabel}>Language</Text>
              <Text style={styles.listSubLabel}>English</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED_TEXT} />
          </Pressable>
        </View>
      </ScrollView>

      {/* Language modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <Pressable
          style={styles.languageModalBackdrop}
          onPress={() => setLanguageModalVisible(false)}
        >
          <Pressable style={styles.languageModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.languageModalIconWrap}>
              <Ionicons name="language-outline" size={40} color={GOLD} />
            </View>
            <Text style={styles.languageModalTitle}>Language</Text>
            <Text style={styles.languageModalSubtitle}>Choose your preferred language</Text>

            <View style={styles.languageModalOptions}>
              <View style={styles.languageModalOption}>
                <Text style={styles.languageModalOptionLabel}>English</Text>
                <View style={styles.languageModalOptionMeta}>
                  <Text style={styles.languageModalOptionMetaText}>Currently selected</Text>
                  <Ionicons name="checkmark-circle" size={22} color={GOLD} />
                </View>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.languageModalDoneBtn,
                pressed && styles.languageModalBtnPressed,
              ]}
              onPress={() => setLanguageModalVisible(false)}
            >
              <Text style={styles.languageModalDoneText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

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
  languageModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 29, 27, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  languageModalCard: {
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
  languageModalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(254, 203, 77, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  languageModalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: TEXT_WHITE,
    textAlign: 'center',
    marginBottom: 6,
  },
  languageModalSubtitle: {
    fontSize: 13,
    color: MUTED_TEXT,
    textAlign: 'center',
    marginBottom: 22,
  },
  languageModalOptions: {
    marginBottom: 22,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(11, 29, 27, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  languageModalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  languageModalOptionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  languageModalOptionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageModalOptionMetaText: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  languageModalDoneBtn: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageModalDoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: BG_DARK,
  },
  languageModalBtnPressed: {
    opacity: 0.85,
  },
});
