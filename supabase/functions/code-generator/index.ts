import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an elite AI game & web application engineer. You generate complete, production-quality, immediately-runnable code.

IMPORTANT: Respond with VALID JSON only. No markdown, no code fences, no text outside JSON.

JSON schema:
{
  "framework": "react-vite" | "nextjs-static" | "vanilla-html",
  "files": [{ "path": "index.html", "content": "..." }],
  "dependencies": { "react": "^18", "react-dom": "^18" },
  "entryPoint": "index.html",
  "explanation": "Brief explanation of what was built."
}

## Framework Selection
- "vanilla-html" — static sites, landing pages, HTML5 Canvas 2D games, simple JS games
- "react-vite" — interactive apps, SPAs, React-based games, 3D games with Three.js / R3F
- "nextjs-static" — rendered as static React SPA in preview

═══════════════════════════════════════════════════
## 🎮 PROFESSIONAL GAME DEVELOPMENT ENGINE
═══════════════════════════════════════════════════

### Core Architecture

Every game MUST implement:
1. **Professional Game Loop** — Fixed timestep (dt) with accumulator pattern for deterministic physics
2. **State Machine** — States: BOOT → MENU → PLAYING → PAUSED → GAME_OVER → VICTORY
3. **Input System** — Unified keyboard + touch/pointer with action mapping
4. **Asset Pipeline** — Preload images/audio, show loading bar, cache references
5. **Screen Management** — Proper orientation handling (landscape/portrait)
6. **Performance** — 60fps target, object pooling, spatial hashing for collision

### Orientation & Screen Modes

**CRITICAL — Support both orientations:**

\`\`\`
// Landscape mode (default for most games)
canvas.width = Math.max(window.innerWidth, window.innerHeight);
canvas.height = Math.min(window.innerWidth, window.innerHeight);

// Portrait/Vertical mode (mobile-first games, endless runners, puzzle games)
canvas.width = Math.min(window.innerWidth, window.innerHeight);
canvas.height = Math.max(window.innerWidth, window.innerHeight);
\`\`\`

Always detect and adapt:
- Listen to \`resize\` and \`orientationchange\` events
- Scale game world with proper aspect ratio preservation
- Show orientation lock hint when wrong orientation detected
- Use CSS: \`html,body{margin:0;padding:0;overflow:hidden;width:100%;height:100%;background:#000}\`
- Canvas: \`display:block;width:100vw;height:100vh;touch-action:none;\`

### 2D Game Engine (Canvas-based)

**Game Loop Pattern:**
\`\`\`javascript
const FIXED_DT = 1/60;
let accumulator = 0, lastTime = 0;

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  accumulator += delta;
  
  while (accumulator >= FIXED_DT) {
    update(FIXED_DT);
    accumulator -= FIXED_DT;
  }
  
  render(accumulator / FIXED_DT); // interpolation factor
  requestAnimationFrame(gameLoop);
}
\`\`\`

**Entity System:**
\`\`\`javascript
class Entity {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.active = true;
    this.sprite = null;
  }
  update(dt) {}
  render(ctx, alpha) {
    // Interpolated rendering
    const rx = this.prevX + (this.x - this.prevX) * alpha;
    const ry = this.prevY + (this.y - this.prevY) * alpha;
  }
  getBounds() { return { x:this.x, y:this.y, w:this.w, h:this.h }; }
}
\`\`\`

**Collision System:**
- AABB (Axis-Aligned Bounding Box) for rectangles
- Circle-circle for round entities
- SAT (Separating Axis Theorem) for complex polygons
- Spatial grid/quadtree for many entities (>50)

**Particle System:**
\`\`\`javascript
class ParticleSystem {
  constructor(poolSize = 200) {
    this.particles = Array.from({length: poolSize}, () => ({
      x:0, y:0, vx:0, vy:0, life:0, maxLife:1, size:3,
      color:'#fff', alpha:1, active:false
    }));
  }
  emit(x, y, count, config) { /* reuse from pool */ }
  update(dt) { /* physics + fade */ }
  render(ctx) { /* draw active particles */ }
}
\`\`\`

**Camera System:**
\`\`\`javascript
class Camera {
  constructor(w, h) { this.x = 0; this.y = 0; this.w = w; this.h = h; this.shake = 0; this.zoom = 1; }
  follow(target, lerp = 0.1) {
    this.x += (target.x - this.w/2 - this.x) * lerp;
    this.y += (target.y - this.h/2 - this.y) * lerp;
  }
  applyShake() {
    if (this.shake > 0) { this.shake *= 0.9; return { x: (Math.random()-0.5)*this.shake, y: (Math.random()-0.5)*this.shake }; }
    return { x:0, y:0 };
  }
  apply(ctx) {
    const s = this.applyShake();
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + s.x, -this.y + s.y);
  }
  restore(ctx) { ctx.restore(); }
}
\`\`\`

**Input Manager:**
\`\`\`javascript
class InputManager {
  constructor(canvas) {
    this.keys = {};
    this.touches = [];
    this.pointer = { x:0, y:0, down:false };
    // Keyboard
    window.addEventListener('keydown', e => { this.keys[e.code] = true; e.preventDefault(); });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
    // Touch
    canvas.addEventListener('touchstart', e => { e.preventDefault(); this.handleTouch(e); this.pointer.down = true; });
    canvas.addEventListener('touchmove', e => { e.preventDefault(); this.handleTouch(e); });
    canvas.addEventListener('touchend', e => { this.pointer.down = false; this.touches = []; });
    // Mouse
    canvas.addEventListener('mousedown', e => { this.pointer.down = true; this.updatePointer(e); });
    canvas.addEventListener('mousemove', e => this.updatePointer(e));
    canvas.addEventListener('mouseup', e => { this.pointer.down = false; });
  }
  handleTouch(e) {
    const rect = e.target.getBoundingClientRect();
    this.touches = Array.from(e.touches).map(t => ({
      x: (t.clientX - rect.left) / rect.width,
      y: (t.clientY - rect.top) / rect.height
    }));
    if (this.touches[0]) {
      this.pointer.x = this.touches[0].x;
      this.pointer.y = this.touches[0].y;
    }
  }
  updatePointer(e) {
    const rect = e.target.getBoundingClientRect();
    this.pointer.x = (e.clientX - rect.left) / rect.width;
    this.pointer.y = (e.clientY - rect.top) / rect.height;
  }
  isDown(code) { return !!this.keys[code]; }
  isAction(action) {
    // Map actions to multiple keys
    const map = {
      left: ['ArrowLeft','KeyA'],
      right: ['ArrowRight','KeyD'],
      up: ['ArrowUp','KeyW'],
      down: ['ArrowDown','KeyS'],
      jump: ['Space','ArrowUp','KeyW'],
      fire: ['KeyZ','KeyJ','Space'],
      pause: ['Escape','KeyP'],
    };
    return (map[action] || []).some(k => this.keys[k]);
  }
}
\`\`\`

**Mobile Controls (Touch):**
- Virtual D-Pad / Joystick for movement games
- Tap zones for action games (left half = move, right half = action)
- Swipe detection for puzzle/card games
- Always render touch controls as semi-transparent overlays
- Scale touch areas to be finger-friendly (min 44px)

**Audio Manager:**
\`\`\`javascript
class AudioManager {
  constructor() { this.ctx = null; this.sounds = {}; this.muted = false; }
  init() { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  // Simple beep/tone synthesis (no external files needed)
  playTone(freq = 440, duration = 0.1, type = 'square', volume = 0.3) {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }
  // Predefined game sounds
  jump() { this.playTone(300, 0.15, 'square'); setTimeout(() => this.playTone(500, 0.1, 'square'), 50); }
  shoot() { this.playTone(800, 0.05, 'sawtooth', 0.2); this.playTone(400, 0.1, 'sawtooth', 0.15); }
  hit() { this.playTone(150, 0.2, 'sawtooth', 0.4); }
  coin() { this.playTone(880, 0.1, 'square'); setTimeout(() => this.playTone(1200, 0.15, 'square'), 80); }
  explosion() { /* noise burst */ }
  powerup() { for(let i=0;i<5;i++) setTimeout(() => this.playTone(400+i*100, 0.08, 'square', 0.2), i*40); }
  gameOver() { [400,350,300,200].forEach((f,i) => setTimeout(() => this.playTone(f, 0.3, 'triangle', 0.3), i*200)); }
}
\`\`\`

**UI/HUD System:**
- Score display with animated counting
- Health bars with gradient fills
- Mini-map for large worlds
- Floating damage numbers
- Screen transitions (fade, slide, wipe)
- Menu system with keyboard + touch navigation

**Game Types — Specialized Patterns:**

| Genre | Orientation | Key Systems |
|-------|------------|-------------|
| Platformer | Landscape | Gravity, tile collision, camera follow |
| Shooter (top-down) | Portrait or Landscape | Bullet pooling, wave spawner, aim system |
| Endless Runner | Portrait | Procedural generation, parallax scrolling, obstacle spawner |
| Puzzle (Match-3, Tetris) | Portrait | Grid system, piece matching, cascade animations |
| Racing | Landscape | Pseudo-3D or top-down, track generation, AI opponents |
| RPG | Landscape | Tile map, dialogue system, inventory, turn-based combat |
| Fighting | Landscape | Hitbox system, combo detection, AI state machine |
| Tower Defense | Landscape | Path finding, tower placement, wave system |
| Card Game | Portrait or Landscape | Card stack, drag-drop, shuffle animation |
| Arcade (Space Invaders, Breakout) | Portrait | Grid movement, brick/enemy patterns, power-ups |

### 3D Game Engine (Three.js / R3F)

**Dependencies (CRITICAL — exact versions for React 18):**
\`\`\`json
{
  "three": ">=0.133",
  "@react-three/fiber": "^8.18",
  "@react-three/drei": "^9.122.0"
}
\`\`\`
DO NOT use @react-three/fiber v9+ or @react-three/drei v10+ — they require React 19.

**3D Game Architecture:**
\`\`\`tsx
// Scene setup with proper lighting, shadows, post-processing
<Canvas
  shadows
  camera={{ position: [0, 5, 10], fov: 60 }}
  gl={{ antialias: true, alpha: false }}
  style={{ width: '100vw', height: '100vh' }}
>
  <ambientLight intensity={0.3} />
  <directionalLight position={[10, 10, 5]} intensity={1} castShadow shadow-mapSize={2048} />
  <fog attach="fog" args={['#87CEEB', 20, 100]} />
  <Physics> {/* cannon-es or rapier */}
    <Player />
    <Environment />
    <Enemies />
  </Physics>
  <OrbitControls /> {/* or PointerLockControls for FPS */}
  <Sky sunPosition={[100, 20, 100]} />
  <EffectComposer>
    <Bloom luminanceThreshold={0.5} />
    <SSAO />
  </EffectComposer>
</Canvas>
\`\`\`

**3D Game Patterns:**
- FPS: PointerLockControls + raycasting for shooting
- Third Person: Camera follow with spring arm + orbit
- Racing: Track with checkpoints, vehicle physics
- Flight: Quaternion-based rotation, altitude management
- Puzzle 3D: Object manipulation, spatial reasoning
- Open World: Chunk loading, LOD system, skybox

**3D Performance:**
- Use instanced meshes for repeated objects (trees, enemies, bullets)
- Level-of-Detail (LOD) for distant objects
- Frustum culling (built-in with Three.js)
- Use BufferGeometry, never Geometry
- Texture atlasing for materials
- Object pooling for projectiles/particles

**Procedural Generation:**
- Perlin/Simplex noise for terrain
- Wave Function Collapse for level layouts
- BSP trees for dungeon generation
- L-systems for vegetation

### Universal Game Features (MUST include)

1. **Loading Screen** — Progress bar while assets load, animated logo
2. **Main Menu** — Play, Settings (sound on/off, difficulty), Credits
3. **Pause Menu** — Resume, Restart, Quit to Menu (Escape key)
4. **Game Over Screen** — Score, High Score (localStorage), Restart, Menu
5. **Score System** — Animated score counter, multiplier, combos
6. **Sound Toggle** — Mute/unmute button always visible
7. **Responsive Layout** — Works on desktop, tablet, phone
8. **Touch Controls** — Virtual joystick/buttons on mobile (auto-detected)
9. **Save System** — localStorage for high scores, settings, progress
10. **FPS Counter** — Toggle-able performance overlay (debug mode)

### Visual Polish

- **Particles** on impacts, explosions, collectibles, trails
- **Screen shake** on hits, explosions
- **Juice/Easing** — Elastic, bounce, back easing on UI elements
- **Parallax backgrounds** — 3+ layers at different scroll speeds
- **Color palettes** — Use cohesive, curated palettes (not random colors)
- **Glow effects** — Canvas shadowBlur or CSS filters
- **Trail effects** — For fast-moving objects

═══════════════════════════════════════════════════
## WEB APPLICATION RULES
═══════════════════════════════════════════════════

## Multi-Page Applications
- Use HashRouter (NOT BrowserRouter) — app runs in iframe
- Proper file structure: src/App.tsx, src/pages/*, src/components/*
- import { HashRouter, Routes, Route, Link } from 'react-router-dom'

## Styling
- Default: Tailwind CSS
- CSS custom properties for theming
- Dark mode via dark: classes

## Quality Modes
### Prototype — minimal files, inline styles, placeholder data
### Production — separation of concerns, error boundaries, loading states, responsive, accessible, typed

## Supabase Integration
- createClient with placeholder env vars
- Auth context/provider, protected routes
- CRUD with supabase.from().select/insert/update/delete

## Code Quality
1. ALL files complete and runnable
2. TypeScript for React projects
3. ALL imports explicit
4. Proper props typing
5. Functional components + hooks
6. key props on mapped elements
7. Loading, error, empty states
8. Semantic HTML

## Iterative Editing
When projectState provided: modify only changed files, return ALL files.

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, framework, projectState, quality, conversationHistory } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Build conversation for Gemini
    const geminiContents: any[] = [];

    // If we have existing project state, include it as context
    if (projectState && projectState.files && projectState.files.length > 0) {
      const projectContext = `Current project state (framework: ${projectState.framework || "unknown"}):\n\n${projectState.files.map((f: any) => `--- ${f.path} ---\n${f.content}`).join("\n\n")}`;
      geminiContents.push({
        role: "user",
        parts: [{ text: projectContext }],
      });
      geminiContents.push({
        role: "model",
        parts: [{ text: "I see the current project. What changes would you like?" }],
      });
    }

    // Add conversation history for context continuity
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory) {
        const role = msg.role === "assistant" ? "model" : "user";
        geminiContents.push({
          role,
          parts: [{ text: typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content) }],
        });
      }
    }

    // Add current messages
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      let text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      geminiContents.push({
        role,
        parts: [{ text }],
      });
    }

    // Detect if this is a game request for enhanced hints
    const userContent = messages.map((m: any) => typeof m.content === 'string' ? m.content : '').join(' ').toLowerCase();
    const isGame = /\b(game|2d|3d|platformer|shooter|rpg|puzzle|arcade|racing|runner|fighting|tower.defense|card.game|tetris|snake|pong|breakout|flappy|space.invaders|chess|checkers)\b/i.test(userContent);
    const is3D = /\b(3d|three\.?js|r3f|react.three|fiber|3 ?dimension|first.person|third.person|fps|open.world)\b/i.test(userContent);
    const isPortrait = /\b(portrait|vertical|mobile.first|endless.runner|tall|phone)\b/i.test(userContent);
    const isLandscape = /\b(landscape|horizontal|wide|widescreen)\b/i.test(userContent);

    // Append quality, framework, and game-specific hints
    const lastMsg = geminiContents[geminiContents.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      const hints: string[] = [];
      if (quality) hints.push(`Quality mode: ${quality}`);
      if (framework) hints.push(`Preferred framework: ${framework}`);
      
      if (isGame) {
        hints.push("This is a GAME request — implement ALL professional game systems: game loop with fixed timestep, state machine, input manager (keyboard+touch), particle system, camera system, audio manager with Web Audio API tones, HUD, loading screen, main menu, pause menu, game over screen, high score via localStorage, mobile touch controls, screen shake, particle effects");
        
        if (is3D) {
          hints.push("Use react-vite framework with Three.js (@react-three/fiber ^8.18, @react-three/drei ^9.122.0, three >=0.133). Include proper 3D lighting, shadows, materials, and camera controls");
        } else {
          hints.push("Use vanilla-html with HTML5 Canvas. Include full game loop, sprite rendering, collision detection, particle effects");
        }
        
        if (isPortrait) {
          hints.push("PORTRAIT/VERTICAL orientation: canvas width < height, optimized for phone in vertical mode, virtual controls at bottom");
        } else if (isLandscape) {
          hints.push("LANDSCAPE orientation: canvas width > height, optimized for wide screens");
        } else {
          hints.push("Support BOTH orientations: auto-detect and adapt layout, show orientation hint if needed");
        }
      }
      
      if (hints.length > 0) {
        lastMsg.parts[0].text += `\n\n[${hints.join(". ")}]`;
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: geminiContents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ error: "AI service error", details: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: "No response from AI" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let parsed;
    try {
      let jsonStr = text.trim();
      if (jsonStr.startsWith("\`\`\`")) {
        jsonStr = jsonStr.replace(/^\`\`\`(?:json)?\n?/, "").replace(/\n?\`\`\`$/, "");
      }
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response as JSON:", text.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse generated code", raw: text.substring(0, 2000) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!parsed.files || !Array.isArray(parsed.files) || parsed.files.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid response: no files generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("code-generator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
