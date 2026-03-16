import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { register as registerApi, login as loginApi } from '../../api/auth';
import { getCurrentUser } from '../../api/profile';
import { registerForPushNotifications } from '../../services/pushNotifications';

const TOAST_DURATION = 2800;

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

type AuthTab = 'Login' | 'Register';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;



export default function LoginRegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [authTab, setAuthTab] = useState<AuthTab>('Login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

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

  const handleLogin = async () => {
    const email = loginEmail.trim();
    const password = loginPassword.trim();
    if (!email || !password) {
      showToast('Please enter email and password.', 'error');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    setLoginSubmitting(true);
    try {
      await loginApi({ email, password });
      await getCurrentUser();
      void registerForPushNotifications();
      setLoginEmail('');
      setLoginPassword('');
      showToast('Signed in successfully.', 'success');
      setTimeout(() => navigation.goBack(), 800);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Login failed.', 'error');
    } finally {
      setLoginSubmitting(false);
    }
  };



  const handleRegister = async () => {
    const email = regEmail.trim();
    const password = regPassword.trim();
    if (!email || !password) {
      showToast('Please enter email and password.', 'error');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }
    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    setRegSubmitting(true);
    try {
      await registerApi({
        name: regName.trim() || undefined,
        phone: regPhone.trim() || undefined,
        email,
        password,
      });
      setRegName('');
      setRegPhone('');
      setRegEmail('');
      setRegPassword('');
      showToast('Account created successfully.', 'success');
      setTimeout(() => setAuthTab('Login'), 600);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Registration failed.', 'error');
    } finally {
      setRegSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={BG_DARK} />
          </Pressable>
          <Text style={styles.headerTitle}>Login / Register</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.authTabBar}>
          <Pressable
            style={[styles.authTab, authTab === 'Login' && styles.authTabActive]}
            onPress={() => setAuthTab('Login')}
          >
            <Text style={[styles.authTabText, authTab === 'Login' && styles.authTabTextActive]}>
              Login
            </Text>
          </Pressable>
          <Pressable
            style={[styles.authTab, authTab === 'Register' && styles.authTabActive]}
            onPress={() => setAuthTab('Register')}
          >
            <Text style={[styles.authTabText, authTab === 'Register' && styles.authTabTextActive]}>
              Register
            </Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {authTab === 'Login' ? (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor={MUTED_TEXT}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  editable={!loginSubmitting}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={MUTED_TEXT}
                  secureTextEntry
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  editable={!loginSubmitting}
                />
              </View>
              <Pressable
                style={[styles.primaryButton, loginSubmitting && styles.primaryButtonDisabled]}
                onPress={handleLogin}
                disabled={loginSubmitting}
              >
                {loginSubmitting ? (
                  <ActivityIndicator size="small" color={BG_DARK} />
                ) : (
                  <Text style={styles.primaryButtonText}>Log In</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <Pressable
                  style={styles.socialButton}
                  onPress={() => {
                    showToast('Google login coming soon', 'error');
                  }}
                >
                  <FontAwesome name="google" size={20} color="#DB4437" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>
                <Pressable
                  style={styles.socialButton}
                  onPress={() => {
                    showToast('Facebook login coming soon', 'error');
                  }}
                >
                  <FontAwesome name="facebook" size={20} color="#1877F2" />
                  <Text style={styles.socialButtonText}>Facebook</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={MUTED_TEXT}
                  value={regName}
                  onChangeText={setRegName}
                  editable={!regSubmitting}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={MUTED_TEXT}
                  keyboardType="phone-pad"
                  value={regPhone}
                  onChangeText={setRegPhone}
                  editable={!regSubmitting}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="john@example.com"
                  placeholderTextColor={MUTED_TEXT}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={regEmail}
                  onChangeText={setRegEmail}
                  editable={!regSubmitting}
                />
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={MUTED_TEXT}
                  secureTextEntry
                  value={regPassword}
                  onChangeText={setRegPassword}
                  editable={!regSubmitting}
                />
              </View>
              <Pressable
                style={[styles.primaryButton, regSubmitting && styles.primaryButtonDisabled]}
                onPress={handleRegister}
                disabled={regSubmitting}
              >
                {regSubmitting ? (
                  <ActivityIndicator size="small" color={BG_DARK} />
                ) : (
                  <Text style={styles.primaryButtonText}>Register</Text>
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <Pressable
                  style={styles.socialButton}
                  onPress={() => {
                    showToast('Google login coming soon', 'error');
                  }}
                >
                  <FontAwesome name="google" size={20} color="#DB4437" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>
                <Pressable
                  style={styles.socialButton}
                  onPress={() => {
                    showToast('Facebook login coming soon', 'error');
                  }}
                >
                  <FontAwesome name="facebook" size={20} color="#1877F2" />
                  <Text style={styles.socialButtonText}>Facebook</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

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
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    width: 40,
  },
  authTabBar: {
    flexDirection: 'row',
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 20,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.25)',
  },
  authTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  authTabActive: {
    backgroundColor: 'rgba(254,203,77,0.25)',
  },
  authTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED_TEXT,
  },
  authTabTextActive: {
    color: GOLD,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 32,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 6,
  },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.25)',
    fontSize: 13,
    color: TEXT_WHITE,
  },
  primaryButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: BG_DARK,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
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
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    fontWeight: '500',
    color: MUTED_TEXT,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.25)',
  },
  socialButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
});
