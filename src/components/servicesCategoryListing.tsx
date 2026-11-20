import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  RefreshControl
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from './GlassCard';
import { ListingSkeleton } from './SkeletonLoader';

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

interface ServicesCategoryListingProps {
  theme: 'dark' | 'light';
  selectedCategoryKey: string | null;
  onBack: () => void;
  onOpenBooking: (service: ServiceItem) => void;
  currentUser?: any;
  servicesList: ServiceItem[];
  activeTheme: any;
  isLoading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  initialQuery?: string;
  categoriesList?: any[];
  wishlistIds?: string[];
  onToggleWishlist?: (id: string) => void;
}

export const ServicesCategoryListing = React.memo(function ServicesCategoryListing({
  theme,
  currentUser,
  selectedCategoryKey,
  onBack,
  onOpenBooking,
  servicesList,
  activeTheme,
  isLoading = false,
  refreshing = false,
  onRefresh,
  initialQuery = '',
  categoriesList = [],
  wishlistIds = [],
  onToggleWishlist
}: ServicesCategoryListingProps) {
  // Listing page filters & search
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsFirstLoad(false), 450);
    return () => clearTimeout(timer);
  }, []);

  const [listingSearchQuery, setListingSearchQuery] = useState(initialQuery);
  const [activeCategoryKey, setActiveCategoryKey] = useState<string>(selectedCategoryKey || 'all');

  React.useEffect(() => {
    setListingSearchQuery(initialQuery || '');
  }, [initialQuery]);

  React.useEffect(() => {
    setActiveCategoryKey(selectedCategoryKey || 'all');
  }, [selectedCategoryKey]);

  const [sortBy, setSortBy] = useState<'rating' | 'priceAsc' | 'priceDesc' | 'none'>('none');
  const [minRating, setMinRating] = useState<number>(0);
  const [priceFilter, setPriceFilter] = useState<'all' | 'under20' | '20to50' | 'above50'>('all');
  const [serviceModeFilter, setServiceModeFilter] = useState<'all' | 'doorstep' | 'shop'>('all');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // Helper to extract baseline package price
  const getServiceBasePrice = (service: ServiceItem): number => {
    if (!service.packages || service.packages.length === 0) return 0;
    return Math.min(...service.packages.map(p => p.price));
  };

  const isSubcategoriesQuery = listingSearchQuery.toLowerCase().trim() === 'subcategories';
  const isDomainsQuery =
    listingSearchQuery.toLowerCase().trim() === 'domains' ||
    listingSearchQuery.toLowerCase().trim() === 'categories';

  // Filter & Sort category services for the Service Listing Screen
  const listingServices = servicesList
    .filter(service => {
      // Must match selected category if specified
      if (activeCategoryKey && activeCategoryKey !== 'all') {
        const sCat = (service.category || '').toLowerCase();
        const sCatId = (service as any).category_id;
        const matchesCat =
          sCat === activeCategoryKey ||
          ((activeCategoryKey === 'automotive' || activeCategoryKey === 'vehicle' || activeCategoryKey === '1') && (sCat === 'automotive' || sCat === 'vehicle' || sCatId === 1)) ||
          ((activeCategoryKey === 'home' || activeCategoryKey === '2') && (sCat === 'home' || sCatId === 2)) ||
          ((activeCategoryKey === 'care' || activeCategoryKey === 'staff' || activeCategoryKey === '3') && (sCat === 'care' || sCat === 'staff' || sCatId === 3)) ||
          ((activeCategoryKey === 'transport' || activeCategoryKey === '4') && (sCat === 'transport' || sCatId === 4)) ||
          ((activeCategoryKey === 'stay' || activeCategoryKey === 'rooms' || activeCategoryKey === '5') && (sCat === 'stay' || sCatId === 5)) ||
          ((activeCategoryKey === 'food' || activeCategoryKey === '6') && (sCat === 'food' || sCatId === 6)) ||
          ((activeCategoryKey === 'emergency' || activeCategoryKey === '7') && (sCat === 'emergency' || sCatId === 7));
        if (!matchesCat) return false;
      }

      // Must match listing search query
      const matchesSearch =
        isSubcategoriesQuery ||
        isDomainsQuery ||
        !listingSearchQuery ||
        service.name.toLowerCase().includes(listingSearchQuery.toLowerCase()) ||
        service.description.toLowerCase().includes(listingSearchQuery.toLowerCase()) ||
        service.tags.toLowerCase().includes(listingSearchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Must match rating filter
      if (service.rating < minRating) return false;

      // Must match price filter
      const basePrice = getServiceBasePrice(service);
      if (priceFilter === 'under20' && basePrice >= 20) return false;
      if (priceFilter === '20to50' && (basePrice < 20 || basePrice > 50)) return false;
      if (priceFilter === 'above50' && basePrice <= 50) return false;

      // Must match service mode filter
      if (serviceModeFilter === 'doorstep' && service.mode === 'shop') return false;
      if (serviceModeFilter === 'shop' && service.mode === 'doorstep') return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'rating') {
        return b.rating - a.rating;
      }
      if (sortBy === 'priceAsc') {
        return getServiceBasePrice(a) - getServiceBasePrice(b);
      }
      if (sortBy === 'priceDesc') {
        return getServiceBasePrice(b) - getServiceBasePrice(a);
      }
      return 0; // none
    });

  // Count active filters for badge display
  const activeFiltersCount = [
    sortBy !== 'none',
    minRating > 0,
    priceFilter !== 'all',
    serviceModeFilter !== 'all'
  ].filter(Boolean).length;

  return (
    <View style={styles.listingScreenContainer}>
      {/* CUSTOM LISTING HEADER WITH STANDARD SCREEN PADDING */}
      <View style={styles.listingHeaderRow}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={activeTheme.iconColor} />
        </TouchableOpacity>

        <Text style={[styles.listingTitle, { color: activeTheme.textPrimary }]} numberOfLines={1}>
          {isSubcategoriesQuery
            ? "All Subcategories"
            : isDomainsQuery
            ? (activeCategoryKey && activeCategoryKey !== 'all'
                ? activeCategoryKey.charAt(0).toUpperCase() + activeCategoryKey.slice(1) + " Domain"
                : "All Service Domains")
            : activeCategoryKey === 'automotive' || activeCategoryKey === '1'
            ? "Automotive & Vehicles"
            : activeCategoryKey === 'home' || activeCategoryKey === '2'
            ? "Home & Living Services"
            : activeCategoryKey === 'care' || activeCategoryKey === '3'
            ? "Personal Staff & Maids"
            : activeCategoryKey === 'transport' || activeCategoryKey === '4'
            ? "Transport & Fleet Rental"
            : activeCategoryKey === 'stay' || activeCategoryKey === '5'
            ? "Rooms & Lodging Stays"
            : activeCategoryKey === 'food' || activeCategoryKey === '6'
            ? "Food & Culinary Services"
            : activeCategoryKey === 'emergency' || activeCategoryKey === '7'
            ? "Emergency SOS & Roadside"
            : activeCategoryKey && activeCategoryKey !== 'all'
            ? activeCategoryKey.charAt(0).toUpperCase() + activeCategoryKey.slice(1) + " Services"
            : "All Services"}
        </Text>

        <View style={styles.headerPlaceholder} />
      </View>

      {/* SEARCH BAR & FILTER DRAWER TOGGLE */}
      <View style={styles.listingSearchFilterRow}>
        <GlassCard
          theme={theme}
          style={[styles.listingSearchCard, { borderColor: activeTheme.cardBorder }]}
          intensity={activeTheme.glassIntensity}
        >
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={activeTheme.textSecondary} style={styles.searchIcon} />
            <TextInput
              value={isSubcategoriesQuery || isDomainsQuery ? '' : listingSearchQuery}
              onChangeText={setListingSearchQuery}
              placeholder={
                isSubcategoriesQuery
                  ? "Search all subcategories..."
                  : isDomainsQuery
                  ? "Search all domains & services..."
                  : "Search within category..."
              }
              placeholderTextColor={activeTheme.textSecondary}
              style={[styles.searchInput, { color: activeTheme.textPrimary }]}
            />
            {listingSearchQuery !== '' && !isSubcategoriesQuery && !isDomainsQuery && (
              <TouchableOpacity onPress={() => setListingSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close-circle" size={16} color={activeTheme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </GlassCard>

        <TouchableOpacity
          onPress={() => setFilterDrawerOpen(!filterDrawerOpen)}
          style={[
            styles.filterToggleButton,
            {
              backgroundColor: filterDrawerOpen ? '#0084FF' : activeTheme.pillInactiveBg,
              borderColor: filterDrawerOpen ? '#0084FF' : activeTheme.cardBorder
            }
          ]}
        >
          <MaterialCommunityIcons
            name="filter-variant"
            size={20}
            color={filterDrawerOpen ? '#FFFFFF' : activeTheme.iconColor}
          />
          {activeFiltersCount > 0 && (
            <View style={styles.filterBadgeIndicator} />
          )}
        </TouchableOpacity>
      </View>

      {/* QUICK DOMAIN / CATEGORY FILTER PILLS (Matching Home Page pills) */}
      <View style={styles.domainPillsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.domainPillsContainer}
        >
          {[
            { key: 'all', label: 'All Services', icon: 'grid-large' },
            { key: 'automotive', label: 'Automotive', icon: 'car-wash' },
            { key: 'home', label: 'Home & Living', icon: 'home-outline' },
            { key: 'care', label: 'Personal Staff', icon: 'account-heart-outline' },
            { key: 'transport', label: 'Transport', icon: 'car-estate' },
            { key: 'stay', label: 'Rooms & Lodging', icon: 'bed-outline' },
            { key: 'food', label: 'Food & Dining', icon: 'silverware-fork-knife' },
            { key: 'emergency', label: 'Emergency SOS', icon: 'alert-decagram-outline' },
          ].map(domainItem => {
            const isSelected = activeCategoryKey === domainItem.key;
            return (
              <TouchableOpacity
                key={domainItem.key}
                onPress={() => {
                  setActiveCategoryKey(domainItem.key);
                }}
                style={[
                  styles.domainPill,
                  {
                    backgroundColor: isSelected ? '#0084FF' : activeTheme.pillInactiveBg,
                    borderColor: isSelected ? '#0084FF' : activeTheme.cardBorder
                  }
                ]}
                activeOpacity={0.75}
              >
                <MaterialCommunityIcons
                  name={domainItem.icon as any}
                  size={14}
                  color={isSelected ? '#FFFFFF' : activeTheme.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.domainPillText,
                    { color: isSelected ? '#FFFFFF' : activeTheme.textSecondary }
                  ]}
                >
                  {domainItem.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* DOMAIN / HERO BANNER (Matching Web service-category.php Hero) */}
      {(isDomainsQuery || isSubcategoriesQuery) && (
        <View style={styles.heroBannerWrap}>
          <GlassCard
            theme={theme}
            style={[
              styles.heroBannerCard,
              {
                borderColor: isDomainsQuery ? 'rgba(0, 132, 255, 0.4)' : 'rgba(48, 209, 88, 0.4)',
                backgroundColor: activeTheme.pillInactiveBg
              }
            ]}
            intensity={activeTheme.glassIntensity}
          >
            <View style={styles.heroBannerRow}>
              <View
                style={[
                  styles.heroBannerIconCircle,
                  {
                    backgroundColor: isDomainsQuery ? 'rgba(0, 132, 255, 0.16)' : 'rgba(48, 209, 88, 0.16)',
                    borderColor: isDomainsQuery ? 'rgba(0, 132, 255, 0.4)' : 'rgba(48, 209, 88, 0.4)',
                  }
                ]}
              >
                <MaterialCommunityIcons
                  name={isDomainsQuery ? "shape-outline" : "view-grid-plus"}
                  size={24}
                  color={isDomainsQuery ? "#0084FF" : "#30D158"}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={styles.heroBadgeRow}>
                  <View style={[styles.heroBadgePill, { backgroundColor: isDomainsQuery ? 'rgba(0, 132, 255, 0.15)' : 'rgba(48, 209, 88, 0.15)' }]}>
                    <Text style={[styles.heroBadgeText, { color: isDomainsQuery ? '#0084FF' : '#30D158' }]}>
                      {isDomainsQuery ? 'EXPLORE SERVICE DOMAINS' : 'VERIFIED SUBCATEGORIES'}
                    </Text>
                  </View>
                  <Text style={[styles.heroServicesCount, { color: activeTheme.textSecondary }]}>
                    {listingServices.length} Services
                  </Text>
                </View>
                <Text style={[styles.heroTitleText, { color: activeTheme.textPrimary }]}>
                  {isDomainsQuery
                    ? (activeCategoryKey === 'all'
                        ? 'Browse All Verified Service Categories'
                        : `${activeCategoryKey.charAt(0).toUpperCase() + activeCategoryKey.slice(1)} Domain Services`)
                    : 'Browse All Verified Subcategories'}
                </Text>
                <Text style={[styles.heroSubtitleText, { color: activeTheme.textSecondary }]} numberOfLines={2}>
                  {isDomainsQuery
                    ? 'From automotive & mechanics to home living, domestic staff, lodging, and 24/7 emergency dispatch.'
                    : 'Explore all specialized service offerings by certified background-checked service partners.'}
                </Text>
              </View>
            </View>
          </GlassCard>
        </View>
      )}

      {/* EXPANDABLE FILTER DRAWER PANEL */}
      {filterDrawerOpen && (
        <View style={styles.filterDrawerWrap}>
          <GlassCard theme={theme} style={[styles.filterDrawerCard, { borderColor: activeTheme.cardBorder }]} intensity={activeTheme.glassIntensity}>
            {/* Sort Options */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterGroupLabel, { color: activeTheme.textSecondary }]}>Sort By</Text>
              <View style={styles.filterPillRow}>
                {[
                  { key: 'none', label: 'Default' },
                  { key: 'rating', label: 'Rating' },
                  { key: 'priceAsc', label: 'Price: Low' },
                  { key: 'priceDesc', label: 'Price: High' }
                ].map(item => {
                  const isSel = sortBy === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setSortBy(item.key as any)}
                      style={[
                        styles.filterPill,
                        isSel ? styles.filterPillActive : { borderColor: activeTheme.cardBorder }
                      ]}
                    >
                      <Text style={[styles.filterPillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Rating Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterGroupLabel, { color: activeTheme.textSecondary }]}>Minimum Rating</Text>
              <View style={styles.filterPillRow}>
                {[
                  { key: 0, label: 'All' },
                  { key: 4.0, label: '4.0★+' },
                  { key: 4.5, label: '4.5★+' }
                ].map(item => {
                  const isSel = minRating === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setMinRating(item.key)}
                      style={[
                        styles.filterPill,
                        isSel ? styles.filterPillActive : { borderColor: activeTheme.cardBorder }
                      ]}
                    >
                      <Text style={[styles.filterPillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Price Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterGroupLabel, { color: activeTheme.textSecondary }]}>Price Bracket</Text>
              <View style={styles.filterPillRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'under20', label: '< $20' },
                  { key: '20to50', label: '$20 - $50' },
                  { key: 'above50', label: '> $50' }
                ].map(item => {
                  const isSel = priceFilter === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setPriceFilter(item.key as any)}
                      style={[
                        styles.filterPill,
                        isSel ? styles.filterPillActive : { borderColor: activeTheme.cardBorder }
                      ]}
                    >
                      <Text style={[styles.filterPillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Mode Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterGroupLabel, { color: activeTheme.textSecondary }]}>Service Mode</Text>
              <View style={styles.filterPillRow}>
                {[
                  { key: 'all', label: 'All' },
                  { key: 'doorstep', label: 'At Doorstep' },
                  { key: 'shop', label: 'In Shop' }
                ].map(item => {
                  const isSel = serviceModeFilter === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      onPress={() => setServiceModeFilter(item.key as any)}
                      style={[
                        styles.filterPill,
                        isSel ? styles.filterPillActive : { borderColor: activeTheme.cardBorder }
                      ]}
                    >
                      <Text style={[styles.filterPillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Reset option */}
            <TouchableOpacity
              style={styles.resetFiltersButton}
              onPress={() => {
                setSortBy('none');
                setMinRating(0);
                setPriceFilter('all');
                setServiceModeFilter('all');
              }}
            >
              <Text style={[styles.resetFiltersText, { color: activeTheme.iconColor }]}>Reset All Filters</Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      )}

      {/* VERTICAL GRID/LIST OF SERVICES (IDENTICAL LAYOUT TO HOME PAGE CARDS) */}
      {(isLoading || isFirstLoad) ? (
        <ListingSkeleton theme={theme} activeTheme={activeTheme} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listingScrollContent}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={activeTheme.iconColor}
                colors={[activeTheme.iconColor]}
              />
            ) : undefined
          }
        >
          {listingServices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={48} color={activeTheme.textSecondary} style={styles.emptyIcon} />
              <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>No services match your filters</Text>
              <TouchableOpacity
                style={[styles.clearSearchBtn, { borderColor: activeTheme.cardBorder }]}
                onPress={() => {
                  setListingSearchQuery('');
                  setActiveCategoryKey('all');
                  setSortBy('none');
                  setMinRating(0);
                  setPriceFilter('all');
                  setServiceModeFilter('all');
                }}
              >
                <Text style={{ color: '#0084FF', fontSize: 13, fontWeight: '700' }}>Reset Filters</Text>
              </TouchableOpacity>
            </View>
          ) : (
            listingServices.map(service => {
              const isWish = wishlistIds?.includes(service.id);
              return (
                <GlassCard
                  key={service.id}
                  theme={theme}
                  style={[styles.serviceCardItem, { borderColor: activeTheme.cardBorder }]}
                  intensity={activeTheme.glassIntensity}
                >
                  {/* Service Top Row: Icon, Title, Badge, Rating & Wishlist Heart */}
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
                      style={[
                        styles.wishlistHeartBtn,
                        {
                          backgroundColor: isWish ? 'rgba(255, 59, 48, 0.12)' : activeTheme.inputBg,
                          borderColor: isWish ? '#FF3B30' : activeTheme.cardBorder
                        }
                      ]}
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
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.selectedCategoryKey === nextProps.selectedCategoryKey &&
    prevProps.initialQuery === nextProps.initialQuery &&
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
  listingScreenContainer: {
    flex: 1,
  },
  listingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  listingTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  headerPlaceholder: {
    width: 36,
  },
  listingSearchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  listingSearchCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 24,
    padding: 0,
  },
  filterToggleButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    position: 'relative',
  },
  filterBadgeIndicator: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  filterDrawerWrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  filterDrawerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  filterSection: {
    marginBottom: 14,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  filterPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
  filterPillActive: {
    backgroundColor: '#0084FF',
    borderColor: '#0084FF',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetFiltersButton: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetFiltersText: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  domainPillsWrapper: {
    marginBottom: 14,
  },
  domainPillsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  domainPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
  },
  domainPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroBannerWrap: {
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  heroBannerCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  heroBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBannerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroBadgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  heroBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroServicesCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  heroTitleText: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  heroSubtitleText: {
    fontSize: 11,
    lineHeight: 15,
  },
  listingScrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    marginBottom: 14,
  },
  clearSearchBtn: {
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
});
