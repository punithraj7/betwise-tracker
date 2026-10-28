import type { Bet, BetStatus, LedgerTransaction } from "./types";

export function netProfit(bet: Pick<Bet, "status" | "stake" | "actual_return">): number {
  if (bet.status === "pending") return 0;
  if (bet.status === "void") return 0;
  if (bet.status === "lost") return -Number(bet.stake || 0);
  if (bet.status === "won" || bet.status === "cashout" || bet.status === "partial") {
    return Number(bet.actual_return ?? 0) - Number(bet.stake || 0);
  }
  return 0;
}

export function isSettled(status: BetStatus): boolean {
  return status !== "pending";
}

export function summarizeBets(bets: Bet[], transactions: LedgerTransaction[] = [], initialBankroll = 0) {
  const settled = bets.filter(b => isSettled(b.status));
  const decided = settled.filter(b => b.status !== "void");
  const wins = bets.filter(b => b.status === "won");
  const stakeSettled = settled.filter(b => b.status !== "void").reduce((s,b) => s + Number(b.stake || 0), 0);
  const profit = settled.reduce((s,b) => s + netProfit(b), 0);
  const returned = settled.reduce((s,b) => s + (b.status === "lost" ? 0 : b.status === "void" ? Number(b.stake || 0) : Number(b.actual_return || 0)), 0);
  const activeDays = new Set(settled.map(b => (b.settled_at || b.placed_at).slice(0,10))).size;
  const deposits = transactions.filter(t => t.kind === "deposit").reduce((s,t) => s + Number(t.amount), 0);
  const withdrawals = transactions.filter(t => t.kind === "withdrawal").reduce((s,t) => s + Number(t.amount), 0);
  const adjustments = transactions.filter(t => t.kind === "adjustment").reduce((s,t) => s + Number(t.amount), 0);
  const pendingExposure = bets.filter(b => b.status === "pending").reduce((s,b) => s + Number(b.stake), 0);
  const calendarDays = settled.length
    ? Math.max(1, Math.floor((Date.now() - new Date(Math.min(...settled.map(b => new Date(b.settled_at || b.placed_at).getTime()))).getTime()) / 86400000) + 1)
    : 0;
  return {
    totalBets: bets.length, settledBets: settled.length, pendingBets: bets.filter(b => b.status === "pending").length,
    wins: wins.length, losses: bets.filter(b => b.status === "lost").length,
    winRate: decided.length ? wins.length / decided.length * 100 : 0,
    totalStaked: stakeSettled, totalReturned: returned, profit, roi: stakeSettled ? profit / stakeSettled * 100 : 0,
    avgDailyProfit: calendarDays ? profit / calendarDays : 0,
    avgActiveDayProfit: activeDays ? profit / activeDays : 0,
    averageStake: settled.length ? settled.reduce((s,b) => s + Number(b.stake), 0) / settled.length : 0,
    pendingExposure,
    bankroll: initialBankroll + profit + deposits - withdrawals + adjustments,
    initialBankroll, deposits, withdrawals, activeDays, calendarDays
  };
}

export function dailyProfitSeries(bets: Bet[]) {
  const map = new Map<string, number>();
  for (const bet of bets) {
    if (bet.status === "pending") continue;
    const day = (bet.settled_at || bet.placed_at).slice(0,10);
    map.set(day, (map.get(day) || 0) + netProfit(bet));
  }
  return [...map.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([date, profit]) => ({
    date, label: new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day:"2-digit", month:"short" }), profit
  }));
}

export function sportBreakdown(bets: Bet[]) {
  const map = new Map<string, { sport: string; bets: number; profit: number; staked: number }>();
  for (const bet of bets) {
    const row = map.get(bet.sport) || { sport: bet.sport, bets: 0, profit: 0, staked: 0 };
    row.bets += 1;
    if (bet.status !== "pending") {
      row.profit += netProfit(bet);
      if (bet.status !== "void") row.staked += Number(bet.stake || 0);
    }
    map.set(bet.sport, row);
  }
  return [...map.values()].sort((a,b) => b.profit - a.profit);
}
