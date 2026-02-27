const GLB_MAGIC = 0x46546c67; // 'glTF'
const JSON_CHUNK = 0x4e4f534a; // 'JSON'
const BIN_CHUNK = 0x004e4942; // 'BIN\0'

interface GLBChunks {
  json: any;
  bin: ArrayBuffer;
}

/** Parsed mesh geometry ready for GPU upload. */
export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  texCoords: Float32Array;
  indices: Uint16Array | Uint32Array;
  indexFormat: 'uint16' | 'uint32';
}

/**
 * Parses a GLB (Binary glTF 2.0) buffer into its JSON and BIN chunks.
 * @param buffer - Raw GLB file contents
 * @returns The parsed JSON descriptor and binary data chunk
 */
export function parseGLB(buffer: ArrayBuffer): GLBChunks {
  'worklet';
  const view = new DataView(buffer);

  const magic = view.getUint32(0, true);
  if (magic !== GLB_MAGIC) {
    throw new Error('Not a valid GLB file');
  }

  const version = view.getUint32(4, true);
  if (version !== 2) {
    throw new Error(`Unsupported GLB version: ${version}`);
  }

  let offset = 12; // skip header

  // Read JSON chunk
  const jsonChunkLength = view.getUint32(offset, true);
  const jsonChunkType = view.getUint32(offset + 4, true);
  if (jsonChunkType !== JSON_CHUNK) {
    throw new Error('First chunk is not JSON');
  }
  offset += 8;

  const jsonBytes = new Uint8Array(buffer, offset, jsonChunkLength);
  let jsonStr = '';
  for (let i = 0; i < jsonBytes.length; i++) {
    jsonStr += String.fromCharCode(jsonBytes[i]!);
  }
  const json = JSON.parse(jsonStr);
  offset += jsonChunkLength;

  // Read BIN chunk
  const binChunkLength = view.getUint32(offset, true);
  const binChunkType = view.getUint32(offset + 4, true);
  if (binChunkType !== BIN_CHUNK) {
    throw new Error('Second chunk is not BIN');
  }
  offset += 8;

  const bin = buffer.slice(offset, offset + binChunkLength);

  return { json, bin };
}

/**
 * glTF component type codes mapping to byte size and TypedArray kind.
 * - 5123 = UNSIGNED_SHORT (2 bytes)
 * - 5125 = UNSIGNED_INT (4 bytes)
 * - 5126 = FLOAT (4 bytes)
 */
const COMPONENT_TYPES: Record<
  number,
  { size: number; array: 'float32' | 'uint16' | 'uint32' }
> = {
  5123: { size: 2, array: 'uint16' },
  5125: { size: 4, array: 'uint32' },
  5126: { size: 4, array: 'float32' },
};

/** Number of scalar components per glTF accessor type. */
const TYPE_SIZES: Record<string, number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

/**
 * Reads interleaved/strided accessor data element-by-element from a DataView.
 * @param bin - Binary buffer
 * @param byteOffset - Starting byte offset
 * @param byteStride - Stride between consecutive elements
 * @param count - Number of elements
 * @param numComponents - Components per element (e.g. 3 for VEC3)
 * @param arrayType - Target typed array kind
 * @returns Packed typed array with the extracted data
 */
function readStridedData(
  bin: ArrayBuffer,
  byteOffset: number,
  byteStride: number,
  count: number,
  numComponents: number,
  arrayType: 'float32' | 'uint16' | 'uint32'
): Float32Array | Uint16Array | Uint32Array {
  'worklet';
  const totalElements = count * numComponents;
  const srcView = new DataView(bin);

  if (arrayType === 'float32') {
    const result = new Float32Array(totalElements);
    for (let i = 0; i < count; i++) {
      const srcOffset = byteOffset + i * byteStride;
      for (let c = 0; c < numComponents; c++) {
        result[i * numComponents + c] = srcView.getFloat32(
          srcOffset + c * 4,
          true
        );
      }
    }
    return result;
  } else if (arrayType === 'uint16') {
    const result = new Uint16Array(totalElements);
    for (let i = 0; i < count; i++) {
      const srcOffset = byteOffset + i * byteStride;
      for (let c = 0; c < numComponents; c++) {
        result[i * numComponents + c] = srcView.getUint16(
          srcOffset + c * 2,
          true
        );
      }
    }
    return result;
  } else {
    const result = new Uint32Array(totalElements);
    for (let i = 0; i < count; i++) {
      const srcOffset = byteOffset + i * byteStride;
      for (let c = 0; c < numComponents; c++) {
        result[i * numComponents + c] = srcView.getUint32(
          srcOffset + c * 4,
          true
        );
      }
    }
    return result;
  }
}

/**
 * Reads contiguous (tightly packed) accessor data directly as a typed array view.
 * @param bin - Binary buffer
 * @param byteOffset - Starting byte offset
 * @param totalElements - Total number of scalar values to read
 * @param arrayType - Target typed array kind
 * @returns Typed array view into the binary buffer
 */
function readContiguousData(
  bin: ArrayBuffer,
  byteOffset: number,
  totalElements: number,
  arrayType: 'float32' | 'uint16' | 'uint32'
): Float32Array | Uint16Array | Uint32Array {
  'worklet';
  switch (arrayType) {
    case 'float32':
      return new Float32Array(bin, byteOffset, totalElements);
    case 'uint16':
      return new Uint16Array(bin, byteOffset, totalElements);
    case 'uint32':
      return new Uint32Array(bin, byteOffset, totalElements);
  }
}

/**
 * Reads accessor data from the binary buffer, handling both strided and contiguous layouts.
 * @param gltf - Parsed glTF JSON descriptor
 * @param bin - Binary data chunk
 * @param accessorIndex - Index into `gltf.accessors`
 * @returns Typed array containing the accessor's data
 */
function getAccessorData(
  gltf: any,
  bin: ArrayBuffer,
  accessorIndex: number
): Float32Array | Uint16Array | Uint32Array {
  'worklet';
  const accessor = gltf.accessors[accessorIndex];
  const bufferView = gltf.bufferViews[accessor.bufferView];
  const componentInfo = COMPONENT_TYPES[accessor.componentType];
  if (!componentInfo) {
    throw new Error(`Unsupported component type: ${accessor.componentType}`);
  }

  const byteOffset = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const numComponents = TYPE_SIZES[accessor.type] ?? 1;
  const totalElements = accessor.count * numComponents;
  const elementByteSize = numComponents * componentInfo.size;

  if (bufferView.byteStride && bufferView.byteStride !== elementByteSize) {
    return readStridedData(
      bin,
      byteOffset,
      bufferView.byteStride,
      accessor.count,
      numComponents,
      componentInfo.array
    );
  }

  return readContiguousData(
    bin,
    byteOffset,
    totalElements,
    componentInfo.array
  );
}

function generateFlatNormals(positions: Float32Array): Float32Array {
  'worklet';
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < normals.length; i += 9) {
    const ax = positions[i]!,
      ay = positions[i + 1]!,
      az = positions[i + 2]!;
    const bx = positions[i + 3]!,
      by = positions[i + 4]!,
      bz = positions[i + 5]!;
    const cx = positions[i + 6]!,
      cy = positions[i + 7]!,
      cz = positions[i + 8]!;
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    normals[i] = nx;
    normals[i + 1] = ny;
    normals[i + 2] = nz;
    normals[i + 3] = nx;
    normals[i + 4] = ny;
    normals[i + 5] = nz;
    normals[i + 6] = nx;
    normals[i + 7] = ny;
    normals[i + 8] = nz;
  }
  return normals;
}

interface PrimitiveData {
  positions: Float32Array;
  normals: Float32Array;
  texCoords: Float32Array;
  indices: Uint16Array | Uint32Array;
  useUint32: boolean;
}

/**
 * Extracts geometry from a single glTF primitive.
 * @param gltf - Parsed glTF JSON descriptor
 * @param bin - Binary data chunk
 * @param primitive - The glTF primitive object
 * @returns Extracted positions, normals, texCoords, indices, and whether uint32 indices are needed
 */
function extractPrimitive(
  gltf: any,
  bin: ArrayBuffer,
  primitive: any
): PrimitiveData {
  'worklet';
  const positions = getAccessorData(
    gltf,
    bin,
    primitive.attributes.POSITION
  ) as Float32Array;

  let normals: Float32Array;
  if (primitive.attributes.NORMAL !== undefined) {
    normals = getAccessorData(
      gltf,
      bin,
      primitive.attributes.NORMAL
    ) as Float32Array;
  } else {
    normals = generateFlatNormals(positions);
  }

  let texCoords: Float32Array;
  if (primitive.attributes.TEXCOORD_0 !== undefined) {
    texCoords = getAccessorData(
      gltf,
      bin,
      primitive.attributes.TEXCOORD_0
    ) as Float32Array;
  } else {
    texCoords = new Float32Array((positions.length / 3) * 2);
  }

  const indices = getAccessorData(gltf, bin, primitive.indices) as
    | Uint16Array
    | Uint32Array;
  const indexAccessor = gltf.accessors[primitive.indices];
  const useUint32 = indexAccessor.componentType === 5125;

  return { positions, normals, texCoords, indices, useUint32 };
}

/**
 * Merges per-primitive geometry arrays into single typed arrays.
 * @param primitives - Array of extracted primitive data
 * @param totalIndices - All indices with vertex offsets already applied
 * @param vertexCount - Total number of vertices across all primitives
 * @param useUint32 - Whether to use uint32 index format
 * @returns Merged MeshData ready for GPU upload
 */
function mergeGeometry(
  primitives: PrimitiveData[],
  totalIndices: number[],
  vertexCount: number,
  useUint32: boolean
): MeshData {
  'worklet';
  let totalPos = 0,
    totalNorm = 0,
    totalUV = 0;
  for (let i = 0; i < primitives.length; i++) {
    totalPos += primitives[i]!.positions.length;
    totalNorm += primitives[i]!.normals.length;
    totalUV += primitives[i]!.texCoords.length;
  }

  const positions = new Float32Array(totalPos);
  const normals = new Float32Array(totalNorm);
  const texCoords = new Float32Array(totalUV);
  let pOff = 0,
    nOff = 0,
    uvOff = 0;
  for (let i = 0; i < primitives.length; i++) {
    positions.set(primitives[i]!.positions, pOff);
    pOff += primitives[i]!.positions.length;
    normals.set(primitives[i]!.normals, nOff);
    nOff += primitives[i]!.normals.length;
    texCoords.set(primitives[i]!.texCoords, uvOff);
    uvOff += primitives[i]!.texCoords.length;
  }

  if (vertexCount > 65535) {
    useUint32 = true;
  }
  const indexFormat: 'uint16' | 'uint32' = useUint32 ? 'uint32' : 'uint16';
  const indices = useUint32
    ? new Uint32Array(totalIndices)
    : new Uint16Array(totalIndices);

  return { positions, normals, texCoords, indices, indexFormat };
}

/**
 * Extracts and merges mesh geometry from all primitives in a glTF model.
 * @param gltf - Parsed glTF JSON descriptor
 * @param bin - Binary data chunk
 * @returns Merged mesh data with positions, normals, texCoords, and indices
 */
export function extractMeshData(gltf: any, bin: ArrayBuffer): MeshData {
  'worklet';
  const allPrimitives: PrimitiveData[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;
  let useUint32 = false;

  for (let mi = 0; mi < gltf.meshes.length; mi++) {
    const mesh = gltf.meshes[mi];
    for (let pi = 0; pi < mesh.primitives.length; pi++) {
      const prim = extractPrimitive(gltf, bin, mesh.primitives[pi]);
      if (prim.useUint32) useUint32 = true;

      for (let i = 0; i < prim.indices.length; i++) {
        allIndices.push(prim.indices[i]! + vertexOffset);
      }

      allPrimitives.push(prim);
      vertexOffset += prim.positions.length / 3;
    }
  }

  return mergeGeometry(allPrimitives, allIndices, vertexOffset, useUint32);
}

/**
 * Computes the axis-aligned bounding box of a position array.
 * @param positions - Flat array of vertex positions [x, y, z, ...]
 * @returns The center point and the size of the largest axis extent
 */
export function computeBoundingBox(positions: Float32Array): {
  center: [number, number, number];
  size: number;
} {
  'worklet';
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!,
      y = positions[i + 1]!,
      z = positions[i + 2]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return {
    center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
    size: Math.max(maxX - minX, maxY - minY, maxZ - minZ),
  };
}

/**
 * Extracts embedded image data (e.g. base color texture) from a glTF model.
 *
 * Follows the material chain: material → baseColorTexture → texture → image → bufferView.
 * @param gltf - Parsed glTF JSON descriptor
 * @param bin - Binary data chunk
 * @returns Raw image bytes, or null if no embedded image is found
 */
export function extractImageData(
  gltf: any,
  bin: ArrayBuffer
): Uint8Array | null {
  'worklet';
  if (!gltf.images || gltf.images.length === 0) {
    return null;
  }

  // Follow the material chain: material → baseColorTexture → texture → image
  let imageIndex = 0;
  const mesh = gltf.meshes?.[0];
  const primitive = mesh?.primitives?.[0];
  if (primitive?.material !== undefined) {
    const material = gltf.materials?.[primitive.material];
    const baseColorTex = material?.pbrMetallicRoughness?.baseColorTexture;
    if (baseColorTex !== undefined) {
      const texture = gltf.textures?.[baseColorTex.index];
      if (texture?.source !== undefined) {
        imageIndex = texture.source;
      }
    }
  }

  const image = gltf.images[imageIndex];
  if (!image || image.bufferView === undefined) {
    return null;
  }

  const bufferView = gltf.bufferViews[image.bufferView];
  const byteOffset = bufferView.byteOffset ?? 0;
  const byteLength = bufferView.byteLength;

  return new Uint8Array(bin, byteOffset, byteLength);
}
