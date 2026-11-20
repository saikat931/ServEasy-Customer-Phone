import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Linking,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';
import { submitContactMessageApi, ContactMessagePayload } from '../../services/api';

interface ContactProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  onBack: () => void;
  defaultOrderRef?: string;
}

export function Contact({ theme, activeTheme, onBack, defaultOrderRef }: ContactProps) {
  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('General Inquiry');
  const [urgency, setUrgency] = useState<'Low' | 'Normal' | 'High' | 'Urgent SOS'>('Normal');
  const [orderRef, setOrderRef] = useState(defaultOrderRef || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  // UI State
  const [submitting, setSubmitting] = useState(false);
  const [confirmationTicket, setConfirmationTicket] = useState<{
    ticketNumber: string;
    message: string;
  } | null>(null);

  // FAQ Accordion State (open FAQ item index)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const categories = [
    'General Inquiry',
    'Booking Assistance',
    'Technical Support',
    'Feedback / Suggestion',
    'Emergency Support'
  ];

  const urgencies: Array<'Low' | 'Normal' | 'High' | 'Urgent SOS'> = [
    'Low',
    'Normal',
    'High',
    'Urgent SOS'
  ];

  const faqs = [
    {
      q: 'How do I book a doorstep service on ServEasy?',
      a: 'Browse from the Home or Services tab, choose your package, select "Doorstep Service", pick a date and time slot, and confirm. A certified technician will arrive at your address with all necessary tools.'
    },
    {
      q: 'What if I need to cancel or reschedule my booking?',
      a: 'You can cancel or reschedule any active booking from the "Bookings" tab before the technician dispatches. Cancellations made 2 hours in advance incur zero penalty fees.'
    },
    {
      q: 'How are ServEasy technicians and staff verified?',
      a: 'Every provider undergoes stringent national identity checks, criminal background screenings, skill evaluations, and trade certifications before being permitted on the platform.'
    },
    {
      q: 'Which payment methods are accepted?',
      a: 'We accept Cash on Delivery / after service, Instant UPI & QR codes, Credit/Debit cards (Visa, MasterCard, Amex), and ServEasy Wallet credits.'
    },
    {
      q: 'How does the Emergency SOS response operate?',
      a: 'Tapping Emergency SOS triggers instant GPS dispatching to the nearest authorized roadside tow vehicle, emergency mechanic, or security locksmith 24 hours a day, 7 days a week.'
    }
  ];

  const handlePhoneCall = () => {
    Linking.openURL('tel:+18004928172').catch(() => {
      Alert.alert('Phone Call', 'Call concierge at +1 (800) 492-8172');
    });
  };

  const handleEmailConcierge = () => {
    Linking.openURL('mailto:concierge@serveasy.com').catch(() => {
      Alert.alert('Email', 'Email concierge at concierge@serveasy.com');
    });
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      Alert.alert('Missing Fields', 'Please fill in Name, Email, Subject, and Message.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: ContactMessagePayload = {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        category,
        urgency,
        orderRef: orderRef.trim() || undefined,
        subject: subject.trim(),
        message: message.trim()
      };

      const result = await submitContactMessageApi(payload);
      if (result.success) {
        setConfirmationTicket({
          ticketNumber: result.ticketNumber,
          message: result.message
        });
        // Reset form
        setSubject('');
        setMessage('');
        setOrderRef('');
      } else {
        Alert.alert('Error', result.message || 'Failed to submit contact request.');
      }
    } catch (e) {
      Alert.alert('Submission Error', 'Failed to communicate with support server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={[styles.headerRow, { borderBottomColor: activeTheme.cardBorder }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: activeTheme.pillInactiveBg }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={activeTheme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: activeTheme.textPrimary }]}>Contact Concierge</Text>
          <Text style={[styles.headerSubtitle, { color: activeTheme.textSecondary }]}>
            24/7 Dedicated Support & Assistance
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Contact Cards Grid */}
        <View style={styles.quickContactRow}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.85}
            onPress={handlePhoneCall}
          >
            <GlassCard
              theme={theme}
              style={[styles.quickCard, { borderColor: activeTheme.cardBorder }]}
              intensity={activeTheme.glassIntensity}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(48, 209, 88, 0.15)' }]}>
                <MaterialCommunityIcons name="phone" size={20} color="#30D158" />
              </View>
              <Text style={[styles.quickCardTitle, { color: activeTheme.textPrimary }]}>Call Concierge</Text>
              <Text style={[styles.quickCardVal, { color: activeTheme.textSecondary }]}>+1 (800) 492-8172</Text>
              <Text style={[styles.quickCardAction, { color: '#30D158' }]}>Tap to Dial</Text>
            </GlassCard>
          </TouchableOpacity>

          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.85}
            onPress={handleEmailConcierge}
          >
            <GlassCard
              theme={theme}
              style={[styles.quickCard, { borderColor: activeTheme.cardBorder }]}
              intensity={activeTheme.glassIntensity}
            >
              <View style={[styles.quickIconCircle, { backgroundColor: 'rgba(0, 132, 255, 0.15)' }]}>
                <MaterialCommunityIcons name="email-outline" size={20} color="#0084FF" />
              </View>
              <Text style={[styles.quickCardTitle, { color: activeTheme.textPrimary }]}>Email Support</Text>
              <Text style={[styles.quickCardVal, { color: activeTheme.textSecondary }]} numberOfLines={1}>
                concierge@serveasy.com
              </Text>
              <Text style={[styles.quickCardAction, { color: '#0084FF' }]}>Send Email</Text>
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* Office & Operations Card */}
        <GlassCard
          theme={theme}
          style={[styles.officeCard, { borderColor: activeTheme.cardBorder }]}
          intensity={activeTheme.glassIntensity}
        >
          <View style={styles.officeRow}>
            <View style={[styles.officeIconWrap, { backgroundColor: 'rgba(175, 82, 222, 0.15)' }]}>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color="#AF52DE" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.officeTitle, { color: activeTheme.textPrimary }]}>
                ServEasy Global Headquarters
              </Text>
              <Text style={[styles.officeText, { color: activeTheme.textSecondary }]}>
                742 Evergreen Road, Tech Innovation Hub, Suite 400
              </Text>
              <View style={styles.hoursTag}>
                <MaterialCommunityIcons name="clock-check-outline" size={13} color="#30D158" />
                <Text style={styles.hoursTagText}>24/7 Rapid Emergency Response Active</Text>
              </View>
            </View>
          </View>
        </GlassCard>

        {/* Support Ticket Submission Form */}
        <GlassCard
          theme={theme}
          style={[styles.formCard, { borderColor: activeTheme.cardBorder }]}
          intensity={activeTheme.glassIntensity}
        >
          <Text style={[styles.formHeading, { color: activeTheme.textPrimary }]}>
            Send a Concierge Message
          </Text>
          <Text style={[styles.formSubheading, { color: activeTheme.textSecondary }]}>
            Fill out the form below. We will log a high-priority ticket and reply immediately.
          </Text>

          {/* Full Name */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>YOUR FULL NAME *</Text>
          <View style={[styles.inputWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
            <MaterialCommunityIcons name="account-outline" size={18} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.textInput, { color: activeTheme.textPrimary }]}
              placeholder="e.g. John Doe"
              placeholderTextColor={activeTheme.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          {/* Email Address */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>EMAIL ADDRESS *</Text>
          <View style={[styles.inputWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
            <MaterialCommunityIcons name="email-outline" size={18} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.textInput, { color: activeTheme.textPrimary }]}
              placeholder="e.g. john@example.com"
              placeholderTextColor={activeTheme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Phone Number */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>PHONE NUMBER</Text>
          <View style={[styles.inputWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
            <MaterialCommunityIcons name="phone-outline" size={18} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.textInput, { color: activeTheme.textPrimary }]}
              placeholder="e.g. +1 555 123 4567"
              placeholderTextColor={activeTheme.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {/* Category Selection */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>INQUIRY CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
            {categories.map(cat => {
              const isSel = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.choicePill,
                    {
                      backgroundColor: isSel ? '#0084FF' : activeTheme.inputBg,
                      borderColor: isSel ? '#0084FF' : activeTheme.cardBorder
                    }
                  ]}
                >
                  <Text style={[styles.choicePillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Urgency Selection */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>URGENCY LEVEL</Text>
          <View style={styles.urgencyRow}>
            {urgencies.map(u => {
              const isSel = urgency === u;
              const isSos = u === 'Urgent SOS';
              return (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUrgency(u)}
                  style={[
                    styles.urgencyPill,
                    {
                      backgroundColor: isSel ? (isSos ? '#FF453A' : '#0084FF') : activeTheme.inputBg,
                      borderColor: isSel ? (isSos ? '#FF453A' : '#0084FF') : activeTheme.cardBorder
                    }
                  ]}
                >
                  <Text style={[styles.urgencyPillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Order Reference (optional) */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>BOOKING REFERENCE (OPTIONAL)</Text>
          <View style={[styles.inputWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
            <MaterialCommunityIcons name="ticket-outline" size={18} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.textInput, { color: activeTheme.textPrimary }]}
              placeholder="e.g. SE-849201"
              placeholderTextColor={activeTheme.textSecondary}
              value={orderRef}
              onChangeText={setOrderRef}
            />
          </View>

          {/* Subject */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>SUBJECT *</Text>
          <View style={[styles.inputWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
            <MaterialCommunityIcons name="format-title" size={18} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.textInput, { color: activeTheme.textPrimary }]}
              placeholder="Brief summary of your inquiry"
              placeholderTextColor={activeTheme.textSecondary}
              value={subject}
              onChangeText={setSubject}
            />
          </View>

          {/* Message Textarea */}
          <Text style={[styles.inputLabel, { color: activeTheme.textSecondary }]}>MESSAGE DETAILS *</Text>
          <View style={[styles.textAreaWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
            <TextInput
              style={[styles.textAreaInput, { color: activeTheme.textPrimary }]}
              placeholder="Describe your question, request, or issue with as much detail as possible..."
              placeholderTextColor={activeTheme.textSecondary}
              multiline
              numberOfLines={4}
              value={message}
              onChangeText={setMessage}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: urgency === 'Urgent SOS' ? '#FF453A' : activeTheme.accentBtnBg },
              submitting && { opacity: 0.7 }
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitBtnText}>SEND CONCIERGE MESSAGE</Text>
                <MaterialCommunityIcons name="send" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </GlassCard>

        {/* FAQ Accordion Section */}
        <View style={styles.faqSection}>
          <Text style={[styles.faqSectionTitle, { color: activeTheme.textPrimary }]}>
            Frequently Asked Questions
          </Text>
          <Text style={[styles.faqSectionSubtitle, { color: activeTheme.textSecondary }]}>
            Quick answers to common questions about bookings, guarantees, and payments.
          </Text>

          {faqs.map((faq, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <GlassCard
                key={idx}
                theme={theme}
                style={[styles.faqCard, { borderColor: activeTheme.cardBorder }]}
                intensity={activeTheme.glassIntensity}
              >
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => setExpandedFaq(isOpen ? null : idx)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.faqQuestion, { color: activeTheme.textPrimary }]}>
                    {faq.q}
                  </Text>
                  <MaterialCommunityIcons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#0084FF"
                  />
                </TouchableOpacity>
                {isOpen && (
                  <View style={[styles.faqBody, { borderTopColor: activeTheme.cardBorder }]}>
                    <Text style={[styles.faqAnswer, { color: activeTheme.textSecondary }]}>
                      {faq.a}
                    </Text>
                  </View>
                )}
              </GlassCard>
            );
          })}
        </View>
      </ScrollView>

      {/* Confirmation Ticket Modal */}
      <Modal
        visible={!!confirmationTicket}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConfirmationTicket(null)}
      >
        {confirmationTicket && (
          <View style={styles.modalOverlay}>
            <GlassCard theme={theme} style={styles.ticketCard} intensity={activeTheme.glassIntensity + 15}>
              <View style={styles.ticketCheckCircle}>
                <MaterialCommunityIcons name="check" size={32} color="#FFFFFF" />
              </View>

              <Text style={[styles.ticketTitle, { color: activeTheme.textPrimary }]}>
                Ticket Logged Successfully!
              </Text>
              <Text style={[styles.ticketSub, { color: activeTheme.textSecondary }]}>
                {confirmationTicket.message}
              </Text>

              <View style={[styles.ticketBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
                <Text style={[styles.ticketLabel, { color: activeTheme.textSecondary }]}>TICKET REFERENCE NUMBER</Text>
                <Text style={styles.ticketNumber}>{confirmationTicket.ticketNumber}</Text>
                <Text style={[styles.ticketTimeNotice, { color: '#30D158' }]}>
                  {urgency === 'Urgent SOS' ? '⚡ Emergency Queue: Response < 10 mins' : 'Priority Queue: Response < 1 hour'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: activeTheme.accentBtnBg }]}
                onPress={() => setConfirmationTicket(null)}
              >
                <Text style={styles.doneBtnText}>DONE</Text>
              </TouchableOpacity>
            </GlassCard>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  quickCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  quickIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickCardVal: {
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  quickCardAction: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  officeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  officeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  officeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  officeTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  officeText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  hoursTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hoursTagText: {
    color: '#30D158',
    fontSize: 11,
    fontWeight: '600',
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 22,
  },
  formHeading: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  formSubheading: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  choicePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
  },
  choicePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  urgencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  urgencyPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  urgencyPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textAreaWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    height: 100,
    marginBottom: 18,
  },
  textAreaInput: {
    fontSize: 14,
    height: '100%',
    textAlignVertical: 'top',
    padding: 0,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  faqSection: {
    marginBottom: 20,
  },
  faqSectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  faqSectionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  faqCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  faqBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 19,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  ticketCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
  },
  ticketCheckCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#30D158',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  ticketTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  ticketSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 18,
  },
  ticketBox: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 20,
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  ticketNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0084FF',
    letterSpacing: 1,
    marginBottom: 6,
  },
  ticketTimeNotice: {
    fontSize: 11,
    fontWeight: '700',
  },
  doneBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
