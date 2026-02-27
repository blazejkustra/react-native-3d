/** Configurable lighting parameters for the scene. */
export interface LightingParams {
  /** Light direction vector (default: [0.5, 1.0, 0.8]). */
  direction?: [number, number, number];
  /** Ambient light intensity (default: 0.15). */
  ambient?: number;
  /** Diffuse light intensity (default: 0.85). */
  diffuse?: number;
  /** Camera/eye position for specular calculations. */
  eyePosition?: [number, number, number];
}

/** GPU resources created by `initRenderer`, needed for every subsequent frame. */
export interface RendererState {
  pipeline: GPURenderPipeline;
  depthTexture: GPUTexture;
  uniformBuffer: GPUBuffer;
  lightingBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  bindGroupLayout: GPUBindGroupLayout;
  format: GPUTextureFormat;
  sampler: GPUSampler;
  texture: GPUTexture;
}

/** GPU buffers holding uploaded mesh geometry. */
export interface MeshBuffers {
  vertexBuffer: GPUBuffer;
  normalBuffer: GPUBuffer;
  uvBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  indexFormat: GPUIndexFormat;
}

/**
 * Creates a 4-byte-aligned index buffer from a typed index array.
 * writeBuffer requires data size to be a multiple of 4 bytes;
 * Uint16 indices with odd count need padding.
 */
function createPaddedIndexBuffer(
  device: GPUDevice,
  idxCopy: Uint16Array | Uint32Array
): GPUBuffer {
  'worklet';
  const indexBufferSize = Math.ceil(idxCopy.byteLength / 4) * 4;
  const indexBuffer = device.createBuffer({
    size: indexBufferSize,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  const idxPadded = new Uint8Array(indexBufferSize);
  idxPadded.set(
    new Uint8Array(idxCopy.buffer, idxCopy.byteOffset, idxCopy.byteLength)
  );
  device.queue.writeBuffer(indexBuffer, 0, idxPadded);
  return indexBuffer;
}

/**
 * Creates the render pipeline with vertex/fragment shader modules and vertex buffer layout.
 * @param device - GPU device
 * @param pipelineLayout - Pipeline layout with bind group layouts
 * @param vertexShaderCode - WGSL vertex shader source
 * @param fragmentShaderCode - WGSL fragment shader source
 * @param format - Preferred canvas texture format
 * @returns Configured render pipeline
 */
function createRenderPipeline(
  device: GPUDevice,
  pipelineLayout: GPUPipelineLayout,
  vertexShaderCode: string,
  fragmentShaderCode: string,
  format: GPUTextureFormat
): GPURenderPipeline {
  'worklet';
  return device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: device.createShaderModule({ code: vertexShaderCode }),
      entryPoint: 'main',
      buffers: [
        {
          // positions
          arrayStride: 12,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
        },
        {
          // normals
          arrayStride: 12,
          attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }],
        },
        {
          // UVs
          arrayStride: 8,
          attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }],
        },
      ],
    },
    fragment: {
      module: device.createShaderModule({ code: fragmentShaderCode }),
      entryPoint: 'main',
      targets: [{ format }],
    },
    primitive: {
      topology: 'triangle-list',
      cullMode: 'none',
    },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: 'less',
      format: 'depth24plus',
    },
  });
}

/**
 * Creates a 1×1 white fallback texture used until the real texture is loaded.
 * @param device - GPU device
 * @returns The default texture
 */
function createDefaultTexture(device: GPUDevice): GPUTexture {
  'worklet';
  const texture = device.createTexture({
    size: { width: 1, height: 1 },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  device.queue.writeTexture(
    { texture },
    new Uint8Array([255, 255, 255, 255]),
    { bytesPerRow: 4 },
    { width: 1, height: 1 }
  );
  return texture;
}

/**
 * Creates the uniform and lighting GPU buffers with default values.
 * @param device - GPU device
 * @returns Tuple of [uniformBuffer, lightingBuffer]
 */
function createUniformBuffers(device: GPUDevice): [GPUBuffer, GPUBuffer] {
  'worklet';
  // Uniform buffer: 2 mat4x4f = 128 bytes
  const uniformBuffer = device.createBuffer({
    size: 128,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  // Lighting uniform buffer: 32 bytes (vec3f direction + f32 ambient + f32 diffuse + vec3f eyePos)
  const lightingBuffer = device.createBuffer({
    size: 32,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(
    lightingBuffer,
    0,
    new Float32Array([0.5, 1.0, 0.8, 0.15, 0.85, 0, 0, 0])
  );

  return [uniformBuffer, lightingBuffer];
}

/**
 * Initializes the WebGPU renderer: configures the canvas context, creates the pipeline,
 * uniform buffers, default texture, and bind group.
 * @param context - GPU canvas context
 * @param device - GPU device
 * @param width - Canvas width in pixels
 * @param height - Canvas height in pixels
 * @param vertexShaderCode - WGSL vertex shader source
 * @param fragmentShaderCode - WGSL fragment shader source
 * @returns All GPU resources needed for rendering
 */
export function initRenderer(
  context: GPUCanvasContext,
  device: GPUDevice,
  width: number,
  height: number,
  vertexShaderCode: string,
  fragmentShaderCode: string
): RendererState {
  'worklet';
  const format = navigator.gpu.getPreferredCanvasFormat();

  context.configure({
    device,
    format,
    alphaMode: 'premultiplied',
  });

  const [uniformBuffer, lightingBuffer] = createUniformBuffers(device);

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      },
    ],
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  const pipeline = createRenderPipeline(
    device,
    pipelineLayout,
    vertexShaderCode,
    fragmentShaderCode,
    format
  );

  const depthTexture = device.createTexture({
    size: { width, height },
    format: 'depth24plus',
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear',
  });

  const defaultTexture = createDefaultTexture(device);

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: uniformBuffer } },
      { binding: 1, resource: sampler },
      { binding: 2, resource: defaultTexture.createView() },
      { binding: 3, resource: { buffer: lightingBuffer } },
    ],
  });

  return {
    pipeline,
    depthTexture,
    uniformBuffer,
    lightingBuffer,
    bindGroup,
    bindGroupLayout,
    format,
    sampler,
    texture: defaultTexture,
  };
}

/**
 * Uploads mesh geometry to GPU buffers.
 * @param device - GPU device
 * @param positions - Vertex positions (float32×3)
 * @param normals - Vertex normals (float32×3)
 * @param texCoords - Texture coordinates (float32×2)
 * @param indices - Triangle indices
 * @param indexFormat - Index element type ('uint16' or 'uint32')
 * @returns GPU buffers ready for draw calls
 */
export function uploadMesh(
  device: GPUDevice,
  positions: Float32Array,
  normals: Float32Array,
  texCoords: Float32Array,
  indices: Uint16Array | Uint32Array,
  indexFormat: GPUIndexFormat
): MeshBuffers {
  'worklet';
  // Copy to standalone typed arrays - views into GLB ArrayBuffer may not work with writeBuffer
  const posCopy = new Float32Array(positions);
  const normCopy = new Float32Array(normals);
  const uvCopy = new Float32Array(texCoords);
  const idxCopy =
    indexFormat === 'uint32'
      ? new Uint32Array(indices)
      : new Uint16Array(indices);

  const vertexBuffer = device.createBuffer({
    size: posCopy.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, posCopy);

  const normalBuffer = device.createBuffer({
    size: normCopy.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(normalBuffer, 0, normCopy);

  const uvBuffer = device.createBuffer({
    size: uvCopy.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uvBuffer, 0, uvCopy);

  const indexBuffer = createPaddedIndexBuffer(device, idxCopy);
  return {
    vertexBuffer,
    normalBuffer,
    uvBuffer,
    indexBuffer,
    indexCount: indices.length,
    indexFormat,
  };
}

/**
 * Rebuilds the bind group with a new texture (e.g. after loading a model texture).
 * @param device - GPU device
 * @param state - Current renderer state (mutated in place)
 * @param texture - New texture to bind
 */
export function rebuildBindGroup(
  device: GPUDevice,
  state: RendererState,
  texture: GPUTexture
): void {
  'worklet';
  state.texture = texture;
  state.bindGroup = device.createBindGroup({
    layout: state.bindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: state.uniformBuffer } },
      { binding: 1, resource: state.sampler },
      { binding: 2, resource: texture.createView() },
      { binding: 3, resource: { buffer: state.lightingBuffer } },
    ],
  });
}

/**
 * Loads an ImageBitmap as a GPU texture and rebinds it in the renderer state.
 * @param device - GPU device
 * @param bitmap - Decoded image bitmap
 * @param state - Current renderer state (mutated in place)
 */
export function loadTexture(
  device: GPUDevice,
  bitmap: ImageBitmap,
  state: RendererState
): void {
  'worklet';
  try {
    const texture = device.createTexture({
      size: { width: bitmap.width, height: bitmap.height },
      format: 'rgba8unorm',
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture },
      { width: bitmap.width, height: bitmap.height }
    );

    rebuildBindGroup(device, state, texture);
  } catch (e) {
    console.log('loadTexture error', e);
  }
}

/**
 * Renders a single frame: uploads uniforms/lighting, issues draw call, and submits.
 * @param device - GPU device
 * @param context - GPU canvas context
 * @param state - Renderer state with pipeline, bind group, and buffers
 * @param mesh - Uploaded mesh buffers
 * @param mvp - Model-view-projection matrix (column-major Float32Array(16))
 * @param model - Model matrix (column-major Float32Array(16))
 * @param clearColor - Background clear color (default: transparent black)
 * @param lighting - Optional lighting parameter overrides
 */
export function renderFrame(
  device: GPUDevice,
  context: GPUCanvasContext,
  state: RendererState,
  mesh: MeshBuffers,
  mvp: Float32Array,
  model: Float32Array,
  lighting?: LightingParams
): void {
  'worklet';
  // Upload uniforms
  device.queue.writeBuffer(state.uniformBuffer, 0, mvp);
  device.queue.writeBuffer(state.uniformBuffer, 64, model);

  if (lighting) {
    const dir = lighting.direction ?? [0.5, 1.0, 0.8];
    const ambient = lighting.ambient ?? 0.15;
    const diffuse = lighting.diffuse ?? 0.85;
    const eye = lighting.eyePosition ?? [0, 0, 5];
    device.queue.writeBuffer(
      state.lightingBuffer,
      0,
      new Float32Array([
        dir[0],
        dir[1],
        dir[2],
        ambient,
        diffuse,
        eye[0],
        eye[1],
        eye[2],
      ])
    );
  }

  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPass = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
    depthStencilAttachment: {
      view: state.depthTexture.createView(),
      depthClearValue: 1.0,
      depthLoadOp: 'clear',
      depthStoreOp: 'store',
    },
  });

  renderPass.setPipeline(state.pipeline);
  renderPass.setBindGroup(0, state.bindGroup);
  renderPass.setVertexBuffer(0, mesh.vertexBuffer);
  renderPass.setVertexBuffer(1, mesh.normalBuffer);
  renderPass.setVertexBuffer(2, mesh.uvBuffer);
  renderPass.setIndexBuffer(mesh.indexBuffer, mesh.indexFormat);
  renderPass.drawIndexed(mesh.indexCount);
  renderPass.end();

  device.queue.submit([commandEncoder.finish()]);
}
