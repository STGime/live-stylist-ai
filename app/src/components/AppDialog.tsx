/**
 * In-app dialog matching the LiveStylist look & feel — replaces native
 * `Alert.alert` so dialogs feel like part of the app instead of an OS popup.
 *
 * Mount the provider once at the root (App.tsx). Anywhere in the tree, call
 * `useDialog()` and await `alert(...)` or `confirm(...)`. The API mirrors
 * `Alert.alert` so it's a near-drop-in replacement.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import BubbleButton from './BubbleButton';
import { COLORS } from '../theme/colors';

interface AlertConfig {
  title: string;
  message?: string;
  okLabel?: string;
}

interface ConfirmConfig {
  title: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Destructive confirm styles use the dark variant for the action button. */
  destructive?: boolean;
}

interface DialogApi {
  alert(config: AlertConfig): Promise<void>;
  confirm(config: ConfirmConfig): Promise<boolean>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used inside <DialogProvider>');
  return ctx;
}

type State =
  | { visible: false }
  | {
      visible: true;
      kind: 'alert';
      title: string;
      message?: string;
      okLabel: string;
      resolve: () => void;
    }
  | {
      visible: true;
      kind: 'confirm';
      title: string;
      message?: string;
      cancelLabel: string;
      confirmLabel: string;
      destructive: boolean;
      resolve: (ok: boolean) => void;
    };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ visible: false });
  const stateRef = useRef(state);
  stateRef.current = state;

  const close = useCallback((value: any) => {
    const cur = stateRef.current;
    if (!cur.visible) return;
    setState({ visible: false });
    // Resolve after the modal starts dismissing so awaiters know.
    (cur as any).resolve(value);
  }, []);

  const api = useRef<DialogApi>({
    alert: (config) =>
      new Promise<void>((resolve) => {
        setState({
          visible: true,
          kind: 'alert',
          title: config.title,
          message: config.message,
          okLabel: config.okLabel ?? 'OK',
          resolve,
        });
      }),
    confirm: (config) =>
      new Promise<boolean>((resolve) => {
        setState({
          visible: true,
          kind: 'confirm',
          title: config.title,
          message: config.message,
          cancelLabel: config.cancelLabel ?? 'Cancel',
          confirmLabel: config.confirmLabel ?? 'OK',
          destructive: config.destructive ?? false,
          resolve,
        });
      }),
  }).current;

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        visible={state.visible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          // Android back button — treat as cancel/dismiss.
          if (state.visible && state.kind === 'confirm') close(false);
          else close(undefined);
        }}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            {state.visible && (
              <>
                <Text style={styles.title}>{state.title}</Text>
                {state.message ? (
                  <Text style={styles.message}>{state.message}</Text>
                ) : null}
                {state.kind === 'alert' ? (
                  <View style={styles.singleButtonRow}>
                    <BubbleButton onPress={() => close(undefined)}>
                      {state.okLabel}
                    </BubbleButton>
                  </View>
                ) : (
                  <View style={styles.buttonRow}>
                    <View style={styles.buttonHalf}>
                      <BubbleButton variant="ghost" onPress={() => close(false)}>
                        {state.cancelLabel}
                      </BubbleButton>
                    </View>
                    <View style={styles.buttonHalf}>
                      <BubbleButton
                        variant={state.destructive ? 'dark' : 'primary'}
                        onPress={() => close(true)}>
                        {state.confirmLabel}
                      </BubbleButton>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: COLORS.grayMid,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMid,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  buttonHalf: {
    flex: 1,
  },
  singleButtonRow: {
    width: '100%',
  },
});
