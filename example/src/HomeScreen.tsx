import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Preview3D } from 'react-native-3d';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './App';
import { colors, spacing } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_WIDTH * 0.85;

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom },
      ]}
    >
      <View style={styles.hero}>
        <Preview3D
          url="https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb"
          style={styles.heroPreview}
          lighting={{ preset: 'studio', intensity: 1.2 }}
          autoRotate={{ axis: 'y', speed: 0.4 }}
          gestures={false}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>react-native-3d</Text>
        <Text style={styles.subtitle}>
          WebGPU model viewer. Renders on a dedicated GPU thread.
        </Text>
      </View>

      <View style={styles.nav}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigation.navigate('Playground')}
        >
          <View>
            <Text style={styles.rowTitle}>Playground</Text>
            <Text style={styles.rowSubtitle}>Lighting and camera controls</Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigation.navigate('Performance')}
        >
          <View>
            <Text style={styles.rowTitle}>Performance</Text>
            <Text style={styles.rowSubtitle}>Thread independence demo</Text>
          </View>
          <Text style={styles.chevron}>{'>'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  hero: {
    height: HERO_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  heroPreview: {
    flex: 1,
  },
  content: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 21,
  },
  nav: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.border,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  rowSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  chevron: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '300',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
});
