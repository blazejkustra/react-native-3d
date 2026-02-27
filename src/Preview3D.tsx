import { Canvas, useCanvasRef } from 'react-native-wgpu';
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {
  createWorkletRuntime,
  createSynchronizable,
} from 'react-native-worklets';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { renderOnWorkletRuntime } from './render-pipeline';
import type { LightingParams } from './webgpu-renderer';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';

const PAN_SENSITIVITY = 0.005;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;

/** Named lighting preset. */
type LightingPreset = 'studio' | 'outdoor' | 'neutral';

/** User-facing lighting configuration for Preview3D. */
interface LightingConfig {
  /** Named preset (default: 'studio'). */
  preset?: LightingPreset;
  /** Light intensity multiplier, scales diffuse output (default: 1.0). */
  intensity?: number;
  /** Ambient fill amount 0–1, overrides the preset value. */
  ambient?: number;
}

const LIGHTING_PRESETS: Record<
  LightingPreset,
  { direction: [number, number, number]; ambient: number; diffuse: number }
> = {
  studio: { direction: [-0.8, 0.4, 1.0], ambient: 0.1, diffuse: 0.9 },
  outdoor: { direction: [0.5, 1.0, 0.8], ambient: 0.25, diffuse: 0.75 },
  neutral: { direction: [0.0, 1.0, 0.2], ambient: 0.4, diffuse: 0.6 },
};

function resolveLighting(config?: LightingConfig): LightingParams {
  const preset = LIGHTING_PRESETS[config?.preset ?? 'studio'];
  const intensity = config?.intensity ?? 1.0;
  return {
    direction: preset.direction,
    ambient: config?.ambient ?? preset.ambient,
    diffuse: preset.diffuse * intensity,
  };
}

/** Props for the {@link Preview3D} component. */
export interface Preview3DProps {
  /** URL of the GLB model to display. */
  url: string;
  /** Lighting configuration with named presets. */
  lighting?: LightingConfig;
  /** Custom loading indicator (defaults to a small ActivityIndicator). */
  loading?: ReactNode;
  /** Container view style. */
  style?: ViewStyle;
  /** Whether pan/pinch gestures are enabled (default: true). */
  gestures?: boolean;
  /** Enable continuous rotation with optional axis ('x' | 'y') and speed (rad/s). */
  autoRotate?: { axis?: 'x' | 'y'; speed?: number };
  /** Initial camera X rotation in radians (default: 0). */
  initialAngleX?: number;
  /** Initial camera Y rotation in radians (default: 0). */
  initialAngleY?: number;
  /** Initial zoom level (default: 1). */
  initialZoom?: number;
  /** Called when the first frame has rendered successfully. */
  onLoad?: () => void;
  /** Called when model loading or rendering fails. */
  onError?: (error: Error) => void;
}

const defaultLoading = <ActivityIndicator size="small" color="#999" />;

/**
 * Creates pan and pinch gestures for 3D camera control.
 * @param cameraState - Shared synchronizable camera state
 * @param startAngles - Ref storing angles at gesture start
 * @param startZoom - Ref storing zoom at gesture start
 * @returns Combined simultaneous gesture
 */
function usePreview3DGestures(
  cameraState: ReturnType<
    typeof createSynchronizable<{
      angleX: number;
      angleY: number;
      zoom: number;
    }>
  >,
  startAngles: React.MutableRefObject<{ x: number; y: number }>,
  startZoom: React.MutableRefObject<number>
) {
  return useMemo(() => {
    const pan = Gesture.Pan()
      .onBegin(() => {
        const cam = cameraState.getDirty();
        startAngles.current = { x: cam.angleX, y: cam.angleY };
      })
      .onUpdate((e) => {
        cameraState.setBlocking((prev) => ({
          ...prev,
          angleY: startAngles.current.y + e.translationX * PAN_SENSITIVITY,
          angleX: startAngles.current.x + e.translationY * PAN_SENSITIVITY,
        }));
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        const cam = cameraState.getDirty();
        startZoom.current = cam.zoom;
      })
      .onUpdate((e) => {
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, startZoom.current / e.scale)
        );
        cameraState.setBlocking((prev) => ({
          ...prev,
          zoom: newZoom,
        }));
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [cameraState, startAngles, startZoom]);
}

/**
 * Renders a 3D GLB model using WebGPU on a dedicated worklet thread.
 *
 * Supports pan/pinch camera gestures, configurable lighting, auto-rotation,
 * and shows a loading indicator until the first frame is rendered.
 */
export function Preview3D({
  url,
  lighting,
  loading = defaultLoading,
  style,
  gestures = true,
  autoRotate,
  initialAngleX,
  initialAngleY,
  initialZoom,
  onLoad,
  onError,
}: Preview3DProps) {
  const ref = useCanvasRef();
  const [isLoading, setIsLoading] = useState(true);
  const cameraState = useRef(
    createSynchronizable({
      angleX: initialAngleX ?? 0,
      angleY: initialAngleY ?? 0,
      zoom: initialZoom ?? 1,
    })
  ).current;
  const readyState = useRef(
    createSynchronizable({ ready: false, error: false })
  ).current;
  const runtime = useRef(createWorkletRuntime('gpu')).current;
  const startAngles = useRef({ x: 0, y: 0 });
  const startZoom = useRef(1);

  const resolvedLighting = useMemo(() => resolveLighting(lighting), [lighting]);

  useEffect(() => {
    renderOnWorkletRuntime(
      ref,
      runtime,
      cameraState,
      readyState,
      url,
      resolvedLighting,
      autoRotate
    ).catch(() => {
      readyState.setBlocking(() => ({ ready: false, error: true }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLoadStable = useCallback(() => onLoad?.(), [onLoad]);
  const onErrorStable = useCallback(
    (error: Error) => onError?.(error),
    [onError]
  );

  useEffect(() => {
    if (!isLoading) return;
    let id: number;
    function poll() {
      const state = readyState.getDirty();
      if (state.ready) {
        setIsLoading(false);
        onLoadStable();
      } else if (state.error) {
        setIsLoading(false);
        onErrorStable(new Error('Failed to load 3D model'));
      } else {
        id = requestAnimationFrame(poll);
      }
    }
    id = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(id);
  }, [isLoading, onLoadStable, onErrorStable, readyState]);

  const gesture = usePreview3DGestures(cameraState, startAngles, startZoom);

  const content = (
    <View style={style}>
      <Canvas ref={ref} style={styles.canvas} />
      {isLoading && <View style={styles.loadingOverlay}>{loading}</View>}
    </View>
  );

  if (!gestures) {
    return content;
  }

  return <GestureDetector gesture={gesture}>{content}</GestureDetector>;
}

const styles = StyleSheet.create({
  canvas: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
