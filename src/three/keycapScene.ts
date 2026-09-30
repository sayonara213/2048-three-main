import * as THREE from 'three'
import type { Direction, Tile } from '../game'
import { RGB, tileStyle } from '../effects/tileColors'

// World units, as in the portfolio keyboard: one key pitch = 1.08.
const PITCH = 1.08
const CAP = 0.8
const CAP_TOP = 0.3
const REST_Z = 0.32

// Timings in seconds, matched to the DOM board's 110ms slides.
const SLIDE = 0.13
const DROP = 0.38
const FLIP = 0.32
const LEAVE = 0.22

const GREY = new THREE.Color('#3a3a3f') // cap-grey: every cap greys out on game over
/** Resting pose: tipped back like a keyboard on a desk. */
const BASE_RX = -0.3

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const easeMove = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) // power2.inOut
const easeOut = (t: number) => 1 - (1 - t) ** 3
const easePop = (t: number) => 1 + 1.7 * (t - 1) ** 3 + 0.7 * (t - 1) ** 2 // back.out(0.7)
const now = () => performance.now() / 1000

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}

/**
 * Sculpted keycap from the portfolio: a rounded, bevelled extrusion with the top tapered to 86%,
 * and vertex colours that darken the skirt toward the plate (baked ambient occlusion).
 */
function capGeometry() {
  const g = new THREE.ExtrudeGeometry(roundedRect(CAP, CAP, 0.16), {
    depth: 0.4,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.07,
    bevelSegments: 6,
    curveSegments: 10,
  })
  const p = g.attributes.position!
  const zMin = -0.1
  const zMax = 0.5
  const col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const t = (p.getZ(i) - zMin) / (zMax - zMin)
    const f = 1 - 0.14 * t
    p.setX(i, p.getX(i) * f)
    p.setY(i, p.getY(i) * f)
    const ao = 0.38 + 0.62 * smooth(clamp01(t / 0.8))
    col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = ao
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.translate(0, 0, -0.2) // pivot at the cap's centre so it scales in place
  return g
}

interface Cap {
  id: number
  value: number
  pivot: THREE.Group
  mesh: THREE.Mesh
  mat: THREE.MeshPhysicalMaterial
  legendMat: THREE.MeshStandardMaterial
  base: THREE.Color
  /** Backlight spilling onto the plate around the cap. */
  light: THREE.Mesh
  lightMat: THREE.MeshBasicMaterial
  from: THREE.Vector2
  to: THREE.Vector2
  slideAt: number
  /** Hidden until then (a merge result waits for its sources to arrive). */
  showAt: number
  dropAt: number
  flipAt: number
  leaveAt: number
  /** Fired the merge or spawn callback for this cap already. */
  announced: boolean
  hover: number
}

export interface SceneOptions {
  size: number
  reducedMotion: boolean
  /** CSS font-family for legends (the loaded Unbounded face). */
  legendFont: string
  /** Viewport rect the board should fill; read every frame so it follows layout and scroll. */
  slot: () => DOMRect | null
  onMerge?: (x: number, y: number, value: number) => void
  onSpawn?: (x: number, y: number) => void
}

/**
 * The 2048 board as the portfolio's keyboard: a satin case and plate, one sculpted keycap per tile,
 * soft studio lighting, a faint starfield and a dim RGB rim. Tiles slide across a plain plate, new ones drop in, and
 * merges press the cap in like a keystroke. The whole object tilts toward the pointer and
 * leans into each move. Decorative only: the DOM table carries the game for assistive tech.
 */
export class KeycapScene {
  private renderer: THREE.WebGLRenderer
  private camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  private scene = new THREE.Scene()
  private board = new THREE.Group()
  private sun: THREE.DirectionalLight
  private rimMat: THREE.ShaderMaterial
  private stars: THREE.Points
  private capGeo = capGeometry()
  private legendGeo = new THREE.PlaneGeometry(0.62, 0.62)
  private lightGeo = new THREE.PlaneGeometry(PITCH * 1.15, PITCH * 1.15)
  private lightTex: THREE.Texture
  private caps = new Map<number, Cap>()
  private legends = new Map<number, THREE.Texture>()
  private synced = false
  private caseW: number
  private caseH: number

  private w = 1
  private h = 1
  private ndc = new THREE.Vector2(9, 9)
  private pointerType = 'mouse'
  private par = new THREE.Vector2()
  /** Lean from the last move: a damped spring per axis. */
  private lean = { x: 0, y: 0, vx: 0, vy: 0 }
  private glow = 0.35
  private glowPulse = 0
  private grey = 0
  private over = false
  private won = false
  private hovered: Cap | null = null
  private ray = new THREE.Raycaster()
  private raf = 0
  private last = now()
  private disposables: { dispose(): void }[] = []

  constructor(
    canvas: HTMLCanvasElement,
    private opts: SceneOptions,
  ) {
    const lite = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }))
    r.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.5 : 2))
    r.toneMapping = THREE.NeutralToneMapping
    r.toneMappingExposure = 1.05
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    this.camera.position.set(0, 0, 18)
    this.resize()

    this.caseW = opts.size * PITCH + 0.62
    this.caseH = opts.size * PITCH + 0.62

    this.buildEnvironment()
    this.scene.add(new THREE.HemisphereLight(0xf4f6ff, 0x0a0a0c, 0.3 * Math.PI))
    const sun = (this.sun = new THREE.DirectionalLight(0xfff8f0, 1.0 * Math.PI))
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(lite ? 1024 : 2048)
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 50 })
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.025
    sun.shadow.radius = 5
    this.scene.add(sun, sun.target)
    const rim = new THREE.DirectionalLight(0xdfe3ea, 0.45 * Math.PI)
    rim.position.set(-8, 4, -8)
    this.scene.add(rim)

    this.scene.add(this.board)
    this.buildCase()
    this.rimMat = this.buildRim()
    this.stars = this.buildStars()
    this.lightTex = this.backlightTexture()
  }

  /** Dark room with soft boxes, prefiltered for reflections: what stops the caps reading flat. */
  private buildEnvironment() {
    const env = new THREE.Scene()
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x0c0c0e, side: THREE.BackSide })))
    const former = (geo: THREE.BufferGeometry, pos: [number, number, number], strength: number, hex = 0xffffff) => {
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(strength), side: THREE.DoubleSide }),
      )
      m.position.set(...pos)
      m.lookAt(0, 0, 0)
      env.add(m)
    }
    const box = (w: number, h: number, pos: [number, number, number], strength: number, hex?: number) =>
      former(new THREE.PlaneGeometry(w, h), pos, strength, hex)
    box(12, 3.5, [0, 10, 6], 3.4)
    box(4, 10, [-11, 2, 4], 1.1, 0xe6ebff)
    box(4, 10, [11, 0, 5], 0.9, 0xfff0e4)
    box(16, 2, [0, -6, 10], 0.35)
    box(18, 0.45, [0, 4, 11], 4)
    box(0.4, 12, [-8, 3, 9], 3, 0xe6ebff)
    box(0.4, 12, [8, 3, 9], 2.5, 0xfff0e4)
    box(12, 0.8, [0, 6, -10], 1.6)
    former(new THREE.RingGeometry(2.2, 2.6, 64), [0, 8, 9], 2.6)
    const pm = new THREE.PMREMGenerator(this.renderer)
    const rt = pm.fromScene(env, 0.01)
    this.scene.environment = rt.texture
    this.disposables.push(rt)
    pm.dispose()
    env.traverse((o) => {
      const m = o as THREE.Mesh
      m.geometry?.dispose()
      ;(m.material as THREE.Material | undefined)?.dispose()
    })
  }

  private buildCase() {
    const { caseW, caseH, opts } = this
    const caseMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRect(caseW, caseH, 0.42), {
        depth: 0.5,
        bevelEnabled: true,
        bevelThickness: 0.08,
        bevelSize: 0.08,
        bevelSegments: 6,
        curveSegments: 12,
      }),
      new THREE.MeshStandardMaterial({ color: 0x5a5d64, roughness: 0.42, metalness: 0.55, envMapIntensity: 0.9 }),
    )
    caseMesh.position.z = -0.58
    caseMesh.castShadow = caseMesh.receiveShadow = true
    this.board.add(caseMesh)

    const plate = new THREE.Mesh(
      new THREE.ShapeGeometry(roundedRect(opts.size * PITCH + 0.06, opts.size * PITCH + 0.06, 0.2)),
      new THREE.MeshStandardMaterial({ color: 0x2c2e33, roughness: 0.78, metalness: 0.15, envMapIntensity: 0.5 }),
    )
    plate.position.z = 0.005
    plate.receiveShadow = true
    this.board.add(plate)

    // Soft drop shadow behind the case. shadowBlur works everywhere; ctx.filter does not in Safari.
    const c = document.createElement('canvas')
    c.width = c.height = 384
    const g = c.getContext('2d')!
    g.shadowColor = 'rgba(0,0,0,1)'
    g.shadowBlur = 36
    g.shadowOffsetX = 1000
    g.fillStyle = '#000'
    g.fillRect(70 - 1000, 70, 244, 244)
    const dropTex = new THREE.CanvasTexture(c)
    this.disposables.push(dropTex)
    const drop = new THREE.Mesh(
      new THREE.PlaneGeometry(caseW + 2.6, caseH + 2.6),
      new THREE.MeshBasicMaterial({ map: dropTex, transparent: true, opacity: 0.9, depthWrite: false }),
    )
    drop.position.set(0, -0.35, -0.7)
    this.board.add(drop)
  }

  /** Thin RGB light hugging the case edge. Adds light without writing alpha, so no halo over the page. */
  private buildRim() {
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: 0 },
        uGrey: { value: 0 },
        uSize: { value: new THREE.Vector2(this.caseW + 2, this.caseH + 2) },
        uHalf: { value: new THREE.Vector2(this.caseW / 2, this.caseH / 2) },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime,uGlow,uGrey; uniform vec2 uSize,uHalf; varying vec2 vUv;
        vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){
          vec2 p=(vUv-.5)*uSize; vec2 q=abs(p)-uHalf+.42;
          float d=length(max(q,0.))+min(max(q.x,q.y),0.)-.42;
          float a=exp(-max(d,0.)*4.5)*smoothstep(-.12,.02,d);
          vec2 e=abs(vUv-.5); a*=smoothstep(.5,.4,max(e.x,e.y));
          float ang=atan(p.y,p.x)/6.2831853+uTime*.05;
          vec3 c=mix(hue(ang),vec3(.55),uGrey);
          gl_FragColor=vec4(c,a*uGlow);
        }`,
    })
    const rim = new THREE.Mesh(new THREE.PlaneGeometry(this.caseW + 2, this.caseH + 2), mat)
    rim.position.z = -0.62
    this.board.add(rim)
    return mat
  }

  private buildStars() {
    const n = 320
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 44
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30
      pos[i * 3 + 2] = -Math.random() * 18 - 2
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9a9aa0, size: 0.035, transparent: true, opacity: 0.25, depthWrite: false }))
    this.scene.add(stars)
    return stars
  }

  private backlightTexture() {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.45, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    this.disposables.push(t)
    return t
  }

  private cell(row: number, col: number) {
    const n = this.opts.size
    return new THREE.Vector2((col - (n - 1) / 2) * PITCH, ((n - 1) / 2 - row) * PITCH)
  }

  private legendTex(value: number) {
    let t = this.legends.get(value)
    if (t) return t
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const g = c.getContext('2d')!
    const style = tileStyle(value)
    const text = String(value)
    // Shrink long numbers to fit the cap's top face.
    g.font = `700 150px ${this.opts.legendFont}, system-ui, sans-serif`
    const px = Math.min(150, Math.floor((150 * 200) / g.measureText(text).width))
    g.font = `700 ${px}px ${this.opts.legendFont}, system-ui, sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    if (style.rainbow) {
      const w = g.measureText(text).width
      const grad = g.createLinearGradient(128 - w / 2, 0, 128 + w / 2, 0)
      RGB.forEach((hex, i) => grad.addColorStop(i / (RGB.length - 1), `#${hex.toString(16).padStart(6, '0')}`))
      g.fillStyle = grad
    } else {
      g.fillStyle = style.fg
    }
    g.fillText(text, 128, 136)
    t = new THREE.CanvasTexture(c)
    t.anisotropy = 8
    t.colorSpace = THREE.SRGBColorSpace
    this.legends.set(value, t)
    return t
  }

  /** Call once the display font has loaded, so legends render in Unbounded. */
  fontsLoaded() {
    this.legends.forEach((t) => t.dispose())
    this.legends.clear()
    for (const c of this.caps.values()) {
      c.legendMat.map = this.legendTex(c.value)
      c.legendMat.needsUpdate = true
    }
  }

  private makeCap(id: number, value: number, at: THREE.Vector2): Cap {
    const style = tileStyle(value)
    const base = new THREE.Color(style.bg)
    const hsl = { h: 0, s: 0, l: 0 }
    base.getHSL(hsl)
    base.setHSL(hsl.h, hsl.s * 0.78, hsl.l * 0.94)
    const mat = new THREE.MeshPhysicalMaterial({
      color: base.clone(),
      vertexColors: true,
      roughness: 0.55,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.08,
      envMapIntensity: 0.8,
    })
    const pivot = new THREE.Group()
    const mesh = new THREE.Mesh(this.capGeo, mat)
    mesh.castShadow = mesh.receiveShadow = true
    pivot.add(mesh)
    const legendMat = new THREE.MeshStandardMaterial({
      map: this.legendTex(value),
      transparent: true,
      roughness: 0.7,
      envMapIntensity: 0.3,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      depthWrite: false,
    })
    const legend = new THREE.Mesh(this.legendGeo, legendMat)
    legend.position.z = CAP_TOP + 0.004
    pivot.add(legend)
    pivot.position.set(at.x, at.y, REST_Z)
    this.board.add(pivot)

    const lightMat = new THREE.MeshBasicMaterial({
      map: this.lightTex,
      color: style.glow,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const light = new THREE.Mesh(this.lightGeo, lightMat)
    light.position.set(at.x, at.y, 0.012)
    this.board.add(light)

    const cap: Cap = {
      id,
      value,
      pivot,
      mesh,
      mat,
      legendMat,
      base,
      light,
      lightMat,
      from: at.clone(),
      to: at.clone(),
      slideAt: 0,
      showAt: 0,
      dropAt: -1,
      flipAt: -1,
      leaveAt: -1,
      announced: true,
      hover: 0,
    }
    mesh.userData.cap = cap
    this.caps.set(id, cap)
    return cap
  }

  private removeCap(c: Cap) {
    this.board.remove(c.pivot, c.light)
    c.mat.dispose()
    c.legendMat.dispose()
    c.lightMat.dispose()
    this.caps.delete(c.id)
    if (this.hovered === c) this.hovered = null
  }

  private slideTo(c: Cap, to: THREE.Vector2, t: number) {
    if (c.to.equals(to)) return
    c.from.copy(this.capXY(c, t))
    c.to.copy(to)
    c.slideAt = t
  }

  private capXY(c: Cap, t: number) {
    const p = this.opts.reducedMotion ? 1 : easeMove(clamp01((t - c.slideAt) / SLIDE))
    return c.from.clone().lerp(c.to, p)
  }

  /** Brings the caps in line with the game's tiles, animating slides, spawns and merges. */
  sync(tiles: readonly Tile[]) {
    const t = now()
    const first = !this.synced
    this.synced = true
    const keep = new Set<number>()
    for (const tile of tiles) {
      keep.add(tile.id)
      const at = this.cell(tile.row, tile.col)
      let c = this.caps.get(tile.id)
      if (c) {
        this.slideTo(c, at, t)
        continue
      }
      // Merge sources slide into the merge cell, then go.
      for (const src of tile.mergedFrom ?? []) {
        const g = this.caps.get(src)
        if (!g || first) continue
        keep.add(src)
        this.slideTo(g, at, t)
        g.leaveAt = t + SLIDE
      }
      c = this.makeCap(tile.id, tile.value, at)
      if (first) {
        // Opening drop, staggered from the centre like the portfolio's grids.
        const n = this.opts.size
        const d = Math.hypot(tile.row - (n - 1) / 2, tile.col - (n - 1) / 2)
        c.dropAt = t + 0.15 + d * 0.06
        c.announced = true
      } else if (tile.mergedFrom) {
        c.showAt = c.flipAt = t + SLIDE * 0.9
        c.announced = false
      } else {
        c.showAt = c.dropAt = t + SLIDE
        c.announced = false
      }
    }
    for (const c of [...this.caps.values()]) {
      if (keep.has(c.id) || c.leaveAt >= 0) continue
      c.leaveAt = t // new game: sink the old caps away
    }
  }

  /** Leans the board into a move, or gives it a short shake when nothing could move. */
  nudge(direction: Direction, moved: boolean) {
    if (this.opts.reducedMotion) return
    const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0
    const dy = direction === 'up' ? 1 : direction === 'down' ? -1 : 0
    const k = moved ? 1.6 : 2.4
    this.lean.vy += dx * k
    this.lean.vx -= dy * k
    if (!moved) this.glowPulse = Math.max(this.glowPulse, 0.15)
  }

  setStatus(over: boolean, won: boolean) {
    this.over = over
    this.won = won
  }

  setReducedMotion(reduced: boolean) {
    this.opts.reducedMotion = reduced
  }

  setPointer(clientX: number, clientY: number, pointerType: string) {
    this.pointerType = pointerType
    this.ndc.set((clientX / this.w) * 2 - 1, -(clientY / this.h) * 2 + 1)
  }

  clearPointer() {
    this.ndc.set(9, 9)
  }

  resize() {
    const el = this.renderer.domElement
    const w = el.clientWidth || window.innerWidth
    const h = el.clientHeight || window.innerHeight
    if (w === this.w && h === this.h) return
    this.w = w
    this.h = h
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  start() {
    const loop = () => {
      this.frame()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  /** Viewport position of a point on the board, for the Pixi particle layer. */
  private toScreen(obj: THREE.Object3D) {
    const v = new THREE.Vector3()
    obj.getWorldPosition(v).project(this.camera)
    return { x: ((v.x + 1) / 2) * this.w, y: ((1 - v.y) / 2) * this.h }
  }

  /** Fits the board into the slot's viewport rect. */
  private fit() {
    const rect = this.opts.slot()
    const vh = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))
    const vw = vh * this.camera.aspect
    if (!rect || rect.width === 0) return { x: 0, y: 0, s: 1 }
    const cx = ((rect.left + rect.width / 2) / this.w - 0.5) * vw
    const cy = (0.5 - (rect.top + rect.height / 2) / this.h) * vh
    const sw = (rect.width / this.w) * vw
    const sh = (rect.height / this.h) * vh
    const s = Math.min(sw / this.caseW, sh / (this.caseH * Math.cos(BASE_RX))) * 0.92
    return { x: cx, y: cy, s }
  }

  private frame() {
    const t = now()
    const dt = Math.min(0.05, t - this.last)
    this.last = t
    const reduced = this.opts.reducedMotion
    const m = reduced ? 0 : 1

    // Pointer parallax on desktop: the board tilts to follow the cursor.
    const desk = window.innerWidth >= 768 && this.pointerType !== 'touch' && this.ndc.x < 2
    this.par.x += ((desk ? this.ndc.x : 0) - this.par.x) * 0.06
    this.par.y += ((desk ? this.ndc.y : 0) - this.par.y) * 0.06

    // Lean spring.
    const L = this.lean
    L.vx += (-90 * L.x - 14 * L.vx) * dt
    L.vy += (-90 * L.y - 14 * L.vy) * dt
    L.x += L.vx * dt
    L.y += L.vy * dt
    if (reduced) L.x = L.y = L.vx = L.vy = 0

    const fit = this.fit()
    const b = this.board
    b.position.set(fit.x, fit.y + Math.sin(t * 0.9) * 0.05 * fit.s * m, 0)
    b.rotation.set(BASE_RX + (-this.par.y * 0.14 + L.x * 0.6) * m, (this.par.x * 0.2 + L.y * 0.6) * m, 0)
    b.scale.setScalar(fit.s)
    this.sun.position.set(b.position.x + 3, b.position.y + 9, b.position.z + 11)
    this.sun.target.position.copy(b.position)

    this.grey += ((this.over ? 1 : 0) - this.grey) * (reduced ? 1 : 0.06)
    this.glowPulse *= 0.94
    const glowTarget = this.over ? 0.06 : this.won ? 0.6 : 0.2
    this.glow += (glowTarget - this.glow) * 0.05
    const u = this.rimMat.uniforms
    u.uTime!.value = t * m
    u.uGlow!.value = Math.min(0.8, this.glow + this.glowPulse)
    u.uGrey!.value = this.grey
    this.stars.rotation.y = t * 0.004 * m

    // Hover lift, mouse only.
    let hk: Cap | null = null
    if (desk) {
      this.ray.setFromCamera(this.ndc, this.camera)
      const meshes = [...this.caps.values()].filter((c) => c.leaveAt < 0).map((c) => c.mesh)
      hk = (this.ray.intersectObjects(meshes, false)[0]?.object.userData.cap as Cap | undefined) ?? null
    }
    this.hovered = hk

    for (const c of [...this.caps.values()]) {
      const xy = this.capXY(c, t)
      let z = REST_Z
      let scale = 1
      let visible = t >= c.showAt || reduced

      if (c.dropAt >= 0 && !reduced) {
        const p = clamp01((t - c.dropAt) / DROP)
        z += (1 - easePop(p)) * 1.1
        scale = 0.9 + 0.1 * easeOut(p)
        visible = t >= c.dropAt
      }
      if (c.flipAt >= 0 && !reduced) {
        const p = clamp01((t - c.flipAt) / FLIP)
        z += p < 0.3 ? -Math.sin((p / 0.3) * Math.PI * 0.5) * 0.12 : -0.12 + easePop((p - 0.3) / 0.7) * 0.12
        scale *= 1 + Math.sin(p * Math.PI) * 0.05
      }
      if (!c.announced && t >= c.showAt) {
        c.announced = true
        if (!reduced) {
          const pos = this.toScreen(c.pivot)
          if (c.flipAt >= 0) {
            this.opts.onMerge?.(pos.x, pos.y, c.value)
            this.glowPulse = Math.max(this.glowPulse, Math.min(0.4, Math.log2(c.value) * 0.035))
          } else this.opts.onSpawn?.(pos.x, pos.y)
        }
      }
      if (c.leaveAt >= 0 && t >= c.leaveAt) {
        const p = reduced ? 1 : clamp01((t - c.leaveAt) / LEAVE)
        if (p >= 1) {
          this.removeCap(c)
          continue
        }
        z -= p * 0.3
        scale *= 1 - p * 0.4
      }

      c.hover += ((c === hk ? 1 : 0) - c.hover) * 0.2
      z += c.hover * 0.14 * m - this.grey * 0.12

      c.pivot.visible = visible
      c.pivot.position.set(xy.x, xy.y, z)
      c.pivot.scale.setScalar(scale)
      c.mat.color.copy(c.base).lerp(GREY, this.grey * 0.9)
      c.legendMat.opacity = 1 - this.grey * 0.6

      // Backlight: strongest when the cap sits on the plate, fading as it lifts.
      c.light.position.set(xy.x, xy.y, 0.012)
      const lift = clamp01((z - REST_Z) / 1.2)
      let glow = visible ? 0.14 * (1 - lift) * (1 - this.grey) : 0
      if (tileStyle(c.value).rainbow) {
        const h = (t * 0.08 * m + (xy.x + xy.y) * 0.05) % 1
        c.lightMat.color.setHSL(h, 0.7, 0.55)
        glow *= 1.6
      }
      c.lightMat.opacity = glow
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    for (const c of [...this.caps.values()]) this.removeCap(c)
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
      else mat?.dispose()
    })
    this.capGeo.dispose()
    this.legendGeo.dispose()
    this.lightGeo.dispose()
    this.legends.forEach((t) => t.dispose())
    this.disposables.forEach((d) => d.dispose())
    this.renderer.dispose()
  }
}
