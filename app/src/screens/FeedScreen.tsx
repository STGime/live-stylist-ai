import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import FloatingBubbles from '../components/FloatingBubbles';
import * as api from '../services/api';
import type { RootStackParamList, FeedItem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Feed'>;

const OCCASION_LABELS: Record<string, string> = {
  casual: 'Casual',
  work: 'Work',
  date_night: 'Date Night',
  event: 'Event',
  going_out: 'Going Out',
  selfcare: 'Self-Care',
};

function formatRelative(iso: string): string {
  const created = new Date(iso).getTime();
  const diff = Date.now() - created;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function FeedScreen({ navigation }: Props) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      api.getFeed().then((data) => {
        if (active) {
          setItems(data);
          setLoading(false);
        }
      }).catch(() => {
        if (active) setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const renderItem = ({ item }: { item: FeedItem }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.card}
      onPress={() => navigation.navigate('FollowedSessionDetail', { sessionId: item.session_id })}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName}>{item.followee_name ?? 'A friend'}</Text>
          <Text style={styles.cardMeta}>
            {formatRelative(item.created_at)}
            {item.occasion ? ` · ${OCCASION_LABELS[item.occasion] ?? item.occasion}` : ''}
          </Text>
        </View>
      </View>

      {item.image_urls.length > 0 && (
        <View style={styles.imageStrip}>
          {item.image_urls.slice(0, 3).map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.thumb} />
          ))}
          {item.image_urls.length > 3 && (
            <View style={[styles.thumb, styles.thumbMore]}>
              <Text style={styles.thumbMoreText}>+{item.image_urls.length - 3}</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.cardSummary} numberOfLines={3}>{item.summary}</Text>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={[COLORS.cream, COLORS.pinkPale, COLORS.offWhite]}
      locations={[0, 0.6, 1]}
      style={styles.container}>
      <FloatingBubbles count={12} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Feed</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.pink} style={{ marginTop: 60 }} />
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>
            Follow friends from the Friends screen — their style sessions will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.session_id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
  },
  backText: { fontSize: 20, fontWeight: '700', color: COLORS.textDark },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.textDark },
  list: { padding: 18, paddingBottom: 40, gap: 14 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 16,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  imageStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  thumb: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: COLORS.pinkPale,
  },
  thumbMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.pinkSoft,
  },
  thumbMoreText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.pink,
  },
  cardSummary: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textDark,
    lineHeight: 18,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 20,
  },
});
