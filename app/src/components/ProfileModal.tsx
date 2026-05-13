import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import BubbleButton from './BubbleButton';
import ColorSwatchPicker from './ColorSwatchPicker';
import * as api from '../services/api';
import {
  registerForPushNotifications,
  unregisterPushNotifications,
  getPushPermissionStatus,
} from '../services/push';
import { useDialog } from './AppDialog';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  onReset: () => void;
  currentName: string;
  currentStylistName: string;
  currentColor: string;
  currentLanguage: string;
}

export default function ProfileModal({
  visible,
  onClose,
  onSaved,
  onReset,
  currentName,
  currentStylistName,
  currentColor,
  currentLanguage,
}: Props) {
  const [name, setName] = useState(currentName);
  const [stylistName, setStylistName] = useState(currentStylistName);
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [language, setLanguage] = useState(currentLanguage || 'en');
  const [saving, setSaving] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  /**
   * Tri-state to keep the toggle from flickering on open:
   *  - null   → still loading the current state, render disabled placeholder
   *  - true   → backend has a push token for this device
   *  - false  → no token (user never opted in, or opted out)
   */
  const [notifsOn, setNotifsOn] = useState<boolean | null>(null);
  const [notifsBusy, setNotifsBusy] = useState(false);
  const dialog = useDialog();

  // Reset fields when modal opens with new props
  React.useEffect(() => {
    if (visible) {
      setName(currentName);
      setStylistName(currentStylistName);
      setSelectedColor(currentColor);
      setLanguage(currentLanguage || 'en');
      api.getDeviceId().then(setDeviceId).catch(() => setDeviceId(''));
      // Pull the current notification state from /profile rather than guessing
      // from local storage — the backend is the source of truth.
      setNotifsOn(null);
      api.getProfile()
        .then((p) => setNotifsOn(!!p.notifications_enabled))
        .catch(() => setNotifsOn(false));
    }
  }, [visible, currentName, currentStylistName, currentColor, currentLanguage]);

  const handleToggleNotifs = async () => {
    if (notifsBusy || notifsOn === null) return;
    setNotifsBusy(true);
    try {
      if (notifsOn) {
        // Turn off — clear the backend token. OS-level permission stays
        // granted so flipping back on is one tap.
        await unregisterPushNotifications();
        setNotifsOn(false);
      } else {
        // Turn on — re-register. If the OS already denied us, redirect
        // the user to Settings instead of silently failing.
        const status = await getPushPermissionStatus();
        if (status === 'denied') {
          await dialog.alert({
            title: 'Notifications are blocked',
            message:
              Platform.OS === 'ios'
                ? 'Open iOS Settings → LiveStylist → Notifications and turn them on, then come back here.'
                : 'Open Settings → Apps → LiveStylist → Notifications and turn them on, then come back here.',
          });
          setNotifsOn(false);
          return;
        }
        if (status === 'unavailable') {
          await dialog.alert({
            title: 'Not available',
            message: 'Notifications aren’t supported on this build.',
          });
          setNotifsOn(false);
          return;
        }
        await registerForPushNotifications({ force: true });
        // Re-check the backend — if the OS prompt was just denied, or
        // the platform couldn't issue a token (Android without FCM
        // credentials in this build), no row got saved.
        const p = await api.getProfile().catch(() => null);
        const enabled = !!p?.notifications_enabled;
        setNotifsOn(enabled);
        if (!enabled) {
          // Could be: (a) user just tapped "Don't Allow" on the OS
          // prompt — no further action needed, or (b) FCM/APNs isn't
          // wired into this build. Re-check OS state to tell them apart
          // so the message is actionable.
          const after = await getPushPermissionStatus();
          if (after === 'granted') {
            await dialog.alert({
              title: "Couldn't enable notifications",
              message: Platform.OS === 'android'
                ? 'Push delivery isn’t configured for this build (Android needs FCM credentials). The app will work without notifications; ask the team to finish push setup if you need them.'
                : 'We couldn’t register this device for push. Try again later — the rest of the app still works.',
            });
          }
        }
      }
    } catch (err: any) {
      await dialog.alert({
        title: 'Could not change setting',
        message: err?.message ?? 'Please try again.',
      });
    } finally {
      setNotifsBusy(false);
    }
  };

  const handleNameChange = (text: string) => {
    setName(text.replace(/[^a-zA-Z\s'-]/g, ''));
  };

  const handleStylistNameChange = (text: string) => {
    setStylistName(text.replace(/[^a-zA-Z\s'-]/g, ''));
  };

  const handleDelete = async () => {
    // iOS can't reliably present a Modal on top of another Modal — the root
    // view controller is already busy presenting ProfileModal, and trying to
    // present the confirm Modal silently fails. Close ProfileModal first,
    // wait for the slide-down animation to finish, then show the dialog at
    // the root.
    onClose();
    await new Promise<void>((r) => setTimeout(r, 350));
    const confirmed = await dialog.confirm({
      title: 'Delete Account?',
      message:
        'This permanently deletes your profile, session history, and saved preferences from our servers and from this device. This action cannot be undone.',
      cancelLabel: 'Cancel',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await api.deleteAccount();
      onReset();
    } catch (e: any) {
      await dialog.alert({
        title: 'Could not delete',
        message: e?.message || 'Something went wrong. Please try again.',
      });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      await dialog.alert({ title: 'Oops', message: "What's your name?" });
      return;
    }

    setSaving(true);
    try {
      await api.updateProfile({
        name: name.trim(),
        favorite_color: selectedColor,
        stylist_name: stylistName.trim() || undefined,
        language,
      });
      onSaved();
    } catch (err: any) {
      await dialog.alert({
        title: 'Could not save',
        message: err.message || 'Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6L18 18"
                  stroke={COLORS.textMid}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </Svg>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={styles.label}>Your Name</Text>
            <TextInput
              value={name}
              onChangeText={handleNameChange}
              placeholder="e.g. Sophia"
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
              style={styles.input}
            />

            {/* Stylist Name */}
            <Text style={[styles.label, { marginTop: 20 }]}>Stylist Name</Text>
            <TextInput
              value={stylistName}
              onChangeText={handleStylistNameChange}
              placeholder="e.g. Luna, Aria, Chloe"
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
              style={styles.input}
            />

            {/* Language */}
            <Text style={[styles.label, { marginTop: 20 }]}>Agent Language</Text>
            <View style={styles.languageRow}>
              {(['en', 'de'] as const).map((code) => (
                <TouchableOpacity
                  key={code}
                  onPress={() => setLanguage(code)}
                  style={[
                    styles.languageButton,
                    language === code && styles.languageButtonActive,
                  ]}>
                  <Text
                    style={[
                      styles.languageText,
                      language === code && styles.languageTextActive,
                    ]}>
                    {code === 'en' ? 'English' : 'Deutsch'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Favorite Color */}
            <Text style={[styles.label, { marginTop: 20 }]}>Fave Color</Text>
            <ColorSwatchPicker
              selected={selectedColor}
              onSelect={setSelectedColor}
              size={40}
            />

            {/* Notifications toggle — explicit on/off, independent of OS
                permission. Off here = backend stops sending, even if iOS
                still has notifications allowed. */}
            <Text style={[styles.label, { marginTop: 20 }]}>Notifications</Text>
            <TouchableOpacity
              onPress={handleToggleNotifs}
              activeOpacity={0.7}
              disabled={notifsBusy || notifsOn === null}
              style={[
                styles.notifRow,
                notifsOn === true && styles.notifRowOn,
              ]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.notifTitle}>
                  {notifsOn === null
                    ? 'Loading…'
                    : notifsOn
                    ? 'On'
                    : 'Off'}
                </Text>
                <Text style={styles.notifHint}>
                  Get pinged when friends finish a session or send you a follow request.
                </Text>
              </View>
              <View
                style={[
                  styles.notifPill,
                  notifsOn === true && styles.notifPillOn,
                ]}>
                {notifsBusy ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <View
                    style={[
                      styles.notifKnob,
                      notifsOn === true && styles.notifKnobOn,
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          </ScrollView>

          {/* Save */}
          <View style={styles.buttonArea}>
            <BubbleButton onPress={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </BubbleButton>
          </View>

          {/* Device ID — long-press to copy. Used by the team to grant
              tester / beta access without you having to pay. Read-only. */}
          {deviceId ? (
            <View style={styles.deviceIdBlock}>
              <Text style={styles.deviceIdLabel}>Device ID (long-press to copy)</Text>
              <Text selectable style={styles.deviceIdValue}>
                {deviceId}
              </Text>
            </View>
          ) : null}

          {/* Reset */}
          <TouchableOpacity onPress={handleDelete} style={styles.resetButton}>
            <Text style={styles.resetText}>Delete Account</Text>
          </TouchableOpacity>

          {saving && (
            <ActivityIndicator
              size="small"
              color={COLORS.pink}
              style={styles.spinner}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 36,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 50,
    backgroundColor: COLORS.pinkPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMid,
    marginBottom: 8,
  },
  input: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.pinkLight,
    backgroundColor: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textDark,
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  languageButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: COLORS.pinkLight,
    backgroundColor: COLORS.white,
    alignItems: 'center',
  },
  languageButtonActive: {
    borderColor: COLORS.pink,
    backgroundColor: COLORS.pinkPale,
  },
  languageText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMid,
  },
  languageTextActive: {
    color: COLORS.pink,
  },
  buttonArea: {
    marginTop: 24,
  },
  resetButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FF4444' + '30',
    backgroundColor: '#FF4444' + '08',
  },
  deviceIdBlock: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.pinkPale,
  },
  deviceIdLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMid,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  deviceIdValue: {
    fontSize: 12,
    color: COLORS.textDark,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  resetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF4444',
  },
  spinner: {
    position: 'absolute',
    top: 28,
    right: 70,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: COLORS.pinkLight,
    backgroundColor: COLORS.white,
  },
  notifRowOn: {
    borderColor: COLORS.pink,
    backgroundColor: COLORS.pinkPale,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 2,
  },
  notifHint: {
    fontSize: 12,
    color: COLORS.textMid,
    lineHeight: 16,
  },
  notifPill: {
    width: 52,
    height: 30,
    borderRadius: 50,
    backgroundColor: COLORS.grayLight,
    padding: 3,
    justifyContent: 'center',
    marginLeft: 12,
  },
  notifPillOn: {
    backgroundColor: COLORS.pink,
  },
  notifKnob: {
    width: 24,
    height: 24,
    borderRadius: 50,
    backgroundColor: COLORS.white,
    alignSelf: 'flex-start',
  },
  notifKnobOn: {
    alignSelf: 'flex-end',
  },
});
