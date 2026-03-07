/**
 * ProductCarousel — horizontal scrolling product cards that slide up
 * from the bottom during live sessions when the stylist mentions products.
 *
 * Auto-dismisses after 15 seconds. Tapping "Shop" opens the affiliate link.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Linking,
} from 'react-native';
import { COLORS } from '../theme/colors';
import type { ProductResult } from '../types';

interface Props {
  products: ProductResult[];
  onDismiss: () => void;
}

const REGION_FLAG: Record<string, string> = {
  eu: 'EU',
  us: 'US',
};

const AUTO_DISMISS_MS = 15000;

export default function ProductCarousel({ products, onDismiss }: Props) {
  const slideAnim = useRef(new Animated.Value(160)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (products.length === 0) {
      // Slide out
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 160, duration: 300, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      return;
    }

    // Slide in
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Auto-dismiss
    dismissTimer.current = setTimeout(onDismiss, AUTO_DISMISS_MS);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [products, slideAnim, fadeAnim, onDismiss]);

  if (products.length === 0) return null;

  const handleShop = (url: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {});
    }
  };

  const formatPrice = (price: string, currency: string) => {
    if (!price) return '';
    const symbol = currency === 'USD' ? '$' : currency === 'GBP' ? '\u00A3' : '\u20AC';
    return `${symbol}${price}`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
      pointerEvents="box-none">
      {/* Header row */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Recommended Products</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            {/* Region badge */}
            <View style={styles.regionBadge}>
              <Text style={styles.regionText}>{REGION_FLAG[item.region] || item.region}</Text>
            </View>

            {/* Product image */}
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.productImage} resizeMode="cover" />
            ) : (
              <View style={[styles.productImage, styles.imagePlaceholder]}>
                <Text style={styles.placeholderText}>No image</Text>
              </View>
            )}

            {/* Info */}
            <View style={styles.cardInfo}>
              {item.brand ? <Text style={styles.brandText} numberOfLines={1}>{item.brand}</Text> : null}
              <Text style={styles.nameText} numberOfLines={2}>{item.name}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.priceText}>{formatPrice(item.price, item.currency)}</Text>
                <Text style={styles.merchantText} numberOfLines={1}>{item.merchant}</Text>
              </View>
            </View>

            {/* Shop button */}
            <TouchableOpacity
              onPress={() => handleShop(item.affiliateUrl)}
              style={styles.shopButton}
              activeOpacity={0.7}>
              <Text style={styles.shopButtonText}>Shop</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 130,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
  },
  dismissText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
  },
  listContent: {
    paddingHorizontal: 14,
    gap: 10,
  },
  card: {
    width: 140,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  regionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  regionText: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  productImage: {
    width: '100%',
    height: 110,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
  },
  cardInfo: {
    padding: 8,
    gap: 2,
  },
  brandText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.pinkLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  nameText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 14,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  merchantText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.4)',
    flex: 1,
    textAlign: 'right',
    marginLeft: 4,
  },
  shopButton: {
    marginHorizontal: 8,
    marginBottom: 8,
    paddingVertical: 6,
    borderRadius: 50,
    backgroundColor: COLORS.pink,
    alignItems: 'center',
  },
  shopButtonText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.white,
  },
});
