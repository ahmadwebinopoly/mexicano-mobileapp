import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { submitContact } from '../../api/content';
import VisitScreen from './VisitScreen';
import { ContactScreenSkeleton } from '../../components/skeleton';

const TOAST_DURATION = 2800;

const TAB_BG = '#152C29';
const BG_DARK = '#0B1D1B';
const CARD_BG = '#1F403C';
const ACTIVE = '#FFC107';
const INACTIVE = '#FFFFFF';
const HORIZONTAL_PADDING = 20;
const PLACEHOLDER_COLOR = 'rgba(255,255,255,0.5)';

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'Contact' | 'Visit'>('Contact');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [showContactSkeleton, setShowContactSkeleton] = useState(true);
  const [hasOpenedVisit, setHasOpenedVisit] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowContactSkeleton(false), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(TOAST_DURATION - 400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [toast, toastOpacity]);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  }, []);

  const onTabChange = useCallback((tab: 'Contact' | 'Visit') => {
    setActiveTab(tab);
    if (tab === 'Visit') setHasOpenedVisit(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedPhone || !trimmedEmail) {
      showToast('Please enter both phone number and email.', 'error');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitContact({
        phone: trimmedPhone,
        email: trimmedEmail,
        message: message.trim() || undefined,
      });
      setPhone('');
      setEmail('');
      setMessage('');
      showToast('Thank you! Your message has been sent.', 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [email, message, phone, showToast, submitting]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Contact' && styles.tabActive]}
          onPress={() => onTabChange('Contact')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, activeTab === 'Contact' && styles.tabLabelActive]}>
            Contact
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'Visit' && styles.tabActive]}
          onPress={() => onTabChange('Visit')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabLabel, activeTab === 'Visit' && styles.tabLabelActive]}>
            Visit
          </Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {activeTab === 'Contact' ? (
          showContactSkeleton ? (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <ContactScreenSkeleton />
            </ScrollView>
          ) : (
          <KeyboardAvoidingView
            style={styles.keyboardView}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.title}>Contact Details</Text>

              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. +1 234 567 8900"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                editable={!submitting}
              />

              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. hello@example.com"
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!submitting}
              />

              <Text style={styles.label}>Short Message</Text>
              <TextInput
                style={[styles.input, styles.messageInput]}
                placeholder="Your message..."
                placeholderTextColor={PLACEHOLDER_COLOR}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                editable={!submitting}
              />

              <Pressable
                style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={TAB_BG} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
          )
        ) : null}
        {hasOpenedVisit || activeTab === 'Visit' ? (
          <View style={activeTab === 'Visit' ? styles.visitTabVisible : styles.visitTabHidden} pointerEvents={activeTab === 'Visit' ? 'auto' : 'none'}>
            <VisitScreen />
          </View>
        ) : null}
      </View>

      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            {
              bottom: insets.bottom + 88,
            },
            toast.type === 'success' ? styles.toastSuccess : styles.toastError,
            { opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Text
            style={styles.toastText}
            numberOfLines={2}
          >
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
    backgroundColor: TAB_BG,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  tabActive: {
    backgroundColor: 'rgba(255, 193, 7, 0.2)',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: INACTIVE,
  },
  tabLabelActive: {
    color: ACTIVE,
  },
  content: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  visitTabVisible: {
    flex: 1,
  },
  visitTabHidden: {
    display: 'none',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: INACTIVE,
    marginBottom: 12,
  },
  keyboardView: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: INACTIVE,
    marginBottom: 4,
  },
  input: {
    backgroundColor: CARD_BG,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
    fontSize: 14,
    color: INACTIVE,
  },
  messageInput: {
    minHeight: 80,
    paddingTop: 10,
  },
  submitButton: {
    backgroundColor: ACTIVE,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: TAB_BG,
  },
  toast: {
    position: 'absolute',
    left: HORIZONTAL_PADDING,
    right: HORIZONTAL_PADDING,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
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
});
