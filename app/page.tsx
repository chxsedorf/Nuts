"use client";

import { useEffect, useMemo, useState } from "react";
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


function makeDevCard(rank: Rank, suit: Suit): Card {
  return {
    id: `${rank}-${suit}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
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
  onPrepareFullHouse,
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
  onPrepareFullHouse: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[560px] rounded-[28px] border border-[#D6B36A]/20 bg-[#111111] p-6 text-[#F5F1E8] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-[#D6B36A]">
              Developer
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.06em]">
              Dev Mode
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/42">
              役判定テスト用です。本番公開前は必要に応じて非表示にしてください。
            </p>
          </div>

          <button
            onClick={onClose}
            className="select-none rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white/70 transition hover:bg-white/[0.08]"
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
              className="mt-4 w-full select-none rounded-xl bg-[#F5F1E8] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-black transition hover:bg-white"
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
                className="w-full select-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08]"
              >
                Prepare A A A
              </button>

              <button
                onClick={onPrepareStraightA23}
                className="w-full select-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08]"
              >
                Prepare A 2 3
              </button>

              <button
                onClick={onPrepareFullHouse}
                className="w-full select-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-white/75 transition hover:bg-white/[0.08]"
              >
                Prepare AAA22
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={onClearBoard}
            className="select-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/[0.08]"
          >
            Clear Board
          </button>

          <button
            onClick={onResetScore}
            className="select-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.18em] text-white/70 transition hover:bg-white/[0.08]"
          >
            Reset Score
          </button>
        </div>
      </div>
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
  const [showDevMode, setShowDevMode] = useState(false);
  const [devModeOpen, setDevModeOpen] = useState(false);
  const [devRank, setDevRank] = useState<Rank>("A");
  const [devSuit, setDevSuit] = useState<Suit>("spade");

  useEffect(() => {
    const newDeck = shuffle(createDeck());
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.get("debug") === "1";

    setShowDevMode(debugEnabled);
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
    if (board[row][col]) return;

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

  function devSetCurrentCard() {
    setCurrentCard(makeDevCard(devRank, devSuit));
    setMessage(`Dev: Current card set to ${devRank}${suitSymbol(devSuit)}.`);
  }

  function devClearBoard() {
    setBoard(createEmptyBoard());
    setLastHands([]);
    setTurnsSinceHand(0);
    setMessage("Dev: Board cleared.");
  }

  function devResetScore() {
    setScore(0);
    setCombo(0);
    setTurnsSinceHand(0);
    setLastHands([]);
    setMessage("Dev: Score reset.");
  }

  function devPrepareTripleA() {
    const nextBoard = createEmptyBoard();

    nextBoard[2][1] = makeDevCard("A", "club");
    nextBoard[2][2] = makeDevCard("A", "diamond");

    setBoard(nextBoard);
    setCurrentCard(makeDevCard("A", "heart"));
    setLastHands([]);
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place A next to A A to test Three Card.");
  }

  function devPrepareStraightA23() {
    const nextBoard = createEmptyBoard();

    nextBoard[2][1] = makeDevCard("A", "spade");
    nextBoard[2][2] = makeDevCard("2", "heart");

    setBoard(nextBoard);
    setCurrentCard(makeDevCard("3", "diamond"));
    setLastHands([]);
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place 3 next to A 2 to test Straight.");
  }

  function devPrepareFullHouse() {
    const nextBoard = createEmptyBoard();

    nextBoard[2][0] = makeDevCard("A", "club");
    nextBoard[2][1] = makeDevCard("A", "diamond");
    nextBoard[2][2] = makeDevCard("A", "heart");
    nextBoard[2][3] = makeDevCard("2", "club");

    setBoard(nextBoard);
    setCurrentCard(makeDevCard("2", "diamond"));
    setLastHands([]);
    setCombo(0);
    setTurnsSinceHand(0);
    setMessage("Dev: Place 2 after A A A 2 to test Full House.");
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

      {showDevMode && devModeOpen ? (
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
          onPrepareFullHouse={devPrepareFullHouse}
        />
      ) : null}

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
              })
            )}
          </div>
        </section>

        <footer className="flex h-[48px] shrink-0 items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 backdrop-blur-xl">
          <p className="truncate text-sm font-bold text-[#F5F1E8]">
            {message}
          </p>

          <div className="ml-3 flex items-center gap-2">
            {showDevMode ? (
              <button
                onClick={() => setDevModeOpen(true)}
                className="rounded-xl border border-[#D6B36A]/25 bg-[#D6B36A]/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#D6B36A]"
              >
                Dev
              </button>
            ) : null}

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

          {showDevMode ? (
            <button
              onClick={() => setDevModeOpen(true)}
              className={[
                "mt-3 w-full rounded-2xl border border-[#D6B36A]/25",
                "bg-[#D6B36A]/10 px-5 py-4 text-sm font-black uppercase tracking-[0.22em] text-[#D6B36A]",
                "transition hover:bg-[#D6B36A]/15 active:scale-[0.99]",
              ].join(" ")}
            >
              Dev Mode
            </button>
          ) : null}
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
