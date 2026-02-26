import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  PermissionsAndroid,
  ToastAndroid,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import RNFS from 'react-native-fs';
import { COLORS } from '../theme/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;

interface PreviewSheetProps {
  image: string | null;
  mimeType: string;
  loading: boolean;
  onDismiss: () => void;
}

export default function PreviewSheet({
  image,
  mimeType,
  loading,
  onDismiss,
}: PreviewSheetProps) {
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const [saving, setSaving] = useState(false);

  const visible = loading || !!image;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, fadeAnim]);

  useEffect(() => {
    if (loading) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [loading, shimmerAnim]);

  const handleSave = async () => {
    if (!image || saving) return;
    setSaving(true);

    try {
      // Request storage permission on Android
      if (Platform.OS === 'android') {
        const sdkInt = Platform.Version;
        if (typeof sdkInt === 'number' && sdkInt < 29) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            console.warn('[PreviewSheet] Storage permission denied');
            setSaving(false);
            return;
          }
        }
      }

      const ext = mimeType.includes('png') ? 'png' : 'jpg';
      const fileName = `LiveStylist_${Date.now()}.${ext}`;

      if (Platform.OS === 'android') {
        // Write to Pictures directory (scoped storage handles this on API 29+)
        const picturesDir = `${RNFS.PicturesDirectoryPath}/LiveStylist`;
        const dirExists = await RNFS.exists(picturesDir);
        if (!dirExists) {
          await RNFS.mkdir(picturesDir);
        }
        const filePath = `${picturesDir}/${fileName}`;
        await RNFS.writeFile(filePath, image, 'base64');
        // Notify media scanner so it appears in gallery
        await RNFS.scanFile(filePath);
        ToastAndroid.show('Saved to gallery', ToastAndroid.SHORT);
      } else {
        // iOS: write to documents then save to camera roll
        const filePath = `${RNFS.DocumentDirectoryPath}/${fileName}`;
        await RNFS.writeFile(filePath, image, 'base64');
        // CameraRoll would be needed for iOS — for now save to files
      }
    } catch (e: any) {
      console.warn('[PreviewSheet] Save error:', e?.message || e);
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: fadeAnim }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onDismiss}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {loading ? (
          <Animated.View
            style={[
              styles.skeleton,
              { opacity: shimmerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.6],
              }) },
            ]}
          >
            <Text style={styles.loadingText}>Generating preview...</Text>
          </Animated.View>
        ) : image ? (
          <View style={styles.content}>
            <Image
              source={{ uri: `data:${mimeType};base64,${image}` }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 15V19C21 20.1 20.1 21 19 21H5C3.9 21 3 20.1 3 19V15"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M7 10L12 15L17 10"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <Path
                    d="M12 15V3"
                    stroke="#fff"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={onDismiss}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: COLORS.charcoal,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 12,
    zIndex: 11,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignSelf: 'center',
    marginBottom: 12,
  },
  skeleton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    flex: 1,
    borderRadius: 16,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 56,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.pink,
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  closeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '700',
  },
});
