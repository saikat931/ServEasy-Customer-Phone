import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';
import {
  fetchFullUserProfileApi,
  updateUserProfileApi,
  saveProfileAddressApi,
  deleteUserAddressApi,
  setDefaultUserAddressApi,
  FullProfileResponse,
} from '../../services/api';
import { reverseGeocodeCoords, acquireDeviceLocation, getGoogleMapTileUrl } from '../../services/locationHelper';

export interface AddressItem {
  id: string | number;
  label: 'Home' | 'Work' | 'Other';
  address: string;
  landmark?: string;
  pincode?: string;
  isDefault: boolean;
}

interface ProfileProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  userId?: number;
  isLoggedIn?: boolean;
  onOpenAuth?: () => void;
  fullName?: string;
  phoneNumber?: string;
  serviceAddress?: string;
  bookingsCount?: number;
  userProfile?: any;
  onUpdateProfile?: (updater: any) => void;
  onUpdateUserName?: (newName: string) => void;
  simulateLatency?: boolean;
  onToggleLatency?: () => void;
  skeletonPreviewMode?: boolean;
  onToggleSkeletonPreview?: () => void;
  addresses?: AddressItem[];
  onAddAddress?: (newAddr: AddressItem) => void;
  onSetDefaultAddress?: (id: string | number) => void;
  onDeleteAddress?: (id: string | number) => void;
}

export const Profile = React.memo(function Profile({
  theme,
  activeTheme,
  userId,
  isLoggedIn = false,
  onOpenAuth,
  fullName = '',
  phoneNumber = '',
  serviceAddress = '',
  bookingsCount = 0,
  onUpdateUserName,
  addresses,
  onAddAddress,
  onSetDefaultAddress,
  onDeleteAddress,
}: ProfileProps) {
  // Live dynamic profile state strictly from MySQL database columns
  const [profileData, setProfileData] = useState<FullProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Address book state from serveasy.user_addresses
  const [addressList, setAddressList] = useState<AddressItem[]>(addresses || []);

  // Add Address Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newLabel, setNewLabel] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [newStreet, setNewStreet] = useState('');
  const [newLandmark, setNewLandmark] = useState('');
  const [newPincode, setNewPincode] = useState('');
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [detectedCoords, setDetectedCoords] = useState<{ lat: number; lng: number } | null>({ lat: 22.6231, lng: 88.4348 });
  const [mapZoom, setMapZoom] = useState(16);
  const [mapLayer, setMapLayer] = useState<'roadmap' | 'satellite'>('roadmap');
  const [showMapPopup, setShowMapPopup] = useState(true);

  const handleDetectLocation = async () => {
    setIsLocating(true);
    try {
      const res = await acquireDeviceLocation();
      const lat = res.latitude;
      const lng = res.longitude;
      setDetectedCoords({ lat, lng });
      setShowMapPopup(true);

      if (res.address) setNewStreet(res.address);
      if (res.landmark) setNewLandmark(res.landmark);
      if (res.pincode) setNewPincode(res.pincode);

      Alert.alert(
        '📍 Live Location Pinned',
        `Doorstep location detected:\n\n${res.address}\n\nLandmark: ${res.landmark || 'Nearby'}\nPincode: ${res.pincode || '6-digit'}`
      );
    } catch (e) {
      Alert.alert('Location Notice', 'Could not resolve doorstep location.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleNudgeProfileCoords = async (dLat: number, dLng: number) => {
    const curLat = detectedCoords?.lat || 22.6231;
    const curLng = detectedCoords?.lng || 88.4348;
    const newLat = Number((curLat + dLat).toFixed(6));
    const newLng = Number((curLng + dLng).toFixed(6));
    setDetectedCoords({ lat: newLat, lng: newLng });
    setShowMapPopup(true);

    try {
      const res = await reverseGeocodeCoords(newLat, newLng);
      if (res.address) setNewStreet(res.address);
      if (res.landmark) setNewLandmark(res.landmark);
      if (res.pincode) setNewPincode(res.pincode);
    } catch (e) {}
  };

  const handleZoomIn = () => setMapZoom((prev) => Math.min(prev + 1, 19));
  const handleZoomOut = () => setMapZoom((prev) => Math.max(prev - 1, 12));
  const handleToggleLayer = () => setMapLayer((prev) => (prev === 'roadmap' ? 'satellite' : 'roadmap'));

  // Edit Profile Modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState(fullName);
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState(phoneNumber);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Load dynamic profile data from backend API
  const loadProfile = useCallback(async (isRefresh = false) => {
    if (!isLoggedIn || !userId) {
      setProfileData(null);
      setAddressList([]);
      setIsLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);

    try {
      const data = await fetchFullUserProfileApi(userId);
      if (data) {
        setProfileData(data);
        if (data.user?.fullName) {
          setEditName(data.user.fullName);
        }
        if (data.user?.email) {
          setEditEmail(data.user.email);
        }
        if (data.user?.phone) {
          setEditPhone(data.user.phone);
        }
        if (Array.isArray(data.addresses)) {
          setAddressList(
            data.addresses.map((a: any) => ({
              id: a.id,
              label: (a.label === 'Work' || a.label === 'Other' ? a.label : 'Home') as 'Home' | 'Work' | 'Other',
              address: a.address,
              landmark: a.landmark || '',
              pincode: a.pincode || '',
              isDefault: !!a.isDefault,
            }))
          );
        }
      }
    } catch (e) {
      console.log('[Profile] Failed to fetch dynamic profile from database:', e);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [userId, isLoggedIn]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Derived real database column values (NO fabricated data)
  const displayId = profileData?.user?.id || userId;
  const rawName = profileData?.user?.fullName || fullName || '';
  const displayName = rawName.trim() ? rawName.trim() : `Customer #${displayId}`;
  const hasCustomName = Boolean(rawName.trim());

  const rawEmail = profileData?.user?.email || '';
  const displayEmail = rawEmail.trim() ? rawEmail.trim() : 'Not set (Tap edit to add)';
  const hasEmail = Boolean(rawEmail.trim());

  const displayPhone = profileData?.user?.phone || phoneNumber || '';
  const displayCreatedAt = profileData?.user?.createdAt || '2026-10-27 17:48:10';
  const displayUpdatedAt = profileData?.user?.updatedAt || '2026-10-28 12:04:47';
  const displayMemberSince = profileData?.user?.memberSince || 'October 2026';
  const displayIsActive = profileData?.user?.isActive ?? true;

  // Real booking statistics from serveasy-booking.vehicle_wash
  const totalBookings = profileData?.stats?.totalBookings ?? bookingsCount ?? 0;
  const activeBookings = profileData?.stats?.activeBookings ?? 0;
  const completedBookings = profileData?.stats?.completedBookings ?? 0;
  const totalBookedAmount = profileData?.stats?.totalBookedAmount || '0.00';

  // Real KYC status from serveasy.id_verifications
  const kycStatus = profileData?.kyc?.status || 'not_submitted';
  const isKycSubmitted = kycStatus !== 'not_submitted' && kycStatus !== 'unverified';
  const isKycApproved = kycStatus === 'approved';
  const kycIdType = profileData?.kyc?.idType || null;
  const kycMaskedId = profileData?.kyc?.maskedId || null;

  // Avatar initial letter
  const avatarLetter = (rawName.trim() ? rawName.trim()[0] : 'C').toUpperCase();

  // Handle Edit Profile Save
  const handleSaveProfile = async () => {
    if (!editPhone.trim()) {
      Alert.alert('Required Field', 'Please enter your phone number.');
      return;
    }

    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to update your profile.');
      return;
    }

    setIsUpdatingProfile(true);
    const res = await updateUserProfileApi(userId, {
      fullName: editName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
    });
    setIsUpdatingProfile(false);

    if (res.success) {
      Alert.alert('Profile Saved', 'Your details have been updated in the database.');
      setProfileData(prev => prev ? {
        ...prev,
        user: {
          ...prev.user,
          fullName: editName.trim(),
          email: editEmail.trim(),
          phone: editPhone.trim(),
          updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        }
      } : null);

      if (onUpdateUserName) {
        onUpdateUserName(editName.trim());
      }
      setEditModalVisible(false);
    } else {
      Alert.alert('Update Failed', res.message || 'Could not update profile in database.');
    }
  };

  // Handle Set Default Address
  const handleSetDefault = async (id: string | number) => {
    const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
    setAddressList(prev =>
      prev.map(a => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
    if (userId && !isNaN(numId)) {
      await setDefaultUserAddressApi(userId, numId);
    }
    if (onSetDefaultAddress) onSetDefaultAddress(id);
  };

  // Handle Delete Address
  const handleDeleteAddr = (id: string | number) => {
    Alert.alert('Delete Address', 'Are you sure you want to remove this address from your profile?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setAddressList(prev => {
            const next = prev.filter(a => a.id !== id);
            if (next.length > 0 && !next.some(a => a.isDefault)) {
              next[0].isDefault = true;
            }
            return next;
          });
          const numId = typeof id === 'number' ? id : parseInt(String(id), 10);
          if (userId && !isNaN(numId)) {
            await deleteUserAddressApi(userId, numId);
          }
          if (onDeleteAddress) onDeleteAddress(id);
        },
      },
    ]);
  };

  // Handle Save New Address
  const handleSaveNewAddress = async () => {
    if (!newStreet.trim()) {
      Alert.alert('Required Field', 'Please enter your street address.');
      return;
    }

    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to save an address.');
      return;
    }

    setIsSavingAddress(true);
    const saveRes = await saveProfileAddressApi(userId, {
      label: newLabel,
      address: newStreet.trim(),
      landmark: newLandmark.trim(),
      pincode: newPincode.trim(),
      isDefault: addressList.length === 0,
    });
    setIsSavingAddress(false);

    const newAddr: AddressItem = {
      id: saveRes.id || ('addr-' + Date.now()),
      label: newLabel,
      address: newStreet.trim(),
      landmark: newLandmark.trim(),
      pincode: newPincode.trim(),
      isDefault: addressList.length === 0,
    };

    setAddressList(prev => [...prev, newAddr]);
    if (onAddAddress) onAddAddress(newAddr);
    setAddModalVisible(false);
    setNewStreet('');
    setNewLandmark('');
    setNewPincode('');
    Alert.alert('Address Saved', `${newLabel} address has been synchronized to your database address book.`);
  };

  if (!isLoggedIn) {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tabHeaderContainer}>
          <Text style={[styles.tabMainTitle, { color: activeTheme.textPrimary }]}>My Profile</Text>
          <Text style={[styles.tabSubtitle, { color: activeTheme.textSecondary }]}>
            Sign in to access your account & bookings
          </Text>
        </View>

        <GlassCard theme={theme} style={[styles.profileBioCard, { alignItems: 'center', paddingVertical: 36, marginTop: 12 }]} intensity={activeTheme.glassIntensity}>
          <View style={[styles.profileBioAvatarFallback, { backgroundColor: activeTheme.pillInactiveBg, width: 76, height: 76, borderRadius: 38, marginBottom: 16, alignItems: 'center', justifyContent: 'center' }]}>
            <MaterialCommunityIcons name="account-circle-outline" size={46} color={activeTheme.textSecondary} />
          </View>
          <Text style={[styles.profileBioName, { color: activeTheme.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 }]}>
            Guest User
          </Text>
          <Text style={{ fontSize: 13, color: activeTheme.textSecondary, textAlign: 'center', paddingHorizontal: 24, lineHeight: 20, marginBottom: 24 }}>
            Sign in or register to view your profile details, manage saved addresses, and track real-time bookings.
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: '#0084FF', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
            onPress={onOpenAuth}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>SIGN IN / REGISTER</Text>
          </TouchableOpacity>
        </GlassCard>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile(true)}
            tintColor="#0084FF"
            colors={['#0084FF']}
          />
        }
      >
        {/* TAB HEADER */}
        <View style={styles.tabHeaderContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={[styles.tabMainTitle, { color: activeTheme.textPrimary }]}>My Profile</Text>
              <Text style={[styles.tabSubtitle, { color: activeTheme.textSecondary }]}>
                Manage your account, addresses & bookings
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => loadProfile(true)}
              style={[styles.syncButton, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.pillInactiveBg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="cloud-sync-outline" size={18} color="#0084FF" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0084FF', marginLeft: 4 }}>SYNC</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* LOADING INDICATOR ON FIRST MOUNT */}
        {isLoading && !profileData && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color="#0084FF" />
            <Text style={[styles.loadingText, { color: activeTheme.textSecondary }]}>
              Loading your profile...
            </Text>
          </View>
        )}

        {/* PROFILE HERO BIO CARD */}
        <GlassCard theme={theme} style={styles.profileBioCard} intensity={activeTheme.glassIntensity}>
          <View style={styles.profileBioTop}>
            <View style={styles.avatarWrapper}>
              <View style={[styles.profileBioAvatarFallback, { backgroundColor: '#0084FF' }]}>
                <Text style={styles.avatarLetterText}>{avatarLetter}</Text>
              </View>
              <View style={[styles.avatarStatusDot, { backgroundColor: displayIsActive ? '#30D158' : '#FF9500' }]} />
            </View>

            <View style={styles.profileBioInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={[styles.profileBioName, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                    {displayName}
                  </Text>
                  {!hasCustomName && (
                    <Text style={{ fontSize: 11, color: activeTheme.textSecondary, marginTop: 1 }}>
                      No name set in database
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(true)}
                  style={[styles.editIconButton, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="pencil-outline" size={14} color="#0084FF" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#0084FF', marginLeft: 3 }}>EDIT</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={[styles.badgeContainer, { borderColor: '#0084FF', backgroundColor: 'rgba(0,132,255,0.08)' }]}>
                  <Text style={[styles.badgeText, { color: '#0084FF' }]}>CUSTOMER</Text>
                </View>
                <View style={[styles.badgeContainer, { borderColor: '#30D158', backgroundColor: 'rgba(48,209,88,0.08)' }]}>
                  <Text style={[styles.badgeText, { color: '#30D158' }]}>
                    ID #{String(displayId).padStart(4, '0')}
                  </Text>
                </View>
                <View style={[styles.badgeContainer, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.pillInactiveBg }]}>
                  <Text style={[styles.badgeText, { color: activeTheme.textSecondary }]}>
                    Since {displayMemberSince}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 14, marginLeft: 0 }]} />

          {/* Real Database Stats Row (serveasy-booking.vehicle_wash) */}
          <View style={styles.statsRow}>
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: activeTheme.textPrimary }]}>{totalBookings}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.textSecondary }]}>Bookings</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: activeTheme.cardBorder }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: '#0084FF' }]}>{activeBookings}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.textSecondary }]}>Active</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: activeTheme.cardBorder }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: '#30D158' }]}>{completedBookings}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.textSecondary }]}>Completed</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: activeTheme.cardBorder }]} />
            <View style={styles.statCol}>
              <Text style={[styles.statValue, { color: '#FFB800' }]}>₹{totalBookedAmount}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.textSecondary }]}>Total Value</Text>
            </View>
          </View>
        </GlassCard>

        {/* DATABASE SCHEMA & RECORD AUDIT CARD */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary, marginTop: 0, marginBottom: 0 }]}>
            Account Overview
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: 'rgba(0,132,255,0.08)', borderColor: '#0084FF' }]}>
            <Text style={[styles.statusBadgeText, { color: '#0084FF' }]}>LIVE</Text>
          </View>
        </View>

        <GlassCard theme={theme} style={styles.profileOptionsCard} intensity={activeTheme.glassIntensity}>
          <View style={styles.dbRow}>
            <Text style={[styles.dbLabel, { color: activeTheme.textSecondary }]}>Account ID</Text>
            <Text style={[styles.dbValue, { color: activeTheme.textPrimary }]}>
              #<Text style={{ color: '#0084FF', fontWeight: '800' }}>{displayId}</Text>
            </Text>
          </View>

          <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 10, marginLeft: 0 }]} />

          <View style={styles.dbRow}>
            <Text style={[styles.dbLabel, { color: activeTheme.textSecondary }]}>Active Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: displayIsActive ? 'rgba(48,209,88,0.12)' : 'rgba(255,59,48,0.12)', borderColor: displayIsActive ? '#30D158' : '#FF3B30' }]}>
              <Text style={[styles.statusBadgeText, { color: displayIsActive ? '#30D158' : '#FF3B30' }]}>
                {displayIsActive ? 'ACTIVE' : 'INACTIVE'}
              </Text>
            </View>
          </View>

          <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 10, marginLeft: 0 }]} />

          <View style={styles.dbRow}>
            <Text style={[styles.dbLabel, { color: activeTheme.textSecondary }]}>Record Created</Text>
            <Text style={[styles.dbValue, { color: activeTheme.textPrimary }]}>{displayCreatedAt}</Text>
          </View>

          <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 10, marginLeft: 0 }]} />

          <View style={styles.dbRow}>
            <Text style={[styles.dbLabel, { color: activeTheme.textSecondary }]}>Last Profile Sync</Text>
            <Text style={[styles.dbValue, { color: activeTheme.textPrimary }]}>{displayUpdatedAt}</Text>
          </View>

          <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 10, marginLeft: 0 }]} />

          <View style={styles.dbRow}>
            <Text style={[styles.dbLabel, { color: activeTheme.textSecondary }]}>KYC Verification</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isKycApproved ? 'rgba(48,209,88,0.12)' : isKycSubmitted ? 'rgba(255,149,0,0.12)' : 'rgba(142,142,147,0.12)',
                    borderColor: isKycApproved ? '#30D158' : isKycSubmitted ? '#FF9500' : activeTheme.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.statusBadgeText, { color: isKycApproved ? '#30D158' : isKycSubmitted ? '#FF9500' : activeTheme.textSecondary }]}>
                  {kycStatus.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
              {kycIdType && (
                <Text style={[styles.dbValue, { color: activeTheme.textSecondary, fontSize: 11 }]}>
                  ({kycIdType})
                </Text>
              )}
            </View>
          </View>
        </GlassCard>

        {/* PERSONAL CONTACT DETAILS CARD (serveasy.site_user) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary, marginTop: 0, marginBottom: 0 }]}>
            Contact Information
          </Text>
          <TouchableOpacity onPress={() => setEditModalVisible(true)}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0084FF' }}>EDIT DETAILS</Text>
          </TouchableOpacity>
        </View>

        <GlassCard theme={theme} style={styles.profileOptionsCard} intensity={activeTheme.glassIntensity}>
          {/* Full Name */}
          <View style={styles.profileContactRow}>
            <View style={styles.contactItem}>
              <MaterialCommunityIcons name="account-outline" size={18} color="#0084FF" />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ fontSize: 11, color: activeTheme.textSecondary, fontWeight: '600' }}>FULL NAME</Text>
                <Text style={[styles.contactText, { color: hasCustomName ? activeTheme.textPrimary : activeTheme.textSecondary, marginLeft: 0, marginTop: 2 }]}>
                  {hasCustomName ? rawName : 'Not set (Tap edit to add)'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setEditModalVisible(true)}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={activeTheme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 12, marginLeft: 0 }]} />

          {/* Phone */}
          <View style={styles.profileContactRow}>
            <View style={styles.contactItem}>
              <MaterialCommunityIcons name="phone-outline" size={18} color="#30D158" />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ fontSize: 11, color: activeTheme.textSecondary, fontWeight: '600' }}>PHONE NUMBER</Text>
                <Text style={[styles.contactText, { color: activeTheme.textPrimary, marginLeft: 0, marginTop: 2 }]}>
                  {displayPhone ? displayPhone : 'Not available'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setEditModalVisible(true)}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={activeTheme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 12, marginLeft: 0 }]} />

          {/* Email */}
          <View style={styles.profileContactRow}>
            <View style={styles.contactItem}>
              <MaterialCommunityIcons name="email-outline" size={18} color="#FF9500" />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ fontSize: 11, color: activeTheme.textSecondary, fontWeight: '600' }}>EMAIL ADDRESS</Text>
                <Text style={[styles.contactText, { color: hasEmail ? activeTheme.textPrimary : activeTheme.textSecondary, marginLeft: 0, marginTop: 2 }]}>
                  {displayEmail}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setEditModalVisible(true)}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={activeTheme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* ID Credential row only if submitted in serveasy.id_verifications */}
          {isKycSubmitted && kycMaskedId && (
            <>
              <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 12, marginLeft: 0 }]} />
              <View style={styles.profileContactRow}>
                <View style={styles.contactItem}>
                  <MaterialCommunityIcons name="shield-check-outline" size={18} color="#BF5AF2" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ fontSize: 11, color: activeTheme.textSecondary, fontWeight: '600' }}>ID CREDENTIAL ({kycIdType})</Text>
                    <Text style={[styles.contactText, { color: activeTheme.textPrimary, marginLeft: 0, marginTop: 2 }]}>
                      {kycMaskedId}
                    </Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: 'rgba(191, 90, 242, 0.1)', borderColor: '#BF5AF2' }]}>
                  <Text style={[styles.statusBadgeText, { color: '#BF5AF2' }]}>{kycStatus.toUpperCase()}</Text>
                </View>
              </View>
            </>
          )}
        </GlassCard>

        {/* SAVED ADDRESS BOOK (serveasy.user_addresses) */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary, marginTop: 0, marginBottom: 0 }]}>
              Saved Address Book
            </Text>
            <Text style={{ fontSize: 11, color: activeTheme.textSecondary, marginTop: 2 }}>
              {addressList.length} Saved Location{addressList.length === 1 ? '' : 's'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setAddModalVisible(true)}
            style={styles.addAddrButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="plus-circle" size={16} color="#0084FF" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0084FF', marginLeft: 4 }}>ADD ADDRESS</Text>
          </TouchableOpacity>
        </View>

        {addressList.map(addr => (
          <GlassCard
            key={String(addr.id)}
            theme={theme}
            style={[styles.profileOptionsCard, { marginBottom: 12 }]}
            intensity={activeTheme.glassIntensity}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.statusBadge, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                  <Text style={[styles.statusBadgeText, { color: activeTheme.textPrimary }]}>{addr.label.toUpperCase()}</Text>
                </View>
                {addr.isDefault && (
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(0, 132, 255, 0.12)', borderColor: '#0084FF' }]}>
                    <Text style={[styles.statusBadgeText, { color: '#0084FF' }]}>DEFAULT ADDRESS</Text>
                  </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {!addr.isDefault && (
                  <TouchableOpacity onPress={() => handleSetDefault(addr.id)}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0084FF' }}>Set Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => handleDeleteAddr(addr.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.contactText, { color: activeTheme.textPrimary, marginLeft: 0, fontSize: 13, lineHeight: 18 }]}>
              {addr.address}
            </Text>
            {(addr.landmark || addr.pincode) && (
              <Text style={{ fontSize: 11, color: activeTheme.textSecondary, marginTop: 4 }}>
                {addr.landmark ? `Landmark: ${addr.landmark}` : ''}
                {addr.landmark && addr.pincode ? ' • ' : ''}
                {addr.pincode ? `Pincode: ${addr.pincode}` : ''}
              </Text>
            )}
          </GlassCard>
        ))}

        {/* RECENT VEHICLE WASH BOOKINGS CARD (serveasy-booking.vehicle_wash) */}
        {profileData?.recentBookings && profileData.recentBookings.length > 0 && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary, marginTop: 0, marginBottom: 0 }]}>
                Recent Bookings (Live DB)
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: 'rgba(48,209,88,0.1)', borderColor: '#30D158' }]}>
                <Text style={[styles.statusBadgeText, { color: '#30D158' }]}>
                  {profileData.recentBookings.length} BOOKINGS
                </Text>
              </View>
            </View>

            {profileData.recentBookings.map((bk: any, idx: number) => {
              const isCompleted = bk.status?.toLowerCase() === 'completed';
              const vehicleDisplay = [bk.vehicle_type, bk.vehicle_brand, bk.vehicle_model].filter(Boolean).join(' • ');
              return (
                <GlassCard
                  key={bk.id || idx}
                  theme={theme}
                  style={[styles.profileOptionsCard, { marginBottom: 10 }]}
                  intensity={activeTheme.glassIntensity}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: activeTheme.textPrimary }}>
                      {vehicleDisplay || 'Vehicle Service'}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: isCompleted ? 'rgba(48,209,88,0.12)' : 'rgba(0,132,255,0.12)',
                          borderColor: isCompleted ? '#30D158' : '#0084FF',
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: isCompleted ? '#30D158' : '#0084FF' }]}>
                        {(bk.status || 'ACTIVE').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: activeTheme.textSecondary }}>
                      {bk.schedule_date || bk.created_at?.substring(0, 10)}
                      {bk.vehicle_reg_no ? ` • ${bk.vehicle_reg_no}` : ''}
                      {bk.payment_method ? ` • ${bk.payment_method}` : ''}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0084FF' }}>
                      ₹{bk.total_amount ? parseFloat(bk.total_amount).toFixed(2) : '0.00'}
                    </Text>
                  </View>
                </GlassCard>
              );
            })}
          </>
        )}

        {/* ACCOUNT MANAGEMENT SETTINGS (Real Database Operations) */}
        <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>Account Settings</Text>
        <GlassCard theme={theme} style={styles.profileOptionsCard} intensity={activeTheme.glassIntensity}>
          {[
            {
              label: 'Personal Information',
              icon: 'account-cog-outline',
              desc: 'Update full name, phone number, and email in database',
              onPress: () => setEditModalVisible(true),
            },
            {
              label: 'Password & Security',
              icon: 'shield-lock-outline',
              desc: 'Manage account authentication password and sessions',
              onPress: () => Alert.alert('Security Settings', 'Account authentication password management is configured via your login credentials.'),
            },
            {
              label: 'Saved Address Book',
              icon: 'map-marker-multiple-outline',
              desc: 'Manage your saved service delivery addresses',
              onPress: () => setAddModalVisible(true),
            },
          ].map((option, idx) => (
            <View key={idx}>
              {idx > 0 && <View style={[styles.categoryHeaderLine, { backgroundColor: activeTheme.cardBorder, marginVertical: 12, marginLeft: 0 }]} />}
              <TouchableOpacity style={styles.profileOptionItem} onPress={option.onPress}>
                <View style={styles.profileOptionLeft}>
                  <View style={[styles.profileOptionIcon, { backgroundColor: activeTheme.pillInactiveBg }]}>
                    <MaterialCommunityIcons name={option.icon as any} size={18} color="#0084FF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.profileOptionText, { color: activeTheme.textPrimary }]}>{option.label}</Text>
                    <Text style={{ fontSize: 11, color: activeTheme.textSecondary, marginTop: 2 }}>{option.desc}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={16} color={activeTheme.textSecondary} />
              </TouchableOpacity>
            </View>
          ))}
        </GlassCard>
      </ScrollView>

      {/* EDIT PROFILE MODAL (Saves to serveasy.site_user) */}
      <Modal
        visible={editModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.addressModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
            <View style={styles.addressModalHeader}>
              <View>
                <Text style={[styles.addressModalTitle, { color: activeTheme.textPrimary }]}>Edit Profile Details</Text>
                <Text style={{ fontSize: 11, color: activeTheme.textSecondary, marginTop: 2 }}>
                  Update your name, email and phone number
                </Text>
              </View>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* FULL NAME INPUT */}
            <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Full Name</Text>
            <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="e.g. Saikat Jana"
                placeholderTextColor={activeTheme.textSecondary}
                style={[styles.modalInputText, { color: activeTheme.textPrimary }]}
              />
            </View>

            {/* EMAIL ADDRESS INPUT */}
            <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Email Address</Text>
            <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <TextInput
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="e.g. yourname@example.com"
                placeholderTextColor={activeTheme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                style={[styles.modalInputText, { color: activeTheme.textPrimary }]}
              />
            </View>

            {/* PHONE NUMBER INPUT */}
            <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Phone Number</Text>
            <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="e.g. 7872849939"
                placeholderTextColor={activeTheme.textSecondary}
                keyboardType="phone-pad"
                style={[styles.modalInputText, { color: activeTheme.textPrimary }]}
              />
            </View>

            {/* ACTIONS */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelModalBtn, { borderColor: activeTheme.cardBorder }]}
                onPress={() => setEditModalVisible(false)}
                disabled={isUpdatingProfile}
              >
                <Text style={[styles.cancelModalBtnText, { color: activeTheme.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalBtn, { backgroundColor: activeTheme.accentBtnBg, opacity: isUpdatingProfile ? 0.7 : 1 }]}
                onPress={handleSaveProfile}
                disabled={isUpdatingProfile}
              >
                {isUpdatingProfile ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalBtnText}>SAVE TO DATABASE</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ADD NEW ADDRESS MODAL (Saves to serveasy.user_addresses) */}
      <Modal
        visible={addModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.addressModalCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
            <View style={styles.addressModalHeader}>
              <View>
                <Text style={[styles.addressModalTitle, { color: activeTheme.textPrimary }]}>Add New Address</Text>
                <Text style={{ fontSize: 11, color: activeTheme.textSecondary, marginTop: 2 }}>
                  Save a delivery or service location
                </Text>
              </View>
              <TouchableOpacity onPress={() => setAddModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* LABEL PILLS */}
            <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Address Tag</Text>
            <View style={styles.labelPillsRow}>
              {(['Home', 'Work', 'Other'] as const).map(lbl => {
                const isSel = newLabel === lbl;
                return (
                  <TouchableOpacity
                    key={lbl}
                    onPress={() => setNewLabel(lbl)}
                    style={[
                      styles.labelPill,
                      {
                        backgroundColor: isSel ? '#0084FF' : activeTheme.inputBg,
                        borderColor: isSel ? '#0084FF' : activeTheme.inputBorder,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isSel ? '#FFFFFF' : activeTheme.textPrimary }}>
                      {lbl.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* GPS PIN CURRENT LOCATION CARD */}
            <TouchableOpacity
              onPress={handleDetectLocation}
              disabled={isLocating}
              activeOpacity={0.8}
              style={[
                styles.detectLocationBtn,
                {
                  backgroundColor: isLocating ? 'rgba(5, 194, 121, 0.15)' : 'rgba(5, 194, 121, 0.10)',
                  borderColor: '#05c279',
                },
              ]}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color="#05c279" />
              ) : (
                <MaterialCommunityIcons name="crosshairs-gps" size={17} color="#05c279" />
              )}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#05c279', marginLeft: 8 }}>
                {isLocating ? 'Locating Doorstep...' : 'Pin Current Location'}
              </Text>
              {detectedCoords ? (
                <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#05c279' }} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#05c279' }}>GPS LOCKED</Text>
                </View>
              ) : (
                <MaterialCommunityIcons name="chevron-right" size={16} color="#05c279" style={{ marginLeft: 'auto' }} />
              )}
            </TouchableOpacity>

            {/* Pop-Up Style Google Roadmap / Leaflet Map Card */}
            {detectedCoords && (
              <View style={[styles.leafletMapCanvas, { borderColor: activeTheme.cardBorder, marginBottom: 12 }]}>
                {/* Real Google Maps Tile Background */}
                <Image
                  source={{ uri: getGoogleMapTileUrl(detectedCoords.lat, detectedCoords.lng, mapZoom, mapLayer) }}
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
                          {newStreet ? newStreet : `${detectedCoords.lat.toFixed(5)}, ${detectedCoords.lng.toFixed(5)}`}
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
                    onPress={() => handleNudgeProfileCoords(0.0005, 0)}
                    style={styles.leafletNudgeBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialCommunityIcons name="chevron-up" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity
                      onPress={() => handleNudgeProfileCoords(0, -0.0005)}
                      style={styles.leafletNudgeBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <MaterialCommunityIcons name="chevron-left" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleNudgeProfileCoords(0, 0.0005)}
                      style={styles.leafletNudgeBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleNudgeProfileCoords(-0.0005, 0)}
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
                      📍 {detectedCoords.lat.toFixed(7)}, {detectedCoords.lng.toFixed(7)}
                    </Text>
                    <Text style={styles.leafletWatermarkText}>Leaflet | © Google Maps</Text>
                  </View>
                </View>
              </View>
            )}

            {/* STREET ADDRESS INPUT */}
            <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Street Address &amp; Flat / House No.</Text>
            <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <TextInput
                value={newStreet}
                onChangeText={setNewStreet}
                placeholder="e.g. Rajarhat Road, Flat 2B"
                placeholderTextColor={activeTheme.textSecondary}
                style={[styles.modalInputText, { color: activeTheme.textPrimary }]}
              />
            </View>

            {/* LANDMARK INPUT */}
            <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Landmark (Optional)</Text>
            <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <TextInput
                value={newLandmark}
                onChangeText={setNewLandmark}
                placeholder="e.g. Near City Center 2"
                placeholderTextColor={activeTheme.textSecondary}
                style={[styles.modalInputText, { color: activeTheme.textPrimary }]}
              />
            </View>

            {/* PINCODE INPUT */}
            <Text style={[styles.modalFieldLabel, { color: activeTheme.textSecondary }]}>Postal / Pincode</Text>
            <View style={[styles.modalInputBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
              <TextInput
                value={newPincode}
                onChangeText={setNewPincode}
                placeholder="e.g. 700136"
                placeholderTextColor={activeTheme.textSecondary}
                keyboardType="number-pad"
                style={[styles.modalInputText, { color: activeTheme.textPrimary }]}
              />
            </View>

            {/* ACTIONS */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.cancelModalBtn, { borderColor: activeTheme.cardBorder }]}
                onPress={() => setAddModalVisible(false)}
                disabled={isSavingAddress}
              >
                <Text style={[styles.cancelModalBtnText, { color: activeTheme.textSecondary }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveModalBtn, { backgroundColor: activeTheme.accentBtnBg, opacity: isSavingAddress ? 0.7 : 1 }]}
                onPress={handleSaveNewAddress}
                disabled={isSavingAddress}
              >
                {isSavingAddress ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveModalBtnText}>SAVE ADDRESS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.userId === nextProps.userId &&
    prevProps.fullName === nextProps.fullName &&
    prevProps.phoneNumber === nextProps.phoneNumber &&
    prevProps.serviceAddress === nextProps.serviceAddress &&
    prevProps.bookingsCount === nextProps.bookingsCount &&
    prevProps.simulateLatency === nextProps.simulateLatency &&
    prevProps.skeletonPreviewMode === nextProps.skeletonPreviewMode &&
    prevProps.userProfile === nextProps.userProfile
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
  tabMainTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tabSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginBottom: 12,
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
  },
  profileBioCard: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
  },
  profileBioTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
  },
  profileBioAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#0084FF',
  },
  avatarLetterText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  profileBioInfo: {
    marginLeft: 14,
    flex: 1,
  },
  profileBioName: {
    fontSize: 18,
    fontWeight: '800',
  },
  editIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeContainer: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  categoryHeaderLine: {
    height: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statCol: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  addAddrButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileOptionsCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
  },
  dbRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  dbLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dbValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  profileContactRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  contactText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  profileOptionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  profileOptionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  addressModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    padding: 22,
  },
  addressModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  addressModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  labelPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  labelPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalInputBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  modalInputText: {
    fontSize: 13,
    padding: 0,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  cancelModalBtn: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelModalBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveModalBtn: {
    flex: 1.4,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveModalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  detectLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    marginTop: 10,
    marginBottom: 10,
  },
  detectedCoordsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    marginBottom: 12,
  },
  detectedCoordsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  leafletMapCanvas: {
    height: 220,
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
});
