import { StyleSheet, View, Button, Text, ScrollView } from 'react-native';
import { Preview3D, useBusyJS } from 'react-native-3d';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function GPUExample() {
  const toggleBusyJS = useBusyJS();

  return (
    <GestureHandlerRootView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.text}>This box is animated on the JS thread</Text>
        <StateAnimatedBox />
        <Button title="Toggle busy JS Thread" onPress={toggleBusyJS} />
        <Text style={styles.text}>
          This GPU animation is running on a background thread.
        </Text>
        <Text style={styles.text}>Drag to rotate, pinch to zoom!</Text>

        <View style={styles.previewItem}>
          <Text style={styles.label}>Auto-spin</Text>
          <Preview3D
            url="https://modelviewer.dev/shared-assets/models/Astronaut.glb"
            style={styles.gpuPreview}
            lighting={{ preset: 'studio' }}
            autoRotate={{ axis: 'y', speed: 1 }}
            gestures={false}
          />
        </View>

        <View style={styles.previewItem}>
          <Text style={styles.label}>Angled</Text>
          <Preview3D
            url="https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb"
            style={styles.gpuPreview}
            lighting={{ preset: 'neutral' }}
            initialAngleY={Math.PI / 4}
            initialAngleX={0.3}
          />
        </View>

        <View style={styles.previewItem}>
          <Text style={styles.label}>Zoomed</Text>
          <Preview3D
            url="https://modelviewer.dev/shared-assets/models/NeilArmstrong.glb"
            style={styles.gpuPreview}
            lighting={{ preset: 'outdoor', intensity: 2 }}
            initialZoom={0.5}
            autoRotate={{ axis: 'x', speed: 0.3 }}
          />
        </View>
      </ScrollView>
    </GestureHandlerRootView>
  );
}

function StateAnimatedBox() {
  const [transform, setTransform] = useState({ rotate: 0 });

  useEffect(() => {
    let frameId: number;

    function animate() {
      setTransform(({ rotate }) => ({
        rotate: rotate + 0.04,
      }));
      frameId = requestAnimationFrame(animate);
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <View
      style={[
        styles.box,
        { transform: [{ rotate: `${transform.rotate}rad` }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  text: {
    paddingHorizontal: 20,
    textAlign: 'center',
  },
  previewItem: {
    width: '100%',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  gpuPreview: {
    width: '100%',
    height: 300,
  },
  box: {
    width: 50,
    height: 50,
    margin: 25,
    backgroundColor: 'blue',
  },
});
