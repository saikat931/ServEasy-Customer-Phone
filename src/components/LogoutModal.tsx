import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  theme?: 'dark' | 'light';
  activeTheme?: any;
}

export function LogoutModal({
  visible,
  onClose,
  onConfirm,
  theme = 'dark',
  activeTheme,
}: LogoutModalProps) {
  const isDark = theme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.modalCard,
                {
                  backgroundColor: isDark ? '#161B24' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                },
              ]}
            >
              {/* Circular Red Glow Icon Badge */}
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons name="logout-variant" size={30} color="#EF4444" />
              </View>

              {/* Title & Description */}
              <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                Sign Out of ServEasy?
              </Text>
              <Text style={[styles.modalMessage, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Are you sure you want to log out from your account? You will need to verify with your OTP to access your bookings and saved favorites again.
              </Text>

              {/* Action Buttons Row */}
              <View style={styles.actionsRow}>
                {/* Cancel Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={onClose}
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0',
                    },
                  ]}
                >
                  <Text style={[styles.cancelBtnText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                {/* Confirm Logout Button */}
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={onConfirm}
                  style={styles.confirmBtn}
                >
                  <MaterialCommunityIcons name="logout" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmBtnText}>Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 999999,
  },
  modalCard: {
    width: Math.min(SCREEN_WIDTH - 40, 360),
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(239, 68, 68, 0.28)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '400',
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
});
