import { PixelRatio } from 'react-native';
import type { CanvasRef } from 'react-native-wgpu';
import { initWebGPU } from './utils';
import {
  createSynchronizable,
  scheduleOnRuntime,
  type WorkletRuntime,
  type Synchronizable,
  scheduleOnRN,
} from 'react-native-worklets';
import {
  parseGLB,
  extractMeshData,
  extractImageData,
  computeBoundingBox,
} from './glb';
import {
  initRenderer,
  uploadMesh,
  renderFrame,
  rebuildBindGroup,
  type LightingParams,
} from './webgpu-renderer';
import {
  mat4Multiply,
  mat4Perspective,
  mat4LookAt,
  mat4RotationY,
  mat4RotationX,
  mat4Translation,
  mat4VecMul,
} from './mat4';
import { vertexShader, fragmentShader } from './shaders';

/**
 * Starts the WebGPU render loop on a dedicated worklet runtime thread.
 *
 * Fetches and parses a GLB model, uploads its geometry, and runs an animation loop
 * that reads camera state from a `Synchronizable` shared value. The rendering runs
 * entirely off the JS thread, so the UI stays responsive even under heavy JS load.
 *
 * @param ref - Canvas element reference
 * @param runtime - Worklet runtime to schedule GPU work on
 * @param cameraState - Shared camera angles and zoom, writable from the RN thread (gestures)
 * @param readyState - Shared flag signaling when the first frame has rendered or an error occurred
 * @param url - URL of the GLB model to load
 * @param lighting - Optional lighting parameter overrides
 * @param autoRotate - Optional auto-rotation config (axis and speed in rad/s)
 */
export async function renderOnWorkletRuntime(
  ref: React.RefObject<CanvasRef>,
  runtime: WorkletRuntime,
  cameraState: Synchronizable<{ angleX: number; angleY: number; zoom: number }>,
  readyState: Synchronizable<{ ready: boolean; error: boolean }>,
  url: string,
  lighting?: LightingParams,
  autoRotate?: { axis?: 'x' | 'y'; speed?: number }
) {
  const context = ref.current!.getContext('webgpu')!;
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter?.requestDevice();
  initWebGPU(runtime);

  const dpr = PixelRatio.get();
  const canvas = context.canvas as typeof context.canvas & {
    width: number;
    height: number;
  };
  canvas.width = canvas.width * dpr;
  canvas.height = canvas.height * dpr;
  const { width, height } = canvas;

  // Staging texture: RN thread writes decoded image here, worklet copies from it.
  // GPU memory is shared across threads — only the JS reference is captured (frozen but not mutated).
  const stagingTexture = device!.createTexture({
    size: { width: 2048, height: 2048 },
    format: 'rgba8unorm',
    usage:
      GPUTextureUsage.COPY_SRC |
      GPUTextureUsage.COPY_DST |
      GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const textureDimsSync = createSynchronizable<{
    width: number;
    height: number;
  } | null>(null);

  // Runs on RN thread — has access to createImageBitmap and closure vars
  async function decodeImage(imageBytes: Uint8Array): Promise<void> {
    try {
      const bitmap = await createImageBitmap(imageBytes);
      device!.queue.copyExternalImageToTexture(
        { source: bitmap },
        { texture: stagingTexture },
        { width: bitmap.width, height: bitmap.height }
      );
      textureDimsSync.setBlocking(() => ({
        width: bitmap.width,
        height: bitmap.height,
      }));
    } catch (e) {
      console.log('image decode error', e);
    }
  }

  scheduleOnRuntime(runtime, async () => {
    'worklet';

    // --- 1. Initialize renderer ---
    const state = initRenderer(
      context,
      device!,
      width,
      height,
      vertexShader,
      fragmentShader
    );

    try {
      // --- 2. Load and parse GLB model ---
      const glbResponse = await fetch(url);
      const glbBuffer = await glbResponse.arrayBuffer();

      const { json, bin } = parseGLB(glbBuffer);
      const { positions, normals, texCoords, indices, indexFormat } =
        extractMeshData(json, bin);

      const mesh = uploadMesh(
        device!,
        positions,
        normals,
        texCoords,
        indices,
        indexFormat
      );

      // Send image bytes to RN thread for decoding, pick up result in render loop
      const imageBytes = extractImageData(json, bin);
      if (imageBytes) {
        try {
          scheduleOnRN(decodeImage, new Uint8Array(imageBytes));
        } catch (texErr) {
          console.log('texture error', texErr);
        }
      }

      // --- 3. Set up camera projection ---
      const { center, size: modelSize } = computeBoundingBox(positions);

      const aspect = width / height;
      const baseDist = modelSize * 2;
      const projection = mat4Perspective(
        Math.PI / 3,
        aspect,
        baseDist * 0.01,
        baseDist * 10
      );

      const toOrigin = mat4Translation(-center[0], -center[1], -center[2]);
      let firstFrame = true;
      let prevTime = 0;
      const rotateAxis = autoRotate?.axis ?? 'y';
      const rotateSpeed = autoRotate?.speed ?? 0.5;
      let textureLoaded = false;

      // Smoothed camera values — lerp toward gesture targets each frame
      let smoothAngleX = 0;
      let smoothAngleY = 0;
      let smoothZoom = 1;
      const LERP_SPEED = 12; // higher = snappier

      // --- 4. Animation loop ---
      function animate(time: number) {
        const dt = prevTime === 0 ? 0 : (time - prevTime) / 1000;
        prevTime = time;

        // Pick up decoded texture from staging (written by RN thread)
        if (!textureLoaded) {
          const texDims = textureDimsSync.getDirty();
          if (texDims) {
            const texture = device!.createTexture({
              size: { width: texDims.width, height: texDims.height },
              format: 'rgba8unorm',
              usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
            });
            const encoder = device!.createCommandEncoder();
            encoder.copyTextureToTexture(
              { texture: stagingTexture },
              { texture },
              { width: texDims.width, height: texDims.height }
            );
            device!.queue.submit([encoder.finish()]);

            rebuildBindGroup(device!, state, texture);
            textureLoaded = true;
          }
        }

        const cam = cameraState.getDirty();

        if (autoRotate) {
          const delta = rotateSpeed * dt;
          if (rotateAxis === 'x') {
            cameraState.setBlocking((prev) => ({
              ...prev,
              angleX: prev.angleX + delta,
            }));
          } else {
            cameraState.setBlocking((prev) => ({
              ...prev,
              angleY: prev.angleY + delta,
            }));
          }
        }

        // Smooth interpolation toward target camera values
        const t = Math.min(1, LERP_SPEED * dt);
        smoothAngleX += (cam.angleX - smoothAngleX) * t;
        smoothAngleY += (cam.angleY - smoothAngleY) * t;
        smoothZoom += (cam.zoom - smoothZoom) * t;

        const dist = baseDist * smoothZoom;

        // Orbit camera: rotate the view around the target rather than
        // rotating the model. Applying rotX then rotY to the view ensures
        // horizontal drag always orbits around screen-up and vertical drag
        // always tilts around screen-right, regardless of current orientation.
        const rotY = mat4RotationY(-smoothAngleY);
        const rotX = mat4RotationX(-smoothAngleX);
        const orbit = mat4Multiply(rotY, rotX);
        const eye = mat4VecMul(orbit, [0, 0, dist]);
        const up = mat4VecMul(orbit, [0, 1, 0]);

        const view = mat4LookAt(eye, [0, 0, 0], up);
        const vp = mat4Multiply(projection, view);

        const model = toOrigin;
        const mvp = mat4Multiply(vp, model);

        // Counter-rotate light direction by the inverse orbit so the light
        // stays fixed in world space as the camera orbits around the model.
        const inverseOrbit = mat4Multiply(
          mat4RotationX(smoothAngleX),
          mat4RotationY(smoothAngleY)
        );
        const dir = lighting?.direction ?? [0.5, 1.0, 0.8];
        const worldLight = mat4VecMul(inverseOrbit, dir);

        renderFrame(device!, context, state, mesh, mvp, model, {
          ...lighting,
          direction: worldLight as [number, number, number],
          eyePosition: eye as [number, number, number],
        });
        context.present();
        if (firstFrame) {
          firstFrame = false;
          readyState.setBlocking(() => ({ ready: true, error: false }));
        }
        requestAnimationFrame(animate);
      }

      requestAnimationFrame(animate);
    } catch (e) {
      console.log('error', e);
      readyState.setBlocking(() => ({ ready: false, error: true }));
    }
  });
}
