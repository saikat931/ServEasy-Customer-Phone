import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';
import { BookingsSkeleton } from '../../components/SkeletonLoader';
import {
  createRazorpayOrderApi,
  verifyRazorpayPaymentApi,
  fetchLiveProviderLocationApi,
  LiveProviderTrackingData,
} from '../../services/api';

export interface BookingExtra {
  id?: string;
  name: string;
  price: number;
  description?: string;
}

export interface BookingItem {
  id: string;
  reference: string;
  serviceName: string;
  packageName: string;
  price: number;
  providerSetAmount?: number;
  platformCharge?: number;
  basePrice?: number;
  date: string;
  time: string;
  address: string;
  status: string; // 'confirmed' | 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled'
  paymentMethod?: string;
  paymentStatus?: 'PAID' | 'PENDING' | 'REFUNDED' | 'COD' | 'UNPAID' | string;
  mode?: 'doorstep' | 'shop';
  rating?: number;
  reviewComment?: string;
  providerName?: string;
  landmark?: string;
  pincode?: string;
  vehicleType?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleRegNo?: string;
  vehicleColor?: string;
  locationType?: string;
  extras?: BookingExtra[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

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

interface BookingsProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  bookings: BookingItem[];
  servicesList: ServiceItem[];
  onCancelBooking: (bookingId: string, serviceName: string, reference: string, reason?: string) => void;
  onEditBooking?: (bookingId: string, data: any) => Promise<{ success: boolean; requiresApproval: boolean; message: string }>;
  onOpenBooking: (service: ServiceItem) => void;
  onAddReview?: (bookingId: string, rating: number, comment: string) => void;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  isLoggedIn?: boolean;
  onOpenAuth?: () => void;
  customerId?: number;
}

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function parseTimeString(tStr: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  if (!tStr) return { hour12: 10, minute: 0, period: 'AM' };
  const match12 = tStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (match12) {
    let h = parseInt(match12[1], 10);
    const m = parseInt(match12[2], 10);
    const p = match12[3] ? (match12[3].toUpperCase() as 'AM' | 'PM') : (h >= 12 ? 'PM' : 'AM');
    if (!match12[3] && h > 12) h -= 12;
    if (h === 0) h = 12;
    return { hour12: h, minute: m, period: p };
  }
  return { hour12: 10, minute: 0, period: 'AM' };
}

function formatTimeDisplay(tStr: string): string {
  const { hour12, minute, period } = parseTimeString(tStr);
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
  return `${pad(hour12)}:${pad(minute)} ${period}`;
}

function parseDateParts(dateStr: string): { year: number; monthIndex: number; day: number } {
  const now = new Date();
  if (!dateStr || typeof dateStr !== 'string') {
    return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
  }
  const clean = dateStr.trim();
  // Try YYYY-MM-DD
  const ymd = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymd) {
    const y = parseInt(ymd[1], 10);
    const m = Math.max(0, Math.min(11, parseInt(ymd[2], 10) - 1));
    const d = parseInt(ymd[3], 10);
    return { year: y, monthIndex: m, day: d };
  }
  // Try DD-MM-YYYY
  const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const d = parseInt(dmy[1], 10);
    const m = Math.max(0, Math.min(11, parseInt(dmy[2], 10) - 1));
    const y = parseInt(dmy[3], 10);
    return { year: y, monthIndex: m, day: d };
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return { year: parsed.getFullYear(), monthIndex: parsed.getMonth(), day: parsed.getDate() };
  }
  return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
}

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const { year, monthIndex, day } = parseDateParts(dateStr);
  const d = new Date(year, monthIndex, day);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export const Bookings = React.memo(function Bookings({
  theme,
  activeTheme,
  bookings,
  servicesList,
  onCancelBooking,
  onEditBooking,
  onOpenBooking,
  onAddReview,
  isLoading,
  refreshing,
  onRefresh,
  isLoggedIn = false,
  onOpenAuth,
  customerId,
}: BookingsProps) {
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsFirstLoad(false), 450);
    return () => clearTimeout(timer);
  }, []);

  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed' | 'cancelled'>('all');

  // Quick View Modal State
  const [quickViewBooking, setQuickViewBooking] = useState<BookingItem | null>(null);
  const [liveTrackingData, setLiveTrackingData] = useState<LiveProviderTrackingData | null>(null);
  const [isFetchingTracking, setIsFetchingTracking] = useState(false);
  const [lastTrackingSync, setLastTrackingSync] = useState<string | null>(null);

  // Review Modal State
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<BookingItem | null>(null);
  const [starRating, setStarRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Cancel Reason Modal State
  const [cancelModalBooking, setCancelModalBooking] = useState<BookingItem | null>(null);
  const [cancelReasonPreset, setCancelReasonPreset] = useState('Change of plans');
  const [cancelReasonText, setCancelReasonText] = useState('');

  // Edit Booking Modal State
  const [editModalBooking, setEditModalBooking] = useState<BookingItem | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editVehicleBrand, setEditVehicleBrand] = useState('');
  const [editVehicleModel, setEditVehicleModel] = useState('');
  const [editVehicleRegNo, setEditVehicleRegNo] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Online Payment Modal State for Unpaid Completed Bookings
  const [payModalBooking, setPayModalBooking] = useState<BookingItem | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Calendar Picker Modal State
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>('');

  // Clock / Time Picker Modal State
  const [showTimePickerModal, setShowTimePickerModal] = useState(false);
  const [clockHour, setClockHour] = useState(10);
  const [clockMinute, setClockMinute] = useState(0);
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>('AM');

  const todayStr = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  const tomorrowStr = useMemo(() => {
    const tmrw = new Date();
    tmrw.setDate(tmrw.getDate() + 1);
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
    return `${tmrw.getFullYear()}-${pad(tmrw.getMonth() + 1)}-${pad(tmrw.getDate())}`;
  }, []);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(y => y - 1);
    } else {
      setCalendarMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(y => y + 1);
    } else {
      setCalendarMonth(m => m + 1);
    }
  };

  const calendarWeeksArray = useMemo(() => {
    const safeYear = !isNaN(calendarYear) ? calendarYear : new Date().getFullYear();
    const safeMonth = !isNaN(calendarMonth) ? Math.max(0, Math.min(11, calendarMonth)) : new Date().getMonth();
    const firstDayIndex = new Date(safeYear, safeMonth, 1).getDay();
    const totalDays = new Date(safeYear, safeMonth + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDayIndex; i++) {
      arr.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      arr.push(d);
    }
    while (arr.length % 7 !== 0) {
      arr.push(null);
    }
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < arr.length; i += 7) {
      weeks.push(arr.slice(i, i + 7));
    }
    return weeks;
  }, [calendarYear, calendarMonth]);

  // Filter bookings (Hook declared unconditionally at top level)
  const filteredBookings = useMemo(() => {
    const list = bookings || [];
    return list.filter(b => {
      const s = (b.status || '').toLowerCase();
      if (activeFilter === 'all') return true;
      if (activeFilter === 'active') return s === 'confirmed' || s === 'pending' || s === 'accepted' || s === 'in_progress';
      if (activeFilter === 'completed') return s === 'completed';
      if (activeFilter === 'cancelled') return s === 'cancelled' || s === 'rejected';
      return true;
    });
  }, [bookings, activeFilter]);

  // Counts for badges (Hook declared unconditionally at top level)
  const counts = useMemo(() => {
    const list = bookings || [];
    return {
      all: list.length,
      active: list.filter(b => {
        const s = (b.status || '').toLowerCase();
        return s === 'confirmed' || s === 'pending' || s === 'accepted' || s === 'in_progress';
      }).length,
      completed: list.filter(b => (b.status || '').toLowerCase() === 'completed').length,
      cancelled: list.filter(b => {
        const s = (b.status || '').toLowerCase();
        return s === 'cancelled' || s === 'rejected';
      }).length,
    };
  }, [bookings]);

  // Auto-sync quickViewBooking with fresh real-time data when bookings list updates
  useEffect(() => {
    if (quickViewBooking) {
      const fresh = bookings.find(b => b.id === quickViewBooking.id);
      if (fresh) {
        setQuickViewBooking(fresh);
      }
    }
  }, [bookings]);

  // Real-Time Technician Live Tracking Poller for Quick View
  useEffect(() => {
    if (!quickViewBooking) {
      setLiveTrackingData(null);
      return;
    }

    const st = (quickViewBooking.status || '').toLowerCase();
    const isTrackable = ['in_progress', 'accepted', 'confirmed', 'on_the_way'].includes(st);

    if (!isTrackable) {
      setLiveTrackingData(null);
      return;
    }

    let isMounted = true;
    const pollTracking = async (showLoading = false) => {
      if (showLoading) setIsFetchingTracking(true);
      try {
        const res = await fetchLiveProviderLocationApi(Number(quickViewBooking.id));
        if (isMounted && res.success && res.data) {
          setLiveTrackingData(res.data);
          setLastTrackingSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        }
      } catch (e) {
        // silent fallback
      } finally {
        if (isMounted && showLoading) setIsFetchingTracking(false);
      }
    };

    pollTracking(true);
    const timer = setInterval(() => {
      pollTracking(false);
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [quickViewBooking?.id, quickViewBooking?.status]);

  const handleManualRefreshTracking = async () => {
    if (!quickViewBooking) return;
    setIsFetchingTracking(true);
    try {
      const res = await fetchLiveProviderLocationApi(Number(quickViewBooking.id));
      if (res.success && res.data) {
        setLiveTrackingData(res.data);
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setLastTrackingSync(timeStr);
        Alert.alert('Tracker Synced 📍', `Technician location updated at ${timeStr}.`);
      } else {
        Alert.alert('Tracking Notice', res.message || 'Technician location not yet available.');
      }
    } finally {
      setIsFetchingTracking(false);
    }
  };

  const handleOpenLiveRoute = (tracking: LiveProviderTrackingData) => {
    if (!tracking.latitude || !tracking.longitude) {
      Alert.alert('Location Pending', 'Technician GPS coordinates have not been received yet.');
      return;
    }
    const origin = `${tracking.latitude},${tracking.longitude}`;
    const dest = (tracking.customer_lat && tracking.customer_lng)
      ? `${tracking.customer_lat},${tracking.customer_lng}`
      : encodeURIComponent(tracking.customer_address || quickViewBooking?.address || '');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Map Error', 'Unable to open Google Maps app.');
    });
  };

  if (isFirstLoad || isLoading) {
    return <BookingsSkeleton theme={theme} activeTheme={activeTheme} />;
  }

  const getStatusMeta = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'completed':
        return { label: 'COMPLETED', color: '#30D158', bg: 'rgba(48, 209, 88, 0.12)', icon: 'check-circle-outline' as const };
      case 'cancelled':
      case 'rejected':
        return { label: 'CANCELLED', color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.12)', icon: 'close-circle-outline' as const };
      case 'in_progress':
        return { label: 'IN PROGRESS', color: '#AF52DE', bg: 'rgba(175, 82, 222, 0.12)', icon: 'progress-clock' as const };
      case 'accepted':
        return { label: 'ACCEPTED', color: '#0084FF', bg: 'rgba(0, 132, 255, 0.12)', icon: 'calendar-check' as const };
      case 'confirmed':
        return { label: 'CONFIRMED', color: '#0084FF', bg: 'rgba(0, 132, 255, 0.12)', icon: 'calendar-check' as const };
      case 'pending':
      default:
        return { label: 'PENDING', color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.12)', icon: 'clock-outline' as const };
    }
  };

  const getPaymentMeta = (paymentStatus?: string, paymentMethod?: string) => {
    const ps = (paymentStatus || '').toUpperCase();
    const pm = (paymentMethod || '').toUpperCase();
    if (ps === 'PAID') {
      return { label: 'PAID', color: '#30D158', bg: 'rgba(48, 209, 88, 0.12)' };
    }
    if (ps === 'REFUNDED') {
      return { label: 'REFUNDED', color: '#A0AEC0', bg: 'rgba(160, 174, 192, 0.12)' };
    }
    if (ps === 'UNPAID' || !ps || ps === 'PENDING') {
      return { label: 'UNPAID', color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.12)' };
    }
    if (ps === 'COD' || pm === 'COD') {
      return { label: 'COD', color: '#0084FF', bg: 'rgba(0, 132, 255, 0.12)' };
    }
    return { label: ps || 'UNPAID', color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.12)' };
  };

  const handleOpenCancelModal = (booking: BookingItem) => {
    setCancelModalBooking(booking);
    setCancelReasonPreset('Change of plans');
    setCancelReasonText('');
  };

  const handleConfirmCancel = () => {
    if (!cancelModalBooking) return;
    const finalReason = cancelReasonText.trim() || cancelReasonPreset;
    const b = cancelModalBooking;
    setCancelModalBooking(null);
    onCancelBooking(b.id, b.serviceName, b.reference, finalReason);
    Alert.alert('Booking Cancelled', `Booking Ref: #${b.reference} has been cancelled.`);
  };

  const handleOpenEditModal = (booking: BookingItem) => {
    setEditModalBooking(booking);
    setEditDate(booking.date || '');
    setEditTime(booking.time || '');
    setEditAddress(booking.address || '');
    setEditNotes(booking.notes || '');
    setEditVehicleBrand(booking.vehicleBrand || '');
    setEditVehicleModel(booking.vehicleModel || '');
    setEditVehicleRegNo(booking.vehicleRegNo || '');

    // Synchronize Calendar View safely
    const { year, monthIndex } = parseDateParts(booking.date || '');
    setCalendarYear(year);
    setCalendarMonth(monthIndex);
    setSelectedCalendarDate(booking.date || todayStr);

    // Synchronize Clock View
    const { hour12, minute, period } = parseTimeString(booking.time || '10:00:00');
    setClockHour(hour12);
    setClockMinute(minute);
    setClockPeriod(period);
  };

  const handleSaveEdit = async () => {
    if (!editModalBooking) return;
    if (!editDate.trim() || !editTime.trim() || !editAddress.trim()) {
      Alert.alert('Missing Details', 'Date, Time, and Address are required.');
      return;
    }
    if (!onEditBooking) {
      Alert.alert('Notice', 'Edit handler is not available.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const res = await onEditBooking(editModalBooking.id, {
        schedule_date: editDate.trim(),
        schedule_time: editTime.trim(),
        address: editAddress.trim(),
        notes: editNotes.trim(),
        vehicle_brand: editVehicleBrand.trim(),
        vehicle_model: editVehicleModel.trim(),
        vehicle_reg_no: editVehicleRegNo.trim(),
      });

      setEditModalBooking(null);
      if (res.success) {
        if (res.requiresApproval) {
          Alert.alert(
            'Reschedule Request Sent',
            'Because you changed the schedule time or address, this booking has been sent back to your service provider for real-time live approval.'
          );
        } else {
          Alert.alert('Booking Updated', 'Your booking details have been successfully updated.');
        }
      } else {
        Alert.alert('Update Failed', res.message || 'Unable to update booking.');
      }
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleOpenPayModal = (booking: BookingItem) => {
    setPayModalBooking(booking);
  };

  const handleProcessOnlinePayment = async () => {
    if (!payModalBooking) return;
    setIsProcessingPayment(true);
    try {
      const bookingId = parseInt(payModalBooking.id, 10);
      const amount = payModalBooking.price;
      const orderRes = await createRazorpayOrderApi(bookingId, amount);
      if (!orderRes.success || !orderRes.order_id) {
        Alert.alert('Payment Error', orderRes.message || 'Could not initiate online payment order.');
        return;
      }
      const verifyRes = await verifyRazorpayPaymentApi(bookingId, orderRes.order_id, 'pay_mock_' + Date.now(), 'mock_sig_dev', customerId || 8);
      if (verifyRes.success) {
        Alert.alert('Payment Successful! 🎉', `Online payment for booking #${payModalBooking.reference} was completed successfully.`);
        setPayModalBooking(null);
        if (onRefresh) {
          onRefresh();
        }
      } else {
        Alert.alert('Verification Failed', verifyRes.message || 'Payment could not be verified.');
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'An error occurred during payment processing.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleRebookPress = (booking: BookingItem) => {
    const matched = servicesList.find(s => s.name.toLowerCase() === booking.serviceName.toLowerCase());
    if (matched) {
      onOpenBooking(matched);
    } else {
      Alert.alert('Rebook', `Selected service: ${booking.serviceName}`);
    }
  };

  const handleOpenReviewModal = (booking: BookingItem) => {
    setSelectedBookingForReview(booking);
    setStarRating(booking.rating || 5);
    setReviewComment(booking.reviewComment || '');
    setReviewModalVisible(true);
  };

  const handleSubmitReview = () => {
    if (!selectedBookingForReview) return;
    if (onAddReview) {
      onAddReview(selectedBookingForReview.id, starRating, reviewComment.trim());
    }
    setReviewModalVisible(false);
    Alert.alert('Review Submitted', 'Thank you! Your verified rating and feedback have been published.');
  };

  return (
    <>
      <ScrollView
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
        <View style={styles.tabHeaderContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[styles.tabMainTitle, { color: activeTheme.textPrimary }]}>My Bookings</Text>
            <View style={styles.liveSyncBadge}>
              <View style={styles.liveSyncDot} />
              <Text style={styles.liveSyncText}>LIVE SYNC</Text>
            </View>
          </View>
          <Text style={[styles.tabSubtitle, { color: activeTheme.textSecondary }]}>
            Track and manage your active and past service requests. Tap Quick View for full booking details.
          </Text>

          {/* STATUS FILTER PILLS */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.pillsScroll}
            contentContainerStyle={styles.pillsContent}
          >
            {STATUS_FILTERS.map(f => {
              const isActive = activeFilter === f.key;
              const count = counts[f.key as keyof typeof counts];
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setActiveFilter(f.key as any)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isActive ? activeTheme.pillActiveBg : activeTheme.pillInactiveBg,
                      borderColor: isActive ? '#0084FF' : activeTheme.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: isActive ? activeTheme.pillActiveText : activeTheme.pillInactiveText },
                    ]}
                  >
                    {f.label} ({count})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {!isLoggedIn ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-lock-outline" size={54} color={activeTheme.textSecondary} />
            <Text style={[styles.emptyText, { color: activeTheme.textPrimary, fontWeight: '700', fontSize: 16, marginTop: 12 }]}>
              Sign In to View Bookings
            </Text>
            <Text style={{ color: activeTheme.textSecondary, textAlign: 'center', marginTop: 6, marginBottom: 20, fontSize: 13, lineHeight: 18, paddingHorizontal: 20 }}>
              Log in to track your service progress, past orders, and instant technician updates.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#0084FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
              onPress={onOpenAuth}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>SIGN IN / REGISTER</Text>
            </TouchableOpacity>
          </View>
        ) : filteredBookings.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="calendar-blank" size={48} color={activeTheme.textSecondary} />
            <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>
              {activeFilter === 'all'
                ? 'No bookings found'
                : `No ${activeFilter} bookings found`}
            </Text>
          </View>
        ) : (
          filteredBookings.map(booking => {
            const s = (booking.status || '').toLowerCase();
            const isCompleted = s === 'completed';
            const canCancel = s === 'confirmed' || s === 'pending' || s === 'accepted';
            const statusMeta = getStatusMeta(booking.status);
            const paymentMeta = getPaymentMeta(booking.paymentStatus, booking.paymentMethod);

            return (
              <GlassCard
                key={booking.id}
                theme={theme}
                style={styles.dashboardCard}
                intensity={activeTheme.glassIntensity}
              >
                {/* 1. COMPACT CARD HEADER: Ref + Badges */}
                <View style={styles.dashboardHeader}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <Text style={[styles.bookingRefText, { color: activeTheme.textPrimary }]}>
                      #{booking.reference}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    {/* Payment Status Badge (e.g. COD / PAID / UNPAID) */}
                    <View
                      style={[
                        styles.miniBadge,
                        {
                          backgroundColor: paymentMeta.bg,
                          borderColor: paymentMeta.color,
                        },
                      ]}
                    >
                      <Text style={[styles.miniBadgeText, { color: paymentMeta.color }]}>
                        {paymentMeta.label}
                      </Text>
                    </View>

                    {/* Booking Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: statusMeta.bg,
                          borderColor: statusMeta.color,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusMeta.color }]}>
                        {statusMeta.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Subtle Compact Divider */}
                <View
                  style={[
                    styles.categoryHeaderLine,
                    { backgroundColor: activeTheme.cardBorder, marginVertical: 8 },
                  ]}
                />

                {/* 2. COMPACT SERVICE & PACKAGE ROW */}
                <View style={styles.compactServiceRow}>
                  <MaterialCommunityIcons
                    name="briefcase-outline"
                    size={15}
                    color="#0084FF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.compactServiceName, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                    {booking.serviceName}
                    {booking.packageName ? (
                      <Text style={{ fontWeight: '500', color: activeTheme.textSecondary }}> • {booking.packageName}</Text>
                    ) : null}
                  </Text>
                </View>

                {/* 3. ASSIGNED PROVIDER (IF PRESENT) */}
                {booking.providerName ? (
                  <View style={styles.compactMetaRow}>
                    <MaterialCommunityIcons
                      name="account-check-outline"
                      size={14}
                      color={activeTheme.iconColor}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.compactMetaText, { color: activeTheme.textSecondary }]} numberOfLines={1}>
                      Provider: <Text style={{ color: activeTheme.textPrimary, fontWeight: '600' }}>{booking.providerName}</Text>
                    </Text>
                  </View>
                ) : null}

                {/* 4. SCHEDULE & TOTAL PRICE (SIDE-BY-SIDE 2-COLUMN) */}
                <View style={styles.compactBottomInfoRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                    <MaterialCommunityIcons
                      name="clock-outline"
                      size={14}
                      color={activeTheme.iconColor}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[styles.compactMetaText, { color: activeTheme.textSecondary }]} numberOfLines={1}>
                      {booking.date} • {booking.time}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.compactPriceText, { color: '#30D158' }]}>
                      {booking.price > 0 ? `₹${booking.price}` : 'Free Dispatch'}
                    </Text>
                  </View>
                </View>

                {/* 5. RATING DISPLAY (IF REVIEWED) */}
                {booking.rating ? (
                  <View
                    style={[
                      styles.compactReviewedBox,
                      { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <MaterialCommunityIcons
                          key={star}
                          name={star <= (booking.rating || 0) ? 'star' : 'star-outline'}
                          size={12}
                          color="#FFD700"
                        />
                      ))}
                    </View>
                    {booking.reviewComment ? (
                      <Text style={[styles.compactReviewedComment, { color: activeTheme.textSecondary }]} numberOfLines={1}>
                        "{booking.reviewComment}"
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* 6. COMPACT ACTION BUTTONS ROW */}
                <View style={styles.cardActionsRow}>
                  {/* Live Tracking shortcut for in-progress bookings */}
                  {(booking.status || '').toLowerCase() === 'in_progress' && (
                    <TouchableOpacity
                      style={[
                        styles.quickViewCardBtn,
                        {
                          backgroundColor: 'rgba(48, 209, 88, 0.15)',
                          borderColor: '#30D158',
                        },
                      ]}
                      onPress={() => setQuickViewBooking(booking)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="crosshairs-gps" size={14} color="#30D158" style={{ marginRight: 4 }} />
                      <Text style={[styles.quickViewCardBtnText, { color: '#30D158' }]}>TRACK GPS</Text>
                    </TouchableOpacity>
                  )}

                  {/* Dedicated Quick View button for every booking item */}
                  <TouchableOpacity
                    style={[
                      styles.quickViewCardBtn,
                      {
                        backgroundColor: 'rgba(0, 132, 255, 0.12)',
                        borderColor: '#0084FF',
                      },
                    ]}
                    onPress={() => setQuickViewBooking(booking)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="eye-outline" size={14} color="#0084FF" style={{ marginRight: 4 }} />
                    <Text style={[styles.quickViewCardBtnText, { color: '#0084FF' }]}>QUICK VIEW</Text>
                  </TouchableOpacity>

                  {/* Status specific contextual actions */}
                  {canCancel ? (
                    <View style={{ flexDirection: 'row', gap: 6, flex: 1.6 }}>
                      <TouchableOpacity
                        style={[
                          styles.editCardBtn,
                          {
                            borderColor: '#AF52DE',
                            backgroundColor: 'rgba(175, 82, 222, 0.12)',
                          },
                        ]}
                        onPress={() => handleOpenEditModal(booking)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={13} color="#AF52DE" style={{ marginRight: 3 }} />
                        <Text style={[styles.editCardBtnText, { color: '#AF52DE' }]}>EDIT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.cancelCardBtn,
                          { borderColor: '#FF3B30', backgroundColor: 'rgba(255, 59, 48, 0.1)' },
                        ]}
                        onPress={() => handleOpenCancelModal(booking)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="close-circle-outline" size={13} color="#FF3B30" style={{ marginRight: 3 }} />
                        <Text style={[styles.cancelCardBtnText, { color: '#FF3B30' }]}>CANCEL</Text>
                      </TouchableOpacity>
                    </View>
                  ) : isCompleted ? (
                    <View style={{ flexDirection: 'row', gap: 6, flex: 1.6 }}>
                      {booking.paymentStatus !== 'PAID' ? (
                        <TouchableOpacity
                          style={[
                            styles.rateButton,
                            { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)', flex: 1 },
                          ]}
                          onPress={() => handleOpenPayModal(booking)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="credit-card-outline" size={13} color="#10B981" style={{ marginRight: 3 }} />
                          <Text style={[styles.rateButtonText, { color: '#10B981', fontWeight: '700' }]}>PAY ONLINE</Text>
                        </TouchableOpacity>
                      ) : null}

                      {!booking.rating ? (
                        <TouchableOpacity
                          style={[
                            styles.rateButton,
                            { borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.1)', flex: 1 },
                          ]}
                          onPress={() => handleOpenReviewModal(booking)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="star-outline" size={13} color="#FFD700" style={{ marginRight: 3 }} />
                          <Text style={[styles.rateButtonText, { color: '#FFD700' }]}>REVIEW</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════════════
          QUICK VIEW MODAL: Shows complete booking specifications
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!quickViewBooking}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQuickViewBooking(null)}
      >
        <View style={styles.modalOverlay}>
          {quickViewBooking && (
            <View style={[styles.quickViewModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
              {/* Modal Top Header */}
              <View style={styles.quickViewHeader}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="clipboard-text-search-outline" size={20} color="#0084FF" />
                    <Text style={[styles.quickViewTitle, { color: activeTheme.textPrimary }]}>Booking Quick View</Text>
                  </View>
                  <Text style={[styles.quickViewSubtitle, { color: activeTheme.textSecondary }]}>
                    Ref: #{quickViewBooking.reference}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setQuickViewBooking(null)}
                  style={[styles.closeIconBtn, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <MaterialCommunityIcons name="close" size={20} color={activeTheme.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                showsVerticalScrollIndicator={false}
                style={styles.quickViewScroll}
                contentContainerStyle={{ paddingBottom: 20 }}
              >
                {/* Ribbon Badges */}
                <View style={styles.quickViewRibbon}>
                  {(() => {
                    const sm = getStatusMeta(quickViewBooking.status);
                    return (
                      <View style={[styles.quickViewPill, { backgroundColor: sm.bg, borderColor: sm.color }]}>
                        <MaterialCommunityIcons name={sm.icon} size={13} color={sm.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.quickViewPillText, { color: sm.color }]}>{sm.label}</Text>
                      </View>
                    );
                  })()}

                  {(() => {
                    const pm = getPaymentMeta(quickViewBooking.paymentStatus, quickViewBooking.paymentMethod);
                    return (
                      <View style={[styles.quickViewPill, { backgroundColor: pm.bg, borderColor: pm.color }]}>
                        <MaterialCommunityIcons name="credit-card-outline" size={13} color={pm.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.quickViewPillText, { color: pm.color }]}>{pm.label}</Text>
                      </View>
                    );
                  })()}

                  <View style={[styles.quickViewPill, { backgroundColor: 'rgba(0, 132, 255, 0.08)', borderColor: activeTheme.cardBorder }]}>
                    <MaterialCommunityIcons
                      name={quickViewBooking.mode === 'shop' ? 'store-outline' : 'truck-delivery-outline'}
                      size={13}
                      color={activeTheme.iconColor}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.quickViewPillText, { color: activeTheme.textPrimary }]}>
                      {quickViewBooking.mode === 'shop' ? 'In-Shop Service' : 'Doorstep Dispatch'}
                    </Text>
                  </View>
                </View>

                {/* 1. Service & Pricing Section */}
                <View style={[styles.quickViewSectionCard, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                  <View style={styles.quickViewSectionHeader}>
                    <MaterialCommunityIcons name="briefcase-outline" size={17} color="#0084FF" style={{ marginRight: 6 }} />
                    <Text style={[styles.quickViewSectionTitle, { color: activeTheme.textPrimary }]}>Service Information</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.quickViewServiceName, { color: activeTheme.textPrimary }]}>
                        {quickViewBooking.serviceName}
                      </Text>
                      <Text style={[styles.quickViewPackageName, { color: activeTheme.textSecondary }]}>
                        Package: {quickViewBooking.packageName || 'Standard Service'}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.quickViewPriceLabel, { color: activeTheme.textSecondary }]}>Total Price</Text>
                      <Text style={[styles.quickViewPriceValue, { color: '#30D158' }]}>
                        {quickViewBooking.price > 0 ? `₹${quickViewBooking.price}` : 'Free'}
                      </Text>
                    </View>
                  </View>

                  {/* Provider Info Box */}
                  <View style={[styles.quickViewProviderBox, { borderColor: activeTheme.cardBorder }]}>
                    <MaterialCommunityIcons name="account-check-outline" size={18} color="#0084FF" style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.quickViewProviderLabel, { color: activeTheme.textSecondary }]}>Assigned Professional</Text>
                      <Text style={[styles.quickViewProviderName, { color: activeTheme.textPrimary }]}>
                        {quickViewBooking.providerName || 'ServEasy Verified Partner'}
                      </Text>
                    </View>
                    <View style={styles.verifiedTag}>
                      <MaterialCommunityIcons name="check-decagram" size={13} color="#30D158" style={{ marginRight: 3 }} />
                      <Text style={styles.verifiedTagText}>VERIFIED</Text>
                    </View>
                  </View>
                </View>

                {/* 1b. Real-Time Technician Live Tracking Card (Active Jobs) */}
                {['in_progress', 'accepted', 'confirmed', 'on_the_way'].includes((quickViewBooking.status || '').toLowerCase()) && (
                  <View
                    style={[
                      styles.quickViewSectionCard,
                      {
                        backgroundColor: 'rgba(48, 209, 88, 0.08)',
                        borderColor: 'rgba(48, 209, 88, 0.4)',
                      },
                    ]}
                  >
                    <View style={styles.quickViewSectionHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#30D158" style={{ marginRight: 6 }} />
                        <Text style={[styles.quickViewSectionTitle, { color: '#30D158' }]}>
                          Technician Live Tracking
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: 'rgba(48, 209, 88, 0.2)',
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 12,
                          gap: 4,
                        }}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#30D158' }} />
                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#30D158', letterSpacing: 0.5 }}>
                          {liveTrackingData?.is_live ? 'LIVE GPS' : 'CONNECTED'}
                        </Text>
                      </View>
                    </View>

                    {/* Distance & ETA Row */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, color: activeTheme.textSecondary, textTransform: 'uppercase', fontWeight: '700' }}>
                          Status & Distance
                        </Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: activeTheme.textPrimary, marginTop: 2 }}>
                          {liveTrackingData?.distance_km != null
                            ? `📍 ${liveTrackingData.distance_km} km away`
                            : (quickViewBooking.status === 'in_progress' ? '🛵 Technician In Progress' : '⚡ Confirmed & Assigned')}
                          {liveTrackingData?.eta_minutes != null ? ` • ~${liveTrackingData.eta_minutes} mins ETA` : ''}
                        </Text>
                      </View>
                      {lastTrackingSync ? (
                        <Text style={{ fontSize: 10, color: activeTheme.textSecondary }}>
                          Updated {lastTrackingSync}
                        </Text>
                      ) : null}
                    </View>

                    {/* Coordinates & Accuracy */}
                    {liveTrackingData?.latitude && liveTrackingData?.longitude ? (
                      <View
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.5)',
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 10,
                          borderWidth: 1,
                          borderColor: 'rgba(255, 255, 255, 0.08)',
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: '#93C5FD', fontWeight: '600' }}>
                            Coordinates: {liveTrackingData.latitude.toFixed(5)}, {liveTrackingData.longitude.toFixed(5)}
                          </Text>
                          {liveTrackingData.accuracy ? (
                            <Text style={{ fontSize: 10, color: '#34D399' }}>
                              ±{Math.round(liveTrackingData.accuracy)}m accuracy
                            </Text>
                          ) : null}
                        </View>
                        {liveTrackingData.speed && liveTrackingData.speed > 0 ? (
                          <Text style={{ fontSize: 10, color: activeTheme.textSecondary, marginTop: 2 }}>
                            Moving at {Math.round(liveTrackingData.speed * 3.6)} km/h
                          </Text>
                        ) : null}
                      </View>
                    ) : (
                      <View
                        style={{
                          backgroundColor: 'rgba(15, 23, 42, 0.4)',
                          borderRadius: 10,
                          padding: 10,
                          marginBottom: 10,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: activeTheme.textSecondary }}>
                          {isFetchingTracking
                            ? '📡 Contacting technician GPS device...'
                            : 'Technician base location established. Waiting for mobile GPS telemetry.'}
                        </Text>
                      </View>
                    )}

                    {/* Action buttons: Open Route in Google Maps & Refresh */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#0084FF',
                          paddingVertical: 9,
                          borderRadius: 10,
                        }}
                        onPress={() => liveTrackingData && handleOpenLiveRoute(liveTrackingData)}
                        disabled={!liveTrackingData?.latitude}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="google-maps" size={15} color="#FFFFFF" />
                        <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '700' }}>
                          Open Live Route
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          backgroundColor: activeTheme.pillInactiveBg,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          borderRadius: 10,
                          borderWidth: 1,
                          borderColor: activeTheme.cardBorder,
                        }}
                        onPress={handleManualRefreshTracking}
                        disabled={isFetchingTracking}
                        activeOpacity={0.7}
                      >
                        {isFetchingTracking ? (
                          <ActivityIndicator size="small" color={activeTheme.textPrimary} />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="refresh" size={15} color={activeTheme.textPrimary} />
                            <Text style={{ color: activeTheme.textPrimary, fontSize: 12, fontWeight: '600' }}>
                              Sync
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* 2. Schedule & Address Section */}
                <View style={[styles.quickViewSectionCard, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                  <View style={styles.quickViewSectionHeader}>
                    <MaterialCommunityIcons name="map-marker-radius-outline" size={17} color="#FF9F0A" style={{ marginRight: 6 }} />
                    <Text style={[styles.quickViewSectionTitle, { color: activeTheme.textPrimary }]}>Schedule & Location</Text>
                  </View>

                  <View style={styles.quickViewRow}>
                    <MaterialCommunityIcons name="calendar-clock" size={16} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Date & Time Slot</Text>
                      <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary }]}>
                        {quickViewBooking.date} at {quickViewBooking.time}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.quickViewRow, { marginTop: 8 }]}>
                    <MaterialCommunityIcons name="home-map-marker" size={16} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Full Address</Text>
                      <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary }]}>
                        {quickViewBooking.address}
                      </Text>
                    </View>
                  </View>

                  {(quickViewBooking.landmark || quickViewBooking.pincode) ? (
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, paddingLeft: 24 }}>
                      {quickViewBooking.landmark ? (
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Landmark</Text>
                          <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary }]}>
                            {quickViewBooking.landmark}
                          </Text>
                        </View>
                      ) : null}
                      {quickViewBooking.pincode ? (
                        <View style={{ width: 100 }}>
                          <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Pincode</Text>
                          <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary }]}>
                            {quickViewBooking.pincode}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {/* 3. Vehicle Information (if applicable) */}
                {(quickViewBooking.vehicleType || quickViewBooking.vehicleRegNo || quickViewBooking.vehicleBrand) ? (
                  <View style={[styles.quickViewSectionCard, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                    <View style={styles.quickViewSectionHeader}>
                      <MaterialCommunityIcons name="car-outline" size={17} color="#AF52DE" style={{ marginRight: 6 }} />
                      <Text style={[styles.quickViewSectionTitle, { color: activeTheme.textPrimary }]}>Vehicle Information</Text>
                    </View>

                    <View style={styles.quickViewGrid}>
                      {quickViewBooking.vehicleType ? (
                        <View style={styles.quickViewGridItem}>
                          <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Vehicle Type</Text>
                          <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary }]}>
                            {quickViewBooking.vehicleType}
                          </Text>
                        </View>
                      ) : null}

                      {(quickViewBooking.vehicleBrand || quickViewBooking.vehicleModel) ? (
                        <View style={styles.quickViewGridItem}>
                          <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Brand & Model</Text>
                          <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary }]}>
                            {quickViewBooking.vehicleBrand || ''} {quickViewBooking.vehicleModel || ''}
                          </Text>
                        </View>
                      ) : null}

                      {quickViewBooking.vehicleRegNo ? (
                        <View style={styles.quickViewGridItem}>
                          <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Registration No</Text>
                          <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary, fontWeight: '700' }]}>
                            {quickViewBooking.vehicleRegNo}
                          </Text>
                        </View>
                      ) : null}

                      {quickViewBooking.vehicleColor ? (
                        <View style={styles.quickViewGridItem}>
                          <Text style={[styles.quickViewRowLabel, { color: activeTheme.textSecondary }]}>Color</Text>
                          <Text style={[styles.quickViewRowValue, { color: activeTheme.textPrimary }]}>
                            {quickViewBooking.vehicleColor}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {/* 4. Add-ons / Extras (if selected) */}
                {quickViewBooking.extras && quickViewBooking.extras.length > 0 ? (
                  <View style={[styles.quickViewSectionCard, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                    <View style={styles.quickViewSectionHeader}>
                      <MaterialCommunityIcons name="puzzle-outline" size={17} color="#30D158" style={{ marginRight: 6 }} />
                      <Text style={[styles.quickViewSectionTitle, { color: activeTheme.textPrimary }]}>
                        Selected Add-Ons ({quickViewBooking.extras.length})
                      </Text>
                    </View>

                    {quickViewBooking.extras.map((ex, idx) => (
                      <View key={idx} style={[styles.extraRowItem, { borderColor: activeTheme.cardBorder }]}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[styles.extraItemName, { color: activeTheme.textPrimary }]}>{ex.name}</Text>
                          {ex.description ? (
                            <Text style={[styles.extraItemDesc, { color: activeTheme.textSecondary }]} numberOfLines={2}>
                              {ex.description}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.extraPriceBadge}>
                          <Text style={styles.extraPriceText}>+₹{ex.price}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null}

                {/* 5. Special Notes */}
                {quickViewBooking.notes ? (
                  <View style={[styles.quickViewSectionCard, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                    <View style={styles.quickViewSectionHeader}>
                      <MaterialCommunityIcons name="note-text-outline" size={17} color={activeTheme.iconColor} style={{ marginRight: 6 }} />
                      <Text style={[styles.quickViewSectionTitle, { color: activeTheme.textPrimary }]}>Notes & Instructions</Text>
                    </View>
                    <Text style={[styles.quickViewNotesText, { color: activeTheme.textPrimary }]}>
                      {quickViewBooking.notes}
                    </Text>
                  </View>
                ) : null}

                {/* 6. Payment Breakdown */}
                <View style={[styles.quickViewSectionCard, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                  <View style={styles.quickViewSectionHeader}>
                    <MaterialCommunityIcons name="receipt" size={17} color="#0084FF" style={{ marginRight: 6 }} />
                    <Text style={[styles.quickViewSectionTitle, { color: activeTheme.textPrimary }]}>Payment Breakdown</Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={[styles.paymentSummaryLabel, { color: activeTheme.textSecondary }]}>Service Provider Amount</Text>
                    <Text style={[styles.paymentSummaryValue, { color: activeTheme.textPrimary, fontWeight: '700' }]}>
                      ₹{quickViewBooking.providerSetAmount != null ? quickViewBooking.providerSetAmount : quickViewBooking.price}
                    </Text>
                  </View>
                  {quickViewBooking.platformCharge != null && quickViewBooking.platformCharge > 0 ? (
                    <View style={styles.paymentSummaryRow}>
                      <Text style={[styles.paymentSummaryLabel, { color: activeTheme.textSecondary }]}>Platform Charge</Text>
                      <Text style={[styles.paymentSummaryValue, { color: '#0084FF', fontWeight: '700' }]}>
                        +₹{quickViewBooking.platformCharge}
                      </Text>
                    </View>
                  ) : null}
                  <View style={styles.paymentSummaryRow}>
                    <Text style={[styles.paymentSummaryLabel, { color: activeTheme.textSecondary }]}>Payment Method</Text>
                    <Text style={[styles.paymentSummaryValue, { color: activeTheme.textPrimary }]}>
                      {quickViewBooking.paymentMethod && quickViewBooking.paymentMethod !== 'NOT_SELECTED' && quickViewBooking.paymentMethod !== 'COD'
                        ? quickViewBooking.paymentMethod
                        : (quickViewBooking.paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'Pay on Completion')}
                    </Text>
                  </View>
                  <View style={styles.paymentSummaryRow}>
                    <Text style={[styles.paymentSummaryLabel, { color: activeTheme.textSecondary }]}>Payment Status</Text>
                    <Text style={[styles.paymentSummaryValue, { color: quickViewBooking.paymentStatus === 'PAID' ? '#30D158' : '#FF9F0A' }]}>
                      {quickViewBooking.paymentStatus || 'Pending'}
                    </Text>
                  </View>
                  <View style={[styles.paymentDivider, { backgroundColor: activeTheme.cardBorder }]} />
                  <View style={styles.paymentSummaryRow}>
                    <Text style={[styles.paymentTotalLabel, { color: activeTheme.textPrimary }]}>Total Amount (Paid by Customer)</Text>
                    <Text style={[styles.paymentTotalValue, { color: '#30D158' }]}>
                      ₹{quickViewBooking.price}
                    </Text>
                  </View>
                </View>

                {/* 7. Rating & Review Box */}
                {quickViewBooking.rating ? (
                  <View style={[styles.quickViewSectionCard, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                    <View style={styles.quickViewSectionHeader}>
                      <MaterialCommunityIcons name="star" size={17} color="#FFD700" style={{ marginRight: 6 }} />
                      <Text style={[styles.quickViewSectionTitle, { color: activeTheme.textPrimary }]}>Customer Review</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <MaterialCommunityIcons
                          key={star}
                          name={star <= (quickViewBooking.rating || 0) ? 'star' : 'star-outline'}
                          size={16}
                          color="#FFD700"
                        />
                      ))}
                      <Text style={[{ marginLeft: 8, fontSize: 13, fontWeight: '700', color: activeTheme.textPrimary }]}>
                        {quickViewBooking.rating}.0 / 5.0
                      </Text>
                    </View>
                    {quickViewBooking.reviewComment ? (
                      <Text style={[styles.reviewedComment, { color: activeTheme.textPrimary, marginTop: 4 }]}>
                        "{quickViewBooking.reviewComment}"
                      </Text>
                    ) : null}
                  </View>
                ) : null}

                {/* 8. Timestamp info */}
                {quickViewBooking.createdAt ? (
                  <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
                    <Text style={{ fontSize: 11, color: activeTheme.textSecondary }}>
                      Requested on: {quickViewBooking.createdAt}
                    </Text>
                  </View>
                ) : null}

                {/* 9. Modal Bottom Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  {quickViewBooking.status === 'confirmed' || quickViewBooking.status === 'pending' || quickViewBooking.status === 'accepted' ? (
                    <>
                      <TouchableOpacity
                        style={[styles.quickViewEditBtn, { borderColor: '#AF52DE', backgroundColor: 'rgba(175, 82, 222, 0.12)' }]}
                        onPress={() => {
                          const b = quickViewBooking;
                          setQuickViewBooking(null);
                          handleOpenEditModal(b);
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={15} color="#AF52DE" style={{ marginRight: 5 }} />
                        <Text style={[styles.quickViewEditBtnText, { color: '#AF52DE' }]}>EDIT</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickViewCancelBtn, { borderColor: '#FF3B30', backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}
                        onPress={() => {
                          const b = quickViewBooking;
                          setQuickViewBooking(null);
                          handleOpenCancelModal(b);
                        }}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons name="close-circle-outline" size={15} color="#FF3B30" style={{ marginRight: 5 }} />
                        <Text style={[styles.quickViewCancelBtnText, { color: '#FF3B30' }]}>CANCEL</Text>
                      </TouchableOpacity>
                    </>
                  ) : quickViewBooking.status === 'completed' ? (
                    <>
                      {quickViewBooking.paymentStatus !== 'PAID' ? (
                        <TouchableOpacity
                          style={[styles.quickViewRateBtn, { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.15)', flex: 1.2 }]}
                          onPress={() => {
                            const b = quickViewBooking;
                            setQuickViewBooking(null);
                            handleOpenPayModal(b);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="credit-card-outline" size={15} color="#10B981" style={{ marginRight: 5 }} />
                          <Text style={[styles.quickViewRateBtnText, { color: '#10B981', fontWeight: '700' }]}>PAY ONLINE</Text>
                        </TouchableOpacity>
                      ) : null}

                      {!quickViewBooking.rating ? (
                        <TouchableOpacity
                          style={[styles.quickViewRateBtn, { borderColor: '#FFD700', backgroundColor: 'rgba(255, 215, 0, 0.1)' }]}
                          onPress={() => {
                            const b = quickViewBooking;
                            setQuickViewBooking(null);
                            handleOpenReviewModal(b);
                          }}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons name="star-outline" size={15} color="#FFD700" style={{ marginRight: 5 }} />
                          <Text style={[styles.quickViewRateBtnText, { color: '#FFD700' }]}>RATE SERVICE</Text>
                        </TouchableOpacity>
                      ) : null}
                    </>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.quickViewDismissBtn, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.pillInactiveBg }]}
                    onPress={() => setQuickViewBooking(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.quickViewDismissBtnText, { color: activeTheme.textPrimary }]}>CLOSE</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════
          RATING & REVIEW MODAL
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={reviewModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.reviewModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
            <View style={styles.reviewModalHeader}>
              <View>
                <Text style={[styles.reviewModalTitle, { color: activeTheme.textPrimary }]}>Rate Your Service</Text>
                <Text style={[styles.reviewModalSubtitle, { color: activeTheme.textSecondary }]}>
                  {selectedBookingForReview?.serviceName}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setReviewModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* STAR RATING PICKER */}
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setStarRating(star)}
                  style={{ padding: 6 }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons
                    name={star <= starRating ? 'star' : 'star-outline'}
                    size={34}
                    color="#FFD700"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.ratingScoreText, { color: activeTheme.textSecondary }]}>
              {starRating === 5
                ? 'Outstanding Experience! ★★★★★'
                : starRating === 4
                ? 'Very Good Service ★★★★☆'
                : starRating === 3
                ? 'Average Quality ★★★☆☆'
                : starRating === 2
                ? 'Needs Improvement ★★☆☆☆'
                : 'Poor Experience ★☆☆☆☆'}
            </Text>

            {/* REVIEW COMMENT INPUT */}
            <View style={[styles.reviewInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <TextInput
                value={reviewComment}
                onChangeText={setReviewComment}
                placeholder="Share details of your experience (technician punctuality, hygiene, work quality)..."
                placeholderTextColor={activeTheme.textSecondary}
                multiline={true}
                numberOfLines={3}
                style={[styles.reviewTextInput, { color: activeTheme.textPrimary }]}
              />
            </View>

            {/* MODAL ACTION BUTTONS */}
            <View style={styles.reviewModalActions}>
              <TouchableOpacity
                style={[styles.cancelReviewBtn, { borderColor: activeTheme.cardBorder }]}
                onPress={() => setReviewModalVisible(false)}
              >
                <Text style={[styles.cancelReviewBtnText, { color: activeTheme.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitReviewBtn, { backgroundColor: activeTheme.accentBtnBg }]}
                onPress={handleSubmitReview}
              >
                <Text style={styles.submitReviewBtnText}>SUBMIT REVIEW</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════
          CANCEL BOOKING WITH VALID REASON MODAL
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!cancelModalBooking}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setCancelModalBooking(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          {cancelModalBooking && (
            <View style={[styles.customModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
              {/* Header */}
              <View style={styles.customModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.customModalTitle, { color: '#FF3B30' }]}>Cancel Booking</Text>
                  <Text style={[styles.customModalSubtitle, { color: activeTheme.textSecondary }]}>
                    Ref: #{cancelModalBooking.reference} • {cancelModalBooking.serviceName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setCancelModalBooking(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.modalSectionHeading, { color: activeTheme.textPrimary }]}>
                Select a reason for cancellation:
              </Text>

              {/* Preset Reason Chips */}
              <View style={styles.reasonsGrid}>
                {[
                  'Change of plans',
                  'Booked by mistake',
                  'Incorrect date or time',
                  'Found alternative service',
                  'Price too high',
                  'Other reason',
                ].map((reason) => {
                  const isSelected = cancelReasonPreset === reason;
                  return (
                    <TouchableOpacity
                      key={reason}
                      style={[
                        styles.reasonChip,
                        {
                          backgroundColor: isSelected ? 'rgba(255, 59, 48, 0.15)' : activeTheme.pillInactiveBg,
                          borderColor: isSelected ? '#FF3B30' : activeTheme.cardBorder,
                        },
                      ]}
                      onPress={() => setCancelReasonPreset(reason)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons
                        name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={14}
                        color={isSelected ? '#FF3B30' : activeTheme.textSecondary}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.reasonChipText,
                          { color: isSelected ? '#FF3B30' : activeTheme.textPrimary, fontWeight: isSelected ? '700' : '500' },
                        ]}
                      >
                        {reason}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Optional detailed explanation text box */}
              <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary, marginTop: 10 }]}>
                Additional notes / remarks (optional):
              </Text>
              <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                <TextInput
                  value={cancelReasonText}
                  onChangeText={setCancelReasonText}
                  placeholder="Specify any additional cancellation details..."
                  placeholderTextColor={activeTheme.textSecondary}
                  multiline={true}
                  numberOfLines={2}
                  style={[styles.modalTextInput, { color: activeTheme.textPrimary }]}
                />
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalSecondaryBtn, { borderColor: activeTheme.cardBorder }]}
                  onPress={() => setCancelModalBooking(null)}
                >
                  <Text style={[styles.modalSecondaryBtnText, { color: activeTheme.textSecondary }]}>KEEP BOOKING</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimaryDangerBtn, { backgroundColor: '#FF3B30' }]}
                  onPress={handleConfirmCancel}
                >
                  <MaterialCommunityIcons name="close-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={styles.modalPrimaryDangerBtnText}>CONFIRM CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════
          EDIT BOOKING DETAILS MODAL (WITH LIVE RE-APPROVAL LOGIC)
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!editModalBooking}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalBooking(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          {editModalBooking && (
            <View style={[styles.editModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
              {/* Header */}
              <View style={styles.customModalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.customModalTitle, { color: activeTheme.textPrimary }]}>Edit Booking</Text>
                  <Text style={[styles.customModalSubtitle, { color: activeTheme.textSecondary }]}>
                    Ref: #{editModalBooking.reference} • {editModalBooking.serviceName}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setEditModalBooking(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Informational Banner */}
              <View style={[styles.noticeBanner, { backgroundColor: 'rgba(255, 159, 10, 0.12)', borderColor: 'rgba(255, 159, 10, 0.35)' }]}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#FF9F0A" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={[styles.noticeBannerText, { color: '#FF9F0A' }]}>
                  Notice: Normal detail updates save immediately. If you change the Schedule Date, Time, or Address, this booking will be re-submitted to the service provider for live re-approval.
                </Text>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380, marginVertical: 8 }}>
                {/* Sensitive Fields (Require Re-Approval) */}
                <Text style={[styles.formSectionHeader, { color: '#0084FF' }]}>
                  Schedule & Location (Triggers Live Re-approval)
                </Text>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {/* DATE SELECTOR (TAP TO OPEN CALENDAR) */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Date (Tap for Calendar) *</Text>
                    <TouchableOpacity
                      style={[
                        styles.pickerInputBtn,
                        { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder },
                      ]}
                      onPress={() => {
                        const { year, monthIndex } = parseDateParts(editDate || '');
                        setCalendarYear(year);
                        setCalendarMonth(monthIndex);
                        setSelectedCalendarDate(editDate || todayStr);
                        setShowDatePickerModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.singleTextInput,
                          { color: editDate ? activeTheme.textPrimary : activeTheme.textSecondary, flex: 1 },
                        ]}
                        numberOfLines={1}
                      >
                        {editDate ? formatDateDisplay(editDate) : 'Select Date'}
                      </Text>
                      <MaterialCommunityIcons name="calendar-month-outline" size={18} color="#0084FF" />
                    </TouchableOpacity>
                  </View>

                  {/* TIME SELECTOR (TAP TO OPEN CLOCK) */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Time (Tap for Clock) *</Text>
                    <TouchableOpacity
                      style={[
                        styles.pickerInputBtn,
                        { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder },
                      ]}
                      onPress={() => {
                        const { hour12, minute, period } = parseTimeString(editTime || '10:00:00');
                        setClockHour(hour12);
                        setClockMinute(minute);
                        setClockPeriod(period);
                        setShowTimePickerModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.singleTextInput,
                          { color: editTime ? activeTheme.textPrimary : activeTheme.textSecondary, flex: 1 },
                        ]}
                      >
                        {editTime ? formatTimeDisplay(editTime) : 'Select Time'}
                      </Text>
                      <MaterialCommunityIcons name="clock-time-four-outline" size={18} color="#30D158" />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary, marginTop: 8 }]}>Address / Location *</Text>
                <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, minHeight: 60 }]}>
                  <TextInput
                    value={editAddress}
                    onChangeText={setEditAddress}
                    placeholder="Enter complete address..."
                    placeholderTextColor={activeTheme.textSecondary}
                    multiline={true}
                    numberOfLines={2}
                    style={[styles.modalTextInput, { color: activeTheme.textPrimary }]}
                  />
                </View>

                {/* Normal Fields (Direct Update) */}
                <Text style={[styles.formSectionHeader, { color: '#30D158', marginTop: 14 }]}>
                  Vehicle & Notes (Direct Update)
                </Text>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Brand</Text>
                    <View style={[styles.singleInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                      <TextInput
                        value={editVehicleBrand}
                        onChangeText={setEditVehicleBrand}
                        placeholder="e.g. Honda"
                        placeholderTextColor={activeTheme.textSecondary}
                        style={[styles.singleTextInput, { color: activeTheme.textPrimary }]}
                      />
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Model</Text>
                    <View style={[styles.singleInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                      <TextInput
                        value={editVehicleModel}
                        onChangeText={setEditVehicleModel}
                        placeholder="e.g. Civic"
                        placeholderTextColor={activeTheme.textSecondary}
                        style={[styles.singleTextInput, { color: activeTheme.textPrimary }]}
                      />
                    </View>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Reg No</Text>
                    <View style={[styles.singleInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                      <TextInput
                        value={editVehicleRegNo}
                        onChangeText={setEditVehicleRegNo}
                        placeholder="WB 01 AB 1234"
                        placeholderTextColor={activeTheme.textSecondary}
                        style={[styles.singleTextInput, { color: activeTheme.textPrimary }]}
                      />
                    </View>
                  </View>
                </View>

                <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary, marginTop: 8 }]}>Special Instructions / Notes</Text>
                <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder, minHeight: 54 }]}>
                  <TextInput
                    value={editNotes}
                    onChangeText={setEditNotes}
                    placeholder="Instructions for service technician..."
                    placeholderTextColor={activeTheme.textSecondary}
                    multiline={true}
                    numberOfLines={2}
                    style={[styles.modalTextInput, { color: activeTheme.textPrimary }]}
                  />
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={[styles.modalSecondaryBtn, { borderColor: activeTheme.cardBorder }]}
                  onPress={() => setEditModalBooking(null)}
                  disabled={isSubmittingEdit}
                >
                  <Text style={[styles.modalSecondaryBtnText, { color: activeTheme.textSecondary }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalPrimaryAccentBtn, { backgroundColor: activeTheme.accentBtnBg }]}
                  onPress={handleSaveEdit}
                  disabled={isSubmittingEdit}
                >
                  {isSubmittingEdit ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="content-save-outline" size={16} color="#FFFFFF" style={{ marginRight: 5 }} />
                      <Text style={styles.modalPrimaryAccentBtnText}>SAVE CHANGES</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════
          CALENDAR PICKER MODAL (DATE SELECTION)
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showDatePickerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowDatePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.calendarModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
            {/* Header matching Time Picker Modal */}
            <View style={styles.customModalHeader}>
              <View>
                <Text style={[styles.customModalTitle, { color: activeTheme.textPrimary }]}>Select Date</Text>
                <Text style={[styles.customModalSubtitle, { color: activeTheme.textSecondary }]}>Pick an appointment service date</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDatePickerModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Selected Date Preview Banner */}
            <View style={[styles.bigClockDisplay, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder, marginBottom: 12, paddingVertical: 8 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="calendar-check" size={24} color="#0084FF" style={{ marginRight: 10 }} />
                <View>
                  <Text style={{ fontSize: 10.5, color: activeTheme.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>Selected Date</Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: activeTheme.textPrimary, marginTop: 1 }}>
                    {selectedCalendarDate ? formatDateDisplay(selectedCalendarDate) : 'Tap a date below'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Month & Year Navigation Header */}
            <View style={styles.calendarHeaderRow}>
              <TouchableOpacity
                onPress={handlePrevMonth}
                style={[styles.calendarNavBtn, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.pillInactiveBg }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="chevron-left" size={24} color={activeTheme.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.calendarMonthTitle, { color: activeTheme.textPrimary }]}>
                {MONTH_NAMES[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity
                onPress={handleNextMonth}
                style={[styles.calendarNavBtn, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.pillInactiveBg }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="chevron-right" size={24} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Days of Week Row */}
            <View style={styles.calendarWeekRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <Text key={day} style={[styles.calendarWeekDay, { color: activeTheme.textSecondary }]}>
                  {day}
                </Text>
              ))}
            </View>

            {/* Calendar Days Grid rendered as Weeks */}
            <View style={{ marginVertical: 4 }}>
              {calendarWeeksArray.map((week, wIdx) => (
                <View key={`week-${wIdx}`} style={styles.calendarWeekRow}>
                  {week.map((d, dIdx) => {
                    if (d === null) {
                      return <View key={`empty-${wIdx}-${dIdx}`} style={styles.calendarDayCell} />;
                    }
                    const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                    const cellDateStr = `${calendarYear}-${pad(calendarMonth + 1)}-${pad(d)}`;
                    const isSelected = selectedCalendarDate === cellDateStr;
                    const isToday = cellDateStr === todayStr;

                    return (
                      <TouchableOpacity
                        key={`day-${cellDateStr}`}
                        style={[
                          styles.calendarDayCell,
                          styles.calendarDayBtn,
                          isSelected && { backgroundColor: '#0084FF' },
                          !isSelected && isToday && { borderWidth: 1, borderColor: '#0084FF' },
                        ]}
                        onPress={() => setSelectedCalendarDate(cellDateStr)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.calendarDayText,
                            { color: isSelected ? '#FFFFFF' : activeTheme.textPrimary },
                            isSelected && { fontWeight: '800' },
                          ]}
                        >
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Quick Preset Buttons */}
            <Text style={[styles.pickerSectionLabel, { color: activeTheme.textSecondary, marginTop: 8, marginBottom: 6 }]}>Quick Presets</Text>
            <View style={styles.calendarQuickPresets}>
              <TouchableOpacity
                style={[
                  styles.quickPresetChip,
                  { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder },
                  selectedCalendarDate === todayStr && { backgroundColor: '#0084FF', borderColor: '#0084FF' },
                ]}
                onPress={() => {
                  const now = new Date();
                  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                  const str = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
                  setSelectedCalendarDate(str);
                  setCalendarYear(now.getFullYear());
                  setCalendarMonth(now.getMonth());
                }}
              >
                <Text style={[styles.quickPresetText, { color: selectedCalendarDate === todayStr ? '#FFFFFF' : activeTheme.textPrimary }]}>Today</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickPresetChip,
                  { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder },
                  selectedCalendarDate === tomorrowStr && { backgroundColor: '#0084FF', borderColor: '#0084FF' },
                ]}
                onPress={() => {
                  const tmrw = new Date();
                  tmrw.setDate(tmrw.getDate() + 1);
                  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                  const str = `${tmrw.getFullYear()}-${pad(tmrw.getMonth() + 1)}-${pad(tmrw.getDate())}`;
                  setSelectedCalendarDate(str);
                  setCalendarYear(tmrw.getFullYear());
                  setCalendarMonth(tmrw.getMonth());
                }}
              >
                <Text style={[styles.quickPresetText, { color: selectedCalendarDate === tomorrowStr ? '#FFFFFF' : activeTheme.textPrimary }]}>Tomorrow</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.quickPresetChip,
                  { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder },
                ]}
                onPress={() => {
                  const nextW = new Date();
                  nextW.setDate(nextW.getDate() + 7);
                  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                  const str = `${nextW.getFullYear()}-${pad(nextW.getMonth() + 1)}-${pad(nextW.getDate())}`;
                  setSelectedCalendarDate(str);
                  setCalendarYear(nextW.getFullYear());
                  setCalendarMonth(nextW.getMonth());
                }}
              >
                <Text style={[styles.quickPresetText, { color: activeTheme.textPrimary }]}>+1 Week</Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons matching Time Picker */}
            <View style={[styles.modalActionsRow, { marginTop: 14 }]}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: activeTheme.cardBorder }]}
                onPress={() => setShowDatePickerModal(false)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: activeTheme.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryAccentBtn, { backgroundColor: '#0084FF' }]}
                onPress={() => {
                  if (selectedCalendarDate) {
                    setEditDate(selectedCalendarDate);
                  }
                  setShowDatePickerModal(false);
                }}
              >
                <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={[styles.modalPrimaryAccentBtnText, { color: '#FFFFFF' }]}>SET DATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════════
          CLOCK / TIME PICKER MODAL (HOUR & MINUTE SELECTION)
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showTimePickerModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowTimePickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.clockModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
            {/* Header */}
            <View style={styles.customModalHeader}>
              <View>
                <Text style={[styles.customModalTitle, { color: activeTheme.textPrimary }]}>Select Time</Text>
                <Text style={[styles.customModalSubtitle, { color: activeTheme.textSecondary }]}>Pick an appointment hour & minute</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTimePickerModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Big Digital Clock Display */}
            <View style={[styles.bigClockDisplay, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.clockBigDigit, { color: '#0084FF' }]}>
                  {clockHour < 10 ? '0' + clockHour : clockHour}
                </Text>
                <Text style={[styles.clockBigColon, { color: activeTheme.textPrimary }]}>:</Text>
                <Text style={[styles.clockBigDigit, { color: '#30D158' }]}>
                  {clockMinute < 10 ? '0' + clockMinute : clockMinute}
                </Text>
              </View>

              {/* AM / PM Toggle */}
              <View style={[styles.ampmSwitch, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder, borderWidth: 1 }]}>
                <TouchableOpacity
                  style={[styles.ampmBtn, clockPeriod === 'AM' && { backgroundColor: '#0084FF' }]}
                  onPress={() => setClockPeriod('AM')}
                >
                  <Text style={[styles.ampmText, { color: clockPeriod === 'AM' ? '#FFFFFF' : activeTheme.textSecondary }]}>AM</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ampmBtn, clockPeriod === 'PM' && { backgroundColor: '#0084FF' }]}
                  onPress={() => setClockPeriod('PM')}
                >
                  <Text style={[styles.ampmText, { color: clockPeriod === 'PM' ? '#FFFFFF' : activeTheme.textSecondary }]}>PM</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Hour Picker Grid (1 to 12) */}
            <Text style={[styles.pickerSectionLabel, { color: activeTheme.textSecondary }]}>Select Hour</Text>
            <View style={styles.hoursGrid}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => {
                const isSelected = clockHour === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.hourCircleBtn,
                      {
                        backgroundColor: isSelected ? '#0084FF' : activeTheme.pillInactiveBg,
                        borderColor: isSelected ? '#0084FF' : activeTheme.cardBorder,
                      },
                    ]}
                    onPress={() => setClockHour(h)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.hourCircleText,
                        { color: isSelected ? '#FFFFFF' : activeTheme.textPrimary, fontWeight: isSelected ? '800' : '600' },
                      ]}
                    >
                      {h}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Minute Picker (:00, :15, :30, :45) */}
            <Text style={[styles.pickerSectionLabel, { color: activeTheme.textSecondary, marginTop: 12 }]}>Select Minute</Text>
            <View style={styles.minutesRow}>
              {[0, 15, 30, 45].map(m => {
                const isSelected = clockMinute === m;
                const mStr = m < 10 ? '0' + m : '' + m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.minuteBtn,
                      {
                        backgroundColor: isSelected ? '#30D158' : activeTheme.pillInactiveBg,
                        borderColor: isSelected ? '#30D158' : activeTheme.cardBorder,
                      },
                    ]}
                    onPress={() => setClockMinute(m)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.minuteBtnText,
                        { color: isSelected ? '#000000' : activeTheme.textPrimary, fontWeight: isSelected ? '800' : '600' },
                      ]}
                    >
                      :{mStr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Common Quick Slots */}
            <Text style={[styles.pickerSectionLabel, { color: activeTheme.textSecondary, marginTop: 12 }]}>Common Slots</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 4 }}>
              {[
                { label: '09:00 AM', h: 9, m: 0, p: 'AM' as const },
                { label: '10:00 AM', h: 10, m: 0, p: 'AM' as const },
                { label: '11:30 AM', h: 11, m: 30, p: 'AM' as const },
                { label: '01:00 PM', h: 1, m: 0, p: 'PM' as const },
                { label: '02:30 PM', h: 2, m: 30, p: 'PM' as const },
                { label: '04:00 PM', h: 4, m: 0, p: 'PM' as const },
                { label: '06:00 PM', h: 6, m: 0, p: 'PM' as const },
              ].map(slot => (
                <TouchableOpacity
                  key={slot.label}
                  style={[styles.quickSlotChip, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}
                  onPress={() => {
                    setClockHour(slot.h);
                    setClockMinute(slot.m);
                    setClockPeriod(slot.p);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickSlotText, { color: activeTheme.textPrimary }]}>{slot.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: activeTheme.cardBorder }]}
                onPress={() => setShowTimePickerModal(false)}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: activeTheme.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalPrimaryAccentBtn, { backgroundColor: '#30D158' }]}
                onPress={() => {
                  let h24 = clockHour;
                  if (clockPeriod === 'PM' && clockHour < 12) h24 += 12;
                  if (clockPeriod === 'AM' && clockHour === 12) h24 = 0;
                  const pad = (n: number) => (n < 10 ? '0' + n : '' + n);
                  setEditTime(`${pad(h24)}:${pad(clockMinute)}:00`);
                  setShowTimePickerModal(false);
                }}
              >
                <MaterialCommunityIcons name="check" size={16} color="#000000" style={{ marginRight: 4 }} />
                <Text style={[styles.modalPrimaryAccentBtnText, { color: '#000000' }]}>SET TIME</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    
      {/* ══════════════════════════════════════════════════════════════════════════
          ONLINE PAYMENT MODAL: Pay for completed unpaid bookings
          ══════════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={!!payModalBooking}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isProcessingPayment) setPayModalBooking(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.reviewModalCard,
              {
                backgroundColor: activeTheme.modalBg,
                borderColor: activeTheme.cardBorder,
                maxWidth: 380,
                width: '92%',
              },
            ]}
          >
            <View style={styles.reviewModalHeader}>
              <View>
                <Text style={[styles.reviewModalTitle, { color: '#10B981' }]}>Online Payment</Text>
                <Text style={[styles.reviewModalSubtitle, { color: activeTheme.textSecondary }]}>
                  Ref: #{payModalBooking?.reference}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  if (!isProcessingPayment) setPayModalBooking(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={22} color={activeTheme.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingVertical: 14 }}>
              <Text style={{ fontSize: 13, color: activeTheme.textSecondary, marginBottom: 8 }}>
                Service:{' '}
                <Text style={{ color: activeTheme.textPrimary, fontWeight: '700' }}>
                  {payModalBooking?.serviceName}
                </Text>
              </Text>

              <View
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.08)',
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(16, 185, 129, 0.25)',
                  marginBottom: 12,
                  alignItems: 'center',
                }}
              >
                <View style={{ width: '100%', marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: activeTheme.textSecondary }}>Service Provider Amount:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: activeTheme.textPrimary }}>
                      ₹{payModalBooking?.providerSetAmount != null ? payModalBooking.providerSetAmount : payModalBooking?.price}
                    </Text>
                  </View>
                  {payModalBooking?.platformCharge != null && payModalBooking.platformCharge > 0 ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, color: activeTheme.textSecondary }}>Platform Charge:</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0084FF' }}>
                        +₹{payModalBooking.platformCharge}
                      </Text>
                    </View>
                  ) : null}
                  <View style={{ height: 1, backgroundColor: 'rgba(16, 185, 129, 0.2)', marginVertical: 6 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>Total Amount (Customer Pays):</Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#10B981' }}>
                      ₹{payModalBooking?.price}
                    </Text>
                  </View>
                </View>
                <Text style={{ fontSize: 11, color: activeTheme.textSecondary, marginTop: 4, textAlign: 'center' }}>
                  Total Amount = Service Provider Set Amount + Platform Charge
                </Text>

                {payModalBooking ? (
                  <View style={{ alignItems: 'center', marginTop: 12 }}>
                    <View style={{ padding: 8, backgroundColor: '#FFFFFF', borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }}>
                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                            `upi://pay?pa=serveasy@upi&pn=ServEasy&am=${payModalBooking.price}&tr=${payModalBooking.reference}&tn=Booking-${payModalBooking.reference}`
                          )}`,
                        }}
                        style={{ width: 140, height: 140 }}
                        resizeMode="contain"
                      />
                    </View>
                    <Text style={{ fontSize: 10, color: activeTheme.textSecondary, marginTop: 6, fontWeight: '500' }}>
                      Scan with Google Pay, PhonePe, or Paytm
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.modalSecondaryBtn, { borderColor: activeTheme.cardBorder, flex: 1 }]}
                onPress={() => setPayModalBooking(null)}
                disabled={isProcessingPayment}
              >
                <Text style={[styles.modalSecondaryBtnText, { color: activeTheme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryAccentBtn, { backgroundColor: '#10B981', flex: 1.6 }]}
                onPress={handleProcessOnlinePayment}
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="shield-check" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.modalPrimaryAccentBtnText}>PAY NOW</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.refreshing === nextProps.refreshing &&
    prevProps.bookings === nextProps.bookings &&
    prevProps.servicesList === nextProps.servicesList &&
    prevProps.isLoggedIn === nextProps.isLoggedIn
  );
});

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  tabHeaderContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  liveSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
  },
  liveSyncDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#30D158',
    marginRight: 5,
  },
  liveSyncText: {
    color: '#30D158',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabMainTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tabSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  pillsScroll: {
    marginTop: 4,
  },
  pillsContent: {
    gap: 8,
    paddingRight: 10,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dashboardCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingRefText: {
    fontSize: 13,
    fontWeight: '800',
  },
  compactPayModePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  compactPayModeText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  miniBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  miniBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoryHeaderLine: {
    height: 1,
    width: '100%',
  },
  compactServiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactServiceName: {
    fontSize: 13.5,
    fontWeight: '800',
    flex: 1,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactMetaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  compactBottomInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 2,
  },
  compactPriceText: {
    fontSize: 14.5,
    fontWeight: '800',
  },
  compactReviewedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginVertical: 4,
  },
  compactReviewedComment: {
    fontSize: 11,
    fontStyle: 'italic',
    flex: 1,
  },
  reviewedComment: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  quickViewCardBtn: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  quickViewCardBtnText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  signOutButton: {
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontWeight: '700',
  },
  rateButton: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateButtonText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  bookButton: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  reviewModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
  },
  reviewModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  reviewModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  reviewModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 12,
  },
  ratingScoreText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  reviewInputBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    minHeight: 80,
    marginBottom: 18,
  },
  reviewTextInput: {
    fontSize: 13,
    lineHeight: 18,
    padding: 0,
  },
  reviewModalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelReviewBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelReviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  submitReviewBtn: {
    flex: 1.4,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitReviewBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  /* Quick View Modal Styles */
  quickViewModalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
  },
  quickViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickViewTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  quickViewSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickViewScroll: {
    marginTop: 12,
  },
  quickViewRibbon: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  quickViewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickViewPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  quickViewSectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  quickViewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickViewSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  quickViewServiceName: {
    fontSize: 16,
    fontWeight: '800',
  },
  quickViewPackageName: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  quickViewPriceLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  quickViewPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  quickViewProviderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  quickViewProviderLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  quickViewProviderName: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedTagText: {
    color: '#30D158',
    fontSize: 9,
    fontWeight: '800',
  },
  quickViewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  quickViewRowLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  quickViewRowValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  quickViewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickViewGridItem: {
    width: '47%',
  },
  extraRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  extraItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  extraItemDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  extraPriceBadge: {
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  extraPriceText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '800',
  },
  quickViewNotesText: {
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  paymentSummaryLabel: {
    fontSize: 12,
  },
  paymentSummaryValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  paymentDivider: {
    height: 1,
    marginVertical: 8,
  },
  paymentTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  paymentTotalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  quickViewCancelBtn: {
    flex: 1.2,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickViewCancelBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickViewRateBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickViewRateBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickViewRebookBtn: {
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickViewRebookBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quickViewDismissBtn: {
    paddingHorizontal: 18,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickViewDismissBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  /* Card action buttons */
  editCardBtn: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editCardBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  cancelCardBtn: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelCardBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  quickViewEditBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickViewEditBtnText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  /* Custom Modal Styles */
  customModalCard: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  editModalCard: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  customModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  customModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  customModalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalSectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  reasonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  reasonChipText: {
    fontSize: 12,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 5,
  },
  singleInputBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
  },
  singleTextInput: {
    fontSize: 13,
    padding: 0,
  },
  modalInputBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  modalTextInput: {
    fontSize: 13,
    lineHeight: 18,
    padding: 0,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalSecondaryBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalPrimaryDangerBtn: {
    flex: 1.4,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryDangerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  modalPrimaryAccentBtn: {
    flex: 1.4,
    height: 42,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryAccentBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  noticeBannerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
  },
  formSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pickerInputBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
  },
  calendarHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginVertical: 2,
  },
  calendarWeekDay: {
    width: 38,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarDaysGrid: {
    flexDirection: 'column',
  },
  calendarDayCell: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayBtn: {
    borderRadius: 10,
  },
  calendarDayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  calendarQuickPresets: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickPresetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  quickPresetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clockModalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
  },
  bigClockDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginBottom: 14,
  },
  clockBigDigit: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  clockBigColon: {
    fontSize: 28,
    fontWeight: '800',
    marginHorizontal: 4,
  },
  ampmSwitch: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  ampmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ampmText: {
    fontSize: 12,
    fontWeight: '800',
  },
  pickerSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  hourCircleBtn: {
    width: 44,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourCircleText: {
    fontSize: 13,
  },
  minutesRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  minuteBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteBtnText: {
    fontSize: 13,
  },
  quickSlotChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
  },
  quickSlotText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
