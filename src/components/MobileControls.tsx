import { useRef, useState } from 'react';

interface MobileControlsProps {
  onMoveChange: (x: number, y: number) => void;
  onWireChange: (active: boolean) => void;
  onBoostChange: (active: boolean) => void;
  onSlash: () => void;
  onReload: () => void;
  wireActiveReady: boolean;
  bladeDurability: number;
  spareBlades: number;
  reloading: boolean;
  grabbed: boolean;
}

export function MobileControls({
  onMoveChange,
  onWireChange,
  onBoostChange,
  onSlash,
  onReload,
  wireActiveReady,
  bladeDurability,
  spareBlades,
  reloading,
  grabbed,
}: MobileControlsProps) {
  const ringRef = useRef<HTMLDivElement | null>(null);
  const joyPointerId = useRef<number | null>(null);
  const wirePointerId = useRef<number | null>(null);
  const boostPointerId = useRef<number | null>(null);

  const [knob, setKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [wireHeld, setWireHeld] = useState(false);
  const [boostHeld, setBoostHeld] = useState(false);
  const [slashHeld, setSlashHeld] = useState(false);
  const [reloadHeld, setReloadHeld] = useState(false);

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = ringRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.42;

    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR && dist > 0) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    const nx = Math.abs(dx) < 3 ? 0 : dx / maxR;
    const ny = Math.abs(dy) < 3 ? 0 : -dy / maxR;
    setKnob({ x: dx, y: dy });
    onMoveChange(nx, ny);
  };

  const resetJoystick = () => {
    joyPointerId.current = null;
    setJoyActive(false);
    setKnob({ x: 0, y: 0 });
    onMoveChange(0, 0);
  };

  const releaseWire = () => {
    if (wirePointerId.current === null && !wireHeld) return;
    wirePointerId.current = null;
    setWireHeld(false);
    onWireChange(false);
  };

  const releaseBoost = () => {
    if (boostPointerId.current === null && !boostHeld) return;
    boostPointerId.current = null;
    setBoostHeld(false);
    onBoostChange(false);
  };

  const bladeLow = bladeDurability <= 35;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-2 pb-3 pt-2 select-none sm:px-6 sm:pb-6">
      {/* Left Thumb Zone: Large Forgiving Capture Pad around 128px Analog Ring */}
      <div
        onPointerDown={(e) => {
          e.stopPropagation();
          joyPointerId.current = e.pointerId;
          setJoyActive(true);
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            // ignore capture error
          }
          updateJoystick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (joyPointerId.current !== e.pointerId) return;
          e.stopPropagation();
          updateJoystick(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          if (joyPointerId.current !== e.pointerId) return;
          e.stopPropagation();
          resetJoystick();
        }}
        onPointerCancel={(e) => {
          if (joyPointerId.current !== e.pointerId) return;
          resetJoystick();
        }}
        onLostPointerCapture={() => {
          if (joyPointerId.current !== null) resetJoystick();
        }}
        style={{ touchAction: 'none' }}
        className="pointer-events-auto flex h-44 w-44 items-center justify-center rounded-full"
        aria-label="이동 조이스틱"
      >
        <div
          ref={ringRef}
          className={`relative flex h-32 w-32 items-center justify-center rounded-full border-2 transition-colors ${
            joyActive
              ? 'border-emerald-400/90 bg-[#0B101B]/80'
              : 'border-slate-500/75 bg-[#0B101B]/65'
          }`}
        >
          {/* Subtle 4-way directional guides */}
          <span className="pointer-events-none absolute top-2 text-[10px] text-slate-400/80">▲</span>
          <span className="pointer-events-none absolute bottom-2 text-[10px] text-slate-400/80">▼</span>
          <span className="pointer-events-none absolute left-2.5 text-[10px] text-slate-400/80">◀</span>
          <span className="pointer-events-none absolute right-2.5 text-[10px] text-slate-400/80">▶</span>

          {/* Responsive Analog Thumbstick Knob (no transition delay while dragging) */}
          <div
            className={`h-14 w-14 rounded-full border-2 shadow-lg ${
              joyActive
                ? 'border-emerald-300 bg-emerald-400/45 transition-none'
                : 'border-slate-200/70 bg-slate-200/35 transition-transform duration-100'
            }`}
            style={{
              transform: `translate(${knob.x}px, ${knob.y}px)`,
            }}
          />
        </div>
      </div>

      {/* Right Thumb Zone: Generously Sized & Spaced ODM Action Cluster */}
      <div
        style={{ touchAction: 'none' }}
        className="pointer-events-auto flex items-end gap-3 pr-1 pb-1 sm:gap-4"
      >
        {/* Inner Column: Blade Reload & Gas Boost */}
        <div className="flex flex-col items-end gap-3">
          {/* Enlarged Blade Reload Pad */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              setReloadHeld(true);
              onReload();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setReloadHeld(false);
            }}
            onPointerCancel={() => setReloadHeld(false)}
            onPointerLeave={() => setReloadHeld(false)}
            style={{ touchAction: 'none' }}
            className="p-1.5 -m-1.5"
          >
            <button
              type="button"
              aria-label="칼날 교체"
              className={`relative flex h-14 min-w-[96px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 px-3 text-xs font-bold transition-transform ${
                reloadHeld
                  ? 'scale-95 border-amber-300 bg-amber-600 text-white'
                  : reloading
                    ? 'border-amber-400 bg-amber-900/90 text-amber-200'
                    : bladeLow
                      ? 'border-rose-400 bg-rose-950/90 text-rose-200'
                      : 'border-amber-500/80 bg-[#0B101B]/90 text-amber-300'
              }`}
            >
              <span className="leading-tight">
                {reloading ? '교체 중...' : '칼날 교체'}
              </span>
              <span className="font-mono-tabular mt-0.5 text-[10px] font-semibold opacity-90">
                예비 x{spareBlades} · {bladeDurability}%
              </span>
              <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-800/90">
                <div
                  className={`h-full ${bladeLow ? 'bg-rose-400' : 'bg-amber-400'}`}
                  style={{ width: `${Math.max(0, Math.min(100, bladeDurability))}%` }}
                />
              </div>
            </button>
          </div>

          {/* Gas Boost Pad */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              boostPointerId.current = e.pointerId;
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                // ignore capture error
              }
              setBoostHeld(true);
              onBoostChange(true);
            }}
            onPointerUp={(e) => {
              if (boostPointerId.current !== e.pointerId) return;
              e.stopPropagation();
              releaseBoost();
            }}
            onPointerCancel={(e) => {
              if (boostPointerId.current !== e.pointerId) return;
              releaseBoost();
            }}
            onLostPointerCapture={releaseBoost}
            style={{ touchAction: 'none' }}
            className="p-1.5 -m-1.5"
          >
            <button
              type="button"
              aria-label="가스 부스트"
              className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-xs font-bold transition-transform ${
                boostHeld
                  ? 'scale-95 border-sky-300 bg-sky-600 text-white'
                  : 'border-slate-500/85 bg-[#0B101B]/90 text-slate-100'
              }`}
            >
              부스트
            </button>
          </div>
        </div>

        {/* Outer Primary Column: Wire Hold & Primary Slash */}
        <div className="flex flex-col items-center gap-3">
          {/* Wire Anchor Hold Pad */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              wirePointerId.current = e.pointerId;
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                // ignore capture error
              }
              setWireHeld(true);
              onWireChange(true);
            }}
            onPointerUp={(e) => {
              if (wirePointerId.current !== e.pointerId) return;
              e.stopPropagation();
              releaseWire();
            }}
            onPointerCancel={(e) => {
              if (wirePointerId.current !== e.pointerId) return;
              releaseWire();
            }}
            onLostPointerCapture={releaseWire}
            style={{ touchAction: 'none' }}
            className="p-1.5 -m-1.5"
          >
            <button
              type="button"
              aria-label="와이어 사출"
              className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 text-xs font-bold transition-transform ${
                wireHeld
                  ? 'scale-95 border-emerald-200 bg-emerald-600 text-white'
                  : wireActiveReady
                    ? 'border-emerald-400 bg-emerald-950/90 text-emerald-300'
                    : 'border-slate-500/85 bg-[#0B101B]/90 text-slate-200'
              }`}
            >
              와이어
            </button>
          </div>

          {/* Primary Blade Slash / Grab Escape Pad */}
          <div
            onPointerDown={(e) => {
              e.stopPropagation();
              setSlashHeld(true);
              onSlash();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              setSlashHeld(false);
            }}
            onPointerCancel={() => setSlashHeld(false)}
            onPointerLeave={() => setSlashHeld(false)}
            style={{ touchAction: 'none' }}
            className="p-1.5 -m-1.5"
          >
            <button
              type="button"
              aria-label="참격"
              className={`flex h-20 w-20 items-center justify-center rounded-full border-2 text-sm font-bold text-white shadow-xl transition-transform ${
                slashHeld
                  ? 'scale-92 border-rose-200 bg-rose-500'
                  : grabbed
                    ? 'border-amber-300 bg-rose-600'
                    : 'border-rose-400 bg-rose-700/95'
              }`}
            >
              {grabbed ? '탈출!' : '참격'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
