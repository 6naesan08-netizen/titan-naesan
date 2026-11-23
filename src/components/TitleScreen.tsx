import { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { BestRecord, Difficulty, DistrictId } from '../game/types';
import { DISTRICTS } from '../game/world';

interface TitleScreenProps {
  difficulty: Difficulty;
  onSelectDifficulty: (d: Difficulty) => void;
  districtId: DistrictId;
  onSelectDistrict: (id: DistrictId) => void;
  onStartGame: () => void;
  bestRecord: BestRecord;
  muted: boolean;
  onToggleMute: () => void;
}

const DIFFICULTY_OPTIONS: Array<{
  id: Difficulty;
  label: string;
  desc: string;
}> = [
  { id: 'trainee', label: '훈련병 (쉬움)', desc: '가스 소모 감소 · 거인 이동 느림' },
  { id: 'scout', label: '조사병단 (보통)', desc: '표준 입체기동 · 균형 잡힌 전투' },
  { id: 'captain', label: '병장급 (어려움)', desc: '빠른 거인 · 높은 피해량 · 점수 1.4배' },
];

const DISTRICT_LIST: DistrictId[] = [
  'shiganshina',
  'trost',
  'forest',
  'utgard',
  'reiss_chapel',
  'liberio',
  'paradis_rumbling',
  'quinta',
];

export function TitleScreen({
  difficulty,
  onSelectDifficulty,
  districtId,
  onSelectDistrict,
  onStartGame,
  bestRecord,
  muted,
  onToggleMute,
}: TitleScreenProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const activeDistrict = DISTRICTS[districtId];

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden overflow-y-auto bg-[#0B0F17] p-4 sm:p-6 md:p-8">
      {/* Background Key Visual with Scrim & Zero-Broken-Image Fallback */}
      {!imgFailed ? (
        <img
          src="/src/assets/images/title_shiganshina_wall_1795155201764.jpg"
          alt="월 마리아 시가지와 50미터 방벽 전경"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="fixed inset-0 h-full w-full object-cover opacity-55 pointer-events-none"
        />
      ) : (
        <div
          aria-hidden="true"
          className="fixed inset-0 bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#3B2622] pointer-events-none"
        />
      )}
      <div
        aria-hidden="true"
        className="fixed inset-0 bg-gradient-to-t from-[#090D16] via-[#090D16]/75 to-[#090D16]/55 pointer-events-none"
      />

      {/* Mute Button Top-Right */}
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? '효과음 켜기' : '효과음 끄기'}
        className="fixed right-4 top-4 sm:right-6 sm:top-6 z-20 flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/90 px-3.5 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        {muted ? <VolumeX className="h-4 w-4 text-slate-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
        <span className="whitespace-nowrap">{muted ? '음소거' : '사운드 켜짐'}</span>
      </button>

      {/* Main Content Container */}
      <div className="relative z-10 grid w-full max-w-6xl grid-cols-1 items-stretch gap-5 lg:grid-cols-12 my-8 sm:my-0">
        {/* Left Column: Title, District Selection, Difficulty & Start CTA */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0F1521]/94 p-5 sm:p-7 lg:col-span-7">
          <div>
            <p className="text-sm font-medium tracking-wide text-emerald-400">
              1인칭 3D 입체기동 · 아홉 거인 총출동
            </p>
            <h1
              className="font-display mt-1.5 text-3xl tracking-tight text-white sm:text-5xl"
              style={{ textWrap: 'balance' }}
            >
              진격의 거인 · 아홉 거인 결전
            </h1>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-300">
              시구와 숲, 우트가르트 성, 수정 동굴, 레벨리오, 땅울림 종말까지 원작 8개 전장을 1인칭 시점으로 누비며 초대형·갑옷·진격·여성형·짐승·턱·차력·전퇴·시조의 거인을 토벌하십시오.
            </p>

            {/* Best Records (Unboxed Clean Metadata) */}
            {bestRecord.highScore > 0 && (
              <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 pt-3 text-xs text-slate-300 font-mono-tabular">
                <span>최고 점수 {bestRecord.highScore.toLocaleString()}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>최다 토벌 {bestRecord.maxKills}구</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>최고 웨이브 {bestRecord.maxWave}</span>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span>최고 속도 {bestRecord.bestSpeedKmh} km/h</span>
              </div>
            )}
          </div>

          <div className="mt-5 space-y-4">
            {/* District Selection (All 8 Iconic Maps) */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-400">출격 전장 선택 (8개 원작 구역)</span>
                <span className="text-xs font-medium text-amber-400 truncate">{activeDistrict.featuredTitans}</span>
              </div>
              <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {DISTRICT_LIST.map((id) => {
                  const d = DISTRICTS[id];
                  const active = districtId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onSelectDistrict(id)}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                        active
                          ? 'border-emerald-500 bg-emerald-950/60 text-white'
                          : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="text-sm font-bold leading-snug">{d.name}</span>
                      <span className="mt-0.5 text-xs text-slate-400">{d.subtitle}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                {activeDistrict.description}
              </p>
            </div>

            {/* Difficulty Selection */}
            <div>
              <div className="mb-2 text-xs font-semibold text-slate-400">난이도 선택</div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const active = difficulty === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelectDifficulty(opt.id)}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-emerald-400 ${
                        active
                          ? 'border-emerald-500 bg-emerald-950/60 text-white'
                          : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80'
                      }`}
                    >
                      <span className="text-sm font-bold whitespace-nowrap">{opt.label}</span>
                      <span className="mt-0.5 text-xs leading-snug text-slate-400">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={onStartGame}
              className="w-full rounded-lg bg-emerald-600 px-6 py-3.5 text-base font-bold text-white transition-colors hover:bg-emerald-500 active:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              1인칭 출격 시작
            </button>
          </div>
        </div>

        {/* Right Column: 3D First-Person Controls & Combat Tips */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800/90 bg-[#0F1521]/94 p-7 lg:col-span-5">
          <div>
            <h2 className="text-lg font-bold text-white">1인칭 입체기동 조작법</h2>
            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
                <dt className="text-slate-300">1인칭 시점 회전</dt>
                <dd className="font-mono-tabular font-semibold text-slate-100">화면 클릭 후 마우스 이동</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
                <dt className="text-slate-300">와이어 사출 · 감기</dt>
                <dd className="font-mono-tabular font-semibold text-emerald-400">좌클릭 / Q(좌) · E(우)</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
                <dt className="text-slate-300">쌍검 참격 (회전 베기)</dt>
                <dd className="font-mono-tabular font-semibold text-rose-400">우클릭 또는 F</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
                <dt className="text-slate-300">가스 부스트 분사</dt>
                <dd className="font-mono-tabular font-semibold text-slate-100">Space 또는 Shift</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
                <dt className="text-slate-300">이동 · 공중 제어</dt>
                <dd className="font-mono-tabular font-semibold text-slate-100">W A S D / 방향키</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
                <dt className="text-slate-300">새 칼날 교체 · 시점 전환</dt>
                <dd className="font-mono-tabular font-semibold text-amber-400">R 교체 · V 시점전환</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-slate-800/80 pb-2">
                <dt className="text-slate-300">모바일 터치 조작</dt>
                <dd className="font-mono-tabular font-semibold text-emerald-400">화면 드래그 시점 · 가상 패드</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-slate-300">일시정지</dt>
                <dd className="font-mono-tabular font-semibold text-slate-300">ESC 또는 P</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 border-t border-slate-800 pt-5">
            <h3 className="text-sm font-bold text-slate-200">전투 핵심 요령</h3>
            <ul className="mt-2.5 space-y-2 text-xs leading-relaxed text-slate-400">
              <li>
                1. 중앙 조준선이 <span className="font-semibold text-emerald-400">초록색(거리 표시)</span>일 때 와이어를 걸면 50m 방벽·건물·거인의 몸체까지 어디든 고속 도약합니다.
              </li>
              <li>
                2. 속도가 <span className="font-semibold text-slate-200">90 km/h</span> 이상일 때 뒷목(붉은 목덜미 표적)을 베면 회전 베기와 함께 일격필살이 들어갑니다.
              </li>
              <li>
                3. 초록색 빛기둥이 솟아오르는 <span className="font-semibold text-emerald-400">보급소</span>를 통과하면 가스와 예비 칼날, 체력이 즉시 회복됩니다.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
