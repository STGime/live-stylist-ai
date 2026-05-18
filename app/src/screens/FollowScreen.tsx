import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Share,
  AppState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import FloatingBubbles from '../components/FloatingBubbles';
import { useDialog } from '../components/AppDialog';
import ReportSheet from '../components/ReportSheet';
import { isFollowRequestReported, markFollowRequestReported } from '../services/reported';
import * as api from '../services/api';
import { registerForPushNotifications } from '../services/push';
import type { RootStackParamList, FollowSummary, BlockSummary } from '../types';

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
  const [blocked, setBlocked] = useState<BlockSummary[]>([]);
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [aliasDraft, setAliasDraft] = useState('');
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);

  const refresh = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true);
    try {
      const [magic, p, fo, fr, bl] = await Promise.all([
        api.getMyMagicId().catch(() => null),
        api.listPendingFollows().catch(() => []),
        api.listFollowing().catch(() => []),
        api.listFollowers().catch(() => []),
        api.listBlocks().catch(() => []),
      ]);
      setMyMagicId(magic?.magic_id ?? null);
      setPending(p);
      setFollowing(fo);
      setFollowers(fr);
      setBlocked(bl);
    } finally {
      if (!opts.silent) setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Live-refresh while the screen is open: a follow-related push or the
  // app coming back to foreground should reconcile the list silently
  // (no spinner — the user is looking at content). Without this, an
  // incoming follow request only appears after navigating away and back.
  useEffect(() => {
    let pushSub: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      try {
        const Notifications = await import('expo-notifications');
        if (cancelled) return;
        pushSub = Notifications.addNotificationReceivedListener((n) => {
          const cat = (n.request.content.data as { category?: string } | undefined)?.category;
          if (cat === 'follow_request' || cat === 'follow_accepted') {
            refresh({ silent: true });
          }
        });
      } catch {
        // expo-notifications absent (tests, etc.) — fall through; the AppState
        // path still gives us a refresh on resume.
      }
    })();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh({ silent: true });
    });

    return () => {
      cancelled = true;
      pushSub?.remove();
      appStateSub.remove();
    };
  }, [refresh]);

  const handleShareMagicId = async () => {
    if (!myMagicId) return;
    // Sharing the ID is an explicit signal "I want followers". Ask for
    // notification permission now so we can tell them when someone asks
    // to follow. Fire-and-forget — Share still opens even if they decline.
    registerForPushNotifications().catch(() => {});
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
    // Sending a request implies they want to know when it's accepted.
    // Run in parallel with the request itself; we don't block on the
    // OS prompt outcome.
    registerForPushNotifications().catch(() => {});
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
    // Accepting a follow means the user opted into a social loop. Ask
    // for notification permission now so future "X finished a session"
    // pushes can land. Skip on deny — no notifications expected there.
    if (action === 'accept') {
      registerForPushNotifications().catch(() => {});
    }
    try {
      await api.respondToFollow(id, action);
      refresh();
    } catch (err: any) {
      await dialog.alert({ title: 'Try again', message: err?.message ?? 'Something went wrong.' });
    }
  };

  const handleBlock = async (item: FollowSummary, side: 'following' | 'follower') => {
    const displayName =
      side === 'following'
        ? (item.follower_alias ?? item.followee_name ?? 'this user')
        : (item.follower_name ?? 'this user');
    const ok = await dialog.confirm({
      title: `Block ${displayName}?`,
      message:
        "They won't be able to follow you or see your sessions, and any existing follow connection between you will be removed. They won't be notified.",
      cancelLabel: 'Cancel',
      confirmLabel: 'Block',
    });
    if (!ok) return;
    try {
      await api.blockByFollowId(item.id);
      refresh();
    } catch (err: any) {
      await dialog.alert({ title: 'Try again', message: err?.message ?? 'Could not block.' });
    }
  };

  const handleUnblock = async (item: BlockSummary) => {
    const displayName = item.blocked_name ?? item.blocked_magic_id ?? 'this user';
    const ok = await dialog.confirm({
      title: `Unblock ${displayName}?`,
      message: 'They\'ll be able to send follow requests again.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Unblock',
    });
    if (!ok) return;
    try {
      await api.unblock(item.id);
      refresh();
    } catch (err: any) {
      await dialog.alert({ title: 'Try again', message: err?.message ?? 'Could not unblock.' });
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

          {/* Incoming pending. Long-press a name to report — the
              affordance is hidden (no ⋯ button) to keep the row
              uncluttered, but matches Apple's §1.2 requirement. */}
          {pending.filter((p) => !isFollowRequestReported(p.id)).length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wants to follow you</Text>
              {pending.filter((p) => !isFollowRequestReported(p.id)).map((p) => (
                <View key={p.id} style={styles.row}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    activeOpacity={0.7}
                    onLongPress={() => setReportTargetId(p.id)}
                    accessibilityLabel={`Long press to report ${p.follower_name ?? 'this user'}`}>
                    <Text style={styles.rowName}>{p.follower_name ?? 'Someone'}</Text>
                    {p.follower_magic_id && (
                      <Text style={styles.rowMeta}>{p.follower_magic_id}</Text>
                    )}
                  </TouchableOpacity>
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
                    onPress={() => handleBlock(f, 'follower')}
                    style={[styles.smallButton, styles.dangerButton]}>
                    <Text style={styles.dangerText}>Block</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleUnfollow(f, 'follower')}
                    style={[styles.smallButton, styles.denyButton]}>
                    <Text style={styles.denyText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>

          {/* Blocked users */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Blocked</Text>
            {blocked.length === 0 ? (
              <Text style={styles.emptyHint}>
                Blocking someone stops them from following you and removes any existing follow connection.
              </Text>
            ) : (
              blocked.map((b) => (
                <View key={b.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName}>{b.blocked_name ?? 'Someone'}</Text>
                    {b.blocked_magic_id && (
                      <Text style={styles.rowMeta}>{b.blocked_magic_id}</Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleUnblock(b)}
                    style={[styles.smallButton, styles.ghostButton]}>
                    <Text style={styles.ghostText}>Unblock</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <ReportSheet
        visible={reportTargetId !== null}
        target={reportTargetId ? { kind: 'follow_request', id: reportTargetId } : null}
        onClose={() => setReportTargetId(null)}
        onSubmitted={() => {
          if (!reportTargetId) return;
          const id = reportTargetId;
          // Mark for the optimistic hide so the row disappears even
          // before the next refresh, then auto-deny on the server so
          // the requester also stops seeing it as pending.
          markFollowRequestReported(id);
          setPending((prev) => prev.filter((p) => p.id !== id));
          api.respondToFollow(id, 'deny').catch(() => {
            // Non-fatal — if the deny fails, the report is still
            // logged server-side and the row is hidden locally.
          });
        }}
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
  dangerButton: {
    backgroundColor: COLORS.red + '15',
    borderWidth: 1,
    borderColor: COLORS.red + '40',
  },
  dangerText: {
    color: COLORS.red,
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
