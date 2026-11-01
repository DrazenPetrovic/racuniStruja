import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.karpas.struja',
  appName: 'Računi Struja',
  webDir: 'dist',
  android: {
    webContentsDebuggingEnabled: false,
  },
};

export default config;
