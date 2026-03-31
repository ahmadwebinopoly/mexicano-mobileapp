import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { resetPassword } from '../../api/auth';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const PLACEHOLDER = 'rgba(255,255,255,0.5)';
const HORIZONTAL_PADDING = 20;

export default function SetNewPasswordScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();

  const token = String(route?.params?.token ?? '').trim();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inlineMsg, setInlineMsg] = useState(null);
  const inlineTimerRef = useRef(null);

  useEffect(() => {
    if (!inlineMsg) return;
    if (inlineTimerRef.current) clearTimeout(inlineTimerRef.current);
    inlineTimerRef.current = setTimeout(() => setInlineMsg(null), 2600);
    return () => {
      if (inlineTimerRef.current) clearTimeout(inlineTimerRef.current);
      inlineTimerRef.current = null;
    };
  }, [inlineMsg]);

  const showInline = (message, type) => setInlineMsg({ message, type });

  const handleUpdate = async () => {
    if (submitting) return;
    const pw = String(password ?? '');
    const cpw = String(confirmPassword ?? '');

    if (!token) {
      showInline('Reset token required', 'error');
      return;
    }
    if (!pw || pw.length < 8) {
      showInline('Password must be at least 8 characters', 'error');
      return;
    }
    if (pw !== cpw) {
      showInline('Passwords do not match', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({ token, password: pw });
      showInline('Password updated successfully', 'success');
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        if (navigation.canGoBack?.()) navigation.goBack();
        else navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }, 700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      showInline(msg || 'Something went wrong. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => (navigation.canGoBack?.() ? navigation.goBack() : navigation.reset({ index: 0, routes: [{ name: 'Main' }] }))}
            hitSlop={8}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color={BG_DARK} />
          </Pressable>
          <Text style={styles.headerTitle}>Set New Password</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
          <Text style={styles.title}>Create a new password</Text>
          <Text style={styles.subtitle}>Enter and confirm your new password.</Text>

          <Text style={styles.label}>New Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum 8 characters"
            placeholderTextColor={PLACEHOLDER}
            value={password}
            onChangeText={(t) => setPassword(t)}
            secureTextEntry
            editable={!submitting}
          />

          <Text style={[styles.label, { marginTop: 14 }]}>Confirm Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter new password"
            placeholderTextColor={PLACEHOLDER}
            value={confirmPassword}
            onChangeText={(t) => setConfirmPassword(t)}
            secureTextEntry
            editable={!submitting}
          />

          <Pressable
            style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
            onPress={handleUpdate}
            disabled={submitting}
            accessibilityRole="button"
            accessibilityLabel="Update password"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={BG_DARK} />
            ) : (
              <Text style={styles.primaryButtonText}>Update Password</Text>
            )}
          </Pressable>

          {inlineMsg ? (
            <Text style={[styles.inlineText, inlineMsg.type === 'success' ? styles.inlineSuccess : styles.inlineError]}>
              {inlineMsg.message}
            </Text>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DARK },
  flex: { flex: 1 },
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
  headerSpacer: { width: 32 },
  content: { flex: 1, paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 18 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_WHITE,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: MUTED_TEXT,
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18,
  },
  label: { fontSize: 12, fontWeight: '600', color: TEXT_WHITE, marginBottom: 6 },
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
    marginTop: 18,
  },
  primaryButtonDisabled: { opacity: 0.7 },
  primaryButtonText: { fontSize: 14, fontWeight: '700', color: BG_DARK },
  inlineText: { marginTop: 12, fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
  inlineSuccess: { color: 'rgba(34, 197, 94, 0.95)' },
  inlineError: { color: 'rgba(239, 68, 68, 0.95)' },
});

