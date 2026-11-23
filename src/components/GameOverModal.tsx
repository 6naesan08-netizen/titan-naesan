import { BestRecord, HudSnapshot } from '../game/types';

interface GameOverModalProps {
  hud: HudSnapshot;
  bestRecord: BestRecord;
  isNewHighScore: boolean;
  onPlayAgain: () => void;
  onExitToTitle: () => void;
}

export function GameOverModal({
  hud,
  bestRecord,
  isNewHighScore,
  onPlayAgain,
  onExitToTitle,
}: GameOverModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-[#0F1521] p-8 shadow-2xl">
        <p className="text-xs font-semibold text-rose-400">
          {hud.districtName} · 작전 종료
        </p>
        <h2 className="font-display mt-1 text-3xl text-white">전투 결과 보고</h2>
        <p className="mt-2 text-sm text-slate-300">
          {hud.gameOverReason || '거인과의 교전에서 쓰러졌습니다.'}
        </p>

        {isNewHighScore && (
          <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3.5 py-2 text-xs font-bold text-amber-300">
            신기록 달성! 최고 점수를 경신했습니다.
          </div>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-slate-800 py-5">
          <div>
            <dt className="text-xs text-slate-400">최종 점수</dt>
            <dd className="font-mono-tabular mt-1 text-2xl font-bold text-white">
              {hud.score.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">거인 토벌 수</dt>
            <dd className="font-mono-tabular mt-1 text-2xl font-bold text-emerald-400">
              {hud.kills}구
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">도달 웨이브</dt>
            <dd className="font-mono-tabular mt-1 text-lg font-bold text-slate-100">
              웨이브 {hud.wave}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">최고 속도 · 최대 콤보</dt>
            <dd className="font-mono-tabular mt-1 text-lg font-bold text-slate-100">
              {hud.bestSpeedKmh} km/h · {hud.maxCombo}x
            </dd>
          </div>
        </dl>

        <div className="mt-4 text-xs text-slate-400 font-mono-tabular">
          역대 최고 점수: {bestRecord.highScore.toLocaleString()}점 · 최다 토벌: {bestRecord.maxKills}구
        </div>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white whitespace-nowrap transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            다시 하기
          </button>
          <button
            type="button"
            onClick={onExitToTitle}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800/70 px-5 py-3 text-sm font-semibold text-slate-200 whitespace-nowrap transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            메인 화면
          </button>
        </div>
      </div>
    </div>
  );
}
