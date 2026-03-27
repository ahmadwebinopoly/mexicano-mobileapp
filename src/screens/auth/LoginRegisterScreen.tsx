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

type AuthTab = 'Login' | 'Register';

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
  const [authTab, setAuthTab] = useState<AuthTab>('Login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
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
      setTimeout(() => navigation.goBack(), 800);
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
      setTimeout(() => navigation.goBack(), 800);
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
      navigation.goBack();
    } catch (e) {
      // If auto-login fails, fall back to showing the Login tab.
      setAuthTab('Login');
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
                    void handleGoogleSocialLogin();
                  }}
                  disabled={googleSubmitting}
                >
                  <FontAwesome name="google" size={20} color="#DB4437" />
                  <Text style={styles.socialButtonText}>Google</Text>
                </Pressable>
                <Pressable
                  style={styles.socialButton}
                  onPress={() => {
                    // Reserved for future Facebook auth integration.
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
                <TextInput
                  style={styles.input}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor={MUTED_TEXT}
                  secureTextEntry
                  value={regPassword}
                  onChangeText={(t) => {
                    setRegPassword(t);
                    if (regErrors.password) {
                      setRegErrors((prev) => ({ ...prev, password: undefined }));
                    }
                  }}
                  editable={!regSubmitting}
                />
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

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <Pressable
                  style={styles.socialButton}
                  onPress={() => {
                    void handleGoogleSocialLogin();
                  }}
                  disabled={googleSubmitting}
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
