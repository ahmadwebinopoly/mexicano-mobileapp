import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebView = require('react-native-webview').WebView;
import { getVisit, type VisitContent, type VisitDayHours } from '../../api/content';
import { VisitScreenSkeleton } from '../../components/skeleton';

const HORIZONTAL_PADDING = 20;
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MAP_HEIGHT = 200;
const MAP_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2 - 32;

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GREEN = '#1F6F4A';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';

const DAYS_ORDER: string[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function formatHours(hours: VisitDayHours | undefined): string {
  if (!hours || !hours.open || !hours.close) return '—';
  return `${hours.open} to ${hours.close}`;
}

export default function VisitScreen() {
  const [visit, setVisit] = useState<VisitContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getVisit();
        if (!cancelled) setVisit(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load visit info');
          setVisit(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const location = visit?.location ?? null;
  const hours = visit?.hours ?? {};

  const mapsUrl = useMemo(
    () =>
      location?.mapsUrl ||
      'https://maps.google.com/maps?q=742+Salsa+Street+Austin+TX&output=embed',
    [location?.mapsUrl]
  );

  const mapHtml = useMemo(() => `
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
  `.trim(), [mapsUrl]);

  const handleOpenMap = useCallback(() => {
    const openUrl = mapsUrl.replace(/&output=embed/, '');
    Linking.openURL(openUrl).catch(() => {});
  }, [mapsUrl]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <VisitScreenSkeleton />
        ) : error ? (
          <View style={styles.errorWrap}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <>
            {/* Store Location */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Store Location</Text>

              <Text style={styles.label}>Restaurant Name</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldText}>{location?.name || '—'}</Text>
              </View>

              <Text style={styles.label}>Full Address</Text>
              <View style={styles.fieldBox}>
                <Text style={styles.fieldText}>
                  {location?.address || '—'}
                </Text>
              </View>

              <View style={styles.row}>
                <View style={styles.rowItem}>
                  <Text style={styles.label}>City</Text>
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldText}>{location?.city || '—'}</Text>
                  </View>
                </View>
                <View style={styles.rowItemSmall}>
                  <Text style={styles.label}>State</Text>
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldText}>{location?.state || '—'}</Text>
                  </View>
                </View>
                <View style={styles.rowItemSmall}>
                  <Text style={styles.label}>Zip Code</Text>
                  <View style={styles.fieldBox}>
                    <Text style={styles.fieldText}>{location?.zip || '—'}</Text>
                  </View>
                </View>
              </View>

              {/* Map embed via iframe in HTML */}
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
              <Pressable
                style={styles.mapLink}
                onPress={handleOpenMap}
              >
                <Text style={styles.mapLinkText}>View larger map</Text>
              </Pressable>
            </View>

            {/* Operating Hours */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Operating Hours</Text>
              {DAYS_ORDER.map((day) => {
                const dayHours = hours[day];
                const isOpen = dayHours?.isOpen ?? false;
                return (
                  <View key={day} style={styles.hoursRow}>
                    <Text style={styles.hoursDay}>{day}</Text>
                    <View
                      style={[
                        styles.badge,
                        isOpen ? styles.badgeOpen : styles.badgeClosed,
                      ]}
                    >
                      <Text style={styles.badgeText}>
                        {isOpen ? 'Open' : 'Closed'}
                      </Text>
                    </View>
                    <Text style={styles.hoursTime}>{formatHours(dayHours)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 6,
    paddingBottom: 24,
  },
  errorWrap: {
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  section: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  fieldBox: {
    backgroundColor: '#1F403C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
  },
  fieldText: {
    fontSize: 13,
    color: TEXT_WHITE,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  rowItem: {
    flex: 1.4,
  },
  rowItemSmall: {
    flex: 1,
  },
  mapContainer: {
    marginTop: 6,
    height: MAP_HEIGHT,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.25)',
  },
  map: {
    backgroundColor: '#1a1a1a',
  },
  mapLink: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  mapLinkText: {
    fontSize: 12,
    color: GOLD,
    fontWeight: '600',
  },
  hoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 4,
    borderRadius: 8,
    backgroundColor: '#1F403C',
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.15)',
  },
  hoursDay: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_WHITE,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginHorizontal: 8,
  },
  badgeOpen: {
    backgroundColor: GREEN,
  },
  badgeClosed: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: TEXT_WHITE,
  },
  hoursTime: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    flex: 1,
    textAlign: 'right',
  },
});
