import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DrawingCanvas from '@/components/drawing-canvas';

export default function CanvasScreen() {
  const insets = useSafeAreaInsets();
  const [clearSignal, setClearSignal] = useState(0);

  return (
    <View style={styles.container}>
      <DrawingCanvas
        clearSignal={clearSignal}
        dom={{ matchContents: false, style: styles.canvas }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear canvas"
        onPress={() => setClearSignal((value) => value + 1)}
        style={[styles.clearButton, { top: insets.top + 12 }]}>
        <Text style={styles.clearLabel}>Clear</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  canvas: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  clearButton: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  clearLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111111',
  },
});
