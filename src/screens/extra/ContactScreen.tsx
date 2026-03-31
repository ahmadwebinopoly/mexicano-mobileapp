import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebView = require('react-native-webview').WebView;
import { getVisit, submitContact, type VisitDayHours } from '../../api/content';
import { ContactScreenSkeleton } from '../../components/skeleton';

const TAB_BG = '#152C29';
const BG_DARK = '#0B1D1B';
const CARD_BG = '#1F403C';
const ACTIVE = '#FFC107';
const INACTIVE = '#FFFFFF';
const HORIZONTAL_PADDING = 20;
const PLACEHOLDER_COLOR = 'rgba(255,255,255,0.5)';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 200;
const MAP_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - 32;

const DAYS_ORDER: string[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatHours(hours: VisitDayHours | undefined): string {
  if (!hours || !hours.open || !hours.close) return '—';
  return `${hours.open} to ${hours.close}`;
}

type ContactErrors = { name?: string; phone?: string; email?: string; subject?: string; message?: string };

export default function ContactScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showContactSkeleton, setShowContactSkeleton] = useState(true);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [visitLoading, setVisitLoading] = useState(true);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [visit, setVisit] = useState<any>(null);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const submitStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowContactSkeleton(false), 200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!submitStatus) return;
    if (submitStatusTimerRef.current) clearTimeout(submitStatusTimerRef.current);
    submitStatusTimerRef.current = setTimeout(() => setSubmitStatus(null), 2600);
    return () => {
      if (submitStatusTimerRef.current) clearTimeout(submitStatusTimerRef.current);
      submitStatusTimerRef.current = null;
    };
  }, [submitStatus]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) {
          setVisitLoading(true);
          setVisitError(null);
        }
        const data = await getVisit();
        if (!cancelled) setVisit(data);
      } catch (e) {
        if (!cancelled) {
          setVisitError(e instanceof Error ? e.message : 'Failed to load visit info');
          setVisit(null);
        }
      } finally {
        if (!cancelled) setVisitLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const location = visit?.location ?? null;
  const hours = visit?.hours ?? {};

  const mapsUrl = useMemo(
    () => location?.mapsUrl || 'https://maps.google.com/maps?q=Mexicano+restaurant&output=embed',
    [location?.mapsUrl]
  );

  const mapHtml = useMemo(
    () =>
      `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    iframe { width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <iframe src="${mapsUrl}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
</body>
</html>
    `.trim(),
    [mapsUrl]
  );

  const handleOpenMap = useCallback(() => {
    const openUrl = mapsUrl.replace(/&output=embed/, '');
    Linking.openURL(openUrl).catch(() => {});
  }, [mapsUrl]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();

    const nextErrors: ContactErrors = {};
    if (!trimmedName) nextErrors.name = 'Name is required.';
    if (!trimmedPhone) nextErrors.phone = 'Phone number is required.';
    if (!trimmedEmail) nextErrors.email = 'Email address is required.';
    else if (!EMAIL_REGEX.test(trimmedEmail)) nextErrors.email = 'Please enter a valid email address.';
    if (!trimmedSubject) nextErrors.subject = 'Subject is required.';
    if (!trimmedMessage) nextErrors.message = 'Short message is required.';
    setErrors(nextErrors);
    setSubmitStatus(null);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await submitContact({
        name: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
      });
      setName('');
      setPhone('');
      setEmail('');
      setSubject('');
      setMessage('');
      setErrors({});
      setSubmitStatus({ type: 'success', message: 'Thank you! Your message has been sent.' });
    } catch (e) {
      setSubmitStatus({ type: 'error', message: e instanceof Error ? e.message : 'Failed to submit' });
    } finally {
      setSubmitting(false);
    }
  }, [EMAIL_REGEX, email, message, name, phone, subject, submitting]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.content}>
        {showContactSkeleton ? (
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
              contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.heroTitle}>Get in Touch</Text>
              <Text style={styles.heroSubtitle}>
                Whether you have a question about our menu or want to share feedback, we&apos;re here to listen.
              </Text>

              <View style={styles.formCard}>
                <View style={styles.formGrid}>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.label}>Enter Name</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your Name"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        setErrors((prev) => ({ ...prev, name: undefined }));
                      }}
                      editable={!submitting}
                    />
                    {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={phone}
                      onChangeText={(v) => {
                        setPhone(v);
                        setErrors((prev) => ({ ...prev, phone: undefined }));
                      }}
                      keyboardType="phone-pad"
                      editable={!submitting}
                    />
                    {errors.phone ? <Text style={styles.fieldError}>{errors.phone}</Text> : null}
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Your Email"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={email}
                      onChangeText={(v) => {
                        setEmail(v);
                        setErrors((prev) => ({ ...prev, email: undefined }));
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!submitting}
                    />
                    {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
                  </View>
                  <View style={styles.fieldHalf}>
                    <Text style={styles.label}>Subject</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Subject"
                      placeholderTextColor={PLACEHOLDER_COLOR}
                      value={subject}
                      onChangeText={(v) => {
                        setSubject(v);
                        setErrors((prev) => ({ ...prev, subject: undefined }));
                      }}
                      editable={!submitting}
                    />
                    {errors.subject ? <Text style={styles.fieldError}>{errors.subject}</Text> : null}
                  </View>
                </View>

                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={[styles.input, styles.messageInput]}
                  placeholder="Message"
                  placeholderTextColor={PLACEHOLDER_COLOR}
                  value={message}
                  onChangeText={(v) => {
                    setMessage(v);
                    setErrors((prev) => ({ ...prev, message: undefined }));
                  }}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!submitting}
                />
                {errors.message ? <Text style={styles.fieldError}>{errors.message}</Text> : null}

                <Pressable
                  style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={TAB_BG} />
                  ) : (
                    <Text style={styles.submitButtonText}>SEND MESSAGE</Text>
                  )}
                </Pressable>
                {submitStatus ? (
                  <Text
                    style={[
                      styles.submitStatus,
                      submitStatus.type === 'success' ? styles.submitStatusSuccess : styles.submitStatusError,
                    ]}
                  >
                    {submitStatus.message}
                  </Text>
                ) : null}
              </View>

              <Text style={styles.visitTitle}>Visit Us</Text>
              <View style={styles.visitCard}>
                {visitLoading ? (
                  <Text style={styles.visitMuted}>Loading location…</Text>
                ) : visitError ? (
                  <Text style={styles.visitMuted}>{visitError}</Text>
                ) : (
                  <>
                    <View style={styles.mapContainer}>
                      <WebView
                        source={{ html: mapHtml }}
                        style={[styles.map, { width: MAP_WIDTH, height: MAP_HEIGHT }]}
                        javaScriptEnabled
                        domStorageEnabled
                        originWhitelist={['*']}
                        mixedContentMode="compatibility"
                        scrollEnabled={false}
                      />
                    </View>
                    <Pressable style={styles.mapLink} onPress={handleOpenMap}>
                      <Text style={styles.mapLinkText}>View larger map</Text>
                    </Pressable>

                    <View style={styles.visitMeta}>
                      <Text style={styles.visitName}>{location?.name || 'Mexicano'}</Text>
                      <Text style={styles.visitAddress} numberOfLines={3}>
                        {[location?.address, location?.city, location?.state, location?.zip].filter(Boolean).join(', ') || '—'}
                      </Text>
                    </View>

                    <View style={styles.hoursBox}>
                      <Text style={styles.hoursTitle}>Timing</Text>
                      {DAYS_ORDER.map((day) => {
                        const dayHours = hours?.[day];
                        const isOpen = dayHours?.isOpen ?? false;
                        return (
                          <View key={day} style={styles.hoursRow}>
                            <Text style={styles.hoursDay}>{day}</Text>
                            <Text style={styles.hoursTime}>
                              {isOpen ? formatHours(dayHours) : 'Closed'}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: TAB_BG,
  },
  content: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 12,
    paddingBottom: 24,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: INACTIVE,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 16,
    lineHeight: 18,
  },
  keyboardView: {
    flex: 1,
  },
  formCard: {
    backgroundColor: BG_DARK,
    borderRadius: 14,
    padding: 0,
    marginBottom: 18,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  fieldHalf: {
    width: '48%',
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
  fieldError: {
    marginTop: -8,
    marginBottom: 12,
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(239, 68, 68, 0.95)',
  },
  messageInput: {
    minHeight: 140,
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
  submitStatus: {
    marginTop: -10,
    marginBottom: 16,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  submitStatusSuccess: {
    color: 'rgba(34, 197, 94, 0.95)',
  },
  submitStatusError: {
    color: 'rgba(239, 68, 68, 0.95)',
  },
  visitTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: INACTIVE,
    marginBottom: 10,
    marginTop: 8,
  },
  visitCard: {
    backgroundColor: TAB_BG,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.22)',
    marginBottom: 24,
  },
  visitMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
  },
  mapContainer: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.18)',
    backgroundColor: CARD_BG,
  },
  map: {
    backgroundColor: CARD_BG,
  },
  mapLink: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  mapLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: ACTIVE,
  },
  visitMeta: {
    marginTop: 12,
  },
  visitName: {
    fontSize: 14,
    fontWeight: '800',
    color: INACTIVE,
    marginBottom: 4,
  },
  visitAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    lineHeight: 16,
  },
  hoursBox: {
    marginTop: 14,
    backgroundColor: BG_DARK,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.14)',
  },
  hoursTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: INACTIVE,
    marginBottom: 8,
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  hoursDay: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  hoursTime: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
  },
});
