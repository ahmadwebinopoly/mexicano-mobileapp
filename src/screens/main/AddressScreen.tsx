import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  getAllAddresses,
  deleteAddress,
  setAddressAsDefault,
  updateAddress,
  saveAddress,
  type Address,
} from '../../api/saveadresss';
import { AddressScreenSkeleton } from '../../components/skeleton';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const GOLD = '#FECB4D';
const TEXT_WHITE = '#FFFFFF';
const MUTED_TEXT = 'rgba(255,255,255,0.7)';
const HORIZONTAL_PADDING = 20;

export default function AddressScreen() {
  const navigation = useNavigation<any>();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editZipCode, setEditZipCode] = useState('');
  const [editFloor, setEditFloor] = useState('');
  const [editHomeNo, setEditHomeNo] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [saving, setSaving] = useState(false);

  // Add modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addAddress, setAddAddress] = useState('');
  const [addCity, setAddCity] = useState('');
  const [addState, setAddState] = useState('');
  const [addZipCode, setAddZipCode] = useState('');
  const [addFloor, setAddFloor] = useState('');
  const [addHomeNo, setAddHomeNo] = useState('');
  const [addLabel, setAddLabel] = useState('Home');
  const [addLatitude, setAddLatitude] = useState<number | null>(null);
  const [addLongitude, setAddLongitude] = useState<number | null>(null);
  const [fetchingLocation, setFetchingLocation] = useState(false);
  const [fetchedAddressText, setFetchedAddressText] = useState('');
  const [savingNew, setSavingNew] = useState(false);

  const fetchAddresses = useCallback(async () => {
    try {
      const data = await getAllAddresses();
      setAddresses(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load addresses.';
      if (!msg.includes('Not authenticated')) {
        Alert.alert('Error', msg);
      }
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchAddresses();
    }, [fetchAddresses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAddresses();
    setRefreshing(false);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setAddressAsDefault(id);
      await fetchAddresses();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to set default.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAddress(id);
              await fetchAddresses();
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Failed to delete.');
            }
          },
        },
      ]
    );
  };

  // Edit Modal Functions
  const openEditModal = (addr: Address) => {
    setEditingAddress(addr);
    setEditAddress(addr.address || '');
    setEditCity(addr.city || '');
    setEditState(addr.state || '');
    setEditZipCode(addr.zipCode || '');
    setEditFloor(addr.floor || '');
    setEditHomeNo(addr.homeNo || '');
    setEditLabel(addr.customerLocation || 'Home');
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingAddress(null);
  };

  const handleSaveEdit = async () => {
    if (!editingAddress) return;

    if (!editAddress.trim()) {
      Alert.alert('Required', 'Full address is required.');
      return;
    }

    try {
      setSaving(true);
      await updateAddress(editingAddress.id, {
        address: editAddress.trim(),
        city: editCity.trim() || undefined,
        state: editState.trim() || undefined,
        zipCode: editZipCode.trim() || undefined,
        floor: editFloor.trim() || undefined,
        homeNo: editHomeNo.trim() || undefined,
        customerLocation: editLabel.trim() || 'Home',
      });
      closeEditModal();
      await fetchAddresses();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update address.');
    } finally {
      setSaving(false);
    }
  };

  // Add Modal Functions
  const openAddModal = () => {
    setAddAddress('');
    setAddCity('');
    setAddState('');
    setAddZipCode('');
    setAddFloor('');
    setAddHomeNo('');
    setAddLabel('Home');
    setAddLatitude(null);
    setAddLongitude(null);
    setFetchedAddressText('');
    setAddModalVisible(true);
  };

  const closeAddModal = () => {
    setAddModalVisible(false);
  };

  const fetchLocation = async () => {
    try {
      setFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to fetch your location.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;
      setAddLatitude(lat);
      setAddLongitude(lng);

      const reverseGeo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (reverseGeo && reverseGeo.length > 0) {
        const place = reverseGeo[0];
        const parts = [
          place.name,
          place.street,
          place.district,
          place.city,
          place.region,
          place.postalCode,
          place.country,
        ].filter(Boolean);
        setFetchedAddressText(parts.join(', '));
        if (place.city) setAddCity(place.city);
        if (place.region) setAddState(place.region);
        if (place.postalCode) setAddZipCode(place.postalCode);
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to fetch location. Please try again.');
    } finally {
      setFetchingLocation(false);
    }
  };

  const handleSaveNewAddress = async () => {
    if (addLatitude == null || addLongitude == null) {
      Alert.alert('Location Required', 'Please fetch your location first.');
      return;
    }
    if (!addAddress.trim()) {
      Alert.alert('Required', 'Full address is required.');
      return;
    }

    try {
      setSavingNew(true);
      await saveAddress({
        latitude: addLatitude,
        longitude: addLongitude,
        address: addAddress.trim(),
        customerLocation: addLabel.trim() || 'Home',
        city: addCity.trim() || undefined,
        state: addState.trim() || undefined,
        zipCode: addZipCode.trim() || undefined,
        floor: addFloor.trim() || undefined,
        homeNo: addHomeNo.trim() || undefined,
        isDefault: addresses.length === 0,
      });
      closeAddModal();
      await fetchAddresses();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save address.');
    } finally {
      setSavingNew(false);
    }
  };

  const openInMaps = (lat: number, lng: number) => {
    const url = `https://www.google.com/maps?q=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Could not open maps.');
    });
  };

  const renderAddressCard = (addr: Address) => (
    <View key={addr.id} style={[styles.addressCard, addr.isDefault && styles.addressCardDefault]}>
      {/* Header: Label + Default badge + Edit + Delete */}
      <View style={styles.cardHeader}>
        <View style={styles.labelRow}>
          <Ionicons
            name={addr.customerLocation?.toLowerCase() === 'office' ? 'business-outline' : 'home-outline'}
            size={20}
            color={GOLD}
          />
          <Text style={styles.labelText}>{addr.customerLocation || 'Home'}</Text>
          {addr.isDefault && (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
        <View style={styles.actionButtons}>
          <Pressable style={styles.editBtn} onPress={() => openEditModal(addr)}>
            <Ionicons name="create-outline" size={18} color={GOLD} />
          </Pressable>
          <Pressable style={styles.deleteBtn} onPress={() => handleDelete(addr.id)}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </Pressable>
        </View>
      </View>

      {/* Full Address */}
      <View style={styles.fieldRow}>
        <Ionicons name="location-outline" size={16} color={GOLD} />
        <View style={styles.fieldContent}>
          <Text style={styles.fieldLabel}>Full Address</Text>
          <Text style={styles.fieldValue}>{addr.address}</Text>
        </View>
      </View>

      {/* Floor & Home No */}
      {(addr.floor || addr.homeNo) && (
        <View style={styles.fieldRow}>
          <Ionicons name="layers-outline" size={16} color={GOLD} />
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>Floor / Flat</Text>
            <Text style={styles.fieldValue}>
              {[addr.floor && `Floor: ${addr.floor}`, addr.homeNo && `Flat: ${addr.homeNo}`]
                .filter(Boolean)
                .join('  •  ')}
            </Text>
          </View>
        </View>
      )}

      {/* City */}
      {addr.city && (
        <View style={styles.fieldRow}>
          <Ionicons name="business-outline" size={16} color={GOLD} />
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>City</Text>
            <Text style={styles.fieldValue}>{addr.city}</Text>
          </View>
        </View>
      )}

      {/* State */}
      {addr.state && (
        <View style={styles.fieldRow}>
          <Ionicons name="map-outline" size={16} color={GOLD} />
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>State</Text>
            <Text style={styles.fieldValue}>{addr.state}</Text>
          </View>
        </View>
      )}

      {/* Zip Code */}
      {addr.zipCode && (
        <View style={styles.fieldRow}>
          <Ionicons name="mail-outline" size={16} color={GOLD} />
          <View style={styles.fieldContent}>
            <Text style={styles.fieldLabel}>Zip Code</Text>
            <Text style={styles.fieldValue}>{addr.zipCode}</Text>
          </View>
        </View>
      )}

      {/* Coordinates - Tappable to open in Google Maps */}
      <Pressable
        style={styles.coordsRow}
        onPress={() => openInMaps(addr.latitude, addr.longitude)}
      >
        <MaterialIcons name="my-location" size={14} color={GOLD} />
        <Text style={styles.coordsText}>
          Lat: {addr.latitude.toFixed(6)}, Lng: {addr.longitude.toFixed(6)}
        </Text>
        <Text style={styles.openMapsText}>Open in Maps</Text>
      </Pressable>

      {/* Set as Default button */}
      {!addr.isDefault && (
        <Pressable style={styles.setDefaultBtn} onPress={() => handleSetDefault(addr.id)}>
          <Text style={styles.setDefaultText}>Set as default</Text>
        </Pressable>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="location-outline" size={48} color={GOLD} />
      </View>
      <Text style={styles.emptyTitle}>No addresses yet</Text>
      <Text style={styles.emptySubtitle}>
        Tap the + button to add your first delivery address
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={BG_DARK} />
        </Pressable>
        <Text style={styles.headerTitle}>My Addresses</Text>
        <Pressable style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add" size={24} color={BG_DARK} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={GOLD}
            colors={[GOLD]}
          />
        }
      >
        {loading ? (
          <AddressScreenSkeleton />
        ) : addresses.length === 0 ? (
          renderEmptyState()
        ) : (
          addresses.map(renderAddressCard)
        )}
      </ScrollView>

      {/* Add Address Modal */}
      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeAddModal}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom', 'left', 'right']}>
          <KeyboardAvoidingView
            style={styles.modalOverlayInner}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.modalBackdrop} onPress={closeAddModal} />
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Address</Text>
              <Pressable onPress={closeAddModal}>
                <Ionicons name="close" size={24} color={TEXT_WHITE} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Fetch Location Button */}
              <Pressable
                style={[styles.fetchLocationBtn, fetchingLocation && styles.fetchLocationBtnDisabled]}
                onPress={fetchLocation}
                disabled={fetchingLocation}
              >
                {fetchingLocation ? (
                  <ActivityIndicator size="small" color={BG_DARK} />
                ) : (
                  <>
                    <MaterialIcons name="my-location" size={20} color={BG_DARK} />
                    <Text style={styles.fetchLocationText}>Use My Current Location</Text>
                  </>
                )}
              </Pressable>

              {/* Fetched Location Display */}
              {addLatitude != null && addLongitude != null && (
                <Pressable
                  style={styles.fetchedLocationBox}
                  onPress={() => openInMaps(addLatitude, addLongitude)}
                >
                  <Text style={styles.fetchedLocationTitle}>{fetchedAddressText || 'Location fetched'}</Text>
                  <Text style={styles.fetchedLocationCoords}>
                    Lat: {addLatitude.toFixed(6)}, Lng: {addLongitude.toFixed(6)}
                  </Text>
                  <Text style={styles.tapToOpenMaps}>Tap to open in Google Maps</Text>
                </Pressable>
              )}

              {/* Label */}
              <Text style={styles.inputLabel}>Label</Text>
              <TextInput
                style={styles.input}
                value={addLabel}
                onChangeText={setAddLabel}
                placeholder="Home, Office, etc."
                placeholderTextColor={MUTED_TEXT}
              />

              {/* Full Address */}
              <Text style={styles.inputLabel}>Full Address *</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={addAddress}
                onChangeText={setAddAddress}
                placeholder="Enter full address"
                placeholderTextColor={MUTED_TEXT}
                multiline
                numberOfLines={2}
              />

              {/* City */}
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={addCity}
                onChangeText={setAddCity}
                placeholder="City"
                placeholderTextColor={MUTED_TEXT}
              />

              {/* State */}
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.input}
                value={addState}
                onChangeText={setAddState}
                placeholder="State"
                placeholderTextColor={MUTED_TEXT}
              />

              {/* Zip Code */}
              <Text style={styles.inputLabel}>Zip Code</Text>
              <TextInput
                style={styles.input}
                value={addZipCode}
                onChangeText={setAddZipCode}
                placeholder="Zip Code"
                placeholderTextColor={MUTED_TEXT}
                keyboardType="numeric"
              />

              {/* Floor */}
              <Text style={styles.inputLabel}>Floor</Text>
              <TextInput
                style={styles.input}
                value={addFloor}
                onChangeText={setAddFloor}
                placeholder="Floor number"
                placeholderTextColor={MUTED_TEXT}
              />

              {/* Home / Flat No */}
              <Text style={styles.inputLabel}>Home / Flat No</Text>
              <TextInput
                style={styles.input}
                value={addHomeNo}
                onChangeText={setAddHomeNo}
                placeholder="Flat number"
                placeholderTextColor={MUTED_TEXT}
              />
            </ScrollView>

            {/* Save Button */}
            <Pressable
              style={[styles.saveBtn, savingNew && styles.saveBtnDisabled]}
              onPress={handleSaveNewAddress}
              disabled={savingNew}
            >
              {savingNew ? (
                <ActivityIndicator size="small" color={BG_DARK} />
              ) : (
                <Text style={styles.saveBtnText}>Save Address</Text>
              )}
            </Pressable>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Edit Address Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <SafeAreaView style={styles.modalOverlay} edges={['top', 'bottom', 'left', 'right']}>
          <KeyboardAvoidingView
            style={styles.modalOverlayInner}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.modalBackdrop} onPress={closeEditModal} />
            <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Address</Text>
              <Pressable onPress={closeEditModal}>
                <Ionicons name="close" size={24} color={TEXT_WHITE} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Label */}
              <Text style={styles.inputLabel}>Label</Text>
              <TextInput
                style={styles.input}
                value={editLabel}
                onChangeText={setEditLabel}
                placeholder="Home, Office, etc."
                placeholderTextColor={MUTED_TEXT}
              />

              {/* Full Address */}
              <Text style={styles.inputLabel}>Full Address *</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Enter full address"
                placeholderTextColor={MUTED_TEXT}
                multiline
                numberOfLines={2}
              />

              {/* City */}
              <Text style={styles.inputLabel}>City</Text>
              <TextInput
                style={styles.input}
                value={editCity}
                onChangeText={setEditCity}
                placeholder="City"
                placeholderTextColor={MUTED_TEXT}
              />

              {/* State */}
              <Text style={styles.inputLabel}>State</Text>
              <TextInput
                style={styles.input}
                value={editState}
                onChangeText={setEditState}
                placeholder="State"
                placeholderTextColor={MUTED_TEXT}
              />

              {/* Zip Code */}
              <Text style={styles.inputLabel}>Zip Code</Text>
              <TextInput
                style={styles.input}
                value={editZipCode}
                onChangeText={setEditZipCode}
                placeholder="Zip Code"
                placeholderTextColor={MUTED_TEXT}
                keyboardType="numeric"
              />

              {/* Floor */}
              <Text style={styles.inputLabel}>Floor</Text>
              <TextInput
                style={styles.input}
                value={editFloor}
                onChangeText={setEditFloor}
                placeholder="Floor number"
                placeholderTextColor={MUTED_TEXT}
              />

              {/* Home / Flat No */}
              <Text style={styles.inputLabel}>Home / Flat No</Text>
              <TextInput
                style={styles.input}
                value={editHomeNo}
                onChangeText={setEditHomeNo}
                placeholder="Flat number"
                placeholderTextColor={MUTED_TEXT}
              />

              {/* Coordinates (read-only info) */}
              {editingAddress && (
                <View style={styles.coordsInfo}>
                  <MaterialIcons name="my-location" size={14} color={MUTED_TEXT} />
                  <Text style={styles.coordsInfoText}>
                    Location: {editingAddress.latitude.toFixed(6)}, {editingAddress.longitude.toFixed(6)}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Save Button */}
            <Pressable
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color={BG_DARK} />
              ) : (
                <Text style={styles.saveBtnText}>Save Changes</Text>
              )}
            </Pressable>
          </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingTop: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(254, 203, 77, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: MUTED_TEXT,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  addressCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(254,185,72,0.2)',
  },
  addressCardDefault: {
    borderColor: GOLD,
    borderWidth: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  labelText: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  defaultBadge: {
    backgroundColor: 'rgba(254, 203, 77, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: GOLD,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editBtn: {
    padding: 8,
  },
  deleteBtn: {
    padding: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    paddingLeft: 4,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    color: MUTED_TEXT,
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
    lineHeight: 20,
  },
  coordsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(254, 203, 77, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.15)',
  },
  coordsText: {
    flex: 1,
    fontSize: 12,
    color: MUTED_TEXT,
  },
  openMapsText: {
    fontSize: 12,
    fontWeight: '600',
    color: GOLD,
  },
  setDefaultBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.4)',
    alignItems: 'center',
  },
  setDefaultText: {
    fontSize: 13,
    fontWeight: '600',
    color: GOLD,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlayInner: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 32,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  modalScroll: {
    paddingTop: 16,
  },
  fetchLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  fetchLocationBtnDisabled: {
    opacity: 0.7,
  },
  fetchLocationText: {
    fontSize: 15,
    fontWeight: '700',
    color: BG_DARK,
  },
  fetchedLocationBox: {
    backgroundColor: 'rgba(254, 203, 77, 0.1)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(254, 203, 77, 0.3)',
  },
  fetchedLocationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_WHITE,
    marginBottom: 4,
  },
  fetchedLocationCoords: {
    fontSize: 12,
    color: MUTED_TEXT,
    marginBottom: 6,
  },
  tapToOpenMaps: {
    fontSize: 12,
    fontWeight: '600',
    color: GOLD,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: MUTED_TEXT,
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_WHITE,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  coordsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
  },
  coordsInfoText: {
    fontSize: 12,
    color: MUTED_TEXT,
  },
  saveBtn: {
    backgroundColor: GOLD,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: BG_DARK,
  },
});
