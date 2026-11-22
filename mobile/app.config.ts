import type { ExpoConfig } from 'expo/config';

/**
 * LUMA app configuration.
 *
 * Build-time environment (set in eas.json profiles or with `eas env:create`):
 *   EXPO_PUBLIC_LUMA_API_URL       Base URL of the LUMA Go API. Empty = online features off.
 *   EXPO_PUBLIC_LUMA_CLIENT_TOKEN  Optional pilot token sent as X-Luma-Client (not a secret).
 *   LUMA_BUILD_ARCHS               Comma-separated ABIs, default "armeabi-v7a,arm64-v8a".
 *   LUMA_ANDROID_PACKAGE           Android application ID, default "app.luma.reader".
 *   LUMA_ALLOW_CLEARTEXT           "1" only for local test builds that call an http:// API
 *                                  (e.g. http://10.0.2.2:8080 from the emulator). Never for pilot APKs.
 */
const archs = (process.env.LUMA_BUILD_ARCHS ?? 'armeabi-v7a,arm64-v8a')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);
const allowCleartext = process.env.LUMA_ALLOW_CLEARTEXT === '1';

const config: ExpoConfig = {
  name: 'LUMA',
  slug: 'luma',
  owner: 'devquat',
  version: '0.1.0',
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: 'luma',
  userInterfaceStyle: 'automatic',
  backgroundColor: '#F5EFE3',
  android: {
    package: process.env.LUMA_ANDROID_PACKAGE ?? 'app.luma.reader',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#F5EFE3',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Readings and classroom photos stay on the phone: no Android cloud backup.
    allowBackup: false,
    permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO', 'android.permission.POST_NOTIFICATIONS'],
    blockedPermissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.ACCESS_COARSE_LOCATION',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#F5EFE3',
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
        dark: { backgroundColor: '#121416', image: './assets/images/splash-icon.png' },
      },
    ],
    'expo-sqlite',
    [
      'expo-audio',
      {
        microphonePermission: 'LUMA records your question only when you tap Record question.',
        recordAudioAndroid: true,
        enableBackgroundRecording: false,
        enableBackgroundPlayback: false,
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission: 'LUMA uses the camera to photograph a page or board so it can read it to you.',
        photosPermission: 'LUMA opens the image you choose so it can read it to you.',
        // Do not set microphonePermission: false here. It removes RECORD_AUDIO
        // from the whole app, which breaks spoken questions (expo-audio).
      },
    ],
    ['expo-notifications', { color: '#0A5651', defaultChannel: 'sunsafe' }],
    ['expo-build-properties', { android: { buildArchs: archs, usesCleartextTraffic: allowCleartext } }],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: 'f5524262-7a3f-48d0-930f-760730abf565',
    },
  },
};

export default config;
