/**
 * The mesh a pack is drawn on: a grid of points the item writes every frame
 * (`pillow.js`), each with the light it takes. The light is worked into the
 * artwork's own pixels — darker on a slope turned from the light, brighter on
 * one turned to it — so it falls only where the pack is: its image's clear
 * margin stays clear, and nothing is laid over the stage round it. While it
 * spins the pack is flooded with the reel's colour as a coloured foil: the
 * colour takes its shadows and its lights from the artwork's own, so the
 * pack's picture shows through, its brightest parts going to white. WebGL, as
 * the scene runs on.
 */
import {Geometry, GlProgram, Mesh, Shader, UniformGroup} from 'pixi.js';

const VERTEX = `
in vec2 aPosition;
in vec2 aUV;
in float aLight;
out vec2 vUV;
out float vLight;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vLight = aLight;
}`;

// Premultiplied, as Pixi's textures are. The flood (rgb, and how far 0..1) turns the artwork into a foil of its
// colour by the artwork's own brightness; a light above 1 lifts the colour towards white by the pixel's own cover
const FRAGMENT = `
in vec2 vUV;
in float vLight;
uniform sampler2D uTexture;
uniform vec4 uColor;
uniform vec4 uFlood;
out vec4 finalColor;
void main() {
  vec4 colour = texture(uTexture, vUV);
  vec3 straight = colour.a > 0.0 ? colour.rgb / colour.a : vec3(0.0);
  float bright = dot(straight, vec3(0.299, 0.587, 0.114));
  vec3 foil = min(uFlood.rgb * (0.3 + 1.25 * bright) + vec3(smoothstep(0.62, 1.0, bright) * 0.55), vec3(1.0));
  vec3 flooded = mix(straight, foil, uFlood.a) * colour.a;
  vec3 lit = flooded * min(vLight, 1.0) + colour.a * max(vLight - 1.0, 0.0) * 0.55;
  finalColor = vec4(lit, colour.a) * uColor;
}`;

let program = null;
const programOf = () => (program ??= GlProgram.from({vertex: VERTEX, fragment: FRAGMENT, name: 'climb-pillow'}));

/** Triangles of a `cols` × `rows` grid of points numbered row by row. */
function gridIndices(cols, rows) {
  const out = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      out.set([a, b, c, b, d, c], k);
      k += 6;
    }
  }
  return out;
}

/**
 * A mesh of `n` points drawn from `texture` (its whole source, by `uvs`) in
 * the pack's foil and light: placed with `writePillow`, flooded with
 * `setFlood`, re-skinned with `setPillowTexture`.
 */
function foilMesh(texture, n, uvs, indices) {
  const lights = new Float32Array(n).fill(1);
  const geometry = new Geometry({
    attributes: {
      aPosition: new Float32Array(n * 2),
      aUV: uvs,
      aLight: {buffer: lights, format: 'float32'},
    },
    indexBuffer: indices,
  });
  const flood = new UniformGroup({uFlood: {value: new Float32Array([1, 1, 1, 0]), type: 'vec4<f32>'}});
  const shader = new Shader({glProgram: programOf(), resources: {uTexture: texture.source, flood}});
  const mesh = new Mesh({geometry, shader});

  /** Each point's place (x, y pairs) and, when given, its light. */
  mesh.writePillow = (points, light = null) => {
    const position = geometry.getBuffer('aPosition');
    position.data.set(points);
    position.update();
    if (!light) return;
    const lit = geometry.getBuffer('aLight');
    lit.data.set(light);
    lit.update();
  };
  /** Which part of the artwork each point shows (u, v pairs over its whole source). */
  mesh.writeUVs = next => {
    const uv = geometry.getBuffer('aUV');
    uv.data.set(next);
    uv.update();
  };
  /** Floods the artwork with `color` (0xrrggbb) as far as `amount` 0..1 — 0 shows it as it is. */
  mesh.setFlood = (color, amount) => {
    const value = flood.uniforms.uFlood;
    value[0] = ((color >> 16) & 0xff) / 255;
    value[1] = ((color >> 8) & 0xff) / 255;
    value[2] = (color & 0xff) / 255;
    value[3] = Math.max(0, Math.min(1, amount));
    flood.update();
  };
  /** The artwork it is drawn from: the pack's, or the card's once it has turned. */
  mesh.setPillowTexture = next => {
    if (next?.source) shader.resources.uTexture = next.source;
  };
  return mesh;
}

/** A pack's mesh for `texture`, `cols` × `rows` points row by row. */
export function createPillowMesh(texture, cols, rows) {
  const n = cols * rows;
  const uvs = new Float32Array(n * 2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      uvs[(j * cols + i) * 2] = i / (cols - 1);
      uvs[(j * cols + i) * 2 + 1] = j / (rows - 1);
    }
  }
  return foilMesh(texture, n, uvs, gridIndices(cols, rows));
}

/** A piece of a pack's back for a burst: four corners, clockwise, in the same foil. */
export function createFoilShard(texture) {
  return foilMesh(texture, 4, new Float32Array(8), new Uint32Array([0, 1, 2, 0, 2, 3]));
}
