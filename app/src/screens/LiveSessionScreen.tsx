import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import Svg, { Path, Line } from 'react-native-svg';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '../theme/colors';
import BubbleButton from '../components/BubbleButton';
import MangaAvatar from '../components/MangaAvatar';
import AiOrb from '../components/AiOrb';
import { SessionControlSocket } from '../services/websocket';
import * as api from '../services/api';
import { useGeminiSession } from '../hooks/useGeminiSession';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveSession'>;

export default function LiveSessionScreen({ route, navigation }: Props) {
  const {
    sessionId,
    expiryTime,
    ephemeralToken,
    systemPrompt,
    geminiWsUrl,
    geminiModel,
  } = route.params;

  const [timeLeft, setTimeLeft] = useState(() => {
    return Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
  });
  const [muted, setMuted] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [mounted, setMounted] = useState(false);

  const controlSocket = useRef<SessionControlSocket | null>(null);
  const sessionStartTime = useRef(Date.now());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Camera
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');

  // Gemini Live session
  const { aiState, cameraRef, isConnected, error, injectText } =
    useGeminiSession({
      ephemeralToken,
      systemPrompt,
      geminiWsUrl,
      geminiModel,
      muted,
    });

  // Request camera permission on mount
  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
  }, [hasPermission, requestPermission]);

  // Connect to backend control WebSocket
  useEffect(() => {
    const socket = new SessionControlSocket((event) => {
      switch (event.type) {
        case 'session_started':
          break;
        case 'session_ending_soon':
          // Forward the backend's inject text into the Gemini conversation
          if (event.gemini_inject) {
            injectText(event.gemini_inject);
          }
          break;
        case 'session_expired':
          handleEndSession('time');
          break;
        case 'session_ended':
          break;
      }
    });

    socket
      .connect(sessionId)
      .then(() => {
        controlSocket.current = socket;
      })
      .catch(() => {
        // Fallback: rely on local timer
      });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Mount animation
  useEffect(() => {
    setTimeout(() => setMounted(true), 300);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      delay: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          handleEndSession('time');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log Gemini errors but don't auto-end (let the session continue with timer)
  useEffect(() => {
    if (error) {
      console.warn('[LiveSession] Gemini error:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  // Auto-end when Gemini socket closes after being connected (e.g. 2-min video limit)
  const wasConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected) {
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current) {
      // Was connected, now disconnected — Gemini session ended
      const timeout = setTimeout(() => {
        handleEndSession('time');
      }, 2000);
      return () => clearTimeout(timeout);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const handleEndSession = useCallback(
    async (reason: 'manual' | 'time' | 'error') => {
      const elapsed = Math.floor(
        (Date.now() - sessionStartTime.current) / 1000,
      );

      try {
        if (controlSocket.current) {
          controlSocket.current.sendEndSession(sessionId);
        } else {
          await api.endSession(sessionId);
        }
      } catch {
        // Best-effort
      }

      navigation.replace('SessionSummary', {
        duration: Math.min(elapsed, 300),
        reason,
        sessionsLeft: 0,
      });
    },
    [navigation, sessionId],
  );

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const timerColor =
    timeLeft <= 30
      ? COLORS.red
      : timeLeft <= 60
        ? COLORS.gold
        : 'rgba(255,255,255,0.85)';
  const isSpeaking = aiState === 'speaking';

  const showCamera = hasPermission && device != null;

  return (
    <View style={styles.container}>
      {/* Camera feed or dark fallback */}
      {showCamera ? (
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={true}
          photo={true}
        />
      ) : (
        <Animated.View
          style={[styles.cameraBackground, { opacity: fadeAnim }]}
        />
      )}

      {/* Face guide */}
      {mounted && <View style={styles.faceGuide} />}

      {/* Camera placeholder when no permission */}
      {!showCamera && (
        <View style={styles.cameraPlaceholder}>
          <Svg width={36} height={36} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 10L19.553 7.724C20.278 7.362 21 7.868 21 8.618V15.382C21 16.132 20.278 16.638 19.553 16.276L15 14M5 18H13C14.105 18 15 17.105 15 16V8C15 6.895 14.105 6 13 6H5C3.895 6 3 6.895 3 8V16C3 17.105 3.895 18 5 18Z"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.cameraText}>Camera permission required</Text>
        </View>
      )}

      {/* Top Bar */}
      {mounted && (
        <View style={styles.topBar}>
          <View style={styles.timerPill}>
            <View
              style={[styles.recDot, timeLeft <= 30 && styles.recDotUrgent]}
            />
            <Text style={[styles.timerText, { color: timerColor }]}>
              {mins}:{secs.toString().padStart(2, '0')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowEndConfirm(true)}
            style={styles.endButton}>
            <Text style={styles.endButtonText}>End</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Avatar area */}
      {mounted && (
        <View style={styles.avatarArea}>
          <MangaAvatar speaking={isSpeaking} size={110} />
          <View style={styles.avatarLabel}>
            <Text style={styles.avatarLabelText}>Stylist AI</Text>
          </View>
        </View>
      )}

      {/* Bottom UI */}
      {mounted && (
        <View style={styles.bottomBar}>
          <AiOrb state={aiState} />
          <TouchableOpacity
            onPress={() => setMuted(!muted)}
            style={[styles.muteButton, muted && styles.muteButtonActive]}>
            {muted ? (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M11 5L6 9H2V15H6L11 19V5Z"
                  stroke={COLORS.red}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Line
                  x1={23}
                  y1={9}
                  x2={17}
                  y2={15}
                  stroke={COLORS.red}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Line
                  x1={17}
                  y1={9}
                  x2={23}
                  y2={15}
                  stroke={COLORS.red}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            ) : (
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 1C10.343 1 9 2.343 9 4V12C9 13.657 10.343 15 12 15C13.657 15 15 13.657 15 12V4C15 2.343 13.657 1 12 1Z"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                />
                <Path
                  d="M19 10V12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12V10"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                <Line
                  x1={12}
                  y1={19}
                  x2={12}
                  y2={23}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </Svg>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* End Confirmation Modal */}
      <Modal visible={showEndConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>End session?</Text>
            <Text style={styles.modalSubtitle}>
              You still have {mins}:{secs.toString().padStart(2, '0')} left
            </Text>
            <View style={styles.modalButtons}>
              <View style={styles.modalButtonHalf}>
                <BubbleButton
                  variant="ghost"
                  onPress={() => setShowEndConfirm(false)}>
                  Nope!
                </BubbleButton>
              </View>
              <View style={styles.modalButtonHalf}>
                <BubbleButton onPress={() => handleEndSession('manual')}>
                  End it
                </BubbleButton>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.charcoal,
  },
  cameraBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1218',
  },
  faceGuide: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    width: 180,
    height: 230,
    borderRadius: 115,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    borderStyle: 'dashed',
  },
  cameraPlaceholder: {
    position: 'absolute',
    top: '22%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    opacity: 0.2,
  },
  cameraText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  topBar: {
    position: 'absolute',
    top: 50,
    left: 18,
    right: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 5,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.red,
  },
  recDotUrgent: {},
  timerText: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  endButton: {
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.8)',
  },
  avatarArea: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 5,
  },
  avatarLabel: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  avatarLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.pinkLight,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 20,
    paddingHorizontal: 22,
    paddingBottom: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    zIndex: 5,
  },
  muteButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteButtonActive: {
    backgroundColor: COLORS.red + '25',
    borderColor: COLORS.red + '50',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 28,
    width: '82%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: COLORS.grayMid,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMid,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalButtonHalf: {
    flex: 1,
  },
});
