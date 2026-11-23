import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Share,
  Image,
  Dimensions,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../components/GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 340);

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  activeTheme: any;
  onNavigateTab: (tab: 'home' | 'services' | 'bookings' | 'notifications' | 'profile') => void;
  onNavigateToPayment?: () => void;
  onNavigateToWishlist?: () => void;
  onNavigateToBlog?: () => void;
  onNavigateToContact?: () => void;
  onNavigateToVehicleWash?: (vehicleType?: string) => void;
  onNavigateToMaids?: () => void;
  onOpenAbout?: () => void;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  currentUser?: { id?: number; name: string; identity: string; phone?: string; email?: string; isLoggedIn: boolean };
  userProfile?: { profileImage: string | null; gender?: string; age?: number };
  onNavigateToCategory?: () => void;
  onNavigateToShop?: () => void;
  onNavigateToProduct?: () => void;
  onNavigateToAddress?: () => void;
  onNavigateToBookings?: () => void;
  onNavigateToAccount?: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  theme,
  activeTheme,
  onNavigateTab,
  onNavigateToPayment,
  onNavigateToWishlist,
  onNavigateToBlog,
  onNavigateToContact,
  onNavigateToVehicleWash,
  onNavigateToMaids,
  onOpenAbout,
  onOpenAuth,
  onLogout,
  currentUser,
  userProfile,
  onNavigateToCategory,
  onNavigateToShop,
  onNavigateToProduct,
  onNavigateToAddress,
  onNavigateToBookings,
  onNavigateToAccount
}: SidebarProps) {
  const insets = useSafeAreaInsets();
  const isLoggedIn = currentUser?.isLoggedIn ?? false;
  const userName = currentUser?.name && currentUser.name !== 'Guest User' ? currentUser.name : (isLoggedIn ? 'Verified Member' : 'Guest User');
  const userIdentity = currentUser?.identity || currentUser?.phone || currentUser?.email || '';

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Book verified local services with ServEasy - car wash, home cleaning, electricians, towing, and stays at your fingertips!',
      });
    } catch (error: any) {
      Alert.alert('Share Error', error.message);
    }
  };

  const handleSignOut = () => {
    onClose();
    if (onLogout) {
      onLogout();
    }
  };

  const menuItems: Array<{
    label: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    onPress: () => void;
    isDestructive?: boolean;
    badge?: string;
  }> = [
    {
      label: 'Home Services',
      icon: 'view-grid-plus-outline',
      onPress: () => {
        onNavigateTab('services');
        onClose();
      }
    },
    {
      label: 'All Categories',
      icon: 'shape-outline',
      onPress: () => {
        if (onNavigateToCategory) onNavigateToCategory();
        else onNavigateTab('home');
        onClose();
      }
    },
    {
      label: 'Saved Favourites',
      icon: 'heart-outline',
      onPress: () => {
        if (onNavigateToWishlist) onNavigateToWishlist();
        else onNavigateTab('home');
        onClose();
      }
    },
    {
      label: 'My Bookings',
      icon: 'calendar-check-outline',
      onPress: () => {
        if (onNavigateToBookings) onNavigateToBookings();
        else onNavigateTab('bookings');
        onClose();
      }
    },
    {
      label: 'Saved Addresses',
      icon: 'map-marker-outline',
      onPress: () => {
        if (onNavigateToAddress) onNavigateToAddress();
        else onNavigateTab('profile');
        onClose();
      }
    },
    {
      label: 'My Account & Profile',
      icon: 'account-outline',
      onPress: () => {
        if (onNavigateToAccount) onNavigateToAccount();
        else onNavigateTab('profile');
        onClose();
      }
    },
    {
      label: 'ServEasy Blog',
      icon: 'book-open-page-variant-outline',
      onPress: () => {
        if (onNavigateToBlog) onNavigateToBlog();
        onClose();
      }
    },
    {
      label: 'Contact Support',
      icon: 'phone-outline',
      onPress: () => {
        if (onNavigateToContact) onNavigateToContact();
        onClose();
      }
    },
    {
      label: 'About ServEasy',
      icon: 'information-outline',
      onPress: () => {
        if (onOpenAbout) onOpenAbout();
        onClose();
      }
    },
    {
      label: 'Share ServEasy App',
      icon: 'share-variant-outline',
      onPress: () => {
        handleShareApp();
        onClose();
      }
    }
  ];

  return (
    <Modal
      visible={isOpen}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        {/* Fullscreen touchable backdrop to dismiss */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        {/* Sidebar Drawer Card positioned strictly within safe area */}
        <View
          style={[
            styles.sidebarPanelWrapper,
            {
              top: insets.top,
              bottom: insets.bottom,
              right: insets.right,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <GlassCard
            theme={theme}
            style={[
              styles.sidebarPanel,
              {
                borderTopRightRadius: insets.top > 0 ? 20 : 0,
                borderBottomRightRadius: insets.bottom > 0 ? 20 : 0,
              },
            ]}
            intensity={activeTheme.glassIntensity}
          >
            {/* Header */}
            <View style={[styles.sidebarHeader, { borderBottomColor: activeTheme.cardBorder }]}>
              <View style={styles.brandRow}>
                <View style={[styles.brandDot, { backgroundColor: '#30D158' }]} />
                <Text style={[styles.sidebarTitle, { color: activeTheme.textPrimary }]}>Menu Options</Text>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeButton, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={18} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Profile Summary Card */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                onClose();
                if (!isLoggedIn && onOpenAuth) {
                  onOpenAuth();
                } else {
                  onNavigateTab('profile');
                }
              }}
              style={[
                styles.profileCard,
                {
                  backgroundColor: activeTheme.pillInactiveBg,
                  borderColor: isLoggedIn ? 'rgba(48, 209, 88, 0.35)' : activeTheme.cardBorder
                }
              ]}
            >
              <View style={[styles.avatarBox, { borderColor: isLoggedIn ? '#30D158' : activeTheme.cardBorder }]}>
                {userProfile?.profileImage ? (
                  <Image source={{ uri: userProfile.profileImage }} style={styles.avatarImage} />
                ) : (
                  <MaterialCommunityIcons
                    name={isLoggedIn ? 'account-check' : 'account-circle-outline'}
                    size={28}
                    color={isLoggedIn ? '#30D158' : activeTheme.iconColor}
                  />
                )}
              </View>

              <View style={styles.profileDetails}>
                <Text style={[styles.profileName, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                  {userName}
                </Text>
                <Text
                  style={[styles.profileTier, { color: isLoggedIn ? '#30D158' : '#0084FF' }]}
                  numberOfLines={1}
                >
                  {isLoggedIn ? (userIdentity ? `● ${userIdentity}` : '● Verified Member') : 'Tap to Sign In / Register'}
                </Text>
              </View>

              <MaterialCommunityIcons
                name="chevron-right"
                size={18}
                color={activeTheme.textSecondary}
                style={{ marginLeft: 'auto' }}
              />
            </TouchableOpacity>

            {/* Menu List */}
            <ScrollView
              style={styles.menuScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              {menuItems.map((item, index) => {
                const isDestructive = !!item.isDestructive;
                const labelColor = isDestructive ? '#FF3B30' : activeTheme.textPrimary;
                const iconColor = isDestructive ? '#FF3B30' : activeTheme.iconColor;

                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.menuItem,
                      { borderBottomColor: activeTheme.cardBorder },
                      isDestructive && {
                        backgroundColor: 'rgba(255, 59, 48, 0.08)',
                        borderRadius: 12,
                        marginVertical: 4,
                        paddingHorizontal: 12,
                        borderBottomWidth: 0,
                      }
                    ]}
                    onPress={item.onPress}
                  >
                    <View style={styles.menuItemLeft}>
                      <MaterialCommunityIcons
                        name={item.icon}
                        size={20}
                        color={iconColor}
                        style={styles.menuItemIcon}
                      />
                      <Text style={[styles.menuItemLabel, { color: labelColor }]}>
                        {item.label}
                      </Text>
                    </View>

                    <View style={styles.menuItemRight}>
                      {item.badge && (
                        <View style={styles.itemBadge}>
                          <Text style={styles.itemBadgeText}>{item.badge}</Text>
                        </View>
                      )}
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={18}
                        color={isDestructive ? '#FF3B30' : activeTheme.textSecondary}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Footer with Persistent Logout or Login Button */}
            <View style={[styles.sidebarFooter, { borderTopColor: activeTheme.cardBorder }]}>
              {isLoggedIn ? (
                <TouchableOpacity
                  onPress={handleSignOut}
                  style={[
                    styles.actionButton,
                    {
                      borderColor: '#FF3B30',
                      backgroundColor: 'rgba(255, 59, 48, 0.12)'
                    }
                  ]}
                >
                  <MaterialCommunityIcons name="logout" size={18} color="#FF3B30" style={styles.actionIcon} />
                  <Text style={[styles.actionText, { color: '#FF3B30' }]}>Logout</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    onClose();
                    if (onOpenAuth) onOpenAuth();
                  }}
                  style={[
                    styles.actionButton,
                    {
                      borderColor: '#0084FF',
                      backgroundColor: 'rgba(0, 132, 255, 0.12)'
                    }
                  ]}
                >
                  <MaterialCommunityIcons name="login" size={18} color="#0084FF" style={styles.actionIcon} />
                  <Text style={[styles.actionText, { color: '#0084FF' }]}>Sign In / Register</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.appVersion, { color: activeTheme.textSecondary }]}>v1.3.0 (ServEasy Mobile)</Text>
            </View>
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  dismissOverlay: {
    flex: 1,
  },
  sidebarPanelWrapper: {
    position: 'absolute',
    width: SIDEBAR_WIDTH,
  },
  sidebarPanel: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    borderLeftWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  sidebarTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileDetails: {
    marginLeft: 12,
    flex: 1,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '800',
  },
  profileTier: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  menuScroll: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 0.5,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuItemIcon: {
    marginRight: 12,
  },
  menuItemLabel: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 6,
  },
  itemBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FF3B30',
  },
  sidebarFooter: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  actionIcon: {
    marginRight: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
  },
  appVersion: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
