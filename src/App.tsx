import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud, Hud3DSnapshot } from './components/GameHud';
import { GameOverModal } from './components/GameOverModal';
import { MobileControls } from './components/MobileControls';
import { PauseModal } from './components/PauseModal';
import { TitleScreen } from './components/TitleScreen';
import { soundEngine } from './game/audio';
import { BestRecord, Difficulty, DistrictId, GameState, HudSnapshot } from './game/types';
import { Aot3DEngine } from './game3d/engine3d';

const STORAGE_KEY = 'aot_wall_maria_best_v1';

const INITIAL_HUD: Hud3DSnapshot = {
  hp: 100,
  maxHp: 100,
  gas: 100,
  maxGas: 100,
  bladeDurability: 100,
  maxBladeDurability: 100,
  spareBlades: 6,
  maxSpareBlades: 6,
  speedKmh: 0,
  score: 0,
  kills: 0,
  combo: 0,
  comboTimer: 0,
  wave: 1,
  titansRemaining: 0,
  waveBannerTimer: 0,
  grabbed: false,
  escapeProgress: 0,
  reloading: false,
  nearSupply: false,
  bestSpeedKmh: 0,
  maxCombo: 0,
  muted: false,
  districtName: '월 마리아 · 시간시나 구',
  gameOverReason: '',
  hookReady: false,
  hookDist: 0,
  pointerLocked: false,
  thirdPerson: false,
  combatBanner: '',
};

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth < 768
  );
}

function loadBestRecord(): BestRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as BestRecord;
    }
  } catch {
    // ignore storage errors
  }
  return { highScore: 0, maxKills: 0, maxWave: 0, bestSpeedKmh: 0 };
}

function saveBestRecord(record: BestRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage errors
  }
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('scout');
  const [districtId, setDistrictId] = useState<DistrictId>('shiganshina');
  const [hud, setHud] = useState<Hud3DSnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState<boolean>(false);
  const [touchMode, setTouchMode] = useState<boolean>(() => detectTouchDevice());
  const [bestRecord, setBestRecord] = useState<BestRecord>(() => loadBestRecord());
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Aot3DEngine | null>(null);
  const gameStateRef = useRef<GameState>(gameState);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const handleGameOver = useCallback((finalHud: HudSnapshot) => {
    setHud((prev) => ({
      ...prev,
      ...finalHud,
    }));
    setGameState('GAME_OVER');

    setBestRecord((prev) => {
      const beatScore = finalHud.score > prev.highScore;
      setIsNewHighScore(beatScore && finalHud.score > 0);
      const next: BestRecord = {
        highScore: Math.max(prev.highScore, finalHud.score),
        maxKills: Math.max(prev.maxKills, finalHud.kills),
        maxWave: Math.max(prev.maxWave, finalHud.wave),
        bestSpeedKmh: Math.max(prev.bestSpeedKmh, finalHud.bestSpeedKmh),
      };
      saveBestRecord(next);
      return next;
    });
  }, []);

  // Initialize Three.js 3D Engine once in isolated mount container
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new Aot3DEngine(container, setHud, handleGameOver);
    engineRef.current = engine;
    engine.setTouchMode(touchMode);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [handleGameOver]);

  useEffect(() => {
    engineRef.current?.setTouchMode(touchMode);
  }, [touchMode]);

  // Global P pause shortcut (and Escape when not exiting pointer lock)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || (e.code === 'Escape' && !document.pointerLockElement)) {
        if (gameStateRef.current === 'PLAYING') {
          engineRef.current?.setPaused(true);
          setGameState('PAUSED');
        } else if (gameStateRef.current === 'PAUSED') {
          engineRef.current?.setPaused(false);
          setGameState('PLAYING');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleStartGame = useCallback(() => {
    setIsNewHighScore(false);
    setGameState('PLAYING');
    engineRef.current?.startNewGame(difficulty, districtId);
  }, [difficulty, districtId]);

  const handlePause = useCallback(() => {
    engineRef.current?.setPaused(true);
    setGameState('PAUSED');
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.setPaused(false);
    setGameState('PLAYING');
  }, []);

  const handleExitToTitle = useCallback(() => {
    engineRef.current?.stop();
    setGameState('TITLE_MENU');
  }, []);

  const handleToggleMute = useCallback(() => {
    if (engineRef.current) {
      const next = engineRef.current.toggleMute();
      setMuted(next);
    } else {
      const next = !soundEngine.isMuted();
      soundEngine.setMuted(next);
      setMuted(next);
    }
  }, []);

  const handleToggleView = useCallback(() => {
    engineRef.current?.toggleView();
  }, []);

  const handleToggleTouchMode = useCallback(() => {
    setTouchMode((prev) => !prev);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#0B0F17]">
      {/* Dedicated Isolated 3D WebGL Mount Container */}
      <div
        ref={mountRef}
        className={`h-full w-full ${gameState === 'TITLE_MENU' ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
      />

      {gameState === 'TITLE_MENU' && (
        <div className="absolute inset-0 z-20 overflow-y-auto">
          <TitleScreen
            difficulty={difficulty}
            onSelectDifficulty={setDifficulty}
            districtId={districtId}
            onSelectDistrict={setDistrictId}
            onStartGame={handleStartGame}
            bestRecord={bestRecord}
            muted={muted}
            onToggleMute={handleToggleMute}
          />
        </div>
      )}

      {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
        <GameHud
          hud={{ ...hud, muted }}
          touchMode={touchMode}
          onToggleTouchMode={handleToggleTouchMode}
          onPause={handlePause}
          onToggleMute={handleToggleMute}
          onToggleView={handleToggleView}
        />
      )}

      {gameState === 'PLAYING' && touchMode && (
        <MobileControls
          wireActiveReady={hud.hookReady}
          bladeDurability={hud.bladeDurability}
          spareBlades={hud.spareBlades}
          reloading={hud.reloading}
          grabbed={hud.grabbed}
          onMoveChange={(x, y) => engineRef.current?.setVirtualMove(x, y)}
          onWireChange={(active) => engineRef.current?.setVirtualWire(active)}
          onBoostChange={(active) => engineRef.current?.setVirtualBoost(active)}
          onSlash={() => engineRef.current?.triggerSlashAction()}
          onReload={() => engineRef.current?.triggerReloadAction()}
        />
      )}

      {gameState === 'PAUSED' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleStartGame}
          onExitToTitle={handleExitToTitle}
        />
      )}

      {gameState === 'GAME_OVER' && (
        <GameOverModal
          hud={hud}
          bestRecord={bestRecord}
          isNewHighScore={isNewHighScore}
          onPlayAgain={handleStartGame}
          onExitToTitle={handleExitToTitle}
        />
      )}
    </main>
  );
}
