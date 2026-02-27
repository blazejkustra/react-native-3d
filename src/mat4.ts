// ---- Math utilities for 4x4 matrices ----

/**
 * Multiplies two 4×4 matrices (column-major).
 * @param a - Left-hand operand (column-major Float32Array(16))
 * @param b - Right-hand operand (column-major Float32Array(16))
 * @returns Product matrix as a column-major Float32Array(16)
 */
export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  'worklet';
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[j * 4 + i] =
        a[i]! * b[j * 4]! +
        a[4 + i]! * b[j * 4 + 1]! +
        a[8 + i]! * b[j * 4 + 2]! +
        a[12 + i]! * b[j * 4 + 3]!;
    }
  }
  return out;
}

/**
 * Creates a perspective projection matrix.
 * @param fovY - Vertical field of view in radians
 * @param aspect - Viewport width / height ratio
 * @param near - Near clipping plane distance
 * @param far - Far clipping plane distance
 * @returns Column-major Float32Array(16) perspective matrix
 */
export function mat4Perspective(
  fovY: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  'worklet';
  const out = new Float32Array(16);
  const f = 1.0 / Math.tan(fovY / 2);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = far / (near - far);
  out[11] = -1;
  out[14] = (far * near) / (near - far);
  return out;
}

/**
 * Creates a view matrix that looks from `eye` toward `center` with the given `up` direction.
 * @param eye - Camera position [x, y, z]
 * @param center - Look-at target [x, y, z]
 * @param up - Up direction [x, y, z]
 * @returns Column-major Float32Array(16) view matrix
 */
export function mat4LookAt(
  eye: number[],
  center: number[],
  up: number[]
): Float32Array {
  'worklet';
  const out = new Float32Array(16);
  let fx = center[0]! - eye[0]!;
  let fy = center[1]! - eye[1]!;
  let fz = center[2]! - eye[2]!;
  let len = Math.sqrt(fx * fx + fy * fy + fz * fz);
  fx /= len;
  fy /= len;
  fz /= len;

  let sx = fy * up[2]! - fz * up[1]!;
  let sy = fz * up[0]! - fx * up[2]!;
  let sz = fx * up[1]! - fy * up[0]!;
  len = Math.sqrt(sx * sx + sy * sy + sz * sz);
  sx /= len;
  sy /= len;
  sz /= len;

  const ux = sy * fz - sz * fy;
  const uy = sz * fx - sx * fz;
  const uz = sx * fy - sy * fx;

  out[0] = sx;
  out[1] = ux;
  out[2] = -fx;
  out[3] = 0;
  out[4] = sy;
  out[5] = uy;
  out[6] = -fy;
  out[7] = 0;
  out[8] = sz;
  out[9] = uz;
  out[10] = -fz;
  out[11] = 0;
  out[12] = -(sx * eye[0]! + sy * eye[1]! + sz * eye[2]!);
  out[13] = -(ux * eye[0]! + uy * eye[1]! + uz * eye[2]!);
  out[14] = -(-fx * eye[0]! + -fy * eye[1]! + -fz * eye[2]!);
  out[15] = 1;
  return out;
}

/**
 * Creates a rotation matrix around the Y axis.
 * @param angle - Rotation angle in radians
 * @returns Column-major Float32Array(16) rotation matrix
 */
export function mat4RotationY(angle: number): Float32Array {
  'worklet';
  const out = new Float32Array(16);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = c;
  out[2] = -s;
  out[5] = 1;
  out[8] = s;
  out[10] = c;
  out[15] = 1;
  return out;
}

/**
 * Creates a rotation matrix around the X axis.
 * @param angle - Rotation angle in radians
 * @returns Column-major Float32Array(16) rotation matrix
 */
export function mat4RotationX(angle: number): Float32Array {
  'worklet';
  const out = new Float32Array(16);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  out[0] = 1;
  out[5] = c;
  out[6] = s;
  out[9] = -s;
  out[10] = c;
  out[15] = 1;
  return out;
}

/**
 * Transforms a 3-component vector by a 4×4 matrix (ignores translation, w=0).
 * Useful for rotating direction/position vectors by a rotation matrix.
 * @param m - Column-major Float32Array(16) matrix
 * @param v - 3-component vector [x, y, z]
 * @returns Transformed vector as number[3]
 */
export function mat4VecMul(m: Float32Array, v: number[]): number[] {
  'worklet';
  return [
    m[0]! * v[0]! + m[4]! * v[1]! + m[8]! * v[2]!,
    m[1]! * v[0]! + m[5]! * v[1]! + m[9]! * v[2]!,
    m[2]! * v[0]! + m[6]! * v[1]! + m[10]! * v[2]!,
  ];
}

/**
 * Creates a translation matrix.
 * @param x - Translation along the X axis
 * @param y - Translation along the Y axis
 * @param z - Translation along the Z axis
 * @returns Column-major Float32Array(16) translation matrix
 */
export function mat4Translation(x: number, y: number, z: number): Float32Array {
  'worklet';
  const out = new Float32Array(16);
  out[0] = 1;
  out[5] = 1;
  out[10] = 1;
  out[12] = x;
  out[13] = y;
  out[14] = z;
  out[15] = 1;
  return out;
}
