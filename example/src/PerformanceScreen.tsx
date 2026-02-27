import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Preview3D, useBusyJS } from 'react-native-3d';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './App';
import { colors, spacing } from './theme';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Performance'>;
};

function JsThreadIndicator() {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    let frameId: number;
    function animate() {
      setRotation((r) => r + 0.04);
      frameId = requestAnimationFrame(animate);
    }
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <View style={styles.indicatorRow}>
      <View
        style={[
          styles.indicatorBox,
          { transform: [{ rotate: `${rotation}rad` }] },
        ]}
      />
      <View>
        <Text style={styles.indicatorLabel}>JS Thread</Text>
        <Text style={styles.indicatorDesc}>requestAnimationFrame</Text>
      </View>
    </View>
  );
}

export function PerformanceScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const toggleBusyJS = useBusyJS();
  const [isBusy, setIsBusy] = useState(false);

  const handleToggle = () => {
    toggleBusyJS();
    setIsBusy((v) => !v);
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'< Back'}</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Performance</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 3D Preview */}
      <View style={styles.previewContainer}>
        <Preview3D
          url="https://modelviewer.dev/shared-assets/models/Astronaut.glb"
          style={styles.preview}
          lighting={{ preset: 'studio', intensity: 1.2 }}
          autoRotate={{ axis: 'y', speed: 0.8 }}
          gestures={false}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Text style={styles.description}>
          The GPU renderer runs on a separate worklet thread. Block the JS
          thread — the 3D model keeps rendering at 60fps.
        </Text>

        <JsThreadIndicator />

        <Pressable
          style={[styles.button, isBusy && styles.buttonActive]}
          onPress={handleToggle}
        >
          <Text style={[styles.buttonText, isBusy && styles.buttonTextActive]}>
            {isBusy ? 'Stop Blocking' : 'Block JS Thread'}
          </Text>
        </Pressable>

        {isBusy && (
          <Text style={styles.hint}>
            250ms busy-wait per frame — cube should freeze, model should not
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backText: {
    fontSize: 16,
    color: colors.text,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  headerSpacer: {
    width: 50,
  },
  previewContainer: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  preview: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  indicatorBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.text,
  },
  indicatorLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  indicatorDesc: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  button: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonActive: {
    backgroundColor: colors.destructive,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonTextActive: {
    color: '#FFF',
  },
  hint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
