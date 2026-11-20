import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Modal,
  Share,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { GlassCard } from '../../components/GlassCard';
import {
  fetchBlogPostsFromApi,
  likeBlogPostApi,
  ApiBlogPost,
  FALLBACK_BLOG_POSTS
} from '../../services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BlogProps {
  theme: 'dark' | 'light';
  activeTheme: any;
  onBack: () => void;
}

export function Blog({ theme, activeTheme, onBack }: BlogProps) {
  const [posts, setPosts] = useState<ApiBlogPost[]>(FALLBACK_BLOG_POSTS);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPost, setSelectedPost] = useState<ApiBlogPost | null>(null);
  const [likedPosts, setLikedPosts] = useState<number[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadPosts() {
      setLoading(true);
      try {
        const data = await fetchBlogPostsFromApi();
        if (isMounted && data && data.length > 0) {
          setPosts(data);
        }
      } catch (e) {
        console.log('[Blog] Fetch error:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadPosts();
    return () => { isMounted = false; };
  }, []);

  const categories = ['All', 'Automotive', 'Home Living', 'Safety Guides', 'Lifestyle'];

  const filteredPosts = posts.filter(post => {
    const matchesCategory = activeCategory === 'All' || post.category.toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch =
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      post.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredPost = filteredPosts.length > 0 ? filteredPosts[0] : null;
  const regularPosts = filteredPosts.length > 1 ? filteredPosts.slice(1) : [];

  const handleLike = (postId: number) => {
    setLikedPosts(prev => {
      const isLiked = prev.includes(postId);
      const next = isLiked ? prev.filter(id => id !== postId) : [...prev, postId];
      setPosts(current =>
        current.map(p => {
          if (p.id === postId) {
            return { ...p, likes: isLiked ? p.likes - 1 : p.likes + 1 };
          }
          return p;
        })
      );
      if (!isLiked) {
        likeBlogPostApi(postId);
      }
      return next;
    });
  };

  const handleShare = async (post: ApiBlogPost) => {
    try {
      await Share.share({
        title: post.title,
        message: `${post.title}\n\nRead more on the ServEasy App: ${post.excerpt}`,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={[styles.headerRow, { borderBottomColor: activeTheme.cardBorder }]}>
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backBtn, { backgroundColor: activeTheme.pillInactiveBg }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={activeTheme.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.headerTitle, { color: activeTheme.textPrimary }]}>ServEasy Blog</Text>
          <Text style={[styles.headerSubtitle, { color: activeTheme.textSecondary }]}>
            Guides, Service Insights & Tips
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={[styles.searchBarWrap, { backgroundColor: activeTheme.inputBg, borderColor: activeTheme.cardBorder }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={activeTheme.iconColor} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: activeTheme.textPrimary }]}
            placeholder="Search guides, car tips, cleaning..."
            placeholderTextColor={activeTheme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={activeTheme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
          {categories.map(cat => {
            const isSel = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setActiveCategory(cat)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: isSel ? '#0084FF' : activeTheme.pillInactiveBg,
                    borderColor: isSel ? '#0084FF' : activeTheme.cardBorder,
                  }
                ]}
              >
                <Text style={[styles.categoryPillText, { color: isSel ? '#FFFFFF' : activeTheme.textSecondary }]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#0084FF" />
            <Text style={[styles.loadingText, { color: activeTheme.textSecondary }]}>Loading articles...</Text>
          </View>
        ) : filteredPosts.length === 0 ? (
          <View style={styles.centerBox}>
            <MaterialCommunityIcons name="book-open-page-variant-outline" size={48} color={activeTheme.textSecondary} />
            <Text style={[styles.emptyText, { color: activeTheme.textSecondary }]}>No articles found matching filters</Text>
          </View>
        ) : (
          <>
            {/* Featured Post Card */}
            {featuredPost && (
              <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedPost(featuredPost)}>
                <GlassCard
                  theme={theme}
                  style={[styles.featuredCard, { borderColor: activeTheme.cardBorder }]}
                  intensity={activeTheme.glassIntensity}
                >
                  <Image source={{ uri: featuredPost.image_url }} style={styles.featuredImage} />
                  <View style={styles.featuredBadgeRow}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>{featuredPost.category}</Text>
                    </View>
                    <View style={styles.readTimeBadge}>
                      <MaterialCommunityIcons name="clock-outline" size={12} color="#A0A5AD" />
                      <Text style={styles.readTimeText}>{featuredPost.read_time}</Text>
                    </View>
                  </View>

                  <Text style={[styles.featuredTitle, { color: activeTheme.textPrimary }]}>
                    {featuredPost.title}
                  </Text>
                  <Text style={[styles.featuredExcerpt, { color: activeTheme.textSecondary }]} numberOfLines={3}>
                    {featuredPost.excerpt}
                  </Text>

                  <View style={[styles.featuredFooter, { borderTopColor: activeTheme.cardBorder }]}>
                    <Text style={[styles.authorName, { color: activeTheme.textSecondary }]}>
                      By {featuredPost.author} • {featuredPost.created_at}
                    </Text>
                    <View style={styles.footerStats}>
                      <TouchableOpacity
                        onPress={() => handleLike(featuredPost.id)}
                        style={styles.statBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <MaterialCommunityIcons
                          name={likedPosts.includes(featuredPost.id) ? 'heart' : 'heart-outline'}
                          size={16}
                          color={likedPosts.includes(featuredPost.id) ? '#FF3B30' : activeTheme.iconColor}
                        />
                        <Text style={[styles.statText, { color: activeTheme.textSecondary }]}>
                          {featuredPost.likes}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.statBtn}>
                        <MaterialCommunityIcons name="eye-outline" size={16} color={activeTheme.iconColor} />
                        <Text style={[styles.statText, { color: activeTheme.textSecondary }]}>
                          {featuredPost.views}
                        </Text>
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            )}

            {/* Articles List / Grid */}
            {regularPosts.map(post => {
              const isLiked = likedPosts.includes(post.id);
              return (
                <TouchableOpacity key={post.id} activeOpacity={0.88} onPress={() => setSelectedPost(post)}>
                  <GlassCard
                    theme={theme}
                    style={[styles.articleCard, { borderColor: activeTheme.cardBorder }]}
                    intensity={activeTheme.glassIntensity}
                  >
                    <View style={styles.articleRow}>
                      <Image source={{ uri: post.image_url }} style={styles.articleThumb} />
                      <View style={styles.articleInfo}>
                        <View style={styles.articleTagRow}>
                          <Text style={[styles.articleCategory, { color: '#0084FF' }]}>{post.category}</Text>
                          <Text style={[styles.articleDot, { color: activeTheme.textSecondary }]}>•</Text>
                          <Text style={[styles.articleReadTime, { color: activeTheme.textSecondary }]}>{post.read_time}</Text>
                        </View>
                        <Text style={[styles.articleTitle, { color: activeTheme.textPrimary }]} numberOfLines={2}>
                          {post.title}
                        </Text>
                        <Text style={[styles.articleExcerpt, { color: activeTheme.textSecondary }]} numberOfLines={2}>
                          {post.excerpt}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.articleFooter, { borderTopColor: activeTheme.cardBorder }]}>
                      <Text style={[styles.articleAuthor, { color: activeTheme.textSecondary }]}>
                        {post.author}
                      </Text>
                      <View style={styles.footerStats}>
                        <TouchableOpacity
                          onPress={() => handleLike(post.id)}
                          style={styles.statBtn}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <MaterialCommunityIcons
                            name={isLiked ? 'heart' : 'heart-outline'}
                            size={16}
                            color={isLiked ? '#FF3B30' : activeTheme.iconColor}
                          />
                          <Text style={[styles.statText, { color: activeTheme.textSecondary }]}>{post.likes}</Text>
                        </TouchableOpacity>
                        <View style={styles.statBtn}>
                          <MaterialCommunityIcons name="eye-outline" size={16} color={activeTheme.iconColor} />
                          <Text style={[styles.statText, { color: activeTheme.textSecondary }]}>{post.views}</Text>
                        </View>
                      </View>
                    </View>
                  </GlassCard>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Full Article Reading Modal */}
      <Modal
        visible={!!selectedPost}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSelectedPost(null)}
      >
        {selectedPost && (
          <View style={styles.modalBackdrop}>
            <GlassCard theme={theme} style={styles.modalContainer} intensity={activeTheme.glassIntensity + 10}>
              <View style={[styles.modalHeader, { borderBottomColor: activeTheme.cardBorder }]}>
                <TouchableOpacity
                  onPress={() => setSelectedPost(null)}
                  style={[styles.closeModalBtn, { backgroundColor: activeTheme.pillInactiveBg }]}
                >
                  <MaterialCommunityIcons name="close" size={20} color={activeTheme.textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.modalHeaderLabel, { color: activeTheme.textSecondary }]} numberOfLines={1}>
                  {selectedPost.category}
                </Text>
                <TouchableOpacity
                  onPress={() => handleShare(selectedPost)}
                  style={[styles.closeModalBtn, { backgroundColor: activeTheme.pillInactiveBg }]}
                >
                  <MaterialCommunityIcons name="share-variant-outline" size={18} color="#0084FF" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <Image source={{ uri: selectedPost.image_url }} style={styles.modalHeroImage} />

                <View style={styles.modalMetaRow}>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryBadgeText}>{selectedPost.category}</Text>
                  </View>
                  <Text style={[styles.modalDate, { color: activeTheme.textSecondary }]}>
                    {selectedPost.created_at} • {selectedPost.read_time}
                  </Text>
                </View>

                <Text style={[styles.modalTitle, { color: activeTheme.textPrimary }]}>
                  {selectedPost.title}
                </Text>

                <View style={[styles.authorRow, { borderBottomColor: activeTheme.cardBorder }]}>
                  <View style={styles.authorAvatar}>
                    <Text style={styles.authorAvatarText}>{selectedPost.author.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.authorFullName, { color: activeTheme.textPrimary }]}>
                      {selectedPost.author}
                    </Text>
                    <Text style={[styles.authorRole, { color: activeTheme.textSecondary }]}>
                      ServEasy Verified Contributor
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleLike(selectedPost.id)}
                    style={[styles.modalLikeBtn, { borderColor: activeTheme.cardBorder }]}
                  >
                    <MaterialCommunityIcons
                      name={likedPosts.includes(selectedPost.id) ? 'heart' : 'heart-outline'}
                      size={18}
                      color={likedPosts.includes(selectedPost.id) ? '#FF3B30' : activeTheme.iconColor}
                    />
                    <Text style={[styles.modalLikeText, { color: activeTheme.textPrimary }]}>
                      {selectedPost.likes}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={[styles.modalBodyText, { color: activeTheme.textPrimary }]}>
                  {selectedPost.content}
                </Text>

                <TouchableOpacity
                  style={[styles.shareArticleBtn, { backgroundColor: activeTheme.accentBtnBg }]}
                  onPress={() => handleShare(selectedPost)}
                >
                  <MaterialCommunityIcons name="share-variant" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.shareArticleText}>Share this Guide</Text>
                </TouchableOpacity>
              </ScrollView>
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
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  categoriesScroll: {
    flexDirection: 'row',
    marginBottom: 18,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
  featuredCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  featuredImage: {
    width: '100%',
    height: 180,
    borderRadius: 14,
    marginBottom: 12,
  },
  featuredBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 132, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#0084FF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  readTimeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  readTimeText: {
    color: '#A0A5AD',
    fontSize: 11,
    fontWeight: '500',
  },
  featuredTitle: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 23,
    marginBottom: 6,
  },
  featuredExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  authorName: {
    fontSize: 11,
  },
  footerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
    fontWeight: '600',
  },
  articleCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  articleRow: {
    flexDirection: 'row',
  },
  articleThumb: {
    width: 86,
    height: 86,
    borderRadius: 12,
  },
  articleInfo: {
    flex: 1,
    marginLeft: 12,
  },
  articleTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  articleCategory: {
    fontSize: 11,
    fontWeight: '700',
  },
  articleDot: {
    marginHorizontal: 6,
    fontSize: 10,
  },
  articleReadTime: {
    fontSize: 11,
  },
  articleTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 3,
  },
  articleExcerpt: {
    fontSize: 11,
    lineHeight: 15,
  },
  articleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
  },
  articleAuthor: {
    fontSize: 11,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeModalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  modalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  modalHeroImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  modalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalDate: {
    fontSize: 12,
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 14,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0084FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  authorFullName: {
    fontSize: 13,
    fontWeight: '700',
  },
  authorRole: {
    fontSize: 11,
  },
  modalLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalLikeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalBodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  shareArticleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
  },
  shareArticleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
