import { useEffect, useRef, memo } from 'react';
import './DotField.css';

const TWO_PI = Math.PI * 2;

const DotField = memo(({
  dotRadius = 1.5,
  dotSpacing = 14,
  cursorRadius = 500,
  cursorForce = 0.1,
  bulgeOnly = true,
  bulgeStrength = 67,
  glowRadius = 160,
  sparkle = false,
  waveAmplitude = 0,
  gradientFrom = 'rgba(0, 255, 102, 0.15)',
  gradientTo = 'rgba(3, 3, 5, 0)',
  glowColor = 'rgba(0, 255, 102, 0.03)',
  className = '',
  ...rest
}) => {
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0));

  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const glowRef = useRef(null);
  const dotsRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999, speed: 0 });
  const rafRef = useRef(null);
  const sizeRef = useRef({ w: 0, h: 0, offsetX: 0, offsetY: 0 });
  const glowOpacity = useRef(0);
  const engagement = useRef(0);
  const propsRef = useRef({});
  propsRef.current = { dotRadius, dotSpacing, cursorRadius, cursorForce, bulgeOnly, bulgeStrength, sparkle, waveAmplitude, gradientFrom, gradientTo };
  const rebuildRef = useRef(null);
  const glowIdRef = useRef(`dot-field-glow-${Math.random().toString(36).slice(2, 9)}`);

  useEffect(() => {
    if (isMobile) {
      return undefined;
    }

    const canvas = canvasRef.current;
    const glowEl = glowRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let resizeTimer;

    function resize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    }

    function doResize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      sizeRef.current = {
        w,
        h,
        offsetX: rect.left + window.scrollX,
        offsetY: rect.top + window.scrollY,
      };

      buildDots(w, h);
    }

    function buildDots(w, h) {
      const p = propsRef.current;
      const step = p.dotRadius + p.dotSpacing;
      const cols = Math.floor(w / step);
      const rows = Math.floor(h / step);
      const gridW = cols * step;
      const gridH = rows * step;
      const padX = (w - gridW) / 2;
      const padY = (h - gridH) / 2;

      const total = cols * rows;
      const dots = new Array(total);
      let idx = 0;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2;
          const ay = padY + row * step + step / 2;
          dots[idx++] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
        }
      }
      dotsRef.current = dots;
    }

    function onMouseMove(e) {
      const s = sizeRef.current;
      const m = mouseRef.current;
      const nextX = e.pageX - s.offsetX;
      const nextY = e.pageY - s.offsetY;
      const dx = nextX - m.x;
      const dy = nextY - m.y;
      m.speed = Math.min(Math.sqrt(dx * dx + dy * dy), 20);
      m.x = nextX;
      m.y = nextY;
    }

    let frameCount = 0;

    function tick() {
      if (document.hidden) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      frameCount++;
      const dots = dotsRef.current;
      const m = mouseRef.current;
      const { w, h } = sizeRef.current;
      const p = propsRef.current;
      const len = dots.length;
      const t = frameCount * 0.02;

      m.speed *= 0.92;
      if (m.speed < 0.01) m.speed = 0;

      const targetEngagement = Math.min(m.speed / 5, 1);
      engagement.current += (targetEngagement - engagement.current) * 0.06;
      if (engagement.current < 0.001) engagement.current = 0;
      const eng = engagement.current;

      glowOpacity.current += (eng - glowOpacity.current) * 0.08;

      if (glowEl) {
        glowEl.setAttribute('cx', m.x);
        glowEl.setAttribute('cy', m.y);
        glowEl.style.opacity = glowOpacity.current;
      }

      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, p.gradientFrom);
      grad.addColorStop(1, p.gradientTo);
      ctx.fillStyle = grad;

      const cr = p.cursorRadius;
      const crSq = cr * cr;
      const bs = p.bulgeStrength * eng;
      const rad = p.dotRadius;

      ctx.beginPath();

      for (let i = 0; i < len; i++) {
        const d = dots[i];
        const dx = d.ax - m.x;
        const dy = d.ay - m.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < crSq && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const norm = dist / cr;
          const factor = Math.cos(norm * Math.PI * 0.5);
          const disp = factor * bs;
          const nx = dx / dist;
          const ny = dy / dist;
          d.sx = d.ax + nx * disp;
          d.sy = d.ay + ny * disp;
        } else {
          d.sx = d.ax;
          d.sy = d.ay;
        }

        let drawX = d.sx;
        let drawY = d.sy;
        if (p.waveAmplitude > 0) {
          drawY += Math.sin(d.ax * 0.03 + t) * p.waveAmplitude;
          drawX += Math.cos(d.ay * 0.03 + t * 0.7) * p.waveAmplitude * 0.5;
        }

        ctx.moveTo(drawX + rad, drawY);
        ctx.arc(drawX, drawY, rad, 0, TWO_PI);
      }

      ctx.fill();
      rafRef.current = requestAnimationFrame(tick);
    }

    doResize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    rafRef.current = requestAnimationFrame(tick);

    rebuildRef.current = () => {
      const { w, h } = sizeRef.current;
      if (w > 0 && h > 0) buildDots(w, h);
    };

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [isMobile]);

  useEffect(() => {
    rebuildRef.current?.();
  }, [dotRadius, dotSpacing]);

  if (isMobile) {
    return (
      <div
        className={`dot-field-container ${className}`}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(rgba(40, 114, 161, 0.28) 1.5px, transparent 1.5px)',
          backgroundSize: '16px 16px',
          opacity: 0.75,
          pointerEvents: 'none'
        }}
        {...rest}
      />
    );
  }

  return (
    <div className={`dot-field-container ${className}`} {...rest}>
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <svg ref={svgRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <radialGradient id={glowIdRef.current}>
            <stop offset="0%" stopColor={glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle ref={glowRef} cx="-9999" cy="-9999" r={glowRadius} fill={`url(#${glowIdRef.current})`} style={{ opacity: 0, willChange: 'opacity' }} />
      </svg>
    </div>
  );
});

DotField.displayName = 'DotField';
export default DotField;
