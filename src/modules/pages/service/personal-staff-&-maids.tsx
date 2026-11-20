import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { ServiceWizardSkeleton } from '../../../components/SkeletonLoader';
import {
  StaffSpecialization,
  StaffCandidate,
  SavedAddress,
  MaidBookingPayload,
  STAFF_SPECIALIZATIONS,
  fetchStaffCandidatesFromApi,
  fetchSavedAddressesFromApi,
  submitMaidBookingApi,
  fetchPlatformFeeSettingApi,
  PlatformFeeSetting,
} from '../../../services/api';
import { reverseGeocodeCoords, acquireDeviceLocation } from '../../../services/locationHelper';

interface PersonalStaffMaidsProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  onBack: () => void;
  onBookingComplete?: (bookingNumber: string) => void;
  initialSpecializationSlug?: string;
}

export const PersonalStaffMaids: React.FC<PersonalStaffMaidsProps> = ({
  theme,
  activeTheme,
  onBack,
  onBookingComplete,
  initialSpecializationSlug,
}) => {
  // Stepper state: 1 to 5 (plus 6 for Success)
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsFirstLoad(false), 450);
    return () => clearTimeout(timer);
  }, []);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const totalSteps = 5;

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

  React.useEffect(() => {
    fetchPlatformFeeSettingApi().then(fee => setPlatformFeeSetting(fee)).catch(() => {});
  }, []);

  // Step 1: Specialization
  const [selectedSpec, setSelectedSpec] = useState<StaffSpecialization>(() => {
    if (initialSpecializationSlug) {
      const match = STAFF_SPECIALIZATIONS.find(s => s.slug === initialSpecializationSlug);
      if (match) return match;
    }
    return STAFF_SPECIALIZATIONS[0];
  });

  // Step 2: Work Shift
  const [selectedShift, setSelectedShift] = useState<'Full Time' | 'Part Time' | 'Live-In' | 'Live-Out'>('Full Time');

  // Step 3: Candidates
  const [candidates, setCandidates] = useState<StaffCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<StaffCandidate | null>(null);

  // Step 4: Address & Timing
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [address, setAddress] = useState('Flat 402, Emerald Heights, Park Avenue Road');
  const [landmark, setLandmark] = useState('Near City Central Mall');
  const [pincode, setPincode] = useState('700001');
  const [showCustomAddress, setShowCustomAddress] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(todayStr);
  const [preferredSlot, setPreferredSlot] = useState('08:00 AM (Morning)');
  const [specialNotes, setSpecialNotes] = useState('');

  // Step 5: Review & Payment
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'Online'>('COD');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedBookingNumber, setConfirmedBookingNumber] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const handleUseLiveLocation = async () => {
    setIsLocating(true);
    try {
      const res = await acquireDeviceLocation();
      if (res.address) setAddress(res.address);
      if (res.landmark) setLandmark(res.landmark);
      if (res.pincode) setPincode(res.pincode);
      setShowCustomAddress(true);
      Alert.alert(
        'Live Location Set 📍',
        `Doorstep location detected:\n\n${res.address}\n\nLandmark: ${res.landmark || 'Nearby'}\nPincode: ${res.pincode || '6-digit'}`
      );
    } catch (e) {
      setShowCustomAddress(true);
      Alert.alert('Live Location Set 📍', 'Coordinates updated.');
    } finally {
      setIsLocating(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    async function init() {
      const addrs = await fetchSavedAddressesFromApi();
      const uniqueAddresses: SavedAddress[] = [];
      const seenKeys = new Set<string>();
      for (const a of addrs) {
        const key = `${a.id || ''}-${(a.address || '').trim().toLowerCase()}-${(a.pincode || '').trim()}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueAddresses.push(a);
        }
      }
      setSavedAddresses(uniqueAddresses);
      if (uniqueAddresses.length > 0) {
        setSelectedAddressId(uniqueAddresses[0].id);
        setAddress(uniqueAddresses[0].address);
        setLandmark(uniqueAddresses[0].landmark || '');
        setPincode(uniqueAddresses[0].pincode || '');
      } else {
        setSelectedAddressId(null);
      }

      setLoadingCandidates(true);
      const list = await fetchStaffCandidatesFromApi(selectedSpec.slug, selectedShift);
      setCandidates(list);
      if (list.length > 0) {
        setSelectedCandidate(list[0]);
      }
      setLoadingCandidates(false);
    }
    init();
  }, [selectedSpec, selectedShift]);

  // Rate calculation
  const isMonthly = selectedShift === 'Full Time' || selectedShift === 'Live-In';
  const baseRate = selectedCandidate
    ? isMonthly
      ? selectedCandidate.monthlyRate
      : selectedCandidate.dailyRate
    : 450;

  // Platform convenience fee calculation from serveasy-admin
  const isMaidsFeeInScope = platformFeeSetting.is_active && (
    platformFeeSetting.service_scope === 'all' ||
    platformFeeSetting.applicable_services.includes('personal-staff-and-maids') ||
    platformFeeSetting.applicable_services.includes('personal-staff-&-maids') ||
    platformFeeSetting.applicable_services.includes('maids') ||
    platformFeeSetting.applicable_services.includes('care') ||
    platformFeeSetting.applicable_services.includes('3') ||
    platformFeeSetting.applicable_services.includes('13')
  );

  let convenienceFee = 0;
  if (isMaidsFeeInScope) {
    if (platformFeeSetting.type === 'percentage') {
      convenienceFee = Math.round(((baseRate * platformFeeSetting.amount) / 100) * 100) / 100;
    } else {
      convenienceFee = platformFeeSetting.amount;
    }
  }

  const totalAmount = baseRate + convenienceFee;

  const handleNext = async () => {
    if (currentStep === 4) {
      if (!address.trim() || !pincode.trim() || !startDate.trim()) {
        Alert.alert('Required Fields', 'Please ensure address, pincode, and start date are filled.');
        return;
      }
    }

    if (currentStep === 5) {
      setIsSubmitting(true);
      const payload: MaidBookingPayload = {
        specializationId: selectedSpec.id,
        specializationName: selectedSpec.name,
        workType: selectedShift,
        candidateId: selectedCandidate?.id || 1,
        candidateName: selectedCandidate?.name || 'Verified Staff',
        providerId: selectedCandidate?.providerId || 301,
        scheduleDate: startDate,
        scheduleTimeSlot: preferredSlot.split(' ')[0],
        address: `${address}${landmark ? ' (Landmark: ' + landmark + ')' : ''}`,
        landmark,
        pincode,
        notes: specialNotes,
        totalAmount,
        paymentMethod,
      };

      const res = await submitMaidBookingApi(payload);
      setIsSubmitting(false);
      setConfirmedBookingNumber(res.bookingNumber);
      setCurrentStep(6);
      if (onBookingComplete) {
        onBookingComplete(res.bookingNumber);
      }
      return;
    }

    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1 && currentStep <= 5) {
      setCurrentStep(prev => prev - 1);
    } else {
      onBack();
    }
  };

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
            Hire Personal Staff & Maids
          </Text>
          <Text style={[styles.headerSubtitle, { color: activeTheme.textSecondary }]}>
            {currentStep <= 5 ? `Step ${currentStep} of ${totalSteps}: ${getStaffStepName(currentStep)}` : 'Booking Complete'}
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
      {currentStep <= 5 && (
        <View style={styles.progressBarWrapper}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(currentStep / totalSteps) * 100}%` },
            ]}
          />
        </View>
      )}

      {/* ── MAIN SCROLL CONTENT ── */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================
            STEP 1: CHOOSE SERVICE SPECIALIZATION
            ======================================================== */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Choose Specialization
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Select the exact staff role you need for your home or family.
            </Text>

            <View style={styles.specGrid}>
              {STAFF_SPECIALIZATIONS.map(spec => {
                const isSelected = selectedSpec.id === spec.id;
                return (
                  <TouchableOpacity
                    key={spec.id}
                    onPress={() => setSelectedSpec(spec)}
                    style={[
                      styles.specCard,
                      {
                        backgroundColor: isSelected ? 'rgba(5, 194, 121, 0.12)' : activeTheme.cardBg,
                        borderColor: isSelected ? '#05c279' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: isSelected ? '#05c279' : 'rgba(255,255,255,0.06)' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={spec.icon}
                        size={26}
                        color={isSelected ? '#000' : '#05c279'}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.specName, { color: activeTheme.textPrimary }]}>{spec.name}</Text>
                      <Text style={[styles.specDescText, { color: activeTheme.textSecondary }]}>
                        {spec.description}
                      </Text>
                      <Text style={styles.rateFrom}>Starts from ₹{spec.startingHourlyRate}/hr</Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={18} color="#05c279" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================
            STEP 2: PREFERRED WORK SHIFT
            ======================================================== */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Preferred Shift Period
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Choose how you want your {selectedSpec.name} to work.
            </Text>

            <View style={styles.shiftGrid}>
              {[
                {
                  type: 'Full Time' as const,
                  title: 'Full Time',
                  desc: '8-10 Hours Shift daily with fixed timings',
                  icon: 'clock-time-eight-outline' as const,
                  badge: 'MOST POPULAR',
                },
                {
                  type: 'Part Time' as const,
                  title: 'Part Time',
                  desc: 'Specific task duration (2-4 hours per day)',
                  icon: 'clock-fast' as const,
                  badge: 'FLEXIBLE',
                },
                {
                  type: 'Live-In' as const,
                  title: 'Live-In',
                  desc: '24x7 Stay-at-home private accommodation care',
                  icon: 'home-heart' as const,
                  badge: '24/7 SUPPORT',
                },
                {
                  type: 'Live-Out' as const,
                  title: 'Live-Out',
                  desc: 'Daytime commuting professional for family chores',
                  icon: 'walk' as const,
                  badge: 'DAILY COMMUTE',
                },
              ].map(item => {
                const isSelected = selectedShift === item.type;
                return (
                  <TouchableOpacity
                    key={item.type}
                    onPress={() => setSelectedShift(item.type)}
                    style={[
                      styles.shiftCard,
                      {
                        backgroundColor: isSelected ? 'rgba(5, 194, 121, 0.12)' : activeTheme.cardBg,
                        borderColor: isSelected ? '#05c279' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.shiftCardHeader}>
                      <View
                        style={[
                          styles.iconCircle,
                          { backgroundColor: isSelected ? '#05c279' : 'rgba(255,255,255,0.06)' },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={item.icon}
                          size={24}
                          color={isSelected ? '#000' : '#05c279'}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.shiftTitle, { color: activeTheme.textPrimary }]}>{item.title}</Text>
                        <Text style={[styles.shiftDesc, { color: activeTheme.textSecondary }]}>{item.desc}</Text>
                      </View>
                      <MaterialCommunityIcons
                        name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                        size={22}
                        color={isSelected ? '#05c279' : '#64748b'}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ========================================================
            STEP 3: CANDIDATE SELECTION
            ======================================================== */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Verified Candidates
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Police-verified staff matching {selectedSpec.name} ({selectedShift}).
            </Text>

            {loadingCandidates ? (
              <ActivityIndicator size="large" color="#05c279" style={{ marginTop: 40 }} />
            ) : (
              candidates.map(cand => {
                const isSelected = selectedCandidate?.id === cand.id;
                return (
                  <TouchableOpacity
                    key={cand.id}
                    onPress={() => setSelectedCandidate(cand)}
                    style={[
                      styles.candidateCard,
                      {
                        backgroundColor: isSelected ? 'rgba(5, 194, 121, 0.12)' : activeTheme.cardBg,
                        borderColor: isSelected ? '#05c279' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <View style={styles.candHeaderRow}>
                      <View style={styles.candAvatar}>
                        <Text style={styles.candAvatarText}>{cand.avatar}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={[styles.candName, { color: activeTheme.textPrimary }]}>{cand.name}</Text>
                          <View style={styles.ratingBadge}>
                            <MaterialCommunityIcons name="star" size={13} color="#FFD60A" />
                            <Text style={styles.ratingText}>{cand.rating} ({cand.reviewCount})</Text>
                          </View>
                        </View>
                        <Text style={[styles.candMeta, { color: activeTheme.textSecondary }]}>
                          {cand.gender} • {cand.age} yrs • {cand.experienceYears} yrs experience
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.candBio, { color: activeTheme.textSecondary }]}>
                      "{cand.bio}"
                    </Text>

                    {/* Verification Badges */}
                    <View style={styles.badgesRow}>
                      {cand.policeVerified && (
                        <View style={styles.verifiedPill}>
                          <MaterialCommunityIcons name="shield-check" size={12} color="#05c279" />
                          <Text style={styles.verifiedPillText}>Police Verified</Text>
                        </View>
                      )}
                      {cand.medicalVerified && (
                        <View style={styles.verifiedPill}>
                          <MaterialCommunityIcons name="medical-bag" size={12} color="#0084FF" />
                          <Text style={[styles.verifiedPillText, { color: '#0084FF' }]}>Medical Fit</Text>
                        </View>
                      )}
                    </View>

                    {/* Skills pills */}
                    <View style={styles.skillsRow}>
                      {cand.skills.slice(0, 4).map((sk, idx) => (
                        <View key={idx} style={[styles.skillChip, { backgroundColor: activeTheme.pillInactiveBg }]}>
                          <Text style={[styles.skillChipText, { color: activeTheme.textPrimary }]}>{sk}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Rate footer */}
                    <View style={styles.candFooter}>
                      <View>
                        <Text style={{ fontSize: 10, color: activeTheme.textSecondary, textTransform: 'uppercase' }}>
                          {isMonthly ? 'Monthly Salary' : 'Daily Rate'}
                        </Text>
                        <Text style={styles.candPrice}>
                          ₹{isMonthly ? cand.monthlyRate : cand.dailyRate}
                          <Text style={{ fontSize: 12, color: activeTheme.textSecondary }}>{isMonthly ? ' / mo' : ' / day'}</Text>
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.selectBtnPill,
                          { backgroundColor: isSelected ? '#05c279' : 'rgba(255,255,255,0.08)' },
                        ]}
                      >
                        <Text
                          style={{
                            color: isSelected ? '#000' : activeTheme.textPrimary,
                            fontWeight: '700',
                            fontSize: 12,
                          }}
                        >
                          {isSelected ? 'Selected' : 'Choose Staff'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ========================================================
            STEP 4: SERVICE ADDRESS & TIMING
            ======================================================== */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Booking Address & Date
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Where should {selectedCandidate?.name || 'the staff'} report for duty?
            </Text>

            {/* Saved Addresses */}
            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>Select Saved Address</Text>
            {savedAddresses.map(addr => {
              const isSelected = selectedAddressId === addr.id && !showCustomAddress;
              return (
                <TouchableOpacity
                  key={`addr-${addr.id}`}
                  onPress={() => {
                    setSelectedAddressId(addr.id);
                    setAddress(addr.address);
                    setLandmark(addr.landmark || '');
                    setPincode(addr.pincode || '');
                    setShowCustomAddress(false);
                  }}
                  activeOpacity={0.8}
                  style={[
                    styles.addressItemCard,
                    {
                      backgroundColor: isSelected ? 'rgba(5, 194, 121, 0.12)' : activeTheme.cardBg,
                      borderColor: isSelected ? '#05c279' : activeTheme.cardBorder,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={addr.label === 'Home' ? 'home-outline' : 'briefcase-outline'}
                    size={22}
                    color={isSelected ? '#05c279' : activeTheme.textSecondary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.addrLabel, { color: activeTheme.textPrimary }]}>{addr.label}</Text>
                    <Text style={[styles.addrText, { color: activeTheme.textSecondary }]}>{addr.address}</Text>
                    {addr.landmark ? (
                      <Text style={[styles.addrSub, { color: activeTheme.textSecondary }]}>
                        Landmark: {addr.landmark} • PIN: {addr.pincode}
                      </Text>
                    ) : null}
                  </View>
                  <MaterialCommunityIcons
                    name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                    size={22}
                    color={isSelected ? '#05c279' : '#8E8E93'}
                    style={{ alignSelf: 'center', marginLeft: 8 }}
                  />
                </TouchableOpacity>
              );
            })}

            {/* Enter New Address & Live Location Input */}
            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
              <TouchableOpacity
                onPress={() => setShowCustomAddress(!showCustomAddress)}
                style={[styles.addAddressBtn, { borderColor: activeTheme.cardBorder, flex: 1, marginVertical: 0 }]}
              >
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color="#05c279" />
                <Text style={{ color: '#05c279', fontWeight: '700', fontSize: 13 }}>
                  {showCustomAddress ? 'Use Saved' : 'Custom Address'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleUseLiveLocation}
                disabled={isLocating}
                style={[
                  styles.addAddressBtn,
                  {
                    borderColor: 'rgba(0, 132, 255, 0.4)',
                    backgroundColor: 'rgba(0, 132, 255, 0.1)',
                    flex: 1,
                    marginVertical: 0,
                  },
                ]}
              >
                {isLocating ? (
                  <ActivityIndicator size="small" color="#0084FF" />
                ) : (
                  <MaterialCommunityIcons name="crosshairs-gps" size={18} color="#0084FF" />
                )}
                <Text style={{ color: '#0084FF', fontWeight: '700', fontSize: 13 }}>
                  {isLocating ? 'Locating...' : 'Use Live Location'}
                </Text>
              </TouchableOpacity>
            </View>

            {showCustomAddress && (
              <View style={[styles.newAddrBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
                <Text style={[styles.inputLabel, { color: activeTheme.textPrimary }]}>Full Street Address *</Text>
                <TextInput
                  style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                  placeholder="Apartment, Wing, Street"
                  placeholderTextColor="#64748b"
                  value={address}
                  onChangeText={setAddress}
                />
                <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 10 }]}>Landmark</Text>
                <TextInput
                  style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder }]}
                  placeholder="Near landmark"
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
              </View>
            )}

            {/* Date and Preferred Hour */}
            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 18 }]}>Schedule Start Date *</Text>
            <View style={styles.dateChipsRow}>
              {[0, 1, 2, 7].map(days => {
                const d = new Date();
                d.setDate(d.getDate() + days);
                const dStr = d.toISOString().slice(0, 10);
                const isSelected = startDate === dStr;
                const label = days === 0 ? 'Start Today' : days === 1 ? 'Tomorrow' : days === 7 ? 'Next Week' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                return (
                  <TouchableOpacity
                    key={dStr}
                    onPress={() => setStartDate(dStr)}
                    style={[
                      styles.dateChip,
                      {
                        backgroundColor: isSelected ? '#05c279' : activeTheme.inputBg,
                        borderColor: isSelected ? '#05c279' : activeTheme.cardBorder,
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

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 18 }]}>Preferred Arrival Hour</Text>
            <View style={styles.slotsGrid}>
              {[
                '08:00 AM (Morning)',
                '11:00 AM (Mid-day)',
                '01:00 PM (Afternoon)',
                '05:00 PM (Evening)',
                '08:00 PM (Night)',
              ].map(slot => {
                const isSelected = preferredSlot === slot;
                return (
                  <TouchableOpacity
                    key={slot}
                    onPress={() => setPreferredSlot(slot)}
                    style={[
                      styles.slotPill,
                      {
                        backgroundColor: isSelected ? 'rgba(5, 194, 121, 0.15)' : activeTheme.cardBg,
                        borderColor: isSelected ? '#05c279' : activeTheme.cardBorder,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="clock-time-four-outline"
                      size={14}
                      color={isSelected ? '#05c279' : activeTheme.textSecondary}
                    />
                    <Text style={[styles.slotPillText, { color: isSelected ? '#05c279' : activeTheme.textPrimary }]}>
                      {slot}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 18 }]}>Special Instructions / Notes</Text>
            <TextInput
              style={[styles.inputField, { color: activeTheme.textPrimary, borderColor: activeTheme.cardBorder, height: 60 }]}
              placeholder="e.g. Vegetarian cooking preference, pet-friendly staff, language preference..."
              placeholderTextColor="#64748b"
              multiline
              value={specialNotes}
              onChangeText={setSpecialNotes}
            />
          </View>
        )}

        {/* ========================================================
            STEP 5: REVIEW & CONFIRM
            ======================================================== */}
        {currentStep === 5 && (
          <View style={styles.stepContainer}>
            <Text style={[styles.stepTitle, { color: activeTheme.textPrimary }]}>
              Review Booking Summary
            </Text>
            <Text style={[styles.stepDesc, { color: activeTheme.textSecondary }]}>
              Confirm hiring terms before scheduling your candidate.
            </Text>

            <View style={[styles.summaryBox, { backgroundColor: activeTheme.cardBg, borderColor: activeTheme.cardBorder }]}>
              <Text style={styles.summarySectionTitle}>Staff & Role</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Specialization</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>{selectedSpec.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Work Shift</Text>
                <Text style={[styles.sumVal, { color: '#05c279' }]}>{selectedShift}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Selected Candidate</Text>
                <Text style={[styles.sumVal, { color: '#0084FF' }]}>
                  {selectedCandidate?.name} ({selectedCandidate?.experienceYears} yrs exp)
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.summarySectionTitle}>Reporting Schedule</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Start Date</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>{startDate}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Time Slot</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>{preferredSlot}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Service Address</Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]} numberOfLines={2}>
                  {address}
                </Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.summarySectionTitle}>Rate Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>
                  {isMonthly ? 'Monthly Salary Allowance' : 'Daily Service Charge'}
                </Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>₹{baseRate.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>
                  Platform Charge {platformFeeSetting.type === 'percentage' && isMaidsFeeInScope ? `(${platformFeeSetting.amount}%)` : ''}
                </Text>
                <Text style={[styles.sumVal, { color: activeTheme.textPrimary }]}>+₹{convenienceFee.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.sumLabel, { color: activeTheme.textSecondary }]}>Onboarding & Background Check</Text>
                <Text style={[styles.sumVal, { color: '#05c279' }]}>FREE</Text>
              </View>

              <View style={[styles.summaryRow, { marginTop: 10 }]}>
                <Text style={[styles.sumTotalLabel, { color: activeTheme.textPrimary }]}>Total Amount (Paid by Customer)</Text>
                <Text style={[styles.sumTotalVal, { color: '#05c279' }]}>₹{totalAmount.toFixed(2)}</Text>
              </View>
            </View>

            {/* Payment method selector */}
            <Text style={[styles.inputLabel, { color: activeTheme.textPrimary, marginTop: 18 }]}>Choose Payment Mode</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setPaymentMethod('COD')}
                style={[
                  styles.payOptionBtn,
                  {
                    backgroundColor: paymentMethod === 'COD' ? 'rgba(5, 194, 121, 0.15)' : activeTheme.cardBg,
                    borderColor: paymentMethod === 'COD' ? '#05c279' : activeTheme.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons name="cash" size={20} color="#05c279" />
                <Text style={[styles.payOptionText, { color: activeTheme.textPrimary }]}>Pay on Arrival</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPaymentMethod('Online')}
                style={[
                  styles.payOptionBtn,
                  {
                    backgroundColor: paymentMethod === 'Online' ? 'rgba(5, 194, 121, 0.15)' : activeTheme.cardBg,
                    borderColor: paymentMethod === 'Online' ? '#05c279' : activeTheme.cardBorder,
                  },
                ]}
              >
                <MaterialCommunityIcons name="credit-card-outline" size={20} color="#0084FF" />
                <Text style={[styles.payOptionText, { color: activeTheme.textPrimary }]}>Online UPI / Card</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================
            STEP 6: CONFIRMATION SCREEN
            ======================================================== */}
        {currentStep === 6 && (
          <View style={styles.stepContainer}>
            <View style={styles.successIconBadge}>
              <MaterialCommunityIcons name="check-circle" size={54} color="#05c279" />
            </View>
            <Text style={[styles.successHeading, { color: activeTheme.textPrimary }]}>
              Staff Request Submitted!
            </Text>
            <Text style={[styles.successSub, { color: activeTheme.textSecondary }]}>
              Our concierge team is validating schedule availability with {selectedCandidate?.name}.
            </Text>

            <View style={[styles.bookingRefCard, { backgroundColor: activeTheme.cardBg, borderColor: activeTheme.cardBorder }]}>
              <Text style={styles.bookingRefLabel}>MAID / STAFF REFERENCE NUMBER</Text>
              <Text style={[styles.bookingRefNumber, { color: '#05c279' }]}>{confirmedBookingNumber || 'MB-20261026-8819'}</Text>

              <View style={styles.onboardStepsBox}>
                <View style={styles.onboardStepRow}>
                  <MaterialCommunityIcons name="check-circle" size={18} color="#05c279" />
                  <Text style={[styles.onboardText, { color: activeTheme.textPrimary }]}>
                    Staff details & background verified by ServEasy
                  </Text>
                </View>
                <View style={styles.onboardStepRow}>
                  <MaterialCommunityIcons name="phone-in-talk" size={18} color="#0084FF" />
                  <Text style={[styles.onboardText, { color: activeTheme.textPrimary }]}>
                    Concierge call within 15 minutes to confirm timing
                  </Text>
                </View>
                <View style={styles.onboardStepRow}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#FFD60A" />
                  <Text style={[styles.onboardText, { color: activeTheme.textPrimary }]}>
                    100% Replacement Guarantee if unsatisfied
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ── BOTTOM ACTION BAR ── */}
      <View style={[styles.bottomBar, { backgroundColor: activeTheme.cardBg, borderTopColor: activeTheme.cardBorder }]}>
        {currentStep > 1 && currentStep <= 5 && (
          <TouchableOpacity
            onPress={handlePrev}
            style={[styles.prevButton, { borderColor: activeTheme.cardBorder }]}
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={activeTheme.textPrimary} />
            <Text style={[styles.prevButtonText, { color: activeTheme.textPrimary }]}>Back</Text>
          </TouchableOpacity>
        )}

        {currentStep <= 5 ? (
          <TouchableOpacity
            onPress={handleNext}
            disabled={isSubmitting}
            style={[
              styles.nextButton,
              {
                opacity: isSubmitting ? 0.6 : 1,
                marginLeft: currentStep === 1 ? 0 : 12,
              },
            ]}
          >
            <LinearGradient
              colors={['#05c279', '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep === 5 ? `Confirm Booking (₹${totalAmount})` : 'Continue'}
                  </Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
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
              colors={['#05c279', '#3b82f6']}
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

function getStaffStepName(step: number): string {
  switch (step) {
    case 1: return 'Specialization';
    case 2: return 'Work Shift';
    case 3: return 'Candidates';
    case 4: return 'Address & Date';
    case 5: return 'Review & Book';
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
    backgroundColor: '#05c279',
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
  specGrid: {
    gap: 10,
  },
  specCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  specName: {
    fontSize: 15,
    fontWeight: '700',
  },
  specDescText: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  rateFrom: {
    fontSize: 11,
    fontWeight: '700',
    color: '#05c279',
    marginTop: 3,
  },
  shiftGrid: {
    gap: 12,
  },
  shiftCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shiftTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  shiftDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  candidateCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  candHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  candAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#05c279',
    alignItems: 'center',
    justifyContent: 'center',
  },
  candAvatarText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
  },
  candName: {
    fontSize: 15,
    fontWeight: '800',
  },
  candMeta: {
    fontSize: 12,
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
  candBio: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
    fontStyle: 'italic',
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5, 194, 121, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedPillText: {
    color: '#05c279',
    fontSize: 10,
    fontWeight: '700',
  },
  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  skillChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  skillChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  candFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 12,
    marginTop: 12,
  },
  candPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#05c279',
  },
  selectBtnPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
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
  addressItemCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  addrLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  addrText: {
    fontSize: 12,
    marginTop: 2,
  },
  addrSub: {
    fontSize: 11,
    marginTop: 2,
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
    marginTop: 6,
  },
  newAddrBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 10,
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
  summaryBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summarySectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#05c279',
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
    marginVertical: 10,
  },
  sumTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  sumTotalVal: {
    fontSize: 18,
    fontWeight: '900',
  },
  payOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  payOptionText: {
    fontSize: 13,
    fontWeight: '700',
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
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    letterSpacing: 1,
  },
  onboardStepsBox: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 14,
    gap: 12,
  },
  onboardStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  onboardText: {
    fontSize: 12,
    fontWeight: '500',
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
