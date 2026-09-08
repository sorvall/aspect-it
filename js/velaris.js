(function () {
    const VERT = [
        'attribute vec2 position;',
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = position * 0.5 + 0.5;',
        '  gl_Position = vec4(position, 0.0, 1.0);',
        '}',
    ].join('\n');

    const FRAG = [
        'precision highp float;',
        'varying vec2 vUv;',
        'uniform vec2 u_resolution;',
        'uniform float u_time;',
        'uniform float u_grain;',
        'uniform vec3 u_colors[4];',
        'uniform vec3 u_bg;',
        'vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }',
        'float snoise(vec2 v){',
        '  const vec4 C = vec4(0.211324865405187, 0.366025403784439,',
        '    -0.577350269189626, 0.024390243902439);',
        '  vec2 i = floor(v + dot(v, C.yy));',
        '  vec2 x0 = v - i + dot(i, C.xx);',
        '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
        '  vec4 x12 = x0.xyxy + C.xxzz;',
        '  x12.xy -= i1;',
        '  i = mod(i, 289.0);',
        '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))',
        '    + i.x + vec3(0.0, i1.x, 1.0));',
        '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),',
        '    dot(x12.zw,x12.zw)), 0.0);',
        '  m = m*m;',
        '  m = m*m;',
        '  vec3 x = 2.0 * fract(p * C.www) - 1.0;',
        '  vec3 h = abs(x) - 0.5;',
        '  vec3 ox = floor(x + 0.5);',
        '  vec3 a0 = x - ox;',
        '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
        '  vec3 g;',
        '  g.x = a0.x * x0.x + h.x * x0.y;',
        '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
        '  return 130.0 * dot(m, g);',
        '}',
        'void main() {',
        '  vec2 uv = vUv;',
        '  float ratio = u_resolution.x / u_resolution.y;',
        '  vec2 p = uv - 0.5;',
        '  p.x *= ratio;',
        '  float t = u_time * 0.1;',
        '  float n1 = snoise(p * 0.4 + vec2(t * 0.2, -t * 0.3));',
        '  float n2 = snoise(p * 0.55 + vec2(-t * 0.15, t * 0.25) + n1 * 0.25);',
        '  float n3 = snoise(p * 0.75 + vec2(t * 0.1, -t * 0.2) + n2 * 0.2);',
        '  vec3 col = u_bg;',
        '  float dist = length(p) * 1.5;',
        '  float vignette = 1.0 - smoothstep(0.3, 1.2, dist);',
        '  col = mix(col, u_colors[0], smoothstep(-0.2, 0.5, n1) * 0.45);',
        '  col = mix(col, u_colors[1], smoothstep(-0.1, 0.6, n2) * 0.35);',
        '  col = mix(col, u_colors[2], smoothstep(-0.3, 0.4, n3) * 0.28);',
        '  col = mix(col, u_colors[3], smoothstep(0.0, 0.7, n1 * n2) * 0.22);',
        '  float glow = smoothstep(0.8, 0.0, dist) * 0.06;',
        '  col += u_colors[1] * glow;',
        '  col = mix(u_bg, col, max(vignette, 0.85));',
        '  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time);',
        '  col += (grain - 0.5) * u_grain * 0.1;',
        '  gl_FragColor = vec4(col, 1.0);',
        '}',
    ].join('\n');

    const hexToRgb = (hex) => {
        const h = hex.replace('#', '');
        return [
            parseInt(h.slice(0, 2), 16) / 255,
            parseInt(h.slice(2, 4), 16) / 255,
            parseInt(h.slice(4, 6), 16) / 255,
        ];
    };

    const compile = (gl, type, src) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    };

    const mount = (canvas) => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            canvas.remove();
            return;
        }

        const gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            powerPreference: 'low-power',
        });
        if (!gl) {
            canvas.remove();
            return;
        }

        const vert = compile(gl, gl.VERTEX_SHADER, VERT);
        const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        if (!vert || !frag) {
            canvas.remove();
            return;
        }

        const program = gl.createProgram();
        gl.attachShader(program, vert);
        gl.attachShader(program, frag);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            canvas.remove();
            return;
        }
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const pos = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(pos);
        gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

        const bg = hexToRgb(canvas.dataset.velarisBg || '#e9e3d6');
        const palette = (canvas.dataset.velarisColors || '#ddd6c8,#d4cdc0,#c4bfb3,#b7ae9e')
            .split(',')
            .map((c) => hexToRgb(c.trim()))
            .slice(0, 4);
        while (palette.length < 4) palette.push(bg);

        const speed = Number(canvas.dataset.velarisSpeed || '1.4');
        const grain = Number(canvas.dataset.velarisGrain || '0.35');
        const locRes = gl.getUniformLocation(program, 'u_resolution');
        const locTime = gl.getUniformLocation(program, 'u_time');
        const locGrain = gl.getUniformLocation(program, 'u_grain');
        const locBg = gl.getUniformLocation(program, 'u_bg');
        const locColors = [0, 1, 2, 3].map((i) => gl.getUniformLocation(program, 'u_colors[' + i + ']'));

        const parent = canvas.parentElement;
        if (!parent) return;

        const resize = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = parent.clientWidth;
            const h = parent.clientHeight;
            canvas.width = Math.max(1, Math.floor(w * dpr));
            canvas.height = Math.max(1, Math.floor(h * dpr));
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            gl.viewport(0, 0, canvas.width, canvas.height);
        };

        let raf = 0;
        let running = false;
        let visible = false;
        const render = (t) => {
            if (!running) return;
            gl.uniform2f(locRes, canvas.width, canvas.height);
            gl.uniform1f(locTime, t * 0.001 * speed);
            gl.uniform1f(locGrain, grain);
            gl.uniform3f(locBg, bg[0], bg[1], bg[2]);
            locColors.forEach((loc, i) => {
                const c = palette[i];
                gl.uniform3f(loc, c[0], c[1], c[2]);
            });
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            raf = requestAnimationFrame(render);
        };

        const start = () => {
            if (running || document.hidden || !visible) return;
            running = true;
            raf = requestAnimationFrame(render);
        };
        const stop = () => {
            running = false;
            cancelAnimationFrame(raf);
        };

        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(parent);

        const io = new IntersectionObserver(
            (entries) => {
                visible = entries.some((entry) => entry.isIntersecting);
                if (visible) start();
                else stop();
            },
            { threshold: 0.05 }
        );
        io.observe(parent);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stop();
            else start();
        });
    };

    const init = () => {
        document.querySelectorAll('[data-velaris]').forEach(mount);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
