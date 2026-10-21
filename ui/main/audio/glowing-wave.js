import { createAccentPalette, parseThemeColor } from './accent-palette.js';

const VERTEX = `#version 300 es
void main() {
    vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
    gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// Port of the APK's fef RuntimeShader (new GI motion path), with the
// feh setup and exs frame updates. Only shader syntax/coordinates change.
// Android dp is mapped to a 60-unit-high canvas; colors follow Dictate's theme.
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform float pixelScale;
uniform float reveal;
out vec4 fragColor;
uniform vec2 in_size;
uniform vec3 paletteDark;
uniform vec3 paletteBlue;
uniform vec3 paletteLight;
uniform vec3 paletteShine;
uniform float in_Inset;
uniform float in_CornerRadius;
uniform float in_FeatherRadius;
uniform float in_OffsetY;

uniform int in_use_turbulence;
uniform float in_gridNum;
uniform vec3 in_noiseMove;
uniform float in_noise_threshold_min;
uniform float in_noise_threshold_max;
uniform float in_warpAmplitude;
uniform float in_noiseRatio;

float dist_to_range(float x, float x1, float x2) {
  float d1 = x - x1;
  float d2 = x - x2;
  return min(abs(d1), abs(d2)) * sign(d1 * d2);
}

float dist_to_rect(vec2 n, float x1, float y1, float x2, float y2) {
  float dx = dist_to_range(n.x, x1, x2);
  float dy = dist_to_range(n.y, y1, y2);
  float out_x = step(0.0, dx);
  float out_y = step(0.0, dy);
  float in_rect = step(2.0, 2.0 - out_x - out_y);
  float dist_out = length(vec2(dx * out_x, dy * out_y));
  float dist_in = max(dx, dy);
  return dist_in * in_rect + dist_out * (1.0 - in_rect);
}

float feather(float x, float noiseVal) {
  float xx = x;
  float a = 1. / (1.0 + exp(-xx/.5/(1.+noiseVal*2.)));
  return a;
}

float getColorTurbulenceMask(float luma) {
  luma = luma * 0.5 + 0.5;
  return clamp(luma, 0.0, 1.0);
}

int imod(int a, int b) {
  return a - (b * (a / b));
}

ivec3 imod(ivec3 a, int b) {
  return ivec3(imod(a.x, b), imod(a.y, b), imod(a.z, b));
}

vec3 hash(vec3 p) {
  ivec3 v = ivec3(p);
  v = v * 1671731 + 10139267;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  ivec3 v2 = v / 65536;
  v = imod((10 - imod((v + v2), 10)), 10);
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return vec3(sin(float(v.x)), cos(float(v.y)), sin(float(v.z)));
}

const float SKEW = 0.3333333;
const float UNSKEW = 0.1666667;

float simplex3d(vec3 p) {
  vec3 s = floor(p + (p.x + p.y + p.z) * SKEW);
  vec3 u = s - (s.x + s.y + s.z) * UNSKEW;
  vec3 c0 = p - u;
  vec3 en = c0 - c0.yzx;
  en = step(vec3(0.0), en);
  vec3 offset1 = en * (1.0 - en.zxy);
  vec3 offset2 = 1.0 - en.zxy * (1.0 - en);
  vec3 offset3 = vec3(1.0);
  vec3 c1 = c0 - offset1 + UNSKEW;
  vec3 c2 = c0 - offset2 + UNSKEW * 2.0;
  vec3 c3 = c0 - offset3 + UNSKEW * 3.0;
  vec4 w;
  w.x = dot(c0, c0);
  w.y = dot(c1, c1);
  w.z = dot(c2, c2);
  w.w = dot(c3, c3);
  w = max(0.6 - w, 0.0);
  vec4 nc;
  nc.x = dot(hash(s), c0);
  nc.y = dot(hash(s + offset1), c1);
  nc.z = dot(hash(s + offset2), c2);
  nc.w = dot(hash(s + offset3), c3);
  nc *= w*w*w*w;
  return dot(vec4(32.0), nc);
}

float turbulenceNoise(vec2 p) {
  vec2 uv = p / in_size.yy;
  vec3 noiseP = vec3(uv + in_noiseMove.xy, in_noiseMove.z) * in_gridNum;
  return getColorTurbulenceMask(simplex3d(noiseP));
}

float featuredRoundedRect(vec2 n) {
  float inset = in_Inset + in_CornerRadius + in_FeatherRadius;
  float d = dist_to_rect(n - vec2(0.0, in_OffsetY), inset, inset, in_size.x - inset, in_size.y - inset);

  float noiseVal = 0.0;
  noiseVal = turbulenceNoise(n);

  float noiseVal1D = turbulenceNoise(vec2(n.x, in_size.y * 0.5));
  d += (noiseVal1D - 0.5) * in_warpAmplitude; // Warp distance symmetrically

  return feather((d - in_CornerRadius - in_FeatherRadius) / in_FeatherRadius, noiseVal);
}

vec4 render(vec2 p) {
  float alpha = featuredRoundedRect(p);
  // Accent-derived dark, saturated, pale, and near-white shades.
  // Only RGB changes: keep the original shader's alpha/shape exactly intact.
  float brightness = smoothstep(0.0, 0.8, alpha);
  float pale = smoothstep(0.4, 1.0, alpha) * 0.55;
  // Broad light inside the moving wave, following its noise-shaped contours.
  // Fade toward the solid base rather than drawing a fixed bottom stripe.
  float lightBand = (alpha - 0.78) / 0.25;
  float highlight = exp(-lightBand * lightBand)
      * (0.65 + 0.35 * turbulenceNoise(p)) * 0.55;
  vec3 color = mix(mix(mix(paletteDark, paletteBlue, brightness),
                       paletteLight, pale), paletteShine, highlight);
  return vec4(color * alpha, alpha);
}

void main() {
  // Android Canvas coordinates have their origin at the top left.
  vec2 p = vec2(gl_FragCoord.x / pixelScale,
                in_size.y - gl_FragCoord.y / pixelScale);
  vec4 color = render(p);
  // Expand a softly feathered mask from the center when listening starts.
  float edge = abs(p.x - in_size.x * 0.5);
  float mask = 1.0 - smoothstep(reveal * (in_size.x * 0.5 + 6.0),
                               reveal * (in_size.x * 0.5 + 6.0) + 6.0, edge);
  fragColor = color * mask * reveal;
}
`;

export class GlowingWave {
    constructor(surface, colors) {
        this.colors = colors;
        this.surface = surface;
        this.paletteCheckElapsed = 0;
        this.refreshPalette();
        this.active = false;
        this.level = 0;
        this.noiseX = 0;
        this.noiseZ = 0;
        this.age = 0;
        this.container = document.createElement('div');
        this.container.className = 'glowing-wave-layer';
        this.container.setAttribute('aria-hidden', 'true');
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'glowing-wave-canvas';
        this.container.appendChild(this.canvas);
        surface.appendChild(this.container);
        this.gl = this.canvas.getContext('webgl2', {
            alpha: true, premultipliedAlpha: true, antialias: false,
            depth: false, stencil: false, preserveDrawingBuffer: false
        });
        try {
            if (!this.gl) throw new Error('WebGL2 is unavailable');
            this.initialize();
        } catch (error) {
            this.container.remove();
            throw error; // AudioVisualizer selects Bars if WebGL2 is unavailable.
        }
        this.canvas.addEventListener('webglcontextlost', event => {
            event.preventDefault();
            this.contextLost = true;
        });
        this.canvas.addEventListener('webglcontextrestored', () => {
            this.contextLost = false;
            this.initialize();
            this.resize();
        });
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.resize();
    }

    initialize() {
        const gl = this.gl;
        const shaders = [];
        const program = gl.createProgram();
        try {
            for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
                const shader = gl.createShader(type);
                shaders.push(shader);
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    throw new Error(gl.getShaderInfoLog(shader));
                }
                gl.attachShader(program, shader);
            }
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program));
            }
        } catch (error) {
            gl.deleteProgram(program);
            throw error;
        } finally {
            shaders.forEach(shader => gl.deleteShader(shader));
        }
        this.program = program;
        this.uniforms = Object.fromEntries([
            'in_size', 'in_Inset', 'in_CornerRadius', 'in_FeatherRadius',
            'in_OffsetY', 'in_warpAmplitude', 'in_gridNum', 'in_noiseMove',
            'paletteDark', 'paletteBlue', 'paletteLight', 'paletteShine', 'pixelScale', 'reveal'
        ].map(name => [name, gl.getUniformLocation(program, name)]));
    }

    resize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        // Hidden cached renderers are resized when shown by the observer.
        if (!width || !height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.max(1, Math.round(width * dpr));
        this.canvas.height = Math.max(1, Math.round(height * dpr));
        this.draw();
    }

    refreshPalette() {
        const style = getComputedStyle(this.surface);
        const accent = style.getPropertyValue('--accent-color').trim();
        const background = style.backgroundColor;
        const fallbackBackground = style.getPropertyValue('--primary-bg').trim();
        const key = `${accent}|${background}|${fallbackBackground}`;
        if (key === this.paletteKey) return;
        this.paletteKey = key;
        this.palette = createAccentPalette(
            parseThemeColor(accent, this.colors.activeFrom),
            parseThemeColor(background, parseThemeColor(fallbackBackground, { r: 22, g: 22, b: 22 }))
        );
    }

    setColors(colors) {
        this.colors = colors;
        this.refreshPalette();
        this.draw();
    }

    update(level, elapsed, speechBands) {
        // Re-read computed CSS while listening, including changes from theme
        // attributes, inline accent settings, or updated stylesheet rules.
        // Cache by CSS value so color generation only runs when inputs change.
        this.paletteCheckElapsed += elapsed;
        if (this.paletteCheckElapsed >= 0.2) {
            this.paletteCheckElapsed = 0;
            this.refreshPalette();
        }
        const dt = Math.max(0, Math.min(0.05, elapsed));
        this.active = true;
        this.age += dt;
        // exs: approach the target by 0.005 per millisecond (200ms full range).
        const target = Math.max(0, Math.min(1, level));
        this.level += Math.sign(target - this.level) * Math.min(Math.abs(target - this.level), 5 * dt);
        this.noiseX -= 0.21000001 * dt;
        this.noiseZ += (this.level * 9 + 1) * 0.95 * dt;
        this.draw();
    }

    reset() {
        this.active = false;
        this.level = 0;
        this.age = 0;
        this.noiseX = 0;
        this.noiseZ = 0;
        this.draw();
    }

    draw() {
        const gl = this.gl;
        if (!gl || !this.program || this.contextLost || gl.isContextLost()) return;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        if (!this.active) return;
        gl.useProgram(this.program);
        const u = this.uniforms;
        const scale = this.canvas.height / 60;
        gl.uniform2f(u.in_size, this.canvas.width / scale, 60);
        gl.uniform1f(u.pixelScale, scale);
        gl.uniform1f(u.in_Inset, -15);
        gl.uniform1f(u.in_CornerRadius, 38);
        gl.uniform1f(u.in_FeatherRadius, 6);
        gl.uniform1f(u.in_gridNum, 0.57); // feg.f(), widget configuration
        gl.uniform1f(u.in_OffsetY, -(20 * this.level + 37));
        gl.uniform1f(u.in_warpAmplitude, 25 * this.level + 13);
        gl.uniform3f(u.in_noiseMove, this.noiseX, 0, this.noiseZ);
        // Perceptual shades generated from the current accent and surface.
        const palette = this.palette;
        for (const [name, color] of [
            ['paletteDark', palette.dark], ['paletteBlue', palette.blue],
            ['paletteLight', palette.light], ['paletteShine', palette.shine]
        ]) {
            gl.uniform3f(u[name], color.r / 255, color.g / 255, color.b / 255);
        }
        gl.uniform1f(u.reveal, Math.min(1, this.age / 0.166));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
}
