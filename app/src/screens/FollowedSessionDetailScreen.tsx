import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import ImageView from 'react-native-image-viewing';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import FloatingBubbles from '../components/FloatingBubbles';
import * as api from '../services/api';
import type { RootStackParamList, FollowedSessionDetail } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'FollowedSessionDetail'>;

function hoursUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expired';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  if (hours <= 0) return `${minutes}m left`;
  return `${hours}h ${minutes}m left`;
}

export default function FollowedSessionDetailScreen({ route, navigation }: Props) {
  const { sessionId } = route.params;
  const [detail, setDetail] = useState<FollowedSessionDetail | null>(null);
  const [myDeviceId, setMyDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  // Derived from the fetched detail, not the navigation params, so a
  // hand-crafted navigate({ isOwner: true }) on a session that isn't
  // actually yours can't fake the "Your session" header.
  const isOwner = !!(detail && myDeviceId && detail.followee_device_id === myDeviceId);

  const imageSources = useMemo(
    () => (detail?.images ?? []).map((img) => ({ uri: img.url })),
    [detail?.images],
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getFollowedSession(sessionId),
      api.getDeviceId(),
    ])
      .then(([data, deviceId]) => {
        if (!active) return;
        setDetail(data);
        setMyDeviceId(deviceId);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        if (err?.status === 404) setMissing(true);
        setLoading(false);
      });
    return () => { active = false; };
  }, [sessionId]);

  return (
    <LinearGradient
      colors={[COLORS.cream, COLORS.pinkPale, COLORS.offWhite]}
      locations={[0, 0.6, 1]}
      style={styles.container}>
      <FloatingBubbles count={10} />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {(() => {
            if (isOwner) return 'Your session';
            const name = detail?.follower_alias ?? detail?.followee_name;
            return name ? `${name}'s session` : 'Session';
          })()}
        </Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.pink} style={{ marginTop: 60 }} />
      ) : missing || !detail ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌬️</Text>
          <Text style={styles.emptyTitle}>This session is gone</Text>
          <Text style={styles.emptySub}>
            Sessions and their images are kept for 24 hours, then automatically deleted.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {detail.images.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gallery}>
              {detail.images.map((img, idx) => (
                <TouchableOpacity
                  key={img.url}
                  style={styles.galleryItem}
                  activeOpacity={0.85}
                  onPress={() => setZoomIndex(idx)}>
                  <Image source={{ uri: img.url }} style={styles.galleryImage} />
                  <Text style={styles.expires}>{hoursUntil(img.expires_at)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noImageNote}>
              <Text style={styles.noImageText}>No preview images saved from this session.</Text>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Summary</Text>
            <Text style={styles.summary}>{detail.summary}</Text>
          </View>

          {detail.tips.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Tips</Text>
              {detail.tips.map((tip, i) => (
                <View key={i} style={styles.tipRow}>
                  <Text style={styles.tipBullet}>✨</Text>
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.disclaimer}>
            Style preview images are deleted automatically 24 hours after the session.
          </Text>
        </ScrollView>
      )}

      <ImageView
        images={imageSources}
        imageIndex={zoomIndex ?? 0}
        visible={zoomIndex !== null}
        onRequestClose={() => setZoomIndex(null)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        backgroundColor="#000"
      />
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
  title: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, maxWidth: 220 },
  scroll: { padding: 18, paddingBottom: 60, gap: 14 },
  gallery: { gap: 12, paddingRight: 18 },
  galleryItem: {
    alignItems: 'center',
    gap: 6,
  },
  galleryImage: {
    width: 220,
    height: 280,
    borderRadius: 18,
    backgroundColor: COLORS.pinkSoft,
  },
  expires: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  noImageNote: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
  },
  noImageText: {
    fontSize: 13,
    color: COLORS.textMid,
    fontWeight: '600',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summary: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textDark,
    lineHeight: 20,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    paddingVertical: 6,
  },
  tipBullet: { fontSize: 14 },
  tipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textMid,
    lineHeight: 18,
  },
  disclaimer: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  empty: {
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
