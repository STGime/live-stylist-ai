/**
 * 3D avatar component using react-native-filament.
 * Loads model imperatively to avoid React 19 StrictMode double-mount
 * issues with the library's useModel/useBuffer hooks.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import RNFS from 'react-native-fs';
import {
  FilamentScene,
  FilamentView,
  Camera,
  DefaultLight,
  useFilamentContext,
} from 'react-native-filament';
import type { FilamentAsset, Entity, RenderableManager, TransformManager } from 'react-native-filament';
import type { AdkAiState } from '../services/adk-client';

const FACE_MESH_NAMES = ['Wolf3D_Head', 'Wolf3D_Teeth', 'EyeLeft', 'EyeRight'];
const GLB_FILENAME = '699ef6cb5f0ce8d116a1ea45.glb';

interface Avatar3DProps {
  aiState: AdkAiState;
  amplitudeRef: React.RefObject<number>;
  size?: number;
}

const DEG = Math.PI / 180;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

interface MorphSetup {
  entity: Entity;
  count: number;
  mouthOpenIdx: number | undefined;
  mouthSmileIdx: number | undefined;
}

/** Copy GLB from Android assets to cache, return file:// URI */
async function ensureGlbFile(): Promise<string> {
  const destPath = `${RNFS.CachesDirectoryPath}/avatar.glb`;
  const exists = await RNFS.exists(destPath);
  if (!exists) {
    if (Platform.OS === 'android') {
      await RNFS.copyFileAssets(`custom/${GLB_FILENAME}`, destPath);
    } else {
      const bundlePath = `${RNFS.MainBundlePath}/assets/src/assets/${GLB_FILENAME}`;
      await RNFS.copyFile(bundlePath, destPath);
    }
  }
  return `file://${destPath}`;
}

/**
 * Inner scene — loads model imperatively via engine.loadAsset() to avoid
 * the useModel/useBuffer hooks that crash under React 19 StrictMode.
 */
function AvatarScene({ aiState, amplitudeRef, glbUri }: Omit<Avatar3DProps, 'size'> & { glbUri: string }) {
  const { engine, scene, transformManager, renderableManager, workletContext } = useFilamentContext();

  const morphSetups = useRef<MorphSetup[]>([]);
  const headEntity = useRef<Entity | null>(null);
  const spineEntity = useRef<Entity | null>(null);
  const modelReady = useRef(false);
  const assetRef = useRef<FilamentAsset | null>(null);

  const smoothMouth = useRef(0);
  const lastNodTime = useRef(0);
  const nodPhase = useRef(0);
  const startTime = useRef(Date.now());

  const rmRef = useRef<RenderableManager>(renderableManager);
  const tmRef = useRef<TransformManager>(transformManager);
  rmRef.current = renderableManager;
  tmRef.current = transformManager;

  const aiStateRef = useRef<AdkAiState>(aiState);
  aiStateRef.current = aiState;

  // Load model imperatively — one-shot, no double-mount issues
  useEffect(() => {
    let cancelled = false;

    // @ts-expect-error - accessing global FilamentProxy for imperative loading
    const proxy = global.FilamentProxy;
    if (!proxy) {
      console.warn('[Avatar3D] FilamentProxy not available');
      return;
    }

    proxy.loadAsset(glbUri).then((buffer: any) => {
      if (cancelled || !buffer) return;

      // Load asset on the worklet context thread
      workletContext.runAsync(() => {
        'worklet';
        if (cancelled) {
          buffer.release();
          return;
        }
        const asset = engine.loadAsset(buffer);
        buffer.release();
        return asset;
      }).then((asset: FilamentAsset | undefined) => {
        if (cancelled || !asset) return;

        assetRef.current = asset;
        asset.releaseSourceData();
        scene.addAssetEntities(asset);

        // Setup morph targets + bones
        const setups: MorphSetup[] = [];
        for (const name of FACE_MESH_NAMES) {
          const entity = asset.getFirstEntityByName(name);
          if (!entity) continue;
          const count = asset.getMorphTargetCountAt(entity);
          let mouthOpenIdx: number | undefined;
          let mouthSmileIdx: number | undefined;
          for (let i = 0; i < count; i++) {
            const tname = asset.getMorphTargetNameAt(entity, i);
            if (tname === 'mouthOpen') mouthOpenIdx = i;
            else if (tname === 'mouthSmile') mouthSmileIdx = i;
          }
          setups.push({ entity, count, mouthOpenIdx, mouthSmileIdx });
        }
        morphSetups.current = setups;

        headEntity.current = asset.getFirstEntityByName('Head') ?? null;
        spineEntity.current = asset.getFirstEntityByName('Spine') ?? null;
        if (!headEntity.current) {
          headEntity.current = asset.getFirstEntityByName('Wolf3D_Head') ?? null;
        }

        // Position the model: move down so head/torso fills the view
        const root = asset.getRoot();
        if (root) {
          transformManager.setEntityPosition(root, [0, -1.35, -2.5], false);
        }

        modelReady.current = true;
      });
    }).catch((e: any) => {
      console.warn('[Avatar3D] Failed to load model:', e);
    });

    return () => {
      cancelled = true;
      if (assetRef.current) {
        try {
          scene.removeAssetEntities(assetRef.current);
          assetRef.current.release();
        } catch { /* already released */ }
        assetRef.current = null;
      }
      modelReady.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [glbUri]);

  // Animation loop ~30fps
  useEffect(() => {
    const interval = setInterval(() => {
      if (!modelReady.current) return;

      const rm = rmRef.current;
      const tm = tmRef.current;
      if (!rm || !tm) return;

      const t = (Date.now() - startTime.current) / 1000;
      const state = aiStateRef.current;
      const amplitude = amplitudeRef.current;

      // Mouth
      let targetMouthOpen = 0;
      let targetSmile = 0;
      switch (state) {
        case 'idle':
          targetSmile = 0.3 + Math.sin(t * 0.5) * 0.1;
          break;
        case 'listening':
          targetSmile = 0.35;
          break;
        case 'thinking':
        case 'analyzing':
          targetSmile = 0.15;
          break;
        case 'speaking':
          targetMouthOpen = amplitude * 0.8 * (0.85 + Math.random() * 0.3);
          break;
      }

      smoothMouth.current = lerp(smoothMouth.current, targetMouthOpen, 0.3);
      if (state !== 'speaking' && smoothMouth.current > 0.01) {
        smoothMouth.current = lerp(smoothMouth.current, 0, 0.15);
      }

      for (const setup of morphSetups.current) {
        if (setup.count === 0) continue;
        const weights = new Array(setup.count).fill(0);
        if (setup.mouthOpenIdx !== undefined) weights[setup.mouthOpenIdx] = smoothMouth.current;
        if (setup.mouthSmileIdx !== undefined) weights[setup.mouthSmileIdx] = targetSmile;
        try { rm.setMorphWeights(setup.entity, weights, 0); } catch { /* */ }
      }

      // Head
      const head = headEntity.current;
      if (head) {
        const driftScale = state === 'thinking' || state === 'analyzing' ? 0.5 : 1.0;
        let yawDeg = (Math.sin(t * 0.3) * 3 + Math.sin(t * 0.7) * 1.5) * driftScale;
        let pitchDeg = (Math.sin(t * 0.5 + 1) * 2 + Math.sin(t * 1.1) * 1) * driftScale;
        const rollDeg = Math.sin(t * 0.2 + 2) * 1.5 * driftScale;

        if (state === 'thinking' || state === 'analyzing') pitchDeg += 3;
        if (state === 'speaking') {
          yawDeg += amplitude * 2;
          pitchDeg += amplitude * 1.5;
        }
        if (state === 'listening') {
          const now = Date.now();
          if (nodPhase.current === 0 && now - lastNodTime.current > 2000 + Math.random() * 2000) {
            nodPhase.current = 1;
            lastNodTime.current = now;
          }
          if (nodPhase.current > 0) {
            const elapsed = now - lastNodTime.current;
            if (elapsed < 200) pitchDeg += (elapsed / 200) * 4;
            else if (elapsed < 600) pitchDeg += 4 * (1 - (elapsed - 200) / 400);
            else nodPhase.current = 0;
          }
        }
        try {
          tm.setEntityRotation(head, yawDeg * DEG, [0, 1, 0], false);
          tm.setEntityRotation(head, pitchDeg * DEG, [1, 0, 0], true);
          tm.setEntityRotation(head, rollDeg * DEG, [0, 0, 1], true);
        } catch { /* */ }
      }

      // Breathing
      const spine = spineEntity.current;
      if (spine) {
        try { tm.setEntityRotation(spine, Math.sin(t * 0.8) * 0.5 * DEG, [1, 0, 0], false); } catch { /* */ }
      }
    }, 33);

    return () => clearInterval(interval);
  }, [amplitudeRef]);

  return (
    <FilamentView style={styles.filamentView}>
      <Camera />
      <DefaultLight />
    </FilamentView>
  );
}

class AvatarErrorBoundary extends React.Component<
  { children: React.ReactNode; size: number },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <View style={[styles.fallback, { width: this.props.size, height: this.props.size }]}>
          <Text style={styles.fallbackText}>3D unavailable</Text>
          <Text style={styles.fallbackDetail}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function Avatar3D({ aiState, amplitudeRef, size = 220 }: Avatar3DProps) {
  const [glbUri, setGlbUri] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    ensureGlbFile()
      .then(setGlbUri)
      .catch((e) => {
        console.warn('[Avatar3D] GLB copy failed:', e);
        setLoadError(e?.message || 'Failed to load avatar');
      });
  }, []);

  if (loadError) {
    return (
      <View style={[styles.fallback, { width: size, height: size }]}>
        <Text style={styles.fallbackText}>3D unavailable</Text>
        <Text style={styles.fallbackDetail}>{loadError}</Text>
      </View>
    );
  }

  if (!glbUri) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <AvatarErrorBoundary size={size}>
      <View style={[styles.container, { width: size, height: size }]}>
        <FilamentScene>
          <AvatarScene aiState={aiState} amplitudeRef={amplitudeRef} glbUri={glbUri} />
        </FilamentScene>
      </View>
    </AvatarErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 110,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
    position: 'relative',
  },
  filamentView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
  fallback: {
    borderRadius: 110,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  fallbackDetail: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
});
