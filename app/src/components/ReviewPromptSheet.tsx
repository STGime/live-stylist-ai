// Soft pre-prompt before the OS-native review modal. We show our own
// "Enjoying LiveStylist?" sheet first, and only call StoreReview when the
// user taps Sure — same pattern most apps use. The OS still owns whether
// the native prompt actually appears (Apple/Google rate-limit silently).
//
// State (counter + satisfied flag) lives in services/review-prompt.ts;
// this component is pure presentation.
import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { COLORS } from '../theme/colors';

interface Props {
  visible: boolean;
  /** Tapped "Sure" — parent marks satisfied + triggers the OS prompt. */
  onYes: () => void;
  /** Tapped "Not now" or backdrop/back — parent just closes. */
  onNo: () => void;
}

export default function ReviewPromptSheet({ visible, onYes, onNo }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onNo}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onNo}>
        {/* Inner swallow so taps on the card don't dismiss. */}
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={styles.cardWrap}>
          <View style={styles.card}>
            <Text style={styles.emoji}>💖</Text>
            <Text style={styles.title} accessibilityRole="header">
              Enjoying LiveStylist?
            </Text>
            <Text style={styles.sub}>
              A quick review helps other people find us. It only takes a
              moment.
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={onNo}
                style={[styles.button, styles.secondary]}
                activeOpacity={0.8}>
                <Text style={styles.secondaryText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onYes}
                style={[styles.button, styles.primary]}
                activeOpacity={0.85}>
                <Text style={styles.primaryText}>Sure!</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 380,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
    alignItems: 'center',
    shadowColor: COLORS.pink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  emoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  sub: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMid,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: COLORS.pink,
  },
  primaryText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  secondary: {
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '60',
    backgroundColor: COLORS.white,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textMid,
  },
});
