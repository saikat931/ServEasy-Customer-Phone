import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
  Keyboard,
  useWindowDimensions,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from './GlassCard';
import { sendOtpApi, verifyOtpApi, fetchOtpConfigApi } from '../services/api';

interface AuthModalProps {
  visible: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  activeTheme: any;
  onLoginSuccess: (user: { id?: number; name: string; identity: string; phone?: string; email?: string }) => void;
}

export function AuthModal({ visible, onClose, theme, activeTheme, onLoginSuccess }: AuthModalProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [identity, setIdentity] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'identity' | 'otp'>('identity');
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const cardHeightEstimate = step === 'identity' ? 290 : 330;
  const centeredPadding = Math.max(30, Math.round((windowHeight - cardHeightEstimate) / 2));
  const activeBottomPadding = keyboardVisible
    ? (keyboardHeight > 0 ? keyboardHeight : 290) + 30
    : centeredPadding;

  const [otpConfig, setOtpConfig] = useState<{ mode: string; label: string; placeholder: string }>({
    mode: 'both',
    label: 'EMAIL ADDRESS OR PHONE NUMBER',
    placeholder: 'Please enter your phone number or email',
  });

  const loadOtpConfig = async () => {
    try {
      const cfg = await fetchOtpConfigApi();
      if (cfg) {
        setOtpConfig({
          mode: cfg.mode || 'both',
          label: (cfg.label || 'Email or Phone Number').toUpperCase(),
          placeholder: cfg.placeholder || 'Please enter your phone number or email',
        });
      }
    } catch (e) {
      console.log('[AuthModal] loadOtpConfig error:', e);
    }
  };

  useEffect(() => {
    if (visible) {
      setErrorMessage(null);
      loadOtpConfig();
    }
  }, [visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      if (e && e.endCoordinates && e.endCoordinates.height) {
        setKeyboardHeight(e.endCoordinates.height);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const validateIdentity = () => {
    const val = identity.trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[0-9]{10}$/;
    const cleanPhone = val.replace(/[\s\-+]/g, '');

    if (otpConfig.mode === 'email') {
      if (/^\d+$/.test(cleanPhone) || (!val.includes('@') && cleanPhone.length > 0)) {
        setErrorMessage('Phone number login is closed. Please enter your email.');
        return false;
      }
      if (!emailPattern.test(val)) {
        setErrorMessage('Please enter a valid email address.');
        return false;
      }
      return true;
    }
    if (otpConfig.mode === 'phone') {
      if (val.includes('@')) {
        setErrorMessage('Email login is closed. Please enter your phone number.');
        return false;
      }
      if (!phonePattern.test(cleanPhone)) {
        setErrorMessage('Please enter a valid 10-digit mobile number.');
        return false;
      }
      return true;
    }

    if (!emailPattern.test(val) && !phonePattern.test(cleanPhone)) {
      setErrorMessage('Please enter a valid email or 10-digit mobile number.');
      return false;
    }
    return true;
  };

  const handleSendOtp = async () => {
    setErrorMessage(null);
    if (!validateIdentity()) {
      return;
    }

    setLoading(true);
    try {
      const res = await sendOtpApi(identity.trim());
      if (res.success) {
        setDevOtp(res.otp || null);
        setStep('otp');
      } else {
        setErrorMessage(res.message || 'Failed to send OTP. Please try again.');
      }
    } catch (e) {
      setErrorMessage('Network error communicating with authentication service.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setErrorMessage(null);
    if (otp.trim().length !== 6) {
      setErrorMessage('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtpApi(identity.trim(), otp.trim());
      if (res.success) {
        const u = res.user || {};
        const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.name || identity.split('@')[0] || 'Customer';
        const phone = (u.phone && !u.phone.includes('@')) ? u.phone : (!identity.includes('@') ? identity.trim() : '');
        const email = u.email || (identity.includes('@') ? identity.trim() : '');
        const userId = u.id ? Number(u.id) : undefined;

        onLoginSuccess({
          id: userId,
          name: fullName,
          identity: identity.trim(),
          phone,
          email,
        });
        handleReset();
        onClose();
      } else {
        setErrorMessage(res.message || 'Invalid verification code.');
      }
    } catch (e) {
      setErrorMessage('Failed to verify OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setIdentity('');
    setOtp('');
    setStep('identity');
    setDevOtp(null);
    setErrorMessage(null);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={() => {
        handleReset();
        onClose();
      }}
    >
      <View
        style={[
          styles.modalOverlay,
          {
            paddingBottom: activeBottomPadding,
          },
        ]}
      >
        {/* Backdrop tap to dismiss keyboard or close modal */}
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (keyboardVisible) {
              Keyboard.dismiss();
            } else {
              handleReset();
              onClose();
            }
          }}
        />

        <GlassCard
          theme={theme}
          style={styles.modalCard}
          intensity={activeTheme.glassIntensity + 15}
        >
          {/* Close button */}
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: activeTheme.pillInactiveBg }]}
            onPress={() => {
              handleReset();
              onClose();
            }}
          >
            <MaterialCommunityIcons name="close" size={18} color={activeTheme.textPrimary} />
          </TouchableOpacity>

          {/* Logo & Headline */}
          <View style={styles.headerBox}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logoImage}
            />
            <Text style={[styles.title, { color: activeTheme.textPrimary }]}>
              {step === 'identity' ? 'Sign In / Register' : 'Verify Security Code'}
            </Text>
            <Text style={[styles.subtitle, { color: activeTheme.textSecondary }]}>
              {step === 'identity'
                ? 'Enter your phone number or email to receive a secure OTP code.'
                : `We sent a 6-digit verification code to ${identity}`}
            </Text>
          </View>

          {/* Error Banner (shown during OTP step) */}
          {errorMessage && step === 'otp' && (
            <View style={styles.errorBox}>
              <MaterialCommunityIcons name="alert-circle-outline" size={15} color="#FF3B30" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Login OTP Pill */}
          {devOtp && step === 'otp' && (
            <View style={styles.devOtpBox}>
              <MaterialCommunityIcons name="shield-check" size={15} color="#30D158" style={{ marginRight: 6 }} />
              <Text style={styles.devOtpText}>Login OTP Code: <Text style={{ fontWeight: '900' }}>{devOtp}</Text></Text>
            </View>
          )}

          {step === 'identity' ? (
            /* STEP 1: Phone / Email */
            <View style={styles.formContent}>
              <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>
                {otpConfig.label}
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: activeTheme.inputBg,
                    borderColor: errorMessage ? '#e74c3c' : activeTheme.cardBorder,
                    marginBottom: errorMessage ? 6 : 14,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={otpConfig.mode === 'phone' ? 'phone' : (otpConfig.mode === 'email' ? 'email-outline' : 'account-circle-outline')}
                  size={20}
                  color={errorMessage ? '#e74c3c' : activeTheme.iconColor}
                  style={{ marginRight: 10 }}
                />
                <TextInput
                  style={[styles.textInput, { color: activeTheme.textPrimary }]}
                  placeholder={otpConfig.placeholder}
                  placeholderTextColor={activeTheme.textSecondary}
                  value={identity}
                  onChangeText={(val) => {
                    setIdentity(val);
                    const clean = val.trim();
                    if (!clean) {
                      setErrorMessage(null);
                      return;
                    }
                    if (otpConfig.mode === 'email') {
                      const cleanPhone = clean.replace(/[\s\-+]/g, '');
                      if (/^\d+$/.test(cleanPhone)) {
                        setErrorMessage('Phone number login is closed. Please enter your email.');
                      } else {
                        setErrorMessage(null);
                      }
                    } else if (otpConfig.mode === 'phone') {
                      if (clean.includes('@')) {
                        setErrorMessage('Email login is closed. Please enter your phone number.');
                      } else {
                        setErrorMessage(null);
                      }
                    } else {
                      setErrorMessage(null);
                    }
                  }}
                  keyboardType={otpConfig.mode === 'phone' ? 'phone-pad' : (otpConfig.mode === 'email' ? 'email-address' : 'default')}
                  autoCapitalize="none"
                />
              </View>

              {/* Status / Error Text ONLY displayed when user enters an invalid number/input */}
              {errorMessage ? (
                <Text style={styles.fieldErrorText}>{errorMessage}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: activeTheme.accentBtnBg },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.actionBtnText}>SEND OTP CODE</Text>
                    <MaterialCommunityIcons name="arrow-right" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            /* STEP 2: 6-Digit OTP */
            <View style={styles.formContent}>
              <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>
                ENTER 6-DIGIT VERIFICATION CODE
              </Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: activeTheme.inputBg,
                    borderColor: activeTheme.cardBorder,
                    marginBottom: 14,
                  },
                ]}
              >
                <MaterialCommunityIcons name="shield-key-outline" size={20} color={activeTheme.iconColor} style={{ marginRight: 10 }} />
                <TextInput
                  style={[styles.textInput, { color: activeTheme.textPrimary, letterSpacing: 4, fontWeight: '800' }]}
                  placeholder="000000"
                  placeholderTextColor={activeTheme.textSecondary}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                />
              </View>

              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: '#30D158' },
                  loading && { opacity: 0.7 },
                ]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Text style={styles.actionBtnText}>VERIFY & LOGIN</Text>
                    <MaterialCommunityIcons name="check-circle-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.otpFooterRow}>
                <TouchableOpacity onPress={() => setStep('identity')}>
                  <Text style={[styles.changeIdentityText, { color: activeTheme.textSecondary }]}>
                    Change Phone / Email
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleSendOtp}>
                  <Text style={[styles.resendText, { color: '#0084FF' }]}>
                    Resend Code
                  </Text>
                </TouchableOpacity>
              </View>

              {identity.includes('@') && (
                <View style={styles.spamTipRow}>
                  <MaterialCommunityIcons name="information-outline" size={13} color={activeTheme.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={[styles.spamTipText, { color: activeTheme.textSecondary }]}>
                    Can't find the email? Check your Spam or Promotions folder.
                  </Text>
                </View>
              )}
            </View>
          )}
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
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
  },
  logoImage: {
    width: 110,
    height: 32,
    resizeMode: 'contain',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
    borderRadius: 10,
    padding: 9,
    marginBottom: 12,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  devOtpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(48, 209, 88, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(48, 209, 88, 0.3)',
    borderRadius: 10,
    padding: 9,
    marginBottom: 12,
  },
  devOtpText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '600',
  },
  formContent: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  fieldErrorText: {
    color: '#e74c3c',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
    paddingLeft: 4,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  otpFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  changeIdentityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  resendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  spamTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  spamTipText: {
    fontSize: 11,
    lineHeight: 15,
  },
});
