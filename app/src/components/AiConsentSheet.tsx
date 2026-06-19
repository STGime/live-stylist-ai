// AI data-sharing consent gate (App Review §5.1.1(i)/5.1.2(i), #55).
// Shown the first time the user taps Start Session; persists agreement
// in AsyncStorage under AI_CONSENT_KEY. Bump the key suffix if the
// disclosure materially changes so existing users see it again.
import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';

export const AI_CONSENT_KEY = '@livestylist_ai_data_consent_v1';

interface Props {
  visible: boolean;
  onCancel: () => void;
  onAgree: () => void;
}

export default function AiConsentSheet({ visible, onCancel, onAgree }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onCancel} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Before we start</Text>
          <Text style={styles.sub}>
            A live session uses third-party AI to give you style advice. We need your
            permission before sharing your camera and voice with them.
          </Text>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionLabel}>What we send</Text>
            <Text style={styles.body}>
              • Live cropped camera frames from your front camera (your face: eye, mouth,
              and upper-body regions){'\n'}
              • Your microphone audio while the session is active{'\n'}
              • Optional: a source image when you ask for a style preview
            </Text>

            <Text style={styles.sectionLabel}>Who receives it</Text>
            <Text style={styles.body}>
              • <Text style={styles.bold}>Google (Gemini API)</Text> — real-time voice
              conversation + computer-vision analysis of your camera frames.{'\n'}
              • <Text style={styles.bold}>Fal.ai</Text> — generates the style-preview
              images.
            </Text>

            <Text style={styles.sectionLabel}>How it's handled</Text>
            <Text style={styles.body}>
              Frames and audio are streamed in real time, processed in memory, and not
              stored on our servers. They are not used for advertising, identification,
              or AI model training. Full detail in our{' '}
              <Text
                style={styles.link}
                onPress={() => Linking.openURL('https://livestylist.app/privacy.html').catch(() => {})}>
                Privacy Policy
              </Text>
              .
            </Text>
          </ScrollView>

          <View style={styles.row}>
            <TouchableOpacity
              onPress={onCancel}
              style={[styles.actionButton, styles.cancelButton]}
              accessibilityRole="button"
              accessibilityLabel="Cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAgree}
              style={[styles.actionButton, styles.agreeButton]}
              accessibilityRole="button"
              accessibilityLabel="I agree and continue">
              <Text style={styles.agreeText}>I agree & continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    maxHeight: '85%',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  sub: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMid,
    marginTop: 6,
    marginBottom: 12,
    lineHeight: 18,
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.pink,
    marginTop: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textDark,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '800',
  },
  link: {
    color: COLORS.pink,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
    backgroundColor: COLORS.white,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMid,
  },
  agreeButton: {
    backgroundColor: COLORS.pink,
  },
  agreeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
});
