export type Sport = "Cricket" | "Football" | "Tennis" | "Basketball" | "Other";
export type BetStatus = "pending" | "won" | "lost" | "void" | "cashout" | "partial";
export type BetType = "single" | "accumulator" | "system";

export type Bet = {
  id: string;
  user_id?: string;
  sport: Sport;
  event_name: string;
  market: string;
  selection: string;
  bookmaker: string;
  bet_type: BetType;
  odds: number;
  stake: number;
  status: BetStatus;
  actual_return: number | null;
  placed_at: string;
  settled_at: string | null;
  notes: string | null;
  created_at?: string;
};

export type LedgerTransaction = {
  id: string;
  kind: "deposit" | "withdrawal" | "adjustment";
  amount: number;
  occurred_at: string;
  note: string | null;
};
