import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';
import { NotificationsSkeleton } from '../../components/SkeletonLoader';
import {
  fetchNotificationsFromApi,
  markNotificationAsReadApi,
  markAllNotificationsAsReadApi,
  DynamicNotification,
} from '../../services/api';

interface NotificationsProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  userId?: number;
  isLoggedIn?: boolean;
  onOpenAuth?: () => void;
  onNavigateTab?: (tab: 'home' | 'services' | 'bookings' | 'notifications' | 'profile') => void;
  onOpenBookingDetail?: (bookingNumber: string) => void;
  notifications?: any[];
  isLoading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export const Notifications = React.memo(function Notifications({
  theme,
  activeTheme,
  userId,
  isLoggedIn = false,
  onOpenAuth,
  onNavigateTab,
  onOpenBookingDetail,
}: NotificationsProps) {
  // Live dynamic notifications from MySQL database serveasy.notifications
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsFirstLoad(false), 450);
    return () => clearTimeout(timer);
  }, []);

  const [notificationList, setNotificationList] = useState<DynamicNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'booking' | 'general'>('all');

  // Selected Notification for Detail Popup Modal
  const [selectedNotif, setSelectedNotif] = useState<DynamicNotification | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  // Fetch dynamic notifications from backend API
  const loadNotifications = useCallback(async (isRefresh = false) => {
    if (!isLoggedIn || !userId) {
      setNotificationList([]);
      setUnreadCount(0);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchNotificationsFromApi(userId);
      setNotificationList(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (e) {
      console.log('[Notifications] Error loading notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, isLoggedIn]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Handle opening notification detail popup
  const handleOpenDetail = async (notif: DynamicNotification) => {
    setSelectedNotif(notif);
    setModalVisible(true);

    // If unread, mark as read in database
    if (!notif.isRead) {
      // Optimistic UI update
      setNotificationList(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      // Call API
      const numId = typeof notif.id === 'number' ? notif.id : parseInt(String(notif.id), 10);
      if (!isNaN(numId)) {
        await markNotificationAsReadApi(numId, userId);
      }
    }
  };

  // Handle Mark All as Read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    setIsMarkingRead(true);
    // Optimistic update
    setNotificationList(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    await markAllNotificationsAsReadApi(userId);
    setIsMarkingRead(false);
  };

  // Filtered list
  const filteredNotifications = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return notificationList.filter(n => !n.isRead);
      case 'booking':
        return notificationList.filter(n => n.type === 'booking');
      case 'general':
        return notificationList.filter(n => n.type !== 'booking');
      default:
        return notificationList;
    }
  }, [notificationList, activeFilter]);

  // Icon helper based on notification content
  const getNotificationIconInfo = (notif: DynamicNotification) => {
    const titleLower = notif.title.toLowerCase();
    const msgLower = notif.message.toLowerCase();

    if (titleLower.includes('completed') || msgLower.includes('completed')) {
      return { icon: 'star-circle', color: '#30D158', bg: 'rgba(48, 209, 88, 0.12)', label: 'SERVICE COMPLETED' };
    }
    if (titleLower.includes('confirmed') || msgLower.includes('confirmed')) {
      return { icon: 'check-decagram', color: '#0084FF', bg: 'rgba(0, 132, 255, 0.12)', label: 'BOOKING CONFIRMED' };
    }
    if (titleLower.includes('alert') || notif.type === 'emergency') {
      return { icon: 'alert-decagram', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.12)', label: 'ALERT NOTIFICATION' };
    }
    return { icon: 'bell-ring-outline', color: '#BF5AF2', bg: 'rgba(191, 90, 242, 0.12)', label: 'UPDATE' };
  };

  if (isFirstLoad || loading) {
    return <NotificationsSkeleton theme={theme} activeTheme={activeTheme} />;
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
            tintColor="#0084FF"
            colors={['#0084FF']}
          />
        }
      >
        {/* HEADER SECTION */}
        <View style={styles.tabHeaderContainer}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={[styles.tabMainTitle, { color: activeTheme.textPrimary }]}>Alerts & Notifications</Text>
              <Text style={[styles.tabSubtitle, { color: activeTheme.textSecondary }]}>
                Your booking updates, service status & account alerts
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => loadNotifications(true)}
              style={[styles.syncButton, { borderColor: activeTheme.cardBorder, backgroundColor: activeTheme.pillInactiveBg }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="cloud-sync-outline" size={16} color="#0084FF" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#0084FF', marginLeft: 4 }}>SYNC</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Summary Pill & Mark All as Read */}
          <View style={styles.statsSummaryRow}>
            <View style={[styles.badgePill, { backgroundColor: 'rgba(0, 132, 255, 0.1)', borderColor: '#0084FF' }]}>
              <MaterialCommunityIcons name="bell" size={13} color="#0084FF" />
              <Text style={[styles.badgePillText, { color: '#0084FF' }]}>
                {notificationList.length} Total Alerts {unreadCount > 0 ? `• ${unreadCount} Unread` : '• All Read'}
              </Text>
            </View>

            {unreadCount > 0 && (
              <TouchableOpacity
                onPress={handleMarkAllRead}
                disabled={isMarkingRead}
                style={[styles.markAllBtn, { borderColor: activeTheme.cardBorder }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isMarkingRead ? (
                  <ActivityIndicator size="small" color="#0084FF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="check-all" size={14} color="#0084FF" />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0084FF', marginLeft: 4 }}>
                      Mark all read
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* FILTER TABS ROW */}
          <View style={styles.filterPillsRow}>
            {[
              { key: 'all' as const, label: `All (${notificationList.length})` },
              { key: 'unread' as const, label: `Unread (${unreadCount})` },
              { key: 'booking' as const, label: `Bookings (${notificationList.filter(n => n.type === 'booking').length})` },
              { key: 'general' as const, label: `General` },
            ].map(tab => {
              const isSel = activeFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveFilter(tab.key)}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isSel ? '#0084FF' : activeTheme.pillInactiveBg,
                      borderColor: isSel ? '#0084FF' : activeTheme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.filterPillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* LOADING INDICATOR / GUEST STATE */}
        {!isLoggedIn ? (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
              <MaterialCommunityIcons name="bell-off-outline" size={38} color={activeTheme.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: activeTheme.textPrimary }]}>Sign In for Alerts</Text>
            <Text style={[styles.emptySubtitle, { color: activeTheme.textSecondary, marginBottom: 18 }]}>
              Log in to receive real-time booking updates, service reminders, and invoice notifications.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: '#0084FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
              onPress={onOpenAuth}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="login" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>SIGN IN / REGISTER</Text>
            </TouchableOpacity>
          </View>
        ) : loading && notificationList.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#0084FF" />
            <Text style={[styles.loadingText, { color: activeTheme.textSecondary }]}>
              Fetching alerts from MySQL database...
            </Text>
          </View>
        ) : filteredNotifications.length === 0 ? (
          /* EMPTY STATE */
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconCircle, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
              <MaterialCommunityIcons name="bell-off-outline" size={38} color={activeTheme.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: activeTheme.textPrimary }]}>No Alerts Found</Text>
            <Text style={[styles.emptySubtitle, { color: activeTheme.textSecondary }]}>
              {activeFilter === 'unread'
                ? 'You have caught up with all notifications.'
                : 'No alerts found in the database for this filter.'}
            </Text>
          </View>
        ) : (
          /* NOTIFICATIONS LIST */
          filteredNotifications.map(notif => {
            const iconInfo = getNotificationIconInfo(notif);
            const isUnread = !notif.isRead;

            return (
              <TouchableOpacity
                key={String(notif.id) + '-' + notif.createdAt}
                activeOpacity={0.78}
                onPress={() => handleOpenDetail(notif)}
              >
                <GlassCard
                  theme={theme}
                  style={[
                    styles.notificationCard,
                    isUnread && { borderColor: '#0084FF', backgroundColor: 'rgba(0, 132, 255, 0.04)' },
                  ]}
                  intensity={activeTheme.glassIntensity}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.iconBox, { backgroundColor: iconInfo.bg }]}>
                        <MaterialCommunityIcons name={iconInfo.icon as any} size={18} color={iconInfo.color} />
                      </View>
                      <View style={{ marginLeft: 10, flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.notifTitle, { color: activeTheme.textPrimary }]} numberOfLines={1}>
                            {notif.title}
                          </Text>
                          {isUnread && <View style={styles.unreadDot} />}
                        </View>
                        <Text style={[styles.notifTime, { color: activeTheme.textSecondary }]}>
                          {notif.formattedTime} • {notif.createdAt?.substring(0, 16)}
                        </Text>
                      </View>
                    </View>

                    <MaterialCommunityIcons name="chevron-right" size={18} color={activeTheme.textSecondary} />
                  </View>

                  {/* Message Preview */}
                  <Text style={[styles.notifMessage, { color: activeTheme.textPrimary }]} numberOfLines={2}>
                    {notif.message}
                  </Text>

                  {/* Footer details (Booking Reference Tag) */}
                  {notif.bookingNumber && (
                    <View style={styles.cardFooter}>
                      <View style={[styles.bookingRefPill, { backgroundColor: activeTheme.pillInactiveBg, borderColor: activeTheme.cardBorder }]}>
                        <MaterialCommunityIcons name="ticket-confirmation-outline" size={12} color="#0084FF" />
                        <Text style={[styles.bookingRefText, { color: '#0084FF' }]}>
                          Ref: {notif.bookingNumber}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#0084FF' }}>
                        View Details →
                      </Text>
                    </View>
                  )}
                </GlassCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ──────────────────────────────────────────────────────────────────────────────
          MOBILE ALERT & NOTIFICATION DETAIL POPUP MODAL DESIGN
      ────────────────────────────────────────────────────────────────────────────── */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          {selectedNotif && (
            <View style={[styles.popupCard, { backgroundColor: activeTheme.modalBg, borderColor: activeTheme.cardBorder }]}>
              {/* Top Ambient Glow / Header */}
              <View style={styles.popupTopBar}>
                {(() => {
                  const info = getNotificationIconInfo(selectedNotif);
                  return (
                    <>
                      <View style={[styles.popupIconCircle, { backgroundColor: info.bg, borderColor: info.color }]}>
                        <MaterialCommunityIcons name={info.icon as any} size={28} color={info.color} />
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: info.bg, borderColor: info.color, marginTop: 12 }]}>
                        <Text style={[styles.statusBadgeText, { color: info.color }]}>{info.label}</Text>
                      </View>
                    </>
                  );
                })()}

                <TouchableOpacity
                  style={styles.popupCloseBtn}
                  onPress={() => setModalVisible(false)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <MaterialCommunityIcons name="close" size={22} color={activeTheme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Title & Timestamp */}
              <Text style={[styles.popupTitle, { color: activeTheme.textPrimary }]}>
                {selectedNotif.title}
              </Text>

              <View style={styles.popupTimeRow}>
                <MaterialCommunityIcons name="clock-outline" size={14} color={activeTheme.textSecondary} />
                <Text style={[styles.popupTimeText, { color: activeTheme.textSecondary }]}>
                  {selectedNotif.createdAt} ({selectedNotif.formattedTime})
                </Text>
              </View>

              {/* Message Glass Container */}
              <View style={[styles.popupMessageBox, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.inputBorder }]}>
                <Text style={[styles.popupMessageText, { color: activeTheme.textPrimary }]}>
                  {selectedNotif.message}
                </Text>
              </View>

              {/* Attached Booking Reference Card */}
              {selectedNotif.bookingNumber && (
                <View style={[styles.popupBookingCard, { borderColor: '#0084FF', backgroundColor: 'rgba(0, 132, 255, 0.06)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="car-wash" size={20} color="#0084FF" />
                    <View>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#0084FF', letterSpacing: 0.5 }}>
                        SERVICE BOOKING REFERENCE
                      </Text>
                      <Text style={[styles.popupBookingNum, { color: activeTheme.textPrimary }]}>
                        {selectedNotif.bookingNumber}
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.viewBookingBtn, { backgroundColor: '#0084FF' }]}
                    onPress={() => {
                      setModalVisible(false);
                      if (onOpenBookingDetail && selectedNotif.bookingNumber) {
                        onOpenBookingDetail(selectedNotif.bookingNumber);
                      } else if (onNavigateTab) {
                        onNavigateTab('bookings');
                      }
                    }}
                  >
                    <Text style={styles.viewBookingBtnText}>VIEW BOOKING</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Actions Footer */}
              <View style={styles.popupActionRow}>
                <TouchableOpacity
                  style={[styles.popupDismissBtn, { borderColor: activeTheme.cardBorder }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={[styles.popupDismissBtnText, { color: activeTheme.textSecondary }]}>CLOSE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.popupActionBtn, { backgroundColor: activeTheme.accentBtnBg }]}
                  onPress={() => {
                    setModalVisible(false);
                    if (selectedNotif.bookingNumber && onNavigateTab) {
                      onNavigateTab('bookings');
                    }
                  }}
                >
                  <Text style={styles.popupActionBtnText}>
                    {selectedNotif.bookingNumber ? 'VIEW BOOKINGS' : 'OKAY'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.theme === nextProps.theme &&
    prevProps.userId === nextProps.userId &&
    prevProps.isLoading === nextProps.isLoading &&
    prevProps.refreshing === nextProps.refreshing &&
    prevProps.notifications === nextProps.notifications
  );
});

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  tabHeaderContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  tabMainTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tabSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 10,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  notificationCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0084FF',
  },
  notifTime: {
    fontSize: 11,
    marginTop: 2,
  },
  notifMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
    marginLeft: 48,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginLeft: 48,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(150, 150, 150, 0.15)',
  },
  bookingRefPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  bookingRefText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.76)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    position: 'relative',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  popupTopBar: {
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  popupIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  popupCloseBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  popupTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  popupTimeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  popupMessageBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  popupMessageText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
  popupBookingCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  popupBookingNum: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  viewBookingBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewBookingBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  popupActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  popupDismissBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupDismissBtnText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  popupActionBtn: {
    flex: 1.4,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
