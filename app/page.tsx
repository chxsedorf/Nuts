"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Board, Card, HandResult, Rank, Suit } from "../types/game";
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

function createEmptyBoard(): Board {
  return Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null));
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

function CardView({ card, large = false }: { card: Card; large?: boolean }) {
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

type QuietSoundName =
  | "place"
  | "pair"
  | "clear"
  | "combo"
  | "restart"
  | "blocked";

function useQuietSoundEngine() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(true);

  function getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;

    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  }

  function playTone({
    frequency,
    delay = 0,
    duration = 0.06,
    volume = 0.018,
    type = "sine",
    lowpass = 2800,
  }: {
    frequency: number;
    delay?: number;
    duration?: number;
    volume?: number;
    type?: OscillatorType;
    lowpass?: number;
  }) {
    const context = getAudioContext();
    if (!context) return;

    void context.resume();

    const now = context.currentTime;
    const start = now + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(lowpass, start);
    filter.Q.setValueAtTime(0.6, start);

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function play(name: QuietSoundName) {
    if (!enabled) return;

    switch (name) {
      case "place":
        playTone({
          frequency: 620,
          duration: 0.035,
          volume: 0.012,
          lowpass: 2200,
        });
        break;
      case "pair":
        playTone({
          frequency: 520,
          duration: 0.07,
          volume: 0.014,
          lowpass: 2400,
        });
        playTone({
          frequency: 680,
          delay: 0.045,
          duration: 0.09,
          volume: 0.012,
          lowpass: 2600,
        });
        break;
      case "clear":
        playTone({
          frequency: 392,
          duration: 0.08,
          volume: 0.014,
          lowpass: 2200,
        });
        playTone({
          frequency: 494,
          delay: 0.04,
          duration: 0.1,
          volume: 0.013,
          lowpass: 2400,
        });
        playTone({
          frequency: 659,
          delay: 0.085,
          duration: 0.12,
          volume: 0.011,
          lowpass: 2600,
        });
        break;
      case "combo":
        playTone({
          frequency: 880,
          duration: 0.045,
          volume: 0.01,
          lowpass: 3000,
        });
        playTone({
          frequency: 1175,
          delay: 0.04,
          duration: 0.055,
          volume: 0.008,
          lowpass: 3200,
        });
        break;
      case "restart":
        playTone({
          frequency: 330,
          duration: 0.06,
          volume: 0.012,
          lowpass: 1800,
        });
        playTone({
          frequency: 247,
          delay: 0.045,
          duration: 0.08,
          volume: 0.01,
          lowpass: 1600,
        });
        break;
      case "blocked":
        playTone({
          frequency: 180,
          duration: 0.035,
          volume: 0.01,
          type: "triangle",
          lowpass: 900,
        });
        break;
    }
  }

  function toggleEnabled() {
    setEnabled((current) => !current);
  }

  return {
    enabled,
    play,
    toggleEnabled,
  };
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
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [deck, setDeck] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [isReady, setIsReady] = useState(false);

  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [turnsSinceHand, setTurnsSinceHand] = useState(0);
  const [lastHands, setLastHands] = useState<HandResult[]>([]);
  const [message, setMessage] = useState("No hand.");

  useEffect(() => {
    const newDeck = shuffle(createDeck());

    setBoard(createEmptyBoard());
    setCurrentCard(newDeck[0] ?? null);
    setDeck(newDeck.slice(1));
    setIsReady(true);
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

  function resetGame() {
    sound.play("restart");

    const newDeck = shuffle(createDeck());

    setBoard(createEmptyBoard());
    setDeck(newDeck.slice(1));
    setCurrentCard(newDeck[0] ?? null);
    setScore(0);
    setCombo(0);
    setTurnsSinceHand(0);
    setLastHands([]);
    setMessage("New game.");
  }

  function placeCard(row: number, col: number) {
    if (!currentCard) return;

    if (board[row][col]) {
      sound.play("blocked");
      return;
    }

    sound.play("place");

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
      gainedScore += hand.score * comboMultiplier;
    }

    if (hands.length > 0) {
      const hasClearHand = hands.some((hand) => hand.shouldClear);
      window.setTimeout(() => {
        sound.play(hasClearHand ? "clear" : "pair");
      }, 35);

      if (nextCombo >= 2) {
        window.setTimeout(() => {
          sound.play("combo");
        }, 150);
      }
    }

    for (const hand of hands) {
      if (!hand.shouldClear) continue;

      for (const item of hand.cards) {
        nextBoard[item.row][item.col] = null;
      }
    }

    const nextDeck = [...deck];
    const nextCard = nextDeck.shift() ?? null;

    setBoard(nextBoard);
    setDeck(nextDeck);
    setCurrentCard(nextCard);
    setScore((prev) => prev + gainedScore);
    setCombo(nextCombo);
    setTurnsSinceHand(nextTurnsSinceHand);
    setLastHands(hands);

    if (hands.length > 0) {
      setMessage(hands.map((hand) => handName(hand.type)).join(" + "));
    } else {
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
    <main className="h-svh overflow-hidden bg-[#090909] text-[#F3F0E8] lg:min-h-screen lg:px-5 lg:py-5">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#28221A_0%,transparent_34%),linear-gradient(180deg,#090909_0%,#101010_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />

      {/* Mobile layout */}
      <div className="relative flex h-svh flex-col gap-3 px-3 py-3 lg:hidden">
        <header className="flex h-[86px] shrink-0 items-center justify-between rounded-[24px] border border-white/10 bg-white/[0.04] px-4 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#D6B36A]">
              NUTS
            </p>
            <p className="mt-1 text-3xl font-black tracking-[-0.08em]">
              {score}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/35">
                Combo
              </p>
              <p className="text-xl font-black text-[#D6B36A]">x{combo}</p>
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

        <section className="flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] p-2 backdrop-blur-xl">
          <div className="grid aspect-square h-full max-h-full max-w-full grid-cols-5 gap-2">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    className={[
                      "group relative overflow-hidden rounded-[16px] border transition duration-200",
                      "bg-white/[0.045] hover:bg-white/[0.075]",
                      cell ? "border-white/10" : "border-white/[0.075]",
                      isHighlighted
                        ? "border-[#D6B36A]/80 shadow-[0_0_0_1px_rgba(214,179,106,0.45),0_0_24px_rgba(214,179,106,0.22)]"
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
              }),
            )}
          </div>
        </section>

        <footer className="flex h-[48px] shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 backdrop-blur-xl">
          <p className="truncate text-sm font-bold text-[#F5F1E8]">{message}</p>

          <div className="ml-3 flex items-center gap-2">
            <button
              onClick={sound.toggleEnabled}
              className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/65"
            >
              {sound.enabled ? "Sound" : "Mute"}
            </button>

            <button
              onClick={resetGame}
              className="rounded-xl bg-[#F5F1E8] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-black"
            >
              Restart
            </button>
          </div>
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
                Combo
              </p>
              <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-[#D6B36A]">
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

          <button
            onClick={sound.toggleEnabled}
            className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-white/55 transition hover:bg-white/[0.07]"
          >
            {sound.enabled ? "Sound On" : "Sound Off"}
          </button>
        </aside>

        <section className="flex min-h-[620px] items-center justify-center rounded-[34px] border border-white/10 bg-white/[0.025] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          <div className="grid aspect-square w-full max-w-[680px] grid-cols-5 gap-3">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    className={[
                      "group relative overflow-hidden rounded-[22px] border transition duration-200",
                      "bg-white/[0.045] hover:bg-white/[0.075]",
                      cell ? "border-white/10" : "border-white/[0.075]",
                      isHighlighted
                        ? "border-[#D6B36A]/80 shadow-[0_0_0_1px_rgba(214,179,106,0.45),0_0_34px_rgba(214,179,106,0.22)]"
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
              }),
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
              Last Hand
            </p>
            <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#F5F1E8]">
              {message}
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {lastHands.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-sm leading-6 text-white/38">
                  Pair scores and stays. All stronger hands score and clear.
                </p>
              </div>
            ) : (
              lastHands.map((hand, index) => (
                <div
                  key={`${hand.type}-${index}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"
                >
                  <p className="text-sm font-black text-[#D6B36A]">
                    {handName(hand.type)}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/35">
                    +{hand.score} / {hand.shouldClear ? "Clear" : "Keep"}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-white/35">
              Rule
            </p>
            <p className="mt-3 text-sm leading-6 text-white/42">
              Rows and columns only. Empty spaces break every hand.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
