import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Preview3D } from 'react-native-3d';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './App';
import { colors, spacing } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_HEIGHT = SCREEN_WIDTH;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Playground'>;
};

type LightingPreset = 'studio' | 'outdoor' | 'neutral';

const PRESETS: { key: LightingPreset; label: string }[] = [
  { key: 'studio', label: 'Studio' },
  { key: 'outdoor', label: 'Outdoor' },
  { key: 'neutral', label: 'Neutral' },
];

const INTENSITY_STEPS = [0.5, 0.8, 1.0, 1.3, 1.6, 2.0];

const MODELS = [
  {
    label: 'Astronaut',
    url: 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
  },
  {
    label: 'Duck',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb',
  },
  {
    label: 'Armstrong',
    url: 'https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb',
  },
];

export function PlaygroundScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [preset, setPreset] = useState<LightingPreset>('studio');
  const [intensity, setIntensity] = useState(1.0);
  const [modelIndex, setModelIndex] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);

  const model = MODELS[modelIndex]!;

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
        <Text style={styles.headerTitle}>Playground</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* 3D Preview */}
      <View style={styles.previewContainer}>
        <Preview3D
          key={`${model.url}-${preset}-${intensity}-${autoRotate}`}
          url={model.url}
          style={styles.preview}
          lighting={{ preset, intensity }}
          autoRotate={autoRotate ? { axis: 'y', speed: 0.5 } : undefined}
        />
      </View>

      {/* Controls */}
      <ScrollView
        style={styles.controls}
        contentContainerStyle={styles.controlsContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Model */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Model</Text>
          <View style={styles.segmentRow}>
            {MODELS.map((m, i) => (
              <Pressable
                key={m.label}
                style={[styles.segment, i === modelIndex && styles.segmentOn]}
                onPress={() => {
                  setModelIndex(i);
                }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    i === modelIndex && styles.segmentTextOn,
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Lighting */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lighting</Text>
          <View style={styles.segmentRow}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.key}
                style={[styles.segment, p.key === preset && styles.segmentOn]}
                onPress={() => setPreset(p.key)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    p.key === preset && styles.segmentTextOn,
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Intensity */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Intensity</Text>
            <Text style={styles.sectionValue}>{intensity.toFixed(1)}x</Text>
          </View>
          <View style={styles.barRow}>
            {INTENSITY_STEPS.map((step) => (
              <Pressable
                key={step}
                style={[styles.bar, step <= intensity && styles.barFilled]}
                onPress={() => setIntensity(step)}
              />
            ))}
          </View>
        </View>

        {/* Auto-rotate */}
        <Pressable
          style={styles.toggleRow}
          onPress={() => setAutoRotate((v) => !v)}
        >
          <Text style={styles.sectionTitle}>Auto-rotate</Text>
          <View style={[styles.toggle, autoRotate && styles.toggleOn]}>
            <View
              style={[styles.toggleThumb, autoRotate && styles.toggleThumbOn]}
            />
          </View>
        </Pressable>
      </ScrollView>
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
    width: 30,
  },
  previewContainer: {
    height: PREVIEW_HEIGHT,
    marginHorizontal: spacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  preview: {
    flex: 1,
  },
  controls: {
    flex: 1,
  },
  controlsContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionValue: {
    fontSize: 14,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentOn: {
    backgroundColor: colors.bg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextOn: {
    color: colors.text,
    fontWeight: '600',
  },
  barRow: {
    flexDirection: 'row',
    gap: 4,
    height: 28,
  },
  bar: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  barFilled: {
    backgroundColor: colors.text,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: {
    backgroundColor: colors.green,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
});
