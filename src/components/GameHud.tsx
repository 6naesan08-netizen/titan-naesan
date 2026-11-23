import { Eye, Gamepad2, Pause, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot } from '../game/types';

export interface Hud3DSnapshot extends HudSnapshot {
  hookReady: boolean;
  hookDist: number;
  pointerLocked: boolean;
  thirdPerson: boolean;
  combatBanner: string;
  targetTitanName?: string;
  targetTitanHpPct?: number;
}

interface GameHudProps {
  hud: Hud3DSnapshot;
  touchMode: boolean;
  onToggleTouchMode: () => void;
  onPause: () => void;
  onToggleMute: () => void;
  onToggleView: () => void;
}

export function GameHud({
  hud,
  touchMode,
  onToggleTouchMode,
  onPause,
  onToggleMute,
  onToggleView,
}: GameHudProps) {
  const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
  const gasPct = Math.max(0, Math.min(100, (hud.gas / hud.maxGas) * 100));
  const bladePct = Math.max(0, Math.min(100, (hud.bladeDurability / hud.maxBladeDurability) * 100));
  const fastSpeed = hud.speedKmh >= 90;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* High-Speed Anime Wind Speedlines around screen perimeter */}
      {fastSpeed && (
        <svg
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 h-full w-full"
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          style={{ opacity: Math.min(0.42, (hud.speedKmh - 88) / 110) }}
        >
          {Array.from({ length: 28 }).map((_, i) => {
            const ang = (i / 28) * Math.PI * 2;
            const x1 = 500 + Math.cos(ang) * 340;
            const y1 = 500 + Math.sin(ang) * 340;
            const x2 = 500 + Math.cos(ang) * 720;
            const y2 = 500 + Math.sin(ang) * 720;
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#F8FAFC"
                strokeWidth={i % 2 === 0 ? 2.5 : 1.5}
              />
            );
          })}
        </svg>
      )}

      {/* Low HP Crimson Vignette */}
      {hud.hp < 35 && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0,0,0,0) 48%, rgba(185, 28, 28, 0.35) 100%)',
          }}
        />
      )}

      {/* First-Person Center Crosshair, Critical Speed Ring & Target Titan HP */}
      <div className="pointer-events-none fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative flex items-center justify-center">
          {fastSpeed && (
            <div
              className="absolute h-10 w-10 rounded-full border border-rose-400/80 shadow-[0_0_12px_rgba(244,63,94,0.65)]"
              aria-hidden="true"
            />
          )}
          <div
            className={`h-7 w-7 rounded-full border-2 transition-transform duration-100 ${
              hud.hookReady
                ? fastSpeed
                  ? 'scale-105 border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.65)]'
                  : 'scale-100 border-emerald-400'
                : fastSpeed
                  ? 'scale-95 border-rose-400/90'
                  : 'scale-90 border-slate-300/60'
            }`}
          />
          <div
            className={`absolute h-1.5 w-1.5 rounded-full ${
              hud.hookReady
                ? fastSpeed
                  ? 'bg-amber-300'
                  : 'bg-emerald-400'
                : fastSpeed
                  ? 'bg-rose-400'
                  : 'bg-white/80'
            }`}
          />
          {(hud.hookReady || (hud.targetTitanName && hud.targetTitanHpPct !== undefined)) && (
            <div className="absolute left-1/2 top-9 flex -translate-x-1/2 flex-col items-center gap-1">
              {hud.hookReady && (
                <span
                  className={`font-mono-tabular whitespace-nowrap text-xs font-bold leading-none drop-shadow ${
                    fastSpeed ? 'text-amber-300' : 'text-emerald-400'
                  }`}
                >
                  {hud.hookDist}m
                </span>
              )}
              {hud.targetTitanName && hud.targetTitanHpPct !== undefined && (
                <div className="flex w-28 flex-col items-center gap-0.5 rounded bg-[#0B101B]/85 px-2 py-1 ring-1 ring-slate-700/80">
                  <div className="flex w-full items-center justify-between gap-1 text-[10px] font-bold leading-none text-slate-100">
                    <span className="truncate">{hud.targetTitanName}</span>
                    <span className="font-mono-tabular text-rose-300">{hud.targetTitanHpPct}%</span>
                  </div>
                  <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-rose-500 transition-all duration-100"
                      style={{ width: `${Math.max(0, Math.min(100, hud.targetTitanHpPct))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Grabbed Escape Prompt */}
      {hud.grabbed && (
        <div className="pointer-events-none fixed left-1/2 top-[35%] -translate-x-1/2 rounded-lg border border-rose-500 bg-[#0B101B]/95 px-5 py-2.5 text-center shadow-2xl">
          <div className="text-sm font-bold text-rose-400">거인에게 포획됨!</div>
          <div className="mt-1 text-xs font-semibold text-white">
            {touchMode ? '와이어 · 참격 · 부스트 버튼을 연타해 탈출!' : 'Space / F / 좌클릭을 연타해 손가락을 베고 탈출!'}
          </div>
          <div className="mt-2 h-2 w-48 overflow-hidden rounded-sm bg-slate-800 sm:w-56">
            <div
              className="h-full bg-emerald-400 transition-all duration-75"
              style={{ width: `${hud.escapeProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Combat Feedback Banner */}
      {hud.combatBanner && !hud.grabbed && (
        <div className="pointer-events-none fixed left-1/2 top-24 max-w-[90vw] -translate-x-1/2 truncate rounded-lg border border-slate-700/80 bg-[#0B101B]/90 px-4 py-1.5 text-center text-xs font-bold text-white shadow-lg sm:text-sm">
          {hud.combatBanner}
        </div>
      )}

      {/* Top Row: Compact Responsive Stats & Controls */}
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* Top-Left: HP, Gas/Blades (compact on mobile) & Wave */}
        <div className="w-44 rounded-lg border border-slate-800/90 bg-[#0B101B]/88 px-3 py-2 sm:w-64 sm:px-4 sm:py-3">
          <div className="flex items-center justify-between text-[11px] font-semibold sm:text-xs">
            <span className="text-slate-300">생명력</span>
            <span className="font-mono-tabular text-slate-100">
              {hud.hp}/{hud.maxHp}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-sm bg-slate-800 sm:h-2">
            <div
              className={`h-full transition-all duration-150 ${
                hpPct > 50 ? 'bg-emerald-500' : hpPct > 25 ? 'bg-amber-500' : 'bg-rose-600'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          {/* Mobile inline Gas & Blade bars so bottom thumb-zones stay clean for controls */}
          {touchMode && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span>가스</span>
                  <span className="font-mono-tabular text-emerald-400">{hud.gas}%</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-slate-800">
                  <div className="h-full bg-emerald-500" style={{ width: `${gasPct}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-slate-300">
                  <span>칼날</span>
                  <span className="font-mono-tabular text-slate-100">x{hud.spareBlades}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-sm bg-slate-800">
                  <div
                    className={`h-full ${bladePct > 25 ? 'bg-slate-200' : 'bg-rose-500'}`}
                    style={{ width: `${bladePct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-300 font-mono-tabular sm:mt-3 sm:text-xs">
            <span>W{hud.wave}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>거인 {hud.titansRemaining}구</span>
            <span aria-hidden="true" className="hidden text-slate-600 sm:inline">·</span>
            <span className="hidden font-bold text-white sm:inline">{hud.speedKmh} km/h</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-slate-400 sm:text-xs">{hud.districtName}</div>
        </div>

        {/* Top-Center: Wave Banner or PointerLock Helper */}
        <div className="hidden flex-col items-center gap-2 lg:flex">
          {hud.waveBannerTimer > 0 && (
            <div className="rounded-lg border border-emerald-500/40 bg-[#0B101B]/90 px-6 py-2.5 text-center">
              <div className="font-display text-xl tracking-wide text-white">
                {hud.districtName} · 웨이브 {hud.wave}
              </div>
              <div className="mt-0.5 text-xs text-emerald-400">
                거인 {hud.titansRemaining}구가 구역 내에 출현했습니다
              </div>
            </div>
          )}
          {!touchMode && !hud.pointerLocked && (
            <div className="rounded-lg border border-slate-700/80 bg-[#0B101B]/88 px-4 py-1.5 text-xs text-slate-200">
              화면을 클릭하면 1인칭 마우스 시점이 고정됩니다 (ESC: 해제)
            </div>
          )}
        </div>

        {/* Top-Right: Score, Kills & >=44px Touch Action Buttons */}
        <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-start sm:gap-2">
          <div className="rounded-lg border border-slate-800/90 bg-[#0B101B]/88 px-3 py-1.5 text-right sm:px-4 sm:py-2.5">
            <div className="font-mono-tabular text-base font-bold text-white sm:text-xl">
              {hud.score.toLocaleString()}
              <span className="ml-1 text-[11px] font-normal text-slate-400 sm:text-xs">점</span>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-300 font-mono-tabular sm:text-xs">
              <span>토벌 {hud.kills}구</span>
              {hud.combo >= 2 && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-bold text-amber-400">{hud.combo}연속</span>
                </>
              )}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleTouchMode}
              title={touchMode ? '터치 패드 끄기' : '터치 패드 켜기'}
              aria-label={touchMode ? '터치 패드 끄기' : '터치 패드 켜기'}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                touchMode
                  ? 'border-emerald-500/70 bg-emerald-950/80 text-emerald-300'
                  : 'border-slate-800/90 bg-[#0B101B]/90 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Gamepad2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleView}
              aria-label="시점 전환"
              className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-800/90 bg-[#0B101B]/90 px-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:px-3"
            >
              <Eye className="h-4 w-4 text-emerald-400" />
              <span className="hidden whitespace-nowrap sm:inline">
                {hud.thirdPerson ? '3인칭 [V]' : '1인칭 [V]'}
              </span>
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={hud.muted ? '효과음 켜기' : '효과음 끄기'}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-800/90 bg-[#0B101B]/90 text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-400"
            >
              {hud.muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="일시정지"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-slate-800/90 bg-[#0B101B]/90 px-2.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-400 sm:px-3"
            >
              <Pause className="h-4 w-4" />
              <span className="hidden whitespace-nowrap sm:inline">일시정지</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row (Desktop HUD only — hidden when touchMode is active so thumb zones stay clean!) */}
      {!touchMode && (
        <div className="flex items-end justify-between gap-4">
          <div className="w-72 rounded-lg border border-slate-800/90 bg-[#0B101B]/88 px-4 py-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">가스 잔량</span>
              <span className={`font-mono-tabular ${gasPct < 25 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {hud.gas}%
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-slate-800">
              <div
                className={`h-full transition-all duration-100 ${gasPct < 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${gasPct}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-300">
                칼날 내구도 {hud.reloading ? '(교체 중...)' : hud.bladeDurability <= 0 ? '(파손 · R 교체)' : ''}
              </span>
              <span className="font-mono-tabular text-slate-100">
                예비 {hud.spareBlades}/{hud.maxSpareBlades}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-sm bg-slate-800">
              <div
                className={`h-full transition-all duration-100 ${
                  bladePct > 35 ? 'bg-slate-200' : bladePct > 0 ? 'bg-amber-400' : 'bg-rose-600'
                }`}
                style={{ width: `${bladePct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="rounded-lg border border-slate-800/90 bg-[#0B101B]/88 px-4 py-2.5 text-right">
              <div className="text-xs text-slate-400">기동 속도</div>
              <div
                className={`font-mono-tabular text-2xl font-bold leading-tight ${
                  fastSpeed ? 'text-rose-400' : 'text-white'
                }`}
              >
                {hud.speedKmh} <span className="text-xs font-medium text-slate-400">km/h</span>
              </div>
              {fastSpeed && <div className="text-xs font-semibold text-rose-400">치명타 가속</div>}
            </div>

            <div className="hidden rounded-lg border border-slate-800/80 bg-[#0B101B]/85 px-3 py-1.5 text-xs text-slate-300 sm:block">
              좌클릭 / Q·E: 와이어 · 우클릭 / F: 참격 · Space: 부스트 · R: 칼날 교체 · V: 시점 전환
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
