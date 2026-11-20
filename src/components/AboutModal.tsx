import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  Dimensions,
  Platform,
  Linking
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from './GlassCard';

interface AboutModalProps {
  visible: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  activeTheme: any;
}

export function AboutModal({ visible, onClose, theme, activeTheme }: AboutModalProps) {
  const pillars = [
    {
      icon: 'shield-check-outline',
      title: '100% Verified Experts',
      desc: 'Rigorous national ID checks, background screenings, and certified skills tests before any expert is dispatched.',
      color: '#30D158'
    },
    {
      icon: 'cash-check',
      title: 'Transparent Fair Pricing',
      desc: 'Zero hidden booking fees, upfront package quotations, and guaranteed value on every doorstep or in-shop service.',
      color: '#0084FF'
    },
    {
      icon: 'lightning-bolt-circle',
      title: '24/7 Rapid SOS Dispatch',
      desc: 'Immediate emergency towing, roadside assistance, security alarms, and locksmith support around the clock.',
      color: '#FF453A'
    },
    {
      icon: 'thumb-up-outline',
      title: 'Quality & Service Guarantee',
      desc: 'Every completed service is backed by our full customer happiness warranty and dedicated concierge desk.',
      color: '#AF52DE'
    }
  ];

  const stats = [
    { num: '15,000+', label: 'Happy Customers' },
    { num: '4.9 ★', label: 'Average Rating' },
    { num: '500+', label: 'Verified Partners' },
    { num: '24/7', label: 'Concierge Desk' }
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <GlassCard theme={theme} style={styles.modalContainer} intensity={activeTheme.glassIntensity + 10}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: activeTheme.cardBorder }]}>
            <Text style={[styles.headerTitle, { color: activeTheme.textPrimary }]}>About ServEasy</Text>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: activeTheme.pillInactiveBg }]}
            >
              <MaterialCommunityIcons name="close" size={20} color={activeTheme.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Logo & Headline */}
            <View style={styles.brandHero}>
              <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
              <Text style={[styles.brandTitle, { color: activeTheme.textPrimary }]}>
                ServEasy Local Service Platform
              </Text>
              <Text style={[styles.brandSubtitle, { color: activeTheme.textSecondary }]}>
                From mechanical care and private room booking to professional personal assistance, emergency help, and logistics. Book trusted services instantly with transparent booking.
              </Text>
            </View>

            {/* Metrics Bar */}
            <View style={[styles.statsRow, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.inputBg }]}>
              {stats.map((s, idx) => (
                <View key={idx} style={styles.statCol}>
                  <Text style={[styles.statNum, { color: '#0084FF' }]}>{s.num}</Text>
                  <Text style={[styles.statLabel, { color: activeTheme.textSecondary }]}>{s.label}</Text>
                </View>
              ))}
            </View>

            {/* Our Story */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: activeTheme.textPrimary }]}>
                Our Mission & Story
              </Text>
              <Text style={[styles.sectionBody, { color: activeTheme.textSecondary }]}>
                ServEasy was founded to bridge the gap between discerning customers and high-caliber local service professionals. By combining cutting-edge glassmorphic mobile discovery with uncompromising quality control, we empower residents and travelers to solve household, automotive, and emergency challenges in seconds.
              </Text>
            </View>

            {/* 4 Pillars of Excellence */}
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionHeading, { color: activeTheme.textPrimary }]}>
                Pillars of Excellence
              </Text>
              {pillars.map((p, idx) => (
                <View
                  key={idx}
                  style={[styles.pillarCard, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}
                >
                  <View style={[styles.pillarIconBox, { backgroundColor: `${p.color}20` }]}>
                    <MaterialCommunityIcons name={p.icon as any} size={22} color={p.color} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.pillarTitle, { color: activeTheme.textPrimary }]}>{p.title}</Text>
                    <Text style={[styles.pillarDesc, { color: activeTheme.textSecondary }]}>{p.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Technology & Version */}
            <View style={[styles.versionBox, { borderTopColor: activeTheme.cardBorder }]}>
              <Text style={[styles.versionText, { color: activeTheme.textSecondary }]}>
                ServEasy Universal Client v1.3.0 • Production Build
              </Text>
              <Text style={[styles.copyrightText, { color: activeTheme.textSecondary }]}>
                © 2026 ServEasy Inc. All Rights Reserved.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.closeModalBtn, { backgroundColor: activeTheme.accentBtnBg }]}
              onPress={onClose}
            >
              <Text style={styles.closeModalBtnText}>CLOSE</Text>
            </TouchableOpacity>
          </ScrollView>
        </GlassCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '90%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 140,
    height: 42,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    marginBottom: 22,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  sectionBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  pillarCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  pillarIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillarTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  pillarDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  versionBox: {
    alignItems: 'center',
    paddingTop: 14,
    marginBottom: 16,
    borderTopWidth: 1,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  copyrightText: {
    fontSize: 10,
  },
  closeModalBtn: {
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
