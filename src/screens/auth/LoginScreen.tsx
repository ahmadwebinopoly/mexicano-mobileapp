import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { login as loginApi, googleAuthCodeLogin } from '../../api/auth';
import { getCurrentUser } from '../../api/profile';
import { registerForPushNotifications } from '../../services/pushNotifications';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
/** Same horizontal padding as OrdersScreen / ViewOrderDetailsScreen */
const HORIZONTAL_PADDING = 20;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_CLIENT_ID = '323254530748-5ckfnahana1p9sllilmnv9v9mfjqpjch.apps.googleusercontent.com';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true,
    projectNameForProxy: '@asad133/MexicanoApp',
  } as any);

  const discovery = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Code,
      usePKCE: false,
      extraParams: {
        access_type: 'offline',
      },
    },
    discovery
  );

  const handleLogin = async () => {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) return;
    if (!EMAIL_REGEX.test(e)) return;
    setSubmitting(true);
    try {
      await loginApi({ email: e, password: p });
      await getCurrentUser();
      void registerForPushNotifications();
      navigation.getParent()?.goBack();
    } catch {
      /* toast handled elsewhere if needed */
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    console.log('=== GOOGLE DEBUG ===');
    console.log('Client ID:', '323254530748-5ckfnahana1p9sllilmnv9v9mfjqpjch.apps.googleusercontent.com');
    console.log('Redirect URI:', redirectUri);
    console.log('Request object:', request);
    alert('RedirectURI: ' + redirectUri);

    if (googleSubmitting) return;

    setGoogleSubmitting(true);
    try {
      const result = await promptAsync({ useProxy: true } as any);

      if (!result || result.type !== 'success') {
        console.log('Google sign-in cancelled.');
        return;
      }

      const code =
        String((result as any)?.params?.code ?? '').trim() ||
        String((response as any)?.params?.code ?? '').trim();
      if (!code) {
        console.log('Google sign-in missing code.');
        return;
      }

      await googleAuthCodeLogin({ code, redirectUri });
      await getCurrentUser();
      void registerForPushNotifications();
      navigation.getParent()?.goBack();
    } catch (e) {
      console.log('Google sign-in failed', e);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.getParent()?.goBack()}
            hitSlop={8}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={BG_DARK} />
          </Pressable>
          <Text style={styles.headerTitle}>Login</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="john@example.com"
              placeholderTextColor={MUTED_TEXT}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              editable={!submitting}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Enter your password"
                placeholderTextColor={MUTED_TEXT}
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={setPassword}
                editable={!submitting}
              />
              <Pressable
                style={styles.eyeButton}
                onPress={() => setPasswordVisible((v) => !v)}
                hitSlop={8}
                accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color={MUTED_TEXT}
                />
              </Pressable>
            </View>
          </View>
          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={() => void handleLogin()}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={BG_DARK} />
            ) : (
              <Text style={styles.primaryButtonText}>Log In</Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            style={styles.socialButton}
            onPress={() => void handleGoogleLogin()}
            disabled={googleSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            {googleSubmitting ? (
              <ActivityIndicator size="small" color={GOLD} />
            ) : (
              <Ionicons name="logo-google" size={18} color={TEXT_WHITE} />
            )}
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </Pressable>

          <Pressable style={styles.linkRow} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>Create an account</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  flex: {
    flex: 1,
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
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 10,
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
  primaryButton: {
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: BG_DARK,
  },
  linkRow: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: GOLD,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    marginBottom: 16,
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
  socialButton: {
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
