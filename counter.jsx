import { useState, useRef, useCallback, useEffect } from "react";

const HOLD_MS = 700;
const TARGET = 999999;

export default function Counter() {
  const [angka, setAngka] = useState(0);
  const [pressedPlus, setPressedPlus] = useState(false);
  const [pressedMinus, setPressedMinus] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);
  const [flash, setFlash] = useState(null); // "plus" | "minus" | "reset" | null
  const [celebrating, setCelebrating] = useState(false);

  const holdTimer = useRef(null);
  const holdInterval = useRef(null);
  const holdStart = useRef(0);
  const triggeredReset = useRef(false);
  const activePointer = useRef(false);

  const clearHold = useCallback(() => {
    clearTimeout(holdTimer.current);
    clearInterval(holdInterval.current);
    setHoldProgress(0);
  }, []);

  const runFlash = (type) => {
    setFlash(type);
    setPulseKey((k) => k + 1);
  };

  const startCelebration = useCallback(() => {
    setCelebrating(true);
    setTimeout(() => {
      setCelebrating(false);
      setAngka(0);
      runFlash("reset");
    }, 2600);
  }, []);

  const startHold = useCallback((e) => {
    if (celebrating) return;
    e.preventDefault();
    if (activePointer.current) return;
    activePointer.current = true;
    setPressedMinus(true);
    triggeredReset.current = false;
    holdStart.current = Date.now();

    holdInterval.current = setInterval(() => {
      const elapsed = Date.now() - holdStart.current;
      setHoldProgress(Math.min(1, elapsed / HOLD_MS));
    }, 16);

    holdTimer.current = setTimeout(() => {
      triggeredReset.current = true;
      setAngka(0);
      runFlash("reset");
      clearHold();
    }, HOLD_MS);
  }, [clearHold, celebrating]);

  const endHold = useCallback((e) => {
    e.preventDefault();
    if (!activePointer.current) return;
    activePointer.current = false;
    setPressedMinus(false);
    if (!triggeredReset.current) {
      setAngka((a) => a - 10);
      runFlash("minus");
    }
    clearHold();
  }, [clearHold]);

  const cancelHold = useCallback((e) => {
    activePointer.current = false;
    setPressedMinus(false);
    clearHold();
  }, [clearHold]);

  const handlePlus = useCallback((e) => {
    e.preventDefault();
    if (celebrating) return;
    setAngka((a) => {
      const next = a + 1;
      if (next >= TARGET) {
        setTimeout(startCelebration, 50);
        return TARGET;
      }
      return next;
    });
    runFlash("plus");
  }, [celebrating, startCelebration]);

  const flashClass =
    flash === "plus"
      ? "from-emerald-300 via-teal-300 to-cyan-300"
      : flash === "minus"
      ? "from-orange-300 via-rose-300 to-red-400"
      : flash === "reset"
      ? "from-violet-300 via-fuchsia-300 to-pink-300"
      : "from-cyan-300 via-fuchsia-300 to-amber-300";

  return (
    <div
      className="relative min-h-screen flex items-center justify-center p-6 overflow-hidden"
      style={{
        background:
          "linear-gradient(120deg,#0a0714,#1e0f3c,#3c0f2e,#0a0714)",
        backgroundSize: "300% 300%",
        animation: "bgshift 12s ease infinite",
      }}
    >
      {/* ambient glow blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-fuchsia-600/30 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-cyan-500/25 blur-[100px]" />
      <div className="pointer-events-none absolute top-1/3 right-0 w-56 h-56 rounded-full bg-amber-400/10 blur-[80px]" />

      {celebrating && <Confetti />}

      <div className="relative w-full max-w-xs rounded-[2rem] p-8 flex flex-col items-center gap-7 bg-white/[0.06] backdrop-blur-2xl border border-white/10 shadow-[0_0_80px_-15px_rgba(168,85,247,0.55)]">
        <h1 className="text-center text-lg font-black tracking-tight text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]">
          Fight till{" "}
          <span className="bg-gradient-to-r from-amber-300 to-rose-400 bg-clip-text text-transparent">
            999999
          </span>{" "}
          🤓
        </h1>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-semibold tracking-[0.35em] text-fuchsia-300/60 uppercase">
            Angka
          </span>
          <div
            key={pulseKey}
            className={`text-6xl sm:text-7xl font-black tabular-nums bg-gradient-to-br ${flashClass} bg-clip-text text-transparent animate-[pop_0.35s_ease-out] transition-[background] duration-300`}
          >
            {angka.toLocaleString("id-ID")}
          </div>
        </div>

        <div className="flex gap-5">
          <button
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={cancelHold}
            onPointerCancel={cancelHold}
            disabled={celebrating}
            className={`relative w-20 h-20 rounded-2xl overflow-hidden text-white text-3xl font-bold select-none
              bg-gradient-to-br from-rose-500 to-orange-500
              shadow-[0_6px_0_0_#9f1239,0_10px_24px_-6px_rgba(244,63,94,0.6)]
              transition-transform duration-100 ease-out disabled:opacity-40
              ${pressedMinus ? "translate-y-[6px] shadow-none scale-95" : "hover:brightness-110"}
            `}
          >
            <span
              className="absolute inset-0 bg-white/30"
              style={{
                transform: `scaleX(${holdProgress})`,
                transformOrigin: "left",
                transition: holdProgress === 0 ? "transform 0.15s ease-out" : "none",
              }}
            />
            <span className="relative">−</span>
          </button>

          <button
            onPointerDown={() => !celebrating && setPressedPlus(true)}
            onPointerUp={(e) => {
              setPressedPlus(false);
              handlePlus(e);
            }}
            onPointerLeave={() => setPressedPlus(false)}
            onPointerCancel={() => setPressedPlus(false)}
            disabled={celebrating}
            className={`w-20 h-20 rounded-2xl text-white text-3xl font-bold select-none
              bg-gradient-to-br from-emerald-400 to-cyan-500
              shadow-[0_6px_0_0_#0e7490,0_10px_24px_-6px_rgba(16,185,129,0.6)]
              transition-transform duration-100 ease-out disabled:opacity-40
              ${pressedPlus ? "translate-y-[6px] shadow-none scale-95" : "hover:brightness-110"}
            `}
          >
            +
          </button>
        </div>

        <p className="text-[11px] text-white/40 text-center leading-relaxed">
          Tekan <span className="text-orange-300">−</span> sebentar untuk −10.
          <br />
          Tahan <span className="text-orange-300">−</span> agak lama untuk reset ke 0.
        </p>
      </div>

      {celebrating && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <div className="animate-[popIn_0.5s_ease-out] text-center px-8 py-6 rounded-3xl bg-black/40 backdrop-blur-md border border-white/20 shadow-2xl">
            <div className="text-4xl mb-2">🏆🎉</div>
            <div className="text-2xl font-black bg-gradient-to-r from-amber-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              Selamat!
            </div>
            <div className="text-white/70 text-sm mt-1">Kamu berhasil capai 999999 🗿</div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bgshift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pop {
          0% { transform: scale(0.7); opacity: 0.4; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes popIn {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(360deg); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}

function Confetti() {
  const pieces = ["🎉", "✨", "🏆", "🎊", "⭐"];
  const items = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.2,
    duration: 2 + Math.random() * 1.5,
    emoji: pieces[i % pieces.length],
    size: 14 + Math.random() * 16,
  }));

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden">
      {items.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            fontSize: `${p.size}px`,
            animation: `fall ${p.duration}s linear ${p.delay}s infinite`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
