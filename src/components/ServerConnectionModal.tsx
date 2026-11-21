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

export interface ServerConnectionModalProps {
  visible: boolean;
  onClose: () => void;
  onRetry?: () => void;
  theme?: 'dark' | 'light';
  activeTheme?: any;
  title?: string;
  message?: string;
  asOverlay?: boolean;
}

export function ServerConnectionModal({
  visible,
  onClose,
  onRetry,
  theme = 'dark',
  activeTheme,
  title = 'Failed to Connect with Server',
  message = 'Unable to establish a connection to the ServEasy server. Please verify your internet connection or mobile data and try again.',
  asOverlay = false,
}: ServerConnectionModalProps) {
  if (!visible) return null;

  const isDark = theme === 'dark';
  const cardBg = isDark ? '#161B24' : '#FFFFFF';
  const titleColor = isDark ? '#F8FAFC' : '#0F172A';
  const messageColor = isDark ? '#94A3B8' : '#64748B';
  const borderColor = isDark ? 'rgba(255, 69, 58, 0.4)' : 'rgba(255, 69, 58, 0.25)';

  const content = (
    <View style={asOverlay ? styles.overlayContainer : styles.modalBackdrop}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={StyleSheet.absoluteFill} />
      </TouchableWithoutFeedback>

      <View
        style={[
          styles.modalCard,
          {
            backgroundColor: cardBg,
            borderColor: borderColor,
          },
        ]}
      >
        {/* Disconnect Icon Badge */}
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name="server-network-off" size={32} color="#FF3B30" />
        </View>

        {/* Title & Description */}
        <Text style={[styles.modalTitle, { color: titleColor }]}>
          {title}
        </Text>
        <Text style={[styles.modalMessage, { color: messageColor }]}>
          {message}
        </Text>

        {/* Connection Hint */}
        <View style={[styles.hintBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC' }]}>
          <MaterialCommunityIcons name="information-outline" size={14} color="#FF9F0A" style={{ marginRight: 6 }} />
          <Text style={[styles.hintText, { color: messageColor }]}>
            Check your mobile data or Wi-Fi connection.
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsColumn}>
          {onRetry && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onRetry}
              style={styles.retryBtn}
            >
              <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.retryBtnText}>Retry Connection</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onClose}
            style={[
              styles.dismissBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#E2E8F0',
              },
            ]}
          >
            <Text style={[styles.dismissBtnText, { color: isDark ? '#CBD5E1' : '#475569' }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (asOverlay) {
    return content;
  }

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 999,
    borderRadius: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 59, 48, 0.14)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 59, 48, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 18,
    width: '100%',
  },
  hintText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  actionsColumn: {
    width: '100%',
    gap: 10,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#0084FF',
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  dismissBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  dismissBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
