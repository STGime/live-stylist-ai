/**
 * 3D avatar rendered via WebView + three.js.
 * Loads a Wolf3D .glb model and animates it based on AI state and amplitude.
 * Falls back to MangaAvatar on error.
 *
 * Strategy: writes HTML + vendor JS files to cache directory, then loads
 * the WebView from file:// URI. This avoids CDN loading issues in WebView.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import RNFS from 'react-native-fs';
import type { AdkAiState } from '../services/adk-client';
import MangaAvatar from './MangaAvatar';
import { getAvatarHtml } from './avatar3d/avatar-scene';

const GLB_FILENAME = '699ef6cb5f0ce8d116a1ea45.glb';
const AVATAR_DIR = `${RNFS.CachesDirectoryPath}/avatar3d`;

/** Copy GLB from app bundle to cache and return base64 */
async function loadGlbBase64(): Promise<string> {
  const destPath = `${AVATAR_DIR}/avatar.glb`;
  const exists = await RNFS.exists(destPath);
  if (!exists) {
    if (Platform.OS === 'android') {
      await RNFS.copyFileAssets(`custom/${GLB_FILENAME}`, destPath);
    } else {
      const bundlePath = `${RNFS.MainBundlePath}/assets/src/assets/${GLB_FILENAME}`;
      await RNFS.copyFile(bundlePath, destPath);
    }
  }
  return RNFS.readFile(destPath, 'base64');
}

/** Read vendor JS file from bundle assets */
async function readVendorFile(filename: string): Promise<string> {
  if (Platform.OS === 'android') {
    // On Android, Metro bundles assets into custom/ folder
    const cachePath = `${AVATAR_DIR}/${filename}`;
    const exists = await RNFS.exists(cachePath);
    if (!exists) {
      await RNFS.copyFileAssets(`custom/${filename}`, cachePath);
    }
    return RNFS.readFile(cachePath, 'utf8');
  } else {
    // On iOS, assets are in the main bundle
    const bundlePath = `${RNFS.MainBundlePath}/assets/src/assets/vendor/${filename}`;
    return RNFS.readFile(bundlePath, 'utf8');
  }
}

/** Prepare avatar HTML file in cache directory, return file:// URI */
async function prepareAvatarHtml(): Promise<string> {
  // Ensure cache dir exists
  const dirExists = await RNFS.exists(AVATAR_DIR);
  if (!dirExists) {
    await RNFS.mkdir(AVATAR_DIR);
  }

  console.log('[Avatar3DWebView] Loading assets...');

  // Load all resources in parallel
  const [glbBase64, threeJs, gltfLoader] = await Promise.all([
    loadGlbBase64(),
    readVendorFile('three.min.js'),
    readVendorFile('GLTFLoader.js'),
  ]);

  console.log('[Avatar3DWebView] Assets loaded - GLB:', glbBase64.length, 'three.js:', threeJs.length, 'GLTFLoader:', gltfLoader.length);

  // Generate HTML with inlined JS
  const html = getAvatarHtml(glbBase64, threeJs, gltfLoader);

  // Write HTML to cache
  const htmlPath = `${AVATAR_DIR}/avatar.html`;
  await RNFS.writeFile(htmlPath, html, 'utf8');

  console.log('[Avatar3DWebView] HTML written to:', htmlPath, 'size:', html.length);

  return `file://${htmlPath}`;
}

interface Avatar3DWebViewProps {
  aiState: AdkAiState;
  amplitudeRef: React.RefObject<number>;
  size?: number;
}

export default function Avatar3DWebView({
  aiState,
  amplitudeRef,
  size = 160,
}: Avatar3DWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const messageLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prepare HTML file
  useEffect(() => {
    prepareAvatarHtml()
      .then((uri) => {
        console.log('[Avatar3DWebView] Loading WebView from:', uri);
        setHtmlUri(uri);
      })
      .catch((e) => {
        console.warn('[Avatar3DWebView] Failed to prepare avatar:', e?.message || e);
        setLoadError(true);
      });
  }, []);

  // 30fps message loop to send state to WebView
  useEffect(() => {
    if (!ready) return;

    messageLoopRef.current = setInterval(() => {
      try {
        const msg = JSON.stringify({
          aiState,
          amplitude: amplitudeRef.current,
        });
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new MessageEvent('message',{data:${JSON.stringify(msg)}}));true;`
        );
      } catch {}
    }, 33);

    return () => {
      if (messageLoopRef.current) {
        clearInterval(messageLoopRef.current);
        messageLoopRef.current = null;
      }
    };
  }, [ready, aiState, amplitudeRef]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        console.log('[Avatar3DWebView] 3D scene ready!');
        setReady(true);
      } else if (data.type === 'log') {
        console.log('[Avatar3DWebView:scene]', data.message);
      } else if (data.type === 'error') {
        console.warn('[Avatar3DWebView:scene] ERROR:', data.message);
        setLoadError(true);
      }
    } catch (e) {
      console.warn('[Avatar3DWebView] Message parse error:', e);
    }
  };

  const handleError = () => {
    console.warn('[Avatar3DWebView] WebView error, falling back to MangaAvatar');
    setLoadError(true);
  };

  // Fallback to MangaAvatar
  if (loadError) {
    return <MangaAvatar speaking={aiState === 'speaking'} size={size * 0.7} />;
  }

  // Loading state
  if (!htmlUri) {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <WebView
        ref={webViewRef}
        source={{ uri: htmlUri }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        onMessage={handleMessage}
        onError={handleError}
        onHttpError={handleError}
        webContentsDebuggingEnabled={__DEV__}
        // Transparent background
        {...(Platform.OS === 'ios'
          ? { opaque: false, backgroundColor: 'transparent' }
          : { androidLayerType: 'hardware', backgroundColor: 'transparent' }
        )}
      />
      {/* Loading overlay until WebView signals ready */}
      {!ready && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading 3D...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 110,
    overflow: 'hidden',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 110,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '600',
  },
});
