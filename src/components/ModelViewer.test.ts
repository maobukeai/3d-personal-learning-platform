import { describe, it, expect } from 'vitest';

// -----------------------------------------------------------------------------
// Simulator for ModelViewer.vue FPS Logic (Main Thread)
// -----------------------------------------------------------------------------
class MainThreadSimulator {
  public lastFpsTime: number = 0;
  public lastTime: number = 0;
  public frames: number = 0;
  public lowFpsSeconds: number = 0;
  public isLoading = { value: false };
  public document = { hidden: false };
  public systemStore = { isGlassDegraded: false };
  public renderLoopActive: boolean = true;

  public fpsReports: number[] = [];
  public currentTime: number = 0;

  constructor(startTime: number) {
    this.currentTime = startTime;
    this.lastFpsTime = startTime;
    this.lastTime = startTime;
  }

  // Exact reproduction of handleFpsUpdate
  public handleFpsUpdate(fps: number) {
    this.fpsReports.push(fps);
    if (this.isLoading.value || this.document.hidden) {
      this.lowFpsSeconds = 0;
      return;
    }
    if (fps < 45) {
      this.lowFpsSeconds++;
      if (this.lowFpsSeconds >= 3) {
        this.systemStore.isGlassDegraded = true;
      }
    } else {
      this.lowFpsSeconds = 0;
    }
  }

  // Exact reproduction of handleVisibilityChange
  public handleVisibilityChange() {
    if (!this.document.hidden) {
      const now = this.currentTime;
      this.lastFpsTime = now;
      this.lastTime = now;
      this.frames = 0;
      this.lowFpsSeconds = 0;
    }
  }

  // Simulates requestAnimationFrame tick
  public tick() {
    if (!this.renderLoopActive) return;
    const time = this.currentTime;
    const delta = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.frames++;
    if (time - this.lastFpsTime > 2000) {
      this.frames = 0;
      this.lastFpsTime = time;
    } else if (time - this.lastFpsTime >= 1000) {
      const fps = (this.frames * 1000) / (time - this.lastFpsTime);
      this.handleFpsUpdate(fps);
      this.frames = 0;
      this.lastFpsTime = time;
    }
  }
}

// -----------------------------------------------------------------------------
// Simulator for scene.worker.ts FPS Logic (Worker Thread)
// -----------------------------------------------------------------------------
class WorkerSimulator {
  public lastFpsTime: number = 0;
  public frames: number = 0;
  public mainThread: MainThreadSimulator;
  public currentTime: number = 0;

  constructor(startTime: number, mainThread: MainThreadSimulator) {
    this.currentTime = startTime;
    this.lastFpsTime = startTime;
    this.mainThread = mainThread;
  }

  public tick() {
    this.frames++;
    const now = this.currentTime;
    if (now - this.lastFpsTime > 2000) {
      this.frames = 0;
      this.lastFpsTime = now;
    } else if (now - this.lastFpsTime >= 1000) {
      const fps = (this.frames * 1000) / (now - this.lastFpsTime);
      this.mainThread.handleFpsUpdate(fps);
      this.frames = 0;
      this.lastFpsTime = now;
    }
  }
}

describe('ModelViewer FPS and Tab Visibility Stress Tests', () => {
  it('should calculate FPS correctly under normal 60FPS rendering', () => {
    const sim = new MainThreadSimulator(0);

    // Run for 3010ms at 60fps (1 tick every 16.67ms) to ensure 3 reports
    for (let t = 0; t <= 3010; t += 16.67) {
      sim.currentTime = t;
      sim.tick();
    }

    expect(sim.fpsReports.length).toBe(3);
    expect(sim.fpsReports[0]).toBeGreaterThanOrEqual(59);
    expect(sim.fpsReports[0]).toBeLessThanOrEqual(61);
    expect(sim.lowFpsSeconds).toBe(0);
    expect(sim.systemStore.isGlassDegraded).toBe(false);
  });

  it('should discard FPS reports on large render delays (>2000ms)', () => {
    const sim = new MainThreadSimulator(0);

    // 1. Run normal 60fps for slightly over 1 second (1010ms)
    for (let t = 0; t <= 1010; t += 16.67) {
      sim.currentTime = t;
      sim.tick();
    }
    expect(sim.fpsReports.length).toBe(1);
    const initialLowFpsSecs = sim.lowFpsSeconds;

    // 2. Pause/delay for 2500ms (simulate thread block, e.g. t goes from 1010 to 3510 without ticks)
    sim.currentTime = 3510;
    sim.tick(); // first tick after the delay

    // Since time - lastFpsTime = 2500 > 2000, it must discard and reset
    expect(sim.fpsReports.length).toBe(1);
    expect(sim.frames).toBe(0);
    expect(sim.lastFpsTime).toBe(3510);
    expect(sim.lowFpsSeconds).toBe(initialLowFpsSecs);
    expect(sim.systemStore.isGlassDegraded).toBe(false);
  });

  it('should reset timers correctly during tab visibility transitions with handleVisibilityChange', () => {
    const sim = new MainThreadSimulator(0);

    // 1. Render normally for 1010ms
    for (let t = 0; t <= 1010; t += 16.67) {
      sim.currentTime = t;
      sim.tick();
    }
    expect(sim.fpsReports.length).toBe(1);

    // 2. Hide tab at t = 1010ms
    sim.document.hidden = true;

    // Simulate tab being hidden for 1500ms (t = 2510ms)
    sim.currentTime = 2510;

    // Tab becomes visible again
    sim.document.hidden = false;
    sim.handleVisibilityChange(); // Correct behavior: triggers visibility handler

    expect(sim.lastFpsTime).toBe(2510);
    expect(sim.frames).toBe(0);
    expect(sim.lowFpsSeconds).toBe(0);

    // 3. Resume rendering (simulate ticks from 2510 to 3520ms)
    for (let t = 2510; t <= 3520; t += 16.67) {
      sim.currentTime = t;
      sim.tick();
    }

    expect(sim.fpsReports.length).toBe(2);
    const finalFps = sim.fpsReports[1];
    expect(finalFps).toBeGreaterThanOrEqual(59);
    expect(finalFps).toBeLessThanOrEqual(61);
    expect(sim.lowFpsSeconds).toBe(0);
    expect(sim.systemStore.isGlassDegraded).toBe(false);
  });

  it('should falsely increment low FPS count without handleVisibilityChange (Vulnerability Check)', () => {
    const sim = new MainThreadSimulator(0);

    // 1. Render normally for 1010ms
    for (let t = 0; t <= 1010; t += 16.67) {
      sim.currentTime = t;
      sim.tick();
    }
    expect(sim.fpsReports.length).toBe(1);

    // 2. Hide tab at t = 1010ms
    sim.document.hidden = true;

    // Simulate tab being hidden for 1500ms (t = 2510ms)
    sim.currentTime = 2510;

    // Tab becomes visible again
    sim.document.hidden = false;
    // VULNERABILITY SIMULATION: we do NOT call handleVisibilityChange()

    // 3. Resume rendering. Run first tick after resume
    sim.currentTime = 2526.67;
    sim.tick();

    expect(sim.fpsReports.length).toBe(2);
    expect(sim.fpsReports[1]).toBeLessThan(45);
    expect(sim.lowFpsSeconds).toBe(1);
    expect(sim.systemStore.isGlassDegraded).toBe(false);
  });

  it('should falsely degrade glass over repeated unreset transitions', () => {
    const sim = new MainThreadSimulator(0);

    // 1. Initial normal rendering period of 1010ms to set baseline
    let t = 0;
    for (; t <= 1010; t += 16.67) {
      sim.currentTime = t;
      sim.tick();
    }
    expect(sim.fpsReports.length).toBe(1);

    for (let cycle = 1; cycle <= 3; cycle++) {
      // Render 500ms
      const startRenderTime = t;
      for (; t <= startRenderTime + 500; t += 16.67) {
        sim.currentTime = t;
        sim.tick();
      }
      // Hide for 1200ms
      sim.document.hidden = true;
      t += 1200;
      sim.currentTime = t;

      // Show tab (without visibility reset)
      sim.document.hidden = false;

      // Tick once to calculate the stale transition FPS
      t += 16.67;
      sim.currentTime = t;
      sim.tick();
    }

    expect(sim.lowFpsSeconds).toBe(3);
    expect(sim.systemStore.isGlassDegraded).toBe(true);
  });

  it('should handle worker timing and large delays', () => {
    const main = new MainThreadSimulator(0);
    const worker = new WorkerSimulator(0, main);

    // 1. Normal worker render loop for 1 second (1010ms)
    for (let t = 0; t <= 1010; t += 16.67) {
      worker.currentTime = t;
      worker.tick();
    }
    expect(main.fpsReports.length).toBe(1);

    // 2. Worker large render delay (e.g. 2200ms)
    worker.currentTime = 3210;
    worker.tick();

    expect(main.fpsReports.length).toBe(1);
    expect(worker.frames).toBe(0);
  });
});
