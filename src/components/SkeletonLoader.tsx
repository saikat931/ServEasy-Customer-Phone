import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Animated,
  Dimensions,
  ViewStyle,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from './GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;
const CARD_SPACING = 20;

interface SkeletonProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  style?: ViewStyle | ViewStyle[];
}

export function ShimmerBone({ theme, activeTheme: _activeTheme, style }: SkeletonProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-180, 180],
  });

  const boneBg = theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 132, 255, 0.06)';
  const shimmerColors = theme === 'dark'
    ? ['rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.0)'] as const
    : ['rgba(255, 255, 255, 0.0)', 'rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.0)'] as const;

  return (
    <View style={[styles.boneContainer, { backgroundColor: boneBg }, style]}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

// 1. HOME SCREEN SKELETON
export function HomeSkeleton({ theme, activeTheme }: SkeletonProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.heroTitleSkeleton} />
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.heroSubtitleSkeleton} />
      </View>

      {/* Search Bar Placeholder */}
      <GlassCard theme={theme} style={styles.searchCard} intensity={activeTheme.glassIntensity}>
        <View style={styles.searchRow}>
          <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.searchIconSkeleton} />
          <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.searchInputSkeleton} />
        </View>
      </GlassCard>

      {/* Categories Pill Row */}
      <View style={styles.categoriesRowPlaceholder}>
        {[1, 2, 3, 4].map(idx => (
          <ShimmerBone key={idx} theme={theme} activeTheme={activeTheme} style={styles.categoryPillSkeleton} />
        ))}
      </View>

      {/* Horizontal Category Sections */}
      {[1, 2].map(secIdx => (
        <View key={secIdx} style={styles.categorySection}>
          <View style={styles.categoryHeaderRow}>
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.sectionTitleIconSkeleton} />
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.sectionTitleTextSkeleton} />
          </View>

          <View style={styles.horizontalScrollPlaceholder}>
            {/* Horizontal Card 1 */}
            <GlassCard theme={theme} style={styles.horizontalServiceCard} intensity={activeTheme.glassIntensity}>
              <View style={styles.serviceCardHeader}>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.badgeSkeleton} />
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.iconWrapperSkeleton} />
              </View>
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.ratingSkeleton} />
              <View style={styles.cardSpacing20} />
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.cardTitleSkeleton} />
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.cardDescSkeleton} />
              <View style={[styles.cardFooter, { borderTopColor: activeTheme.cardBorder }]}>
                <View style={styles.priceContainer}>
                  <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.priceLabelSkeleton} />
                  <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.priceValSkeleton} />
                </View>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookBtnSkeleton} />
              </View>
            </GlassCard>

            {/* Horizontal Card 2 */}
            <GlassCard theme={theme} style={styles.horizontalServiceCard} intensity={activeTheme.glassIntensity}>
              <View style={styles.serviceCardHeader}>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.badgeSkeleton} />
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.iconWrapperSkeleton} />
              </View>
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.ratingSkeleton} />
              <View style={styles.cardSpacing20} />
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.cardTitleSkeleton} />
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.cardDescSkeleton} />
              <View style={[styles.cardFooter, { borderTopColor: activeTheme.cardBorder }]}>
                <View style={styles.priceContainer}>
                  <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.priceLabelSkeleton} />
                  <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.priceValSkeleton} />
                </View>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookBtnSkeleton} />
              </View>
            </GlassCard>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

// 2. LISTING SCREEN SKELETON
export function ListingSkeleton({ theme, activeTheme }: SkeletonProps) {
  return (
    <View style={styles.listingScreenContainer}>
      {/* Header Placeholder */}
      <View style={styles.listingHeaderRowPlaceholder}>
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.backButtonSkeleton} />
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.listingTitleSkeleton} />
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Search & Filter Bar Placeholder */}
      <View style={styles.listingSearchFilterRow}>
        <GlassCard theme={theme} style={styles.listingSearchCard} intensity={activeTheme.glassIntensity}>
          <View style={styles.searchRow}>
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.searchIconSkeleton} />
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.searchInputSkeleton} />
          </View>
        </GlassCard>
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.filterToggleButtonSkeleton} />
      </View>

      {/* Vertical List of Cards */}
      <ScrollView contentContainerStyle={styles.listingScrollContent} showsVerticalScrollIndicator={false}>
        {[1, 2, 3].map(idx => (
          <GlassCard key={idx} theme={theme} style={[styles.verticalServiceCard, { borderColor: activeTheme.cardBorder }]} intensity={activeTheme.glassIntensity}>
            <View style={styles.serviceItemTopRow}>
              <View style={styles.serviceItemHeaderLeft}>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 40, height: 40, borderRadius: 10 }} />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 130, height: 16, borderRadius: 4, marginBottom: 6 }} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.badgeSkeleton} />
                    <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.ratingSkeleton} />
                  </View>
                </View>
              </View>
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 34, height: 34, borderRadius: 9 }} />
            </View>
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.cardDescSkeleton} />
            <View style={[styles.cardFooter, { borderTopColor: activeTheme.cardBorder }]}>
              <View style={styles.priceContainer}>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.priceLabelSkeleton} />
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.priceValSkeleton} />
              </View>
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookBtnSkeleton} />
            </View>
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}

// 3. BOOKINGS TAB SKELETON
export function BookingsSkeleton({ theme, activeTheme }: SkeletonProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Tab Header Placeholder */}
      <View style={styles.tabHeaderContainer}>
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.tabMainTitleSkeleton} />
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.tabSubtitleSkeleton} />
      </View>

      {/* Booking Cards Placeholder */}
      {[1, 2].map(idx => (
        <GlassCard key={idx} theme={theme} style={styles.dashboardCard} intensity={activeTheme.glassIntensity}>
          <View style={styles.dashboardHeader}>
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookingRefSkeleton} />
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.statusBadgeSkeleton} />
          </View>

          {/* Divider */}
          <View style={[styles.dividerSkeleton, { backgroundColor: activeTheme.cardBorder }]} />

          {/* Details lines */}
          {[1, 2, 3].map(rowIdx => (
            <View key={rowIdx} style={styles.bookingRow}>
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookingIconSkeleton} />
              <View style={{ flex: 1 }}>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookingLabelSkeleton} />
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookingValueSkeleton} />
              </View>
            </View>
          ))}

          {/* Action button */}
          <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.bookingActionSkeleton} />
        </GlassCard>
      ))}
    </ScrollView>
  );
}

// 4. NOTIFICATIONS TAB SKELETON
export function NotificationsSkeleton({ theme, activeTheme }: SkeletonProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.tabHeaderContainer}>
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.tabMainTitleSkeleton} />
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.tabSubtitleSkeleton} />
      </View>

      {/* Notification items */}
      {[1, 2, 3, 4].map(idx => (
        <GlassCard key={idx} theme={theme} style={styles.notificationCard} intensity={activeTheme.glassIntensity}>
          <View style={styles.notificationLeft}>
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.notificationIconContainerSkeleton} />
            <View style={styles.notificationDetails}>
              <View style={styles.notificationHeaderRow}>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.notificationTitleTextSkeleton} />
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.notificationTimeTextSkeleton} />
              </View>
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.notificationMsgTextSkeleton} />
            </View>
          </View>
        </GlassCard>
      ))}
    </ScrollView>
  );
}

// 5. SERVICE WIZARD / BOOKING SKELETON (Used for Car Wash, Maid Booking, etc.)
export function ServiceWizardSkeleton({ theme, activeTheme }: SkeletonProps) {
  return (
    <View style={styles.listingScreenContainer}>
      {/* Wizard Header Row */}
      <View style={styles.listingHeaderRowPlaceholder}>
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={styles.backButtonSkeleton} />
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 170, height: 20, borderRadius: 6 }} />
        <View style={styles.headerPlaceholder} />
      </View>

      {/* Wizard Stepper Bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginVertical: 16 }}>
        {[1, 2, 3, 4].map(idx => (
          <ShimmerBone key={idx} theme={theme} activeTheme={activeTheme} style={{ width: (SCREEN_WIDTH - 70) / 4, height: 6, borderRadius: 3 }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.listingScrollContent} showsVerticalScrollIndicator={false}>
        {/* Step Title & Subtitle */}
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 140, height: 18, borderRadius: 5, marginBottom: 8 }} />
        <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 230, height: 12, borderRadius: 4, marginBottom: 20 }} />

        {/* Big Option Cards */}
        {[1, 2, 3].map(idx => (
          <GlassCard key={idx} theme={theme} style={[styles.verticalServiceCard, { borderColor: activeTheme.cardBorder, marginBottom: 14 }]} intensity={activeTheme.glassIntensity}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 44, height: 44, borderRadius: 12 }} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 150, height: 16, borderRadius: 4, marginBottom: 6 }} />
                <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: 100, height: 12, borderRadius: 4 }} />
              </View>
            </View>
            <ShimmerBone theme={theme} activeTheme={activeTheme} style={{ width: '100%', height: 36, borderRadius: 8 }} />
          </GlassCard>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  boneContainer: {
    overflow: 'hidden',
    position: 'relative',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  heroSection: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  heroTitleSkeleton: {
    width: '80%',
    height: 28,
    borderRadius: 8,
    marginBottom: 8,
  },
  heroSubtitleSkeleton: {
    width: '95%',
    height: 40,
    borderRadius: 6,
  },
  searchCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    borderColor: 'transparent',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIconSkeleton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  searchInputSkeleton: {
    width: '60%',
    height: 18,
    borderRadius: 4,
  },
  categoriesRowPlaceholder: {
    flexDirection: 'row',
    paddingLeft: 20,
    marginBottom: 24,
  },
  categoryPillSkeleton: {
    width: 100,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
  },
  categorySection: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitleIconSkeleton: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 8,
  },
  sectionTitleTextSkeleton: {
    width: 140,
    height: 18,
    borderRadius: 4,
  },
  horizontalScrollPlaceholder: {
    flexDirection: 'row',
  },
  horizontalServiceCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    marginRight: CARD_SPACING,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  serviceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeSkeleton: {
    width: 70,
    height: 20,
    borderRadius: 6,
  },
  iconWrapperSkeleton: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  ratingSkeleton: {
    width: 120,
    height: 14,
    borderRadius: 4,
    marginTop: 4,
  },
  cardSpacing20: {
    height: 20,
  },
  cardTitleSkeleton: {
    width: '70%',
    height: 20,
    borderRadius: 4,
    marginBottom: 6,
  },
  cardDescSkeleton: {
    width: '95%',
    height: 32,
    borderRadius: 4,
    marginBottom: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  priceContainer: {
    flexDirection: 'column',
  },
  priceLabelSkeleton: {
    width: 50,
    height: 10,
    borderRadius: 2,
    marginBottom: 4,
  },
  priceValSkeleton: {
    width: 70,
    height: 20,
    borderRadius: 4,
  },
  bookBtnSkeleton: {
    width: 90,
    height: 36,
    borderRadius: 8,
  },
  // Listing page elements
  listingScreenContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listingHeaderRowPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  backButtonSkeleton: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  listingTitleSkeleton: {
    width: 150,
    height: 22,
    borderRadius: 4,
  },
  headerPlaceholder: {
    width: 38,
  },
  listingSearchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  listingSearchCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 10,
    borderColor: 'transparent',
  },
  filterToggleButtonSkeleton: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  listingScrollContent: {
    paddingBottom: 40,
  },
  verticalServiceCard: {
    width: '100%',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
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
  listingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  // Bookings / notifications general header
  tabHeaderContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
  },
  tabMainTitleSkeleton: {
    width: 150,
    height: 26,
    borderRadius: 6,
    marginBottom: 6,
  },
  tabSubtitleSkeleton: {
    width: '95%',
    height: 32,
    borderRadius: 4,
  },
  dashboardCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingRefSkeleton: {
    width: 110,
    height: 18,
    borderRadius: 4,
  },
  statusBadgeSkeleton: {
    width: 80,
    height: 22,
    borderRadius: 11,
  },
  dividerSkeleton: {
    height: 1,
    marginVertical: 12,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingIconSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  bookingLabelSkeleton: {
    width: 60,
    height: 10,
    borderRadius: 2,
    marginBottom: 4,
  },
  bookingValueSkeleton: {
    width: 180,
    height: 16,
    borderRadius: 4,
  },
  bookingActionSkeleton: {
    width: '100%',
    height: 38,
    borderRadius: 10,
    marginTop: 8,
  },
  // Notification items
  notificationCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationIconContainerSkeleton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  notificationDetails: {
    flex: 1,
  },
  notificationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitleTextSkeleton: {
    width: 120,
    height: 16,
    borderRadius: 4,
  },
  notificationTimeTextSkeleton: {
    width: 60,
    height: 12,
    borderRadius: 3,
  },
  notificationMsgTextSkeleton: {
    width: '90%',
    height: 14,
    borderRadius: 3,
    marginTop: 2,
  },
});
