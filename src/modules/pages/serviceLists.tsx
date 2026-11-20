import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  RefreshControl,
  FlatList,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';
import { ListingSkeleton } from '../../components/SkeletonLoader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
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

interface ServiceListsProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  currentUser?: any;
  servicesList: ServiceItem[];
  onOpenBooking: (service: ServiceItem) => void;
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  wishlistIds?: string[];
  onToggleWishlist?: (serviceId: string) => void;
}

// ─── Category metadata ─────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',        label: 'All',         icon: 'view-grid-outline' as const },
  { key: 'home',       label: 'Home',        icon: 'home-outline' as const },
  { key: 'automotive', label: 'Auto',        icon: 'car-outline' as const },
  { key: 'care',       label: 'Care',        icon: 'account-heart-outline' as const },
  { key: 'transport',  label: 'Transport',   icon: 'truck-outline' as const },
  { key: 'food',       label: 'Food',        icon: 'silverware-fork-knife' as const },
  { key: 'stay',       label: 'Stay',        icon: 'bed-outline' as const },
  { key: 'emergency',  label: 'SOS',         icon: 'alert-decagram-outline' as const },
];

const MODES = [
  { key: 'all',      label: 'All Modes' },
  { key: 'doorstep', label: 'Doorstep' },
  { key: 'shop',     label: 'At Shop' },
  { key: 'both',     label: 'Both' },
];

const SORT_OPTIONS = [
  { key: 'default',    label: 'Default' },
  { key: 'rating',     label: 'Top Rated' },
  { key: 'price_asc',  label: 'Price ↑' },
  { key: 'price_desc', label: 'Price ↓' },
  { key: 'reviews',    label: 'Most Reviews' },
];

// ─── Category color map ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  home:       '#0084FF',
  automotive: '#FF9F0A',
  care:       '#30D158',
  transport:  '#5E5CE6',
  food:       '#FF6B35',
  stay:       '#64D2FF',
  emergency:  '#FF453A',
  all:        '#0084FF',
};

// ─── Main Component (Memoized for instant 0ms switching) ───────────────────
export const ServiceLists = React.memo(function ServiceLists({
  theme,
  activeTheme,
  currentUser,
  servicesList,
  onOpenBooking,
  isLoading,
  refreshing,
  onRefresh,
  wishlistIds,
  onToggleWishlist,
}: ServiceListsProps) {
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsFirstLoad(false), 450);
    return () => clearTimeout(timer);
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeMode, setActiveMode] = useState('all');
  const [sortBy, setSortBy] = useState('default');
  const [minRating, setMinRating] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const filterPanelHeight = useRef(new Animated.Value(0)).current;
  const filterOpacity = useRef(new Animated.Value(0)).current;

  const toggleFilters = () => {
    const nextShow = !showFilters;
    setShowFilters(nextShow);
    Animated.parallel([
      Animated.timing(filterPanelHeight, {
        toValue: nextShow ? 1 : 0,
        duration: 280,
        useNativeDriver: false,
      }),
      Animated.timing(filterOpacity, {
        toValue: nextShow ? 1 : 0,
        duration: 240,
        useNativeDriver: false,
      }),
    ]).start();
  };

  // ── Filtering + Sorting ──────────────────────────────────────────────────────
  const filteredServices = useMemo(() => {
    let result = servicesList.filter(s => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.toLowerCase().includes(q) ||
        s.badge.toLowerCase().includes(q);

      const matchCat = activeCategory === 'all' || s.category === activeCategory;
      const matchMode = activeMode === 'all' || s.mode === activeMode;
      const matchRating = s.rating >= minRating;

      return matchSearch && matchCat && matchMode && matchRating;
    });

    switch (sortBy) {
      case 'rating':     result = [...result].sort((a, b) => b.rating - a.rating); break;
      case 'price_asc':  result = [...result].sort((a, b) => a.packages[0].price - b.packages[0].price); break;
      case 'price_desc': result = [...result].sort((a, b) => b.packages[0].price - a.packages[0].price); break;
      case 'reviews':    result = [...result].sort((a, b) => b.reviewCount - a.reviewCount); break;
    }
    return result;
  }, [servicesList, searchQuery, activeCategory, activeMode, sortBy, minRating]);

  const activeFiltersCount = [
    activeCategory !== 'all',
    activeMode !== 'all',
    sortBy !== 'default',
    minRating > 0,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setActiveCategory('all');
    setActiveMode('all');
    setSortBy('default');
    setMinRating(0);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  if (isFirstLoad || (isLoading && (!servicesList || servicesList.length === 0))) {
    return <ListingSkeleton theme={theme} activeTheme={activeTheme} />;
  }

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: activeTheme.textPrimary }]}>
            All Services
          </Text>
          <Text style={[styles.headerSubtitle, { color: activeTheme.textSecondary }]}>
            {filteredServices.length} available
          </Text>
        </View>
        <View style={styles.headerActions}>
          {/* View mode toggle */}
          <TouchableOpacity
            style={[styles.iconBtn, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.inputBg }]}
            onPress={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
          >
            <MaterialCommunityIcons
              name={viewMode === 'list' ? 'view-grid-outline' : 'view-list-outline'}
              size={18}
              color={activeTheme.iconColor}
            />
          </TouchableOpacity>

          {/* Filter toggle */}
          <TouchableOpacity
            style={[
              styles.filterBtn,
              {
                borderColor: showFilters ? '#0084FF' : activeTheme.cardBorder,
                backgroundColor: showFilters ? 'rgba(0,132,255,0.12)' : activeTheme.inputBg,
              }
            ]}
            onPress={toggleFilters}
          >
            <MaterialCommunityIcons
              name="tune-variant"
              size={16}
              color={showFilters ? '#0084FF' : activeTheme.iconColor}
            />
            <Text style={[styles.filterBtnText, { color: showFilters ? '#0084FF' : activeTheme.textSecondary }]}>
              Filter
            </Text>
            {activeFiltersCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFiltersCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search Bar ── */}
      <GlassCard theme={theme} style={[styles.searchCard, { borderColor: activeTheme.cardBorder }]} intensity={16}>
        <View style={styles.searchRow}>
          <MaterialCommunityIcons name="magnify" size={20} color={activeTheme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: activeTheme.textPrimary }]}
            placeholder="Search services, keywords…"
            placeholderTextColor={activeTheme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={activeTheme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </GlassCard>

      {/* ── Category Pills ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pillsScroll}
        contentContainerStyle={styles.pillsContent}
      >
        {CATEGORIES.map(cat => {
          const isActive = activeCategory === cat.key;
          const color = CATEGORY_COLORS[cat.key] || '#0084FF';
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryPill,
                {
                  backgroundColor: isActive ? color : activeTheme.inputBg,
                  borderColor: isActive ? color : activeTheme.cardBorder,
                }
              ]}
              onPress={() => setActiveCategory(cat.key)}
            >
              <MaterialCommunityIcons
                name={cat.icon}
                size={14}
                color={isActive ? '#FFFFFF' : activeTheme.textSecondary}
              />
              <Text style={[styles.pillText, { color: isActive ? '#FFFFFF' : activeTheme.textSecondary }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Collapsible Advanced Filters ── */}
      <Animated.View
        style={[
          styles.filterPanel,
          {
            maxHeight: filterPanelHeight.interpolate({ inputRange: [0, 1], outputRange: [0, 400] }),
            opacity: filterOpacity,
            borderColor: activeTheme.cardBorder,
            backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,132,255,0.03)',
          }
        ]}
      >
        {/* Mode filter */}
        <Text style={[styles.filterSectionLabel, { color: activeTheme.textSecondary }]}>Service Mode</Text>
        <View style={styles.filterRow}>
          {MODES.map(m => {
            const isActive = activeMode === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? '#0084FF' : activeTheme.inputBg,
                    borderColor: isActive ? '#0084FF' : activeTheme.cardBorder,
                  }
                ]}
                onPress={() => setActiveMode(m.key)}
              >
                <Text style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : activeTheme.textSecondary }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sort filter */}
        <Text style={[styles.filterSectionLabel, { color: activeTheme.textSecondary }]}>Sort By</Text>
        <View style={styles.filterRow}>
          {SORT_OPTIONS.map(opt => {
            const isActive = sortBy === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? '#5E5CE6' : activeTheme.inputBg,
                    borderColor: isActive ? '#5E5CE6' : activeTheme.cardBorder,
                  }
                ]}
                onPress={() => setSortBy(opt.key)}
              >
                <Text style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : activeTheme.textSecondary }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Minimum rating */}
        <Text style={[styles.filterSectionLabel, { color: activeTheme.textSecondary }]}>
          Min Rating: {minRating > 0 ? `★ ${minRating}+` : 'Any'}
        </Text>
        <View style={styles.filterRow}>
          {[0, 3, 3.5, 4, 4.5].map(r => {
            const isActive = minRating === r;
            return (
              <TouchableOpacity
                key={r}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isActive ? '#FFD700' : activeTheme.inputBg,
                    borderColor: isActive ? '#FFD700' : activeTheme.cardBorder,
                  }
                ]}
                onPress={() => setMinRating(r)}
              >
                <Text style={[styles.filterChipText, { color: isActive ? '#000' : activeTheme.textSecondary }]}>
                  {r === 0 ? 'Any' : `${r}+`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reset button */}
        {activeFiltersCount > 0 && (
          <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
            <MaterialCommunityIcons name="refresh" size={14} color="#FF453A" />
            <Text style={styles.resetBtnText}>Reset All Filters</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* ── Results List ── */}
      <FlatList
        data={filteredServices}
        keyExtractor={item => item.id}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        contentContainerStyle={[
          styles.listContent,
          viewMode === 'grid' && styles.gridContent,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#0084FF"
            colors={['#0084FF']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="magnify-close" size={52} color={activeTheme.textSecondary} />
            <Text style={[styles.emptyTitle, { color: activeTheme.textPrimary }]}>No Services Found</Text>
            <Text style={[styles.emptyDesc, { color: activeTheme.textSecondary }]}>
              Try adjusting your search or filters
            </Text>
            <TouchableOpacity style={styles.emptyResetBtn} onPress={resetFilters}>
              <Text style={styles.emptyResetText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) =>
          viewMode === 'list'
            ? (
              <ServiceListCard
                service={item}
                theme={theme}
                activeTheme={activeTheme}
                onOpenBooking={onOpenBooking}
                isWishlisted={wishlistIds?.includes(item.id)}
                onToggleWishlist={onToggleWishlist}
              />
            ) : (
              <ServiceGridCard
                service={item}
                theme={theme}
                activeTheme={activeTheme}
                onOpenBooking={onOpenBooking}
                isWishlisted={wishlistIds?.includes(item.id)}
                onToggleWishlist={onToggleWishlist}
              />
            )
        }
      />
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.refreshing === nextProps.refreshing &&
    prevProps.servicesList === nextProps.servicesList &&
    prevProps.wishlistIds?.length === nextProps.wishlistIds?.length &&
    prevProps.currentUser?.isLoggedIn === nextProps.currentUser?.isLoggedIn &&
    prevProps.currentUser?.id === nextProps.currentUser?.id
  );
});

// ─── List Card ────────────────────────────────────────────────────────────────
function ServiceListCard({
  service,
  theme,
  activeTheme,
  onOpenBooking,
  isWishlisted,
  onToggleWishlist,
}: {
  service: ServiceItem;
  theme: 'dark' | 'light';
  activeTheme: any;
  onOpenBooking: (s: ServiceItem) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
}) {
  const categoryColor = CATEGORY_COLORS[service.category] || '#0084FF';
  const modeIcon =
    service.mode === 'doorstep' ? 'home-map-marker' :
    service.mode === 'shop'     ? 'store-outline' : 'swap-horizontal';

  return (
    <GlassCard
      theme={theme}
      style={[styles.listCard, { borderColor: activeTheme.cardBorder }]}
      intensity={18}
    >
      {/* Header row */}
      <View style={styles.cardHeaderRow}>
        <View style={[styles.iconCircle, { backgroundColor: `${categoryColor}20` }]}>
          <MaterialCommunityIcons name={service.icon} size={24} color={'#0084FF'} />
        </View>
        <View style={styles.cardHeaderMeta}>
          <Text style={[styles.cardName, { color: activeTheme.textPrimary }]} numberOfLines={1}>
            {service.name}
          </Text>
          <View style={styles.metaRow}>
            <View style={[styles.badge, { backgroundColor: '#0084FF20', borderColor: '#0084FF40' }]}>
              <Text style={[styles.badgeText, { color: '#0084FF' }]}>{service.badge}</Text>
            </View>
            <View style={styles.modeTag}>
              <MaterialCommunityIcons name={modeIcon} size={11} color={activeTheme.textSecondary} />
              <Text style={[styles.modeTagText, { color: activeTheme.textSecondary }]}>
                {service.mode === 'both' ? 'Both' : service.mode === 'doorstep' ? 'Doorstep' : 'At Shop'}
              </Text>
            </View>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={() => onToggleWishlist?.(service.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: 2, marginBottom: 4 }}
          >
            <MaterialCommunityIcons
              name={isWishlisted ? 'heart' : 'heart-outline'}
              size={18}
              color={isWishlisted ? '#FF3B30' : activeTheme.textSecondary}
            />
          </TouchableOpacity>
          <View style={styles.ratingBlock}>
            <MaterialCommunityIcons name="star" size={13} color="#FFD700" />
            <Text style={[styles.ratingText, { color: activeTheme.textPrimary }]}>{service.rating}</Text>
            <Text style={[styles.reviewText, { color: activeTheme.textSecondary }]}>({service.reviewCount})</Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <Text style={[styles.cardDesc, { color: activeTheme.textSecondary }]} numberOfLines={2}>
        {service.description}
      </Text>

      {/* Packages preview */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.packagesScroll}>
        {service.packages.slice(0, 4).map(pkg => (
          <View
            key={pkg.id}
            style={[styles.pkgChip, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}
          >
            <Text style={[styles.pkgChipText, { color: activeTheme.textSecondary }]} numberOfLines={1}>
              {pkg.name}
            </Text>
            <Text style={[styles.pkgChipPrice, { color: '#0084FF' }]}>
              {pkg.price === 0 ? 'Free' : `$${pkg.price}`}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.cardFooter, { borderTopColor: activeTheme.cardBorder }]}>
        <View>
          <Text style={[styles.fromLabel, { color: activeTheme.textSecondary }]}>{service.priceLabel}</Text>
          <Text style={[styles.fromPrice, { color: '#0084FF' }]}>{service.priceValue}</Text>
        </View>
        <TouchableOpacity
          style={[styles.bookBtn, { backgroundColor: '#0084FF' }]}
          onPress={() => onOpenBooking(service)}
          activeOpacity={0.8}
        >
          {service.category === 'emergency' ? (
            <MaterialCommunityIcons name="alert-decagram" size={14} color="#FFF" style={{ marginRight: 4 }} />
          ) : null}
          <Text style={styles.bookBtnText}>
            {service.category === 'emergency' ? 'DISPATCH SOS' : 'BOOK NOW'}
          </Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

// ─── Grid Card ────────────────────────────────────────────────────────────────
function ServiceGridCard({
  service,
  theme,
  activeTheme,
  onOpenBooking,
  isWishlisted,
  onToggleWishlist,
}: {
  service: ServiceItem;
  theme: 'dark' | 'light';
  activeTheme: any;
  onOpenBooking: (s: ServiceItem) => void;
  isWishlisted?: boolean;
  onToggleWishlist?: (id: string) => void;
}) {
  const categoryColor = CATEGORY_COLORS[service.category] || '#0084FF';
  const accent = service.category === 'emergency' ? '#FF453A' : '#0084FF';

  return (
    <GlassCard
      theme={theme}
      style={[styles.gridCard, { borderColor: activeTheme.cardBorder }]}
      intensity={18}
    >
      <TouchableOpacity
        style={styles.gridHeartBtn}
        onPress={() => onToggleWishlist?.(service.id)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <MaterialCommunityIcons
          name={isWishlisted ? 'heart' : 'heart-outline'}
          size={16}
          color={isWishlisted ? '#FF3B30' : activeTheme.textSecondary}
        />
      </TouchableOpacity>
      <View style={[styles.gridIconCircle, { backgroundColor: `${categoryColor}22` }]}>
        <MaterialCommunityIcons name={service.icon} size={28} color={accent} />
      </View>
      <Text style={[styles.gridName, { color: activeTheme.textPrimary }]} numberOfLines={2}>
        {service.name}
      </Text>
      <View style={styles.gridRatingRow}>
        <MaterialCommunityIcons name="star" size={11} color="#FFD700" />
        <Text style={[styles.gridRating, { color: activeTheme.textPrimary }]}>{service.rating}</Text>
      </View>
      <Text style={[styles.gridPrice, { color: activeTheme.textPrimary }]}>{service.priceValue}</Text>
      <TouchableOpacity
        style={[styles.gridBookBtn, { backgroundColor: accent }]}
        onPress={() => onOpenBooking(service)}
        activeOpacity={0.8}
      >
        <Text style={styles.gridBookBtnText}>Book</Text>
      </TouchableOpacity>
    </GlassCard>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: '#0084FF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  searchCard: {
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 24,
    padding: 0,
  },
  pillsScroll: {
    height: 46,
    marginBottom: 12,
  },
  pillsContent: {
    paddingHorizontal: 4,
    paddingRight: 16,
    alignItems: 'center',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterPanel: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  filterSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 14,
    gap: 4,
    alignSelf: 'flex-start',
  },
  resetBtnText: {
    fontSize: 12,
    color: '#FF453A',
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: 120,
    gap: 10,
  },
  gridContent: {
    gap: 10,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyResetBtn: {
    marginTop: 16,
    backgroundColor: '#0084FF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyResetText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // List card
  listCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 10,
  },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardHeaderMeta: {
    flex: 1,
    gap: 5,
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  modeTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  ratingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '700',
  },
  reviewText: {
    fontSize: 11,
  },
  cardDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  packagesScroll: {
    marginBottom: 10,
  },
  pkgChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 6,
    minWidth: 80,
  },
  pkgChipText: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 1,
  },
  pkgChipPrice: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
  },
  fromLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    color: '#A0A5AD',
  },
  fromPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: 'center',
  },
  bookBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Grid card
  gridCard: {
    flex: 1,
    margin: 5,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  gridIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  gridName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
    lineHeight: 16,
  },
  gridRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 4,
  },
  gridRating: {
    fontSize: 12,
    fontWeight: '700',
  },
  gridPrice: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  gridBookBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  gridBookBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '800',
  },
  gridHeartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    padding: 4,
  },
});
