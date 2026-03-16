import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  useWindowDimensions,
  ScrollView,
  Animated,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrderModes, type OrderModes } from '../api/orderModes';
import { getToken } from '../storagetank';
import { navigateToLoginRegister } from '../navigation/rootNavigationRef';
import { saveAddress, getAllAddresses } from '../api/saveadresss';

const ONBOARDING_ORDER_MODE_KEY = 'onboarding_order_mode';
const ONBOARDING_DELIVERY_ADDRESS_KEY = 'onboarding_delivery_address';
const PENDING_DELIVERY_LOCATION_KEY = 'pending_delivery_location';

interface OnBoardingScreenProps {
  onFinish: () => void;
}

const BG_COLOR = '#152C29';
const TEXT_COLOR = '#FFFFFF';
const BUTTON_BG = '#FECB4D';
const BUTTON_HOVER = '#E5B948';
const CARD_BG = 'rgba(255, 255, 255, 0.08)';
const WAVE_HEIGHT = 100;
const DEFAULT_ORDER_MODES: OrderModes = { delivery: true, dining: true, takeaway: true };

function WaveTop() {
  const { width } = useWindowDimensions();
  const path = `M 0 ${WAVE_HEIGHT} Q ${width * 0.25} 30 ${width * 0.5} 60 T ${width} 50 L ${width} 0 L 0 0 Z`;
  return (
    <Svg
      width={width}
      height={WAVE_HEIGHT}
      style={{ position: 'absolute', top: 0, left: 0, opacity: 0.5 }}
      viewBox={`0 0 ${width} ${WAVE_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Path d={path} fill={TEXT_COLOR} />
    </Svg>
  );
}

function WaveTopLayer2() {
  const { width } = useWindowDimensions();
  const path = `M 0 ${WAVE_HEIGHT} Q ${width * 0.33} 20 ${width * 0.66} 55 T ${width} 45 L ${width} 0 L 0 0 Z`;
  return (
    <Svg
      width={width}
      height={WAVE_HEIGHT}
      style={{ position: 'absolute', top: 0, left: 0, opacity: 0.5 }}
      viewBox={`0 0 ${width} ${WAVE_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Path d={path} fill={TEXT_COLOR} />
    </Svg>
  );
}

const ServiceCard = ({
  icon,
  title,
  description,
  fullWidth,
  selected,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  description: string;
  fullWidth?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.card,
      fullWidth && styles.cardFullWidth,
      selected && styles.cardSelected,
    ]}
  >
    <MaterialIcons name={icon} size={40} color={BUTTON_BG} style={styles.cardIcon} />
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.cardDescription}>{description}</Text>
  </Pressable>
);

type ServiceOption = 'delivery' | 'takeaway' | 'dining' | null;

const SERVICE_OPTIONS: { key: ServiceOption; icon: React.ComponentProps<typeof MaterialIcons>['name']; title: string; description: string }[] = [
  { key: 'delivery', icon: 'delivery-dining', title: 'Delivery', description: 'The Mexicano will bring your order to your door' },
  { key: 'takeaway', icon: 'takeout-dining', title: 'Take away', description: 'We will pack your order and you can pick it up soon' },
  { key: 'dining', icon: 'restaurant', title: 'Dining in place', description: 'Get your order started now and enjoy it as soon as you arrive' },
];

type OnboardingStep = 'choose' | 'delivery_location';

export default function OnBoardingScreen({ onFinish }: OnBoardingScreenProps) {
  const [buttonPressed, setButtonPressed] = useState(false);
  const [selectedOption, setSelectedOption] = useState<ServiceOption>(null);
  const [orderModes, setOrderModes] = useState<OrderModes>(DEFAULT_ORDER_MODES);
  const [modesLoaded, setModesLoaded] = useState(false);
  const [showDeliveryUnavailableModal, setShowDeliveryUnavailableModal] = useState(false);
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false);
  const [step, setStep] = useState<OnboardingStep>('choose');

  const [locationFetching, setLocationFetching] = useState(false);
  const [fetchedAddress, setFetchedAddress] = useState('');
  const [deliveryLatitude, setDeliveryLatitude] = useState<number | null>(null);
  const [deliveryLongitude, setDeliveryLongitude] = useState<number | null>(null);
  const [deliveryCity, setDeliveryCity] = useState('');
  const [deliveryState, setDeliveryState] = useState('');
  const [deliveryZipCode, setDeliveryZipCode] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [locationLabel, setLocationLabel] = useState('');
  const [floor, setFloor] = useState('');
  const [homeNo, setHomeNo] = useState('');
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  const hasSavedAddressRef = useRef<boolean | null>(null);
  const addressCheckInFlightRef = useRef<Promise<boolean> | null>(null);

  const { width: screenWidth } = useWindowDimensions();
  const slideAnim = useRef(new Animated.Value(screenWidth)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const checkHasSavedAddress = useCallback(async () => {
    if (hasSavedAddressRef.current != null) {
      return hasSavedAddressRef.current;
    }
    if (addressCheckInFlightRef.current) {
      return addressCheckInFlightRef.current;
    }
    const req = (async () => {
      try {
        const addresses = await getAllAddresses();
        const hasAddress = Array.isArray(addresses) && addresses.length > 0;
        hasSavedAddressRef.current = hasAddress;
        return hasAddress;
      } catch {
        return false;
      }
    })();
    addressCheckInFlightRef.current = req;
    try {
      return await req;
    } finally {
      addressCheckInFlightRef.current = null;
    }
  }, []);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const modes = await getOrderModes();
        if (!cancelled) setOrderModes(modes);
      } catch {
        if (!cancelled) setOrderModes(DEFAULT_ORDER_MODES);
      } finally {
        if (!cancelled) setModesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [slideAnim, opacityAnim]);

  useEffect(() => {
    if (modesLoaded && orderModes.delivery === false) {
      setShowDeliveryUnavailableModal(true);
    }
  }, [modesLoaded, orderModes.delivery]);

  useEffect(() => {
    const checkPendingDelivery = async () => {
      const pending = await AsyncStorage.getItem(PENDING_DELIVERY_LOCATION_KEY);
      if (pending === 'true') {
        const token = await getToken();
        if (token) {
          await AsyncStorage.removeItem(PENDING_DELIVERY_LOCATION_KEY);
          const hasAddress = await checkHasSavedAddress();
          if (hasAddress) {
            await AsyncStorage.setItem(ONBOARDING_ORDER_MODE_KEY, 'delivery');
            onFinish();
          } else {
            setSelectedOption('delivery');
            setStep('delivery_location');
          }
        }
      }
    };
    void checkPendingDelivery();
  }, [checkHasSavedAddress, onFinish]);

  const fetchMyLocation = async () => {
    try {
      setLocationFetching(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission required',
          'Location permission is needed to set your delivery address.',
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = position.coords;
      setDeliveryLatitude(latitude);
      setDeliveryLongitude(longitude);

      let formatted = '';
      try {
        const results = await Location.reverseGeocodeAsync({ latitude, longitude });
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
          if (parts.length > 0) formatted = parts.join(', ');
          setDeliveryCity(place.city ?? place.subregion ?? '');
          setDeliveryState(place.region ?? '');
          setDeliveryZipCode(place.postalCode ?? '');
        }
      } catch {
        formatted = 'Current location';
      }
      setFetchedAddress(formatted || 'Location fetched');
    } catch {
      Alert.alert('Error', 'Could not get your location. Please try again.');
    } finally {
      setLocationFetching(false);
    }
  };

  const handleContinue = async () => {
    if (selectedOption === 'delivery') {
      const token = await getToken();
      if (!token) {
        setShowLoginRequiredModal(true);
        return;
      }
      try {
        setCheckingAddress(true);
        const hasAddress = await checkHasSavedAddress();
        if (hasAddress) {
          await AsyncStorage.setItem(ONBOARDING_ORDER_MODE_KEY, 'delivery');
          onFinish();
        } else {
          setStep('delivery_location');
        }
      } catch {
        setStep('delivery_location');
      } finally {
        setCheckingAddress(false);
      }
      return;
    }
    if (selectedOption) {
      AsyncStorage.setItem(ONBOARDING_ORDER_MODE_KEY, selectedOption);
      onFinish();
    }
  };

  const handleDeliveryLocationContinue = async () => {
    const addressTrim = fullAddress.trim();
    if (deliveryLatitude == null || deliveryLongitude == null) {
      Alert.alert('Location required', 'Please fetch your location first.');
      return;
    }
    if (!addressTrim) {
      Alert.alert('Address required', 'Please enter your full address.');
      return;
    }
    const labelTrim = locationLabel.trim() || 'Home';
    const floorTrim = floor.trim();
    const homeNoTrim = homeNo.trim();

    const payload = {
      latitude: deliveryLatitude,
      longitude: deliveryLongitude,
      address: addressTrim,
      customerLocation: labelTrim,
      city: deliveryCity.trim() || undefined,
      state: deliveryState.trim() || undefined,
      zipCode: deliveryZipCode.trim() || undefined,
      floor: floorTrim || undefined,
      homeNo: homeNoTrim || undefined,
      isDefault: true,
    };

    try {
      setSavingAddress(true);
      await saveAddress(payload);
      hasSavedAddressRef.current = true;
      await AsyncStorage.setItem(ONBOARDING_ORDER_MODE_KEY, 'delivery');
      await AsyncStorage.setItem(ONBOARDING_DELIVERY_ADDRESS_KEY, JSON.stringify(payload));
      onFinish();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save address.';
      Alert.alert('Error', msg);
    } finally {
      setSavingAddress(false);
    }
  };

  const enabledOptions = useMemo(
    () => SERVICE_OPTIONS.filter((opt) => opt.key && orderModes[opt.key as keyof OrderModes]),
    [orderModes]
  );
  const topRowOptions = useMemo(
    () => enabledOptions.filter((o) => o.key === 'delivery' || o.key === 'takeaway'),
    [enabledOptions]
  );
  const diningOption = useMemo(
    () => enabledOptions.find((o) => o.key === 'dining'),
    [enabledOptions]
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Wavy background */}
      <View style={styles.waveContainer}>
        <WaveTopLayer2 />
        <WaveTop />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 'delivery_location' ? (
          /* Delivery: set location (fetch + manual fields) */
          <>
            <View style={styles.deliveryStepHeader}>
              <Pressable style={styles.backButton} onPress={() => setStep('choose')}>
                <Ionicons name="arrow-back" size={24} color={TEXT_COLOR} />
              </Pressable>
              <Text style={styles.deliveryStepTitle}>Delivery location</Text>
              <View style={styles.backButtonPlaceholder} />
            </View>
            <View style={styles.deliveryStepContent}>
              <Pressable
                style={[styles.fetchLocationBtn, locationFetching && styles.fetchLocationBtnDisabled]}
                onPress={fetchMyLocation}
                disabled={locationFetching}
              >
                {locationFetching ? (
                  <ActivityIndicator size="small" color={TEXT_COLOR} />
                ) : (
                  <>
                    <MaterialIcons name="my-location" size={24} color={TEXT_COLOR} />
                    <Text style={styles.fetchLocationBtnText}>Use my location</Text>
                  </>
                )}
              </Pressable>
              {fetchedAddress ? (
                <Pressable
                  style={styles.fetchedAddressBox}
                  onPress={() => {
                    if (deliveryLatitude != null && deliveryLongitude != null) {
                      const url = `https://www.google.com/maps?q=${deliveryLatitude},${deliveryLongitude}`;
                      Linking.openURL(url).catch(() =>
                        Alert.alert('Error', 'Could not open Google Maps.'),
                      );
                    }
                  }}
                >
                  <Text style={styles.fetchedAddressLabel}>Address (from GPS)</Text>
                  <Text style={styles.fetchedAddressText}>{fetchedAddress}</Text>
                  {deliveryLatitude != null && deliveryLongitude != null && (
                    <Text style={styles.latLngText}>
                      Lat: {deliveryLatitude.toFixed(6)}, Lng: {deliveryLongitude.toFixed(6)}
                    </Text>
                  )}
                  <Text style={styles.openInMapsHint}>Tap to open in Google Maps</Text>
                </Pressable>
              ) : null}
              <Text style={styles.manualFieldsLabel}>Full address</Text>
              <TextInput
                style={styles.deliveryInput}
                placeholder="Street, building, area..."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={fullAddress}
                onChangeText={setFullAddress}
              />
              <Text style={styles.manualFieldsLabel}>City</Text>
              <TextInput
                style={styles.deliveryInput}
                placeholder="City"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={deliveryCity}
                onChangeText={setDeliveryCity}
              />
              <Text style={styles.manualFieldsLabel}>State</Text>
              <TextInput
                style={styles.deliveryInput}
                placeholder="State"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={deliveryState}
                onChangeText={setDeliveryState}
              />
              <Text style={styles.manualFieldsLabel}>Zip code</Text>
              <TextInput
                style={styles.deliveryInput}
                placeholder="Zip code"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={deliveryZipCode}
                onChangeText={setDeliveryZipCode}
              />
              <Text style={styles.manualFieldsLabel}>Add details (optional)</Text>
              <TextInput
                style={styles.deliveryInput}
                placeholder="Label (e.g. Home, Office)"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={locationLabel}
                onChangeText={setLocationLabel}
              />
              <TextInput
                style={styles.deliveryInput}
                placeholder="Floor"
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={floor}
                onChangeText={setFloor}
              />
              <TextInput
                style={styles.deliveryInput}
                placeholder="Home / Flat no."
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={homeNo}
                onChangeText={setHomeNo}
              />
              <Pressable
                style={[styles.button, styles.deliveryContinueBtn, savingAddress && styles.buttonDisabled]}
                onPress={handleDeliveryLocationContinue}
                disabled={savingAddress}
              >
                {savingAddress ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.buttonText}>Save & Continue</Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
        <>
        {/* Logo + Brand + Tagline */}
        <View style={styles.brandSection}>
          <Image
            source={require('../../assets/Splash.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.brandNameContainer}>
            <Text style={styles.brandName}>MEXICANO</Text>
            <View style={styles.brandUnderline} />
          </View>
          <Text style={styles.tagline}>TASTE THE HEAT</Text>
        </View>

        {/* Service options from API (animate from right) */}
        <Animated.View
          style={[
            styles.cardsSection,
            {
              transform: [{ translateX: slideAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {enabledOptions.length === 0 ? (
            <View style={styles.loadingWrap}>
              <Text style={styles.loadingText}>No order options available.</Text>
            </View>
          ) : (
            <>
              {topRowOptions.length > 0 && (
                <View style={styles.cardsRow}>
                  {topRowOptions.map((opt) => (
                    <ServiceCard
                      key={opt.key}
                      icon={opt.icon}
                      title={opt.title}
                      description={opt.description}
                      selected={selectedOption === opt.key}
                      onPress={() => setSelectedOption(opt.key)}
                    />
                  ))}
                </View>
              )}
              {diningOption && (
                <View style={styles.cardsRowSingle}>
                  <ServiceCard
                    icon={diningOption.icon}
                    title={diningOption.title}
                    description={diningOption.description}
                    fullWidth
                    selected={selectedOption === 'dining'}
                    onPress={() => setSelectedOption('dining')}
                  />
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* Continue button */}
        <View style={styles.bottomSection}>
          <Pressable
            onPress={handleContinue}
            onPressIn={() => setButtonPressed(true)}
            onPressOut={() => setButtonPressed(false)}
            disabled={checkingAddress}
            style={({ pressed }) => [
              styles.button,
              (pressed || buttonPressed) && styles.buttonHover,
              checkingAddress && styles.buttonDisabled,
            ]}
          >
            {checkingAddress ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </Pressable>
        </View>
        </>
        )}
      </ScrollView>

      {/* Modal when delivery is disabled from API */}
      <Modal
        visible={showDeliveryUnavailableModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeliveryUnavailableModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowDeliveryUnavailableModal(false)}
        >
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <MaterialIcons name="delivery-dining" size={44} color={BUTTON_BG} style={styles.modalIcon} />
            <Text style={styles.modalTitle}>Delivery unavailable</Text>
            <Text style={styles.modalMessage}>This service is currently unavailable.</Text>
            <Pressable
              style={styles.modalButton}
              onPress={() => setShowDeliveryUnavailableModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Login required modal for delivery */}
      <Modal
        visible={showLoginRequiredModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLoginRequiredModal(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setShowLoginRequiredModal(false)}
        >
          <Pressable style={styles.loginModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.loginModalIconWrap}>
              <Ionicons name="person-circle-outline" size={48} color={BUTTON_BG} />
            </View>
            <Text style={styles.loginModalTitle}>Login required</Text>
            <Text style={styles.loginModalMessage}>
              Please sign in or create an account to use delivery service.
            </Text>
            <View style={styles.loginModalButtons}>
              <Pressable
                style={styles.loginModalPrimaryBtn}
                onPress={async () => {
                  await AsyncStorage.setItem(PENDING_DELIVERY_LOCATION_KEY, 'true');
                  setShowLoginRequiredModal(false);
                  navigateToLoginRegister();
                }}
              >
                <Text style={styles.loginModalPrimaryText}>Login / Register</Text>
              </Pressable>
              <Pressable
                style={styles.loginModalSecondaryBtn}
                onPress={() => setShowLoginRequiredModal(false)}
              >
                <Text style={styles.loginModalSecondaryText}>Not now</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  waveContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: WAVE_HEIGHT,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  logo: {
    width: 220,
    height: 150,
    marginBottom: 28,
  },
  brandNameContainer: {
    alignItems: 'center',
  },
  brandName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 32,
    fontWeight: '700',
    color: TEXT_COLOR,
    letterSpacing: 5,
  },
  brandUnderline: {
    height: 3,
    backgroundColor: BUTTON_BG,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  tagline: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_COLOR,
    opacity: 0.9,
    letterSpacing: 3,
    marginTop: 6,
  },
  cardsSection: {
    gap: 16,
  },
  loadingWrap: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    opacity: 0.9,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: BG_COLOR,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.3)',
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_COLOR,
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: BUTTON_BG,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  loginModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: BG_COLOR,
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
  loginModalIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(254, 203, 77, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  loginModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
    textAlign: 'center',
    marginBottom: 10,
  },
  loginModalMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_COLOR,
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  loginModalButtons: {
    gap: 12,
  },
  loginModalPrimaryBtn: {
    backgroundColor: BUTTON_BG,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginModalPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  loginModalSecondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  loginModalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    opacity: 0.8,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardsRowSingle: {
    alignItems: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: BUTTON_BG,
  },
  cardFullWidth: {
    flex: 1,
    alignSelf: 'stretch',
  },
  cardIcon: {
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_COLOR,
    marginBottom: 8,
  },
  cardDescription: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_COLOR,
    opacity: 0.9,
  },
  bottomSection: {
    paddingTop: 32,
    paddingBottom: 64,
    alignItems: 'center',
  },
  button: {
    backgroundColor: BUTTON_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 56,
  },
  buttonHover: {
    backgroundColor: BUTTON_HOVER,
  },
  buttonText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  deliveryStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 24,
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
  },
  backButtonPlaceholder: {
    width: 40,
  },
  deliveryStepTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_COLOR,
  },
  deliveryStepContent: {
    gap: 16,
  },
  fetchLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: BUTTON_BG,
  },
  fetchLocationBtnDisabled: {
    opacity: 0.7,
  },
  fetchLocationBtnText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  fetchedAddressBox: {
    backgroundColor: CARD_BG,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.2)',
  },
  fetchedAddressLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_COLOR,
    opacity: 0.8,
    marginBottom: 6,
  },
  fetchedAddressText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
  },
  latLngText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_COLOR,
    opacity: 0.85,
    marginTop: 8,
  },
  openInMapsHint: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    fontWeight: '600',
    color: BUTTON_BG,
    marginTop: 10,
  },
  manualFieldsLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_COLOR,
    marginTop: 8,
  },
  deliveryInput: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: TEXT_COLOR,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.2)',
  },
  deliveryContinueBtn: {
    marginTop: 16,
    alignSelf: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
