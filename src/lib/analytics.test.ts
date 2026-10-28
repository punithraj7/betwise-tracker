import { describe, expect, it } from "vitest";
import { dailyProfitSeries, netProfit, summarizeBets } from "./analytics";
import type { Bet } from "./types";

const base = (overrides: Partial<Bet>): Bet => ({
  id: "1", sport: "Cricket", event_name: "India vs Australia", market: "Winner",
  selection: "India", bookmaker: "Demo", bet_type: "single", odds: 2, stake: 100,
  status: "pending", actual_return: null, placed_at: "2026-01-01T12:00:00.000Z",
  settled_at: null, notes: null, ...overrides
});

describe("netProfit", () => {
  it("does not count pending bets", () => expect(netProfit(base({status:"pending"}))).toBe(0));
  it("calculates a win using total returned including stake", () => expect(netProfit(base({status:"won",actual_return:190}))).toBe(90));
  it("calculates a loss", () => expect(netProfit(base({status:"lost",actual_return:0}))).toBe(-100));
  it("treats void as zero P/L", () => expect(netProfit(base({status:"void",actual_return:100}))).toBe(0));
  it("calculates cashout from actual return", () => expect(netProfit(base({status:"cashout",actual_return:75}))).toBe(-25));
});

describe("summary", () => {
  it("separates settled profit from pending exposure", () => {
    const bets = [
      base({id:"1",status:"won",actual_return:200,stake:100,settled_at:"2026-01-01T13:00:00.000Z"}),
      base({id:"2",status:"lost",actual_return:0,stake:50,settled_at:"2026-01-02T13:00:00.000Z"}),
      base({id:"3",status:"pending",actual_return:null,stake:25})
    ];
    const result = summarizeBets(bets, [], 500);
    expect(result.profit).toBe(50);
    expect(result.totalStaked).toBe(150);
    expect(result.pendingExposure).toBe(25);
    expect(result.bankroll).toBe(550);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(1);
  });
  it("does not treat deposits as profit", () => {
    const result = summarizeBets([], [{id:"t",kind:"deposit",amount:300,occurred_at:"2026-01-01",note:null}], 500);
    expect(result.profit).toBe(0);
    expect(result.bankroll).toBe(800);
  });
  it("builds a sorted daily series", () => {
    const series = dailyProfitSeries([
      base({id:"b",status:"lost",stake:20,actual_return:0,settled_at:"2026-02-02T12:00:00.000Z"}),
      base({id:"a",status:"won",stake:20,actual_return:40,settled_at:"2026-02-01T12:00:00.000Z"})
    ]);
    expect(series.map(x=>x.date)).toEqual(["2026-02-01","2026-02-02"]);
    expect(series.map(x=>x.profit)).toEqual([20,-20]);
  });
});
