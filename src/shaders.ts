/**
 * WGSL vertex shader.
 *
 * Inputs: position (vec3f), normal (vec3f), texCoord (vec2f).
 * Uniforms: mvp (mat4x4f) and model (mat4x4f) matrices.
 * Outputs: clip-space position, world-space normal, world-space position, and texture coordinates.
 */
export const vertexShader = /* wgsl */ `
struct Uniforms {
  mvp: mat4x4f,
  model: mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) normal: vec3f,
  @location(1) worldPos: vec3f,
  @location(2) texCoord: vec2f,
}

@vertex
fn main(
  @location(0) position: vec3f,
  @location(1) normal: vec3f,
  @location(2) texCoord: vec2f,
) -> VertexOutput {
  var out: VertexOutput;
  out.position = uniforms.mvp * vec4f(position, 1.0);
  out.normal = (uniforms.model * vec4f(normal, 0.0)).xyz;
  out.worldPos = (uniforms.model * vec4f(position, 1.0)).xyz;
  out.texCoord = texCoord;
  return out;
}
`;

/**
 * WGSL fragment shader with multi-source lighting.
 *
 * Lighting model:
 * - Hemisphere ambient: blends between lower/upper ambient based on normal Y direction
 * - Primary diffuse: standard Lambertian diffuse from a directional light
 * - Fill light: secondary diffuse from an opposite-below direction (20% intensity)
 * - Blinn-Phong specular: shininess 48, intensity 15%
 * - Fresnel rim: power-4 rim lighting at 10% intensity
 */
export const fragmentShader = /* wgsl */ `
struct Lighting {
  direction: vec3f,
  ambient: f32,
  diffuse: f32,
  eyePosX: f32,
  eyePosY: f32,
  eyePosZ: f32,
}

@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var colorTexture: texture_2d<f32>;
@group(0) @binding(3) var<uniform> lighting: Lighting;

@fragment
fn main(
  @location(0) normal: vec3f,
  @location(1) worldPos: vec3f,
  @location(2) texCoord: vec2f,
) -> @location(0) vec4f {
  let n = normalize(normal);
  let lightDir = normalize(lighting.direction);
  let eyePos = vec3f(lighting.eyePosX, lighting.eyePosY, lighting.eyePosZ);
  let texColor = textureSample(colorTexture, texSampler, texCoord);

  // Hemisphere ambient: neutral tint, slight variation by normal direction
  let hemiMix = n.y * 0.5 + 0.5;
  let ambient = mix(0.35, 0.55, hemiMix) * lighting.ambient;

  // Primary diffuse light
  let diff = max(dot(n, lightDir), 0.0) * lighting.diffuse;

  // Secondary fill light from opposite-below direction
  let fillDir = normalize(vec3f(-lightDir.x, -0.3, -lightDir.z));
  let fill = max(dot(n, fillDir), 0.0) * lighting.diffuse * 0.2;

  // Blinn-Phong specular
  let viewDir = normalize(eyePos - worldPos);
  let halfVec = normalize(lightDir + viewDir);
  let spec = pow(max(dot(n, halfVec), 0.0), 48.0) * 0.15;

  // Fresnel rim lighting
  let fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0) * 0.1;

  let lit = texColor.rgb * (ambient + diff + fill) + vec3f(spec + fresnel);

  return vec4f(lit, texColor.a);
}
`;
