// User-facing Report flow for App Review §1.2 UGC compliance (#14b).
// Bottom-sheet modal: pick one of five fixed categories, optionally add
// a 280-char note, submit. Posts to POST /reports which writes a row
// for an operator to review.
//
// Backend is rate-limited at 20/hr/device and idempotent on the
// (reporter, target_kind, target_id) tuple, so a second submission of
// the same target is silently absorbed — we surface "Reported" either way.
import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { COLORS } from '../theme/colors';
import { submitReport, type ReportCategory, type ReportTargetKind } from '../services/api';

interface Props {
  visible: boolean;
  target: { kind: ReportTargetKind; id: string } | null;
  onClose: () => void;
  /** Fires after a successful submission. Parent uses this to apply
   *  the optimistic hide on its local list state. */
  onSubmitted: () => void;
}

const CATEGORIES: Array<{ key: ReportCategory; label: string }> = [
  { key: 'sexual', label: 'Sexual content' },
  { key: 'violent', label: 'Violent content' },
  { key: 'harassing', label: 'Harassing or abusive' },
  { key: 'spam', label: 'Spam' },
  { key: 'other', label: 'Other' },
];

const MAX_FREE_TEXT = 280;

export default function ReportSheet({ visible, target, onClose, onSubmitted }: Props) {
  const [selected, setSelected] = useState<ReportCategory | null>(null);
  const [freeText, setFreeText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state every time the sheet opens — avoids "tap report on
  // session A → cancel → tap report on session B" carrying state.
  React.useEffect(() => {
    if (visible) {
      setSelected(null);
      setFreeText('');
      setSubmitting(false);
      setError(null);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!target || !selected || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReport(target.kind, target.id, selected, freeText.trim() || undefined);
      onSubmitted();
      onClose();
    } catch (e: any) {
      const isRateLimit = e?.status === 429;
      setError(
        isRateLimit
          ? 'Too many reports right now. Try again in a bit.'
          : e?.message ?? 'Could not submit. Please try again.',
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}>
        <TouchableOpacity style={styles.dismissArea} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Report content</Text>
          <Text style={styles.sub}>
            Reports go to a human reviewer. We act on them as quickly as we can.
          </Text>

          <View style={styles.categories}>
            {CATEGORIES.map((c) => {
              const active = selected === c.key;
              return (
                <TouchableOpacity
                  key={c.key}
                  onPress={() => setSelected(c.key)}
                  activeOpacity={0.85}
                  style={[styles.categoryButton, active && styles.categoryButtonActive]}>
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TextInput
            style={styles.input}
            placeholder="Add details (optional)"
            placeholderTextColor={COLORS.textMuted}
            value={freeText}
            onChangeText={(t) => setFreeText(t.slice(0, MAX_FREE_TEXT))}
            multiline
            maxLength={MAX_FREE_TEXT}
            editable={!submitting}
          />
          <Text style={styles.counter}>{freeText.length} / {MAX_FREE_TEXT}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.row}>
            <TouchableOpacity
              onPress={onClose}
              disabled={submitting}
              style={[styles.actionButton, styles.cancelButton]}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!selected || submitting}
              style={[
                styles.actionButton,
                styles.submitButton,
                (!selected || submitting) && styles.submitDisabled,
              ]}>
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.submitText}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textDark,
  },
  sub: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textMid,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 18,
  },
  categories: {
    gap: 8,
    marginBottom: 12,
  },
  categoryButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
    backgroundColor: COLORS.pinkPale,
  },
  categoryButtonActive: {
    borderColor: COLORS.pink,
    backgroundColor: COLORS.pinkSoft,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMid,
  },
  categoryTextActive: {
    color: COLORS.pink,
    fontWeight: '700',
  },
  input: {
    minHeight: 64,
    maxHeight: 120,
    borderWidth: 2,
    borderColor: COLORS.pinkLight + '40',
    borderRadius: 12,
    padding: 10,
    fontSize: 14,
    color: COLORS.textDark,
    backgroundColor: COLORS.white,
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 11,
    color: COLORS.textMuted,
    alignSelf: 'flex-end',
    marginTop: 4,
    marginBottom: 10,
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D33',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
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
  submitButton: {
    backgroundColor: COLORS.pink,
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
});
