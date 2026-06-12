import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Camera } from 'react-native-vision-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import FloatingBubbles from '../components/FloatingBubbles';
import ColorSwatchPicker from '../components/ColorSwatchPicker';
import * as api from '../services/api';
import type { RootStackParamList } from '../types';
import { useDialog } from '../components/AppDialog';
import { detectDefaultLanguage } from '../utils/locale';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [stylistName, setStylistName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [confirmAge, setConfirmAge] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const stylistInputRef = useRef<TextInput>(null);
  const dialog = useDialog();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("What's your name?");
      return;
    }
    if (!selectedColor) {
      setError('Pick a fave color!');
      return;
    }
    if (!confirmAge) {
      setError('Please confirm you are 13 years or older.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Request camera + microphone permissions upfront
      await Camera.requestCameraPermission();
      await Camera.requestMicrophonePermission();

      // Default the agent language from the device locale (German → Deutsch,
      // otherwise English); can be changed later in Settings (profile).
      const result = await api.register(name.trim(), selectedColor, stylistName.trim() || undefined, detectDefaultLanguage());
      // Recovery: the backend recognised our stable_device_id from a
      // prior install on this device and returned the original profile.
      // The name/color the user just typed are *not* persisted — the
      // saved profile wins. Say so explicitly so they don't land on Home
      // wondering why it's a different name.
      if (result.recovered) {
        await dialog.alert({
          title: `Welcome back, ${result.name}!`,
          message: "We recognised this device and restored your previous profile. Tap your name in the top right to edit anything you'd like to change.",
        });
      }
      navigation.replace('Home');
    } catch (err: any) {
      if (err.status === 409) {
        // Already registered, just go home
        navigation.replace('Home');
        return;
      }
      await dialog.alert({ title: 'Oops', message: err.message || 'Something went wrong. Try again!' });
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (text: string) => {
    setName(text.replace(/[^a-zA-Z\s'-]/g, ''));
    setError('');
  };

  const handleStylistNameChange = (text: string) => {
    setStylistName(text.replace(/[^a-zA-Z\s'-]/g, ''));
  };

  return (
    <LinearGradient
      colors={[COLORS.cream, COLORS.pinkPale, COLORS.lavenderSoft, COLORS.pinkSoft]}
      locations={[0, 0.35, 0.7, 1]}
      style={styles.container}>
      <FloatingBubbles count={20} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          bounces={false}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}>
          {/* Logo */}
          <View style={styles.logoSection}>
            <LinearGradient
              colors={[COLORS.pink, COLORS.magenta]}
              style={styles.logoBox}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
                  fill="white"
                />
              </Svg>
            </LinearGradient>
            <Text style={styles.title}>LiveStylist</Text>
            <Text style={styles.subtitle}>Your AI Style Bestie</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>What's your name?</Text>
            <TextInput
              value={name}
              onChangeText={handleNameChange}
              placeholder="e.g. Sophia"
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
              returnKeyType="next"
              onSubmitEditing={() => stylistInputRef.current?.focus()}
              blurOnSubmit={false}
              style={[
                styles.input,
                error && !name ? styles.inputError : null,
              ]}
            />

            <Text style={[styles.label, { marginTop: 22 }]}>Name your stylist</Text>
            <TextInput
              ref={stylistInputRef}
              value={stylistName}
              onChangeText={handleStylistNameChange}
              placeholder="e.g. Luna, Aria, Chloe"
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 22 }]}>Fave color?</Text>
            <ColorSwatchPicker
              selected={selectedColor}
              onSelect={(c) => {
                setSelectedColor(c);
                setError('');
              }}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>

          <View style={styles.buttonArea}>
            <TouchableOpacity
              style={styles.ageRow}
              onPress={() => {
                setConfirmAge((v) => !v);
                setError('');
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: confirmAge }}
              accessibilityLabel="I confirm I am 13 years or older">
              <View style={[styles.checkbox, confirmAge && styles.checkboxChecked]}>
                {confirmAge ? <Text style={styles.checkboxMark}>✓</Text> : null}
              </View>
              <Text style={styles.ageText}>I confirm I'm 13+</Text>
            </TouchableOpacity>

            <BubbleButton onPress={handleSubmit} disabled={loading}>
              {loading ? 'Setting up...' : "Let's Go!"}
            </BubbleButton>

            <Text style={styles.legalText}>
              By continuing you agree to our{' '}
              <Text
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://livestylist.app/terms.html').catch(() => {})}>
                Terms
              </Text>
              {' and '}
              <Text
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://livestylist.app/community-guidelines.html').catch(() => {})}>
                Community Guidelines
              </Text>
              .
            </Text>
          </View>
        </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 40,
    paddingBottom: 32,
  },
  logoSection: { alignItems: 'center', marginBottom: 8 },
  logoBox: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: COLORS.berry,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: COLORS.textDark,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textMid,
    marginTop: 4,
  },
  form: { marginTop: 32 },
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
  inputError: {
    borderColor: COLORS.red + '60',
  },
  error: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.red,
    marginTop: 14,
    textAlign: 'center',
  },
  buttonArea: { marginTop: 32 },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.pinkLight,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: COLORS.pink,
    borderColor: COLORS.pink,
  },
  checkboxMark: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  ageText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMid,
  },
  legalText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 18,
    lineHeight: 18,
  },
  legalLink: {
    color: COLORS.pink,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
