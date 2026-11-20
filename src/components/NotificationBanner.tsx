import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export interface NotificationBannerProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'alert';
  appLabel?: string;
  onClose: () => void;
  onPress?: () => void;
  duration?: number;
}

export function NotificationBanner({
  visible,
  title,
  message,
  type = 'success',
  appLabel = 'ServEasy • Just now',
  onClose,
  onPress,
  duration = 4000,
}: NotificationBannerProps) {
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide down and fade in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-140);
      opacity.setValue(0);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  const getAccentColor = () => {
    switch (type) {
      case 'success':
        return '#10B981';
      case 'alert':
        return '#EF4444';
      case 'warning':
        return '#F59E0B';
      default:
        return '#3B82F6';
    }
  };

  const getIconName = () => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'alert':
        return 'alert-circle';
      case 'warning':
        return 'alert';
      default:
        return 'bell-ring';
    }
  };

  const accentColor = getAccentColor();

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (onPress) onPress();
          handleDismiss();
        }}
        style={[styles.container, { borderColor: accentColor }]}
      >
        {/* Top Header Row (App identity & dismiss icon) */}
        <View style={styles.headerRow}>
          <View style={styles.appIdentity}>
            <View style={[styles.iconBadge, { backgroundColor: accentColor }]}>
              <MaterialCommunityIcons name={getIconName()} size={13} color="#FFFFFF" />
            </View>
            <Text style={styles.appLabelText}>{appLabel}</Text>
          </View>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleDismiss}
            style={styles.closeBtn}
          >
            <MaterialCommunityIcons name="close" size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        <View style={styles.contentBody}>
          <Text style={styles.titleText} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.messageText} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 32,
    left: 12,
    right: 12,
    zIndex: 999999,
    elevation: 25,
  },
  container: {
    backgroundColor: '#181D27',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  appIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBadge: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },
  appLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 2,
  },
  contentBody: {
    marginTop: 2,
  },
  titleText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
    fontWeight: '400',
  },
});
