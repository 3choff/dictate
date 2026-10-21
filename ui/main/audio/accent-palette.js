const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;

// OKLab separates perceived lightness from hue and chroma. This follows the
// accent/background-driven approach of Gboard, not its obfuscated HCT algorithm.
function toOklab(color) {
    const linear = value => {
        const s = value / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const r = linear(color.r), g = linear(color.g), b = linear(color.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
        l: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    };
}

function linearRgb(lightness, chroma, hue) {
    const a = chroma * Math.cos(hue), b = chroma * Math.sin(hue);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
}

function tone(lightness, chroma, hue) {
    // Reduce chroma at a fixed hue/lightness until the color fits sRGB.
    // Clipping channels directly can shift saturated accents to another hue.
    let low = 0, high = chroma;
    let rgb = linearRgb(lightness, chroma, hue);
    const fits = values => values.every(value => value >= -0.000001 && value <= 1.000001);
    if (!fits(rgb)) {
        for (let i = 0; i < 20; i++) {
            const candidate = (low + high) / 2;
            if (fits(linearRgb(lightness, candidate, hue))) low = candidate;
            else high = candidate;
        }
        rgb = linearRgb(lightness, low, hue);
    }
    const encode = value => {
        const v = clamp(value, 0, 1);
        return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
    };
    return { r: encode(rgb[0]), g: encode(rgb[1]), b: encode(rgb[2]) };
}

export function createAccentPalette(accent, background) {
    const seed = toOklab(accent);
    const bg = toOklab(background);
    const hue = Math.atan2(seed.b, seed.a);
    const chroma = Math.min(0.24, Math.hypot(seed.a, seed.b));
    const lightSurface = clamp((bg.l - 0.4) / 0.5, 0, 1);
    const bodyTone = mix(clamp(seed.l, 0.64, 0.73), clamp(seed.l, 0.48, 0.60), lightSurface);
    return {
        dark: tone(mix(0.34, 0.28, lightSurface), chroma * 0.7, hue),
        blue: tone(bodyTone, chroma, hue),
        light: tone(mix(0.84, 0.75, lightSurface), chroma * 0.48, hue),
        shine: tone(mix(0.97, 0.91, lightSurface), chroma * 0.10, hue)
    };
}

let colorContext;
export function parseThemeColor(value, fallback) {
    if (!value || !CSS.supports('color', value)) return fallback;
    colorContext ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (!colorContext) return fallback;
    colorContext.clearRect(0, 0, 1, 1);
    colorContext.fillStyle = value;
    colorContext.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = colorContext.getImageData(0, 0, 1, 1).data;
    return a ? { r, g, b } : fallback;
}
