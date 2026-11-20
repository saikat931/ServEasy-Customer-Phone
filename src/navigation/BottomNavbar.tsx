import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../components/GlassCard';

interface BottomNavbarProps {
  activeTab: 'home' | 'services' | 'bookings' | 'notifications' | 'profile';
  onTabSelect: (tab: 'home' | 'services' | 'bookings' | 'notifications' | 'profile') => void;
  activeTheme: any;
  theme: 'dark' | 'light';
}

export function BottomNavbar({ activeTab, onTabSelect, activeTheme, theme }: BottomNavbarProps) {
  const tabs = [
    {
      key: 'home' as const,
      label: 'Home',
      iconOutline: 'home-outline' as const,
      iconFilled: 'home' as const,
    },
    {
      key: 'services' as const,
      label: 'Services',
      iconOutline: 'view-grid-plus-outline' as const,
      iconFilled: 'view-grid-plus' as const,
    },
    {
      key: 'bookings' as const,
      label: 'Bookings',
      iconOutline: 'calendar-blank-outline' as const,
      iconFilled: 'calendar-blank' as const,
    },
    {
      key: 'notifications' as const,
      label: 'Alerts',
      iconOutline: 'bell-outline' as const,
      iconFilled: 'bell' as const,
    },
    {
      key: 'profile' as const,
      label: 'Profile',
      iconOutline: 'account-outline' as const,
      iconFilled: 'account' as const,
    },
  ];

  return (
    <View style={styles.navWrapper}>
      <GlassCard theme={theme} style={styles.navContainer} intensity={activeTheme.glassIntensity}>
        <View style={styles.tabBar}>
          {tabs.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => onTabSelect(tab.key)}
                style={styles.tabButton}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={isActive ? tab.iconFilled : tab.iconOutline}
                  size={22}
                  color={isActive ? '#0084FF' : activeTheme.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? '#0084FF' : activeTheme.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  navWrapper: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 12,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  navContainer: {
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    flex: 1,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 0.2,
  },
});
