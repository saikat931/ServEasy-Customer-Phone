import React, { useState, useMemo, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';
import { ListingSkeleton } from '../../components/SkeletonLoader';

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

interface WishlistProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  wishlistIds: string[];
  servicesList: ServiceItem[];
  onToggleWishlist: (serviceId: string) => void;
  onOpenBooking: (service: ServiceItem) => void;
  onExploreServices?: () => void;
  onBack?: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

const CATEGORIES = [
  { key: 'all', label: 'All Saved' },
  { key: 'automotive', label: 'Automotive' },
  { key: 'home', label: 'Home & Living' },
  { key: 'care', label: 'Personal Staff' },
  { key: 'transport', label: 'Transport' },
  { key: 'stay', label: 'Rooms & Stays' },
  { key: 'food', label: 'Food & Dining' },
  { key: 'emergency', label: 'Emergency SOS' },
];

export function Wishlist({
  theme,
  activeTheme,
  wishlistIds,
  servicesList,
  onToggleWishlist,
  onOpenBooking,
  onExploreServices,
  onBack,
  refreshing,
  onRefresh,
}: WishlistProps) {
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsFirstLoad(false), 450);
    return () => clearTimeout(timer);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const wishlistedServices = useMemo(() => {
    return servicesList.filter(s => wishlistIds.includes(s.id));
  }, [servicesList, wishlistIds]);

  const filteredServices = useMemo(() => {
    return wishlistedServices.filter(service => {
      const matchesCat = activeCategory === 'all' || service.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        service.name.toLowerCase().includes(q) ||
        service.description.toLowerCase().includes(q) ||
        service.badge.toLowerCase().includes(q) ||
        service.tags.toLowerCase().includes(q);
      return matchesCat && matchesQuery;
    });
  }, [wishlistedServices, activeCategory, searchQuery]);

  if (isFirstLoad) {
    return <ListingSkeleton theme={theme} activeTheme={activeTheme} />;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={activeTheme.iconColor}
          colors={[activeTheme.iconColor]}
        />
      }
    >
      {/* HEADER */}
      <View style={styles.tabHeaderContainer}>
        <View style={styles.headerTitleRow}>
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={[styles.backButton, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={20} color={activeTheme.iconColor} />
            </TouchableOpacity>
          )}
          <Text style={[styles.tabMainTitle, { color: activeTheme.textPrimary, flex: 1 }]}>Saved Favorites</Text>
          <View style={[styles.countBadge, { backgroundColor: 'rgba(255, 45, 85, 0.12)', borderColor: '#FF2D55' }]}>
            <MaterialCommunityIcons name="heart" size={13} color="#FF2D55" style={{ marginRight: 4 }} />
            <Text style={[styles.countBadgeText, { color: '#FF2D55' }]}>{wishlistedServices.length}</Text>
          </View>
        </View>
        <Text style={[styles.tabSubtitle, { color: activeTheme.textSecondary }]}>
          Compare saved services and book verified technicians whenever needed.
        </Text>
      </View>

      {/* SEARCH BAR */}
      <View style={[styles.searchBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={activeTheme.textSecondary} style={{ marginRight: 8 }} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search saved services..."
          placeholderTextColor={activeTheme.textSecondary}
          style={[styles.searchInput, { color: activeTheme.textPrimary }]}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={activeTheme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* CATEGORY FILTER PILLS */}
      {wishlistedServices.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsContent}
        >
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setActiveCategory(cat.key)}
                style={[
                  styles.pillButton,
                  {
                    backgroundColor: isActive ? activeTheme.pillActiveBg : activeTheme.pillInactiveBg,
                    borderColor: isActive ? '#0084FF' : activeTheme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.pillButtonText,
                    { color: isActive ? activeTheme.pillActiveText : activeTheme.pillInactiveText },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* LIST OF SAVED SERVICES */}
      {filteredServices.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: activeTheme.pillInactiveBg }]}>
            <MaterialCommunityIcons
              name={searchQuery ? 'magnify-close' : 'heart-outline'}
              size={48}
              color={activeTheme.textSecondary}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: activeTheme.textPrimary }]}>
            {searchQuery ? 'No Matching Favorites' : 'Your Wishlist is Empty'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: activeTheme.textSecondary }]}>
            {searchQuery
              ? 'Try searching with a different service title or clear filters.'
              : 'Tap the heart icon on any service card to save it for quick booking.'}
          </Text>
          <TouchableOpacity
            style={[styles.exploreBtn, { backgroundColor: activeTheme.accentBtnBg }]}
            onPress={onExploreServices || onBack}
          >
            <Text style={styles.exploreBtnText}>EXPLORE SERVICES</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cardsList}>
          {filteredServices.map(service => (
            <GlassCard
              key={service.id}
              theme={theme}
              style={[styles.serviceCard, { borderColor: activeTheme.cardBorder }]}
              intensity={activeTheme.glassIntensity}
            >
              {/* CARD HEADER */}
              <View style={styles.serviceCardHeader}>
                <View style={[styles.badgeContainer, { borderColor: activeTheme.cardBorder }]}>
                  <Text style={[styles.badgeText, { color: activeTheme.textSecondary }]}>{service.badge}</Text>
                </View>

                <View style={styles.headerActionsRight}>
                  {/* Heart / Wishlist Toggle */}
                  <TouchableOpacity
                    onPress={() => onToggleWishlist(service.id)}
                    style={[
                      styles.iconWrapperCompact,
                      { backgroundColor: 'rgba(255, 45, 85, 0.15)', borderColor: 'rgba(255, 45, 85, 0.35)', borderWidth: 1 },
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="heart" size={17} color="#FF2D55" />
                  </TouchableOpacity>

                  {/* Service Icon */}
                  <View style={[styles.iconWrapperCompact, { backgroundColor: activeTheme.pillInactiveBg }]}>
                    <MaterialCommunityIcons name={service.icon} size={18} color={activeTheme.iconColor} />
                  </View>
                </View>
              </View>

              {/* RATING ROW */}
              <View style={styles.ratingRow}>
                <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                <Text style={[styles.ratingText, { color: activeTheme.textPrimary }]}>
                  {service.rating}{' '}
                  <Text style={[styles.ratingCountText, { color: activeTheme.textSecondary }]}>
                    ({service.reviewCount} reviews)
                  </Text>
                </Text>
              </View>

              <View style={styles.cardSpacing20} />

              {/* SERVICE TITLE & DESCRIPTION */}
              <Text style={[styles.serviceTitle, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                {service.name}
              </Text>
              <Text style={[styles.serviceDesc, { color: activeTheme.textSecondary }]} numberOfLines={2}>
                {service.description}
              </Text>

              {/* CARD FOOTER */}
              <View style={[styles.cardFooter, { borderTopColor: activeTheme.cardBorder }]}>
                <View style={styles.priceContainer}>
                  <Text style={styles.priceLabel}>{service.priceLabel}</Text>
                  <Text style={[styles.priceValue, { color: activeTheme.textPrimary }]}>{service.priceValue}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.bookButton,
                    { backgroundColor: service.category === 'emergency' ? '#FF453A' : activeTheme.accentBtnBg },
                  ]}
                  onPress={() => onOpenBooking(service)}
                >
                  <Text style={styles.bookButtonText}>
                    {service.category === 'emergency' ? 'SOS ALERT' : 'BOOK NOW'}
                  </Text>
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },
  tabHeaderContainer: {
    marginTop: 6,
    marginBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: 10,
  },
  tabMainTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  pillsScroll: {
    marginBottom: 16,
  },
  pillsContent: {
    gap: 8,
    paddingRight: 10,
  },
  pillButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  pillButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardsList: {
    gap: 16,
  },
  serviceCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  serviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  iconWrapperCompact: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  ratingCountText: {
    fontWeight: '400',
  },
  cardSpacing20: {
    height: 12,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 10,
    color: '#A0A5AD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  bookButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
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
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 280,
  },
  exploreBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
