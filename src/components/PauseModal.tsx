interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onExitToTitle: () => void;
}

export function PauseModal({ onResume, onRestart, onExitToTitle }: PauseModalProps) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-[#0F1521] p-7 shadow-2xl">
        <h2 className="font-display text-2xl text-white">일시정지</h2>
        <p className="mt-2 text-sm text-slate-400">
          전투가 잠시 멈췄습니다. 계속 진행하거나 처음부터 다시 시작할 수 있습니다.
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            계속하기
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm font-semibold text-slate-100 transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            다시 시작
          </button>
          <button
            type="button"
            onClick={onExitToTitle}
            className="w-full rounded-lg border border-slate-800 bg-transparent px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/50 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            메인 화면으로
          </button>
        </div>
      </div>
    </div>
  );
}
