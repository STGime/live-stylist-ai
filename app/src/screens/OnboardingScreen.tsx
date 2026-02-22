import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import FloatingBubbles from '../components/FloatingBubbles';
import ColorSwatchPicker from '../components/ColorSwatchPicker';
import * as api from '../services/api';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [stylistName, setStylistName] = useState('');
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [language, setLanguage] = useState<'en' | 'de'>('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

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

    setError('');
    setLoading(true);

    try {
      await api.register(name.trim(), selectedColor, stylistName.trim() || undefined, language);
      navigation.replace('Home');
    } catch (err: any) {
      if (err.status === 409) {
        // Already registered, just go home
        navigation.replace('Home');
        return;
      }
      Alert.alert('Oops', err.message || 'Something went wrong. Try again!');
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
              style={[
                styles.input,
                error && !name ? styles.inputError : null,
              ]}
            />

            <Text style={[styles.label, { marginTop: 22 }]}>Name your stylist</Text>
            <TextInput
              value={stylistName}
              onChangeText={handleStylistNameChange}
              placeholder="e.g. Luna, Aria, Chloe"
              placeholderTextColor={COLORS.textMuted}
              maxLength={50}
              style={styles.input}
            />

            <Text style={[styles.label, { marginTop: 22 }]}>Agent Language</Text>
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
            <BubbleButton onPress={handleSubmit} disabled={loading}>
              {loading ? 'Setting up...' : "Let's Go!"}
            </BubbleButton>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
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
    shadowColor: COLORS.grayLight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
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
});
