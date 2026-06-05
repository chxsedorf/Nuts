export type Suit = "spade" | "heart" | "diamond" | "club";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type Card = {
  id: string;
  rank: Rank;
  suit: Suit;
};

export type Cell = Card | null;

export type Board = Cell[][];

export type Position = {
  row: number;
  col: number;
};

export type HandType =
  | "ROYAL_STRAIGHT_FLUSH"
  | "STRAIGHT_FLUSH"
  | "FOUR_CARD"
  | "FULL_HOUSE"
  | "FLUSH"
  | "STRAIGHT"
  | "THREE_CARD"
  | "TWO_PAIR"
  | "ONE_PAIR";

export type Direction = "row" | "col";

export type HandResult = {
  type: HandType;
  cards: {
    card: Card;
    row: number;
    col: number;
  }[];
  direction: Direction;
  shouldClear: boolean;
  score: number;
};