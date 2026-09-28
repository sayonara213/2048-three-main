import { useEffect, useRef } from 'react';
import { Application, Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { fxBus, type FxEvent } from './fxBus';
import { RGB, tileStyle } from './tileColors';
import { useEffects } from './useEffects';

interface Particle {
  sprite: Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  gravity: number;
  spin: number;
  drag: number;
  grow: number;
}

const MAX_PARTICLES = 700;

/**
 * Full-screen decorative PixiJS canvas in front of the UI for particle bursts
 * driven by `fxBus`: sparks on merges, a puff on spawns and RGB confetti on a
 * win. The page's depth (stars, glow) lives in the 3D keyboard scene. The
 * canvas is aria-hidden, ignores pointer input, stays idle under reduced
 * motion and pauses while the tab is hidden.
 */
export function PixiStage() {
  const host = useRef<HTMLDivElement>(null);
  const { reduced } = useEffects();
  const reducedRef = useRef(reduced);
  const appRef = useRef<Application | null>(null);
  const clearParticlesRef = useRef<() => void>(() => {});

  useEffect(() => {
    let destroyed = false;
    let ready = false;
    const app = new Application();
    const cleanups: (() => void)[] = [];

    (async () => {
      try {
        await app.init({
          resizeTo: window,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preference: 'webgl',
        });
      } catch {
        // No WebGL/canvas (old browser, test env): the effects are decorative, so skip them.
        return;
      }
      if (destroyed) {
        app.destroy(true, { children: true, texture: true });
        return;
      }
      ready = true;
      appRef.current = app;
      host.current?.appendChild(app.canvas);

      // Sparks are light leaking from the keys, so they add.
      const fx = new Container();
      fx.blendMode = 'add';
      app.stage.addChild(fx);

      const dot = app.renderer.generateTexture(new Graphics().circle(0, 0, 8).fill(0xffffff));
      const ring = app.renderer.generateTexture(new Graphics().circle(0, 0, 32).stroke({ width: 3, color: 0xffffff }));
      const rect = app.renderer.generateTexture(new Graphics().rect(0, 0, 8, 4).fill(0xffffff));

      const particles: Particle[] = [];
      const spawn = (tex: Texture, x: number, y: number, tint: number, opts: Partial<Particle> & { angle: number; speed: number; scale: number }) => {
        if (particles.length >= MAX_PARTICLES) return;
        const s = new Sprite(tex);
        s.anchor.set(0.5);
        s.position.set(x, y);
        s.tint = tint;
        s.scale.set(opts.scale);
        s.rotation = Math.random() * Math.PI * 2;
        fx.addChild(s);
        particles.push({
          sprite: s,
          vx: Math.cos(opts.angle) * opts.speed,
          vy: Math.sin(opts.angle) * opts.speed,
          life: 0,
          maxLife: opts.maxLife ?? 700,
          gravity: opts.gravity ?? 0,
          spin: opts.spin ?? 0,
          drag: opts.drag ?? 0.985,
          grow: opts.grow ?? 0,
        });
      };

      clearParticlesRef.current = () => {
        particles.forEach((p) => p.sprite.destroy());
        particles.length = 0;
      };

      const handle = (e: FxEvent) => {
        if (reducedRef.current) return;
        switch (e.type) {
          case 'merge': {
            const style = tileStyle(e.value);
            const color = (i: number) => (style.rainbow ? RGB[i % RGB.length]! : style.glow);
            const power = Math.log2(e.value);
            const n = Math.min(10 + power * 4, 60);
            for (let i = 0; i < n; i++) {
              spawn(dot, e.x, e.y, color(i), {
                angle: Math.random() * Math.PI * 2,
                speed: 1.5 + Math.random() * (1.5 + power * 0.35),
                scale: 0.22 + Math.random() * 0.4,
                maxLife: 450 + Math.random() * 450,
                gravity: 0.03,
              });
            }
            spawn(ring, e.x, e.y, color(0), { angle: 0, speed: 0, scale: 0.4, maxLife: 420, grow: 0.045, drag: 1 });
            if (e.value >= 256) spawn(ring, e.x, e.y, 0xf3f3f4, { angle: 0, speed: 0, scale: 0.2, maxLife: 600, grow: 0.07, drag: 1 });
            break;
          }
          case 'spawn':
            for (let i = 0; i < 8; i++) {
              spawn(dot, e.x, e.y, 0xf3f3f4, { angle: (i / 8) * Math.PI * 2, speed: 1.2, scale: 0.16, maxLife: 320, drag: 0.93 });
            }
            break;
          case 'win':
            for (let i = 0; i < 220; i++) {
              spawn(rect, e.x, e.y, RGB[i % RGB.length]!, {
                angle: -Math.PI / 2 + (Math.random() - 0.5) * 2.2,
                speed: 6 + Math.random() * 10,
                scale: 0.9 + Math.random() * 0.9,
                maxLife: 2200 + Math.random() * 1200,
                gravity: 0.16,
                spin: (Math.random() - 0.5) * 0.4,
                drag: 0.985,
              });
            }
            break;
          default:
            break;
        }
      };
      cleanups.push(fxBus.on(handle));

      app.ticker.add((ticker) => {
        const dt = ticker.deltaMS;
        const f = ticker.deltaTime;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i]!;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.sprite.destroy();
            particles.splice(i, 1);
            continue;
          }
          p.vx *= Math.pow(p.drag, f);
          p.vy = p.vy * Math.pow(p.drag, f) + p.gravity * f;
          p.sprite.x += p.vx * f;
          p.sprite.y += p.vy * f;
          p.sprite.rotation += p.spin * f;
          if (p.grow) p.sprite.scale.set(p.sprite.scale.x + p.grow * f);
          p.sprite.alpha = 1 - p.life / p.maxLife;
        }
      });

      const onVisibility = () => applyReduced(app, reducedRef.current);
      document.addEventListener('visibilitychange', onVisibility);
      cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
      applyReduced(app, reducedRef.current);
    })();

    return () => {
      destroyed = true;
      cleanups.forEach((c) => c());
      if (ready) app.destroy(true, { children: true, texture: true });
      appRef.current = null;
    };
  }, []);

  // React to the reduced-motion preference changing at runtime.
  useEffect(() => {
    reducedRef.current = reduced;
    if (reduced) clearParticlesRef.current();
    if (appRef.current) applyReduced(appRef.current, reduced);
  }, [reduced]);

  return <div ref={host} aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }} />;
}

/** Runs the ticker only while motion is allowed and the tab is visible. */
function applyReduced(app: Application, reduced: boolean) {
  if (reduced || document.hidden) {
    app.ticker.stop();
    app.render(); // clear to an empty frame
  } else {
    app.ticker.start();
  }
}
