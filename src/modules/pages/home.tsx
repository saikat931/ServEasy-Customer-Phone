import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

// Import our custom modular pages from parent/local directory
import { Bookings, BookingItem } from './bookings';
import { Notifications } from './notifications';
import { Profile } from './profile';
import { ServiceLists } from './serviceLists';
import { Payment } from './payment';
import { Wishlist } from './wishlist';
import { Blog } from './blog';
import { Contact } from './contact';
import { VehicleCarBikeWash, PersonalStaffMaids } from './service';
import { ServicesCategoryListing } from '../../components/servicesCategoryListing';
import { reverseGeocodeCoords, acquireDeviceLocation } from '../../services/locationHelper';

// Import shell layouts & modals
import { TopNavbar } from '../../navigation/TopNavbar';
import { BottomNavbar } from '../../navigation/BottomNavbar';
import { Sidebar } from '../../navigation/Sidebar';
import { Splash } from '../../components/Splash';
import { GlassCard } from '../../components/GlassCard';
import { AboutModal } from '../../components/AboutModal';
import { AuthModal } from '../../components/AuthModal';
import { LogoutModal } from '../../components/LogoutModal';
import { ServerConnectionModal } from '../../components/ServerConnectionModal';
import { NotificationBanner } from '../../components/NotificationBanner';
import { ProudMadeInIndiaFooter } from '../../components/ProudMadeInIndiaFooter';
import {
  isCatalogCacheWarm,
  fetchCategoriesFromApi,
  fetchServicesFromApi,
  fetchCustomerBookingsApi,
  invalidateBookingsCache,
  cancelBookingApi,
  editBookingApi,
  EditBookingPayload,
  submitBookingReviewApi,
  pollLiveBookingEventsApi,
  ApiCategory,
  CATEGORY_METADATA
} from '../../services/api';

// Types definitions
interface ServicePackage {
  id: string;
  name: string;
  price: number;
}

interface ServiceItem {
  id: string;
  name: string;
  category: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  badge: string;
  description: string;
  priceLabel: string;
  priceValue: string;
  packages: ServicePackage[];
  tags: string;
  rating: number;
  reviewCount: number;
  mode: 'doorstep' | 'shop' | 'both';
}

// Calculate responsive dimensions
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_SPACING = 20;

// Persistent Customer Session Storage Key & Helpers (Ensures 0ms reload restoration)
export interface CustomerUserSession {
  id?: number;
  name: string;
  identity: string;
  phone?: string;
  email?: string;
  isLoggedIn: boolean;
}

const CUSTOMER_STORAGE_KEY = '@serveasy_customer_user';

export async function getStoredCustomerUser(): Promise<CustomerUserSession> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOMER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.isLoggedIn) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore storage parse error
  }
  return {
    name: 'Guest User',
    identity: '',
    isLoggedIn: false,
  };
}

export async function saveStoredCustomerUser(user: CustomerUserSession): Promise<void> {
  try {
    await AsyncStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    console.log('[Storage] save error:', e);
  }
}

export async function removeStoredCustomerUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CUSTOMER_STORAGE_KEY);
  } catch (e) {
    console.log('[Storage] remove error:', e);
  }
}

export function Home() {
  // Splash Screen Visibility State
  const [showSplash, setShowSplash] = useState(true);

  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Customer session state with storage hydration on initial cold start or reload
  const guestUser: CustomerUserSession = useMemo(() => ({
    name: 'Guest User',
    identity: '',
    isLoggedIn: false,
  }), []);
  const [currentUser, setCurrentUser] = useState<CustomerUserSession>(guestUser);
  const currentUserRef = useRef<CustomerUserSession>(guestUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Restore stored session from AsyncStorage on app launch / cold start
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      try {
        const stored = await getStoredCustomerUser();
        if (isMounted && stored && stored.isLoggedIn) {
          currentUserRef.current = stored;
          setCurrentUser(stored);
          if (stored.name && stored.name !== 'Guest User') {
            setFullName(stored.name);
          }
          if (stored.phone && !stored.phone.includes('@')) {
            setPhoneNumber(stored.phone);
          } else if (stored.identity && !stored.identity.includes('@')) {
            setPhoneNumber(stored.identity);
          }
        }
      } catch (err) {
        console.log('[Home] Session restore error:', err);
      }
    }
    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  // Booking Modal Wizard State
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);

  // Booking form inputs
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:00 AM');
  const [fullName, setFullName] = useState('Guest User');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [serviceAddress, setServiceAddress] = useState('');
  const [isPinningHomeLoc, setIsPinningHomeLoc] = useState(false);

  const handlePinCurrentHomeLocation = async () => {
    setIsPinningHomeLoc(true);
    try {
      const res = await acquireDeviceLocation();
      if (res.address) {
        setServiceAddress(res.address);
        Alert.alert('📍 Location Pinned', `Doorstep address auto-filled:\n\n${res.address}`);
      }
    } catch (e) {
      Alert.alert('Location Notice', 'Could not resolve doorstep address.');
    } finally {
      setIsPinningHomeLoc(false);
    }
  };
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [bookingServiceMode, setBookingServiceMode] = useState<'doorstep' | 'shop'>('doorstep');
  const [bookingPaymentMethod, setBookingPaymentMethod] = useState<'Cash after Service' | 'Instant UPI / QR' | 'Credit / Debit Card' | 'ServEasy Wallet'>('Cash after Service');

  // Success screen state
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [bookingReference, setBookingReference] = useState('');

  // Wishlist state ported from Web
  const [wishlistIds, setWishlistIds] = useState<string[]>(['1', '9']);

  const handleToggleWishlist = useCallback((serviceId: string) => {
    setWishlistIds(prev =>
      prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId]
    );
  }, []);

  // Screen navigation state with persistent cache of mounted screens (0ms instant back/forward)
  type AppScreen = 'home' | 'listing' | 'payment' | 'wishlist' | 'blog' | 'contact' | 'vehicle-car-&-bike-wash' | 'personal-staff-&-maids';
  const [currentScreen, _setCurrentScreen] = useState<AppScreen>('home');
  const [visitedScreens, setVisitedScreens] = useState<Record<string, boolean>>({ home: true });
  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>({ home: true });

  const setCurrentScreen = useCallback((screen: AppScreen) => {
    setVisitedScreens(prev => prev[screen] ? prev : { ...prev, [screen]: true });
    _setCurrentScreen(screen);
  }, []);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'services' | 'bookings' | 'notifications' | 'profile'>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aboutModalVisible, setAboutModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [pendingScreenAfterLogin, setPendingScreenAfterLogin] = useState<string | null>(null);
  const [initialVehicleType, setInitialVehicleType] = useState<string>('Car');
  const [washSessionKey, setWashSessionKey] = useState<number>(0);

  // User Profile state for TopNavbar profile avatar and animated fallbacks
  const [userProfile, setUserProfile] = useState<{
    profileImage: string | null;
    gender: 'male' | 'female' | 'other';
    age: number;
  }>({
    profileImage: null, // Start as null to showcase the animated age & gender-based avatar fallback!
    gender: 'female',   // Can be 'male' | 'female' | 'other'
    age: 24,            // Age to determine icon group
  });

  // Customer Bookings State (loaded dynamically from ServEasy backend)
  const [bookings, setBookings] = useState<BookingItem[]>([]);

  // Mock Notifications Alerts State
  const [notifications, setNotifications] = useState<{
    id: string;
    title: string;
    message: string;
    time: string;
    type: 'success' | 'warning' | 'emergency' | 'info';
  }[]>([
    {
      id: '1',
      title: 'Booking Confirmed',
      message: 'Your request for Room Cleaning & Decor (Ref: SE-849201) is confirmed for June 24.',
      time: '2 hours ago',
      type: 'success',
    },
    {
      id: '2',
      title: 'AC Service Completed',
      message: 'Technician Alex completed your AC Servicing & Gas Refill. Rate your experience!',
      time: '1 day ago',
      type: 'success',
    },
    {
      id: '3',
      title: 'Rapid SOS Dispatch Log',
      message: 'SOS Emergency Alert dispatched to 456 Elite Residency at 08:30 PM. Status: Closed.',
      time: '3 days ago',
      type: 'emergency',
    }
  ]);

  // Skeleton state: Show animated skeleton on first cold load when cache is empty.
  // When cache is warm (e.g. navigating back), isLoading is false for 0ms instant display!
  const [isLoading, setIsLoading] = useState(!isCatalogCacheWarm());
  const [refreshing, setRefreshing] = useState(false);
  const [skeletonPreviewMode, setSkeletonPreviewMode] = useState(false);
  const [simulateLatency, setSimulateLatency] = useState(false);
  const [globalServerErrorVisible, setGlobalServerErrorVisible] = useState(false);

  const [categoriesList, setCategoriesList] = useState<ApiCategory[]>([]);

  // Fast shallow-diff comparator to prevent unnecessary re-renders when data has not changed
  const areBookingsEqual = (a: any[], b: any[]): boolean => {
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const itemA = a[i];
      const itemB = b[i];
      if (
        itemA.id !== itemB.id ||
        itemA.status !== itemB.status ||
        itemA.paymentStatus !== itemB.paymentStatus ||
        itemA.price !== itemB.price
      ) {
        return false;
      }
    }
    return true;
  };

  // Pull-to-refresh handler fetching latest API data with forced bypass of memory cache
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const isUserLoggedIn = !!(currentUser?.isLoggedIn && currentUser?.id);
      const [cats, srvs, userBookings] = await Promise.all([
        fetchCategoriesFromApi(true),
        fetchServicesFromApi({ limit: 50, forceRefresh: true }),
        isUserLoggedIn ? fetchCustomerBookingsApi(currentUser.id, true) : Promise.resolve([])
      ]);
      if (cats && cats.length > 0) setCategoriesList(cats);
      if (srvs && srvs.length > 0) setServicesList(srvs as any);
      if ((!cats || cats.length === 0) && (!srvs || srvs.length === 0)) {
        setGlobalServerErrorVisible(true);
      }
      if (isUserLoggedIn && userBookings) {
        setBookings(prev => areBookingsEqual(prev, userBookings) ? prev : userBookings);
      } else if (!isUserLoggedIn) {
        setBookings([]);
      }
    } catch (e) {
      console.log('[Home] Refresh error:', e);
    } finally {
      setTimeout(() => setRefreshing(false), 300);
    }
  };

  // Fetch live categories and services from the ServEasy backend API on mount (Cache-First)
  React.useEffect(() => {
    let isMounted = true;
    async function loadApiData() {
      const isWarm = isCatalogCacheWarm();
      if (!isWarm) {
        setIsLoading(true);
      }
      try {
        const isUserLoggedIn = !!(currentUser?.isLoggedIn && currentUser?.id);
        const [cats, srvs, userBookings] = await Promise.all([
          fetchCategoriesFromApi(),
          fetchServicesFromApi({ limit: 50 }),
          isUserLoggedIn ? fetchCustomerBookingsApi(currentUser.id) : Promise.resolve([])
        ]);
        if (isMounted) {
          if (cats && cats.length > 0) setCategoriesList(cats);
          if (srvs && srvs.length > 0) setServicesList(srvs as any);
          if (isUserLoggedIn && userBookings) {
            setBookings(prev => areBookingsEqual(prev, userBookings) ? prev : userBookings);
          } else if (!isUserLoggedIn) {
            setBookings([]);
          }
        }
      } catch (err) {
        console.log('[Home] API fetch error:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }
    loadApiData();
    return () => { isMounted = false; };
  }, [currentUser?.id, currentUser?.isLoggedIn]);

  // Live Booking Event Floating Toast State
  const [liveToast, setLiveToast] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'info' | 'warning' | 'alert';
  } | null>(null);

  // Phone Notification Style Floating Banner State
  const [notificationBanner, setNotificationBanner] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type?: 'success' | 'info' | 'warning' | 'alert';
  } | null>(null);

  // Auto-dismiss live toast after 5 seconds
  React.useEffect(() => {
    if (liveToast?.visible) {
      const timer = setTimeout(() => {
        setLiveToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [liveToast]);

  // Real-time live booking & notification event listener (Push-Poller architecture)
  React.useEffect(() => {
    if (!currentUser?.isLoggedIn || !currentUser?.id) {
      return;
    }
    let isCancelled = false;
    let lastSeenEventId: number | undefined = undefined;
    const customerId = currentUser.id;

    // Fast initial sync of latest event pointer (does not trigger stale alerts)
    pollLiveBookingEventsApi(customerId).then(res => {
      if (!isCancelled && res.success) {
        lastSeenEventId = res.lastEventId;
      }
    }).catch(e => console.log('[LiveSSE] Pointer init error:', e));

    // High-responsiveness polling interval (2.5 seconds)
    const liveSyncInterval = setInterval(async () => {
      if (isCancelled) return;
      try {
        const res = await pollLiveBookingEventsApi(customerId, lastSeenEventId);
        if (res.success) {
          if (typeof res.lastEventId === 'number' && res.lastEventId > 0) {
            lastSeenEventId = res.lastEventId;
          }

          if (res.events && res.events.length > 0) {
            // Fresh events arrived! Synchronize bookings state immediately
            const refreshedBookings = await fetchCustomerBookingsApi(customerId);
            if (!isCancelled && refreshedBookings && refreshedBookings.length > 0) {
              setBookings(refreshedBookings);
            }

            // Process each event
            for (const evt of res.events) {
              const p = evt.payload;
              const provName = p.provider_name || 'Service Provider';
              const bNum = p.booking_number || `#${p.booking_id}`;
              const st = (p.status || '').toLowerCase();

              let title = 'Booking Update';
              let message = `Booking ${bNum} status changed to ${st.replace('_', ' ')}.`;
              let notifType: 'info' | 'success' | 'warning' | 'alert' = 'info';

              if (evt.event_name === 'booking.accepted' || st === 'accepted' || st === 'confirmed') {
                title = 'Booking Accepted!';
                message = `${provName} accepted your booking (${bNum})!`;
                notifType = 'success';
              } else if (st === 'in_progress') {
                title = 'Service In Progress';
                message = `${provName} has started working on your booking (${bNum}).`;
                notifType = 'info';
              } else if (st === 'completed') {
                title = 'Service Completed!';
                message = `Your service booking (${bNum}) has been completed.`;
                notifType = 'success';
              } else if (evt.event_name === 'booking.rejected' || st === 'rejected') {
                title = 'Booking Request Rejected';
                message = `Provider ${provName} could not accept booking (${bNum}).`;
                notifType = 'alert';
              } else if (evt.event_name === 'booking.cancelled' || st === 'cancelled') {
                title = 'Booking Cancelled';
                message = `Booking (${bNum}) was cancelled.`;
                notifType = 'warning';
              }

              // Show live toast banner
              setLiveToast({
                visible: true,
                title,
                message,
                type: notifType,
              });

              // Prepend to notifications state
              setNotifications(prev => [
                {
                  id: String(Date.now() + Math.random()),
                  title,
                  message,
                  time: 'Just now',
                  type: notifType === 'alert' ? ('emergency' as const) : (notifType as any),
                },
                ...prev,
              ]);
            }
          }
        }
      } catch (err) {
        // Silently tolerate temporary network hiccups
      }
    }, 3000);

    // Background heartbeat sync with intelligent diff-check to prevent unnecessary re-renders
    const fallbackSyncInterval = setInterval(async () => {
      if (isCancelled) return;
      try {
        const freshList = await fetchCustomerBookingsApi(customerId);
        if (!isCancelled && freshList && freshList.length > 0) {
          setBookings(prev => {
            if (prev.length !== freshList.length) return freshList;
            const hasChange = freshList.some((item, i) => {
              const p = prev[i];
              return !p || p.id !== item.id || p.status !== item.status || p.paymentStatus !== item.paymentStatus;
            });
            return hasChange ? freshList : prev;
          });
        }
      } catch (e) {
        // Silent
      }
    }, 25000);

    return () => {
      isCancelled = true;
      clearInterval(liveSyncInterval);
      clearInterval(fallbackSyncInterval);
    };
  }, [currentUser?.id, currentUser?.isLoggedIn]);

  const handleTabSelect = useCallback((tab: 'home' | 'services' | 'bookings' | 'notifications' | 'profile') => {
    setVisitedTabs(prev => prev[tab] ? prev : { ...prev, [tab]: true });
    if (tab === 'bookings' && currentUser?.isLoggedIn && currentUser?.id) {
      fetchCustomerBookingsApi(currentUser.id).then(res => {
        if (res && res.length > 0) {
          setBookings(prev => areBookingsEqual(prev, res) ? prev : res);
        }
      }).catch(e => console.log('[Home] Bookings fetch on tab switch error:', e));
    }
    setActiveTab(tab);
    setCurrentScreen('home');
  }, [currentUser?.id, currentUser?.isLoggedIn, setCurrentScreen]);

  const homeScrollRef = useRef<any>(null);

  const handleLogoPress = useCallback(() => {
    handleTabSelect('home');
    setCurrentScreen('home');
    setSidebarOpen(false);
    setTimeout(() => {
      homeScrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 50);
  }, [handleTabSelect]);

  const handleLogout = useCallback(() => {
    const guestUser: CustomerUserSession = {
      name: 'Guest User',
      identity: '',
      phone: '',
      email: '',
      isLoggedIn: false,
    };
    currentUserRef.current = guestUser;
    removeStoredCustomerUser();
    setCurrentUser(guestUser);
    setFullName('Guest User');
    setPhoneNumber('');
    setServiceAddress('');
    setBookings([]);
    invalidateBookingsCache();
    setSidebarOpen(false);
    handleTabSelect('home');
    setNotificationBanner({
      visible: true,
      title: 'Logged Out',
      message: 'You have been logged out successfully.',
      type: 'info',
    });
  }, [handleTabSelect]);

  const [listingInitialQuery, setListingInitialQuery] = useState('');

  const handleNavigateToListing = useCallback((categoryKey: string, initialQuery?: string) => {
    setSelectedCategoryKey(categoryKey);
    setListingInitialQuery(initialQuery || '');
    setCurrentScreen('listing');
  }, [setCurrentScreen]);

  // Initial services list with fallback data
  const [servicesList, setServicesList] = useState<ServiceItem[]>([
    {
      id: '2',
      name: 'Car Wash',
      category: 'automotive',
      icon: 'car-wash',
      badge: 'Car Wash',
      description: 'Professional exterior foam wash, underbody rinse, and glass cleaning at shop or doorstep.',
      priceLabel: 'Starts from',
      priceValue: '$25/serv',
      packages: [
        { id: 'v1', name: 'Express Foam Wash', price: 25 },
        { id: 'v2', name: 'Deep Interior Sanitization', price: 45 },
        { id: 'v3', name: 'Ultimate Ceramic Shine & Polish', price: 65 }
      ],
      tags: 'car wash foam detailing cleaning doorstep shop vehicle',
      rating: 4.8,
      reviewCount: 156,
      mode: 'both'
    },
    {
      id: '19',
      name: 'Bike Wash',
      category: 'automotive',
      icon: 'motorbike',
      badge: 'Bike Wash',
      description: 'Complete motorcycle & scooter high-pressure jet wash, chain lube, and chrome polish.',
      priceLabel: 'Starts from',
      priceValue: '$20/serv',
      packages: [
        { id: 'bw1', name: 'Bike Wash', price: 20 }
      ],
      tags: 'bike wash motorcycle scooter high pressure chain lube vehicle',
      rating: 4.7,
      reviewCount: 78,
      mode: 'both'
    },
    {
      id: '17',
      name: 'Vehicle Repair',
      category: 'automotive',
      icon: 'car-wrench',
      badge: 'Vehicle Repair',
      description: 'Mechanical fixes, brake pad replacement, battery installation, and engine troubleshooting.',
      priceLabel: 'Starts from',
      priceValue: '$45/job',
      packages: [
        { id: 'vr1', name: 'Brake Pad Inspection & Replacement', price: 45 },
        { id: 'vr2', name: 'Complete Engine Computer Diagnostic', price: 60 }
      ],
      tags: 'vehicle repair mechanic engine brake battery diagnostics',
      rating: 4.9,
      reviewCount: 114,
      mode: 'both'
    },
    {
      id: '20',
      name: 'Vehicle Servicing',
      category: 'automotive',
      icon: 'car-cog',
      badge: 'Vehicle Servicing',
      description: 'Comprehensive multi-point vehicle inspection, fluid top-up, filter change, and routine maintenance.',
      priceLabel: 'Starts from',
      priceValue: '$40/job',
      packages: [
        { id: 'vs1', name: 'Standard General Servicing', price: 40 },
        { id: 'vs2', name: 'Comprehensive Major Service', price: 75 }
      ],
      tags: 'vehicle servicing inspection maintenance oil change tuning',
      rating: 4.8,
      reviewCount: 89,
      mode: 'both'
    },
    {
      id: '21',
      name: 'Vehicle Parts',
      category: 'automotive',
      icon: 'cog-outline',
      badge: 'Vehicle Parts',
      description: 'Genuine OEM vehicle spare parts replacement, accessories fitting, and tyre changes.',
      priceLabel: 'Starts from',
      priceValue: '$35/part',
      packages: [
        { id: 'vp1', name: 'Minor Parts Fitting', price: 35 },
        { id: 'vp2', name: 'Major Component Replacement', price: 85 }
      ],
      tags: 'vehicle parts oem spares tyres battery fitting accessories',
      rating: 4.6,
      reviewCount: 62,
      mode: 'both'
    },
    {
      id: '22',
      name: 'Garage Service',
      category: 'automotive',
      icon: 'garage',
      badge: 'Garage Service',
      description: 'Full in-shop garage overhaul, suspension alignment, denting, and professional spray painting.',
      priceLabel: 'Starts from',
      priceValue: '$50/job',
      packages: [
        { id: 'gs1', name: 'Garage Mechanical Inspection', price: 50 },
        { id: 'gs2', name: 'Full Workshop Overhaul & Denting', price: 120 }
      ],
      tags: 'garage service workshop bodywork denting overhaul paint',
      rating: 4.9,
      reviewCount: 95,
      mode: 'shop'
    },
    {
      id: '6',
      name: 'Room Cleaning & Decor',
      category: 'home',
      icon: 'broom',
      badge: 'Premium Home',
      description: 'Deep cleaning, seasonal decoration, and thorough bathroom sanitization handled by certified hygiene experts.',
      priceLabel: 'Starts from',
      priceValue: '$40/room',
      packages: [
        { id: 'rc1', name: 'Full Room Deep Cleaning', price: 40 },
        { id: 'rc2', name: 'Festival & Event Room Decorate', price: 75 },
        { id: 'rc3', name: 'Bathroom Sanitizing & Clean', price: 25 }
      ],
      tags: 'room cleaner decorate bathroom sanitation cleaner deep wash home living',
      rating: 4.6,
      reviewCount: 92,
      mode: 'doorstep'
    },
    {
      id: '27',
      name: 'Bus Ticket Booking',
      category: 'transport',
      icon: 'bus',
      badge: 'Public Transit',
      description: 'Book seats or sleeper berths for intercity transit, express lines, or premium luxury coaches on demand.',
      priceLabel: 'Berth from',
      priceValue: '$15/seat',
      packages: [
        { id: 'b1', name: 'AC Sleeper Coach Berth', price: 25 },
        { id: 'b2', name: 'Premium Seater Express', price: 15 },
        { id: 'b3', name: 'Non-AC Economy Transit', price: 10 }
      ],
      tags: 'bus travel transit ticket booking sleeper seater express intercity',
      rating: 4.2,
      reviewCount: 310,
      mode: 'shop'
    },
    {
      id: '9',
      name: 'Personal Staff & Maids',
      category: 'care',
      icon: 'account-group-outline',
      badge: 'Verified Staff',
      description: 'Hire security watchmen, local guides, baby sitters, elderly care assistants, home chefs, or male/female maids.',
      priceLabel: 'Rate from',
      priceValue: '$12/hr',
      packages: [
        { id: 'p1', name: 'Male House Maid', price: 12 },
        { id: 'p2', name: 'Female House Maid', price: 12 },
        { id: 'p3', name: 'Home Cook / Chef', price: 15 },
        { id: 'p4', name: 'Baby Handling & Care', price: 14 },
        { id: 'p5', name: 'Elderly Care Assistant', price: 14 },
        { id: 'p6', name: 'Security Watchman Guard', price: 16 },
        { id: 'p7', name: 'Local Tourist Guide', price: 18 }
      ],
      tags: 'watchman guidance baby handling old man caregiving cook chef maid female male helper assistance',
      rating: 4.9,
      reviewCount: 84,
      mode: 'doorstep'
    },
    {
      id: '12',
      name: 'Emergency SOS Help',
      category: 'emergency',
      icon: 'alert-decagram-outline',
      badge: 'Active 24/7',
      description: 'Immediate assistance for vehicle towing, medical dispatch, home security alarms, and locksmith emergencies.',
      priceLabel: 'Dispatch fee',
      priceValue: '$0/free',
      packages: [
        { id: 'e1', name: 'Rapid Vehicle Towing', price: 0 },
        { id: 'e2', name: 'Home Security Dispatch', price: 0 },
        { id: 'e3', name: 'Medical Emergency Call', price: 0 },
        { id: 'e4', name: 'Urgent Locksmith', price: 0 }
      ],
      tags: 'emergency help security medical towing first aid alert sos rapid assistance',
      rating: 5.0,
      reviewCount: 18,
      mode: 'doorstep'
    },
    {
      id: '14',
      name: 'Electronics & AC Services',
      category: 'home',
      icon: 'air-conditioner',
      badge: 'Technicians',
      description: 'Expert technicians for repair, diagnostics, and setup of all household appliances including ACs, fridges, and washers.',
      priceLabel: 'Service from',
      priceValue: '$30/device',
      packages: [
        { id: 'el1', name: 'AC Servicing & Gas Refill', price: 45 },
        { id: 'el2', name: 'Refrigerator Diagnostic & Fix', price: 35 },
        { id: 'el3', name: 'Washing Machine Repair', price: 30 },
        { id: 'el4', name: 'Smart Home & TV Setup', price: 40 }
      ],
      tags: 'electronics gadget air conditioner ac fridge refrigerator washing machine kitchen appliance repairs',
      rating: 4.7,
      reviewCount: 112,
      mode: 'doorstep'
    },
    {
      id: '16',
      name: 'Laundry & Dry Clean',
      category: 'home',
      icon: 'washing-machine',
      badge: 'Express Care',
      description: 'Premium clothes washing, dry cleaning, and crisp steam ironing with quick next-day delivery options.',
      priceLabel: 'Rates from',
      priceValue: '$3/kg',
      packages: [
        { id: 'l1', name: 'Regular Wash & Fold', price: 3 },
        { id: 'l2', name: 'Premium Dry Cleaning', price: 8 },
        { id: 'l3', name: 'Steam Ironing & Hang', price: 2 },
        { id: 'l4', name: 'Blanket & Curtain Deep Cleaning', price: 12 }
      ],
      tags: 'laundry cloths washing dry clean steam iron fold laundry sheets blankets cleaning',
      rating: 4.5,
      reviewCount: 68,
      mode: 'doorstep'
    },
    {
      id: '17',
      name: 'Home Painters',
      category: 'home',
      icon: 'format-paint',
      badge: 'Certified Brush',
      description: 'Full interior wall coating, exterior weatherproofing, and textured wall art designed by certified decorators.',
      priceLabel: 'Cover from',
      priceValue: '$2/sqft',
      packages: [
        { id: 'hp1', name: 'Interior Wall Painting', price: 2 },
        { id: 'hp2', name: 'Exterior Weatherproof Coat', price: 3 },
        { id: 'hp3', name: 'Textured Wall Art / Finish', price: 5 }
      ],
      tags: 'painter paint brush color interior exterior weather wall coat decor spray',
      rating: 4.8,
      reviewCount: 46,
      mode: 'doorstep'
    },
    {
      id: '18',
      name: 'Pest Control Specialist',
      category: 'home',
      icon: 'bug-outline',
      badge: 'Eco Friendly',
      description: 'Complete termination of termites, bedbugs, cockroaches, and garden insects using pet-safe green chemicals.',
      priceLabel: 'Service from',
      priceValue: '$55/serv',
      packages: [
        { id: 'pc1', name: 'Termite Deep Protection', price: 90 },
        { id: 'pc2', name: 'Roach & Bedbug Elimination', price: 55 },
        { id: 'pc3', name: 'Garden Sprinkling Insecticide', price: 70 }
      ],
      tags: 'bug termite pest cockroach garden spray chemical green safe pet control exterminator',
      rating: 4.4,
      reviewCount: 38,
      mode: 'doorstep'
    },
    {
      id: '19',
      name: 'Cargo Mini-Trucks',
      category: 'transport',
      icon: 'truck-delivery-outline',
      badge: 'Instant Hire',
      description: 'Instant booking of cargo loader trucks, trailers, and pickup vehicles for house relocation or heavy cargo transport.',
      priceLabel: 'Freight from',
      priceValue: '$18/trip',
      packages: [
        { id: 'tr1', name: 'Relocation Loader Truck', price: 45 },
        { id: 'tr2', name: 'Cargo Mini Pickup Truck', price: 25 },
        { id: 'tr3', name: 'Heavy Flatbed Trailer Trip', price: 110 }
      ],
      tags: 'cargo truck loader transport delivery cargo shift box package flatbed trailer relocator shifting',
      rating: 4.7,
      reviewCount: 220,
      mode: 'both'
    },
    {
      id: '20',
      name: 'Car Rental & SUVs',
      category: 'transport',
      icon: 'car-multiple',
      badge: 'With Driver',
      description: 'Rent premium luxury sedans, family SUVs, or offroad vehicles with high-rated drivers for city trips or long tours.',
      priceLabel: 'Rate from',
      priceValue: '$60/day',
      packages: [
        { id: 'cr1', name: 'Premium Sedan (Daily)', price: 60 },
        { id: 'cr2', name: 'Family SUV Hatchback (Daily)', price: 90 },
        { id: 'cr3', name: 'Offroad Jeep 4x4 (Daily)', price: 120 }
      ],
      tags: 'car rent vehicle luxury driver sedan suv travel tour roadtrip tourer',
      rating: 4.6,
      reviewCount: 180,
      mode: 'both'
    },
    {
      id: '21',
      name: 'Local Tours & Guides',
      category: 'food',
      icon: 'map-legend',
      badge: 'Tour Guides',
      description: 'Match with certified local tour guides to discover historical heritage monuments, local bazaars, and street food hubs.',
      priceLabel: 'Hourly from',
      priceValue: '$10/hr',
      packages: [
        { id: 'tg1', name: 'Heritage Site Private Tour', price: 25 },
        { id: 'tg2', name: 'Bazaar Walking & Shopping', price: 15 },
        { id: 'tg3', name: 'Street Food & Culinary Walk', price: 20 }
      ],
      tags: 'guide map tour sightseeing locator local historical monument street food walk walking',
      rating: 4.9,
      reviewCount: 95,
      mode: 'both'
    },
    {
      id: '22',
      name: 'Hostels & PG Search',
      category: 'stay',
      icon: 'home-city-outline',
      badge: 'Verify Stay',
      description: 'Search verified paying guest (PG) accommodations, student hostels, and co-living studio spaces with active security.',
      priceLabel: 'Starts at',
      priceValue: '$120/mo',
      packages: [
        { id: 'st1', name: 'Paying Guest Sharing (PG)', price: 120 },
        { id: 'st2', name: 'Student Dormitory Hostel Room', price: 150 },
        { id: 'st3', name: 'Studio Co-Living Serviced Flat', price: 280 }
      ],
      tags: 'hostel pg staying paying guest roommate studio co living student lodging room rent',
      rating: 4.3,
      reviewCount: 76,
      mode: 'shop'
    },
    {
      id: '26',
      name: 'Restaurant Orders & Dining',
      category: 'food',
      icon: 'silverware-fork-knife',
      badge: 'Dine & Order',
      description: 'Pre-book dining slots at premium partner restaurants or pre-order gourmet meals for express pickup.',
      priceLabel: 'Table from',
      priceValue: '$5/seat',
      packages: [
        { id: 'ro1', name: 'Table Booking for Couple (2)', price: 10 },
        { id: 'ro2', name: 'Family Dining Table (4-6)', price: 20 },
        { id: 'ro3', name: 'Meal Pre-Order & Self-Pickup', price: 5 },
        { id: 'ro4', name: 'Event Dining Hall Rental', price: 100 }
      ],
      tags: 'food order restaurant dine pre book table slot dining meal eating delivery',
      rating: 4.5,
      reviewCount: 320,
      mode: 'shop'
    },
    {
      id: '24',
      name: 'Shared Accommodation',
      category: 'stay',
      icon: 'source-fork',
      badge: 'Roommate Finder',
      description: 'Find budget shared rooms and match with roommates based on habits, budgets, and mutual preferences.',
      priceLabel: 'Starts at',
      priceValue: '$80/mo',
      packages: [
        { id: 'sa1', name: 'Co-living Double Occupancy', price: 80 },
        { id: 'sa2', name: 'Shared Studio Flat Share', price: 150 },
        { id: 'sa3', name: 'Roommate Profile Assessment Match', price: 20 }
      ],
      tags: 'share room roommate matching co living flatmate share apartment shared rent lodging',
      rating: 4.2,
      reviewCount: 54,
      mode: 'shop'
    },
    {
      id: '25',
      name: 'Restroom & Locker Search',
      category: 'food',
      icon: 'map-marker-radius-outline',
      badge: 'Locator',
      description: 'Find verified clean public restrooms, freshen-up showers, and secure luggage storage lockers in the city.',
      priceLabel: 'Access from',
      priceValue: '$1/use',
      packages: [
        { id: 'rl1', name: 'Clean Restroom & Wash Access', price: 1 },
        { id: 'rl2', name: 'Restroom & Shower Cabin Combo', price: 5 },
        { id: 'rl3', name: 'Small Bag Locker (Hourly)', price: 2 },
        { id: 'rl4', name: 'Large Luggage Locker (Daily)', price: 10 }
      ],
      tags: 'rest room search restroom toilet public washroom shower locker luggage locator searcher',
      rating: 4.0,
      reviewCount: 45,
      mode: 'shop'
    }
  ]);

  // Theme Constants mapping
  const activeTheme = {
    gradientColors: theme === 'dark' ? ['#08090C', '#121417'] as const : ['#E6F2FF', '#FFFFFF'] as const,
    circleGradient1: theme === 'dark' ? ['rgba(0, 132, 255, 0.22)', 'rgba(138, 43, 226, 0.05)'] as const : ['#9AD0FF', '#EBF5FF'] as const,
    circleGradient2: theme === 'dark' ? ['rgba(213, 0, 249, 0.18)', 'rgba(0, 0, 0, 0)'] as const : ['#BFE3FF', '#FFFFFF'] as const,
    cardBorder: theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 132, 255, 0.15)',
    textPrimary: theme === 'dark' ? '#FFFFFF' : '#1E293B',
    textSecondary: theme === 'dark' ? '#A0A5AD' : '#64748B',
    inputBg: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 132, 255, 0.04)',
    inputBorder: theme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 132, 255, 0.2)',
    iconColor: theme === 'dark' ? '#FFFFFF' : '#0084FF',
    accentBtnBg: '#0084FF',
    accentBtnText: '#FFFFFF',
    modalOverlayBg: 'rgba(0, 0, 0, 0.65)',
    modalBg: theme === 'dark' ? '#14161B' : '#FFFFFF',
    pillActiveBg: '#0084FF',
    pillActiveText: '#FFFFFF',
    pillInactiveBg: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 132, 255, 0.06)',
    pillInactiveText: theme === 'dark' ? '#A0A5AD' : '#64748B',
    glassIntensity: theme === 'dark' ? 25 : 30,
  };

  // Set default values for booking
  const handleOpenBooking = (service: ServiceItem) => {
    const activeUser = currentUserRef.current || currentUser;
    const isLogged = !!activeUser?.isLoggedIn;

    const sName = (service.name || '').toLowerCase();
    const sCat = (service.category || '').toLowerCase();
    const sSlug = ((service as any).slug || '').toLowerCase();
    const sTags = (service.tags || '').toLowerCase();
    const sSub = ((service as any).subcategory_slug || '').toLowerCase();
    const combined = `${sName} ${sSlug} ${sTags} ${sSub}`;

    if (combined.includes('wash') || sSlug === 'vehicle-car-and-bike-wash' || sSlug === 'vehicle-car-&-bike-wash') {
      const isBike = combined.includes('bike') || combined.includes('motorcycle');
      const isScooter = combined.includes('scooter') || combined.includes('scooty') || combined.includes('moped');
      const isSuv = combined.includes('suv') || combined.includes('muv');
      const isLuxury = combined.includes('luxury') || combined.includes('sports');
      const chosenType = isBike ? 'Bike' : isScooter ? 'Scooter' : isSuv ? 'SUV' : isLuxury ? 'Luxury' : 'Car';
      setInitialVehicleType(chosenType);
      setWashSessionKey(k => k + 1);

      if (!isLogged) {
        setPendingScreenAfterLogin('vehicle-car-&-bike-wash');
        setAuthModalVisible(true);
        return;
      }
      setCurrentScreen('vehicle-car-&-bike-wash');
      return;
    }

    if (sCat.includes('care') || sName.includes('maid') || sName.includes('staff') || sName.includes('cook') || sName.includes('sitter')) {
      setCurrentScreen('personal-staff-&-maids');
      return;
    }

    setSelectedService(service);
    setSelectedPackage(service.packages[0] || null);

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    setBookingDate(dateStr);

    setBookingTime('10:00 AM');
    if (isLogged) {
      setFullName(activeUser.name && activeUser.name !== 'Guest User' ? activeUser.name : 'Verified Customer');
      const validPhone = (activeUser.phone && !activeUser.phone.includes('@'))
        ? activeUser.phone
        : (!activeUser.identity?.includes('@') ? activeUser.identity : '');
      setPhoneNumber(validPhone);
    } else {
      setFullName('Guest User');
      setPhoneNumber('');
    }
    setServiceAddress(bookingServiceMode === 'shop' ? 'Partner Verified Workshop' : '123 Premium Heights, Block C');
    setAdditionalNotes('');
    setBookingServiceMode(service.mode === 'shop' ? 'shop' : 'doorstep');
    setBookingPaymentMethod('Cash after Service');
    setIsSuccessState(false);
    setBookingModalVisible(true);
  };

  // Form submission handler
  const handleConfirmBooking = () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter your Full Name.');
      return;
    }
    const cleanPhone = phoneNumber.replace(/[\s\-+()]/g, '');
    const isEmail = phoneNumber.includes('@');
    const isValidPhone = !isEmail && /^\d{10,12}$/.test(cleanPhone);
    if (!phoneNumber.trim() || isEmail || !isValidPhone) {
      Alert.alert('Valid Mobile Number Required', 'Please enter a valid 10-digit mobile number before confirming your booking.');
      return;
    }
    const finalAddress = bookingServiceMode === 'shop'
      ? (serviceAddress.trim() || 'Partner Center Workshop')
      : serviceAddress.trim();

    if (bookingServiceMode === 'doorstep' && !finalAddress) {
      Alert.alert('Required Field', 'Please enter your Doorstep Delivery Address.');
      return;
    }
    if (!bookingDate.trim()) {
      Alert.alert('Required Field', 'Please select a Date.');
      return;
    }

    // Generate random booking reference
    const randRef = 'SE-' + Math.floor(100000 + Math.random() * 900000);
    setBookingReference(randRef);
    setIsSuccessState(true);

    // Add new booking to state list with mode and payment method
    const newBooking = {
      id: String(Date.now()),
      reference: randRef,
      serviceName: selectedService?.name || 'Custom Service',
      packageName: selectedPackage?.name || 'Standard Package',
      price: selectedPackage?.price || 0,
      date: bookingDate,
      time: bookingTime,
      address: finalAddress,
      mode: bookingServiceMode,
      paymentMethod: bookingPaymentMethod,
      status: selectedService?.category === 'emergency' ? 'pending' : 'confirmed',
    };
    setBookings(prev => [newBooking, ...prev]);

    // Add new notification alert
    const newNotification = {
      id: String(Date.now() + 1),
      title: selectedService?.category === 'emergency' ? 'SOS Alert Dispatched' : 'New Booking Placed',
      message: selectedService?.category === 'emergency'
        ? `SOS Emergency request (Ref: ${randRef}) dispatch initiated to ${serviceAddress}.`
        : `Successfully booked ${selectedService?.name} (Ref: ${randRef}) for ${bookingDate}.`,
      time: 'Just now',
      type: selectedService?.category === 'emergency' ? 'emergency' as const : 'success' as const,
    };
    setNotifications(prev => [newNotification, ...prev]);
  };

  // Cancel booking handler
  const handleCancelBooking = async (bookingId: string, serviceName: string, reference: string, reason?: string) => {
    try {
      if (currentUser?.isLoggedIn && currentUser?.id) {
        const numId = parseInt(bookingId, 10);
        if (!isNaN(numId)) {
          await cancelBookingApi(numId, currentUser.id, reason || 'Cancelled by customer');
        }
      }
    } catch (e) {
      console.log('[Home] Error cancelling booking via API:', e);
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
    );
    // Add cancel notification
    setNotifications((prev) => [
      {
        id: String(Date.now()),
        title: 'Booking Cancelled',
        message: `Your booking for ${serviceName} (Ref: #${reference}) has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
        time: 'Just now',
        type: 'warning' as const,
      },
      ...prev
    ]);
  };

  const handleEditBooking = async (
    bookingId: string,
    data: EditBookingPayload
  ): Promise<{ success: boolean; requiresApproval: boolean; message: string }> => {
    try {
      if (!currentUser?.isLoggedIn || !currentUser?.id) {
        return { success: false, requiresApproval: false, message: 'Please sign in to edit booking' };
      }
      const numId = parseInt(bookingId, 10);
      if (isNaN(numId)) {
        return { success: false, requiresApproval: false, message: 'Invalid booking reference' };
      }

      const res = await editBookingApi(numId, data, currentUser.id);
      if (res.success) {
        setBookings((prev) =>
          prev.map((b) => {
            if (b.id === bookingId) {
              return {
                ...b,
                date: data.schedule_date || b.date,
                time: data.schedule_time || b.time,
                address: data.address || b.address,
                notes: data.notes !== undefined ? data.notes : b.notes,
                vehicleBrand: data.vehicle_brand !== undefined ? data.vehicle_brand : b.vehicleBrand,
                vehicleModel: data.vehicle_model !== undefined ? data.vehicle_model : b.vehicleModel,
                vehicleRegNo: data.vehicle_reg_no !== undefined ? data.vehicle_reg_no : b.vehicleRegNo,
                vehicleType: data.vehicle_type !== undefined ? data.vehicle_type : b.vehicleType,
                status: res.requiresApproval ? 'pending' : b.status,
              };
            }
            return b;
          })
        );

        if (res.requiresApproval) {
          setNotifications((prev) => [
            {
              id: String(Date.now()),
              title: 'Reschedule Request Sent',
              message: `Your booking reschedule request has been sent to your provider for live approval.`,
              time: 'Just now',
              type: 'info' as const,
            },
            ...prev
          ]);
        }
      }
      return res;
    } catch (e: any) {
      return { success: false, requiresApproval: false, message: e?.message || 'Failed to edit booking' };
    }
  };

  // Submit verified review handler
  const handleAddReview = async (bookingId: string, rating: number, comment: string) => {
    try {
      if (currentUser?.isLoggedIn && currentUser?.id) {
        const numId = parseInt(bookingId, 10);
        if (!isNaN(numId)) {
          await submitBookingReviewApi(numId, rating, comment, currentUser.id);
        }
      }
    } catch (e) {
      console.log('[Home] Error submitting review via API:', e);
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === bookingId ? { ...b, rating, reviewComment: comment } : b))
    );
  };

  // Render Splash Screen First
  if (showSplash) {
    return <Splash onAnimationEnd={() => setShowSplash(false)} />;
  }

  return (
    <View style={styles.appContainer}>
      {/* Fullscreen Gradient Background */}
      <LinearGradient
        colors={activeTheme.gradientColors}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Ambient Glass Blur Circles */}
      <View style={styles.ambientCirclesContainer}>
        <LinearGradient
          colors={activeTheme.circleGradient1}
          style={[styles.ambientCircle, styles.circleLeft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <LinearGradient
          colors={activeTheme.circleGradient2}
          style={[styles.ambientCircle, styles.circleRight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </View>

      <SafeAreaView style={[styles.safeArea, currentScreen !== 'home' && currentScreen !== 'listing' && currentScreen !== 'wishlist' && { display: 'none' }]} edges={['top', 'left', 'right']}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} {...({ translucent: true } as any)} backgroundColor="transparent" />

        {/* TOP BAR / MOBILE HEADER (Visible on Home, Category Listing, and Wishlist) */}
        {(currentScreen === 'home' || currentScreen === 'listing' || currentScreen === 'wishlist') && (
          <TopNavbar
            theme={theme}
            onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            onMenuPress={() => setSidebarOpen(true)}
            activeTheme={activeTheme}
            userProfile={userProfile}
            wishlistCount={wishlistIds.length}
            onWishlistPress={() => setCurrentScreen('wishlist')}
            onLogoPress={handleLogoPress}
            onProfilePress={() => handleTabSelect('profile')}
          />
        )}

        {/* Real-Time Live Booking Event Floating Toast */}
        {liveToast?.visible && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              setLiveToast(null);
              handleTabSelect('bookings');
            }}
            style={[
              styles.liveToastContainer,
              {
                backgroundColor: activeTheme.modalBg,
                borderColor: liveToast.type === 'success' ? '#30D158' : liveToast.type === 'alert' ? '#FF3B30' : '#0084FF',
              }
            ]}
          >
            <View style={[styles.liveToastIconWrapper, { backgroundColor: liveToast.type === 'success' ? 'rgba(48, 209, 88, 0.2)' : liveToast.type === 'alert' ? 'rgba(255, 59, 48, 0.2)' : 'rgba(0, 132, 255, 0.2)' }]}>
              <MaterialCommunityIcons
                name={liveToast.type === 'success' ? 'check-circle' : liveToast.type === 'alert' ? 'alert-circle' : 'bell-ring'}
                size={22}
                color={liveToast.type === 'success' ? '#30D158' : liveToast.type === 'alert' ? '#FF3B30' : '#0084FF'}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.liveToastTitle, { color: activeTheme.textPrimary }]}>{liveToast.title}</Text>
                <View style={styles.livePillBadge}>
                  <View style={styles.livePillDot} />
                  <Text style={styles.livePillText}>LIVE</Text>
                </View>
              </View>
              <Text style={[styles.liveToastMessage, { color: activeTheme.textSecondary }]} numberOfLines={2}>
                {liveToast.message}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* PERSISTENT MAIN TABS CONTAINER (Kept alive in memory for instant 0ms switching) */}
        <View style={{ flex: 1, display: (currentScreen === 'home') ? 'flex' : 'none' }}>
          <View style={{ flex: 1, display: activeTab === 'home' ? 'flex' : 'none' }}>
            <HomeFeed
              scrollRef={homeScrollRef}
              onLogoPress={handleLogoPress}
              theme={theme}
              activeTheme={activeTheme}
              servicesList={servicesList}
              categoriesList={categoriesList}
              currentUser={currentUser}
              onOpenBooking={handleOpenBooking}
              onNavigateToListing={handleNavigateToListing}
              isLoading={isLoading || skeletonPreviewMode}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
              onNavigateToBlog={() => setCurrentScreen('blog')}
              onNavigateToContact={() => setCurrentScreen('contact')}
              onOpenAbout={() => setAboutModalVisible(true)}
              onNavigateToWishlist={() => setCurrentScreen('wishlist')}
              onNavigateToVehicleWash={(vehicleType?: string) => {
                const chosenType = vehicleType || 'Car';
                setInitialVehicleType(chosenType);
                setWashSessionKey(k => k + 1);
                const activeUser = currentUserRef.current || currentUser;
                if (!activeUser?.isLoggedIn) {
                  setPendingScreenAfterLogin('vehicle-car-&-bike-wash');
                  setAuthModalVisible(true);
                  return;
                }
                setCurrentScreen('vehicle-car-&-bike-wash');
              }}
              onNavigateToMaids={() => setCurrentScreen('personal-staff-&-maids')}
              onNavigateTab={handleTabSelect}
            />
          </View>
          {/* SERVICES TAB: Lazy-mounted on first manual open with skeleton effect, then kept warm in memory */}
          {visitedTabs['services'] && (
            <View style={{ flex: 1, display: activeTab === 'services' ? 'flex' : 'none' }}>
              <ServiceLists
                theme={theme}
                activeTheme={activeTheme}
                currentUser={currentUser}
                servicesList={servicesList}
                onOpenBooking={handleOpenBooking}
                isLoading={isLoading || skeletonPreviewMode}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                wishlistIds={wishlistIds}
                onToggleWishlist={handleToggleWishlist}
              />
            </View>
          )}

          {/* BOOKINGS TAB: Lazy-mounted on first manual open with skeleton effect, then kept warm in memory */}
          {visitedTabs['bookings'] && (
            <View style={{ flex: 1, display: activeTab === 'bookings' ? 'flex' : 'none' }}>
              <Bookings
                theme={theme}
                activeTheme={activeTheme}
                bookings={currentUser?.isLoggedIn ? bookings : []}
                servicesList={servicesList}
                onCancelBooking={handleCancelBooking}
                onEditBooking={handleEditBooking}
                onOpenBooking={handleOpenBooking}
                onAddReview={handleAddReview}
                isLoading={isLoading || skeletonPreviewMode}
                refreshing={refreshing}
                onRefresh={handleRefresh}
                isLoggedIn={currentUser?.isLoggedIn ?? false}
                onOpenAuth={() => setAuthModalVisible(true)}
                customerId={currentUser?.id ? Number(currentUser.id) : undefined}
              />
            </View>
          )}

          {/* NOTIFICATIONS TAB: Lazy-mounted on first manual open with skeleton effect, then kept warm in memory */}
          {visitedTabs['notifications'] && (
            <View style={{ flex: 1, display: activeTab === 'notifications' ? 'flex' : 'none' }}>
              <Notifications
                theme={theme}
                activeTheme={activeTheme}
                userId={currentUser?.isLoggedIn ? currentUser.id : undefined}
                isLoggedIn={currentUser?.isLoggedIn ?? false}
                onOpenAuth={() => setAuthModalVisible(true)}
                onNavigateTab={handleTabSelect}
                notifications={notifications}
                isLoading={isLoading || skeletonPreviewMode}
                refreshing={refreshing}
                onRefresh={handleRefresh}
              />
            </View>
          )}

          {/* PROFILE TAB: Lazy-mounted on first manual open, then kept warm in memory */}
          {visitedTabs['profile'] && (
            <View style={{ flex: 1, display: activeTab === 'profile' ? 'flex' : 'none' }}>
              <Profile
                theme={theme}
                activeTheme={activeTheme}
                userId={currentUser?.isLoggedIn ? currentUser.id : undefined}
                isLoggedIn={currentUser?.isLoggedIn ?? false}
                onOpenAuth={() => setAuthModalVisible(true)}
                fullName={currentUser?.isLoggedIn ? fullName : 'Guest User'}
                phoneNumber={currentUser?.isLoggedIn ? phoneNumber : ''}
                serviceAddress={currentUser?.isLoggedIn ? serviceAddress : ''}
                bookingsCount={currentUser?.isLoggedIn ? bookings.length : 0}
                userProfile={userProfile}
                onUpdateProfile={setUserProfile}
                onUpdateUserName={(name) => {
                  setFullName(name);
                  setCurrentUser(prev => {
                    const updated = { ...prev, name };
                    currentUserRef.current = updated;
                    saveStoredCustomerUser(updated);
                    return updated;
                  });
                }}
                simulateLatency={simulateLatency}
                onToggleLatency={() => setSimulateLatency(!simulateLatency)}
                skeletonPreviewMode={skeletonPreviewMode}
                onToggleSkeletonPreview={() => setSkeletonPreviewMode(!skeletonPreviewMode)}
              />
            </View>
          )}
        </View>

        {/* PERSISTENT WISHLIST SCREEN (Kept warm once visited for 0ms back-navigation) */}
        {visitedScreens['wishlist'] && (
          <View style={[{ flex: 1 }, currentScreen !== 'wishlist' && { display: 'none' }]}>
            <Wishlist
              theme={theme}
              activeTheme={activeTheme}
              wishlistIds={wishlistIds}
              servicesList={servicesList}
              onToggleWishlist={handleToggleWishlist}
              onOpenBooking={handleOpenBooking}
              onBack={() => setCurrentScreen('home')}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          </View>
        )}

        {/* PERSISTENT SERVICE CATEGORY LISTING SCREEN (Kept warm once visited for 0ms back-navigation) */}
        {visitedScreens['listing'] && (
          <View style={[{ flex: 1 }, currentScreen !== 'listing' && { display: 'none' }]}>
            <ServicesCategoryListing
              theme={theme}
              currentUser={currentUser}
              selectedCategoryKey={selectedCategoryKey}
              initialQuery={listingInitialQuery}
              categoriesList={categoriesList}
              onBack={() => {
                setCurrentScreen('home');
              }}
              onOpenBooking={handleOpenBooking}
              servicesList={servicesList}
              activeTheme={activeTheme}
              isLoading={isLoading || skeletonPreviewMode}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              wishlistIds={wishlistIds}
              onToggleWishlist={handleToggleWishlist}
            />
          </View>
        )}
      </SafeAreaView>

      {/* PAYMENT SCREEN (kept warm once visited for 0ms back-navigation) */}
      {visitedScreens['payment'] && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }, currentScreen !== 'payment' && { display: 'none' }]}>
          <LinearGradient
            colors={activeTheme.gradientColors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <TopNavbar
              theme={theme}
              onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              onMenuPress={() => setSidebarOpen(true)}
              activeTheme={activeTheme}
              userProfile={userProfile}
              wishlistCount={wishlistIds.length}
              onWishlistPress={() => setCurrentScreen('wishlist')}
              onLogoPress={handleLogoPress}
              onProfilePress={() => handleTabSelect('profile')}
            />
            <Payment
              theme={theme}
              activeTheme={activeTheme}
              onBack={() => setCurrentScreen('home')}
              refreshing={refreshing}
              onRefresh={handleRefresh}
            />
          </SafeAreaView>
        </View>
      )}

      {/* BLOG SCREEN (kept warm once visited for 0ms back-navigation) */}
      {visitedScreens['blog'] && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }, currentScreen !== 'blog' && { display: 'none' }]}>
          <LinearGradient
            colors={activeTheme.gradientColors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <TopNavbar
              theme={theme}
              onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              onMenuPress={() => setSidebarOpen(true)}
              activeTheme={activeTheme}
              userProfile={userProfile}
              wishlistCount={wishlistIds.length}
              onWishlistPress={() => setCurrentScreen('wishlist')}
              onLogoPress={handleLogoPress}
              onProfilePress={() => handleTabSelect('profile')}
            />
            <Blog
              theme={theme}
              activeTheme={activeTheme}
              onBack={() => setCurrentScreen('home')}
            />
          </SafeAreaView>
        </View>
      )}

      {/* CONTACT CONCIERGE SCREEN (kept warm once visited for 0ms back-navigation) */}
      {visitedScreens['contact'] && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }, currentScreen !== 'contact' && { display: 'none' }]}>
          <LinearGradient
            colors={activeTheme.gradientColors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <TopNavbar
              theme={theme}
              onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              onMenuPress={() => setSidebarOpen(true)}
              activeTheme={activeTheme}
              userProfile={userProfile}
              wishlistCount={wishlistIds.length}
              onWishlistPress={() => setCurrentScreen('wishlist')}
              onLogoPress={handleLogoPress}
              onProfilePress={() => handleTabSelect('profile')}
            />
            <Contact
              theme={theme}
              activeTheme={activeTheme}
              onBack={() => setCurrentScreen('home')}
            />
          </SafeAreaView>
        </View>
      )}

      {/* VEHICLE CAR & BIKE WASH SCREEN (kept warm once visited for 0ms back-navigation) */}
      {visitedScreens['vehicle-car-&-bike-wash'] && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }, currentScreen !== 'vehicle-car-&-bike-wash' && { display: 'none' }]}>
          <LinearGradient
            colors={activeTheme.gradientColors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <TopNavbar
              theme={theme}
              onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              onMenuPress={() => setSidebarOpen(true)}
              activeTheme={activeTheme}
              userProfile={userProfile}
              wishlistCount={wishlistIds.length}
              onWishlistPress={() => setCurrentScreen('wishlist')}
              onLogoPress={handleLogoPress}
              onProfilePress={() => handleTabSelect('profile')}
            />
            <VehicleCarBikeWash
              key={`wash-${initialVehicleType}-${washSessionKey}`}
              theme={theme}
              activeTheme={activeTheme}
              currentUser={currentUser}
              initialVehicleType={initialVehicleType}
              onRequireLogin={() => {
                setPendingScreenAfterLogin('vehicle-car-&-bike-wash');
                setAuthModalVisible(true);
              }}
              onBack={() => setCurrentScreen('home')}
              onBookingComplete={(ref) => {
                if (currentUser?.isLoggedIn && currentUser?.id) {
                  fetchCustomerBookingsApi(currentUser.id).then(res => {
                    if (res && res.length > 0) setBookings(res);
                  }).catch(e => console.log('[Home] Bookings reload error:', e));
                }
                setNotifications(prev => [
                  {
                    id: String(Date.now()),
                    title: 'Vehicle Wash Booked',
                    message: `Your booking (Ref: ${ref}) has been successfully confirmed.`,
                    time: 'Just now',
                    read: false,
                    type: 'success',
                  },
                  ...prev,
                ]);
              }}
            />
          </SafeAreaView>
        </View>
      )}

      {/* PERSONAL STAFF & MAIDS SCREEN (kept warm once visited for 0ms back-navigation) */}
      {visitedScreens['personal-staff-&-maids'] && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }, currentScreen !== 'personal-staff-&-maids' && { display: 'none' }]}>
          <LinearGradient
            colors={activeTheme.gradientColors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <TopNavbar
              theme={theme}
              onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              onMenuPress={() => setSidebarOpen(true)}
              activeTheme={activeTheme}
              userProfile={userProfile}
              wishlistCount={wishlistIds.length}
              onWishlistPress={() => setCurrentScreen('wishlist')}
              onLogoPress={handleLogoPress}
              onProfilePress={() => handleTabSelect('profile')}
            />
            <PersonalStaffMaids
              theme={theme}
              activeTheme={activeTheme}
              onBack={() => setCurrentScreen('home')}
              onBookingComplete={(ref) => {
                setNotifications(prev => [
                  {
                    id: String(Date.now()),
                    title: 'Personal Staff Requested',
                    message: `Your staff booking (Ref: ${ref}) has been submitted for verification.`,
                    time: 'Just now',
                    read: false,
                    type: 'success',
                  },
                  ...prev,
                ]);
              }}
            />
          </SafeAreaView>
        </View>
      )}

      {/* BOTTOM FLOATING NAVBAR (Persistent display toggle) */}
      <View style={{ display: (currentScreen === 'home' || currentScreen === 'listing' || currentScreen === 'wishlist') ? 'flex' : 'none' }}>
        <BottomNavbar
          activeTab={currentScreen === 'listing' ? 'services' : activeTab}
          onTabSelect={handleTabSelect}
          activeTheme={activeTheme}
          theme={theme}
        />
      </View>

      {/* SIDEBAR OVERLAY */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        theme={theme}
        activeTheme={activeTheme}
        onNavigateTab={handleTabSelect}
        onNavigateToVehicleWash={(vehicleType?: string) => {
          setSidebarOpen(false);
          const chosenType = vehicleType || 'Car';
          setInitialVehicleType(chosenType);
          setWashSessionKey(k => k + 1);
          const activeUser = currentUserRef.current || currentUser;
          if (!activeUser?.isLoggedIn) {
            setPendingScreenAfterLogin('vehicle-car-&-bike-wash');
            setAuthModalVisible(true);
            return;
          }
          setCurrentScreen('vehicle-car-&-bike-wash');
        }}
        onNavigateToMaids={() => {
          setSidebarOpen(false);
          setCurrentScreen('personal-staff-&-maids');
        }}
        onNavigateToWishlist={() => {
          setSidebarOpen(false);
          setCurrentScreen('wishlist');
        }}
        onNavigateToPayment={() => {
          setSidebarOpen(false);
          setCurrentScreen('payment');
        }}
        onNavigateToBlog={() => {
          setSidebarOpen(false);
          setCurrentScreen('blog');
        }}
        onNavigateToContact={() => {
          setSidebarOpen(false);
          setCurrentScreen('contact');
        }}
        onOpenAbout={() => {
          setSidebarOpen(false);
          setAboutModalVisible(true);
        }}
        onNavigateToCategory={() => {
          setSidebarOpen(false);
          handleNavigateToListing('all', 'domains');
        }}
        onNavigateToShop={() => {
          setSidebarOpen(false);
          handleTabSelect('services');
        }}
        onNavigateToProduct={() => {
          setSidebarOpen(false);
          handleTabSelect('services');
        }}
        onNavigateToAddress={() => {
          setSidebarOpen(false);
          handleTabSelect('profile');
        }}
        onNavigateToBookings={() => {
          setSidebarOpen(false);
          handleTabSelect('bookings');
        }}
        onNavigateToAccount={() => {
          setSidebarOpen(false);
          handleTabSelect('profile');
        }}
        onOpenAuth={() => {
          setSidebarOpen(false);
          setAuthModalVisible(true);
        }}
        onLogout={() => {
          setSidebarOpen(false);
          setTimeout(() => {
            setLogoutModalVisible(true);
          }, 150);
        }}
        userProfile={userProfile}
        currentUser={currentUser}
      />

      {/* ABOUT SERVEASY MODAL (Matching Web about.php) */}
      <AboutModal
        visible={aboutModalVisible}
        onClose={() => setAboutModalVisible(false)}
        theme={theme}
        activeTheme={activeTheme}
      />

      {/* AUTHENTICATION & OTP LOGIN MODAL (Matching Web auth/auth.php) */}
      <AuthModal
        visible={authModalVisible}
        onClose={() => {
          setAuthModalVisible(false);
          setPendingScreenAfterLogin(null);
        }}
        theme={theme}
        activeTheme={activeTheme}
        onLoginSuccess={(u) => {
          const userObj: CustomerUserSession = {
            id: u.id,
            name: u.name,
            identity: u.identity,
            phone: u.phone,
            email: u.email,
            isLoggedIn: true,
          };
          currentUserRef.current = userObj;
          saveStoredCustomerUser(userObj);
          setCurrentUser(userObj);
          setFullName(u.name);
          if (u.phone && !u.phone.includes('@')) {
            setPhoneNumber(u.phone);
          } else if (u.identity && !u.identity.includes('@')) {
            setPhoneNumber(u.identity);
          } else {
            setPhoneNumber('');
          }
          setNotificationBanner({
            visible: true,
            title: 'Welcome back!',
            message: `Logged in successfully as ${u.name}.`,
            type: 'success',
          });
          if (pendingScreenAfterLogin) {
            const nextScreen = pendingScreenAfterLogin as any;
            setPendingScreenAfterLogin(null);
            setCurrentScreen(nextScreen);
          }
        }}
      />

      {/* STYLISH LOGOUT CONFIRMATION POPUP MODAL */}
      <LogoutModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={() => {
          setLogoutModalVisible(false);
          handleLogout();
        }}
        theme={theme}
        activeTheme={activeTheme}
      />

      {/* GLOBAL SERVER CONNECTION FAILURE MODAL */}
      <ServerConnectionModal
        visible={globalServerErrorVisible}
        onClose={() => setGlobalServerErrorVisible(false)}
        onRetry={() => {
          setGlobalServerErrorVisible(false);
          handleRefresh();
        }}
        theme={theme}
        activeTheme={activeTheme}
      />

      {/* BOOKING MODAL WIZARD */}
      <Modal
        visible={bookingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContentContainer, { backgroundColor: activeTheme.modalBg }]}>
            {/* HEADER */}
            <View style={[styles.modalHeader, { borderBottomColor: activeTheme.cardBorder }]}>
              <View>
                <Text style={[styles.modalTitle, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                  {selectedService ? (selectedService.category === 'emergency' ? 'Emergency Request' : 'Book Service') : 'Booking Wizard'}
                </Text>
                {selectedService && (
                  <Text style={[styles.modalSubtitle, { color: activeTheme.textSecondary }]}>
                    {selectedService.name}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setBookingModalVisible(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {!isSuccessState ? (
              /* FORM SCREEN STATE */
              <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
                {selectedService && (
                  <View style={styles.formSection}>
                    <Text style={[styles.formLabel, { color: activeTheme.textSecondary }]}>Choose Service Option</Text>
                    <View style={styles.packagesGrid}>
                      {selectedService.packages.map(pkg => {
                        const isSelected = selectedPackage?.id === pkg.id;
                        return (
                          <TouchableOpacity
                            key={pkg.id}
                            style={[
                              styles.packageCard,
                              {
                                borderColor: isSelected ? '#0084FF' : activeTheme.cardBorder,
                                backgroundColor: isSelected ? 'rgba(0, 132, 255, 0.12)' : activeTheme.inputBg
                              }
                            ]}
                            onPress={() => setSelectedPackage(pkg)}
                          >
                            <View style={styles.packageCardRow}>
                              <Text style={[styles.packageName, { color: activeTheme.textPrimary }]}>{pkg.name}</Text>
                              <Text style={[styles.packagePrice, { color: '#0084FF' }]}>
                                {pkg.price > 0 ? `$${pkg.price}` : 'Free'}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* SCHEDULE SECTION */}
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: activeTheme.textSecondary }]}>Select Schedule Date & Time</Text>

                  {/* QUICK DATE PICKER */}
                  <View style={styles.quickSelectRow}>
                    {[
                      { label: 'Tomorrow', daysOffset: 1 },
                      { label: 'In 2 Days', daysOffset: 2 },
                      { label: 'In 3 Days', daysOffset: 3 }
                    ].map(quickDate => {
                      const targetDate = new Date();
                      targetDate.setDate(targetDate.getDate() + quickDate.daysOffset);
                      const dateStr = targetDate.toISOString().split('T')[0];
                      const isSelected = bookingDate === dateStr;

                      return (
                        <TouchableOpacity
                          key={quickDate.label}
                          style={[
                            styles.quickSelectPill,
                            {
                              backgroundColor: isSelected ? '#0084FF' : activeTheme.inputBg,
                              borderColor: isSelected ? '#0084FF' : activeTheme.inputBorder
                            }
                          ]}
                          onPress={() => setBookingDate(dateStr)}
                        >
                          <Text style={[styles.quickSelectPillText, { color: isSelected ? '#FFFFFF' : activeTheme.textPrimary }]}>
                            {quickDate.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* CUSTOM DATE FIELD */}
                  <View style={[styles.inputContainer, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                    <MaterialCommunityIcons name="calendar" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      value={bookingDate}
                      onChangeText={setBookingDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={activeTheme.textSecondary}
                      style={[styles.textInputStyle, { color: activeTheme.textPrimary }]}
                    />
                  </View>

                  {/* QUICK TIME PICKER */}
                  <View style={styles.quickSelectRow}>
                    {['09:00 AM', '12:00 PM', '03:00 PM', '06:00 PM'].map(timeSlot => {
                      const isSelected = bookingTime === timeSlot;
                      return (
                        <TouchableOpacity
                          key={timeSlot}
                          style={[
                            styles.quickSelectPill,
                            {
                              backgroundColor: isSelected ? '#0084FF' : activeTheme.inputBg,
                              borderColor: isSelected ? '#0084FF' : activeTheme.inputBorder
                            }
                          ]}
                          onPress={() => setBookingTime(timeSlot)}
                        >
                          <Text style={[styles.quickSelectPillText, { color: isSelected ? '#FFFFFF' : activeTheme.textPrimary }]}>
                            {timeSlot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* CUSTOM TIME FIELD */}
                  <View style={[styles.inputContainer, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                    <MaterialCommunityIcons name="clock-outline" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      value={bookingTime}
                      onChangeText={setBookingTime}
                      placeholder="Select Time (e.g., 10:00 AM)"
                      placeholderTextColor={activeTheme.textSecondary}
                      style={[styles.textInputStyle, { color: activeTheme.textPrimary }]}
                    />
                  </View>
                </View>

                {/* CUSTOMER PROFILE INFORMATION */}
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: activeTheme.textSecondary }]}>Customer & Contact Info</Text>

                  <View style={[styles.inputContainer, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                    <MaterialCommunityIcons name="account-outline" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Full Name"
                      placeholderTextColor={activeTheme.textSecondary}
                      style={[styles.textInputStyle, { color: activeTheme.textPrimary }]}
                    />
                  </View>

                  <View style={[
                    styles.inputContainer,
                    { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder },
                    (phoneNumber.includes('@') || (!phoneNumber.trim() && isSuccessState === false && fullName.trim() !== '')) && { borderColor: '#FF9F0A' }
                  ]}>
                    <MaterialCommunityIcons name="phone-outline" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      placeholder="Enter 10-digit mobile number"
                      placeholderTextColor={activeTheme.textSecondary}
                      keyboardType="phone-pad"
                      maxLength={15}
                      style={[styles.textInputStyle, { color: activeTheme.textPrimary }]}
                    />
                  </View>
                  {(!phoneNumber.trim() || phoneNumber.includes('@') || !/^\d{10,12}$/.test(phoneNumber.replace(/[\s\-+()]/g, ''))) && (
                    <Text style={{ fontSize: 11, color: '#FF9F0A', marginTop: -6, marginBottom: 10, fontWeight: '500' }}>
                      * Valid 10-digit mobile number required
                    </Text>
                  )}

                  {/* SERVICE MODE (Doorstep vs In-Shop) */}
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.formLabel, { color: activeTheme.textSecondary }]}>Service Mode</Text>
                    <View style={styles.modeSelectRow}>
                      {[
                        { key: 'doorstep', label: 'Doorstep Service', icon: 'home-map-marker', desc: 'At your address' },
                        { key: 'shop', label: 'In-Shop Visit', icon: 'store-outline', desc: 'Partner workshop' }
                      ].map(m => {
                        const isSelected = bookingServiceMode === m.key;
                        return (
                          <TouchableOpacity
                            key={m.key}
                            style={[
                              styles.modeSelectCard,
                              {
                                backgroundColor: isSelected ? 'rgba(0, 132, 255, 0.12)' : activeTheme.inputBg,
                                borderColor: isSelected ? '#0084FF' : activeTheme.cardBorder
                              }
                            ]}
                            onPress={() => setBookingServiceMode(m.key as any)}
                          >
                            <MaterialCommunityIcons
                              name={m.icon as any}
                              size={20}
                              color={isSelected ? '#0084FF' : activeTheme.iconColor}
                              style={{ marginBottom: 4 }}
                            />
                            <Text style={[styles.modeSelectTitle, { color: isSelected ? '#0084FF' : activeTheme.textPrimary }]}>
                              {m.label}
                            </Text>
                            <Text style={[styles.modeSelectDesc, { color: activeTheme.textSecondary }]}>
                              {m.desc}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* ADDRESS INPUT & QUICK SAVED ADDRESSES */}
                  {bookingServiceMode === 'doorstep' ? (
                    <>
                      <View style={styles.quickAddressRow}>
                        <TouchableOpacity
                          style={[
                            styles.quickAddressPill,
                            {
                              borderColor: '#05c279',
                              backgroundColor: 'rgba(5, 194, 121, 0.12)',
                            },
                          ]}
                          onPress={handlePinCurrentHomeLocation}
                          disabled={isPinningHomeLoc}
                        >
                          {isPinningHomeLoc ? (
                            <ActivityIndicator size="small" color="#05c279" />
                          ) : (
                            <MaterialCommunityIcons name="crosshairs-gps" size={13} color="#05c279" />
                          )}
                          <Text style={[styles.quickAddressPillText, { color: '#05c279', fontWeight: '700' }]}>
                            {isPinningHomeLoc ? 'Locating...' : 'Pin Current Location'}
                          </Text>
                        </TouchableOpacity>
                        {[
                          { label: 'Home', addr: '123 Premium Heights, Block C' },
                          { label: 'Work', addr: 'Tech Park B4, Tower 2' }
                        ].map(qa => (
                          <TouchableOpacity
                            key={qa.label}
                            style={[styles.quickAddressPill, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.inputBg }]}
                            onPress={() => setServiceAddress(qa.addr)}
                          >
                            <MaterialCommunityIcons name="bookmark-outline" size={12} color="#0084FF" />
                            <Text style={[styles.quickAddressPillText, { color: activeTheme.textPrimary }]}>
                              Use {qa.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={[styles.inputContainer, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                        <MaterialCommunityIcons name="map-marker-outline" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                        <TextInput
                          value={serviceAddress}
                          onChangeText={setServiceAddress}
                          placeholder="Service Address (Doorstep deliveries only)"
                          placeholderTextColor={activeTheme.textSecondary}
                          style={[styles.textInputStyle, { color: activeTheme.textPrimary }]}
                        />
                      </View>
                    </>
                  ) : (
                    <View style={[styles.shopLocationCard, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
                      <MaterialCommunityIcons name="store-check-outline" size={20} color="#0084FF" style={{ marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.shopLocationTitle, { color: activeTheme.textPrimary }]}>
                          ServEasy Verified Partner Center
                        </Text>
                        <Text style={[styles.shopLocationDesc, { color: activeTheme.textSecondary }]}>
                          Directions and navigation token will be shared upon booking confirmation.
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={[styles.inputContainer, styles.textAreaContainer, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                    <TextInput
                      value={additionalNotes}
                      onChangeText={setAdditionalNotes}
                      placeholder="Additional instruction notes (optional)"
                      placeholderTextColor={activeTheme.textSecondary}
                      multiline={true}
                      numberOfLines={3}
                      style={[styles.textInputStyle, styles.textAreaInput, { color: activeTheme.textPrimary }]}
                    />
                  </View>
                </View>

                {/* PAYMENT METHOD CHOICES PORTED FROM WEB */}
                <View style={styles.formSection}>
                  <Text style={[styles.formLabel, { color: activeTheme.textSecondary }]}>Payment Method</Text>
                  <View style={styles.paymentMethodsGrid}>
                    {[
                      { key: 'Cash after Service', icon: 'cash-multiple', badge: 'Popular', color: '#30D158' },
                      { key: 'Instant UPI / QR', icon: 'qrcode-scan', badge: 'Fastest', color: '#0084FF' },
                      { key: 'Credit / Debit Card', icon: 'credit-card-outline', badge: 'Secure', color: '#5E5CE6' },
                      { key: 'ServEasy Wallet', icon: 'wallet-outline', badge: '$250 Bal', color: '#FF9F0A' }
                    ].map(pm => {
                      const isSelected = bookingPaymentMethod === pm.key;
                      return (
                        <TouchableOpacity
                          key={pm.key}
                          style={[
                            styles.paymentMethodCard,
                            {
                              backgroundColor: isSelected ? 'rgba(0, 132, 255, 0.12)' : activeTheme.inputBg,
                              borderColor: isSelected ? '#0084FF' : activeTheme.cardBorder
                            }
                          ]}
                          onPress={() => setBookingPaymentMethod(pm.key as any)}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <MaterialCommunityIcons name={pm.icon as any} size={20} color={pm.color} style={{ marginRight: 10 }} />
                            <Text style={[styles.paymentMethodName, { color: activeTheme.textPrimary }]}>{pm.key}</Text>
                          </View>
                          <View style={[styles.paymentMethodBadge, { backgroundColor: `${pm.color}20` }]}>
                            <Text style={[styles.paymentMethodBadgeText, { color: pm.color }]}>{pm.badge}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* FORM ACTIONS */}
                <View style={styles.formActionsRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.cancelBtn, { borderColor: activeTheme.cardBorder }]}
                    onPress={() => setBookingModalVisible(false)}
                  >
                    <Text style={[styles.cancelBtnText, { color: activeTheme.textSecondary }]}>CANCEL</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      styles.submitBtn,
                      { backgroundColor: selectedService?.category === 'emergency' ? '#FF453A' : activeTheme.accentBtnBg }
                    ]}
                    onPress={handleConfirmBooking}
                  >
                    <Text style={styles.submitBtnText}>
                      {selectedService?.category === 'emergency' ? 'CONFIRM SOS' : 'CONFIRM BOOKING'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              /* SUCCESS SCREEN STATE */
              <View style={styles.successContainer}>
                <View style={styles.successIconOuterCircle}>
                  <View style={[styles.successIconCircle, { backgroundColor: selectedService?.category === 'emergency' ? '#FF453A' : '#30D158' }]}>
                    <MaterialCommunityIcons name="check" size={38} color="#FFFFFF" />
                  </View>
                </View>

                <Text style={[styles.successTitle, { color: activeTheme.textPrimary }]}>
                  {selectedService?.category === 'emergency' ? 'SOS Request Dispatched!' : 'Booking Confirmed!'}
                </Text>
                <Text style={[styles.successDesc, { color: activeTheme.textSecondary }]}>
                  {selectedService?.category === 'emergency'
                    ? 'Your SOS security/medical response has been logged. Emergency teams have been dispatched to your location.'
                    : 'Your service booking request has been successfully registered. A certified service partner is on their way!'}
                </Text>

                {/* TICKET DETAILS CARD */}
                <GlassCard theme={theme} style={styles.ticketCard} intensity={activeTheme.glassIntensity}>
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Reference Code</Text>
                    <Text style={[styles.ticketValueCode, { color: activeTheme.textPrimary }]}>{bookingReference}</Text>
                  </View>
                  <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, paddingBottom: 12, marginBottom: 12 }]} />
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Service Name</Text>
                    <Text style={[styles.ticketValue, { color: activeTheme.textPrimary }]}>{selectedService?.name}</Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Package</Text>
                    <Text style={[styles.ticketValue, { color: activeTheme.textPrimary }]}>{selectedPackage?.name}</Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Service Mode</Text>
                    <Text style={[styles.ticketValue, { color: '#0084FF', textTransform: 'capitalize' }]}>{bookingServiceMode}</Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Schedule Time</Text>
                    <Text style={[styles.ticketValue, { color: activeTheme.textPrimary }]}>{bookingDate} at {bookingTime}</Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Payment</Text>
                    <Text style={[styles.ticketValue, { color: '#30D158' }]}>{bookingPaymentMethod}</Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Address</Text>
                    <Text style={[styles.ticketValue, { color: activeTheme.textPrimary }]} numberOfLines={2}>
                      {bookingServiceMode === 'shop' ? 'In-Shop / Verified Workshop' : serviceAddress}
                    </Text>
                  </View>
                  <View style={styles.ticketRow}>
                    <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>Price</Text>
                    <Text style={[styles.ticketValue, { color: activeTheme.textPrimary, fontWeight: 'bold' }]}>
                      {selectedPackage?.price ? `$${selectedPackage.price}` : 'Free Dispatch'}
                    </Text>
                  </View>
                </GlassCard>

                <TouchableOpacity
                  style={[
                    styles.doneBtn,
                    { backgroundColor: selectedService?.category === 'emergency' ? '#FF453A' : activeTheme.accentBtnBg }
                  ]}
                  onPress={() => setBookingModalVisible(false)}
                >
                  <Text style={styles.doneBtnText}>CLOSE WIZARD</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* PHONE NOTIFICATION STYLE FLOATING POPUP BANNER */}
      {notificationBanner && (
        <NotificationBanner
          visible={notificationBanner.visible}
          title={notificationBanner.title}
          message={notificationBanner.message}
          type={notificationBanner.type || 'success'}
          appLabel="ServEasy • Just now"
          onClose={() => setNotificationBanner(null)}
        />
      )}
    </View>
  );
}

// Rename home feed container so that it doesn't conflict with main <Home> component
interface HomeFeedProps {
  scrollRef?: any;
  onLogoPress?: () => void;
  theme: 'dark' | 'light';
  activeTheme: any;
  servicesList: ServiceItem[];
  categoriesList?: ApiCategory[];
  onOpenBooking: (service: ServiceItem) => void;
  onNavigateToListing: (categoryKey: string, initialQuery?: string) => void;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  wishlistIds?: string[];
  onToggleWishlist?: (serviceId: string) => void;
  onNavigateToBlog?: () => void;
  onNavigateToContact?: () => void;
  onOpenAbout?: () => void;
  onNavigateToWishlist?: () => void;
  currentUser?: CustomerUserSession;
  onNavigateToVehicleWash?: (vehicleType?: string) => void;
  onNavigateToMaids?: () => void;
  onNavigateTab?: (tab: 'home' | 'services' | 'bookings' | 'notifications' | 'profile') => void;
}

// Local helper component wrapping the home discovery view matching Web index.php (Memoized for instant 0ms switching)
const HomeFeed = React.memo(function HomeFeed({
  scrollRef,
  onLogoPress,
  theme,
  activeTheme,
  servicesList,
  categoriesList = [],
  currentUser,
  onOpenBooking,
  onNavigateToListing,
  isLoading,
  refreshing,
  onRefresh,
  wishlistIds,
  onToggleWishlist,
  onNavigateToBlog,
  onNavigateToContact,
  onOpenAbout,
  onNavigateToWishlist,
  onNavigateToVehicleWash,
  onNavigateToMaids,
  onNavigateTab,
}: HomeFeedProps) {
  // Search, Category, View switcher & Sorting states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(false);
  const [categoryViewMode, setCategoryViewMode] = useState<'domains' | 'subcategories'>('domains');
  const [showAllSubcategories, setShowAllSubcategories] = useState(false);
  const [subcatDomainFilter, setSubcatDomainFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'price_asc' | 'price_desc'>('default');

  // Resolved categories list (uses API data if loaded, otherwise falls back to Web defaults)
  const resolvedCategories = React.useMemo(() => {
    if (categoriesList && categoriesList.length > 0) return categoriesList;
    return [1, 2, 3, 4, 5, 6, 7].map(id => {
      const meta = CATEGORY_METADATA[id];
      const names: Record<number, string> = {
        1: 'Automotive Services',
        2: 'Home & Living Services',
        3: 'Personal Care & Staff',
        4: 'Transport & Fleet Rental',
        5: 'Rooms & Staying Flats',
        6: 'Food & Delivery Services',
        7: 'Emergency SOS Response'
      };
      return {
        id,
        name: names[id],
        slug: meta.filterTag,
        icon_class: meta.iconTheme,
        is_active: 1,
        badge: meta.badge,
        description: meta.description,
        priceFrom: meta.priceFrom,
        priceUnit: meta.priceUnit,
        iconTheme: meta.iconTheme,
        materialIcon: meta.materialIcon,
        subcategories: meta.defaultSubcategories.map((ds, idx) => ({
          id: idx + 1,
          category_id: id,
          name: ds.name,
          slug: ds.slug,
          icon_class: 'checkmark-circle-outline',
          is_active: 1
        }))
      };
    });
  }, [categoriesList]);

  // Top subcategories for the subcategories view switcher mode (matches Web top 9 subcategories)
  const topSubcategories = React.useMemo(() => [
    { id: 1, name: 'Car Wash', categoryName: 'Automotive', color: '#30D158', icon: 'car-wash' as const, filter: 'automotive', slug: 'car-wash', price: '$25.00' },
    { id: 2, name: 'Bike Wash', categoryName: 'Automotive', color: '#30D158', icon: 'bicycle' as const, filter: 'automotive', slug: 'bike-wash', price: '$15.00' },
    { id: 3, name: 'Deep Cleaning', categoryName: 'Home & Living', color: '#AF52DE', icon: 'creation' as const, filter: 'home', slug: 'deep-cleaning', price: '$49.00' },
    { id: 4, name: 'Electronics & AC', categoryName: 'Home & Living', color: '#AF52DE', icon: 'air-conditioner' as const, filter: 'home', slug: 'electronics-ac', price: '$35.00' },
    { id: 5, name: 'House Maid', categoryName: 'Personal Staff', color: '#FF2D55', icon: 'account-heart' as const, filter: 'care', slug: 'house-maid', price: '$18.00/hr' },
    { id: 6, name: 'Bus Ticket Booking', categoryName: 'Transport', color: '#00C7BE', icon: 'bus' as const, filter: 'transport', slug: 'bus-ticket', price: '$12.00' },
    { id: 7, name: 'Short-Stay Rooms', categoryName: 'Rooms & Stays', color: '#FF9F0A', icon: 'bed' as const, filter: 'stay', slug: 'short-stay-rooms', price: '$45.00/night' },
    { id: 8, name: 'Restaurant Orders', categoryName: 'Food & Dining', color: '#FF6B35', icon: 'silverware-fork-knife' as const, filter: 'food', slug: 'restaurant-orders', price: '$10.00' },
    { id: 9, name: 'Medical Emergency', categoryName: 'Emergency SOS', color: '#FF453A', icon: 'ambulance' as const, filter: 'emergency', slug: 'medical-emergency', price: 'Free SOS' },
  ], []);

  // Full list of all subcategories across all 7 domains (matches Web 36+ subcategories with pricing & icons)
  const allSubcategories = React.useMemo(() => {
    const list: Array<{
      id: number | string;
      name: string;
      categoryName: string;
      color: string;
      icon: string;
      filter: string;
      slug: string;
      price: string;
    }> = [];

    const iconMap: Record<string, string> = {
      'car-wash': 'car-wash',
      'bike-wash': 'bicycle',
      'vehicle-servicing': 'wrench',
      'vehicle-repair': 'car-wrench',
      'vehicle-parts': 'cog-outline',
      'towing-breakdown': 'tow-truck',
      'deep-cleaning': 'creation',
      'ac-repair-service': 'air-conditioner',
      'plumbing-services': 'pipe-wrench',
      'electrical-repairs': 'lightning-bolt',
      'painting-wallcare': 'format-paint',
      'pest-control': 'bug-outline',
      'house-maid': 'account-heart',
      'part-time-helper': 'account-clock',
      'elderly-care': 'hand-heart',
      'baby-sitter': 'baby-face-outline',
      'professional-cook': 'silverware-fork-knife',
      'bus-ticket': 'bus',
      'private-cab': 'taxi',
      'self-drive': 'car-key',
      'airport-transfer': 'airplane',
      'bike-rental': 'motorbike',
      'hourly-stay': 'clock-outline',
      'overnight-hotel': 'bed',
      'budget-dorm': 'bunk-bed-outline',
      'luxury-suites': 'crown',
      'homestay': 'home-heart',
      'restaurant-dine': 'silverware',
      'fast-food': 'hamburger',
      'midnight-cafe': 'coffee',
      'gourmet-meal': 'food-variant',
      'catering': 'glass-cocktail',
      'roadside-towing': 'tow-truck',
      'emergency-ambulance': 'ambulance',
      'emergency-mechanic': 'wrench-clock',
      'home-locksmith': 'key-wireless',
      'fire-accident': 'fire-truck',
    };

    const priceMap: Record<string, string> = {
      'car-wash': '$25.00',
      'bike-wash': '$15.00',
      'vehicle-servicing': '$60.00',
      'vehicle-repair': '$45.00',
      'vehicle-parts': '$30.00',
      'towing-breakdown': '$40.00',
      'deep-cleaning': '$49.00',
      'ac-repair-service': '$35.00',
      'plumbing-services': '$29.00',
      'electrical-repairs': '$25.00',
      'painting-wallcare': '$80.00',
      'pest-control': '$55.00',
      'house-maid': '$18.00/hr',
      'part-time-helper': '$15.00/hr',
      'elderly-care': '$22.00/hr',
      'baby-sitter': '$20.00/hr',
      'professional-cook': '$25.00/hr',
      'bus-ticket': '$12.00',
      'private-cab': '$18.00',
      'self-drive': '$35.00/day',
      'airport-transfer': '$28.00',
      'bike-rental': '$15.00/day',
      'hourly-stay': '$20.00/hr',
      'overnight-hotel': '$45.00/night',
      'budget-dorm': '$15.00/night',
      'luxury-suites': '$95.00/night',
      'homestay': '$40.00/night',
      'restaurant-dine': '$10.00',
      'fast-food': '$8.00',
      'midnight-cafe': '$6.00',
      'gourmet-meal': '$14.00',
      'catering': '$150.00',
      'roadside-towing': '$35.00',
      'emergency-ambulance': 'Free SOS',
      'emergency-mechanic': '$40.00',
      'home-locksmith': '$30.00',
      'fire-accident': 'Free SOS',
    };

    let idx = 1;
    resolvedCategories.forEach(cat => {
      const meta = CATEGORY_METADATA[cat.id] || {
        color: '#0084FF',
        filterTag: cat.slug || 'all',
      };
      const catColor = meta.color || '#0084FF';
      const catFilter = meta.filterTag || 'all';

      if (cat.subcategories && cat.subcategories.length > 0) {
        cat.subcategories.forEach((sub: any) => {
          const sSlug = sub.slug || '';
          list.push({
            id: sub.id || idx++,
            name: sub.name,
            categoryName: cat.name.replace(' Services', '').replace(' Response', '').replace(' Flats', ''),
            color: catColor,
            icon: iconMap[sSlug] || 'shape-outline',
            filter: catFilter,
            slug: sSlug,
            price: priceMap[sSlug] || cat.priceFrom || '$20.00'
          });
        });
      }
    });

    return list;
  }, [resolvedCategories]);

  // Displayed subcategories list based on expansion and domain filter
  const displayedSubcategories = React.useMemo(() => {
    if (!showAllSubcategories) {
      return topSubcategories;
    }
    if (subcatDomainFilter === 'all') {
      return allSubcategories;
    }
    return allSubcategories.filter(s => s.filter === subcatDomainFilter);
  }, [showAllSubcategories, subcatDomainFilter, topSubcategories, allSubcategories]);

  // Displayed domains list on home feed (top 6 showcase domains)
  const displayedDomains = React.useMemo(() => {
    return resolvedCategories.slice(0, 6);
  }, [resolvedCategories]);

  // Filter and sort services
  const filteredAndSortedServices = React.useMemo(() => {
    let list = servicesList.filter(service => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        service.name.toLowerCase().includes(q) ||
        service.description.toLowerCase().includes(q) ||
        service.tags.toLowerCase().includes(q) ||
        service.badge.toLowerCase().includes(q);

      const matchesCategory =
        activeCategory === 'all' ||
        service.category.toLowerCase().includes(activeCategory.toLowerCase()) ||
        (activeCategory === 'emergency' && service.category === 'emergency');

      return matchesSearch && matchesCategory;
    });

    if (sortBy === 'rating') {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'price_asc') {
      const getPrice = (s: ServiceItem) => parseFloat(s.priceValue.replace(/[^0-9.]/g, '') || '0');
      list = [...list].sort((a, b) => getPrice(a) - getPrice(b));
    } else if (sortBy === 'price_desc') {
      const getPrice = (s: ServiceItem) => parseFloat(s.priceValue.replace(/[^0-9.]/g, '') || '0');
      list = [...list].sort((a, b) => getPrice(b) - getPrice(a));
    }

    return list;
  }, [servicesList, searchQuery, activeCategory, sortBy]);

  const HomeSkeletonImport = require('../../components/SkeletonLoader').HomeSkeleton;

  if (isLoading) {
    return <HomeSkeletonImport theme={theme} activeTheme={activeTheme} />;
  }

  return (
    <ScrollView
      ref={scrollRef as any}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      nestedScrollEnabled={true}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={activeTheme.iconColor}
          colors={[activeTheme.iconColor]}
        />
      }
    >
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 1. HERO & SEARCH BANNER CONTAINER (Clean, Modern & Organized)          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <GlassCard theme={theme} style={styles.heroGlassBox} intensity={activeTheme.glassIntensity}>
        {/* Top Feature Pill Badge */}
        <View style={styles.heroPillBadge}>
          <MaterialCommunityIcons name="shield-check" size={13} color="#0084FF" />
          <Text style={styles.heroPillBadgeText}>VERIFIED CONCIERGE & LOCAL SERVICES</Text>
        </View>

        {/* Clean, Impactful Title & Concise Tagline */}
        <View style={styles.heroSection}>
          <Text style={[styles.heroTitle, { color: activeTheme.textPrimary }]}>
            Discover & Book <Text style={{ color: '#0084FF' }}>Local Services</Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: activeTheme.textSecondary }]}>
            Instant doorstep & center bookings with upfront, transparent rates.
          </Text>
        </View>

        {/* Trust Badges Row */}
        <View style={styles.heroMetricsRow}>
          <View style={styles.heroMetricItem}>
            <MaterialCommunityIcons name="star" size={12} color="#FFD60A" />
            <Text style={[styles.heroMetricText, { color: activeTheme.textPrimary }]}>4.9/5 Rating</Text>
          </View>
          <Text style={{ color: activeTheme.cardBorder, fontSize: 10 }}>•</Text>
          <View style={styles.heroMetricItem}>
            <MaterialCommunityIcons name="lightning-bolt" size={12} color="#30D158" />
            <Text style={[styles.heroMetricText, { color: activeTheme.textPrimary }]}>15-Min Arrival</Text>
          </View>
          <Text style={{ color: activeTheme.cardBorder, fontSize: 10 }}>•</Text>
          <View style={styles.heroMetricItem}>
            <MaterialCommunityIcons name="shield-lock-outline" size={12} color="#0084FF" />
            <Text style={[styles.heroMetricText, { color: activeTheme.textPrimary }]}>100% Guaranteed</Text>
          </View>
        </View>

        {/* MODERN SEARCH BAR */}
        <View style={[styles.searchBoxWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={activeTheme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search 50+ services (e.g. Bike Wash, Maid...)"
            placeholderTextColor={activeTheme.textSecondary}
            style={[styles.searchInput, { color: activeTheme.textPrimary }]}
            returnKeyType="search"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close-circle" size={18} color={activeTheme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORIES HORIZONTAL PILLS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesRow}
          contentContainerStyle={styles.categoriesContent}
        >
          {[
            { filter: 'all', label: 'All Services', icon: 'view-grid-outline' as const },
            { filter: 'automotive', label: 'Automotive', icon: 'car-wrench' as const },
            { filter: 'home', label: 'Home & Living', icon: 'home-lightning-bolt-outline' as const },
            { filter: 'care', label: 'Personal Staff', icon: 'account-group-outline' as const },
            { filter: 'transport', label: 'Transport', icon: 'bus-clock' as const },
            { filter: 'stay', label: 'Rooms & Lodging', icon: 'office-building' as const },
            { filter: 'food', label: 'Food & Dining', icon: 'silverware-fork-knife' as const },
            { filter: 'emergency', label: 'Emergency SOS', icon: 'alert-decagram-outline' as const }
          ].map(item => {
            const isActive = activeCategory === item.filter;
            return (
              <TouchableOpacity
                key={item.filter}
                onPress={() => setActiveCategory(item.filter)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isActive ? activeTheme.pillActiveBg : activeTheme.pillInactiveBg,
                    borderColor: isActive ? '#0084FF' : activeTheme.cardBorder
                  }
                ]}
              >
                <MaterialCommunityIcons
                  name={item.icon}
                  size={13}
                  color={isActive ? '#FFF' : activeTheme.textSecondary}
                  style={{ marginRight: 5 }}
                />
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: isActive ? activeTheme.pillActiveText : activeTheme.pillInactiveText }
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </GlassCard>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 2. EXPLORE SERVICE CATEGORIES CONTAINER (Matching Web category-cards) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>
              Explore Service Categories
            </Text>
            <Text style={[styles.sectionSubtitle, { color: activeTheme.textSecondary }]}>
              {categoryViewMode === 'domains'
                ? `Showing ${displayedDomains.length} of ${resolvedCategories.length} domains`
                : `Showing ${displayedSubcategories.length} of ${allSubcategories.length} subcategories`}
            </Text>
          </View>

          {/* VIEW SWITCHER: Domains vs Subcategories */}
          <View style={[styles.viewSwitcherWrap, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
              <TouchableOpacity
                style={[
                  styles.viewSwitcherBtn,
                  categoryViewMode === 'domains' && { backgroundColor: activeTheme.pillActiveBg }
                ]}
                onPress={() => setCategoryViewMode('domains')}
              >
                <MaterialCommunityIcons
                  name="grid"
                  size={13}
                  color={categoryViewMode === 'domains' ? '#FFF' : activeTheme.textSecondary}
                />
                <Text
                  style={[
                    styles.viewSwitcherText,
                    { color: categoryViewMode === 'domains' ? '#FFF' : activeTheme.textSecondary }
                  ]}
                >
                  Domains
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.viewSwitcherBtn,
                  categoryViewMode === 'subcategories' && { backgroundColor: activeTheme.pillActiveBg }
                ]}
                onPress={() => setCategoryViewMode('subcategories')}
              >
                <MaterialCommunityIcons
                  name="apps"
                  size={13}
                  color={categoryViewMode === 'subcategories' ? '#FFF' : activeTheme.textSecondary}
                />
                <Text
                  style={[
                    styles.viewSwitcherText,
                    { color: categoryViewMode === 'subcategories' ? '#FFF' : activeTheme.textSecondary }
                  ]}
                >
                  Subs
                </Text>
              </TouchableOpacity>
            </View>
          </View>

        {categoryViewMode === 'domains' ? (
          /* MAIN CATEGORIES SHOWCASE CARDS (LISTED ONE BY ONE IN GLASSCARDS) */
          <View style={styles.cardsStack}>
            {displayedDomains.map(cat => {
              const meta = CATEGORY_METADATA[cat.id] || {
                color: '#0084FF',
                badge: 'SERVICE',
                description: cat.description || '',
                priceFrom: '$20',
                priceUnit: '/job',
                materialIcon: 'shape-outline',
                filterTag: cat.slug || 'all',
                defaultSubcategories: []
              };
              const subs = cat.subcategories && cat.subcategories.length > 0
                ? cat.subcategories
                : meta.defaultSubcategories;

              return (
                <GlassCard
                  key={cat.id}
                  theme={theme}
                  style={[styles.categoryShowcaseCard, { borderColor: activeTheme.cardBorder }]}
                  intensity={activeTheme.glassIntensity}
                >
                  {/* Top Row: Icon Container & Count Badge */}
                  <View style={styles.catCardTopRow}>
                    <View style={[styles.catIconBox, { backgroundColor: `${meta.color}22`, borderColor: `${meta.color}44` }]}>
                      <MaterialCommunityIcons
                        name={meta.materialIcon as any}
                        size={22}
                        color={meta.color}
                      />
                    </View>
                    <View style={[styles.catBadgePill, { backgroundColor: cat.id === 7 ? 'rgba(255, 69, 58, 0.15)' : 'rgba(0, 132, 255, 0.12)', borderColor: cat.id === 7 ? '#FF453A40' : '#0084FF40' }]}>
                      <Text style={[styles.catBadgeText, { color: cat.id === 7 ? '#FF453A' : '#0084FF' }]}>
                        {cat.badge || meta.badge}
                      </Text>
                    </View>
                  </View>

                  {/* Title & Description */}
                  <Text style={[styles.catCardTitle, { color: activeTheme.textPrimary }]}>
                    {cat.name}
                  </Text>
                  <Text style={[styles.catCardDesc, { color: activeTheme.textSecondary }]}>
                    {cat.description || meta.description}
                  </Text>

                  {/* Subcategories Specializations Pill Tags */}
                  {subs && subs.length > 0 && (
                    <View style={styles.catSubsWrap}>
                      <View style={styles.catSubsHeaderRow}>
                        <Text style={[styles.catSubsLabel, { color: activeTheme.textSecondary }]}>
                          POPULAR SUBCATEGORIES
                        </Text>
                        <TouchableOpacity
                          onPress={() => onNavigateToListing(meta.filterTag, 'subcategories')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Text style={[styles.catSubsViewAll, { color: '#0084FF' }]}>
                            View all {subs.length} →
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.subTagsRow}>
                        {subs.slice(0, 5).map((sub, sIdx) => (
                          <TouchableOpacity
                            key={sIdx}
                            style={[styles.subTagPill, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}
                            onPress={() => {
                              const subLower = `${sub.slug || ''} ${sub.name || ''}`.toLowerCase();
                              const isBike = subLower.includes('bike') || subLower.includes('motorcycle');
                              const isScooter = subLower.includes('scooter') || subLower.includes('scooty') || subLower.includes('moped');
                              const isSuv = subLower.includes('suv') || subLower.includes('muv');
                              const isLuxury = subLower.includes('luxury') || subLower.includes('sports');
                              const vType = isBike ? 'Bike' : isScooter ? 'Scooter' : isSuv ? 'SUV' : isLuxury ? 'Luxury' : 'Car';

                              if (sub.slug === 'car-wash' || sub.slug === 'bike-wash' || subLower.includes('wash')) {
                                if (onNavigateToVehicleWash) onNavigateToVehicleWash(vType);
                                else onNavigateToListing(meta.filterTag, sub.name);
                              } else if (sub.slug === 'house-maid' || sub.slug === 'baby-sitter' || sub.name.toLowerCase().includes('maid')) {
                                if (onNavigateToMaids) onNavigateToMaids();
                                else onNavigateToListing(meta.filterTag, sub.name);
                              } else {
                                onNavigateToListing(meta.filterTag, sub.name);
                              }
                            }}
                          >
                            <MaterialCommunityIcons name="check-circle-outline" size={11} color={meta.color} style={{ marginRight: 4 }} />
                            <Text style={[styles.subTagText, { color: activeTheme.textPrimary }]}>
                              {sub.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                        {subs.length > 5 && (
                          <TouchableOpacity
                            style={[styles.subTagPill, styles.subTagMorePill, { borderColor: activeTheme.cardBorder }]}
                            onPress={() => onNavigateToListing(meta.filterTag, 'subcategories')}
                          >
                            <Text style={[styles.subTagMoreText, { color: activeTheme.textSecondary }]}>
                              +{subs.length - 5} more
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Card Footer: Starting Price & Explore CTA Button */}
                  <View style={[styles.catCardFooter, { borderTopColor: activeTheme.cardBorder }]}>
                    <View>
                      <Text style={[styles.catPriceCaption, { color: activeTheme.textSecondary }]}>Starting From</Text>
                      <Text style={[styles.catPriceText, { color: activeTheme.textPrimary }]}>
                        {cat.priceFrom || meta.priceFrom} <Text style={{ fontSize: 11, color: activeTheme.textSecondary, fontWeight: '400' }}>{cat.priceUnit || meta.priceUnit}</Text>
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.exploreBtn,
                        { backgroundColor: cat.id === 7 ? '#FF453A' : activeTheme.accentBtnBg }
                      ]}
                      onPress={() => {
                        onNavigateToListing(meta.filterTag, '');
                      }}
                    >
                      <Text style={styles.exploreBtnText}>
                        Explore Services
                      </Text>
                      <MaterialCommunityIcons name="arrow-right" size={14} color="#FFF" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              );
            })}

            {/* "VIEW ALL DOMAINS" CONTAINER REDIRECTING TO CATEGORY PAGE */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onNavigateToListing('all', 'domains')}
              style={styles.viewAllDomainsCardWrap}
            >
              <GlassCard
                theme={theme}
                style={[
                  styles.viewAllDomainsCard,
                  {
                    borderColor: 'rgba(0, 132, 255, 0.45)',
                    backgroundColor: activeTheme.pillInactiveBg,
                  }
                ]}
                intensity={activeTheme.glassIntensity}
              >
                <View style={styles.viewAllDomainsContent}>
                  <View style={[styles.viewAllDomainsIconCircle, { backgroundColor: 'rgba(0, 132, 255, 0.16)', borderColor: 'rgba(0, 132, 255, 0.4)', borderWidth: 1 }]}>
                    <MaterialCommunityIcons name="view-grid-plus" size={24} color="#0084FF" />
                  </View>
                  <View style={styles.viewAllDomainsTextWrap}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.viewAllDomainsTitle, { color: activeTheme.textPrimary }]}>
                        View All Domains
                      </Text>
                      <View style={[styles.catBadgePill, { backgroundColor: 'rgba(0, 132, 255, 0.15)', borderColor: 'rgba(0, 132, 255, 0.4)', paddingVertical: 2, paddingHorizontal: 6 }]}>
                        <Text style={[styles.catBadgeText, { color: '#0084FF', fontSize: 10 }]}>
                          {resolvedCategories.length} Domains
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.viewAllDomainsSubtitle, { color: activeTheme.textSecondary }]}>
                      Explore all verified service categories on Category Page
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#0084FF" />
                </View>
              </GlassCard>
            </TouchableOpacity>
          </View>
        ) : (
          /* SUBCATEGORIES SHOWCASE GRID */
          <View>
            {showAllSubcategories && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.subcatFilterRow}
                contentContainerStyle={styles.subcatFilterContent}
              >
                {[
                  { filter: 'all', label: `All (${allSubcategories.length})` },
                  { filter: 'automotive', label: 'Automotive' },
                  { filter: 'home', label: 'Home & Living' },
                  { filter: 'care', label: 'Personal Staff' },
                  { filter: 'transport', label: 'Transport' },
                  { filter: 'stay', label: 'Rooms & Stays' },
                  { filter: 'food', label: 'Food & Dining' },
                  { filter: 'emergency', label: 'Emergency SOS' },
                ].map(df => {
                  const isSel = subcatDomainFilter === df.filter;
                  return (
                    <TouchableOpacity
                      key={df.filter}
                      onPress={() => setSubcatDomainFilter(df.filter)}
                      style={[
                        styles.subcatFilterPill,
                        {
                          backgroundColor: isSel ? '#0084FF' : activeTheme.inputBg,
                          borderColor: isSel ? '#0084FF' : activeTheme.cardBorder
                        }
                      ]}
                    >
                      <Text
                        style={[
                          styles.subcatFilterText,
                          { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }
                        ]}
                      >
                        {df.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.subcatGridWrap}>
              {displayedSubcategories.map(sub => (
                <GlassCard
                  key={sub.id}
                  theme={theme}
                  style={[styles.subcatCard, { borderColor: activeTheme.cardBorder }]}
                  intensity={activeTheme.glassIntensity}
                >
                  <View style={[styles.subcatIconCircle, { backgroundColor: `${sub.color}22` }]}>
                    <MaterialCommunityIcons name={sub.icon as any} size={20} color={sub.color} />
                  </View>
                  <Text style={[styles.subcatName, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                    {sub.name}
                  </Text>
                  <Text style={[styles.subcatCategoryName, { color: activeTheme.textSecondary }]}>
                    {sub.categoryName}
                  </Text>

                  {/* Starts At with Price after Categories */}
                  <View style={styles.subcatPriceWrap}>
                    <Text style={[styles.subcatPriceLabel, { color: activeTheme.textSecondary }]}>Starts at</Text>
                    <Text style={[styles.subcatPriceVal, { color: sub.slug.includes('emergency') || sub.slug.includes('ambulance') ? '#FF453A' : '#0084FF' }]}>
                      {sub.price}
                    </Text>
                  </View>

                  {/* Book Service Action Button */}
                  <TouchableOpacity
                    style={[
                      styles.subcatActionBtn,
                      { backgroundColor: sub.slug.includes('emergency') || sub.slug.includes('ambulance') ? '#FF453A' : activeTheme.accentBtnBg }
                    ]}
                    onPress={() => {
                      const subLower = `${sub.slug || ''} ${sub.name || ''}`.toLowerCase();
                      const isBike = subLower.includes('bike') || subLower.includes('motorcycle');
                      const isScooter = subLower.includes('scooter') || subLower.includes('scooty') || subLower.includes('moped');
                      const isSuv = subLower.includes('suv') || subLower.includes('muv');
                      const isLuxury = subLower.includes('luxury') || subLower.includes('sports');
                      const vType = isBike ? 'Bike' : isScooter ? 'Scooter' : isSuv ? 'SUV' : isLuxury ? 'Luxury' : 'Car';

                      if (sub.slug === 'car-wash' || sub.slug === 'bike-wash' || subLower.includes('wash')) {
                        if (onNavigateToVehicleWash) onNavigateToVehicleWash(vType);
                        else setSearchQuery(sub.name);
                      } else if (sub.slug === 'house-maid' || sub.name.toLowerCase().includes('maid')) {
                        if (onNavigateToMaids) onNavigateToMaids();
                        else setSearchQuery(sub.name);
                      } else {
                        const match = servicesList.find(s =>
                          s.name.toLowerCase().includes(sub.name.toLowerCase()) ||
                          s.tags.toLowerCase().includes(sub.name.toLowerCase())
                        );
                        if (match) {
                          onOpenBooking(match);
                        } else {
                          setSearchQuery(sub.name);
                        }
                      }
                    }}
                  >
                    <Text style={styles.subcatActionText}>Book Service</Text>
                    <MaterialCommunityIcons name="arrow-right" size={12} color="#FFF" style={{ marginLeft: 3 }} />
                  </TouchableOpacity>
                </GlassCard>
              ))}
              {/* INLINE 10TH CARD: "VIEW ALL SUBCATEGORIES" SITTING INLINE OF LAST CARD */}
              {!showAllSubcategories && (
                <TouchableOpacity
                  activeOpacity={0.88}
                  style={{ width: '48%' }}
                  onPress={() => onNavigateToListing('all', 'subcategories')}
                >
                  <GlassCard
                    theme={theme}
                    style={[
                      styles.subcatCard,
                      {
                        width: '100%',
                        borderColor: 'rgba(0, 132, 255, 0.45)',
                        backgroundColor: activeTheme.pillInactiveBg,
                      }
                    ]}
                    intensity={activeTheme.glassIntensity}
                  >
                    <View style={[styles.subcatIconCircle, { backgroundColor: 'rgba(0, 132, 255, 0.16)', borderColor: 'rgba(0, 132, 255, 0.4)', borderWidth: 1 }]}>
                      <MaterialCommunityIcons name="view-grid-plus" size={20} color="#0084FF" />
                    </View>
                    <Text style={[styles.subcatName, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                      View All
                    </Text>
                    <Text style={[styles.subcatCategoryName, { color: activeTheme.textSecondary }]}>
                      {allSubcategories.length}+ Subcategories
                    </Text>

                    {/* Starts At / Browse Label */}
                    <View style={styles.subcatPriceWrap}>
                      <Text style={[styles.subcatPriceLabel, { color: activeTheme.textSecondary }]}>Browse </Text>
                      <Text style={[styles.subcatPriceVal, { color: '#0084FF' }]}>ALL</Text>
                    </View>

                    {/* Action Button Redirecting to Categories Page with 'subcategories' Query */}
                    <View
                      style={[styles.subcatActionBtn, { backgroundColor: activeTheme.accentBtnBg }]}
                    >
                      <Text style={styles.subcatActionText}>View All</Text>
                      <MaterialCommunityIcons name="arrow-right" size={12} color="#FFF" style={{ marginLeft: 3 }} />
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              )}
            </View>

            {/* In expanded mode, show collapse button */}
            {showAllSubcategories && (
              <TouchableOpacity
                style={[styles.viewAllSubcatBtn, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}
                onPress={() => {
                  setShowAllSubcategories(false);
                  setSubcatDomainFilter('all');
                }}
              >
                <MaterialCommunityIcons name="chevron-up" size={16} color={activeTheme.textSecondary} style={{ marginRight: 6 }} />
                <Text style={[styles.viewAllSubcatText, { color: activeTheme.textSecondary }]}>
                  Show Top 9 Subcategories
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 3. AVAILABLE BOOKINGS (SERVICES CARDS) CONTAINER (Matching Web Cards)  */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>
              Available Bookings
            </Text>
            <Text style={[styles.sectionSubtitle, { color: activeTheme.textSecondary }]}>
              Showing {filteredAndSortedServices.length} of {servicesList.length} services
            </Text>
          </View>

          {/* Quick Sort Options */}
          <View style={styles.sortPillsRow}>
            {[
              { key: 'default', label: 'All' },
              { key: 'rating', label: '★ Top' },
              { key: 'price_asc', label: '$ Low' },
              { key: 'price_desc', label: '$ High' }
            ].map(s => {
              const isSel = sortBy === s.key;
              return (
                <TouchableOpacity
                  key={s.key}
                  style={[
                    styles.sortPill,
                    {
                      backgroundColor: isSel ? '#0084FF' : activeTheme.inputBg,
                      borderColor: isSel ? '#0084FF' : activeTheme.cardBorder
                    }
                  ]}
                  onPress={() => setSortBy(s.key as any)}
                >
                  <Text style={[styles.sortPillText, { color: isSel ? '#FFF' : activeTheme.textSecondary }]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {filteredAndSortedServices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={44} color={activeTheme.textSecondary} />
            <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>No services found matching filters</Text>
            <TouchableOpacity
              style={[styles.clearSearchBtn, { borderColor: activeTheme.cardBorder }]}
              onPress={() => {
                setSearchQuery('');
                setActiveCategory('all');
                setSortBy('default');
              }}
            >
              <Text style={{ color: '#0084FF', fontSize: 13, fontWeight: '700' }}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* SERVICE CARDS LISTED ONE BY ONE IN GLASSCARDS */
          <View style={styles.cardsStack}>
            {filteredAndSortedServices.map(service => {
              const isWish = wishlistIds?.includes(service.id);
              return (
                <GlassCard
                  key={service.id}
                  theme={theme}
                  style={[styles.serviceCardItem, { borderColor: activeTheme.cardBorder }]}
                  intensity={activeTheme.glassIntensity}
                >
                  {/* Service Top Row: Icon, Mode Badge & Wishlist Heart */}
                  <View style={styles.serviceItemTopRow}>
                    <View style={styles.serviceItemHeaderLeft}>
                      <View style={[styles.serviceIconContainer, { backgroundColor: activeTheme.pillInactiveBg }]}>
                        <MaterialCommunityIcons name={service.icon} size={22} color={activeTheme.iconColor} />
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={[styles.serviceItemTitle, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                          {service.name}
                        </Text>
                        <View style={styles.modeTagRow}>
                          <View style={[styles.modePillBadge, { backgroundColor: 'rgba(0, 132, 255, 0.1)', borderColor: 'rgba(0, 132, 255, 0.25)' }]}>
                            <Text style={[styles.modePillBadgeText, { color: '#0084FF' }]}>{service.badge}</Text>
                          </View>
                          <View style={styles.ratingInline}>
                            <MaterialCommunityIcons name="star" size={13} color="#FFD700" />
                            <Text style={[styles.ratingInlineText, { color: activeTheme.textPrimary }]}>
                              {service.rating} <Text style={{ color: activeTheme.textSecondary, fontWeight: '400' }}>({service.reviewCount})</Text>
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Wishlist Heart Button */}
                    <TouchableOpacity
                      onPress={() => onToggleWishlist?.(service.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[styles.wishlistHeartBtn, { backgroundColor: isWish ? 'rgba(255, 59, 48, 0.12)' : activeTheme.inputBg, borderColor: isWish ? '#FF3B30' : activeTheme.cardBorder }]}
                    >
                      <MaterialCommunityIcons
                        name={isWish ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isWish ? '#FF3B30' : activeTheme.iconColor}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Description */}
                  <Text style={[styles.serviceItemDesc, { color: activeTheme.textSecondary }]} numberOfLines={2}>
                    {service.description}
                  </Text>

                  {/* Packages previews */}
                  {service.packages && service.packages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesScrollPreview}>
                      {service.packages.slice(0, 3).map(pkg => (
                        <View key={pkg.id} style={[styles.pkgMiniChip, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
                          <Text style={[styles.pkgMiniChipName, { color: activeTheme.textSecondary }]} numberOfLines={1}>{pkg.name}</Text>
                          <Text style={[styles.pkgMiniChipPrice, { color: '#0084FF' }]}>${pkg.price}</Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}

                  {/* Card Footer: Starting Price & Book Now button */}
                  <View style={[styles.serviceCardItemFooter, { borderTopColor: activeTheme.cardBorder }]}>
                    <View>
                      <Text style={[styles.servicePriceLabel, { color: activeTheme.textSecondary }]}>{service.priceLabel}</Text>
                      <Text style={[styles.servicePriceVal, { color: activeTheme.textPrimary }]}>{service.priceValue}</Text>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.bookNowBtn,
                        { backgroundColor: service.category === 'emergency' ? '#FF453A' : activeTheme.accentBtnBg }
                      ]}
                      onPress={() => onOpenBooking(service)}
                    >
                      <Text style={styles.bookNowBtnText}>
                        {service.category === 'emergency' ? 'SOS ALERT' : 'BOOK NOW'}
                      </Text>
                      <MaterialCommunityIcons name="arrow-right" size={14} color="#FFF" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </View>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* 4. FOOTER: PROUDLY MADE IN INDIA BY S.S.R (With Monument Architecture) */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <ProudMadeInIndiaFooter theme={theme} />
    </ScrollView>
  );
}, (prevProps: HomeFeedProps, nextProps: HomeFeedProps) => {
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.refreshing === nextProps.refreshing &&
    prevProps.servicesList === nextProps.servicesList &&
    prevProps.categoriesList === nextProps.categoriesList &&
    prevProps.wishlistIds?.length === nextProps.wishlistIds?.length &&
    prevProps.currentUser?.isLoggedIn === nextProps.currentUser?.isLoggedIn &&
    prevProps.currentUser?.id === nextProps.currentUser?.id
  );
});

const styles = StyleSheet.create({
  appContainer: {
    flex: 1,
    backgroundColor: '#08090C',
  },
  ambientCirclesContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    zIndex: 0,
  },
  ambientCircle: {
    position: 'absolute',
    borderRadius: 200,
  },
  circleLeft: {
    width: 320,
    height: 320,
    top: -80,
    left: -80,
    opacity: 0.7,
  },
  circleRight: {
    width: 280,
    height: 280,
    bottom: 80,
    right: -60,
    opacity: 0.6,
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalContentContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    minHeight: '60%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  formSection: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  packagesGrid: {
    flexDirection: 'column',
  },
  packageCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  packageCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  packagePrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  quickSelectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  quickSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  quickSelectPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInputStyle: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
  textAreaContainer: {
    height: 90,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  textAreaInput: {
    height: '100%',
    textAlignVertical: 'top',
  },
  modeSelectRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modeSelectCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
  },
  modeSelectTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  modeSelectDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
  quickAddressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  quickAddressPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  quickAddressPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  shopLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  shopLocationTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  shopLocationDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  paymentMethodsGrid: {
    gap: 8,
  },
  paymentMethodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  paymentMethodName: {
    fontSize: 13,
    fontWeight: '600',
  },
  paymentMethodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  paymentMethodBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  formActionsRow: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'space-between',
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
    marginRight: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    marginLeft: 10,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  successIconOuterCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    marginBottom: 20,
  },
  successIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  ticketCard: {
    width: '100%',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 28,
  },
  ticketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  ticketLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  ticketValue: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1.5,
  },
  ticketValueCode: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  doneBtn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },
  heroPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 132, 255, 0.25)',
    backgroundColor: 'rgba(0, 132, 255, 0.08)',
  },
  heroPillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0084FF',
    letterSpacing: 0.8,
  },
  heroSection: {
    marginTop: 2,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 6,
    lineHeight: 28,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  heroMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetricText: {
    fontSize: 11,
    fontWeight: '600',
  },
  searchBoxWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 40,
    padding: 0,
  },
  categoriesRow: {
    marginBottom: 4,
  },
  categoriesContent: {
    paddingRight: 12,
    paddingVertical: 2,
    gap: 8,
    flexDirection: 'row',
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  servicesGrid: {
    marginTop: 4,
  },
  servicesGridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 26,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  categoryHeaderLine: {
    flex: 1,
    height: 1,
    marginLeft: 12,
  },
  slideSignContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
    opacity: 0.8,
  },
  slideSignText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  slideSignIcon: {
    marginLeft: 4,
  },
  horizontalScroll: {
    marginHorizontal: -20,
    paddingLeft: 20,
  },
  horizontalScrollContent: {
    paddingRight: 36,
    paddingVertical: 6,
  },
  horizontalServiceCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    marginRight: CARD_SPACING,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconWrapperCompact: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ratingCountText: {
    fontWeight: '500',
  },
  cardSpacing20: {
    height: 20,
  },
  viewAllCard: {
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1.5,
  },
  viewAllContent: {
    width: '100%',
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  viewAllMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  viewAllText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewAllCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gridTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  gridCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  serviceDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 11,
    color: '#A0A5AD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  bookButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  viewAllTeaserContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  teaserMiniCard: {
    flex: 1,
    marginHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    justifyContent: 'space-between',
  },
  teaserHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  teaserRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teaserRatingText: {
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 2,
  },
  teaserNameText: {
    fontSize: 10,
    fontWeight: '800',
  },
  teaserPriceText: {
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
  },
  heroGlassBox: {
    padding: 16,
    borderRadius: 18,
    marginBottom: 24,
    borderWidth: 1,
  },
  sectionBlock: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  catViewAllHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  catViewAllHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0084FF',
  },
  viewAllDomainsCardWrap: {
    width: '100%',
    marginBottom: 8,
  },
  viewAllDomainsCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
  },
  viewAllDomainsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllDomainsIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  viewAllDomainsTextWrap: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  viewAllDomainsTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  viewAllDomainsSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  viewAllDomainsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  viewAllDomainsActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  viewSwitcherWrap: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  viewSwitcherBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewSwitcherText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardsStack: {
    gap: 14,
  },
  categoryShowcaseCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  catCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  catIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  catBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  catCardTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  catCardDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  catSubsWrap: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  catSubsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catSubsLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  catSubsViewAll: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0084FF',
  },
  subTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  subTagText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subTagMorePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  subTagMoreText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0084FF',
  },
  catCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  catPriceCaption: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  catPriceText: {
    fontSize: 15,
    fontWeight: '800',
  },
  exploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  exploreBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  subcatGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  subcatCard: {
    width: '48%',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  subcatIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  subcatName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  subcatCategoryName: {
    fontSize: 10,
    textAlign: 'center',
    marginBottom: 6,
  },
  subcatPriceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 10,
  },
  subcatPriceLabel: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subcatPriceVal: {
    fontSize: 13,
    fontWeight: '800',
  },
  subcatActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    width: '100%',
  },
  subcatActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  viewAllSubcatBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 14,
  },
  viewAllSubcatText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subcatFilterRow: {
    marginBottom: 14,
  },
  subcatFilterContent: {
    gap: 8,
    flexDirection: 'row',
    paddingVertical: 2,
    paddingRight: 10,
  },
  subcatFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  subcatFilterText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sortPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  sortPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  clearSearchBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  serviceCardItem: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  serviceItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  serviceItemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  serviceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 3,
  },
  modeTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modePillBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  modePillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  ratingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingInlineText: {
    fontSize: 11,
    fontWeight: '700',
  },
  wishlistHeartBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  serviceItemDesc: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  packagesScrollPreview: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  pkgMiniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    marginRight: 6,
  },
  pkgMiniChipName: {
    fontSize: 11,
    fontWeight: '500',
    maxWidth: 90,
  },
  pkgMiniChipPrice: {
    fontSize: 11,
    fontWeight: '700',
  },
  serviceCardItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  servicePriceLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  servicePriceVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  bookNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  bookNowBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  webFooterContainer: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginTop: 10,
    marginBottom: 40,
  },
  footerPromoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  footerPromoText: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '700',
  },
  footerBrandRow: {
    alignItems: 'center',
    marginBottom: 18,
  },
  footerLogo: {
    width: 130,
    height: 38,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  footerBrandDesc: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  newsletterCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  newsletterIconHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  newsletterHeading: {
    fontSize: 14,
    fontWeight: '800',
  },
  newsletterDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
  },
  newsletterSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
  },
  newsletterSuccessText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '700',
  },
  newsletterInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  newsletterInput: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  newsletterBtn: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newsletterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  footerLinksGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 16,
    marginBottom: 14,
  },
  footerCol: {
    flex: 1,
  },
  footerColTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  footerLinkTouch: {
    paddingVertical: 5,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  footerContactInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    marginBottom: 14,
  },
  contactItemTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  contactItemText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footerSocialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 16,
  },
  socialIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerBottomBox: {
    paddingTop: 14,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  footerCopyrightText: {
    fontSize: 11,
    marginBottom: 4,
  },
  footerTermsText: {
    fontSize: 10,
    textAlign: 'center',
  },
  liveToastContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 999,
  },
  liveToastIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveToastTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  liveToastMessage: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  livePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  livePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#30D158',
    marginRight: 4,
  },
  livePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#30D158',
    letterSpacing: 0.5,
  },
});
