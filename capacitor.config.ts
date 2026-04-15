import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.organic.store',
  appName: 'Organic Store',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
