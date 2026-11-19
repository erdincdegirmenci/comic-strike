import * as THREE from 'three';

// El çizimi (suluboya / mürekkep resim) görünümü:
//  - Yumuşak, düşük kontrastlı 3 tonlu gölgelendirme; renkler soluk ve sıcak (kâğıda boyanmış gibi)
//  - Yüzeyde çok hafif boya dalgalanması (fırça / pigment düzensizliği)
//  - İnce, koyu kahverengi mürekkep konturu; kalınlığı yer yer çok hafifçe değişir (cetvelle değil, elle)
// Ağır tarama veya titreşim yok: ekran sakin, çizim temiz. Shader maliyeti düşük tutuldu.
// Tüm materyaller aynı onBeforeCompile fonksiyonunu kullanır; böylece shader programları paylaşılır.

export const INK = 0x4a3d33; // sıcak kahverengi mürekkep (siyah değil: kenarlar yumuşak görünsün)

export const gradientMap = (() => {
  const tex = new THREE.DataTexture(new Uint8Array([185, 222, 255]), 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

/** Tüm el çizimi materyallerinin paylaştığı uniform'lar (Renderer her kare günceller) */
export const sketch = {
  uBoil: { value: 0 }, // konturların yeniden çizildiği adım (tamsayı)
  uPixelRatio: { value: 1 }, // tarama çizgileri her ekranda aynı kalınlıkta görünsün
};

const NOISE_GLSL = /* glsl */ `
  float skHash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float skNoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(skHash(i), skHash(i + vec3(1, 0, 0)), f.x),
                   mix(skHash(i + vec3(0, 1, 0)), skHash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(skHash(i + vec3(0, 0, 1)), skHash(i + vec3(1, 0, 1)), f.x),
                   mix(skHash(i + vec3(0, 1, 1)), skHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
  }
`;

/** Toon materyaline kalem taraması + keçeli kalem boyama ekler */
function toonSketchCompile(shader) {
  shader.uniforms.uBoil = sketch.uBoil;
  shader.uniforms.uPixelRatio = sketch.uPixelRatio;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vSkWorld;')
    .replace(
      '#include <fog_vertex>',
      '#include <fog_vertex>\nvSkWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>\nvarying vec3 vSkWorld;\nuniform float uBoil;\nuniform float uPixelRatio;\n${NOISE_GLSL}`,
    )
    .replace(
      '#include <opaque_fragment>',
      /* glsl */ `
      {
        vec3 c = outgoingLight;
        // Pigment: boya yüzeye eşit dağılmaz, geniş lekeler halinde hafifçe koyulaşır
        float wash = skNoise(vSkWorld * 0.35) * 0.65 + skNoise(vSkWorld * 1.7) * 0.35;
        c *= 0.95 + 0.09 * wash;
        // Soluk, sıcak renkler: doygunluk azalır, siyahlar kâğıt rengine doğru açılır
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, 0.7);
        c = c * vec3(0.93, 0.9, 0.84) + vec3(0.06, 0.055, 0.045);
        outgoingLight = c;
      }
      #include <opaque_fragment>`,
    );
}

/** El çizimi toon materyali (MeshToonMaterial seçenekleriyle) */
export function sketchToon(params = {}) {
  const m = new THREE.MeshToonMaterial({ gradientMap, ...params });
  m.onBeforeCompile = toonSketchCompile;
  return m;
}

/** Kontura dünya uzayında titreme ekler: kalınlık yer yer değişir, saniyede birkaç kez yeniden çizilir */
// three.js onBeforeCompile'ı materyalin kendisi üzerinde çağırır (this = materyal)
function outlineCompile(shader) {
  shader.uniforms.uBoil = sketch.uBoil;
  shader.uniforms.uAmp = this.userData.amp;
  shader.uniforms.uFreq = this.userData.freq;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nuniform float uBoil;\nuniform float uAmp;\nuniform float uFreq;\n${NOISE_GLSL}`)
    .replace(
      '#include <project_vertex>',
      /* glsl */ `
      vec4 skW = modelMatrix * vec4(transformed, 1.0);
      vec3 q = skW.xyz * uFreq + vec3(uBoil * 7.31, uBoil * 3.17, uBoil * 5.03);
      skW.xyz += (vec3(skNoise(q), skNoise(q + 19.7), skNoise(q + 41.3)) - 0.5) * 2.0 * uAmp;
      vec4 mvPosition = viewMatrix * skW;
      gl_Position = projectionMatrix * mvPosition;`,
    );
}

/** Titreyen el çizimi kontur materyali. amp: dünya biriminde sapma, freq: sapmanın sıklığı */
export function sketchOutline(amp = 0.012, freq = 2.2, opts = {}) {
  const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, ...opts });
  m.userData.amp = { value: amp };
  m.userData.freq = { value: freq };
  m.onBeforeCompile = outlineCompile;
  return m;
}

// Dünya ve birinci şahıs silah sahnesi ayrı önbellek kullanır: iki sahnenin ışıkları farklı,
// aynı materyal iki sahnede kullanılınca three.js her karede program anahtarını yeniden hesaplıyordu.
const caches = { world: new Map(), view: new Map() };

/** Renge göre paylaşılan el çizimi toon materyal. scope: 'world' | 'view' (silah sahnesi) */
export function toon(color, scope = 'world') {
  const cache = caches[scope];
  const key = String(color);
  if (!cache.has(key)) cache.set(key, sketchToon({ color }));
  return cache.get(key);
}

export const outlineMaterial = sketchOutline(0.006, 2.2);
export const viewOutlineMaterial = sketchOutline(0.0008, 9);
// Konturlar referans çizimlerdeki gibi ince: tüm kalınlıklar bu oranla küçültülür
const OUTLINE_SCALE = 0.45;

const _size = new THREE.Vector3();

/**
 * Merkezli, dışbükey bir geometriye (kutu, küre, silindir) kontur ekler.
 * Konturu, arka yüzleri çizilen biraz büyütülmüş siyah bir kopya oluşturur.
 */
export function addOutline(mesh, thickness = 0.03, material = outlineMaterial) {
  thickness *= OUTLINE_SCALE;
  const geo = mesh.geometry;
  if (!geo.boundingBox) geo.computeBoundingBox();
  geo.boundingBox.getSize(_size);
  const o = new THREE.Mesh(geo, material);
  o.scale.set(
    1 + (2 * thickness) / Math.max(_size.x, 1e-3),
    1 + (2 * thickness) / Math.max(_size.y, 1e-3),
    1 + (2 * thickness) / Math.max(_size.z, 1e-3),
  );
  o.raycast = () => {}; // konturlar isabet testine girmesin
  mesh.add(o);
  return o;
}

/** Kısayol: toon materyalli + konturlu parça. scope 'view': birinci şahıs silah sahnesi */
export function part(geometry, color, thickness = 0.03, scope = 'world') {
  const m = new THREE.Mesh(geometry, toon(color, scope));
  addOutline(m, thickness, scope === 'view' ? viewOutlineMaterial : outlineMaterial);
  return m;
}

/**
 * Çizgi parçalarını (LineSegments konumları) el çizimine çevirir: her kenar iki kez,
 * uçları biraz taşarak ve hafif sapmayla çizilir. positions: [x0,y0,z0,x1,y1,z1,...]
 */
export function sketchSegments(positions, seed = 1, jitter = 0.03, overshoot = 0.08, strokes = 2) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) - 0.5;
  const out = new Float32Array(positions.length * strokes);
  let o = 0;
  for (let i = 0; i < positions.length; i += 6) {
    const ax = positions[i], ay = positions[i + 1], az = positions[i + 2];
    const bx = positions[i + 3], by = positions[i + 4], bz = positions[i + 5];
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 1;
    for (let stroke = 0; stroke < strokes; stroke++) {
      // Uzun kenarlarda daha çok taşma; ikinci çizgi biraz kısa ve kaymış
      const over = Math.min(overshoot, len * 0.15) * (stroke ? 0.5 + rnd() : 1 + rnd());
      const k0 = (stroke ? rnd() * 0.06 : -over / len);
      const k1 = 1 + (stroke ? rnd() * 0.06 : over / len);
      const j = jitter * (stroke ? 1.6 : 1);
      out[o++] = ax + dx * k0 + rnd() * j;
      out[o++] = ay + dy * k0 + rnd() * j;
      out[o++] = az + dz * k0 + rnd() * j;
      out[o++] = ax + dx * k1 + rnd() * j;
      out[o++] = ay + dy * k1 + rnd() * j;
      out[o++] = az + dz * k1 + rnd() * j;
    }
  }
  return out;
}
