import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, Animated, Easing } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';

interface TopNavbarProps {
  theme: 'dark' | 'light';
  onThemeToggle: () => void;
  onMenuPress: () => void;
  activeTheme: any;
  userProfile?: {
    profileImage: string | null;
    gender: 'male' | 'female' | 'other';
    age: number;
  };
  wishlistCount?: number;
  onWishlistPress?: () => void;
  onLogoPress?: () => void;
  onProfilePress?: () => void;
}

interface AnimatedAvatarProps {
  gender: 'male' | 'female' | 'other';
  age: number;
  activeTheme: any;
}

export function AnimatedAvatar({ gender, age, activeTheme }: AnimatedAvatarProps) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  const rotateAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    // Pulse animation (breathing effect)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotate animation (spinning aura background)
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim, rotateAnim]);

  // Determine fallback profile image and gradient colors based on age & gender
  let imageUri = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80'; // default other
  let gradientColors: readonly [string, string, ...string[]] = ['#AF52DE', '#FF2D55']; // default 'other'

  if (gender === 'male') {
    gradientColors = ['#0084FF', '#00C6FF'];
    if (age < 12) {
      // Kid boy
      imageUri = 'https://images.unsplash.com/photo-1503919545889-aef636e10ad4?auto=format&fit=crop&w=120&q=80';
    } else if (age < 20) {
      // Teen boy
      imageUri = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80';
    } else if (age < 60) {
      // Adult man
      imageUri = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80';
    } else {
      // Senior man
      imageUri = 'https://images.unsplash.com/photo-1472417583565-62e7bdeda490?auto=format&fit=crop&w=120&q=80';
    }
  } else if (gender === 'female') {
    gradientColors = ['#FF2D55', '#FF7300'];
    if (age < 12) {
      // Kid girl
      imageUri = 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&w=120&q=80';
    } else if (age < 20) {
      // Teen girl
      imageUri = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80';
    } else if (age < 60) {
      // Adult woman
      imageUri = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80';
    } else {
      // Senior woman
      imageUri = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80';
    }
  }

  // Spin rotation interpolation
  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.avatarWrapper}>
      {/* Animated spinning background aura */}
      <Animated.View
        style={[
          styles.spinningAura,
          {
            transform: [{ rotate: spin }],
          },
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          style={styles.auraGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* Pulsing avatar image container */}
      <Animated.View
        style={[
          styles.avatarImageContainer,
          {
            transform: [{ scale: pulseAnim }],
            borderColor: activeTheme.cardBorder,
          },
        ]}
      >
        <Image source={{ uri: imageUri }} style={styles.innerAvatarImage} />
      </Animated.View>
    </View>
  );
}

export function TopNavbar({
  theme,
  onThemeToggle,
  onMenuPress,
  activeTheme,
  userProfile,
  wishlistCount,
  onWishlistPress,
  onLogoPress,
  onProfilePress,
}: TopNavbarProps) {
  const profile = userProfile || { profileImage: null, gender: 'female' as const, age: 24 };

  const pulseAnim = React.useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.06,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <View style={styles.headerContainer}>
      <TouchableOpacity
        activeOpacity={onLogoPress ? 0.7 : 1}
        onPress={onLogoPress}
        style={styles.headerLeft}
      >
        <Image source={require('../../assets/logo.png')} style={styles.headerLogoImage} />
      </TouchableOpacity>
      <View style={styles.headerRight}>

        <TouchableOpacity
          onPress={onThemeToggle}
          style={[styles.themeToggleButton, { backgroundColor: activeTheme.pillInactiveBg }]}
        >
          <MaterialCommunityIcons
            name={theme === 'dark' ? 'weather-sunny' : 'weather-night'}
            size={18}
            color={activeTheme.iconColor}
          />
        </TouchableOpacity>

        {/* Profile Image placed between theme toggle and menu - wrapped in TouchableOpacity to link globally to My Profile */}
        <TouchableOpacity
          activeOpacity={onProfilePress ? 0.7 : 1}
          onPress={onProfilePress}
          style={styles.avatarTouchable}
          accessibilityRole="button"
          accessibilityLabel="Open My Profile"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {profile.profileImage ? (
            <Animated.View style={[styles.avatarWrapper, { transform: [{ scale: pulseAnim }] }]}>
              <Image
                source={{ uri: profile.profileImage }}
                style={[styles.profileImage, { borderColor: activeTheme.cardBorder }]}
              />
            </Animated.View>
          ) : (
            <AnimatedAvatar
              gender={profile.gender}
              age={profile.age}
              activeTheme={activeTheme}
            />
          )}
        </TouchableOpacity>

        {/* Hamburger Menu Button */}
        <TouchableOpacity
          onPress={onMenuPress}
          style={[styles.hamburgerButton, { backgroundColor: activeTheme.pillInactiveBg }]}
        >
          <MaterialCommunityIcons
            name="menu"
            size={22}
            color={activeTheme.iconColor}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogoImage: {
    width: 140,
    height: 35,
    resizeMode: 'contain',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  themeToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  navWishlistBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FF2D55',
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navWishlistBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  hamburgerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  avatarTouchable: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  spinningAura: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  auraGradient: {
    flex: 1,
  },
  avatarImageContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1.5,
    zIndex: 2,
  },
  innerAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  profileImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    resizeMode: 'cover',
  },
});
