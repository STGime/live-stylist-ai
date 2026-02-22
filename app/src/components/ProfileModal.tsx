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
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import BubbleButton from './BubbleButton';
import ColorSwatchPicker from './ColorSwatchPicker';
import * as api from '../services/api';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentName: string;
  currentStylistName: string;
  currentColor: string;
  currentLanguage: string;
}

export default function ProfileModal({
  visible,
  onClose,
  onSaved,
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

  // Reset fields when modal opens with new props
  React.useEffect(() => {
    if (visible) {
      setName(currentName);
      setStylistName(currentStylistName);
      setSelectedColor(currentColor);
      setLanguage(currentLanguage || 'en');
    }
  }, [visible, currentName, currentStylistName, currentColor, currentLanguage]);

  const handleNameChange = (text: string) => {
    setName(text.replace(/[^a-zA-Z\s'-]/g, ''));
  };

  const handleStylistNameChange = (text: string) => {
    setStylistName(text.replace(/[^a-zA-Z\s'-]/g, ''));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Oops', "What's your name?");
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
      Alert.alert('Error', err.message || 'Could not save changes');
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
          </ScrollView>

          {/* Save */}
          <View style={styles.buttonArea}>
            <BubbleButton onPress={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </BubbleButton>
          </View>

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
  spinner: {
    position: 'absolute',
    top: 28,
    right: 70,
  },
});
