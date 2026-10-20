/** A bounded, fluid ribbon driven by a speech envelope, not a literal waveform. */
export class GlowingWave {
    constructor(surface, colors) {
        // This layer is a sibling of the controls, not part of the bars' slot.
        this.container = document.createElement('div');
        this.container.className = 'glowing-wave-layer';
        this.container.setAttribute('aria-hidden', 'true');
        this.colors = colors;
        this.width = 0;
        this.height = 0;
        this.phase = 0;
        this.level = 0;
        this.bands = new Array(5).fill(0);
        this.active = false;
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'glowing-wave-canvas';
        this.canvas.setAttribute('aria-hidden', 'true');
        this.context = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);
        surface.appendChild(this.container);
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.container);
        this.resize();
    }

    resize() {
        this.width = this.container.clientWidth;
        this.height = this.container.clientHeight;
        const scale = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.width * scale);
        this.canvas.height = Math.round(this.height * scale);
        this.context?.setTransform(scale, 0, 0, scale, 0, 0);
        this.draw();
    }

    setColors(colors) {
        this.colors = colors;
        this.draw();
    }

    update(level, elapsed, speechBands) {
        this.active = true;
        // Retain a little inertia without burying speech beneath two slow filters.
        // The smoothed level also gently speeds the continuous travelling curves.
        this.level += (level - this.level) * (1 - Math.exp(-elapsed / 0.04));
        this.bands = this.bands.map((previous, index) => {
            const target = speechBands[index];
            const response = target > previous ? 0.045 : 0.16;
            return previous + (target - previous) * (1 - Math.exp(-elapsed / response));
        });
        this.phase += elapsed * (0.85 + this.level * 0.4);
        this.draw();
    }

    reset() {
        this.active = false;
        this.level = 0;
        this.bands = new Array(5).fill(0);
        this.phase = 0;
        this.draw();
    }

    draw() {
        const ctx = this.context;
        const w = this.width;
        const h = this.height;
        if (!ctx || !w || !h) return;
        ctx.clearRect(0, 0, w, h);

        if (!this.active) {
            // A quiet ribbon along the same bottom edge, with no running animation.
            ctx.globalAlpha = Number(this.colors.inactiveOpacity) || 0.4;
            ctx.fillStyle = this.colors.inactiveBg;
            ctx.beginPath();
            ctx.rect(0, h - 2, w, 2);
            ctx.fill();
            ctx.globalAlpha = 1;
            return;
        }

        const { waveBase: base, waveEdge: edge, waveBody: body, waveShoulder: shoulder } = this.colors;
        const rgba = (color, alpha) => `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
        // The reference is a full luminous base with broad, overlapping swells,
        // not a row of narrow peaks. Gaussian lobes merge without pointed troughs.
        // Stable low-to-high regions make changes in voice timbre visible.
        // Low frequencies form broad swells; consonants form narrower crests.
        const centers = this.bands.map((_, index) =>
            0.1 + index * 0.2 + 0.035 * Math.sin(this.phase * 0.65 + index * 1.4));
        const widths = [0.18, 0.155, 0.135, 0.115, 0.1];
        const gaussian = (x, center, width) => Math.exp(-0.5 * ((x - center) / width) ** 2);
        const fullness = Math.pow(this.level, 0.85);

        const fillColumn = (column, rise, opacity) => {
            const top = h - rise;
            const gradient = ctx.createLinearGradient(0, top, 0, h);
            // Transparent at the crest: the existing window tone shows through.
            // Deep UI blue transitions into the brighter blue at the bottom edge.
            gradient.addColorStop(0, rgba(shoulder, 0));
            gradient.addColorStop(0.16, rgba(shoulder, 0.025 * opacity));
            gradient.addColorStop(0.38, rgba(shoulder, 0.16 * opacity));
            gradient.addColorStop(0.6, rgba(body, 0.55 * opacity));
            gradient.addColorStop(0.82, rgba(base, 0.9 * opacity));
            gradient.addColorStop(0.9, rgba(base, 0.96 * opacity));
            gradient.addColorStop(1, rgba(edge, opacity));
            ctx.fillStyle = gradient;
            ctx.fillRect(column, top, 1, rise);
        };

        for (let column = 0; column < Math.ceil(w); column++) {
            const x = column / Math.max(1, w - 1);
            let lobes = 0;
            for (let index = 0; index < this.bands.length; index++) {
                const breathing = 0.94 + 0.06 * Math.sin(this.phase * 1.3 + index * 2);
                lobes += gaussian(x, centers[index], widths[index])
                    * (0.06 + Math.pow(this.bands[index], 1.3) * 0.94) * breathing;
            }
            // Spectral energy drives local height; overall volume only scales
            // it. Soft compression preserves varied peaks instead of flat caps.
            const spectralHeight = fullness * (0.09 + lobes * 0.85);
            const rise = Math.max(2, h * (0.04 + 0.94 * (1 - Math.exp(-spectralHeight / 0.6))));
            // A second, softer field moves underneath the foreground, creating
            // depth and flowing shoulders without a sharp stroked wave boundary.
            const underglow = Math.min(h, rise + h * fullness * 0.1
                * gaussian(x, 0.5 + 0.3 * Math.sin(this.phase * 0.4), 0.32));
            fillColumn(column, underglow, 0.35);
            fillColumn(column, rise, 0.94);
        }
    }
}
