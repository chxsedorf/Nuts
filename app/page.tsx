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

type ScoreNotice = {
  label: string;
  score: number;
  combo: number;
} | null;

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
    <div className="flex h-16 w-12 flex-col items-center justify-center gap-1 rounded-xl border border-black/10 bg-[#F5F1E8] shadow-[0_8px_18px_rgba(0,0,0,0.16)]">
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

function SettingsModal({
  onClose,
}: {
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/62 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[520px] rounded-[28px] border border-white/10 bg-[#111111] p-6 text-[#F3F0E8] shadow-[0_28px_90px_rgba(0,0,0,0.48)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#D6B36A]">
              Settings
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.06em]">
              NUTS
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-7 space-y-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[#F5F1E8]">
              ルール説明
            </h3>
            <div className="mt-4 space-y-2 text-sm leading-6 text-white/50">
              <p>・役は縦横のみ。斜めは無効。</p>
              <p>・空白を挟むと役は成立しません。</p>
              <p>・今回置いたカードを含む役だけが反映されます。</p>
              <p>・One Pairは得点とコンボ対象ですが、カードは消えません。</p>
              <p>・Three Card以上の役は得点後に消えます。</p>
              <p>・3ターン以内に次の役を作るとコンボが継続します。</p>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[#F5F1E8]">
              プライバシーポリシー
            </h3>
            <div className="mt-4 space-y-2 text-sm leading-6 text-white/50">
              <p>・このゲームはログイン機能を使用しません。</p>
              <p>・個人情報の入力や収集は行いません。</p>
              <p>・公開環境では、ホスティングサービスによる基本的なアクセス情報が扱われる場合があります。</p>
            </div>
          </section>
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
  const [scoreNotice, setScoreNotice] = useState<ScoreNotice>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    const newDeck = shuffle(createDeck());

    setBoard(createEmptyBoard());
    setDeck(newDeck.slice(1));
    setCurrentCard(newDeck[0] ?? null);
    setScore(0);
    setCombo(0);
    setTurnsSinceHand(0);
    setLastHands([]);
    setMessage("No hand.");
    setScoreNotice(null);
    setIsResolving(false);
  }

  function placeCard(row: number, col: number) {
    if (!currentCard) return;
    if (isResolving) return;
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

    const nextDeck = [...deck];
    const nextCard = nextDeck.shift() ?? null;

    setBoard(nextBoard);
    setScore((prev) => prev + gainedScore);
    setCombo(nextCombo);
    setTurnsSinceHand(nextTurnsSinceHand);
    setLastHands(hands);

    if (hands.length > 0) {
      const label = hands.map((hand) => handName(hand.type)).join(" + ");
      setMessage(label);
      setScoreNotice({
        label,
        score: gainedScore,
        combo: nextCombo,
      });
      setIsResolving(true);

      window.setTimeout(() => {
        const resolvedBoard = nextBoard.map((line) => [...line]);

        for (const hand of hands) {
          if (!hand.shouldClear) continue;

          for (const item of hand.cards) {
            resolvedBoard[item.row][item.col] = null;
          }
        }

        setBoard(resolvedBoard);
        setDeck(nextDeck);
        setCurrentCard(nextCard);
        setLastHands([]);
        setScoreNotice(null);
        setIsResolving(false);
      }, 420);

      return;
    }

    setDeck(nextDeck);
    setCurrentCard(nextCard);
    setScoreNotice(null);
    setMessage("No hand.");
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
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top,#252018_0%,transparent_32%),linear-gradient(180deg,#090909_0%,#101010_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:48px_48px]" />

      {settingsOpen ? <SettingsModal onClose={() => setSettingsOpen(false)} /> : null}

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

        <section className="relative flex min-h-0 flex-1 items-center justify-center rounded-[28px] border border-white/10 bg-white/[0.025] p-2 backdrop-blur-xl">
          {scoreNotice ? (
            <div className="pointer-events-none absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-[#D6B36A]/25 bg-[#111]/80 px-4 py-2 text-center backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#D6B36A]">
                {scoreNotice.label}
              </p>
              <p className="mt-0.5 text-xs font-bold text-white/62">
                +{scoreNotice.score}
                {scoreNotice.combo > 1 ? `  x${scoreNotice.combo}` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid aspect-square h-full max-h-full max-w-full grid-cols-5 gap-2">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    disabled={isResolving}
                    className={[
                      "group relative overflow-hidden rounded-[16px] border transition duration-300",
                      "bg-white/[0.042] hover:bg-white/[0.065]",
                      cell ? "border-white/10" : "border-white/[0.07]",
                      isHighlighted
                        ? "border-[#D6B36A]/45 bg-[#D6B36A]/[0.045] shadow-[inset_0_0_0_1px_rgba(214,179,106,0.18)]"
                        : "",
                      isResolving ? "cursor-default" : "",
                    ].join(" ")}
                  >
                    {cell ? (
                      <div
                        className={[
                          "absolute inset-1 transition duration-300",
                          isHighlighted ? "scale-[0.985] opacity-95" : "",
                        ].join(" ")}
                      >
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

        <footer className="flex h-[48px] shrink-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 backdrop-blur-xl">
          <p className="truncate text-sm font-bold text-[#F5F1E8]">
            {message}
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] font-black text-white/65"
              aria-label="Settings"
            >
              ⚙
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
              "transition hover:scale-[1.01] hover:bg-white active:scale-[0.99]",
            ].join(" ")}
          >
            Restart
          </button>
        </aside>

        <section className="relative flex min-h-[620px] items-center justify-center rounded-[34px] border border-white/10 bg-white/[0.025] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] backdrop-blur-xl">
          {scoreNotice ? (
            <div className="pointer-events-none absolute left-1/2 top-7 z-20 -translate-x-1/2 rounded-full border border-[#D6B36A]/25 bg-[#111]/80 px-5 py-2.5 text-center backdrop-blur-md">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D6B36A]">
                {scoreNotice.label}
              </p>
              <p className="mt-0.5 text-xs font-bold text-white/62">
                +{scoreNotice.score}
                {scoreNotice.combo > 1 ? `  x${scoreNotice.combo}` : ""}
              </p>
            </div>
          ) : null}

          <div className="grid aspect-square w-full max-w-[680px] grid-cols-5 gap-3">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    disabled={isResolving}
                    className={[
                      "group relative overflow-hidden rounded-[22px] border transition duration-300",
                      "bg-white/[0.042] hover:bg-white/[0.065]",
                      cell ? "border-white/10" : "border-white/[0.07]",
                      isHighlighted
                        ? "border-[#D6B36A]/45 bg-[#D6B36A]/[0.045] shadow-[inset_0_0_0_1px_rgba(214,179,106,0.18)]"
                        : "",
                      isResolving ? "cursor-default" : "",
                    ].join(" ")}
                  >
                    <div className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top,#ffffff12,transparent_58%)]" />

                    {cell ? (
                      <div
                        className={[
                          "absolute inset-2 transition duration-300",
                          isHighlighted ? "scale-[0.985] opacity-95" : "",
                        ].join(" ")}
                      >
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
            <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-[#F5F1E8]">
              {message}
            </p>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-black uppercase tracking-[0.2em] text-white/70 transition hover:bg-white/[0.07] hover:text-white"
          >
            <span>⚙</span>
            <span>Settings</span>
          </button>
        </aside>
      </div>
    </main>
  );
}
