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
type ScorePopup = { id: number; value: number; combo: number; label: string };
type LeaderboardPeriod = "daily" | "monthly" | "all";
type LeaderboardRow = {
  player_name: string;
  score: number;
  created_at: string;
};

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

function cardSuitCode(suit: Suit): string {
  switch (suit) {
    case "spade":
      return "S";
    case "heart":
      return "H";
    case "diamond":
      return "D";
    case "club":
      return "C";
  }
}

function cardImageSrc(card: Card): string {
  return `/cards/${card.rank}${cardSuitCode(card.suit)}.png`;
}

function preloadCardImages() {
  if (typeof window === "undefined") return;

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const image = new Image();
      image.src = `/cards/${rank}${cardSuitCode(suit)}.png`;
    }
  }
}

function hasEmptyCell(board: Board): boolean {
  return board.some((line) => line.some((cell) => cell === null));
}

const HIGH_SCORE_KEY = "nuts-high-score";
const PLAYER_ID_KEY = "nuts-player-id";
const PLAYER_NAME_KEY = "nuts-player-name";

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
  return (
    <div
      className={[
        "flex h-full w-full items-start justify-center overflow-hidden rounded-[18px]",
        "bg-transparent",
      ].join(" ")}
    >
      <img
        src={cardImageSrc(card)}
        alt={`${card.rank} ${card.suit}`}
        draggable={false}
        className={[
          "select-none [-webkit-user-drag:none]",
          large
            ? "h-full w-full object-contain drop-shadow-[0_18px_34px_rgba(0,0,0,0.34)]"
            : "h-[150%] w-auto max-w-none object-contain object-top drop-shadow-[0_8px_16px_rgba(0,0,0,0.22)]",
        ].join(" ")}
      />
    </div>
  );
}

function MiniCardView({ card }: { card: Card }) {
  return (
    <div className="flex h-16 w-12 items-center justify-center overflow-hidden rounded-xl bg-transparent shadow-lg">
      <img
        src={cardImageSrc(card)}
        alt={`${card.rank} ${card.suit}`}
        draggable={false}
        className="h-full w-full select-none object-contain [-webkit-user-drag:none]"
      />
    </div>
  );
}


function makeDevCard(rank: Rank, suit: Suit): Card {
  return {
    id: `${rank}-${suit}-dev-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    rank,
    suit,
  };
}

function suitLabel(suit: Suit): string {
  switch (suit) {
    case "spade":
      return "♠ Spade";
    case "heart":
      return "♥ Heart";
    case "diamond":
      return "♦ Diamond";
    case "club":
      return "♣ Club";
  }
}

function DevModePanel({
  devRank,
  devSuit,
  onRankChange,
  onSuitChange,
  onClose,
  onSetCurrentCard,
  onClearBoard,
  onResetScore,
  onPrepareTripleA,
  onPrepareStraightA23,
  onPrepareStraightQKA,
  onPrepareFullHouse,
  onPrepareTwoPair,
}: {
  devRank: Rank;
  devSuit: Suit;
  onRankChange: (rank: Rank) => void;
  onSuitChange: (suit: Suit) => void;
  onClose: () => void;
  onSetCurrentCard: () => void;
  onClearBoard: () => void;
  onResetScore: () => void;
  onPrepareTripleA: () => void;
  onPrepareStraightA23: () => void;
  onPrepareStraightQKA: () => void;
  onPrepareFullHouse: () => void;
  onPrepareTwoPair: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm">
      <div className="flex max-h-[92svh] w-full max-w-[620px] flex-col rounded-[28px] border border-[#D6B36A]/20 bg-[#111111] p-6 text-[#F5F1E8] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="flex shrink-0 items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#D6B36A]">
              Developer
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.06em]">
              Dev Mode
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/42">
              役判定ロジックは変更せず、テスト盤面だけを作ります。
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 select-none items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xl font-black text-white/70 transition hover:bg-white/[0.08]"
            aria-label="Close dev mode"
          >
            ×
          </button>
        </div>

        <div className="mt-6 min-h-0 overflow-y-auto">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
                Current Card
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Rank
                  </span>
                  <select
                    value={devRank}
                    onChange={(event) => onRankChange(event.target.value as Rank)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm font-bold text-white outline-none"
                  >
                    {RANKS.map((rank) => (
                      <option key={rank} value={rank}>
                        {rank}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
                    Suit
                  </span>
                  <select
                    value={devSuit}
                    onChange={(event) => onSuitChange(event.target.value as Suit)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm font-bold text-white outline-none"
                  >
                    {SUITS.map((suit) => (
                      <option key={suit} value={suit}>
                        {suitLabel(suit)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <button
                onClick={onSetCurrentCard}
                className="mt-4 w-full select-none touch-manipulation rounded-xl bg-[#F5F1E8] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black transition hover:bg-white active:scale-[0.99]"
              >
                Set Current Card
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
                Test Patterns
              </p>

              <div className="mt-4 space-y-2">
                <button
                  onClick={onPrepareTripleA}
                  className="w-full select-none touch-manipulation rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08] active:scale-[0.99]"
                >
                  Prepare A A A
                </button>

                <button
                  onClick={onPrepareStraightA23}
                  className="w-full select-none touch-manipulation rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08] active:scale-[0.99]"
                >
                  Prepare A 2 3
                </button>

                <button
                  onClick={onPrepareStraightQKA}
                  className="w-full select-none touch-manipulation rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08] active:scale-[0.99]"
                >
                  Prepare Q K A
                </button>

                <button
                  onClick={onPrepareFullHouse}
                  className="w-full select-none touch-manipulation rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08] active:scale-[0.99]"
                >
                  Prepare AAA22
                </button>

                <button
                  onClick={onPrepareTwoPair}
                  className="w-full select-none touch-manipulation rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08] active:scale-[0.99]"
                >
                  Prepare K K 7 7
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              onClick={onClearBoard}
              className="select-none touch-manipulation rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/[0.08] active:scale-[0.99]"
            >
              Clear Board
            </button>

            <button
              onClick={onResetScore}
              className="select-none touch-manipulation rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/[0.08] active:scale-[0.99]"
            >
              Reset Score
            </button>
          </div>
        </div>
      </div>
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
  const [settingsTab, setSettingsTab] = useState<"profile" | "rules" | "hands" | "combo" | "sfx" | "privacy">("profile");
  const [screen, setScreen] = useState<"home" | "game">("home");
  const [pressedCell, setPressedCell] = useState<string | null>(null);
  const [deniedCell, setDeniedCell] = useState<string | null>(null);
  const [comboPulse, setComboPulse] = useState(false);
  const [boardPulse, setBoardPulse] = useState<"hand" | "clear" | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [clearingCells, setClearingCells] = useState<Set<string>>(() => new Set());
  const [scorePopup, setScorePopup] = useState<ScorePopup | null>(null);
  const [runStartPulse, setRunStartPulse] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerNameDraft, setPlayerNameDraft] = useState("");
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>("daily");
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [leaderboardError, setLeaderboardError] = useState("");
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [devModeOpen, setDevModeOpen] = useState(false);
  const [devRank, setDevRank] = useState<Rank>("A");
  const [devSuit, setDevSuit] = useState<Suit>("spade");

  useEffect(() => {
    preloadCardImages();

    const newDeck = shuffle(createDeck());

    setBoard(createEmptyBoard());
    setCurrentCard(newDeck[0] ?? null);
    setDeck(newDeck.slice(1));
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    setIsDebugMode(params.get("debug") === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = Number(window.localStorage.getItem(HIGH_SCORE_KEY) ?? "0");
    if (Number.isFinite(saved) && saved > 0) {
      setHighScore(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let savedPlayerId = window.localStorage.getItem(PLAYER_ID_KEY);
    if (!savedPlayerId) {
      savedPlayerId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      window.localStorage.setItem(PLAYER_ID_KEY, savedPlayerId);
    }

    let savedPlayerName = window.localStorage.getItem(PLAYER_NAME_KEY);
    if (!savedPlayerName) {
      savedPlayerName = `PLAYER ${savedPlayerId.slice(-4).toUpperCase()}`;
      window.localStorage.setItem(PLAYER_NAME_KEY, savedPlayerName);
    }

    setPlayerId(savedPlayerId);
    setPlayerName(savedPlayerName);
    setPlayerNameDraft(savedPlayerName);
  }, []);

  async function loadLeaderboard(period: LeaderboardPeriod = leaderboardPeriod) {
    setLeaderboardLoading(true);
    setLeaderboardError("");

    try {
      const response = await fetch(`/api/leaderboard?period=${period}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load leaderboard.");
      }

      const data = (await response.json()) as { rows?: LeaderboardRow[] };
      setLeaderboardRows(data.rows ?? []);
    } catch {
      setLeaderboardError("Ranking is not available right now.");
      setLeaderboardRows([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }

  async function submitScoreToLeaderboard(finalScore: number) {
    if (!playerId || !playerName || finalScore <= 0) return;

    try {
      await fetch("/api/score", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerId,
          playerName,
          score: finalScore,
        }),
      });
    } catch {
      // Ranking submission should never block local play.
    }
  }

  function normalizePlayerName(value: string) {
    const normalized = value
      .replace(/[^a-zA-Z0-9 _-]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 12);

    return normalized || "PLAYER";
  }

  function savePlayerName() {
    const nextName = normalizePlayerName(playerNameDraft).toUpperCase();
    setPlayerName(nextName);
    setPlayerNameDraft(nextName);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PLAYER_NAME_KEY, nextName);
    }

    setMessage("Name saved.");
  }

  useEffect(() => {
    if (!isLeaderboardOpen) return;
    void loadLeaderboard(leaderboardPeriod);
  }, [isLeaderboardOpen, leaderboardPeriod]);

  useEffect(() => {
    if (!isGameOver || score <= 0 || scoreSubmitted) return;

    setScoreSubmitted(true);
    void submitScoreToLeaderboard(score);
  }, [isGameOver, score, scoreSubmitted, playerId, playerName]);

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
    setScoreSubmitted(false);
    setPressedCell(null);
    setDeniedCell(null);
    setComboPulse(false);
    setBoardPulse(null);
    setIsResolving(false);
    setClearingCells(new Set());
    setScorePopup(null);
    setRunStartPulse(true);
    setScreen("game");

    window.setTimeout(() => {
      setRunStartPulse(false);
    }, 420);
  }

  function finishGameIfBoardFull(nextBoard: Board, finalScore: number) {
    if (hasEmptyCell(nextBoard)) return;

    setIsGameOver(true);
    setMessage("Run Complete");

    if (finalScore <= highScore) {
      setIsNewBest(false);
    }
  }

  function placeCard(row: number, col: number) {
    if (isResolving) return;

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

    let nextDeck = [...deck];
    let nextCard = nextDeck.shift() ?? null;

    if (!nextCard) {
      const freshDeck = shuffle(createDeck());
      nextCard = freshDeck[0] ?? null;
      nextDeck = freshDeck.slice(1);
    }

    const finalScore = score + gainedScore;
    const hasClearHand = hands.some((hand) => hand.shouldClear);
    const clearKeys = new Set<string>();

    for (const hand of hands) {
      if (!hand.shouldClear) continue;

      for (const item of hand.cards) {
        clearKeys.add(`${item.row}-${item.col}`);
      }
    }

    // Show the next card immediately.
    // Clear animations may continue on the board, but the next card should never wait for them.
    setCurrentCard(nextCard);
    setDeck(nextDeck);
    setBoard(nextBoard);
    setScore(finalScore);
    setCombo(nextCombo);
    setTurnsSinceHand(nextTurnsSinceHand);
    setLastHands(hands);

    if (gainedScore > 0) {
      setScorePopup({
        id: Date.now(),
        value: gainedScore,
        combo: Math.max(1, nextCombo),
        label: hands.map((hand) => handName(hand.type)).join(" + "),
      });

      window.setTimeout(() => {
        setScorePopup((current) => (current?.id ? null : current));
      }, 900);
    }

    if (finalScore > highScore) {
      setHighScore(finalScore);
      setIsNewBest(true);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(finalScore));
      }
    }

    if (hands.length > 0) {
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
    } else {
      setMessage("No hand.");
    }

    if (hasClearHand) {
      setIsResolving(true);
      setClearingCells(clearKeys);

      window.setTimeout(() => {
        setBoard((currentBoard) => {
          const clearedBoard = currentBoard.map((line) => [...line]);

          for (const key of clearKeys) {
            const [clearRow, clearCol] = key.split("-").map(Number);
            clearedBoard[clearRow][clearCol] = null;
          }

          finishGameIfBoardFull(clearedBoard, finalScore);
          return clearedBoard;
        });

        setClearingCells(new Set());
        setIsResolving(false);
      }, 430);
    } else {
      finishGameIfBoardFull(nextBoard, finalScore);
    }
  }

  function resetDevRuntimeState() {
    setLastHands([]);
    setPressedCell(null);
    setDeniedCell(null);
    setClearingCells(new Set());
    setScorePopup(null);
    setIsResolving(false);
    setIsGameOver(false);
    setScoreSubmitted(false);
    setIsNewBest(false);
    setBoardPulse(null);
  }

  function devSetCurrentCard() {
    resetDevRuntimeState();
    setScreen("game");
    setCurrentCard(makeDevCard(devRank, devSuit));
    setMessage(`Dev: Current card set to ${devRank}${suitSymbol(devSuit)}.`);
  }

  function devClearBoard() {
    resetDevRuntimeState();
    setScreen("game");
    setBoard(createEmptyBoard());
    setTurnsSinceHand(0);
    setMessage("Dev: Board cleared.");
  }

  function devResetScore() {
    resetDevRuntimeState();
    setScore(0);
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Score reset.");
  }

  function devPrepareTripleA() {
    const nextBoard = createEmptyBoard();
    nextBoard[2][1] = makeDevCard("A", "club");
    nextBoard[2][2] = makeDevCard("A", "diamond");

    resetDevRuntimeState();
    setScreen("game");
    setBoard(nextBoard);
    setCurrentCard(makeDevCard("A", "heart"));
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place A next to A A to test Three Card.");
  }

  function devPrepareStraightA23() {
    const nextBoard = createEmptyBoard();
    nextBoard[2][1] = makeDevCard("A", "spade");
    nextBoard[2][2] = makeDevCard("2", "heart");

    resetDevRuntimeState();
    setScreen("game");
    setBoard(nextBoard);
    setCurrentCard(makeDevCard("3", "diamond"));
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place 3 next to A 2 to test Straight.");
  }

  function devPrepareStraightQKA() {
    const nextBoard = createEmptyBoard();
    nextBoard[2][1] = makeDevCard("Q", "spade");
    nextBoard[2][2] = makeDevCard("K", "heart");

    resetDevRuntimeState();
    setScreen("game");
    setBoard(nextBoard);
    setCurrentCard(makeDevCard("A", "diamond"));
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place A next to Q K to test Q K A Straight.");
  }

  function devPrepareFullHouse() {
    const nextBoard = createEmptyBoard();
    nextBoard[2][0] = makeDevCard("A", "club");
    nextBoard[2][1] = makeDevCard("A", "diamond");
    nextBoard[2][2] = makeDevCard("A", "heart");
    nextBoard[2][3] = makeDevCard("2", "club");

    resetDevRuntimeState();
    setScreen("game");
    setBoard(nextBoard);
    setCurrentCard(makeDevCard("2", "diamond"));
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place 2 after A A A 2 to test Full House.");
  }

  function devPrepareTwoPair() {
    const nextBoard = createEmptyBoard();
    nextBoard[2][1] = makeDevCard("K", "club");
    nextBoard[2][2] = makeDevCard("K", "diamond");
    nextBoard[2][3] = makeDevCard("7", "heart");

    resetDevRuntimeState();
    setScreen("game");
    setBoard(nextBoard);
    setCurrentCard(makeDevCard("7", "spade"));
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place 7 after K K 7 to test Two Pair.");
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
      className="h-[100dvh] select-none overflow-hidden bg-[#090909] text-[#F3F0E8] lg:min-h-screen lg:px-2 lg:py-3"
      style={{
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
      } as CSSProperties}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#28221A_0%,transparent_34%),linear-gradient(180deg,#090909_0%,#101010_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />
      <style>{`
        @keyframes nutsScoreFloat {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.96); }
          16% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          72% { opacity: 1; transform: translate(-50%, -6px) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -16px) scale(0.98); }
        }
      `}</style>

      {scorePopup ? (
        <div
          key={scorePopup.id}
          className="pointer-events-none fixed left-1/2 top-[46%] z-30 rounded-2xl border border-[#D6B36A]/20 bg-black/45 px-5 py-3 text-center shadow-[0_18px_70px_rgba(0,0,0,0.35)] backdrop-blur-md"
          style={{ animation: "nutsScoreFloat 900ms ease-out forwards" }}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
            {scorePopup.label}
          </p>
          <p className="mt-1 text-2xl font-black tracking-[-0.06em] text-[#D6B36A]">
            +{scorePopup.value}{scorePopup.combo >= 2 ? ` ×${scorePopup.combo}` : ""}
          </p>
        </div>
      ) : null}

      {screen === "home" ? (
        <div
          className="relative flex h-[100dvh] items-center justify-center px-5"
          style={{
            paddingTop: "max(18px, calc(env(safe-area-inset-top) + 16px))",
            paddingBottom: "max(12px, calc(env(safe-area-inset-bottom) + 12px))",
          }}
        >
          <section className="flex w-full max-w-[430px] flex-col items-center rounded-[34px] border border-white/10 bg-white/[0.035] px-6 py-9 text-center shadow-[0_24px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-10">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[30px] border border-white/10 bg-black/30 shadow-[0_18px_55px_rgba(0,0,0,0.35)] sm:h-32 sm:w-32">
              <img
                src="/icon-512.png"
                alt="NUTS icon"
                className="h-full w-full object-cover"
                draggable={false}
              />
            </div>

            <h1 className="mt-8 text-6xl font-black tracking-[-0.1em] text-[#F5F1E8] sm:text-7xl">
              NUTS
            </h1>

            <div className="mt-8 w-full rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                Best Score
              </p>
              <p className="mt-2 text-4xl font-black tracking-[-0.06em] text-[#F5F1E8]">
                {highScore}
              </p>
            </div>

            <div className="mt-5 grid w-full gap-3">
              <button
                onClick={resetGame}
                className="select-none touch-manipulation rounded-2xl bg-[#F5F1E8] px-5 py-4 text-sm font-black uppercase tracking-[0.24em] text-black transition hover:bg-white active:scale-[0.99]"
              >
                Play
              </button>

              <button
                onClick={() => setIsLeaderboardOpen(true)}
                className="select-none touch-manipulation rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/[0.075] active:scale-[0.99]"
              >
                Ranking
              </button>

              <button
                onClick={() => {
                  setSettingsTab("rules");
                  setIsSettingsOpen(true);
                }}
                className="select-none touch-manipulation rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/[0.075] active:scale-[0.99]"
              >
                ⚙ Settings
              </button>
            </div>
          </section>
        </div>
      ) : (
        <>
      {/* Mobile layout */}
      <div className={["relative flex h-[100dvh] flex-col gap-3 px-3 transition duration-500 lg:hidden", runStartPulse ? "opacity-0 scale-[0.99]" : "opacity-100 scale-100"].join(" ")}
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
          <div className="grid aspect-square h-[95%] max-h-[95%] max-w-full grid-cols-5 gap-2">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);
                const isPressed = pressedCell === key;
                const isDenied = deniedCell === key;
                const isClearing = clearingCells.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    disabled={isGameOver || isResolving}
                    className={[
                      "group relative select-none touch-manipulation overflow-hidden rounded-[16px] border transition duration-200",
                      "bg-white/[0.045] hover:bg-white/[0.075]",
                      cell ? "border-white/10" : "border-white/[0.075]",
                      isPressed ? "scale-[0.965] bg-white/[0.085]" : "",
                      isDenied ? "translate-x-[1px] border-[#9F3F3F]/45 bg-[#9F3F3F]/[0.045]" : "",
                      isClearing ? "scale-[0.94] opacity-35" : "",
                      isHighlighted
                        ? "border-[#D6B36A]/55 bg-[#D6B36A]/[0.035] shadow-[0_0_0_1px_rgba(214,179,106,0.18)]"
                        : "",
                    ].join(" ")}
                  >
                    {cell ? (
                      <div className="absolute inset-[3px]">
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

        <footer className="flex h-[48px] shrink-0 items-center justify-start gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 backdrop-blur-xl">
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

        </footer>
      </div>

      {/* Desktop layout */}
      <div className={["relative mx-auto hidden h-[calc(100svh-24px)] w-full max-w-none grid-cols-[280px_minmax(760px,1fr)_300px] gap-3 transition duration-500 lg:grid", runStartPulse ? "opacity-0 scale-[0.99]" : "opacity-100 scale-100"].join(" ")}>
        <aside className="rounded-[30px] border border-white/10 bg-white/[0.035] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div>
            <h1 className="text-5xl font-black tracking-[-0.08em] text-[#F5F1E8]">
              NUTS
            </h1>
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
        </aside>

        <section
          className={[
            "flex h-full min-h-0 items-center justify-center rounded-[34px] border border-white/10 bg-white/[0.025] p-3 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl transition duration-300",
            boardPulse === "hand" ? "bg-[#D6B36A]/[0.025]" : "",
            boardPulse === "clear" ? "border-[#D6B36A]/25 bg-[#D6B36A]/[0.035]" : "",
          ].join(" ")}
        >
          <div className="grid aspect-square h-[min(860px,calc(100svh-72px))] max-h-full max-w-full grid-cols-5 gap-3">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);
                const isPressed = pressedCell === key;
                const isDenied = deniedCell === key;
                const isClearing = clearingCells.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    disabled={isGameOver || isResolving}
                    className={[
                      "group relative select-none touch-manipulation overflow-hidden rounded-[22px] border transition duration-200",
                      "bg-white/[0.045] hover:bg-white/[0.075]",
                      cell ? "border-white/10" : "border-white/[0.075]",
                      isPressed ? "scale-[0.975] bg-white/[0.085]" : "",
                      isDenied ? "translate-x-[1px] border-[#9F3F3F]/45 bg-[#9F3F3F]/[0.045]" : "",
                      isClearing ? "scale-[0.94] opacity-35" : "",
                      isHighlighted
                        ? "border-[#D6B36A]/55 bg-[#D6B36A]/[0.035] shadow-[0_0_0_1px_rgba(214,179,106,0.18)]"
                        : "",
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(circle_at_top,#ffffff18,transparent_60%)]" />

                    {cell ? (
                      <div className="absolute inset-[3px]">
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

        <aside className="rounded-[30px] border border-white/10 bg-white/[0.035] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
          <div>
            <div className="aspect-[3/4] w-full rounded-[26px] bg-white/[0.04] p-3">
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

          <button
            onClick={() => setIsLeaderboardOpen(true)}
            className={[
              "mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10",
              "bg-white/[0.045] px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-[#F5F1E8]",
              "transition hover:bg-white/[0.075] active:scale-[0.99]",
            ].join(" ")}
          >
            Ranking
          </button>

          <button
            onClick={() => {
              setSettingsTab("rules");
              setIsSettingsOpen(true);
            }}
            className={[
              "mt-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10",
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
              {isNewBest ? "New Best" : "Run Complete"}
            </p>
            <h2 className="mt-3 text-5xl font-black tracking-[-0.08em] text-[#F5F1E8]">
              {score}
            </h2>
            <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-white/35">
              Best Score {highScore}
            </p>

            {isNewBest ? (
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.24em] text-[#D6B36A]">
                New Best
              </p>
            ) : null}

            <button
              onClick={resetGame}
              className="mt-6 w-full select-none touch-manipulation rounded-2xl bg-[#F5F1E8] px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-black transition hover:bg-white active:scale-[0.99]"
            >
              Play Again
            </button>

            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className="mt-3 w-full select-none touch-manipulation rounded-2xl border border-white/10 bg-white/[0.045] px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/[0.075] active:scale-[0.99]"
            >
              Ranking
            </button>

            <button
              onClick={() => {
                setIsGameOver(false);
                setScreen("home");
              }}
              className="mt-3 w-full select-none touch-manipulation rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-white/55 transition hover:bg-white/[0.065] active:scale-[0.99]"
            >
              Home
            </button>
          </div>
        </div>
      ) : null}

        </>
      )}


      {isDebugMode ? (
        <button
          onClick={() => setDevModeOpen(true)}
          className="fixed bottom-[max(18px,calc(env(safe-area-inset-bottom)+18px))] right-4 z-[45] select-none touch-manipulation rounded-2xl border border-[#D6B36A]/30 bg-[#111111]/90 px-4 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#D6B36A] shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl transition hover:bg-[#181818] active:scale-[0.98]"
        >
          Dev Mode
        </button>
      ) : null}

      {isDebugMode && devModeOpen ? (
        <DevModePanel
          devRank={devRank}
          devSuit={devSuit}
          onRankChange={setDevRank}
          onSuitChange={setDevSuit}
          onClose={() => setDevModeOpen(false)}
          onSetCurrentCard={devSetCurrentCard}
          onClearBoard={devClearBoard}
          onResetScore={devResetScore}
          onPrepareTripleA={devPrepareTripleA}
          onPrepareStraightA23={devPrepareStraightA23}
          onPrepareStraightQKA={devPrepareStraightQKA}
          onPrepareFullHouse={devPrepareFullHouse}
          onPrepareTwoPair={devPrepareTwoPair}
        />
      ) : null}

      {isLeaderboardOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="flex max-h-[92svh] w-full max-w-[620px] flex-col rounded-[28px] border border-white/10 bg-[#121212] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
            <div className="flex shrink-0 items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#D6B36A]">
                  Ranking
                </p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#F5F1E8]">
                  Leaderboard
                </h2>
              </div>

              <button
                onClick={() => setIsLeaderboardOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.045] text-xl font-black text-white/70 transition hover:bg-white/[0.08]"
                aria-label="Close ranking"
              >
                ×
              </button>
            </div>

            <div className="mt-6 grid shrink-0 grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1">
              {[
                { key: "daily", label: "Today" },
                { key: "monthly", label: "Month" },
                { key: "all", label: "All Time" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setLeaderboardPeriod(item.key as LeaderboardPeriod)}
                  className={[
                    "rounded-xl px-2 py-3 text-[10px] font-black uppercase tracking-[0.14em] transition sm:text-xs",
                    leaderboardPeriod === item.key
                      ? "bg-[#F5F1E8] text-black"
                      : "text-white/45 hover:bg-white/[0.05] hover:text-white/75",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
              {leaderboardLoading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center text-sm font-bold uppercase tracking-[0.2em] text-white/35">
                  Loading
                </div>
              ) : leaderboardError ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center text-sm leading-6 text-white/45">
                  {leaderboardError}
                </div>
              ) : leaderboardRows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6 text-center text-sm leading-6 text-white/45">
                  No scores yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboardRows.map((row, index) => (
                    <div
                      key={`${row.player_name}-${row.score}-${row.created_at}-${index}`}
                      className={[
                        "grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-2xl border px-4 py-3",
                        row.player_name === playerName
                          ? "border-[#D6B36A]/35 bg-[#D6B36A]/[0.075]"
                          : index === 0
                            ? "border-[#D6B36A]/25 bg-[#D6B36A]/[0.055]"
                            : "border-white/10 bg-white/[0.035]",
                      ].join(" ")}
                    >
                      <p className="text-sm font-black text-[#D6B36A]">
                        {index + 1}
                      </p>
                      <p className="truncate text-sm font-black uppercase tracking-[0.12em] text-white/70">
                        {row.player_name}
                      </p>
                      <p className="text-lg font-black tracking-[-0.04em] text-[#F5F1E8]">
                        {row.score}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 shrink-0 border-t border-white/10 pt-4">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/28">
                {playerName || "PLAYER"}
              </p>
            </div>
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

            <div className="mt-6 grid shrink-0 grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1 sm:grid-cols-6">
              {[
                { key: "profile", label: "Profile" },
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
                      item.key as "profile" | "rules" | "hands" | "combo" | "sfx" | "privacy"
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
              {settingsTab === "profile" ? (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-xl font-black text-[#F5F1E8]">
                      Player Name
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      ランキングに表示する名前を登録できます。英数字・スペース・_・- のみ、最大12文字です。
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-white/40">
                      Name
                    </label>
                    <input
                      value={playerNameDraft}
                      onChange={(event) =>
                        setPlayerNameDraft(event.currentTarget.value.toUpperCase())
                      }
                      maxLength={12}
                      placeholder="PLAYER"
                      className="mt-3 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-base font-black uppercase tracking-[0.12em] text-[#F5F1E8] outline-none transition placeholder:text-white/18 focus:border-[#D6B36A]/50"
                      aria-label="Player name"
                    />
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-white/32">
                        Current: {playerName || "PLAYER"}
                      </p>
                      <button
                        onClick={savePlayerName}
                        className="select-none touch-manipulation rounded-xl bg-[#F5F1E8] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-black transition hover:bg-white active:scale-[0.99]"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm leading-7 text-white/50">
                    <p>
                      保存した名前はこの端末のlocalStorageに保存され、次回以降のスコア送信時に使われます。
                    </p>
                  </div>
                </div>
              ) : null}

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
                      例：Straight 160点をx3で成立させると、480点入ります。
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
                    ハイスコア、プレイヤーID、効果音の音量設定は、お使いのブラウザ内のlocalStorageに保存されます。ランキング機能では、匿名プレイヤー名とスコアのみをサーバーへ送信します。
                  </p>
                  <p>
                    今後アクセス解析や広告を導入する場合は、必要な情報をこの画面または公開ページ上で明示します。
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid shrink-0 grid-cols-3 gap-3 border-t border-white/10 pt-4">
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="select-none touch-manipulation rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 text-xs font-black uppercase tracking-[0.16em] text-white/62 transition hover:bg-white/[0.07] active:scale-[0.99]"
              >
                Close
              </button>

              <button
                onClick={() => {
                  setScreen("home");
                  setIsSettingsOpen(false);
                }}
                className="select-none touch-manipulation rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-4 text-xs font-black uppercase tracking-[0.16em] text-white/70 transition hover:bg-white/[0.07] active:scale-[0.99]"
              >
                Home
              </button>

              <button
                onClick={() => {
                  resetGame();
                  setIsSettingsOpen(false);
                }}
                className="select-none touch-manipulation rounded-2xl bg-[#F5F1E8] px-3 py-4 text-xs font-black uppercase tracking-[0.16em] text-black transition hover:bg-white active:scale-[0.99]"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
