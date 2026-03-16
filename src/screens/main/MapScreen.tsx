import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveAddress } from '../../api/saveadresss';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';

const HORIZONTAL_PADDING = 20;

type MapRouteParams = {
  latitude: number;
  longitude: number;
  formattedAddress: string;
};

export default function MapScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { latitude, longitude, formattedAddress }: MapRouteParams = route.params;

  const [region, setRegion] = useState<Region>({
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [selectedCoords, setSelectedCoords] = useState({
    latitude,
    longitude,
  });

  const [addressLabel, setAddressLabel] = useState<string>(
    formattedAddress || 'Selected location',
  );
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [placeData, setPlaceData] = useState<{
    city?: string;
    state?: string;
    zipCode?: string;
    street?: string;
  }>({});
  const geocodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      setGeocoding(true);
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results && results.length > 0) {
        const place = results[0];
        const parts = [
          place.name,
          place.street,
          place.city ?? place.subregion,
          place.region,
          place.postalCode,
          place.country,
        ]
          .map((p) => (p ? String(p).trim() : ''))
          .filter(Boolean);
        if (parts.length > 0) {
          setAddressLabel(parts.join(', '));
        }
        setPlaceData({
          city: place.city ?? place.subregion ?? undefined,
          state: place.region ?? undefined,
          zipCode: place.postalCode ?? undefined,
          street: place.street ?? undefined,
        });
      } else {
        setAddressLabel('Selected location');
        setPlaceData({});
      }
    } catch (error) {
      setAddressLabel('Selected location');
      setPlaceData({});
    } finally {
      setGeocoding(false);
    }
  };

  const handleRegionChangeComplete = (nextRegion: Region) => {
    setRegion(nextRegion);
    setSelectedCoords({
      latitude: nextRegion.latitude,
      longitude: nextRegion.longitude,
    });

    if (geocodeTimeoutRef.current) {
      clearTimeout(geocodeTimeoutRef.current);
    }

    geocodeTimeoutRef.current = setTimeout(() => {
      void reverseGeocode(nextRegion.latitude, nextRegion.longitude);
    }, 600);
  };

  useEffect(() => {
    void reverseGeocode(latitude, longitude);
  }, []);

  useEffect(() => {
    return () => {
      if (geocodeTimeoutRef.current) {
        clearTimeout(geocodeTimeoutRef.current);
      }
    };
  }, []);

  const handleSaveAddress = async () => {
    if (saving) return;

    try {
      setSaving(true);

      const payload = {
        latitude: selectedCoords.latitude,
        longitude: selectedCoords.longitude,
        address: addressLabel,
        city: placeData.city,
        state: placeData.state,
        zipCode: placeData.zipCode,
      };
      const data = await saveAddress(payload);

      const merged = { ...payload, ...data };
      await AsyncStorage.setItem('userAddress', JSON.stringify(merged));

      Alert.alert('Success', 'Address saved successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Address', { savedAddress: merged }),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Could not save address. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          initialRegion={region}
          onRegionChangeComplete={handleRegionChangeComplete}
        >
          <Marker coordinate={selectedCoords} />
        </MapView>
      </View>

      {/* Bottom card */}
      <View style={styles.bottomCard}>
        <Text style={styles.bottomTitle}>Selected address</Text>
        <Text style={styles.bottomAddress} numberOfLines={2}>
          {addressLabel}
        </Text>
        {geocoding ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={GOLD} />
            <Text style={styles.statusText}>Updating address…</Text>
          </View>
        ) : null}

        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveAddress}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={BG_DARK} />
          ) : (
            <Text style={styles.saveButtonText}>Save Address</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  bottomCard: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 24,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bottomTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 4,
  },
  bottomAddress: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusText: {
    marginLeft: 8,
    fontSize: 13,
    color: MUTED_TEXT,
  },
  saveButton: {
    marginTop: 4,
    backgroundColor: GOLD,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: BG_DARK,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
});

