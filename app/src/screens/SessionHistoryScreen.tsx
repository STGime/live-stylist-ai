import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import FloatingBubbles from '../components/FloatingBubbles';
import { shareSummary } from '../utils/shareSummary';
import * as api from '../services/api';
import type { RootStackParamList, SessionHistoryItem } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'SessionHistory'>;

const OCCASION_LABELS: Record<string, string> = {
  casual: 'Casual',
  work: 'Work',
  date_night: 'Date Night',
  event: 'Event',
  going_out: 'Going Out',
  selfcare: 'Self-Care',
};

export default function SessionHistoryScreen({ navigation }: Props) {
  const [sessions, setSessions] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      api.getSessionHistory().then(data => {
        if (active) {
          setSessions(data);
          setLoading(false);
        }
      }).catch(() => {
        if (active) setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderItem = ({ item }: { item: SessionHistoryItem }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
          {item.duration_seconds != null && (
            <Text style={styles.cardDuration}>{formatDuration(item.duration_seconds)}</Text>
          )}
          {item.occasion && (
            <View style={styles.occasionBadge}>
              <Text style={styles.occasionText}>
                {OCCASION_LABELS[item.occasion] || item.occasion}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => shareSummary(item.summary, item.tips)}
          style={styles.shareButton}
          activeOpacity={0.7}>
          <Text style={styles.shareIcon}>↗</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.summary} numberOfLines={4}>{item.summary}</Text>

      {item.tips && item.tips.length > 0 && (
        <View style={styles.tipsContainer}>
          {item.tips.map((tip, i) => (
            <View key={i} style={styles.tipPill}>
              <Text style={styles.tipIcon}>✨</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
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
        <Text style={styles.title}>Past Sessions</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.pink} style={{ marginTop: 60 }} />
      ) : sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💅</Text>
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptySub}>Start your first style session to see your history here!</Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={item => item.session_id}
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
  backText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  list: {
    padding: 18,
    paddingBottom: 40,
    gap: 14,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    flex: 1,
  },
  cardDate: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  cardDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  occasionBadge: {
    backgroundColor: COLORS.pinkSoft,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 50,
  },
  occasionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.pink,
  },
  shareButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.pinkSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.pink,
  },
  summary: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textDark,
    lineHeight: 20,
  },
  tipsContainer: {
    marginTop: 12,
    gap: 6,
  },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.pinkPale,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tipIcon: {
    fontSize: 12,
    marginTop: 1,
  },
  tipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
    flex: 1,
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
