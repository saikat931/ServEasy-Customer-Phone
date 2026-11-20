import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home } from './src/modules/pages/home';

// ServEasy Customer App - Lazy-Mounted Tabs with First-Open Skeleton & 0ms Cache (2026-10-30 13:11)
export default function App() {
  return (
    <SafeAreaProvider>
      <Home />
    </SafeAreaProvider>
  );
}
