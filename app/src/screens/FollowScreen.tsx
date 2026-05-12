import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import FloatingBubbles from '../components/FloatingBubbles';
import { useDialog } from '../components/AppDialog';
import * as api from '../services/api';
import type { RootStackParamList, FollowSummary } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Follow'>;

export default function FollowScreen({ navigation }: Props) {
  const dialog = useDialog();
  const [myMagicId, setMyMagicId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [aliasInput, setAliasInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<FollowSummary[]>([]);
  const [following, setFollowing] = useState<FollowSummary[]>([]);
  const [followers, setFollowers] = useState<FollowSummary[]>([]);
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [magic, p, fo, fr] = await Promise.all([
        api.getMyMagicId().catch(() => null),
        api.listPendingFollows().catch(() => []),
        api.listFollowing().catch(() => []),
        api.listFollowers().catch(() => []),
      ]);
      setMyMagicId(magic?.magic_id ?? null);
      setPending(p);
      setFollowing(fo);
      setFollowers(fr);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handleShareMagicId = async () => {
    if (!myMagicId) return;
    try {
      await Share.share({
        message: `Follow me on LiveStylist — my ID is ${myMagicId}`,
      });
    } catch {
      // user cancelled
    }
  };

  const handleSend = async () => {
    const cleaned = input.trim();
    if (!cleaned) return;
    setSubmitting(true);
    try {
      const aliasTrimmed = aliasInput.trim();
      await api.requestFollow(cleaned, aliasTrimmed ? aliasTrimmed : null);
      setInput('');
      setAliasInput('');
      await dialog.alert({
        title: 'Request sent',
        message: "We'll let you know once they accept.",
      });
      refresh();
    } catch (err: any) {
      const code = err?.code ?? '';
      const msg = err?.message ?? 'Could not send request';
      if (code === 'self_follow') {
        await dialog.alert({ title: "That's you", message: 'You can\'t follow yourself.' });
      } else if (err?.status === 404) {
        await dialog.alert({ title: 'No match', message: 'No user with that ID. Double-check the spelling.' });
      } else if (err?.status === 409) {
        await dialog.alert({ title: 'Already following', message: msg });
      } else {
        await dialog.alert({ title: 'Could not send', message: msg });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startRename = (item: FollowSummary) => {
    setEditingAliasId(item.id);
    setAliasDraft(item.follower_alias ?? item.followee_name ?? '');
  };

  const cancelRename = () => {
    setEditingAliasId(null);
    setAliasDraft('');
  };

  const saveRename = async (id: string) => {
    const trimmed = aliasDraft.trim();
    try {
      await api.updateFollowAlias(id, trimmed ? trimmed : null);
      setEditingAliasId(null);
      setAliasDraft('');
      refresh();
    } catch (err: any) {
      await dialog.alert({ title: 'Try again', message: err?.message ?? 'Could not save name.' });
    }
  };

  const handleRespond = async (id: string, action: 'accept' | 'deny') => {
    try {
      await api.respondToFollow(id, action);
      refresh();
    } catch (err: any) {
      await dialog.alert({ title: 'Try again', message: err?.message ?? 'Something went wrong.' });
    }
  };

  const handleUnfollow = async (item: FollowSummary, side: 'following' | 'follower') => {
    const label = side === 'following'
      ? (item.follower_alias ?? item.followee_name)
      : item.follower_name;
    const ok = await dialog.confirm({
      title: side === 'following' ? `Unfollow ${label ?? 'this user'}?` : `Remove ${label ?? 'this follower'}?`,
      message: 'You can re-add them later if you change your mind.',
      cancelLabel: 'Cancel',
      confirmLabel: side === 'following' ? 'Unfollow' : 'Remove',
    });
    if (!ok) return;
    try {
      await api.unfollow(item.id);
      refresh();
    } catch (err: any) {
      await dialog.alert({ title: 'Try again', message: err?.message ?? 'Something went wrong.' });
    }
  };

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
        <Text style={styles.title}>Friends</Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.pink} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* My magic ID */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Your magic ID</Text>
            <Text style={styles.magicId} selectable>{myMagicId ?? '—'}</Text>
            <Text style={styles.help}>Share this with a friend and they'll be able to ask to follow your sessions.</Text>
            <TouchableOpacity
              onPress={handleShareMagicId}
              disabled={!myMagicId}
              style={[styles.primaryButton, !myMagicId && styles.primaryDisabled]}>
              <Text style={styles.primaryButtonText}>Share my ID</Text>
            </TouchableOpacity>
          </View>

          {/* Send a request */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Follow someone</Text>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Enter their magic ID"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.input, styles.aliasInput]}
              value={aliasInput}
              onChangeText={setAliasInput}
              placeholder="Name them (e.g. Mom, Maya from work)"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="words"
              maxLength={60}
            />
            <Text style={styles.aliasHint}>
              Optional — a label only you see, so you remember who's behind the magic ID.
            </Text>
            <TouchableOpacity
              onPress={handleSend}
              disabled={submitting || input.trim().length === 0}
              style={[
                styles.primaryButton,
                (submitting || input.trim().length === 0) && styles.primaryDisabled,
              ]}>
              <Text style={styles.primaryButtonText}>
                {submitting ? 'Sending…' : 'Send request'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Incoming pending */}
          {pending.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wants to follow you</Text>
              {pending.map((p) => (
                <View key={p.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{p.follower_name ?? 'Someone'}</Text>
                    {p.follower_magic_id && (
                      <Text style={styles.rowMeta}>{p.follower_magic_id}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRespond(p.id, 'accept')}
                    style={[styles.smallButton, styles.acceptButton]}>
                    <Text style={styles.acceptText}>Allow</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleRespond(p.id, 'deny')}
                    style={[styles.smallButton, styles.denyButton]}>
                    <Text style={styles.denyText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* People I follow */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>You follow</Text>
            {following.length === 0 ? (
              <Text style={styles.emptyHint}>Nobody yet. Paste a magic ID above to follow a friend.</Text>
            ) : (
              following.map((f) => {
                const displayName = f.follower_alias ?? f.followee_name ?? 'Someone';
                const isEditing = editingAliasId === f.id;
                return (
                  <View key={f.id} style={styles.row}>
                    {isEditing ? (
                      <View style={{ flex: 1, gap: 6 }}>
                        <TextInput
                          style={styles.inlineInput}
                          value={aliasDraft}
                          onChangeText={setAliasDraft}
                          placeholder="Their nickname"
                          placeholderTextColor={COLORS.textMuted}
                          autoFocus
                          maxLength={60}
                        />
                        <Text style={styles.rowMeta}>
                          {f.followee_name ? `${f.followee_name} · ` : ''}{f.followee_magic_id ?? ''}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowName}>{displayName}</Text>
                        <Text style={styles.rowMeta}>
                          {f.follower_alias && f.followee_name ? `aka ${f.followee_name}` : null}
                          {f.follower_alias && f.followee_name && f.followee_magic_id ? ' · ' : null}
                          {f.followee_magic_id ?? ''}
                        </Text>
                      </View>
                    )}
                    {isEditing ? (
                      <>
                        <TouchableOpacity
                          onPress={() => saveRename(f.id)}
                          style={[styles.smallButton, styles.acceptButton]}>
                          <Text style={styles.acceptText}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={cancelRename}
                          style={[styles.smallButton, styles.denyButton]}>
                          <Text style={styles.denyText}>Cancel</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <TouchableOpacity
                          onPress={() => startRename(f)}
                          style={[styles.smallButton, styles.ghostButton]}>
                          <Text style={styles.ghostText}>Rename</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleUnfollow(f, 'following')}
                          style={[styles.smallButton, styles.denyButton]}>
                          <Text style={styles.denyText}>Unfollow</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* People who follow me */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Following you</Text>
            {followers.length === 0 ? (
              <Text style={styles.emptyHint}>No followers yet.</Text>
            ) : (
              followers.map((f) => (
                <View key={f.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{f.follower_name ?? 'Someone'}</Text>
                    {f.follower_magic_id && (
                      <Text style={styles.rowMeta}>{f.follower_magic_id}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleUnfollow(f, 'follower')}
                    style={[styles.smallButton, styles.denyButton]}>
                    <Text style={styles.denyText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
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
  scroll: { padding: 18, paddingBottom: 60, gap: 14 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  magicId: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.textDark,
    letterSpacing: 3,
  },
  help: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMid,
    lineHeight: 18,
  },
  input: {
    backgroundColor: COLORS.pinkPale,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textDark,
    letterSpacing: 2,
    marginBottom: 12,
  },
  aliasInput: {
    letterSpacing: 0,
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 4,
  },
  aliasHint: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textMuted,
    marginBottom: 8,
    lineHeight: 14,
  },
  inlineInput: {
    backgroundColor: COLORS.pinkPale,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  primaryButton: {
    backgroundColor: COLORS.pink,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: 22,
    padding: 18,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '30',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textDark,
  },
  rowMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  acceptButton: {
    backgroundColor: COLORS.pink,
  },
  acceptText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
  denyButton: {
    backgroundColor: COLORS.grayLight,
  },
  denyText: {
    color: COLORS.textMid,
    fontWeight: '800',
    fontSize: 13,
  },
  ghostButton: {
    backgroundColor: COLORS.pinkSoft,
  },
  ghostText: {
    color: COLORS.pink,
    fontWeight: '800',
    fontSize: 13,
  },
  emptyHint: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMid,
    paddingVertical: 6,
  },
});
