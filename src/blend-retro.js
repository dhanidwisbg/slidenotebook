// ==========================================================================
// UNTITLED BLEND (RETRO FLUID MESH GRADIENT) - WEBGL 60FPS SHADER
// Based on Untitled blend (1).jsx: Type "RETRO", speed: 22, grain: 28
// Stops: ["#FFF1CF", "#F09199", "#EE7800", "#5997BD", "#1E50A2"]
// ==========================================================================

export function initBlendBackground(containerId = 'blend-bg-canvas') {
  const canvas = document.getElementById(containerId);
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false
  });

  if (!gl) {
    console.warn('[Blend] WebGL not supported, fallback to CSS gradient');
    return;
  }

  const vsSource = `
    attribute vec2 a_pos;
    void main() {
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_dark;

    const float zo = 0.15;
    const float _o = 0.5;
    const float cn = 2.0;
    const float dn = 0.85;
    const float cl = 4.0;
    const float Ho = 0.1;
    const float dl = 0.22;

    float hash(vec2 p, float seed) {
      return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 74.7) * 43758.5453);
    }

    float noise(vec2 p, float seed) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0.0, 0.0), seed), hash(i + vec2(1.0, 0.0), seed), u.x),
        mix(hash(i + vec2(0.0, 1.0), seed), hash(i + vec2(1.0, 1.0), seed), u.x),
        u.y
      );
    }

    float fbm(vec2 p, float seed) {
      float o = 0.0;
      float s = 0.5;
      float r = 1.0;
      float total = 0.0;
      for (int l = 0; l < 3; l++) {
        o += s * noise(p * r, seed + float(l) * 31.0);
        total += s;
        s *= 0.5;
        r *= 2.0;
      }
      return o / total;
    }

    vec3 oklabToSrgb(vec3 c) {
      float l_ = c.x + 0.3963377774 * c.y + 0.2158037573 * c.z;
      float m_ = c.x - 0.1055613458 * c.y - 0.0638541728 * c.z;
      float s_ = c.x - 0.0894841775 * c.y - 1.291485548 * c.z;
      float l = l_ * l_ * l_;
      float m = m_ * m_ * m_;
      float s = s_ * s_ * s_;
      
      vec3 rgb;
      rgb.r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      rgb.g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      rgb.b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
      
      return clamp(mix(
        rgb * 12.92,
        1.055 * pow(max(rgb, 0.0), vec3(0.4166666667)) - 0.055,
        step(0.0031308, rgb)
      ), 0.0, 1.0);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / u_res;
      uv.y = 1.0 - uv.y;
      
      float t = u_time;
      float f = t * dl;
      
      float N = fbm(vec2(uv.x * cn + f, uv.y * cn), 11.0);
      float A = fbm(vec2(uv.x * cn + 3.7, uv.y * cn + f), 23.0);
      
      vec2 warped = vec2(uv.x + _o * (N - 0.5), uv.y + _o * (A - 0.5));
      
      // 5 orbital centers matching Untitled blend (1).jsx Cn array
      vec2 centers[5];
      centers[0] = vec2(0.16 + Ho * sin(t * 0.9 + 0.00), 0.82 + Ho * cos(t * 0.72 + 0.00));
      centers[1] = vec2(0.78 + Ho * sin(t * 0.9 + 1.70), 0.26 + Ho * cos(t * 0.72 + 2.21));
      centers[2] = vec2(0.88 + Ho * sin(t * 0.9 + 3.40), 0.84 + Ho * cos(t * 0.72 + 4.42));
      centers[3] = vec2(0.24 + Ho * sin(t * 0.9 + 5.10), 0.16 + Ho * cos(t * 0.72 + 6.63));
      centers[4] = vec2(0.50 + Ho * sin(t * 0.9 + 6.80), 0.55 + Ho * cos(t * 0.72 + 8.84));
      
      // Accurate Oklab values calculated from sRGB stops:
      // #FFF1CF -> [0.96057, 0.00139, 0.04674]
      // #F09199 -> [0.75749, 0.11139, 0.02932]
      // #EE7800 -> [0.69615, 0.10473, 0.14113]
      // #5997BD -> [0.64969, -0.04671, -0.07200]
      // #1E50A2 -> [0.44648, -0.02503, -0.14122]
      vec3 lightBase = vec3(0.96057, 0.00139, 0.04674); // #FFF1CF
      vec3 darkBase  = vec3(0.18000, -0.01500, -0.02500); // deep night navy
      vec3 baseColor = mix(lightBase, darkBase, u_dark);

      vec3 oklab[5];
      oklab[0] = baseColor;
      oklab[1] = vec3(0.75749, 0.11139, 0.02932); // #F09199
      oklab[2] = vec3(0.69615, 0.10473, 0.14113); // #EE7800
      oklab[3] = vec3(0.64969, -0.04671, -0.07200); // #5997BD
      oklab[4] = vec3(0.44648, -0.02503, -0.14122); // #1E50A2
      
      vec3 sumColor = baseColor * dn;
      float sumWeight = dn;
      const float m = 22.2222;
      
      for (int i = 1; i < 5; i++) {
        vec2 diff = warped - centers[i];
        float weight = cl * exp(-dot(diff, diff) * m);
        sumColor += oklab[i] * weight;
        sumWeight += weight;
      }
      
      vec3 blendedOklab = sumColor / sumWeight;
      vec3 srgb = oklabToSrgb(blendedOklab);
      
      gl_FragColor = vec4(srgb, 1.0);
    }
  `;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[Blend Shader]', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  const vert = compileShader(gl.VERTEX_SHADER, vsSource);
  const frag = compileShader(gl.FRAGMENT_SHADER, fsSource);
  if (!vert || !frag) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[Blend Program]', gl.getProgramInfoLog(prog));
    return;
  }

  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const posLoc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uDark = gl.getUniformLocation(prog, 'u_dark');

  // Downscale internal resolution to 320px for high-performance organic blur
  function handleResize() {
    const parent = canvas.parentElement || document.body;
    const rect = parent.getBoundingClientRect();
    const width = rect.width || window.innerWidth;
    const height = rect.height || window.innerHeight;
    
    // Low internal res + CSS blur creates seamless, organic, 0% CPU fluid look
    const scale = Math.min(1, 380 / Math.max(width, height));
    const targetW = Math.max(160, Math.round(width * scale));
    const targetH = Math.max(120, Math.round(height * scale));

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      gl.viewport(0, 0, targetW, targetH);
      gl.uniform2f(uRes, targetW, targetH);
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  // Speed 22 from Untitled blend (1).jsx
  let currentT = 26.7534;
  let prevTimestamp = performance.now();
  let animationFrameId = null;

  function render(timestamp) {
    const delta = Math.min(0.1, (timestamp - prevTimestamp) / 1000);
    prevTimestamp = timestamp;

    // Advance time smoothly and seamlessly
    currentT += delta * 0.28;
    gl.uniform1f(uTime, currentT);

    const isDark = document.documentElement.dataset.theme === 'dark';
    gl.uniform1f(uDark, isDark ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    animationFrameId = requestAnimationFrame(render);
  }

  animationFrameId = requestAnimationFrame(render);

  return () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    window.removeEventListener('resize', handleResize);
  };
}
