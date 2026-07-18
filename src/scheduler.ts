import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { config } from "./config";

export interface Checkin {
  id: number;
  note: string;
  silent: boolean;
  /** Auto-screenshot the frontmost window as proof when this fires. */
  captureScreen: boolean;
  fireAtMs: number;
  createdAtMs: number;
  /** 30s-warning already sent (or not applicable). */
  warned: boolean;
}

interface Store {
  nextId: number;
  pending: Checkin[];
}

export type FireHandler = (checkin: Checkin) => Promise<void>;

export interface SchedulerHooks {
  /** Called shortly before a check-in fires (the "⏳ 30 seconds" text). */
  onWarn?: (checkin: Checkin) => Promise<void>;
  /** Called whenever a new check-in is scheduled (used to auto-open the HUD). */
  onScheduled?: (checkin: Checkin) => void;
}

/** Real-world 30s, compressed like everything else by TIME_SCALE. */
const WARN_BEFORE_MS = 30_000 / config.timeScale;
/** Don't warn on timers so short the warning would be noise. */
const WARN_MIN_DELAY_MS = 45_000 / config.timeScale;

/**
 * In-process timers mirrored to timers.json so pending check-ins survive a
 * restart. Delays are compressed by TIME_SCALE at scheduling time (demo mode).
 */
export class Scheduler {
  private store: Store = { nextId: 1, pending: [] };
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private warnTimers = new Map<number, ReturnType<typeof setTimeout>>();

  constructor(
    private filePath: string,
    private onFire: FireHandler,
    private hooks: SchedulerHooks = {},
  ) {}

  /** Load persisted timers and re-arm them. Overdue check-ins fire ~2s after boot. */
  restore(): number {
    if (!existsSync(this.filePath)) return 0;
    try {
      this.store = JSON.parse(readFileSync(this.filePath, "utf8")) as Store;
    } catch {
      return 0;
    }
    for (const c of this.store.pending) {
      c.captureScreen ??= false;
      c.warned ??= true; // don't double-warn after a restart
      this.arm(c);
    }
    return this.store.pending.length;
  }

  /** delaySeconds is the agent-requested (real) delay; TIME_SCALE compresses it. */
  schedule(delaySeconds: number, note: string, silent: boolean, captureScreen = false): Checkin {
    const scaledMs = Math.max(1000, (delaySeconds * 1000) / config.timeScale);
    const checkin: Checkin = {
      id: this.store.nextId++,
      note,
      silent,
      captureScreen,
      fireAtMs: Date.now() + scaledMs,
      createdAtMs: Date.now(),
      // Silent check-ins never warn — the whole point is not knowing when.
      warned: silent || scaledMs < WARN_MIN_DELAY_MS,
    };
    this.store.pending.push(checkin);
    this.persist();
    this.arm(checkin);
    this.hooks.onScheduled?.(checkin);
    return checkin;
  }

  cancel(id: number): boolean {
    for (const map of [this.timers, this.warnTimers]) {
      const timer = map.get(id);
      if (timer) clearTimeout(timer);
      map.delete(id);
    }
    const before = this.store.pending.length;
    this.store.pending = this.store.pending.filter((c) => c.id !== id);
    this.persist();
    return this.store.pending.length < before;
  }

  list(): Checkin[] {
    return [...this.store.pending].sort((a, b) => a.fireAtMs - b.fireAtMs);
  }

  private arm(checkin: Checkin) {
    const delay = Math.max(2000, checkin.fireAtMs - Date.now());
    const timer = setTimeout(() => {
      this.timers.delete(checkin.id);
      this.store.pending = this.store.pending.filter((c) => c.id !== checkin.id);
      this.persist();
      this.onFire(checkin).catch((err) =>
        console.error(`[scheduler] check-in #${checkin.id} handler failed:`, err),
      );
    }, delay);
    this.timers.set(checkin.id, timer);

    if (!checkin.warned && this.hooks.onWarn) {
      const warnDelay = delay - WARN_BEFORE_MS;
      if (warnDelay > 1000) {
        const warnTimer = setTimeout(() => {
          this.warnTimers.delete(checkin.id);
          checkin.warned = true;
          this.persist();
          this.hooks.onWarn!(checkin).catch((err) =>
            console.error(`[scheduler] warn for #${checkin.id} failed:`, err),
          );
        }, warnDelay);
        this.warnTimers.set(checkin.id, warnTimer);
      }
    }
  }

  private persist() {
    writeFileSync(this.filePath, JSON.stringify(this.store, null, 2));
  }
}
