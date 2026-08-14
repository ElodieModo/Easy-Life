import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.easylife.family',
  appName: 'Easy Life',
  webDir: 'www',
  server: {
    url: process.env.NEXT_PUBLIC_CAPACITOR_URL || 'https://localhost:3000',
    androidScheme: 'https',
    iosScheme: 'https',
  },
};

export default config;
