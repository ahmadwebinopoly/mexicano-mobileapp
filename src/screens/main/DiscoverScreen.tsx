import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  SectionList,
  TextInput,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  type ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getMenuItems, getMenuCategories, type MenuItem as ApiMenuItem, type MenuCategory } from '../../api/discoverScreen';
import { getNetworkErrorMessage } from '../../api/apiConfig';
import { navigateToCart } from '../../navigation/rootNavigationRef';
import { DiscoverScreenSkeleton } from '../../components/skeleton';
import { getAddress } from '../../api/saveadresss';

const BG_DARK = '#0B1D1B';
const CARD_BG = '#152C29';
const SEARCH_BG = '#1F403C';
const GOLD = '#FECB4D';
const GOLD_MUTED = '#E5B948';
const TEXT_WHITE = '#FFFFFF';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 16;
const BANNER_HEIGHT = 160;
const SEARCH_WRAP_HEIGHT = 12 + 44 + 10; // searchWrap paddingTop + searchBar height + paddingBottom
const TABS_WRAP_HEIGHT = 50; // tab pills + paddingBottom so in-flow tabs are fully off screen before sticky shows
const STICKY_TABS_THRESHOLD = BANNER_HEIGHT + SEARCH_WRAP_HEIGHT + TABS_WRAP_HEIGHT;

function formatPrice(price: string): string {
  if (price == null || String(price).trim() === '') return '$0.00';
  const p = String(price).trim();
  return p.startsWith('$') ? p : `$${p}`;
}

/** Raw addon from items API (linked to menu item). */
type DiscoverAddonRaw = { id: string; name?: string; price?: string; [key: string]: unknown };

export interface DiscoverMenuItem {
  id: string;
  name: string;
  description: string;
  price: string;
  /** Only API image URL; null = no image → show skeleton */
  image: { uri: string } | null;
  /** Cooking time from API (e.g. "10-15 mins") */
  cookingTime?: string;
  /** Linked add-ons from the items API */
  addons?: DiscoverAddonRaw[];
}

function mapApiItemToDiscover(item: ApiMenuItem & { addons?: unknown[]; cookingTime?: string }): DiscoverMenuItem {
  const raw = item.image;
  const image =
    raw && typeof raw === 'string' && raw.trim().length > 0
      ? { uri: raw.trim() }
      : raw && typeof raw === 'object' && raw.uri && String(raw.uri).trim().length > 0
        ? { uri: String(raw.uri).trim() }
        : null;
  const addons = Array.isArray(item.addons)
    ? (item.addons as DiscoverAddonRaw[])
    : undefined;
  const cookingTime = item.cookingTime != null && String(item.cookingTime).trim() !== '' ? String(item.cookingTime).trim() : undefined;
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? 'Delicious Mexican-style dish.',
    price: item.price,
    image,
    cookingTime,
    addons,
  };
}

function itemsForCategory(
  items: ApiMenuItem[],
  category: MenuCategory
): DiscoverMenuItem[] {
  return items
    .filter((i) => {
      const categoryId = (i as ApiMenuItem & { categoryId?: string; category?: string }).categoryId;
      const categoryName = (i as ApiMenuItem & { category?: string }).category;
      return (
        categoryId === category.id ||
        (categoryName && categoryName.toLowerCase() === category.name.toLowerCase())
      );
    })
    .map(mapApiItemToDiscover);
}

function defaultCategoryIndex(categories: MenuCategory[]): number {
  const breakfastIndex = categories.findIndex(
    (c) => c.name.toLowerCase() === 'breakfast'
  );
  return breakfastIndex >= 0 ? breakfastIndex : 0;
}

function buildMenuSections(
  categories: MenuCategory[],
  allItems: ApiMenuItem[]
): { title: string; items: DiscoverMenuItem[] }[] {
  return categories.map((cat) => ({
    title: cat.name,
    items: itemsForCategory(allItems, cat),
  }));
}

export default function DiscoverScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [allItems, setAllItems] = useState<ApiMenuItem[]>([]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  const handleItemPress = (item: DiscoverMenuItem) => {
    navigation.getParent()?.navigate('ItemDetail', { item });
  };
  const mainListRef = useRef<SectionList<DiscoverMenuItem>>(null);
  const tabsScrollRef = useRef<ScrollView>(null);
  const stickyTabsScrollRef = useRef<ScrollView>(null);
  const [showStickyTabs, setShowStickyTabs] = useState(false);
  const prevStickyRef = useRef(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  const menuSections = React.useMemo(
    () => buildMenuSections(categories, allItems),
    [categories, allItems]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [cats, items] = await Promise.all([getMenuCategories(), getMenuItems()]);
        if (cancelled) return;
        setCategories(cats);
        setAllItems(items);
        if (cats.length > 0) {
          setActiveTabIndex(defaultCategoryIndex(cats));
        }
      } catch (e) {
        if (!cancelled) setError(getNetworkErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        try {
          const address = await getAddress();
          if (!active) return;
          setFullAddress(address?.address?.trim() || '');
        } catch {
          if (!active) return;
          setFullAddress('');
        }
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const scrollTabsToIndex = useCallback((index: number) => {
    const estimatedTabWidth = 110;
    const x = Math.max(0, index * estimatedTabWidth - SCREEN_WIDTH / 2 + estimatedTabWidth / 2);
    tabsScrollRef.current?.scrollTo({ x, animated: true });
    stickyTabsScrollRef.current?.scrollTo({ x, animated: true });
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      const sticky = y >= STICKY_TABS_THRESHOLD;
      if (sticky !== prevStickyRef.current) {
        prevStickyRef.current = sticky;
        setShowStickyTabs(sticky);
      }
    },
    []
  );

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstVisible = viewableItems.find(
        (token) => token.isViewable && typeof token.section?.title === 'string'
      );
      if (!firstVisible?.section?.title) return;
      const index = menuSections.findIndex((s) => s.title === firstVisible.section.title);
      if (index >= 0) {
        setActiveTabIndex((prev) => {
          if (prev === index) return prev;
          scrollTabsToIndex(index);
          return index;
        });
      }
    },
    [menuSections, scrollTabsToIndex]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 35,
  }).current;

  const onTabPress = useCallback(
    (index: number) => {
      mainListRef.current?.scrollToLocation({
        sectionIndex: index,
        itemIndex: 0,
        animated: true,
        viewOffset: showStickyTabs ? 60 : 0,
      });
      setActiveTabIndex(index);
      scrollTabsToIndex(index);
    },
    [scrollTabsToIndex, showStickyTabs]
  );

  const renderTabs = () => (
    <ScrollView
      ref={tabsScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContent}
    >
      {categories.map((cat, index) => (
        <Pressable
          key={cat.id}
          onPress={() => onTabPress(index)}
          style={[
            styles.tabPill,
            activeTabIndex === index && styles.tabPillActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTabIndex === index && styles.tabTextActive,
            ]}
            numberOfLines={1}
          >
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  const renderStickyTabs = () => (
    <ScrollView
      ref={stickyTabsScrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tabsContent}
    >
      {categories.map((cat, index) => (
        <Pressable
          key={`sticky-${cat.id}`}
          onPress={() => onTabPress(index)}
          style={[
            styles.tabPill,
            activeTabIndex === index && styles.tabPillActive,
          ]}
        >
          <Text
            style={[
              styles.tabText,
              activeTabIndex === index && styles.tabTextActive,
            ]}
            numberOfLines={1}
          >
            {cat.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Header */}
      <View
        style={styles.header}
        onLayout={(e) => {
          setHeaderHeight(e.nativeEvent.layout.height);
        }}
      >
        <Pressable style={styles.headerIconBtn}>
          <MaterialIcons name="home" size={20} color={BG_DARK} />
        </Pressable>
        <Pressable
          style={styles.headerCenter}
          onPress={() => {
            const parentNav = navigation.getParent?.();
            if (parentNav) {
              parentNav.navigate('Address');
              return;
            }
            navigation.navigate('Address');
          }}
        >
          <Text style={styles.headerAddressLabel}>FULL ADDRESS</Text>
          <Text style={styles.headerAddressValue} numberOfLines={1}>
            {fullAddress || 'Set your delivery address'}
          </Text>
        </Pressable>
        <Pressable style={styles.headerIconBtn} onPress={navigateToCart}>
          <Ionicons name="cart-outline" size={20} color={BG_DARK} />
        </Pressable>
      </View>

      {/* Sticky tabs – visible when scrolled past banner + search */}
      {showStickyTabs && categories.length > 0 ? (
        <View style={[styles.stickyTabsWrap, { top: headerHeight }]}>
          {renderStickyTabs()}
        </View>
      ) : null}

      {/* Single scroll: Banner → Search → Tabs → Menu content */}
      <SectionList
        ref={mainListRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          showStickyTabs && { paddingTop: TABS_WRAP_HEIGHT },
        ]}
        sections={loading ? [] : menuSections.map((section) => ({ title: section.title, data: section.items }))}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.length === 0 ? (
              <Text style={styles.emptySectionText}>No items in this category yet.</Text>
            ) : null}
          </View>
        )}
        renderItem={({ item, section, index }) => {
          if (section.data.length === 0) return null;
          const isLastItem = index === section.data.length - 1;
          return (
            <Pressable
              key={item.id}
              style={[styles.menuRow, isLastItem && styles.menuRowLast]}
              onPress={() => handleItemPress(item)}
            >
              <View style={styles.menuRowText}>
                <Text style={styles.menuRowName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.menuRowDesc} numberOfLines={2}>
                  {item.description}
                </Text>
                <View style={styles.menuRowBottom}>
                  <Text style={styles.menuRowPrice}>{formatPrice(item.price)}</Text>
                </View>
              </View>
              <View style={styles.menuRowRight}>
                <View style={styles.menuRowImageWrap}>
                  {item.image ? (
                    <Image
                      source={item.image}
                      style={styles.menuRowImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.menuRowImageSkeleton}>
                      <MaterialIcons name="image-not-supported" size={24} color="rgba(255,255,255,0.35)" />
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        stickySectionHeadersEnabled={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={48}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={(
          <>
            {/* Banner (scrolls away) */}
            <View style={styles.bannerWrap}>
              <Image
                source={require('../../../assets/Slider.png')}
                style={styles.bannerImage}
                resizeMode="cover"
              />
            </View>

            {/* Search bar (scrolls away) */}
            <View style={styles.searchWrap}>
              <View style={styles.searchBar}>
                <MaterialIcons name="search" size={22} color={GOLD} style={styles.searchIcon} />
                <TextInput
                  placeholder="Search at Mexicano..."
                  placeholderTextColor="rgba(255,255,255,0.5)"
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Menu tabs in flow (scrolls away) */}
            <View style={styles.tabsWrap}>
              {renderTabs()}
            </View>

            {/* Menu items / skeleton / error */}
            {error ? (
              <View style={styles.apiError}>
                <Text style={styles.apiErrorText}>{error}</Text>
              </View>
            ) : null}
            {loading ? (
              <DiscoverScreenSkeleton />
            ) : null}
          </>
        )}
        ListFooterComponent={<View style={styles.bottomSpacer} />}
      >
      </SectionList>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_DARK,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BG_DARK,
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingVertical: 12,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  headerAddressLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerAddressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  bannerWrap: {
    height: BANNER_HEIGHT,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  searchWrap: {
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: BG_DARK,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SEARCH_BG,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 44,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_WHITE,
  },
  tabsWrap: {
    backgroundColor: BG_DARK,
    paddingBottom: 10,
  },
  tabsContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    gap: 8,
    paddingRight: HORIZONTAL_PADDING + 32,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.30)',
  },
  tabPillActive: {
    backgroundColor: GOLD,
    borderColor: 'transparent',
  },
  tabText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  tabTextActive: {
    color: BG_DARK,
  },
  stickyTabsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: BG_DARK,
    zIndex: 10,
    paddingVertical: 10,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 20,
  },
  section: {
    marginTop: 8,
    marginBottom: 6,
  },
  emptySectionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_WHITE,
    marginBottom: 6,
  },
  menuRow: {
    flexDirection: 'row',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(229,185,72,0.3)',
    alignItems: 'center',
  },
  menuRowLast: {
    marginBottom: 0,
  },
  menuRowText: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    justifyContent: 'center',
  },
  menuRowName: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    fontWeight: '700',
    color: TEXT_WHITE,
  },
  menuRowDesc: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  menuRowBottom: {
    marginTop: 6,
  },
  menuRowPrice: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    fontWeight: '700',
    color: GOLD,
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuRowImageWrap: {
    width: 68,
    height: 68,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  menuRowImage: {
    width: '100%',
    height: '100%',
  },
  menuRowImageSkeleton: {
    width: '100%',
    height: '100%',
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiError: {
    padding: 24,
    alignItems: 'center',
  },
  apiErrorText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  bottomSpacer: {
    height: 96,
  },
});
