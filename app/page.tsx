"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Board, Card, HandResult, HandType, Rank, Suit } from "../types/game";
import { judgeHandsAfterPlace } from "../lib/handJudge";

const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];

const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

type SoundType = "place" | "pair" | "clear" | "combo" | "deny" | "restart";
type HapticType = "place" | "pair" | "clear" | "combo" | "deny" | "restart";

function createEmptyBoard(): Board {
  return Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => null)
  );
}

function createDeck(): Card[] {
  const deck: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
      });
    }
  }

  return deck;
}

function shuffle<T>(array: T[]): T[] {
  const copied = [...array];

  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }

  return copied;
}

function suitSymbol(suit: Suit): string {
  switch (suit) {
    case "spade":
      return "♠";
    case "heart":
      return "♥";
    case "diamond":
      return "♦";
    case "club":
      return "♣";
  }
}

function isRedSuit(suit: Suit): boolean {
  return suit === "heart" || suit === "diamond";
}

function hasEmptyCell(board: Board): boolean {
  return board.some((line) => line.some((cell) => cell === null));
}

const HIGH_SCORE_KEY = "nuts-high-score";

const BALANCED_SCORE_TABLE: Record<HandType, number> = {
  ROYAL_STRAIGHT_FLUSH: 1200,
  STRAIGHT_FLUSH: 800,
  FOUR_CARD: 500,
  FULL_HOUSE: 320,
  FLUSH: 260,
  STRAIGHT: 160,
  THREE_CARD: 120,
  TWO_PAIR: 80,
  ONE_PAIR: 20,
};

function getBalancedScore(type: HandType): number {
  return BALANCED_SCORE_TABLE[type];
}

function handName(type: string): string {
  switch (type) {
    case "ROYAL_STRAIGHT_FLUSH":
      return "Royal Straight Flush";
    case "STRAIGHT_FLUSH":
      return "Straight Flush";
    case "FOUR_CARD":
      return "Four Card";
    case "FULL_HOUSE":
      return "Full House";
    case "FLUSH":
      return "Flush";
    case "STRAIGHT":
      return "Straight";
    case "THREE_CARD":
      return "Three Card";
    case "TWO_PAIR":
      return "Two Pair";
    case "ONE_PAIR":
      return "One Pair";
    default:
      return type;
  }
}


function useQuietSound() {
  const [volume, setVolume] = useState(0.7);
  const audioContextRef = useRef<AudioContext | null>(null);

  function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  }

  function unlock() {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }
  }

  function play(type: SoundType) {
    if (volume <= 0) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime + 0.006;
    const safeVolume = Math.min(1, Math.max(0, volume));
    const isMobileLike =
      typeof window !== "undefined" &&
      ((typeof window.matchMedia === "function" &&
        window.matchMedia("(pointer: coarse)").matches) ||
        navigator.maxTouchPoints > 0);
    const internalVolumeBoost = isMobileLike ? 3 : 1;
    const masterPeak = 0.13 * safeVolume * internalVolumeBoost;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(
      Math.max(0.0001, masterPeak),
      now + 0.012
    );
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    master.connect(ctx.destination);

    const notes: Record<SoundType, number[]> = {
      place: [520],
      pair: [520, 660],
      clear: [440, 620, 760],
      combo: [760, 920],
      deny: [180],
      restart: [520, 360],
    };

    notes[type].forEach((freq, index) => {
      const start = now + index * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      const notePeak =
        (type === "deny" ? 0.08 : 0.15) * safeVolume * internalVolumeBoost;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, notePeak),
        start + 0.012
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

      osc.connect(gain);
      gain.connect(master);

      osc.start(start);
      osc.stop(start + 0.14);
    });

    window.setTimeout(() => {
      master.disconnect();
    }, 360);
  }

  return {
    volume,
    setVolume,
    unlock,
    play,
  };
}

function useQuietHaptics() {
  function play(type: HapticType) {
    if (typeof window === "undefined") return;
    if (!("vibrate" in navigator)) return;

    const patterns: Record<HapticType, number | number[]> = {
      place: 10,
      pair: [12, 28, 16],
      clear: [16, 32, 24],
      combo: [8, 22, 8, 22, 14],
      deny: 24,
      restart: [10, 24, 10],
    };

    navigator.vibrate(patterns[type]);
  }

  return {
    play,
  };
}

function CardView({
  card,
  large = false,
}: {
  card: Card;
  large?: boolean;
}) {
  const red = isRedSuit(card.suit);

  return (
    <div
      className={[
        "flex h-full w-full flex-col items-center justify-center rounded-[18px]",
        "border border-black/10 bg-[#F5F1E8]",
        "shadow-[0_8px_22px_rgba(0,0,0,0.14)]",
        large ? "gap-4 p-5" : "gap-2 p-3",
      ].join(" ")}
    >
      <span
        className={[
          "font-black leading-none tracking-tight",
          red ? "text-[#9F3F3F]" : "text-[#111111]",
          large ? "text-5xl" : "text-2xl",
        ].join(" ")}
      >
        {card.rank}
      </span>

      <span
        className={[
          "font-black leading-none",
          red ? "text-[#9F3F3F]" : "text-[#111111]",
          large ? "text-6xl" : "text-3xl",
        ].join(" ")}
      >
        {suitSymbol(card.suit)}
      </span>
    </div>
  );
}

function MiniCardView({ card }: { card: Card }) {
  const red = isRedSuit(card.suit);

  return (
    <div className="flex h-16 w-12 flex-col items-center justify-center gap-1 rounded-xl border border-black/10 bg-[#F5F1E8] shadow-lg">
      <span
        className={[
          "text-base font-black leading-none",
          red ? "text-[#9F3F3F]" : "text-[#111111]",
        ].join(" ")}
      >
        {card.rank}
      </span>

      <span
        className={[
          "text-lg font-black leading-none",
          red ? "text-[#9F3F3F]" : "text-[#111111]",
        ].join(" ")}
      >
        {suitSymbol(card.suit)}
      </span>
    </div>
  );
}

export default function Page() {
  const sound = useQuietSound();
  const haptics = useQuietHaptics();
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [deck, setDeck] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [combo, setCombo] = useState(0);
  const [turnsSinceHand, setTurnsSinceHand] = useState(0);
  const [lastHands, setLastHands] = useState<HandResult[]>([]);
  const [message, setMessage] = useState("No hand.");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"rules" | "hands" | "combo" | "sfx" | "privacy">("rules");
  const [pressedCell, setPressedCell] = useState<string | null>(null);
  const [deniedCell, setDeniedCell] = useState<string | null>(null);
  const [comboPulse, setComboPulse] = useState(false);
  const [boardPulse, setBoardPulse] = useState<"hand" | "clear" | null>(null);

  useEffect(() => {
    const newDeck = shuffle(createDeck());

    setBoard(createEmptyBoard());
    setCurrentCard(newDeck[0] ?? null);
    setDeck(newDeck.slice(1));
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? "0");
    if (Number.isFinite(saved) && saved > 0) {
      setHighScore(saved);
    }
  }, []);

  const highlightedCells = useMemo(() => {
    const set = new Set<string>();

    for (const hand of lastHands) {
      for (const item of hand.cards) {
        set.add(`${item.row}-${item.col}`);
      }
    }

    return set;
  }, [lastHands]);

  function flashPressedCell(row: number, col: number) {
    const key = `${row}-${col}`;
    setPressedCell(key);

    window.setTimeout(() => {
      setPressedCell((current) => (current === key ? null : current));
    }, 150);
  }

  function flashDeniedCell(row: number, col: number) {
    const key = `${row}-${col}`;
    setDeniedCell(key);

    window.setTimeout(() => {
      setDeniedCell((current) => (current === key ? null : current));
    }, 180);
  }

  function flashBoard(type: "hand" | "clear") {
    setBoardPulse(type);

    window.setTimeout(() => {
      setBoardPulse(null);
    }, type === "clear" ? 320 : 240);
  }

  function flashCombo() {
    setComboPulse(true);

    window.setTimeout(() => {
      setComboPulse(false);
    }, 260);
  }

  function resetGame() {
    sound.play("restart");
    haptics.play("restart");

    const newDeck = shuffle(createDeck());

    setBoard(createEmptyBoard());
    setDeck(newDeck.slice(1));
    setCurrentCard(newDeck[0] ?? null);
    setScore(0);
    setCombo(0);
    setTurnsSinceHand(0);
    setLastHands([]);
    setMessage("New game.");
    setIsGameOver(false);
    setIsNewBest(false);
    setPressedCell(null);
    setDeniedCell(null);
    setComboPulse(false);
    setBoardPulse(null);
  }

  function placeCard(row: number, col: number) {
    if (isGameOver) {
      sound.play("deny");
      haptics.play("deny");
      return;
    }

    if (!currentCard) {
      sound.play("deny");
      haptics.play("deny");
      return;
    }

    if (board[row][col]) {
      sound.play("deny");
      haptics.play("deny");
      flashDeniedCell(row, col);
      return;
    }

    flashPressedCell(row, col);
    sound.play("place");
    haptics.play("place");

    const nextBoard = board.map((line) => [...line]);
    nextBoard[row][col] = currentCard;

    const hands = judgeHandsAfterPlace(nextBoard, { row, col });

    let nextCombo = combo;
    let nextTurnsSinceHand = turnsSinceHand;

    if (hands.length > 0) {
      nextCombo = turnsSinceHand <= 3 ? combo + 1 : 1;
      nextTurnsSinceHand = 0;
    } else {
      nextTurnsSinceHand = turnsSinceHand + 1;

      if (nextTurnsSinceHand > 3) {
        nextCombo = 0;
      }
    }

    let gainedScore = 0;

    for (const hand of hands) {
      const comboMultiplier = Math.max(1, nextCombo);
      gainedScore += getBalancedScore(hand.type) * comboMultiplier;
    }

    for (const hand of hands) {
      if (!hand.shouldClear) continue;

      for (const item of hand.cards) {
        nextBoard[item.row][item.col] = null;
      }
    }

    let nextDeck = [...deck];
    let nextCard = nextDeck.shift() ?? null;

    // Endless mode:
    // When the draw pile runs out, quietly reshuffle a fresh 52-card deck.
    // The game only ends when the board has no empty cells left.
    if (!nextCard) {
      const freshDeck = shuffle(createDeck());
      nextCard = freshDeck[0] ?? null;
      nextDeck = freshDeck.slice(1);
    }

    const finalScore = score + gainedScore;
    const shouldEndGame = !hasEmptyCell(nextBoard);

    setBoard(nextBoard);
    setDeck(nextDeck);
    setCurrentCard(nextCard);
    setScore(finalScore);
    setCombo(nextCombo);
    setTurnsSinceHand(nextTurnsSinceHand);
    setLastHands(hands);

    if (finalScore > highScore) {
      setHighScore(finalScore);
      setIsNewBest(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(finalScore));
      }
    }

    if (shouldEndGame) {
      setIsGameOver(true);
      setMessage("Game Over");

      if (finalScore <= highScore) {
        setIsNewBest(false);
      }
    }

    if (hands.length > 0) {
      const hasClearHand = hands.some((hand) => hand.shouldClear);
      setMessage(hands.map((hand) => handName(hand.type)).join(" + "));
      flashBoard(hasClearHand ? "clear" : "hand");

      window.setTimeout(() => {
        sound.play(hasClearHand ? "clear" : "pair");
        haptics.play(hasClearHand ? "clear" : "pair");
      }, 35);

      if (nextCombo >= 2) {
        flashCombo();

        window.setTimeout(() => {
          sound.play("combo");
          haptics.play("combo");
        }, 155);
      }
    } else if (!shouldEndGame) {
      setMessage("No hand.");
    }
  }

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#090909] text-[#F3F0E8]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">
          Loading NUTS
        </p>
      </main>
    );
  }

  return (
    <main
      onPointerDown={sound.unlock}
      onContextMenu={(event) => event.preventDefault()}
      className="h-[100dvh] select-none overflow-hidden bg-[#090909] text-[#F3F0E8] lg:min-h-screen lg:px-5 lg:py-5"
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      } as CSSProperties}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#28221A_0%,transparent_34%),linear-gradient(180deg,#090909_0%,#101010_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* Mobile layout */}
      <div className="relative flex h-[100dvh] flex-col gap-3 px-3 lg:hidden"
        style={{
          paddingTop: "max(18px, calc(env(safe-area-inset-top) + 16px))",
          paddingBottom: "max(12px, calc(env(safe-area-inset-bottom) + 12px))",
        }}>
        <header className="flex h-[86px] shrink-0 items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.04] px-4 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#D6B36A]">
              NUTS
            </p>
            <p className="mt-1 text-3xl font-black tracking-[-0.08em]">
              {score}
            </p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-white/30">
              Best {highScore}
            </p>
            {isNewBest ? (
              <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-[#D6B36A]">
                New Best
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
                Combo
              </p>
              <p
                className={[
                  "text-xl font-black text-[#D6B36A] transition duration-300",
                  comboPulse ? "scale-[1.08] text-[#F5F1E8]" : "",
                ].join(" ")}
              >
                x{combo}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
                Deck
              </p>
              <p className="text-xl font-black">{deck.length}</p>
            </div>

            {currentCard ? (
              <MiniCardView card={currentCard} />
            ) : (
              <div className="flex h-16 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[10px] font-bold uppercase tracking-widest text-white/35">
                End
              </div>
            )}
          </div>
        </header>

        <section
          className={[
            "flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] p-2 backdrop-blur-xl transition duration-300",
            boardPulse === "hand" ? "bg-[#D6B36A]/[0.025]" : "",
            boardPulse === "clear" ? "border-[#D6B36A]/25 bg-[#D6B36A]/[0.035]" : "",
          ].join(" ")}
        >
          <div className="grid aspect-square h-[92%] max-h-[92%] max-w-full grid-cols-5 gap-2">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);
                const isPressed = pressedCell === key;
                const isDenied = deniedCell === key;

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    disabled={isGameOver}
                    className={[
                      "group relative select-none touch-manipulation overflow-hidden rounded-[16px] border transition duration-200",
                      "bg-white/[0.045] hover:bg-white/[0.075]",
                      cell ? "border-white/10" : "border-white/[0.075]",
                      isPressed ? "scale-[0.965] bg-white/[0.085]" : "",
                      isDenied ? "translate-x-[1px] border-[#9F3F3F]/45 bg-[#9F3F3F]/[0.045]" : "",
                      isHighlighted
                        ? "border-[#D6B36A]/55 bg-[#D6B36A]/[0.035] shadow-[0_0_0_1px_rgba(214,179,106,0.18)]"
                        : "",
                    ].join(" ")}
                  >
                    {cell ? (
                      <div className="absolute inset-1">
                        <CardView card={cell} />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xl font-light text-white/12">
                          +
                        </span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <footer className="flex h-[48px] shrink-0 items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 backdrop-blur-xl">
          <button
            onClick={() => {
              setSettingsTab("rules");
              setIsSettingsOpen(true);
            }}
            className="flex h-9 select-none touch-manipulation items-center gap-2 rounded-xl border border-white/10 bg-white/[0.045] px-3 text-[10px] font-black uppercase tracking-[0.16em] text-[#F5F1E8]"
          >
            <span className="text-sm">⚙</span>
            Settings
          </button>


          <button
            onClick={resetGame}
            className="h-9 rounded-xl bg-[#F5F1E8] px-3 text-[10px] font-black uppercase tracking-[0.18em] text-black"
          >
            Restart
          </button>
        </footer>
      </div>

      {/* Desktop layout */}
      <div className="relative mx-auto hidden min-h-[calc(100vh-40px)] w-full max-w-[1380px] grid-cols-[260px_minmax(520px,1fr)_280px] gap-5 lg:grid">
        <aside className="rounded-[30px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-[#D6B36A]">
              Poker Grid
            </p>
            <h1 className="mt-3 text-5xl font-black tracking-[-0.08em] text-[#F5F1E8]">
              NUTS
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/42">
              Build connected hands across a silent 5×5 table.
            </p>
          </div>

          <div className="mt-10 space-y-5">
            <div className="border-t border-white/10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
                Score
              </p>
              <p className="mt-2 text-5xl font-black tracking-[-0.08em]">
                {score}
              </p>
            </div>

            <div className="border-t border-white/10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
                Best
              </p>
              <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-white/70">
                {highScore}
              </p>
              {isNewBest ? (
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#D6B36A]">
                  New Best
                </p>
              ) : null}
            </div>

            <div className="border-t border-white/10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
                Combo
              </p>
              <p
                className={[
                  "mt-2 text-4xl font-black tracking-[-0.06em] text-[#D6B36A] transition duration-300",
                  comboPulse ? "scale-[1.035] text-[#F5F1E8]" : "",
                ].join(" ")}
              >
                x{combo}
              </p>
            </div>

            <div className="border-t border-white/10 pt-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
                Deck
              </p>
              <p className="mt-2 text-4xl font-black tracking-[-0.06em]">
                {deck.length}
              </p>
            </div>
          </div>

          <button
            onClick={resetGame}
            className={[
              "mt-10 w-full rounded-2xl border border-white/10",
              "bg-[#F5F1E8] px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-black",
              "transition hover:scale-[1.015] hover:bg-white active:scale-[0.99]",
            ].join(" ")}
          >
            Restart
          </button>
        </aside>

        <section
          className={[
            "flex min-h-[620px] items-center justify-center rounded-[34px] border border-white/10 bg-white/[0.025] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300",
            boardPulse === "hand" ? "bg-[#D6B36A]/[0.025]" : "",
            boardPulse === "clear" ? "border-[#D6B36A]/25 bg-[#D6B36A]/[0.035]" : "",
          ].join(" ")}
        >
          <div className="grid aspect-square w-full max-w-[680px] grid-cols-5 gap-3">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);
                const isPressed = pressedCell === key;
                const isDenied = deniedCell === key;

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    disabled={isGameOver}
                    className={[
                      "group relative select-none touch-manipulation overflow-hidden rounded-[22px] border transition duration-200",
                      "bg-white/[0.045] hover:bg-white/[0.075]",
                      cell ? "border-white/10" : "border-white/[0.075]",
                      isPressed ? "scale-[0.975] bg-white/[0.085]" : "",
                      isDenied ? "translate-x-[1px] border-[#9F3F3F]/45 bg-[#9F3F3F]/[0.045]" : "",
                      isHighlighted
                        ? "border-[#D6B36A]/55 bg-[#D6B36A]/[0.035] shadow-[0_0_0_1px_rgba(214,179,106,0.18)]"
                        : "",
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_top,#ffffff18,transparent_60%)]" />

                    {cell ? (
                      <div className="absolute inset-2">
                        <CardView card={cell} />
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-light text-white/12">
                          +
                        </span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <aside className="rounded-[30px] border border-white/10 bg-white/[0.035] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
              Current Card
            </p>

            <div className="mt-4 aspect-[3/4] w-full rounded-[26px] bg-white/[0.04] p-3">
              {currentCard ? (
                <CardView card={currentCard} large />
              ) : (
                <div className="flex h-full items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03]">
                  <span className="text-sm font-bold uppercase tracking-[0.25em] text-white/35">
                    End
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
              Status
            </p>
            <p className="mt-3 text-xl font-black tracking-[-0.04em] text-[#F5F1E8]">
              {message}
            </p>
          </div>

          <button
            onClick={() => {
              setSettingsTab("rules");
              setIsSettingsOpen(true);
            }}
            className={[
              "mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10",
              "bg-white/[0.045] px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-[#F5F1E8]",
              "transition hover:bg-white/[0.075] active:scale-[0.99]",
            ].join(" ")}
          >
            <span className="text-lg">⚙</span>
            Settings
          </button>

        </aside>
      </div>

      {isGameOver ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[440px] rounded-[30px] border border-white/10 bg-[#121212] p-6 text-center shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#D6B36A]">
              {isNewBest ? "New Best" : "Game Over"}
            </p>
            <h2 className="mt-3 text-5xl font-black tracking-[-0.08em] text-[#F5F1E8]">
              {score}
            </h2>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-white/35">
              Best Score {highScore}
            </p>

            {isNewBest ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm leading-6 text-white/50">
                  最高スコアを更新しました。もう一度走って、さらに上を狙いましょう。
                </p>
              </div>
            ) : null}

            <button
              onClick={resetGame}
              className="mt-6 w-full rounded-2xl bg-[#F5F1E8] px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-black transition hover:bg-white active:scale-[0.99]"
            >
              Restart
            </button>
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="flex max-h-[92svh] w-full max-w-[620px] flex-col rounded-[28px] border border-white/10 bg-[#121212] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
            <div className="flex shrink-0 items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#D6B36A]">
                  Settings
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#F5F1E8]">
                  NUTS
                </h2>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-xl font-black text-white/70 transition hover:bg-white/[0.08]"
                aria-label="Close settings"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid shrink-0 grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1 sm:grid-cols-5">
              {[
                { key: "rules", label: "Rules" },
                { key: "hands", label: "Hands" },
                { key: "combo", label: "Combo" },
                { key: "sfx", label: "SFX" },
                { key: "privacy", label: "Privacy" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() =>
                    setSettingsTab(
                      item.key as "rules" | "hands" | "combo" | "sfx" | "privacy"
                    )
                  }
                  className={[
                    "rounded-xl px-2 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition sm:text-xs",
                    settingsTab === item.key
                      ? "bg-[#F5F1E8] text-black"
                      : "text-white/45 hover:bg-white/[0.05] hover:text-white/75",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-5 min-h-0 overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-5">
              {settingsTab === "rules" ? (
                <div className="space-y-4 text-sm leading-7 text-white/62">
                  <h3 className="text-xl font-black text-[#F5F1E8]">
                    Rules
                  </h3>
                  <p>
                    5×5のボードにカードを置き、縦または横に隣り合ったカードで役を作ります。斜め方向は判定しません。
                  </p>
                  <p>
                    空白を挟んだカードはつながっていないため、役として成立しません。実プレイでは、今回置いたカードを含む役だけがスコア・コンボ・演出の対象になります。
                  </p>
                  <p>
                    One Pairはスコアとコンボ対象ですが消えません。Three Card以上の役は成立後に消えます。
                  </p>
                  <p>
                    デッキが尽きると自動で新しい52枚デッキに切り替わります。置けるマスがなくなるとラン終了です。
                  </p>
                </div>
              ) : null}

              {settingsTab === "hands" ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xl font-black text-[#F5F1E8]">
                      Hands & Scores
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      強い役ほど高得点です。One Pairだけは消えず、それ以外は静かに消えます。
                    </p>
                  </div>

                  <div className="space-y-2">
                    {[
                      ["Royal Straight Flush", "1200", "Clear"],
                      ["Straight Flush", "800", "Clear"],
                      ["Four Card", "500", "Clear"],
                      ["Full House", "320", "Clear"],
                      ["Flush", "260", "Clear"],
                      ["Straight", "160", "Clear"],
                      ["Three Card", "120", "Clear"],
                      ["Two Pair", "80", "Clear"],
                      ["One Pair", "20", "Keep"],
                    ].map(([name, points, behavior]) => (
                      <div
                        key={name}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3"
                      >
                        <p className="text-sm font-bold text-white/72">{name}</p>
                        <p className="text-sm font-black text-[#D6B36A]">
                          {points}
                        </p>
                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
                          {behavior}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-7 text-white/52">
                    <p>
                      Straightは3枚以上で成立します。A-2-3、3-2-A、Q-K-A、A-K-QもStraightとして扱います。
                    </p>
                    <p className="mt-2">
                      Full HouseはAAA22または22AAAの形だけ成立します。QQ88Qのようにバラけた並びはFull Houseではありません。
                    </p>
                  </div>
                </div>
              ) : null}

              {settingsTab === "combo" ? (
                <div className="space-y-4 text-sm leading-7 text-white/62">
                  <h3 className="text-xl font-black text-[#F5F1E8]">
                    Combo
                  </h3>
                  <p>
                    役を作るとコンボが増えます。One Pairもコンボ対象です。
                  </p>
                  <p>
                    役成立から3ターン以内に次の役を作るとコンボが継続します。4ターン以上空くとコンボはリセットされます。
                  </p>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                      Score Formula
                    </p>
                    <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#D6B36A]">
                      Hand Score × Combo
                    </p>
                    <p className="mt-3 text-white/48">
                      例：Straight 180点をx3で成立させると、540点入ります。
                    </p>
                  </div>
                </div>
              ) : null}

              {settingsTab === "sfx" ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-black text-[#F5F1E8]">
                      SFX Volume
                    </h3>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                        Volume
                      </p>
                      <p className="min-w-12 text-right text-sm font-black text-[#D6B36A]">
                        {Math.round(sound.volume * 100)}%
                      </p>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={sound.volume}
                      onChange={(event) =>
                        sound.setVolume(Number(event.currentTarget.value))
                      }
                      className="mt-5 w-full accent-[#D6B36A]"
                      aria-label="SFX volume"
                    />

                    <button
                      onClick={() => sound.play("place")}
                      className="mt-5 w-full rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white/65 transition hover:bg-white/[0.075]"
                    >
                      Test Sound
                    </button>
                  </div>
                </div>
              ) : null}

              {settingsTab === "privacy" ? (
                <div className="space-y-4 text-sm leading-7 text-white/62">
                  <h3 className="text-xl font-black text-[#F5F1E8]">
                    Privacy Policy
                  </h3>
                  <p>
                    NUTSは、ゲームプレイに必要な範囲を超えて個人情報を収集しません。
                  </p>
                  <p>
                    現在のバージョンでは、入力フォーム、アカウント作成、位置情報取得、決済機能はありません。
                  </p>
                  <p>
                    ハイスコアと効果音の音量設定は、お使いのブラウザ内のlocalStorageに保存されます。外部サーバーには送信されません。
                  </p>
                  <p>
                    今後アクセス解析や広告を導入する場合は、必要な情報をこの画面または公開ページ上で明示します。
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
