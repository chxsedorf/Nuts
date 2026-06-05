import type {
  Board,
  Card,
  Direction,
  HandResult,
  HandType,
  Position,
  Rank,
} from "@/types/game";

type LineCard = {
  card: Card;
  row: number;
  col: number;
};

const HAND_PRIORITY: HandType[] = [
  "ROYAL_STRAIGHT_FLUSH",
  "STRAIGHT_FLUSH",
  "FOUR_CARD",
  "FULL_HOUSE",
  "FLUSH",
  "STRAIGHT",
  "THREE_CARD",
  "TWO_PAIR",
  "ONE_PAIR",
];

const SCORE_TABLE: Record<HandType, number> = {
  ROYAL_STRAIGHT_FLUSH: 1000,
  STRAIGHT_FLUSH: 700,
  FOUR_CARD: 500,
  FULL_HOUSE: 350,
  FLUSH: 250,
  STRAIGHT: 180,
  THREE_CARD: 120,
  TWO_PAIR: 80,
  ONE_PAIR: 30,
};

const RANK_VALUE: Record<Rank, number> = {
  A: 14,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

function isSameRank(cards: LineCard[]): boolean {
  if (cards.length === 0) return false;
  const first = cards[0].card.rank;
  return cards.every((item) => item.card.rank === first);
}

function isSameSuit(cards: LineCard[]): boolean {
  if (cards.length === 0) return false;
  const first = cards[0].card.suit;
  return cards.every((item) => item.card.suit === first);
}

function getRankValues(cards: LineCard[]): number[] {
  return cards.map((item) => RANK_VALUE[item.card.rank]);
}

function isStraight(cards: LineCard[]): boolean {
  if (cards.length < 3) return false;

  const ranks = cards.map((item) => item.card.rank);

  /**
   * Aは特殊。
   * A 2 3 4 5 のときは A = 1
   * 10 J Q K A / Q K A のときは A = 14
   */
  const toHighValue = (rank: Rank): number => {
    if (rank === "A") return 14;
    return RANK_VALUE[rank];
  };

  const toLowValue = (rank: Rank): number => {
    if (rank === "A") return 1;
    return RANK_VALUE[rank];
  };

  const isStepSequence = (values: number[]): boolean => {
    let ascending = true;
    let descending = true;

    for (let i = 1; i < values.length; i++) {
      if (values[i] !== values[i - 1] + 1) {
        ascending = false;
      }

      if (values[i] !== values[i - 1] - 1) {
        descending = false;
      }
    }

    return ascending || descending;
  };

  const highValues = ranks.map(toHighValue);
  const lowValues = ranks.map(toLowValue);

  return isStepSequence(highValues) || isStepSequence(lowValues);
}

function isRoyalStraight(cards: LineCard[]): boolean {
  if (cards.length !== 5) return false;

  const forward = ["10", "J", "Q", "K", "A"];
  const backward = ["A", "K", "Q", "J", "10"];

  const ranks = cards.map((item) => item.card.rank);

  return (
    ranks.every((rank, index) => rank === forward[index]) ||
    ranks.every((rank, index) => rank === backward[index])
  );
}

function isFullHouse(cards: LineCard[]): boolean {
  if (cards.length !== 5) return false;

  const ranks = cards.map((item) => item.card.rank);

  /**
   * NUTS仕様:
   * AAA22 または 22AAA の形だけ成立。
   * QQ88Q のようなバラけた並びは不成立。
   */
  const first3Same =
    ranks[0] === ranks[1] &&
    ranks[1] === ranks[2] &&
    ranks[3] === ranks[4] &&
    ranks[0] !== ranks[3];

  const first2Same =
    ranks[0] === ranks[1] &&
    ranks[2] === ranks[3] &&
    ranks[3] === ranks[4] &&
    ranks[0] !== ranks[2];

  return first3Same || first2Same;
}

function isTwoPair(cards: LineCard[]): boolean {
  if (cards.length !== 4) return false;

  const ranks = cards.map((item) => item.card.rank);

  /**
   * NUTS仕様:
   * KK77
   * 77KK
   * AA33
   * 22QQ
   *
   * のように 2枚 + 2枚 の連続形。
   */
  return (
    ranks[0] === ranks[1] &&
    ranks[2] === ranks[3] &&
    ranks[0] !== ranks[2]
  );
}

function judgeSegment(cards: LineCard[]): HandType | null {
  if (cards.length < 2 || cards.length > 5) return null;

  if (
    cards.length === 5 &&
    isSameSuit(cards) &&
    isRoyalStraight(cards)
  ) {
    return "ROYAL_STRAIGHT_FLUSH";
  }

  if (
    cards.length === 5 &&
    isSameSuit(cards) &&
    isStraight(cards)
  ) {
    return "STRAIGHT_FLUSH";
  }

  if (cards.length === 4 && isSameRank(cards)) {
    return "FOUR_CARD";
  }

  if (cards.length === 5 && isFullHouse(cards)) {
    return "FULL_HOUSE";
  }

  if (cards.length === 5 && isSameSuit(cards)) {
    return "FLUSH";
  }

  if (cards.length >= 3 && isStraight(cards)) {
    return "STRAIGHT";
  }

  if (cards.length === 3 && isSameRank(cards)) {
    return "THREE_CARD";
  }

  if (cards.length === 4 && isTwoPair(cards)) {
    return "TWO_PAIR";
  }

  if (cards.length === 2 && isSameRank(cards)) {
    return "ONE_PAIR";
  }

  return null;
}

function includesPosition(cards: LineCard[], position: Position): boolean {
  return cards.some(
    (item) => item.row === position.row && item.col === position.col
  );
}

function getContiguousLine(
  board: Board,
  placed: Position,
  direction: Direction
): LineCard[] {
  const result: LineCard[] = [];

  if (direction === "row") {
    const row = placed.row;

    let startCol = placed.col;
    while (startCol - 1 >= 0 && board[row][startCol - 1]) {
      startCol--;
    }

    let endCol = placed.col;
    while (endCol + 1 < 5 && board[row][endCol + 1]) {
      endCol++;
    }

    for (let col = startCol; col <= endCol; col++) {
      const card = board[row][col];
      if (card) {
        result.push({ card, row, col });
      }
    }
  }

  if (direction === "col") {
    const col = placed.col;

    let startRow = placed.row;
    while (startRow - 1 >= 0 && board[startRow - 1][col]) {
      startRow--;
    }

    let endRow = placed.row;
    while (endRow + 1 < 5 && board[endRow + 1][col]) {
      endRow++;
    }

    for (let row = startRow; row <= endRow; row++) {
      const card = board[row][col];
      if (card) {
        result.push({ card, row, col });
      }
    }
  }

  return result;
}

function getCandidateSegments(
  line: LineCard[],
  placed: Position
): LineCard[][] {
  const segments: LineCard[][] = [];

  for (let start = 0; start < line.length; start++) {
    for (let end = start; end < line.length; end++) {
      const segment = line.slice(start, end + 1);

      if (segment.length < 2 || segment.length > 5) {
        continue;
      }

      if (!includesPosition(segment, placed)) {
        continue;
      }

      segments.push(segment);
    }
  }

  return segments;
}

function createResult(
  type: HandType,
  cards: LineCard[],
  direction: Direction
): HandResult {
  return {
    type,
    cards,
    direction,
    shouldClear: type !== "ONE_PAIR",
    score: SCORE_TABLE[type],
  };
}

function compareHand(a: HandResult, b: HandResult): HandResult {
  const aPriority = HAND_PRIORITY.indexOf(a.type);
  const bPriority = HAND_PRIORITY.indexOf(b.type);

  if (aPriority < bPriority) return a;
  if (bPriority < aPriority) return b;

  /**
   * 同じ役なら、使うカード枚数が多い方を優先。
   * 例: 3枚Straightより5枚Straight。
   */
  if (a.cards.length > b.cards.length) return a;
  if (b.cards.length > a.cards.length) return b;

  return a;
}

export function judgeHandsAfterPlace(
  board: Board,
  placed: Position
): HandResult[] {
  const placedCard = board[placed.row]?.[placed.col];

  if (!placedCard) {
    return [];
  }

  const found: HandResult[] = [];

  for (const direction of ["row", "col"] as Direction[]) {
    const line = getContiguousLine(board, placed, direction);
    const segments = getCandidateSegments(line, placed);

    let bestInDirection: HandResult | null = null;

    for (const segment of segments) {
      const handType = judgeSegment(segment);

      if (!handType) continue;

      const result = createResult(handType, segment, direction);

      if (!bestInDirection) {
        bestInDirection = result;
      } else {
        bestInDirection = compareHand(bestInDirection, result);
      }
    }

    if (bestInDirection) {
      found.push(bestInDirection);
    }
  }

  return found;
}