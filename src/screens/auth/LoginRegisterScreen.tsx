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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList } from '../../navigation/RootNavigator';
import { Ionicons } from '@expo/vector-icons';
import { register as registerApi, login as loginApi, googleSocialLogin } from '../../api/auth';
import { getCurrentUser } from '../../api/profile';
import { registerForPushNotifications } from '../../services/pushNotifications';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

const TOAST_DURATION = 2800;

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[\d\s\-()]{7,20}$/;

function normalizeLoginErrorMessage(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  if (/invalid|credential|unauthorized|401|wrong password|incorrect password|user not found/i.test(msg)) {
    return 'Please enter valid credentials';
  }
  return msg || 'Login failed.';
}



export default function LoginRegisterScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'LoginRegister'>>();
  const returnTo = route.params?.returnTo;
  /** false = login (default), true = register form */
  const [showRegister, setShowRegister] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordVisible, setRegPasswordVisible] = useState(false);
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [regErrors, setRegErrors] = useState<{
    name?: string;
    phone?: string;
    email?: string;
    password?: string;
  }>({});

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

  const navigateAfterSuccessfulAuth = () => {
    if (returnTo === 'Checkout') {
      navigation.reset({
        index: 1,
        routes: [{ name: 'Main' }, { name: 'Checkout' }],
      });
      return;
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  // Google OAuth client id is public in the mobile app bundle.
  // The client secret must stay server-side.
  const googleClientId =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_GOOGLE_CLIENT_ID) || '';

  WebBrowser.maybeCompleteAuthSession();

  // Must match `scheme` in `app.config.js` so Google can redirect back into the app.
  const redirectUri = makeRedirectUri({ scheme: 'mexicanoapp' });

  // PKCE is required for many mobile OAuth security policies.
  const [, , promptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
    redirectUri,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
  });

  const handleGoogleSocialLogin = async () => {
    if (googleSubmitting) return;

    if (!googleClientId) {
      showToast('Google client id is missing in env.', 'error');
      return;
    }

    setGoogleSubmitting(true);
    try {
      const result = await promptAsync();
      if (!result || result.type !== 'success') {
        showToast('Google sign-in cancelled.', 'error');
        return;
      }

      const accessToken = result.authentication?.accessToken;
      if (!accessToken) {
        throw new Error('Google sign-in failed. Missing access token.');
      }

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo?alt=json', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!profileRes.ok) {
        const text = await profileRes.text().catch(() => '');
        throw new Error(text || `Google profile fetch failed: ${profileRes.status}`);
      }

      const profile = await profileRes.json().catch(() => ({})) as {
        id?: string | number;
        email?: string;
        name?: string;
        picture?: string;
      };

      const email = profile.email ?? '';
      const name = profile.name ?? '';
      const provider_id = profile.id != null ? String(profile.id) : '';
      const avatar = profile.picture ?? undefined;

      await googleSocialLogin({ email, name, provider_id, avatar });
      await getCurrentUser();
      void registerForPushNotifications();

      showToast('Signed in with Google successfully.', 'success');
      setTimeout(() => navigateAfterSuccessfulAuth(), 800);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Google sign-in failed.', 'error');
    } finally {
      setGoogleSubmitting(false);
    }
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
      setTimeout(() => navigateAfterSuccessfulAuth(), 800);
    } catch (e) {
      showToast(normalizeLoginErrorMessage(e), 'error');
    } finally {
      setLoginSubmitting(false);
    }
  };



  const handleRegister = async () => {
    const name = regName.trim();
    const phone = regPhone.trim();
    const email = regEmail.trim();
    const password = regPassword.trim();

    const nextErrors: {
      name?: string;
      phone?: string;
      email?: string;
      password?: string;
    } = {};

    if (!name) nextErrors.name = 'Name is required.';
    if (!phone) nextErrors.phone = 'Phone number is required.';
    else if (!PHONE_REGEX.test(phone)) nextErrors.phone = 'Please enter a valid phone number.';
    if (!email) nextErrors.email = 'Email is required.';
    else if (!EMAIL_REGEX.test(email)) nextErrors.email = 'Please enter a valid email address.';
    if (!password) nextErrors.password = 'Password is required.';
    else if (password.length < 6) nextErrors.password = 'Password must be at least 6 characters.';

    if (Object.keys(nextErrors).length > 0) {
      setRegErrors(nextErrors);
      return;
    }

    setRegErrors({});
    setRegSubmitting(true);
    try {
      await registerApi({
        name,
        phone,
        email,
        password,
      });

      // If the backend returns a token on register, `getCurrentUser()` will work immediately.
      // Otherwise, fall back to calling `loginApi()` to obtain a token.
      let user = await getCurrentUser();
      if (!user) {
        await loginApi({ email, password });
        user = await getCurrentUser();
      }

      if (user) {
        void registerForPushNotifications();
      }

      setRegName('');
      setRegPhone('');
      setRegEmail('');
      setRegPassword('');
      setRegErrors({});
      navigateAfterSuccessfulAuth();
    } catch (e) {
      // If auto-login fails, fall back to the login form.
      setShowRegister(false);
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
          <Text style={styles.headerTitle}>{showRegister ? 'Create account' : 'Login'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!showRegister ? (
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
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor={MUTED_TEXT}
                    secureTextEntry={!loginPasswordVisible}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    editable={!loginSubmitting}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setLoginPasswordVisible((v) => !v)}
                    hitSlop={8}
                    accessibilityLabel={loginPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={loginPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={MUTED_TEXT}
                    />
                  </Pressable>
                </View>
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
              <Pressable
                style={styles.secondaryLink}
                onPress={() => setShowRegister(true)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Don't have an account? Please create account"
              >
                <Text style={styles.secondaryLinkLine}>
                  <Text style={styles.secondaryLinkPrefix}>Don&apos;t have an account? </Text>
                  <Text style={styles.secondaryLinkEmphasis}>Please create account</Text>
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={MUTED_TEXT}
                  value={regName}
                  onChangeText={(t) => {
                    setRegName(t);
                    if (regErrors.name) {
                      setRegErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  editable={!regSubmitting}
                />
                {regErrors.name ? <Text style={styles.fieldErrorText}>{regErrors.name}</Text> : null}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+1 555 123 4567"
                  placeholderTextColor={MUTED_TEXT}
                  keyboardType="phone-pad"
                  value={regPhone}
                  onChangeText={(t) => {
                    setRegPhone(t);
                    if (regErrors.phone) {
                      setRegErrors((prev) => ({ ...prev, phone: undefined }));
                    }
                  }}
                  editable={!regSubmitting}
                />
                {regErrors.phone ? <Text style={styles.fieldErrorText}>{regErrors.phone}</Text> : null}
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
                  onChangeText={(t) => {
                    setRegEmail(t);
                    if (regErrors.email) {
                      setRegErrors((prev) => ({ ...prev, email: undefined }));
                    }
                  }}
                  editable={!regSubmitting}
                />
                {regErrors.email ? <Text style={styles.fieldErrorText}>{regErrors.email}</Text> : null}
              </View>
              <View style={styles.formGroup}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Minimum 6 characters"
                    placeholderTextColor={MUTED_TEXT}
                    secureTextEntry={!regPasswordVisible}
                    value={regPassword}
                    onChangeText={(t) => {
                      setRegPassword(t);
                      if (regErrors.password) {
                        setRegErrors((prev) => ({ ...prev, password: undefined }));
                      }
                    }}
                    editable={!regSubmitting}
                  />
                  <Pressable
                    style={styles.eyeButton}
                    onPress={() => setRegPasswordVisible((v) => !v)}
                    hitSlop={8}
                    accessibilityLabel={regPasswordVisible ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons
                      name={regPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={22}
                      color={MUTED_TEXT}
                    />
                  </Pressable>
                </View>
                {regErrors.password ? <Text style={styles.fieldErrorText}>{regErrors.password}</Text> : null}
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
              <Pressable
                style={styles.secondaryLinkMuted}
                onPress={() => setShowRegister(false)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Already have an account? Sign in"
              >
                <Text style={styles.secondaryLinkLine}>
                  <Text style={styles.secondaryLinkPrefix}>Already have an account? </Text>
                  <Text style={styles.secondaryLinkEmphasis}>Sign in</Text>
                </Text>
              </Pressable>
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
  secondaryLink: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  secondaryLinkLine: {
    textAlign: 'center',
    lineHeight: 22,
  },
  secondaryLinkPrefix: {
    fontSize: 14,
    fontWeight: '500',
    color: MUTED_TEXT,
  },
  secondaryLinkEmphasis: {
    fontSize: 14,
    fontWeight: '700',
    color: GOLD,
  },
  secondaryLinkMuted: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.25)',
    paddingRight: 4,
    minHeight: 48,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 13,
    color: TEXT_WHITE,
  },
  eyeButton: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldErrorText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#FF8A80',
  },
  primaryButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
