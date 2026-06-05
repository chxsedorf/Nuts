"use client";

"use client";

import { useEffect, useMemo, useState } from "react";
import type { Board, Card, HandResult, Rank, Suit } from "@/types/game";
import { judgeHandsAfterPlace } from "@/lib/handJudge";

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

export default function Page() {
  const [board, setBoard] = useState<Board>(() => createEmptyBoard());
  const [deck, setDeck] = useState<Card[]>(() => shuffle(createDeck()));
  const [currentCard, setCurrentCard] = useState<Card | null>(() => {
    const firstDeck = shuffle(createDeck());
    return firstDeck[0];
  });
  const [score, setScore] = useState(0);
  const [lastHands, setLastHands] = useState<HandResult[]>([]);
  const [message, setMessage] = useState("Place a card.");

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
    setCurrentCard(newDeck[0]);
    setScore(0);
    setLastHands([]);
    setMessage("New game.");
  }

  function placeCard(row: number, col: number) {
    if (!currentCard) return;
    if (board[row][col]) return;

    const nextBoard = board.map((line) => [...line]);
    nextBoard[row][col] = currentCard;

    const hands = judgeHandsAfterPlace(nextBoard, { row, col });

    let gainedScore = 0;
    for (const hand of hands) {
      gainedScore += hand.score;
    }

    /**
     * One Pair以外は消す。
     */
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
    setLastHands(hands);

    if (hands.length > 0) {
      setMessage(
        hands.map((hand) => handName(hand.type)).join(" + ")
      );
    } else {
      setMessage("No hand.");
    }
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[220px_1fr_220px] gap-6">
        <section className="rounded-2xl bg-neutral-900 border border-neutral-700 p-5">
          <h1 className="text-3xl font-black tracking-widest">NUTS</h1>

          <div className="mt-6">
            <p className="text-sm text-neutral-400">Score</p>
            <p className="text-4xl font-black">{score}</p>
          </div>

          <div className="mt-6">
            <p className="text-sm text-neutral-400">Deck</p>
            <p className="text-2xl font-bold">{deck.length}</p>
          </div>

          <button
            onClick={resetGame}
            className="mt-8 w-full rounded-xl bg-white text-black font-bold py-3 hover:bg-neutral-200"
          >
            Restart
          </button>
        </section>

        <section className="rounded-2xl bg-neutral-900 border border-neutral-700 p-5">
          <div className="grid grid-cols-5 gap-3 aspect-square">
            {board.map((line, row) =>
              line.map((cell, col) => {
                const key = `${row}-${col}`;
                const isHighlighted = highlightedCells.has(key);

                return (
                  <button
                    key={key}
                    onClick={() => placeCard(row, col)}
                    className={[
                      "rounded-xl border flex items-center justify-center text-xl font-black transition",
                      "bg-neutral-800 border-neutral-700",
                      "hover:bg-neutral-700",
                      isHighlighted ? "ring-4 ring-yellow-300" : "",
                    ].join(" ")}
                  >
                    {cell ? (
                      <span>
                        {cell.rank}
                        {suitSymbol(cell.suit)}
                      </span>
                    ) : (
                      <span className="text-neutral-600">+</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-2xl bg-neutral-900 border border-neutral-700 p-5">
          <p className="text-sm text-neutral-400">Current Card</p>

          <div className="mt-4 aspect-[3/4] rounded-2xl bg-white text-black flex items-center justify-center text-4xl font-black">
            {currentCard ? (
              <span>
                {currentCard.rank}
                {suitSymbol(currentCard.suit)}
              </span>
            ) : (
              <span className="text-xl">END</span>
            )}
          </div>

          <div className="mt-6">
            <p className="text-sm text-neutral-400">Last Hand</p>
            <p className="mt-2 text-xl font-bold">{message}</p>
          </div>

          <div className="mt-6 space-y-2">
            {lastHands.map((hand, index) => (
              <div
                key={`${hand.type}-${index}`}
                className="rounded-xl bg-neutral-800 p-3"
              >
                <p className="font-bold">{handName(hand.type)}</p>
                <p className="text-sm text-neutral-400">
                  +{hand.score} / {hand.shouldClear ? "Clear" : "Keep"}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}