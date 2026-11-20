import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  reference: string;
  serviceName: string;
  amount: number;
  date: string;
  time: string;
  status: 'paid' | 'pending' | 'refunded' | 'failed';
  method: string;
  methodIcon: keyof typeof MaterialCommunityIcons.glyphMap;
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'wallet' | 'netbanking';
  label: string;
  detail: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  isDefault: boolean;
}

interface PaymentProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  onBack: () => void;
  refreshing: boolean;
  onRefresh: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const STATUS_META = {
  paid:     { label: 'Paid',     color: '#30D158', icon: 'check-circle-outline' as const },
  pending:  { label: 'Pending',  color: '#FF9F0A', icon: 'clock-outline' as const },
  refunded: { label: 'Refunded', color: '#5E5CE6', icon: 'cash-refund' as const },
  failed:   { label: 'Failed',   color: '#FF453A', icon: 'close-circle-outline' as const },
};

const FILTER_TABS = [
  { key: 'all',      label: 'All' },
  { key: 'paid',     label: 'Paid' },
  { key: 'pending',  label: 'Pending' },
  { key: 'refunded', label: 'Refunded' },
];

// ─── Component ────────────────────────────────────────────────────────────────
export function Payment({ theme, activeTheme, onBack, refreshing, onRefresh }: PaymentProps) {
  const [filterTab, setFilterTab] = useState('all');
  const [addMethodModal, setAddMethodModal] = useState(false);
  const [newMethodType, setNewMethodType] = useState<'card' | 'upi' | 'wallet'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [upiId, setUpiId] = useState('');

  // ── Mock data ──────────────────────────────────────────────────────────────
  const [transactions] = useState<Transaction[]>([
    {
      id: '1',
      reference: 'SE-849201',
      serviceName: 'Room Cleaning & Decor',
      amount: 40,
      date: '2026-06-24',
      time: '10:00 AM',
      status: 'paid',
      method: 'Visa •••• 4242',
      methodIcon: 'credit-card-outline',
    },
    {
      id: '2',
      reference: 'SE-391024',
      serviceName: 'Vehicle Car & Bike Wash',
      amount: 25,
      date: '2026-06-21',
      time: '02:30 PM',
      status: 'paid',
      method: 'UPI – user@okaxis',
      methodIcon: 'bank-outline',
    },
    {
      id: '3',
      reference: 'SE-771930',
      serviceName: 'AC Servicing & Gas Refill',
      amount: 45,
      date: '2026-06-19',
      time: '11:00 AM',
      status: 'refunded',
      method: 'ServEasy Wallet',
      methodIcon: 'wallet-outline',
    },
    {
      id: '4',
      reference: 'SE-110384',
      serviceName: 'Laundry & Dry Clean',
      amount: 18,
      date: '2026-06-17',
      time: '09:30 AM',
      status: 'pending',
      method: 'Mastercard •••• 8801',
      methodIcon: 'credit-card-outline',
    },
    {
      id: '5',
      reference: 'SE-002948',
      serviceName: 'Pest Control Specialist',
      amount: 55,
      date: '2026-06-10',
      time: '03:00 PM',
      status: 'paid',
      method: 'Net Banking – SBI',
      methodIcon: 'bank-outline',
    },
    {
      id: '6',
      reference: 'SE-558821',
      serviceName: 'Home Painters',
      amount: 120,
      date: '2026-06-05',
      time: '08:00 AM',
      status: 'failed',
      method: 'Visa •••• 4242',
      methodIcon: 'credit-card-outline',
    },
  ]);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([
    {
      id: 'pm1',
      type: 'card',
      label: 'Visa Card',
      detail: '•••• •••• •••• 4242',
      icon: 'credit-card-outline',
      isDefault: true,
    },
    {
      id: 'pm2',
      type: 'upi',
      label: 'UPI – OkAxis',
      detail: 'user@okaxis',
      icon: 'bank-outline',
      isDefault: false,
    },
    {
      id: 'pm3',
      type: 'wallet',
      label: 'ServEasy Wallet',
      detail: 'Balance: $12.50',
      icon: 'wallet-outline',
      isDefault: false,
    },
  ]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPaid     = transactions.filter(t => t.status === 'paid').reduce((s, t) => s + t.amount, 0);
  const totalPending  = transactions.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount, 0);
  const totalRefunded = transactions.filter(t => t.status === 'refunded').reduce((s, t) => s + t.amount, 0);

  const filtered = filterTab === 'all'
    ? transactions
    : transactions.filter(t => t.status === filterTab);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSetDefault = (id: string) => {
    setPaymentMethods(prev => prev.map(m => ({ ...m, isDefault: m.id === id })));
  };

  const handleRemoveMethod = (id: string) => {
    Alert.alert('Remove Method', 'Are you sure you want to remove this payment method?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setPaymentMethods(prev => prev.filter(m => m.id !== id)),
      },
    ]);
  };

  const handleAddMethod = () => {
    if (newMethodType === 'card') {
      if (!cardNumber.trim() || !cardName.trim() || !cardExpiry.trim()) {
        Alert.alert('Required', 'Please fill in all card details.');
        return;
      }
      const last4 = cardNumber.replace(/\s/g, '').slice(-4);
      setPaymentMethods(prev => [
        ...prev,
        {
          id: `pm_${Date.now()}`,
          type: 'card',
          label: `Card •••• ${last4}`,
          detail: `•••• •••• •••• ${last4}  Exp: ${cardExpiry}`,
          icon: 'credit-card-outline',
          isDefault: false,
        },
      ]);
    } else if (newMethodType === 'upi') {
      if (!upiId.trim()) {
        Alert.alert('Required', 'Please enter your UPI ID.');
        return;
      }
      setPaymentMethods(prev => [
        ...prev,
        {
          id: `pm_${Date.now()}`,
          type: 'upi',
          label: `UPI – ${upiId}`,
          detail: upiId,
          icon: 'bank-outline',
          isDefault: false,
        },
      ]);
    }
    setCardNumber('');
    setCardName('');
    setCardExpiry('');
    setUpiId('');
    setAddMethodModal(false);
    Alert.alert('Success', 'Payment method added successfully!');
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      {/* ── Sub Top Bar ── */}
      <View style={styles.safeTop}>
        <View style={[styles.topBar, { borderBottomColor: activeTheme.cardBorder }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={activeTheme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: activeTheme.textPrimary }]}>Payments & Wallet</Text>
          <View style={{ width: 38 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0084FF" colors={['#0084FF']} />
        }
      >
        {/* ── Wallet Balance Card ── */}
        <LinearGradient
          colors={['#0058CC', '#0084FF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.walletCard}
        >
          {/* Decorative circles */}
          <View style={styles.walletCircle1} />
          <View style={styles.walletCircle2} />

          <View style={styles.walletRow}>
            <View>
              <Text style={styles.walletLabel}>ServEasy Wallet</Text>
              <Text style={styles.walletBalance}>$12.50</Text>
              <Text style={styles.walletSub}>Available balance</Text>
            </View>
            <MaterialCommunityIcons name="wallet" size={44} color="rgba(255,255,255,0.25)" />
          </View>

          <View style={styles.walletActions}>
            <TouchableOpacity
              style={styles.walletActionBtn}
              onPress={() => Alert.alert('Add Money', 'Wallet top-up integration active.')}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#0084FF" />
              <Text style={[styles.walletActionText, { marginLeft: 5 }]}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.walletActionBtn, styles.walletActionBtnSecondary]}
              onPress={() => Alert.alert('Withdraw', 'Wallet withdrawal integration active.')}
            >
              <MaterialCommunityIcons name="arrow-up" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={[styles.walletActionText, { color: 'rgba(255,255,255,0.8)', marginLeft: 5 }]}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          {[
            { label: 'Total Paid',     value: `$${totalPaid}`,     color: '#30D158', icon: 'check-circle-outline' as const },
            { label: 'Pending',        value: `$${totalPending}`,   color: '#FF9F0A', icon: 'clock-outline' as const },
            { label: 'Refunded',       value: `$${totalRefunded}`,  color: '#5E5CE6', icon: 'cash-refund' as const },
          ].map(stat => (
            <GlassCard
              key={stat.label}
              theme={theme}
              style={[styles.statCard, { borderColor: activeTheme.cardBorder }]}
              intensity={16}
            >
              <MaterialCommunityIcons name={stat.icon} size={20} color={stat.color} />
              <Text style={[styles.statValue, { color: activeTheme.textPrimary }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: activeTheme.textSecondary }]}>{stat.label}</Text>
            </GlassCard>
          ))}
        </View>

        {/* ── Payment Methods ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>Payment Methods</Text>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={() => setAddMethodModal(true)}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#0084FF" />
              <Text style={styles.addBtnText}>Add New</Text>
            </TouchableOpacity>
          </View>

          {paymentMethods.map(method => (
            <GlassCard
              key={method.id}
              theme={theme}
              style={[styles.methodCard, { borderColor: method.isDefault ? '#0084FF' : activeTheme.cardBorder }]}
              intensity={16}
            >
              <View style={[styles.methodIcon, { backgroundColor: method.isDefault ? 'rgba(0,132,255,0.15)' : activeTheme.inputBg }]}>
                <MaterialCommunityIcons name={method.icon} size={22} color={method.isDefault ? '#0084FF' : activeTheme.textSecondary} />
              </View>
              <View style={styles.methodInfo}>
                <View style={styles.methodTitleRow}>
                  <Text style={[styles.methodLabel, { color: activeTheme.textPrimary }]}>{method.label}</Text>
                  {method.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>DEFAULT</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.methodDetail, { color: activeTheme.textSecondary }]}>{method.detail}</Text>
              </View>
              <View style={styles.methodActions}>
                {!method.isDefault && (
                  <TouchableOpacity
                    onPress={() => handleSetDefault(method.id)}
                    style={[styles.methodActionBtn, { borderColor: activeTheme.cardBorder }]}
                  >
                    <MaterialCommunityIcons name="star-outline" size={16} color={activeTheme.textSecondary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handleRemoveMethod(method.id)}
                  style={[styles.methodActionBtn, styles.removeBtn]}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color="#FF453A" />
                </TouchableOpacity>
              </View>
            </GlassCard>
          ))}
        </View>

        {/* ── Transaction History ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: activeTheme.textPrimary }]}>Transaction History</Text>

          {/* Filter tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
            {FILTER_TABS.map(tab => {
              const isActive = filterTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? '#0084FF' : activeTheme.inputBg,
                      borderColor: isActive ? '#0084FF' : activeTheme.cardBorder,
                    },
                  ]}
                  onPress={() => setFilterTab(tab.key)}
                >
                  <Text style={[styles.filterChipText, { color: isActive ? '#FFF' : activeTheme.textSecondary }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Transaction list */}
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="receipt-text-outline" size={44} color={activeTheme.textSecondary} />
              <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>No transactions found</Text>
            </View>
          ) : (
            filtered.map((txn) => {
              const meta = STATUS_META[txn.status];
              return (
                <GlassCard
                  key={txn.id}
                  theme={theme}
                  style={[styles.txnCard, { borderColor: activeTheme.cardBorder }]}
                  intensity={16}
                >
                  {/* Left: method icon */}
                  <View style={[styles.txnIconWrap, { backgroundColor: activeTheme.inputBg }]}>
                    <MaterialCommunityIcons name={txn.methodIcon} size={20} color="#0084FF" />
                  </View>

                  {/* Middle: info */}
                  <View style={styles.txnInfo}>
                    <Text style={[styles.txnName, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                      {txn.serviceName}
                    </Text>
                    <Text style={[styles.txnRef, { color: activeTheme.textSecondary }]}>
                      {txn.reference}  ·  {txn.date}
                    </Text>
                    <Text style={[styles.txnMethod, { color: activeTheme.textSecondary }]}>
                      {txn.method}
                    </Text>
                  </View>

                  {/* Right: amount + status */}
                  <View style={styles.txnRight}>
                    <Text
                      style={[
                        styles.txnAmount,
                        {
                          color: txn.status === 'refunded'
                            ? '#5E5CE6'
                            : txn.status === 'failed'
                            ? '#FF453A'
                            : activeTheme.textPrimary,
                        },
                      ]}
                    >
                      {txn.status === 'refunded' ? '+' : txn.status === 'failed' ? '' : '-'}${txn.amount}
                    </Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${meta.color}18` }]}>
                      <MaterialCommunityIcons name={meta.icon} size={10} color={meta.color} />
                      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Add Payment Method Modal ── */}
      <Modal
        visible={addMethodModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddMethodModal(false)}
      >
        <View style={styles.modalOverlay}>
          <GlassCard
            theme={theme}
            style={[styles.modalCard, { backgroundColor: activeTheme.modalBg }]}
            intensity={30}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: activeTheme.cardBorder }]}>
              <Text style={[styles.modalTitle, { color: activeTheme.textPrimary }]}>Add Payment Method</Text>
              <TouchableOpacity onPress={() => setAddMethodModal(false)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Type selector */}
              <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>Select Type</Text>
              <View style={styles.typeRow}>
                {(['card', 'upi', 'wallet'] as const).map(type => {
                  const icons = { card: 'credit-card-outline', upi: 'bank-outline', wallet: 'wallet-outline' } as const;
                  const labels = { card: 'Card', upi: 'UPI', wallet: 'Wallet' };
                  const isActive = newMethodType === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeBtn,
                        {
                          backgroundColor: isActive ? 'rgba(0,132,255,0.14)' : activeTheme.inputBg,
                          borderColor: isActive ? '#0084FF' : activeTheme.cardBorder,
                        },
                      ]}
                      onPress={() => setNewMethodType(type)}
                    >
                      <MaterialCommunityIcons name={icons[type]} size={20} color={isActive ? '#0084FF' : activeTheme.textSecondary} />
                      <Text style={[styles.typeBtnText, { color: isActive ? '#0084FF' : activeTheme.textSecondary }]}>
                        {labels[type]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Card inputs */}
              {newMethodType === 'card' && (
                <>
                  <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>Card Number</Text>
                  <View style={[styles.inputRow, { borderColor: activeTheme.inputBorder, backgroundColor: activeTheme.inputBg }]}>
                    <MaterialCommunityIcons name="credit-card-outline" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: activeTheme.textPrimary }]}
                      placeholder="1234 5678 9012 3456"
                      placeholderTextColor={activeTheme.textSecondary}
                      value={cardNumber}
                      onChangeText={setCardNumber}
                      keyboardType="number-pad"
                      maxLength={19}
                    />
                  </View>
                  <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>Cardholder Name</Text>
                  <View style={[styles.inputRow, { borderColor: activeTheme.inputBorder, backgroundColor: activeTheme.inputBg }]}>
                    <MaterialCommunityIcons name="account-outline" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: activeTheme.textPrimary }]}
                      placeholder="Full Name on Card"
                      placeholderTextColor={activeTheme.textSecondary}
                      value={cardName}
                      onChangeText={setCardName}
                    />
                  </View>
                  <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>Expiry (MM/YY)</Text>
                  <View style={[styles.inputRow, { borderColor: activeTheme.inputBorder, backgroundColor: activeTheme.inputBg }]}>
                    <MaterialCommunityIcons name="calendar-outline" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: activeTheme.textPrimary }]}
                      placeholder="MM/YY"
                      placeholderTextColor={activeTheme.textSecondary}
                      value={cardExpiry}
                      onChangeText={setCardExpiry}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </>
              )}

              {/* UPI input */}
              {newMethodType === 'upi' && (
                <>
                  <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>UPI ID</Text>
                  <View style={[styles.inputRow, { borderColor: activeTheme.inputBorder, backgroundColor: activeTheme.inputBg }]}>
                    <MaterialCommunityIcons name="at" size={18} color={activeTheme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: activeTheme.textPrimary }]}
                      placeholder="yourname@upi"
                      placeholderTextColor={activeTheme.textSecondary}
                      value={upiId}
                      onChangeText={setUpiId}
                      autoCapitalize="none"
                    />
                  </View>
                </>
              )}

              {/* Wallet info */}
              {newMethodType === 'wallet' && (
                <View style={[styles.walletInfo, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
                  <MaterialCommunityIcons name="information-outline" size={18} color="#0084FF" />
                  <Text style={[styles.walletInfoText, { color: activeTheme.textSecondary }]}>
                    ServEasy Wallet is already linked to your account. Add money directly from the wallet card above.
                  </Text>
                </View>
              )}

              {/* Submit */}
              {newMethodType !== 'wallet' && (
                <TouchableOpacity style={styles.submitBtn} onPress={handleAddMethod}>
                  <Text style={styles.submitBtnText}>Add Payment Method</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </GlassCard>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeTop: {
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },

  // Wallet card
  walletCard: {
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
    marginBottom: 14,
    overflow: 'hidden',
    minHeight: 160,
    position: 'relative',
  },
  walletCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -60,
    right: -40,
  },
  walletCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    bottom: -30,
    left: 20,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  walletLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  walletBalance: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  walletSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
  walletActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  walletActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 10,
  },
  walletActionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  walletActionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0084FF',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },

  // Section
  section: {
    marginBottom: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,132,255,0.12)',
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0084FF',
  },

  // Payment method cards
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: 10,
  },
  methodInfo: {
    flex: 1,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  defaultBadge: {
    backgroundColor: 'rgba(0,132,255,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    marginLeft: 6,
  },
  defaultBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0084FF',
    letterSpacing: 0.4,
  },
  methodDetail: {
    fontSize: 12,
    fontWeight: '500',
  },
  methodActions: {
    flexDirection: 'row',
  },
  methodActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    marginLeft: 6,
  },
  removeBtn: {
    backgroundColor: 'rgba(255,69,58,0.10)',
    borderColor: 'rgba(255,69,58,0.2)',
  },

  // Filter chips
  filterScroll: {
    marginBottom: 10,
  },
  filterContent: {
    paddingRight: 8,
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Transaction cards
  txnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  txnIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    marginRight: 10,
  },
  txnInfo: {
    flex: 1,
  },
  txnName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  txnRef: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 1,
  },
  txnMethod: {
    fontSize: 11,
  },
  txnRight: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },

  // Empty
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: Platform.OS === 'web' ? 600 : '90%' as any,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
    marginTop: 14,
  },
  typeRow: {
    flexDirection: 'row',
  },
  typeBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  typeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: 48,
    padding: 0,
  },
  walletInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 14,
  },
  walletInfoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 10,
  },
  submitBtn: {
    backgroundColor: '#0084FF',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
