import React, { useState, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Vehicle Details Cache (per-user AsyncStorage) ──────────────────────────
const VEHICLE_CACHE_KEY = (userId?: number) =>
  userId ? `@serveasy_vehicle_${userId}` : `@serveasy_vehicle_guest`;

async function getStoredVehicle(userId?: number): Promise<{ brand: string; model: string; regNo: string; color: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(VEHICLE_CACHE_KEY(userId));
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

async function saveStoredVehicle(userId: number | undefined, data: { brand: string; model: string; regNo: string; color: string }) {
  try {
    await AsyncStorage.setItem(VEHICLE_CACHE_KEY(userId), JSON.stringify(data));
  } catch (_) {}
}
// ────────────────────────────────────────────────────────────────────────────
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Image,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ServiceWizardSkeleton } from '../../../components/SkeletonLoader';
import {
  VehicleWashProvider,
  VehicleWashPackage,
  VehicleWashAddon,
  SavedAddress,
  VehicleWashBookingPayload,
  fetchVehicleWashProvidersFromApi,
  getVehicleWashPackages,
  getPlansForProvider,
  getAddonsForProvider,
  saveUserAddressApi,
  fetchSavedAddressesFromApi,
  submitVehicleWashBookingApi,
  checkBookingStatusApi,
  updateBookingPaymentApi,
  createRazorpayOrderApi,
  verifyRazorpayPaymentApi,
  fetchFullUserProfileApi,
  fetchPlatformFeeSettingApi,
  PlatformFeeSetting,
  fetchProviderAvailabilityApi,
  ProviderAvailabilityData,
  updateUserProfileApi,
} from '../../../services/api';
import { reverseGeocodeCoords as reverseGeocodeDoorstepCoords, acquireDeviceLocation, getGoogleMapTileUrl } from '../../../services/locationHelper';

interface VehicleCarBikeWashProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  onBack: () => void;
  onBookingComplete?: (bookingNumber: string) => void;
  initialVehicleType?: string;
  currentUser?: {
    id?: number;
    name?: string;
    identity?: string;
    phone?: string;
    email?: string;
    isLoggedIn: boolean;
  };
  onRequireLogin?: () => void;
}

type VehicleType = 'Bike' | 'Scooter' | 'Car' | 'SUV' | 'Luxury';

export const normalizeVehicleType = (raw?: string): VehicleType => {
  if (!raw) return 'Car';
  const lower = raw.trim().toLowerCase();
  if (lower.includes('bike') || lower.includes('motorcycle')) return 'Bike';
  if (lower.includes('scooter') || lower.includes('scooty') || lower.includes('moped')) return 'Scooter';
  if (lower.includes('luxury') || lower.includes('sports')) return 'Luxury';
  if (lower.includes('suv') || lower.includes('muv')) return 'SUV';
  if (lower.includes('car') || lower.includes('sedan') || lower.includes('hatchback')) return 'Car';
  return 'Car';
};

export const VehicleCarBikeWash: React.FC<VehicleCarBikeWashProps> = ({
  theme,
  activeTheme,
  onBack,
  onBookingComplete,
  initialVehicleType,
  currentUser,
  onRequireLogin,
}) => {
  // Stepper state: 1 to 12
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsFirstLoad(false), 450);
    return () => clearTimeout(timer);
  }, []);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 12;

  // Step 1: Vehicle Type (Normalized from parent input e.g. 'Bike Wash' -> 'Bike')
  const [vehicleType, setVehicleType] = useState<VehicleType>(() =>
    normalizeVehicleType(initialVehicleType)
  );

  // Step 2: Location
  const [locationOption, setLocationOption] = useState<'doorstep' | 'center'>('doorstep');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [addressLabel, setAddressLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [customAddress, setCustomAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('700001');
  const [showNewAddressInput, setShowNewAddressInput] = useState(false);
  const [showPinMap, setShowPinMap] = useState(false);
  const [mapLatitude, setMapLatitude] = useState(22.6231);
  const [mapLongitude, setMapLongitude] = useState(88.4348);
  const [mapZoom, setMapZoom] = useState(16);
  const [mapLayer, setMapLayer] = useState<'roadmap' | 'satellite'>('roadmap');
  const [showMapPopup, setShowMapPopup] = useState(true);
  const [isLocating, setIsLocating] = useState(false);

  // Step 3: Provider
  const [providers, setProviders] = useState<VehicleWashProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<VehicleWashProvider | null>(null);

  // Step 4: Plan / Package
  const [packages, setPackages] = useState<VehicleWashPackage[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<VehicleWashPackage | null>(null);

  // Step 5: Schedule
  const todayStr = new Date().toISOString().slice(0, 10);
  const [scheduleDate, setScheduleDate] = useState<string>(todayStr);
  const timeSlots = [
    '09:00 AM – 10:00 AM',
    '10:00 AM – 11:00 AM',
    '11:00 AM – 12:00 PM',
    '01:00 PM – 02:00 PM',
    '02:00 PM – 03:00 PM',
    '03:00 PM – 04:00 PM',
    '05:00 PM – 06:00 PM',
  ];
  const [selectedSlot, setSelectedSlot] = useState<string>('10:00 AM – 11:00 AM');
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [isSingleProvider, setIsSingleProvider] = useState<boolean>(true);

  // Hook provider availability for single person service provider slot blocking
  useEffect(() => {
    const provId = selectedProvider?.id || 28;
    if (provId && scheduleDate) {
      fetchProviderAvailabilityApi(provId, scheduleDate)
        .then(avail => {
          setIsSingleProvider(avail.isSingleProvider);
          setBookedSlots(avail.bookedSlots);
          if (avail.isSingleProvider && avail.bookedSlots.includes(selectedSlot)) {
            const nextAvail = timeSlots.find(s => !avail.bookedSlots.includes(s));
            if (nextAvail) {
              setSelectedSlot(nextAvail);
            } else {
              setSelectedSlot('');
            }
          }
        })
        .catch(() => {});
    }
  }, [selectedProvider?.id, scheduleDate]);

  // Step 6: Vehicle Specs — start blank; cache loaded in useEffect
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleRegNo, setVehicleRegNo] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  // Track whether the phone was pre-filled from profile (so we only save when user typed it fresh)
  const [phoneWasFromProfile, setPhoneWasFromProfile] = useState(false);

  // Step 7: Addons (Dynamically loaded from database for selected provider & service)
  const [availableAddons, setAvailableAddons] = useState<VehicleWashAddon[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Step 8: Customer Info (Pre-filled from logged-in account if authenticated and has phone)
  const [customerName, setCustomerName] = useState(
    currentUser?.name && currentUser.name !== 'Guest User' ? currentUser.name : 'Verified Customer'
  );
  // Only prefill if account has a real phone number (do NOT put email into phone field)
  const initialPhone = (() => {
    if (currentUser?.phone && !currentUser.phone.includes('@')) return currentUser.phone;
    if (currentUser?.identity && !currentUser.identity.includes('@')) return currentUser.identity;
    return '';
  })();
  const [customerPhone, setCustomerPhone] = useState(initialPhone);
  const [customerAltPhone, setCustomerAltPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState(
    currentUser?.email || (currentUser?.identity?.includes('@') ? currentUser.identity : 'customer@serveasy.com')
  );

  // Step 10: Radar acceptance animation
  const radarSpinAnim = useRef(new Animated.Value(0)).current;
  const radarPulseAnim = useRef(new Animated.Value(1)).current;
  const [radarStatus, setRadarStatus] = useState<'searching' | 'accepted' | 'rejected'>('searching');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [bookingDbId, setBookingDbId] = useState<number | null>(null);

  // Step 11: Payment
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Online'>('COD');
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('12/28');
  const [cardCvv, setCardCvv] = useState('888');

  // Step 12: Final Confirmation
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string>('');

  // Platform Convenience Fee setting from serveasy-admin
  const [platformFeeSetting, setPlatformFeeSetting] = useState<PlatformFeeSetting>({
    amount: 9,
    type: 'percentage',
    is_active: true,
    service_scope: 'all',
    applicable_services: [],
    currency_symbol: '₹',
    currency_code: 'INR',
  });

  // Initial load - Fetch real user addresses, active providers, dynamic addons, user profile, and fee settings
  useEffect(() => {
    async function loadData() {
      fetchPlatformFeeSettingApi().then(fee => setPlatformFeeSetting(fee)).catch(() => {});

      if (currentUser?.isLoggedIn && currentUser?.id) {
        const [addr, userProf] = await Promise.all([
          fetchSavedAddressesFromApi(currentUser.id),
          fetchFullUserProfileApi(currentUser.id).catch(() => null),
        ]);
        // Deduplicate saved addresses to guarantee single-selection and prevent ghost duplicates
        const uniqueAddresses: SavedAddress[] = [];
        const seenKeys = new Set<string>();
        for (const a of addr) {
          const key = `${a.id || ''}-${(a.address || '').trim().toLowerCase()}-${(a.pincode || '').trim()}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueAddresses.push(a);
          }
        }
        setSavedAddresses(uniqueAddresses);
        if (uniqueAddresses.length > 0) {
          setSelectedAddressId(uniqueAddresses[0].id);
          setCustomAddress(uniqueAddresses[0].address);
          setLandmark(uniqueAddresses[0].landmark || '');
          setPincode(uniqueAddresses[0].pincode || '');
          if (uniqueAddresses[0].latitude && !isNaN(Number(uniqueAddresses[0].latitude))) {
            setMapLatitude(Number(uniqueAddresses[0].latitude));
          }
          if (uniqueAddresses[0].longitude && !isNaN(Number(uniqueAddresses[0].longitude))) {
            setMapLongitude(Number(uniqueAddresses[0].longitude));
          }
        } else {
          setSelectedAddressId(null);
        }
        if (userProf?.user?.phone && !userProf.user.phone.includes('@')) {
          setCustomerPhone(userProf.user.phone.trim());
          setPhoneWasFromProfile(true); // phone came from DB, no need to re-save
        }
        if (userProf?.user?.fullName && userProf.user.fullName !== 'Guest User') {
          setCustomerName(userProf.user.fullName.trim());
        }
        // Load cached vehicle details for this user (blank for new users)
        const cachedVehicle = await getStoredVehicle(currentUser?.id);
        if (cachedVehicle) {
          if (cachedVehicle.brand)  setVehicleBrand(cachedVehicle.brand);
          if (cachedVehicle.model)  setVehicleModel(cachedVehicle.model);
          if (cachedVehicle.regNo)  setVehicleRegNo(cachedVehicle.regNo);
          if (cachedVehicle.color)  setVehicleColor(cachedVehicle.color);
        }
      } else {
        setSavedAddresses([]);
        // Even guest users can have cached vehicle data (guest key)
        const cachedVehicle = await getStoredVehicle(undefined);
        if (cachedVehicle) {
          if (cachedVehicle.brand)  setVehicleBrand(cachedVehicle.brand);
          if (cachedVehicle.model)  setVehicleModel(cachedVehicle.model);
          if (cachedVehicle.regNo)  setVehicleRegNo(cachedVehicle.regNo);
          if (cachedVehicle.color)  setVehicleColor(cachedVehicle.color);
        }
      }

      const provs = await fetchVehicleWashProvidersFromApi();
      setProviders(provs);
      setLoadingProviders(false);
    }
    loadData();
  }, [currentUser?.id, currentUser?.isLoggedIn]);

  // Keep vehicleType synchronized if initialVehicleType changes from parent
  useEffect(() => {
    if (initialVehicleType) {
      setVehicleType(normalizeVehicleType(initialVehicleType));
    }
  }, [initialVehicleType]);

  // Adjust default model when vehicleType changes ONLY if vehicle fields are still blank
  // (i.e. user hasn't manually entered anything and no cache was loaded)
  useEffect(() => {
    if (vehicleBrand || vehicleModel || vehicleRegNo) {
      // User already has data (from cache or manual input) — don't overwrite
      return;
    }
    // All fields blank → no auto-suggestion needed; leave blank for user to fill
  }, [vehicleType]);

  // Keep customer fields synchronized with currentUser profile changes
  useEffect(() => {
    if (currentUser?.isLoggedIn) {
      if (currentUser.name && currentUser.name !== 'Guest User') {
        setCustomerName(currentUser.name);
      }
      if (currentUser.phone && !currentUser.phone.includes('@')) {
        setCustomerPhone(currentUser.phone);
      } else if (currentUser.identity && !currentUser.identity.includes('@')) {
        setCustomerPhone(currentUser.identity);
      }
      if (currentUser.email) {
        setCustomerEmail(currentUser.email);
      }
    }
  }, [currentUser]);

  // Filter providers that strictly offer services for the selected vehicle type
  const activeProviders = useMemo(() => {
    const isBike = vehicleType === 'Bike' || vehicleType === 'Scooter';
    return providers.filter(prov => {
      if (!prov.services || prov.services.length === 0) return true;
      return prov.services.some((srv: any) => {
        const subId = parseInt(srv.subcategory_id || '0');
        const nameLower = (srv.name || '').toLowerCase();
        const slugLower = (srv.slug || '').toLowerCase();
        if (isBike) {
          return subId === 2 || slugLower === 'bike-wash' || nameLower.includes('bike');
        } else {
          return subId === 1 || slugLower === 'car-wash' || slugLower === 'vehicle-car-and-bike-wash' || nameLower.includes('car');
        }
      });
    });
  }, [providers, vehicleType]);

  // Keep selectedProvider aligned with active providers for current vehicle type
  useEffect(() => {
    if (activeProviders.length > 0) {
      if (!selectedProvider || !activeProviders.some(p => p.id === selectedProvider.id)) {
        const preferred = (vehicleType === 'Bike' || vehicleType === 'Scooter')
          ? (activeProviders.find(p => p.id === 28) || activeProviders[0])
          : activeProviders[0];
        setSelectedProvider(preferred);
      }
    } else {
      setSelectedProvider(null);
    }
  }, [activeProviders, vehicleType]);

  // Update packages & dynamic addons when vehicleType or selectedProvider changes
  useEffect(() => {
    if (selectedProvider) {
      const pkgs = getPlansForProvider(selectedProvider, vehicleType);
      setPackages(pkgs);
      let activePkg: VehicleWashPackage | null = null;
      if (pkgs.length > 0) {
        const match = pkgs.find(p => p.id === selectedPackage?.id);
        activePkg = match || pkgs[0];
        setSelectedPackage(activePkg);
      } else {
        setSelectedPackage(null);
      }
      const targetSrvId = activePkg?.serviceId || selectedProvider.serviceId;
      const dbAddons = getAddonsForProvider(selectedProvider, targetSrvId);
      setAvailableAddons(dbAddons);
      setSelectedAddonIds(prev => prev.filter(id => dbAddons.some(a => a.id === id)));
    } else {
      setPackages([]);
      setSelectedPackage(null);
      setAvailableAddons([]);
      setSelectedAddonIds([]);
    }
  }, [selectedProvider, vehicleType]);

  // Radar animation controller for Step 10
  useEffect(() => {
    if (currentStep === 10) {
      setRadarStatus('searching');
      setElapsedSeconds(0);

      // Radar rotation loop
      const spin = Animated.loop(
        Animated.timing(radarSpinAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      spin.start();

      // Radar pulse loop
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(radarPulseAnim, {
            toValue: 1.4,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(radarPulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Elapsed seconds counter
      const timerInterval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

      // Live real-time polling every 1.0s to check provider response
      let pollInterval: any = null;
      if (bookingDbId) {
        pollInterval = setInterval(async () => {
          try {
            const statusRes = await checkBookingStatusApi(bookingDbId, currentUser?.id || 8);
            if (statusRes.success) {
              const st = (statusRes.status || '').toLowerCase();
              if (st === 'accepted' || st === 'confirmed' || st === 'in_progress' || st === 'completed') {
                setRadarStatus('accepted');
                clearInterval(timerInterval);
                clearInterval(pollInterval);
              } else if (st === 'rejected' || st === 'cancelled') {
                setRadarStatus('rejected');
                clearInterval(timerInterval);
                clearInterval(pollInterval);
              }
            }
          } catch (e) {
            console.log('[Radar Poll] Error checking status:', e);
          }
        }, 1000);
      }

      return () => {
        spin.stop();
        pulse.stop();
        clearInterval(timerInterval);
        if (pollInterval) clearInterval(pollInterval);
      };
    }
  }, [currentStep, bookingDbId]);

  // Pricing calculations
  const packagePrice = selectedPackage?.price || 499;
  const addonsTotal = selectedAddonIds.reduce((sum, id) => {
    const found = availableAddons.find(a => a.id === id);
    return sum + (found ? found.price : 0);
  }, 0);
  const subtotal = packagePrice + addonsTotal;

  // Dynamic convenience fee from serveasy-admin.platform_settings
  let convenienceFee = 0;
  const isVehicleFeeInScope = platformFeeSetting.is_active && (
    platformFeeSetting.service_scope === 'all' ||
    platformFeeSetting.applicable_services.includes('car-wash') ||
    platformFeeSetting.applicable_services.includes('bike-wash') ||
    platformFeeSetting.applicable_services.includes('vehicle-repair') ||
    platformFeeSetting.applicable_services.includes('others-wash-services') ||
    platformFeeSetting.applicable_services.includes('1') ||
    platformFeeSetting.applicable_services.includes('2')
  );

  if (isVehicleFeeInScope) {
    if (platformFeeSetting.type === 'percentage') {
      convenienceFee = Math.round(((subtotal * platformFeeSetting.amount) / 100) * 100) / 100;
    } else {
      convenienceFee = platformFeeSetting.amount;
    }
  }

  const totalAmount = subtotal + convenienceFee;

  // Reverse geocode given coordinates to clean doorstep address, landmark, and pincode
  const reverseGeocodeCoords = async (lat: number, lng: number) => {
    try {
      const result = await reverseGeocodeDoorstepCoords(lat, lng);
      if (result.address) setCustomAddress(result.address);
      if (result.landmark) setLandmark(result.landmark);
      if (result.pincode) setPincode(result.pincode);
      return result;
    } catch (e) {
      console.log('[Geocode] Error:', e);
    }
    return null;
  };

  // Acquire live GPS position and auto-fill address details
  const handleUseLiveLocation = async () => {
    setIsLocating(true);
    try {
      const result = await acquireDeviceLocation();
      const lat = result.latitude;
      const lng = result.longitude;
      setMapLatitude(lat);
      setMapLongitude(lng);

      if (result.address) setCustomAddress(result.address);
      if (result.landmark) setLandmark(result.landmark);
      if (result.pincode) setPincode(result.pincode);

      setShowNewAddressInput(true);
      setShowPinMap(true);
      Alert.alert(
        'Live Location Set 📍',
        `Doorstep location detected:\n\n${result?.address || `${lat}, ${lng}`}\n\nLandmark: ${result?.landmark || 'Nearby'}\nPincode: ${result?.pincode || '6-digit'}`
      );
    } catch (e) {
      setShowNewAddressInput(true);
      Alert.alert('Live Location Set 📍', `Coordinates updated.`);
    } finally {
      setIsLocating(false);
    }
  };

  const handleNudgePin = async (dLat: number, dLng: number) => {
    const newLat = Number((mapLatitude + dLat).toFixed(6));
    const newLng = Number((mapLongitude + dLng).toFixed(6));
    setMapLatitude(newLat);
    setMapLongitude(newLng);
    setShowMapPopup(true);

    try {
      const res = await reverseGeocodeCoords(newLat, newLng);
      if (res?.address) setCustomAddress(res.address);
      if (res?.landmark) setLandmark(res.landmark);
      if (res?.pincode) setPincode(res.pincode);
    } catch (e) {}
  };

  const handleZoomIn = () => setMapZoom((prev) => Math.min(prev + 1, 19));
  const handleZoomOut = () => setMapZoom((prev) => Math.max(prev - 1, 12));
  const handleToggleLayer = () => setMapLayer((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'));

  const handleApplyPinnedLocation = async () => {
    setIsLocating(true);
    try {
      const res = await reverseGeocodeCoords(mapLatitude, mapLongitude);
      setShowMapPopup(true);
      Alert.alert('Pin Location Applied 📍', `Doorstep address updated:\n\n${res?.address || `${mapLatitude}, ${mapLongitude}`}`);
    } finally {
      setIsLocating(false);
    }
  };

  const handleOpenExternalMap = () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${mapLatitude},${mapLongitude}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Error', 'Unable to open Google Maps.');
    });
  };

  // Save new custom address to MySQL serveasy.user_addresses
  const handleSaveNewAddress = async () => {
    if (!customAddress.trim() || !pincode.trim()) {
      Alert.alert('Required Fields', 'Please enter your street address and pincode.');
      return;
    }
    try {
      const saveRes = await saveUserAddressApi({
        userId: currentUser?.id || 8,
        label: addressLabel || 'Home',
        address: customAddress.trim(),
        landmark: landmark.trim(),
        pincode: pincode.trim(),
        latitude: mapLatitude,
        longitude: mapLongitude,
      });
      if (saveRes && saveRes.id) {
        setSavedAddresses(prev => {
          const filtered = prev.filter(
            a => a.id !== saveRes.id &&
                 !(a.address.trim().toLowerCase() === saveRes.address.trim().toLowerCase() && a.pincode === saveRes.pincode)
          );
          return [saveRes, ...filtered];
        });
        setSelectedAddressId(saveRes.id);
        setShowNewAddressInput(false);
        setShowPinMap(false);
        Alert.alert('Address Saved', 'Your address with map coordinates has been saved to your ServEasy account.');
      } else {
        setShowNewAddressInput(false);
        setShowPinMap(false);
      }
    } catch (e) {
      console.log('[Address Save] Error:', e);
      setShowNewAddressInput(false);
      setShowPinMap(false);
    }
  };

  // Next / Prev Navigation
  const handleNext = async () => {
    if (currentStep === 2) {
      if (showNewAddressInput) {
        if (!customAddress.trim() || !pincode.trim()) {
          Alert.alert('Required Fields', 'Please enter your street address and pincode.');
          return;
        }
        try {
          const saveRes = await saveUserAddressApi({
            userId: currentUser?.id || 8,
            label: 'Home',
            address: customAddress.trim(),
            landmark: landmark.trim(),
            pincode: pincode.trim(),
            latitude: mapLatitude,
            longitude: mapLongitude,
          });
          if (saveRes && saveRes.id) {
            setSavedAddresses(prev => {
              const filtered = prev.filter(
                a => a.id !== saveRes.id &&
                     !(a.address.trim().toLowerCase() === saveRes.address.trim().toLowerCase() && a.pincode === saveRes.pincode)
              );
              return [saveRes, ...filtered];
            });
            setSelectedAddressId(saveRes.id);
            setShowNewAddressInput(false);
            setShowPinMap(false);
          }
        } catch (e) {
          console.log('[Address Save] Error:', e);
        }
      }
    }

    if (currentStep === 5) {
      if (!selectedSlot) {
        Alert.alert('Select Time Slot', 'Please choose an available appointment time slot to proceed.');
        return;
      }
      if (isSingleProvider && bookedSlots.includes(selectedSlot)) {
        Alert.alert('Already Booked', 'This service provider is already booked at this time. Please choose another slot.');
        return;
      }
    }

    if (currentStep === 6) {
      if (!vehicleBrand.trim() || !vehicleModel.trim() || !vehicleRegNo.trim()) {
        Alert.alert('Required Fields', 'Please enter your vehicle brand, model, and registration number.');
        return;
      }
      // Save vehicle details to per-user cache for future pre-fill
      saveStoredVehicle(currentUser?.id, {
        brand: vehicleBrand.trim(),
        model: vehicleModel.trim(),
        regNo: vehicleRegNo.trim(),
        color: vehicleColor.trim(),
      });
    }

    if (currentStep === 8) {
      if (!customerName.trim()) {
        Alert.alert('Full Name Required', 'Please provide your full name.');
        return;
      }
      const cleanPhone = customerPhone.replace(/[\s\-+()]/g, '');
      const isEmail = customerPhone.includes('@');
      const isValidPhone = !isEmail && /^\d{10,12}$/.test(cleanPhone);
      if (!customerPhone.trim() || isEmail || !isValidPhone) {
        Alert.alert(
          'Valid Mobile Number Required',
          'Please enter a valid 10-digit mobile number to proceed to the next step.'
        );
        return;
      }
      // Auto-save phone to profile if it was freshly entered (not pre-loaded from DB)
      if (!phoneWasFromProfile && currentUser?.isLoggedIn && currentUser?.id) {
        updateUserProfileApi(currentUser.id, {
          fullName: customerName.trim() || 'User',
          email: currentUser.email || customerEmail || '',
          phone: customerPhone.trim(),
        })
          .then(res => {
            if (res.success) {
              // Mark as from-profile so we don't double-save on next step navigations
              setPhoneWasFromProfile(true);
            }
          })
          .catch(() => {}); // fire-and-forget, don't block navigation
      }
    }

    if (currentStep === 9) {
      if (bookingDbId) {
        setCurrentStep(10);
        return;
      }
      setIsSubmitting(true);
      const payload: VehicleWashBookingPayload = {
        serviceId: selectedProvider?.serviceId || (selectedProvider?.id === 28 ? 19 : 2),
        vehicleType,
        locationOption,
        address: customAddress,
        landmark,
        pincode,
        providerId: selectedProvider?.id || 28,
        providerName: selectedProvider?.businessName || 'Apex Auto Detailing',
        packageId: selectedPackage?.id || null,
        packageName: selectedPackage?.name || 'Vehicle Wash',
        packagePrice,
        scheduleDate,
        scheduleSlot: selectedSlot,
        vehicleBrand,
        vehicleModel,
        vehicleRegNo,
        vehicleColor,
        addons: availableAddons.filter(a => selectedAddonIds.includes(a.id)),
        customerName,
        customerPhone,
        customerAltPhone,
        customerEmail,
        subtotal,
        convenienceFee,
        totalAmount,
        paymentMethod: paymentMethod === 'Online' ? 'Online' : 'Pay on Completion',
        customerId: currentUser?.id || 8,
        latitude: mapLatitude,
        longitude: mapLongitude,
      };

      const result = await submitVehicleWashBookingApi(payload);
      setIsSubmitting(false);

      if (result.success && result.bookingId) {
        setBookingDbId(result.bookingId);
        setConfirmedBookingId(result.bookingNumber);
        setCurrentStep(10);
      } else {
        Alert.alert('Booking Notice', result.message || 'Could not place booking. Please check connection.');
      }
      return;
    }

    if (currentStep === 10) {
      if (radarStatus === 'rejected') {
        setBookingDbId(null);
        setCurrentStep(3); // Choose another provider
        return;
      }
      if (radarStatus === 'accepted') {
        setCurrentStep(11);
        return;
      }
      return;
    }

    if (currentStep === 11) {
      setIsSubmitting(true);
      if (bookingDbId) {
        if (paymentMethod === 'Online') {
          try {
            const rzpOrder = await createRazorpayOrderApi(bookingDbId, totalAmount, currentUser?.id || 8);
            if (rzpOrder.success && rzpOrder.order_id) {
              await verifyRazorpayPaymentApi(bookingDbId, rzpOrder.order_id, 'pay_' + Date.now(), 'mock_sig_dev', currentUser?.id || 8);
            }
          } catch (e) {
            console.log('[Payment] Razorpay online payment error:', e);
          }
        } else {
          await updateBookingPaymentApi(bookingDbId, paymentMethod);
        }
      }
      setIsSubmitting(false);
      setCurrentStep(12);
      if (onBookingComplete && confirmedBookingId) {
        onBookingComplete(confirmedBookingId);
      }
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      onBack();
    }
  };

  const spinInterpolation = radarSpinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Mandatory Authentication Gate (matches Web version session check)
  if (!currentUser?.isLoggedIn) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { borderBottomColor: activeTheme.cardBorder }]}>
          <TouchableOpacity
            onPress={onBack}
            style={[styles.backButton, { backgroundColor: activeTheme.pillInactiveBg }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={20} color={activeTheme.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={[styles.headerTitle, { color: activeTheme.textPrimary }]}>Sign In Required</Text>
            <Text style={[styles.headerSubtitle, { color: activeTheme.textSecondary }]}>Account Verification</Text>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{
            width: 84,
            height: 84,
            borderRadius: 42,
            backgroundColor: 'rgba(48, 209, 88, 0.12)',
            borderWidth: 1.5,
            borderColor: '#30D158',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 22,
          }}>
            <MaterialCommunityIcons name="shield-lock-outline" size={42} color="#30D158" />
          </View>

          <Text style={{ fontSize: 22, fontWeight: '800', color: activeTheme.textPrimary, textAlign: 'center', marginBottom: 10 }}>
            Login to Book Vehicle Wash
          </Text>
          <Text style={{ fontSize: 14, color: activeTheme.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 28, maxWidth: 320 }}>
            In accordance with ServEasy booking policies, you must be logged into your account to book doorstep vehicle wash and detailing services.
          </Text>

          <TouchableOpacity
            onPress={onRequireLogin}
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: '#30D158',
              borderRadius: 14,
              paddingVertical: 15,
              flexDirection: 'row',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              shadowColor: '#30D158',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <MaterialCommunityIcons name="cellphone-check" size={20} color="#000" />
            <Text style={{ color: '#000', fontSize: 15, fontWeight: '700' }}>
              Sign In with Mobile OTP
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onBack}
            style={{
              marginTop: 14,
              paddingVertical: 12,
              paddingHorizontal: 24,
            }}
          >
            <Text style={{ color: activeTheme.textSecondary, fontSize: 14, fontWeight: '600' }}>
              Return to Explore
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isFirstLoad) {
    return <ServiceWizardSkeleton theme={theme} activeTheme={activeTheme} />;
  }

  return (
    <View style={styles.container}>
      {/* ── TOP NAV BAR ── */}
      <View style={[styles.header, { borderBottomColor: activeTheme.cardBorder }]}>
        <TouchableOpacity
          onPress={handlePrev}
          style={[styles.backButton, { backgroundColor: activeTheme.pillInactiveBg }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={activeTheme.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.headerTitle, { color: activeTheme.textPrimary }]} numberOfLines={1}>
            Vehicle Car & Bike Wash
          </Text>
          <Text style={[styles.headerSubtitle, { color: activeTheme.textSecondary }]}>
            Step {currentStep} of {totalSteps}: {getStepName(currentStep)}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: activeTheme.pillInactiveBg }]}
        >
          <MaterialCommunityIcons name="close" size={20} color={activeTheme.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* ── PROGRESS BAR ── */}
      <View style={styles.progressBarWrapper}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${(currentStep / totalSteps) * 100}%` },
          ]}
        />
      </View>

      {/* ── MAIN SCROLL CONTENT ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            STEP 1: SELECT VEHICLE TYPE
            ======================================================== */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Select Vehicle Type
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Choose your vehicle class to customize treatments, chemical volumes, and pricing.
            </Text>

            <View style={styles.cardsGrid}>
              {[
                { type: 'Bike', title: 'Bike', desc: 'Motorcycles & Cruisers', icon: 'motorbike' as const },
                { type: 'Scooter', title: 'Scooter', desc: 'Scootys & EV Mopeds', icon: 'scooter' as const },
                { type: 'Car', title: 'Car', desc: 'Hatchbacks & Sedans', icon: 'car-side' as const },
                { type: 'SUV', title: 'SUV', desc: 'SUVs & Compact MUVs', icon: 'car-estate' as const },
                { type: 'Luxury', title: 'Luxury Car', desc: 'Sports, German & Exotic Cars', icon: 'car-sports' as const },
              ].map(item => {
                const isSelected = vehicleType === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    onPress={() => setVehicleType(item.type as VehicleType)}
                    style={[
                      styles.selectionCard,
                      {
                        backgroundColor: isSelected ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                        borderColor: isSelected ? '#30D158' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: isSelected ? '#30D158' : 'rgba(255,255,255,0.06)' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={28}
                        color={isSelected ? '#000' : '#30D158'}
                      />
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center' }}>
                      <Text style={[styles.cardTitle, { color: activeTheme.textPrimary }]}>
                        {item.title}
                      </Text>
                      <Text style={[styles.cardDesc, { color: activeTheme.textSecondary, marginTop: 2 }]}>
                        {item.desc}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={styles.selectedBadge}>
                        <MaterialCommunityIcons name="check-circle" size={16} color="#30D158" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================
            STEP 2: SERVICE LOCATION
            ======================================================== */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Choose Service Location
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Opt for doorstep mobile spa or drop your car at a certified partner center.
            </Text>

            {/* Doorstep vs Center options */}
            <View style={styles.radioOptionRow}>
              <TouchableOpacity
                onPress={() => setLocationOption('doorstep')}
                style={[
                  styles.radioCard,
                  {
                    backgroundColor: locationOption === 'doorstep' ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                    borderColor: locationOption === 'doorstep' ? '#30D158' : activeTheme.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons name="home-map-marker" size={24} color="#30D158" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.radioCardTitle, { color: activeTheme.textPrimary }]}>Doorstep Service</Text>
                  <Text style={[styles.radioCardDesc, { color: activeTheme.textSecondary }]}>Our fully equipped mobile detailing van visits you.</Text>
                </View>
                <MaterialCommunityIcons
                  name={locationOption === 'doorstep' ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color="#30D158"
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLocationOption('center')}
                style={[
                  styles.radioCard,
                  {
                    backgroundColor: locationOption === 'center' ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                    borderColor: locationOption === 'center' ? '#30D158' : activeTheme.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons name="garage-open" size={24} color="#0084FF" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.radioCardTitle, { color: activeTheme.textPrimary }]}>Visit Center</Text>
                  <Text style={[styles.radioCardDesc, { color: activeTheme.textSecondary }]}>Drive in to our state-of-the-art washing station.</Text>
                </View>
                <MaterialCommunityIcons
                  name={locationOption === 'center' ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color="#0084FF"
                />
              </TouchableOpacity>
            </View>

            {/* Saved Addresses List */}
            <Text style={[styles.sectionHeading, { color: activeTheme.textPrimary, marginTop: 20 }]}>
              Select Delivery Address
            </Text>

            {savedAddresses.map(addr => {
              const isSelected = selectedAddressId === addr.id && !showNewAddressInput;
              return (
                <TouchableOpacity
                  key={`addr-${addr.id}`}
                  onPress={() => {
                    setSelectedAddressId(addr.id);
                    setCustomAddress(addr.address);
                    setLandmark(addr.landmark || '');
                    setPincode(addr.pincode || '');
                    if (addr.latitude && !isNaN(Number(addr.latitude))) {
                      setMapLatitude(Number(addr.latitude));
                    }
                    if (addr.longitude && !isNaN(Number(addr.longitude))) {
                      setMapLongitude(Number(addr.longitude));
                    }
                    setShowNewAddressInput(false);
                    setShowPinMap(false);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.addressItemCard,
                    {
                      backgroundColor: isSelected ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                      borderColor: isSelected ? '#30D158' : activeTheme.cardBorder,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={addr.label === 'Home' ? 'home-outline' : 'briefcase-outline'}
                    size={22}
                    color={isSelected ? '#30D158' : activeTheme.textSecondary}
                    style={{ marginTop: 2 }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.addrLabel, { color: activeTheme.textPrimary }]}>{addr.label}</Text>
                      {addr.isDefault && (
                        <View style={styles.defaultPill}>
                          <Text style={styles.defaultPillText}>DEFAULT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.addrText, { color: activeTheme.textSecondary }]}>{addr.address}</Text>
                    <Text style={[styles.addrSub, { color: activeTheme.textSecondary }]}>
                      Landmark: {addr.landmark || 'N/A'} • PIN: {addr.pincode}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={isSelected ? '#30D158' : '#8E8E93'}
                    style={{ alignSelf: 'center', marginLeft: 8 }}
                  />
                </TouchableOpacity>
              );
            })}

            {/* Add Custom / New Address button & form with Pin Map & Live Location */}
            {!showNewAddressInput ? (
              <View style={styles.addressButtonGroup}>
                <TouchableOpacity
                  onPress={() => {
                    setShowNewAddressInput(true);
                    setShowPinMap(true);
                    setCustomAddress('');
                    setLandmark('');
                    setPincode('');
                  }}
                  style={[styles.addAddressBtn, { borderColor: activeTheme.cardBorder, flex: 1 }]}
                >
                  <MaterialCommunityIcons name="plus-circle-outline" size={17} color="#30D158" />
                  <Text style={{ color: '#30D158', fontWeight: '700', fontSize: 13 }}>Add New Address</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleUseLiveLocation}
                  disabled={isLocating}
                  style={[styles.liveLocQuickBtn, { borderColor: 'rgba(0, 132, 255, 0.4)', backgroundColor: 'rgba(0, 132, 255, 0.1)' }]}
                >
                  {isLocating ? (
                    <ActivityIndicator size="small" color="#0084FF" />
                  ) : (
                    <MaterialCommunityIcons name="crosshairs-gps" size={17} color="#0084FF" />
                  )}
                  <Text style={{ color: '#0084FF', fontWeight: '700', fontSize: 13 }}>Use Live Location</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.newAddrBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
                {/* Pin Map / Live Location Action Toolbar */}
                <View style={styles.mapActionToolbar}>
                  <TouchableOpacity
                    onPress={handleUseLiveLocation}
                    disabled={isLocating}
                    style={[
                      styles.mapActionBtn,
                      {
                        backgroundColor: 'rgba(48, 209, 88, 0.12)',
                        borderColor: '#30D158',
                      },
                    ]}
                  >
                    {isLocating ? (
                      <ActivityIndicator size="small" color="#30D158" />
                    ) : (
                      <MaterialCommunityIcons name="crosshairs-gps" size={15} color="#30D158" />
                    )}
                    <Text style={[styles.mapActionBtnText, { color: '#30D158' }]}>
                      {isLocating ? 'Locating...' : 'Use Live Location'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setShowPinMap(prev => !prev)}
                    style={[
                      styles.mapActionBtn,
                      {
                        backgroundColor: showPinMap ? 'rgba(0, 132, 255, 0.22)' : 'rgba(0, 132, 255, 0.1)',
                        borderColor: '#0084FF',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={showPinMap ? 'map-check' : 'map-marker-radius'}
                      size={15}
                      color="#0084FF"
                    />
                    <Text style={[styles.mapActionBtnText, { color: '#0084FF' }]}>
                      {showPinMap ? 'Hide Pin Map' : 'Pin Map Live'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Collapsible Interactive Pin Map Widget - Leaflet / Google Maps Pop-Up Style */}
                {showPinMap && (
                  <View style={[styles.leafletMapCanvas, { borderColor: activeTheme.cardBorder, marginBottom: 16 }]}>
                    {/* Real Google Maps Tile Background */}
                    <Image
                      source={{ uri: getGoogleMapTileUrl(mapLatitude, mapLongitude, mapZoom, mapLayer) }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />

                    {/* Top Left: Leaflet Style Zoom Controls (+ / -) */}
                    <View style={styles.leafletZoomControl}>
                      <TouchableOpacity onPress={handleZoomIn} style={styles.leafletZoomBtn} activeOpacity={0.8}>
                        <Text style={styles.leafletZoomText}>+</Text>
                      </TouchableOpacity>
                      <View style={styles.leafletZoomDivider} />
                      <TouchableOpacity onPress={handleZoomOut} style={styles.leafletZoomBtn} activeOpacity={0.8}>
                        <Text style={styles.leafletZoomText}>−</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Top Right: Layer Switcher (Google Roadmap / Satellite) */}
                    <TouchableOpacity onPress={handleToggleLayer} style={styles.leafletLayerBtn} activeOpacity={0.8}>
                      <MaterialCommunityIcons
                        name={mapLayer === 'roadmap' ? 'layers-outline' : 'earth'}
                        size={18}
                        color="#1E293B"
                      />
                    </TouchableOpacity>

                    {/* Center Leaflet Blue Marker Pin with Floating Pop-Up Callout Bubble */}
                    <View style={styles.leafletCenterPinContainer} pointerEvents="box-none">
                      {/* Pop-Up Style Callout Bubble (Matching Web Screenshot) */}
                      {showMapPopup && (
                        <View style={styles.leafletPopupWrapper} pointerEvents="box-none">
                          <View style={styles.leafletPopupCard}>
                            <Text style={{ fontSize: 11, marginRight: 4 }}>📍</Text>
                            <Text style={styles.leafletPopupText} numberOfLines={2}>
                              {customAddress ? customAddress : `${mapLatitude.toFixed(5)}, ${mapLongitude.toFixed(5)}`}
                            </Text>
                            <TouchableOpacity
                              onPress={() => setShowMapPopup(false)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                              style={{ marginLeft: 6 }}
                            >
                              <MaterialCommunityIcons name="close" size={13} color="#94A3B8" />
                            </TouchableOpacity>
                          </View>
                          {/* Downward triangle beak pointing directly to pin head */}
                          <View style={styles.leafletPopupBeak} />
                        </View>
                      )}

                      {/* Leaflet Blue Pin Marker */}
                      <TouchableOpacity onPress={() => setShowMapPopup(prev => !prev)} activeOpacity={0.9} style={styles.leafletPinTouch}>
                        <MaterialCommunityIcons name="map-marker" size={38} color="#0084FF" />
                        <View style={styles.leafletPinShadow} />
                      </TouchableOpacity>
                    </View>

                    {/* Fine-Tuning Nudge Controls Pad (Floating Bottom Right) */}
                    <View style={styles.leafletNudgePad}>
                      <TouchableOpacity
                        onPress={() => handleNudgePin(0.0005, 0)}
                        style={styles.leafletNudgeBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <MaterialCommunityIcons name="chevron-up" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity
                          onPress={() => handleNudgePin(0, -0.0005)}
                          style={styles.leafletNudgeBtn}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <MaterialCommunityIcons name="chevron-left" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleNudgePin(0, 0.0005)}
                          style={styles.leafletNudgeBtn}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleNudgePin(-0.0005, 0)}
                        style={styles.leafletNudgeBtn}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <MaterialCommunityIcons name="chevron-down" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>

                    {/* Bottom Bar: Watermark & Coordinates (Matching Web Version) */}
                    <View style={styles.leafletBottomBar}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                        <MaterialCommunityIcons name="information" size={11} color="#94A3B8" />
                        <Text style={styles.leafletStatusText} numberOfLines={1}>Doorstep location pinned on map</Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.leafletCoordsText}>
                          📍 {mapLatitude.toFixed(7)}, {mapLongitude.toFixed(7)}
                        </Text>
                        <Text style={styles.leafletWatermarkText}>Leaflet | © Google Maps</Text>
                      </View>
                    </View>
                  </View>
                )}

                <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginBottom: 8 }]}>Address Label *</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {(['Home', 'Work', 'Other'] as const).map(lbl => {
                    const isLblSelected = addressLabel === lbl;
                    return (
                      <TouchableOpacity
                        key={lbl}
                        onPress={() => setAddressLabel(lbl)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          paddingHorizontal: 16,
                          paddingVertical: 9,
                          borderRadius: 12,
                          borderWidth: 1.5,
                          borderColor: isLblSelected ? '#30D158' : activeTheme.cardBorder,
                          backgroundColor: isLblSelected ? 'rgba(48, 209, 88, 0.15)' : activeTheme.cardBg,
                        }}
                      >
                        <MaterialCommunityIcons
                          name={lbl === 'Home' ? 'home' : (lbl === 'Work' ? 'briefcase' : 'map-marker')}
                          size={16}
                          color={isLblSelected ? '#30D158' : activeTheme.textSecondary}
                        />
                        <Text style={{
                          color: isLblSelected ? '#30D158' : activeTheme.textPrimary,
                          fontSize: 13,
                          fontWeight: isLblSelected ? '700' : '500'
                        }}>
                          {lbl}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>Full Street Address *</Text>
                <TextInput
                  style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                  placeholder="House number, Street name, Area"
                  placeholderTextColor="#64748b"
                  value={customAddress}
                  onChangeText={setCustomAddress}
                />
                <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 10 }]}>Landmark</Text>
                <TextInput
                  style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                  placeholder="Near shopping mall / metro pillar"
                  placeholderTextColor="#64748b"
                  value={landmark}
                  onChangeText={setLandmark}
                />
                <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 10 }]}>Pincode *</Text>
                <TextInput
                  style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                  placeholder="6-digit pincode"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                  value={pincode}
                  onChangeText={setPincode}
                />

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                  <TouchableOpacity
                    onPress={handleSaveNewAddress}
                    style={{
                      flex: 1,
                      backgroundColor: '#30D158',
                      borderRadius: 10,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>Save & Use Address</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setShowNewAddressInput(false);
                      setShowPinMap(false);
                    }}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: activeTheme.cardBorder,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: activeTheme.textSecondary, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================================
            STEP 3: SELECT SERVICE PROVIDER
            ======================================================== */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Select Service Provider
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Choose from verified certified auto detailing centers in your vicinity.
            </Text>

            {loadingProviders ? (
              <ActivityIndicator size="large" color="#30D158" style={{ marginTop: 40 }} />
            ) : activeProviders.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <MaterialCommunityIcons name="car-wash" size={40} color="#30D158" />
                <Text style={{ color: activeTheme.textPrimary, fontWeight: '700', marginTop: 12, fontSize: 16 }}>
                  No Active Providers
                </Text>
                <Text style={{ color: activeTheme.textSecondary, textAlign: 'center', marginTop: 6, fontSize: 13 }}>
                  No verified service providers currently offer {vehicleType} wash in this region.
                </Text>
              </View>
            ) : (
              activeProviders.map(prov => {
                const isSelected = selectedProvider?.id === prov.id;
                return (
                  <TouchableOpacity
                    key={prov.id}
                    onPress={() => {
                      setSelectedProvider(prov);
                      const provPlans = getPlansForProvider(prov, vehicleType);
                      setPackages(provPlans);
                      const firstPlan = provPlans.length > 0 ? provPlans[0] : null;
                      setSelectedPackage(firstPlan);
                      const srvId = firstPlan?.serviceId || prov.serviceId;
                      const dbAddons = getAddonsForProvider(prov, srvId);
                      setAvailableAddons(dbAddons);
                      setSelectedAddonIds([]);
                    }}
                    style={[
                      styles.providerCard,
                      {
                        backgroundColor: isSelected ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                        borderColor: isSelected ? '#30D158' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.provAvatar}>
                      <Text style={styles.provAvatarText}>{prov.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={[styles.provName, { color: activeTheme.textPrimary }]}>{prov.businessName}</Text>
                        <View style={styles.ratingBadge}>
                          <MaterialCommunityIcons name="star" size={13} color="#FFD60A" />
                          <Text style={styles.ratingText}>{prov.rating}</Text>
                        </View>
                      </View>
                      <Text style={[styles.provAddr, { color: activeTheme.textSecondary }]}>
                        <MaterialCommunityIcons name="map-marker-distance" size={13} color="#30D158" /> {prov.distanceKm} • {prov.address}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 }}>
                        <View style={styles.verifiedChip}>
                          <MaterialCommunityIcons name="shield-check" size={12} color="#30D158" />
                          <Text style={styles.verifiedText}>ServEasy Verified</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#30D158', fontWeight: '600' }}>Available Now</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ========================================================
            STEP 4: SELECT SERVICE PLAN
            ======================================================== */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Select Service Plan
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Verified plans from {selectedProvider?.businessName || 'Provider'} for your {vehicleType}.
            </Text>

            {packages.length === 0 ? (
              <View style={{ padding: 30, alignItems: 'center' }}>
                <MaterialCommunityIcons name="car-wash" size={40} color="#30D158" />
                <Text style={{ color: activeTheme.textPrimary, fontWeight: '700', marginTop: 12, fontSize: 16 }}>
                  No Active Plans Found
                </Text>
                <Text style={{ color: activeTheme.textSecondary, textAlign: 'center', marginTop: 6, fontSize: 13 }}>
                  This service provider does not currently offer packages for {vehicleType}.
                </Text>
              </View>
            ) : (
              packages.map(pkg => {
                const isSelected = selectedPackage?.id === pkg.id;
              return (
                <TouchableOpacity
                  key={pkg.id}
                  onPress={() => {
                    setSelectedPackage(pkg);
                    const srvId = pkg.serviceId || selectedProvider?.serviceId;
                    const dbAddons = getAddonsForProvider(selectedProvider, srvId);
                    setAvailableAddons(dbAddons);
                    setSelectedAddonIds(prev => prev.filter(id => dbAddons.some(a => a.id === id)));
                  }}
                  style={[
                    styles.packageCard,
                    {
                      backgroundColor: isSelected ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                      borderColor: isSelected ? '#30D158' : activeTheme.cardBorder,
                    },
                  ]}
                >
                  {pkg.badge && (
                    <View style={styles.pkgBadge}>
                      <Text style={styles.pkgBadgeText}>{pkg.badge}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pkgName, { color: activeTheme.textPrimary }]}>{pkg.name}</Text>
                      <Text style={[styles.pkgDuration, { color: activeTheme.textSecondary }]}>
                        <MaterialCommunityIcons name="clock-outline" size={12} /> {pkg.duration}
                      </Text>
                    </View>
                    <Text style={styles.pkgPrice}>₹{pkg.price}</Text>
                  </View>

                  <View style={styles.featuresList}>
                    {pkg.features.map((feat, i) => (
                      <View key={i} style={styles.featureRow}>
                        <MaterialCommunityIcons name="check-circle" size={15} color="#30D158" />
                        <Text style={[styles.featureText, { color: activeTheme.textPrimary }]}>{feat}</Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          </View>
        )}

        {/* ========================================================
            STEP 5: SCHEDULE DATE & TIME
            ======================================================== */}
        {currentStep === 5 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Schedule Date & Time
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Pick an appointment slot convenient for your schedule.
            </Text>

            <Text style={[styles.sectionHeading, { color: activeTheme.textPrimary }]}>Service Date</Text>
            <View style={styles.dateChipsRow}>
              {[0, 1, 2, 3].map(days => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                const dStr = d.toISOString().slice(0, 10);
                const isSelected = scheduleDate === dStr;
                const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <TouchableOpacity
                    key={dStr}
                    onPress={() => setScheduleDate(dStr)}
                    style={[
                      styles.dateChip,
                      {
                        backgroundColor: isSelected ? '#30D158' : activeTheme.inputBg,
                        borderColor: isSelected ? '#30D158' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.dateChipText, { color: isSelected ? '#000' : activeTheme.textPrimary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.sectionHeading, { color: activeTheme.textPrimary, marginTop: 22 }]}>Available Time Slots</Text>
            <View style={styles.slotsGrid}>
              {timeSlots.map(slot => {
                const isSelected = selectedSlot === slot;
                const isBooked = isSingleProvider && bookedSlots.includes(slot);

                const handleSlotPress = () => {
                  if (isBooked) {
                    Alert.alert(
                      'Already Booked',
                      'This service provider is already booked at this time. Please choose another slot.',
                      [{ text: 'OK' }]
                    );
                    return;
                  }
                  setSelectedSlot(slot);
                };

                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={handleSlotPress}
                    activeOpacity={isBooked ? 0.6 : 0.8}
                    style={[
                      styles.slotPill,
                      {
                        backgroundColor: isBooked
                          ? 'rgba(239, 68, 68, 0.08)'
                          : (isSelected ? 'rgba(48, 209, 88, 0.15)' : activeTheme.cardBg),
                        borderColor: isBooked
                          ? 'rgba(239, 68, 68, 0.4)'
                          : (isSelected ? '#30D158' : activeTheme.cardBorder),
                        opacity: isBooked ? 0.38 : 1.0,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isBooked ? "calendar-remove-outline" : "clock-time-four-outline"}
                      size={14}
                      color={isBooked ? '#ef4444' : (isSelected ? '#30D158' : activeTheme.textSecondary)}
                    />
                    <Text
                      style={[
                        styles.slotPillText,
                        {
                          color: isBooked ? '#ef4444' : (isSelected ? '#30D158' : activeTheme.textPrimary),
                          textDecorationLine: isBooked ? 'line-through' : 'none',
                        },
                      ]}
                    >
                      {slot}
                    </Text>
                    {isBooked ? (
                      <View style={{ marginLeft: 6, backgroundColor: 'rgba(239, 68, 68, 0.25)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: '700', color: '#ef4444' }}>BOOKED</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================
            STEP 6: VEHICLE SPECIFICATIONS
            ======================================================== */}
        {currentStep === 6 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Enter Vehicle Specifications
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Provide details so our detailer can bring the right foam guns and microfibers.
            </Text>

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>Vehicle Brand *</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
              placeholder="e.g. Honda, Hyundai, Suzuki, BMW"
              placeholderTextColor="#64748b"
              value={vehicleBrand}
              onChangeText={setVehicleBrand}
            />

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 12 }]}>Model Name *</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
              placeholder="e.g. City, Creta, Swift, Activa 125"
              placeholderTextColor="#64748b"
              value={vehicleModel}
              onChangeText={setVehicleModel}
            />

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 12 }]}>Registration Number *</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
              placeholder="e.g. WB02AK4521, MH12DE9876"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              value={vehicleRegNo}
              onChangeText={setVehicleRegNo}
            />

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 12 }]}>Body Color (Optional)</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
              placeholder="e.g. Matte Black, Pearl White, Red"
              placeholderTextColor="#64748b"
              value={vehicleColor}
              onChangeText={setVehicleColor}
            />
          </View>
        )}

        {/* ========================================================
            STEP 7: PREMIUM ADDONS
            ======================================================== */}
        {currentStep === 7 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Add Premium Extras
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Select protective treatments to pamper your vehicle.
            </Text>

            {availableAddons.length === 0 ? (
              <View style={{
                padding: 32,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: activeTheme.cardBg,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: activeTheme.cardBorder,
                marginTop: 12,
              }}>
                <MaterialCommunityIcons name="layers-off-outline" size={42} color="#64748b" />
                <Text style={{
                  color: activeTheme.textSecondary,
                  fontSize: 14,
                  fontWeight: '500',
                  marginTop: 12,
                  textAlign: 'center',
                  fontStyle: 'italic',
                }}>
                  No additional small services/addons available for this plan.
                </Text>
              </View>
            ) : (
              availableAddons.map(addon => {
                const isSelected = selectedAddonIds.includes(addon.id);
                return (
                  <TouchableOpacity
                    key={addon.id}
                    onPress={() => {
                      setSelectedAddonIds(prev =>
                        prev.includes(addon.id) ? prev.filter(x => x !== addon.id) : [...prev, addon.id]
                      );
                    }}
                    style={[
                      styles.addonCard,
                      {
                        backgroundColor: isSelected ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                        borderColor: isSelected ? '#30D158' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={addon.icon || 'shield-plus'}
                      size={24}
                      color={isSelected ? '#30D158' : activeTheme.textSecondary}
                      style={{ marginTop: 2 }}
                    />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.addonName, { color: activeTheme.textPrimary }]}>{addon.name}</Text>
                        <Text style={styles.addonPrice}>+₹{addon.price}</Text>
                      </View>
                      <Text style={[styles.addonDesc, { color: activeTheme.textSecondary }]}>
                        {addon.description}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                      size={22}
                      color={isSelected ? '#30D158' : '#64748b'}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ========================================================
            STEP 8: CUSTOMER INFORMATION
            ======================================================== */}
        {currentStep === 8 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Customer Information
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Provide contact coordinates for booking tracking and updates.
            </Text>

            {currentUser?.isLoggedIn && (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                backgroundColor: 'rgba(48, 209, 88, 0.12)',
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 8,
                marginBottom: 16,
                borderWidth: 1,
                borderColor: 'rgba(48, 209, 88, 0.25)',
              }}>
                <MaterialCommunityIcons name="account-check" size={18} color="#30D158" />
                <Text style={{ color: '#30D158', fontSize: 12, fontWeight: '600', flex: 1 }}>
                  {customerPhone && !customerPhone.includes('@')
                    ? `Auto-filled from your verified profile (${customerPhone})`
                    : `Profile verified (${currentUser.email || (currentUser.identity && currentUser.identity.includes('@') ? currentUser.identity : 'Customer')}). Please enter your mobile number below.`}
                </Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>Full Name *</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Your full name"
              placeholderTextColor="#64748b"
            />

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 12 }]}>Primary Phone Number *</Text>
            <TextInput
              style={[
                styles.inputField,
                { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder },
                (customerPhone.includes('@') || (!customerPhone.trim() && currentStep === 8)) && { borderColor: '#FF9F0A' }
              ]}
              keyboardType="phone-pad"
              placeholder="Enter 10-digit mobile number"
              placeholderTextColor="#64748b"
              value={customerPhone}
              onChangeText={setCustomerPhone}
              editable={true}
              maxLength={15}
            />
            {(!customerPhone.trim() || customerPhone.includes('@') || !/^\d{10,12}$/.test(customerPhone.replace(/[\s\-+()]/g, ''))) && (
              <Text style={{ fontSize: 11, color: '#FF9F0A', marginTop: 4, fontWeight: '500' }}>
                * Valid 10-digit mobile number required to proceed to next step
              </Text>
            )}

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 12 }]}>Alternative Mobile (Optional)</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
              keyboardType="phone-pad"
              placeholder="+91 XXXXX XXXXX"
              placeholderTextColor="#64748b"
              value={customerAltPhone}
              onChangeText={setCustomerAltPhone}
            />

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 12 }]}>Email Receipt (Optional)</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
              keyboardType="email-address"
              value={customerEmail}
              onChangeText={setCustomerEmail}
            />
          </View>
        )}

        {/* ========================================================
            STEP 9: ORDER SUMMARY
            ======================================================== */}
        {currentStep === 9 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Order Summary
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Double-check your service details and bill breakdown.
            </Text>

            <View style={[styles.summaryBox, { backgroundColor: activeTheme.cardBg, borderColor: activeTheme.cardBorder }]}>
              <Text style={styles.summarySectionTitle}>Vehicle & Location</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Vehicle</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>
                  {vehicleType} • {vehicleBrand} {vehicleModel}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Reg Number</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>{vehicleRegNo}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Location Mode</Text>
                <Text style={[styles.sumVal, { color: '#30D158' }]}>
                  {locationOption === 'doorstep' ? 'Doorstep Service' : 'Visit Service Center'}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Address</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]} numberOfLines={2}>
                  {customAddress}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Schedule</Text>
                <Text style={[styles.sumVal, { color: '#0084FF' }]}>
                  {scheduleDate} • {selectedSlot}
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.summarySectionTitle}>Service Plan & Provider</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Provider</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>
                  {selectedProvider?.businessName}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>{selectedPackage?.name}</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>₹{packagePrice}</Text>
              </View>

              {selectedAddonIds.map(id => {
                const add = availableAddons.find(a => a.id === id);
                if (!add) return null;
                return (
                  <View key={id} style={styles.summaryRow}>
                    <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>+ {add.name}</Text>
                    <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>₹{add.price}</Text>
                  </View>
                );
              })}

              <View style={styles.divider} />

              <Text style={styles.summarySectionTitle}>Bill Breakdown</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Service Provider Amount</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>₹{subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>
                  Platform Charge {platformFeeSetting.type === 'percentage' && isVehicleFeeInScope ? `(${platformFeeSetting.amount}%)` : ''}
                </Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>+₹{convenienceFee.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, { marginTop: 8 }]}>
                <Text style={[styles.sumTotalLabel, { color: activeTheme.textPrimary }]}>Total Amount (Paid by Customer)</Text>
                <Text style={styles.sumTotalVal}>₹{totalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ========================================================
            STEP 10: PROVIDER ACCEPTANCE RADAR
            ======================================================== */}
        {currentStep === 10 && (() => {
          const mins = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
          const secs = String(elapsedSeconds % 60).padStart(2, '0');
          const formattedTimer = `${mins}:${secs}`;

          return (
            <View style={styles.stepContainer}>
              <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
                Provider Acceptance
              </Text>
              <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
                We have sent your request to{' '}
                <Text style={{ fontWeight: '700', color: '#0084FF' }}>
                  {selectedProvider?.businessName || 'the provider'}
                </Text>{' '}
                — waiting for live confirmation.
              </Text>

              <View style={[styles.radarContainer, { backgroundColor: activeTheme.cardBg, borderColor: activeTheme.cardBorder }]}>
                {/* Radar Circles */}
                <View style={styles.radarCircleWrapper}>
                  <Animated.View
                    style={[
                      styles.radarPulseRing,
                      {
                        borderColor:
                          radarStatus === 'accepted'
                            ? 'rgba(48, 209, 88, 0.4)'
                            : radarStatus === 'rejected'
                            ? 'rgba(255, 69, 58, 0.4)'
                            : 'rgba(0, 132, 255, 0.4)',
                        transform: [{ scale: radarPulseAnim }],
                      },
                    ]}
                  />
                  {radarStatus === 'searching' && (
                    <Animated.View
                      style={[
                        styles.radarScanLine,
                        {
                          backgroundColor: '#0084FF',
                          transform: [{ rotate: spinInterpolation }],
                        },
                      ]}
                    />
                  )}
                  <View
                    style={[
                      styles.radarCenterHub,
                      {
                        borderColor:
                          radarStatus === 'accepted'
                            ? '#30D158'
                            : radarStatus === 'rejected'
                            ? '#FF453A'
                            : '#0084FF',
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        radarStatus === 'accepted'
                          ? 'check-circle'
                          : radarStatus === 'rejected'
                          ? 'close-circle'
                          : 'radio-tower'
                      }
                      size={30}
                      color={
                        radarStatus === 'accepted'
                          ? '#30D158'
                          : radarStatus === 'rejected'
                          ? '#FF453A'
                          : '#0084FF'
                      }
                    />
                  </View>
                </View>

                {/* Provider Live Preview Card */}
                <View
                  style={[
                    styles.radarProviderPreviewCard,
                    {
                      backgroundColor:
                        radarStatus === 'accepted'
                          ? 'rgba(48, 209, 88, 0.12)'
                          : radarStatus === 'rejected'
                          ? 'rgba(255, 69, 58, 0.12)'
                          : activeTheme.inputBg,
                      borderColor:
                        radarStatus === 'accepted'
                          ? '#30D158'
                          : radarStatus === 'rejected'
                          ? '#FF453A'
                          : activeTheme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.provAvatar}>
                    <Text style={styles.provAvatarText}>
                      {selectedProvider?.avatar || selectedProvider?.businessName?.charAt(0) || 'P'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewProvName, { color: activeTheme.textPrimary }]}>
                      {selectedProvider?.businessName}
                    </Text>
                    <Text style={[styles.previewProvService, { color: activeTheme.textSecondary }]}>
                      {vehicleType} • {selectedPackage?.name}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.radarLiveBadge,
                      {
                        backgroundColor:
                          radarStatus === 'accepted'
                            ? 'rgba(48, 209, 88, 0.2)'
                            : radarStatus === 'rejected'
                            ? 'rgba(255, 69, 58, 0.2)'
                            : 'rgba(0, 132, 255, 0.18)',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.radarPingDot,
                        {
                          backgroundColor:
                            radarStatus === 'accepted'
                              ? '#30D158'
                              : radarStatus === 'rejected'
                              ? '#FF453A'
                              : '#0084FF',
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.radarLiveBadgeText,
                        {
                          color:
                            radarStatus === 'accepted'
                              ? '#30D158'
                              : radarStatus === 'rejected'
                              ? '#FF453A'
                              : '#0084FF',
                        },
                      ]}
                    >
                      {radarStatus === 'accepted'
                        ? 'Accepted'
                        : radarStatus === 'rejected'
                        ? 'Declined'
                        : 'Connecting...'}
                    </Text>
                  </View>
                </View>

                {/* Waiting Elapsed Timer */}
                <View style={styles.radarTimerBox}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color="#0084FF" />
                  <Text style={[styles.radarTimerText, { color: activeTheme.textSecondary }]}>
                    Waiting elapsed:{' '}
                    <Text style={{ fontWeight: '800', color: activeTheme.textPrimary }}>
                      {formattedTimer}
                    </Text>
                  </Text>
                </View>

                {/* Status Heading & Description */}
                <Text style={[styles.radarStatusHeading, { color: activeTheme.textPrimary }]}>
                  {radarStatus === 'accepted'
                    ? 'Request Accepted!'
                    : radarStatus === 'rejected'
                    ? 'Request Declined'
                    : 'Awaiting Provider Response...'}
                </Text>
                <Text style={[styles.radarStatusSub, { color: activeTheme.textSecondary }]}>
                  {radarStatus === 'accepted'
                    ? `${selectedProvider?.businessName} has accepted your booking! Tap Continue to choose your payment method.`
                    : radarStatus === 'rejected'
                    ? `${selectedProvider?.businessName} is currently unavailable for this time slot.`
                    : 'The service provider has been instantly notified of your wash request and schedule.'}
                </Text>

                {radarStatus === 'rejected' && (
                  <TouchableOpacity
                    onPress={() => {
                      setBookingDbId(null);
                      setCurrentStep(3);
                    }}
                    style={{
                      marginTop: 16,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                      borderRadius: 12,
                      backgroundColor: 'rgba(255, 69, 58, 0.15)',
                      borderWidth: 1,
                      borderColor: '#FF453A',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <MaterialCommunityIcons name="refresh" size={16} color="#FF453A" />
                    <Text style={{ color: '#FF453A', fontWeight: '700', fontSize: 13 }}>
                      Select Another Provider
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })()}

        {/* ========================================================
            STEP 11: PAYMENT METHOD
            ======================================================== */}
        {currentStep === 11 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Choose Payment Method
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Total Amount: ₹{totalAmount}
            </Text>

            <View style={styles.payMethodsGrid}>
              <TouchableOpacity
                onPress={() => setPaymentMethod('COD')}
                style={[
                  styles.payCard,
                  {
                    backgroundColor: paymentMethod === 'COD' ? 'rgba(48, 209, 88, 0.12)' : activeTheme.cardBg,
                    borderColor: paymentMethod === 'COD' ? '#30D158' : activeTheme.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons name="cash-multiple" size={28} color="#30D158" />
                <Text style={[styles.payTitle, { color: activeTheme.textPrimary }]}>Pay on Completion</Text>
                <Text style={[styles.payDesc, { color: activeTheme.textSecondary }]}>Pay with Cash or UPI after inspecting your clean vehicle</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPaymentMethod('Online')}
                style={[
                  styles.payCard,
                  {
                    backgroundColor: paymentMethod === 'Online' ? 'rgba(0, 132, 255, 0.12)' : activeTheme.cardBg,
                    borderColor: paymentMethod === 'Online' ? '#0084FF' : activeTheme.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons name="shield-check" size={28} color="#0084FF" />
                <Text style={[styles.payTitle, { color: activeTheme.textPrimary }]}>Razorpay Online (UPI / Card)</Text>
                <Text style={[styles.payDesc, { color: activeTheme.textSecondary }]}>Instant UPI (GPay, PhonePe, Paytm), Cards & NetBanking with 100% Escrow Protection</Text>
              </TouchableOpacity>
            </View>

            {paymentMethod === 'Online' && (
              <View style={[styles.cardFormBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
                <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>Card Number</Text>
                <TextInput
                  style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                  value={cardNumber}
                  onChangeText={setCardNumber}
                  keyboardType="numeric"
                />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>Expiry Date</Text>
                    <TextInput
                      style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>CVV</Text>
                    <TextInput
                      style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                      value={cardCvv}
                      onChangeText={setCardCvv}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ========================================================
            STEP 12: BOOKING CONFIRMATION & LIVE TRACKER
            ======================================================== */}
        {currentStep === 12 && (
          <View style={styles.stepContainer}>
            <View style={styles.successIconBadge}>
              <MaterialCommunityIcons name="check-circle" size={54} color="#30D158" />
            </View>
            <Text style={[styles.successHeading, { color: activeTheme.textPrimary }]}>
              Booking Confirmed!
            </Text>
            <Text style={[styles.successSub, { color: activeTheme.textSecondary }]}>
              Your vehicle wash reservation has been registered.
            </Text>

            <View style={[styles.bookingRefCard, { backgroundColor: activeTheme.cardBg, borderColor: activeTheme.cardBorder }]}>
              <Text style={styles.bookingRefLabel}>BOOKING REFERENCE NUMBER</Text>
              <Text style={styles.bookingRefNumber}>{confirmedBookingId || 'SRV-20261026-98421'}</Text>

              <View style={styles.trackerStepper}>
                {[
                  { label: 'Booking Confirmed', done: true, active: false, time: 'Just now' },
                  { label: 'Detailer Dispatched', done: true, active: false, time: 'Scheduled for ' + selectedSlot },
                  { label: 'Water & Power Setup', done: false, active: true, time: 'Pending arrival' },
                  { label: 'Foam & Wash Completed', done: false, active: false, time: '--' },
                  { label: 'Inspected & Signed Off', done: false, active: false, time: '--' },
                ].map((st, idx) => (
                  <View key={idx} style={styles.trackerStepRow}>
                    <View
                      style={[
                        styles.trackerCircle,
                        {
                          backgroundColor: st.done ? '#30D158' : st.active ? '#0084FF' : '#334155',
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={st.done ? 'check' : 'circle-slice-8'}
                        size={14}
                        color="#fff"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.trackerStepLabel, { color: activeTheme.textPrimary }]}>{st.label}</Text>
                      <Text style={{ fontSize: 11, color: activeTheme.textSecondary }}>{st.time}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── BOTTOM ACTION BAR ── */}
      <View style={[styles.bottomBar, { backgroundColor: activeTheme.cardBg, borderTopColor: activeTheme.cardBorder }]}>
        {currentStep > 1 && currentStep < 12 && (
          <TouchableOpacity
            onPress={handlePrev}
            style={[styles.prevButton, { borderColor: activeTheme.cardBorder }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={activeTheme.textPrimary} />
            <Text style={[styles.prevButtonText, { color: activeTheme.textPrimary }]}>Back</Text>
          </TouchableOpacity>
        )}

        {currentStep < 12 ? (
          <TouchableOpacity
            onPress={handleNext}
            disabled={
              isSubmitting ||
              (currentStep === 10 && radarStatus === 'searching') ||
              (currentStep === 8 && (
                !customerName.trim() ||
                !customerPhone.trim() ||
                customerPhone.includes('@') ||
                !/^\d{10,12}$/.test(customerPhone.replace(/[\s\-+()]/g, ''))
              ))
            }
            style={[
              styles.nextButton,
              {
                opacity:
                  isSubmitting ||
                  (currentStep === 10 && radarStatus === 'searching') ||
                  (currentStep === 8 && (
                    !customerName.trim() ||
                    !customerPhone.trim() ||
                    customerPhone.includes('@') ||
                    !/^\d{10,12}$/.test(customerPhone.replace(/[\s\-+()]/g, ''))
                  ))
                    ? 0.55
                    : 1,
                marginLeft: currentStep === 1 ? 0 : 12,
              },
            ]}
          >
            <LinearGradient
              colors={
                currentStep === 10 && radarStatus === 'rejected'
                  ? ['#FF453A', '#FF9F0A']
                  : ['#30D158', '#0084FF']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep === 9
                      ? 'Proceed to Provider Confirmation'
                      : currentStep === 10
                      ? radarStatus === 'accepted'
                        ? 'Continue to Payment'
                        : radarStatus === 'rejected'
                        ? 'Select Another Provider'
                        : 'Waiting for Provider...'
                      : currentStep === 11
                      ? `Confirm & Book (₹${totalAmount})`
                      : 'Continue'}
                  </Text>
                  <MaterialCommunityIcons
                    name={
                      currentStep === 10 && radarStatus === 'rejected'
                        ? 'refresh'
                        : 'arrow-right'
                    }
                    size={18}
                    color="#fff"
                  />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={onBack}
            style={[styles.nextButton, { marginLeft: 0 }]}
          >
            <LinearGradient
              colors={['#30D158', '#0084FF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.nextButtonText}>Return to Home</Text>
              <MaterialCommunityIcons name="home" size={18} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

function getStepName(step: number): string {
  switch (step) {
    case 1: return 'Vehicle Type';
    case 2: return 'Service Location';
    case 3: return 'Service Provider';
    case 4: return 'Service Plan';
    case 5: return 'Schedule Slot';
    case 6: return 'Vehicle Specs';
    case 7: return 'Premium Extras';
    case 8: return 'Customer Info';
    case 9: return 'Order Summary';
    case 10: return 'Provider Radar';
    case 11: return 'Payment';
    case 12: return 'Confirmation';
    default: return 'Booking';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  progressBarWrapper: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#30D158',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  stepContainer: {
    marginBottom: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  cardsGrid: {
    gap: 12,
  },
  selectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  selectedBadge: {
    marginLeft: 'auto',
  },
  radioOptionRow: {
    gap: 10,
  },
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  radioCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  radioCardDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  addressItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  addrLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  defaultPill: {
    backgroundColor: 'rgba(48, 209, 88, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  defaultPillText: {
    color: '#30D158',
    fontSize: 9,
    fontWeight: '800',
  },
  addrText: {
    fontSize: 12,
    marginTop: 3,
  },
  addrSub: {
    fontSize: 11,
    marginTop: 2,
  },
  addressButtonGroup: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  addAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  liveLocQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
  },
  mapActionToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  mapActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  mapActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  mapContainerCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 14,
    backgroundColor: '#0b1120',
  },
  mapTopBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  mapLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#30D158',
  },
  mapCoordsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  mapPreviewCanvas: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#0f172a',
  },
  leafletMapCanvas: {
    height: 230,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: '#E2E8F0',
  },
  leafletZoomControl: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  leafletZoomBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafletZoomDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  leafletZoomText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  leafletLayerBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  leafletCenterPinContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  leafletPopupWrapper: {
    alignItems: 'center',
    marginBottom: -4,
    zIndex: 25,
  },
  leafletPopupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  leafletPopupText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1E293B',
    flexShrink: 1,
  },
  leafletPopupBeak: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 0,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    marginTop: -1,
  },
  leafletPinTouch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafletPinShadow: {
    width: 14,
    height: 4,
    borderRadius: 7,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    marginTop: -4,
  },
  leafletNudgePad: {
    position: 'absolute',
    bottom: 24,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    padding: 3,
    borderRadius: 8,
    alignItems: 'center',
    gap: 3,
    zIndex: 20,
  },
  leafletNudgeBtn: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafletBottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    zIndex: 15,
  },
  leafletStatusText: {
    color: '#94A3B8',
    fontSize: 8.5,
    fontWeight: '600',
  },
  leafletCoordsText: {
    color: '#38BDF8',
    fontSize: 8.5,
    fontWeight: '700',
  },
  leafletWatermarkText: {
    color: '#64748B',
    fontSize: 7.5,
    fontWeight: '500',
  },
  mapGridLines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.12,
    borderWidth: 1,
    borderColor: '#38bdf8',
  },
  mapPulseRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  mapCenterPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapHintText: {
    position: 'absolute',
    bottom: 6,
    fontSize: 10,
    color: '#64748b',
    fontWeight: '500',
  },
  mapBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  nudgePad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nudgeBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyPinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#30D158',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  applyPinBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#000000',
  },
  newAddrBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputField: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  providerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  provAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0084FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  provAvatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  provName: {
    fontSize: 14,
    fontWeight: '700',
  },
  provAddr: {
    fontSize: 11,
    marginTop: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingText: {
    color: '#FFD60A',
    fontSize: 11,
    fontWeight: '700',
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  verifiedText: {
    color: '#30D158',
    fontSize: 10,
    fontWeight: '700',
  },
  packageCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 12,
    position: 'relative',
  },
  pkgBadge: {
    position: 'absolute',
    top: -9,
    right: 14,
    backgroundColor: '#30D158',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pkgBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },
  pkgName: {
    fontSize: 16,
    fontWeight: '800',
  },
  pkgDuration: {
    fontSize: 11,
    marginTop: 2,
  },
  pkgPrice: {
    fontSize: 20,
    fontWeight: '900',
    color: '#30D158',
  },
  featuresList: {
    marginTop: 12,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 12,
  },
  dateChipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  slotPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 10,
  },
  addonName: {
    fontSize: 13,
    fontWeight: '700',
  },
  addonPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: '#30D158',
  },
  addonDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  summaryBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summarySectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#30D158',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  sumLabel: {
    fontSize: 12,
  },
  sumVal: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 12,
  },
  sumTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  sumTotalVal: {
    fontSize: 18,
    fontWeight: '900',
    color: '#30D158',
  },
  radarContainer: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  radarCircleWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    position: 'relative',
  },
  radarPulseRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(48, 209, 88, 0.4)',
  },
  radarScanLine: {
    position: 'absolute',
    width: 130,
    height: 2,
    backgroundColor: '#30D158',
  },
  radarCenterHub: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#30D158',
  },
  radarStatusHeading: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 10,
  },
  radarStatusSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 260,
  },
  radarProviderPreviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 12,
    borderRadius: 14,
    width: '100%',
    marginVertical: 12,
  },
  previewProvName: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewProvService: {
    fontSize: 11,
    marginTop: 2,
  },
  radarLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  radarPingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  radarLiveBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  radarTimerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  radarTimerText: {
    fontSize: 12,
  },
  acceptedProviderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    borderWidth: 1,
    borderColor: '#30D158',
    padding: 12,
    borderRadius: 12,
    width: '100%',
    marginTop: 18,
  },
  payMethodsGrid: {
    gap: 12,
  },
  payCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 6,
  },
  payTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  payDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  cardFormBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
  successIconBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  successHeading: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  bookingRefCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
  },
  bookingRefLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
    textAlign: 'center',
  },
  bookingRefNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#30D158',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    letterSpacing: 1,
  },
  trackerStepper: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 14,
    gap: 14,
  },
  trackerStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackerCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerStepLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  prevButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  prevButtonText: {
    fontWeight: '700',
    fontSize: 14,
  },
  nextButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
  },
  nextButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
