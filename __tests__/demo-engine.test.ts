import { describe, expect, it } from "vitest";
import {
  accountBalance, addExpense, addIncoming, assignTransaction, capitalTotal,
  collectDebt, counterpartyBalance, createSeedState, createWire, exchangeCurrency,
  inventoryForAccount, ownerDebt, pendingAssignments, previewDemoWire,
  readDemoState, remeseroDebt, reverseExpense, reverseOutflow, zelleSummary,
  setRemeseroDebt,
} from "../lib/demo-engine";

describe("simulador de Transactions Demo", () => {
  it("empieza con un escenario ficticio coherente y versionado", () => {
    const state = createSeedState();
    expect(state.version).toBe(2);
    expect(state.transactions).toHaveLength(6);
    expect(accountBalance(state, "chase")).toBe(6385);
    expect(accountBalance(state, "td")).toBe(5050);
    expect(pendingAssignments(state)).toEqual({ count: 2, amountUsd: 2000 });
    expect(readDemoState(JSON.stringify(state)).transactions).toHaveLength(6);
    expect(readDemoState("not-json").transactions).toHaveLength(6);
  });

  it("usa FIFO por cuenta, incluidos gastos y lotes sin precio", () => {
    const state = createSeedState();
    const chase = inventoryForAccount(state, "chase").valuation;
    expect(chase.balanceUsd).toBe(6385);
    expect(chase.pricedUsd).toBe(5185);
    expect(chase.unpricedUsd).toBe(1200);
    expect(chase.costCup).toBe(3545800);
    const all = zelleSummary(state);
    expect(all.balanceUsd).toBe(11435);
    expect(all.unpricedUsd).toBe(2000);
    expect(all.averagePrice).not.toBeNull();
  });

  it("convierte la reserva pendiente en deuda real sin descontarlas simultáneamente", () => {
    const original = createSeedState();
    const withIncome = addIncoming(original, { accountId: "chase", sender: "Prueba Ficticia", amountUsd: 1200 });
    const incomingId = withIncome.transactions[0].id;
    expect(pendingAssignments(withIncome).amountUsd).toBe(3200);
    expect(accountBalance(withIncome, "chase")).toBe(accountBalance(original, "chase") + 1200);
    const assigned = assignTransaction(withIncome, incomingId, "r1");
    expect(pendingAssignments(assigned).amountUsd).toBe(2000);
    expect(remeseroDebt(assigned, "r1") - remeseroDebt(withIncome, "r1")).toBe(816000);
    expect(assigned.transactions[0].priceApplied).toBe(680);
  });

  it("valora principal más fee pero genera deuda solo por el principal", () => {
    const original = createSeedState();
    const input = { accountId: "chase", counterpartyId: "cp1", principalUsd: 1000, feeUsd: 25, settlementCurrency: "CUP" as const, rateOrPercent: 735 };
    const preview = previewDemoWire(original, input);
    expect(preview.canCreate).toBe(true);
    expect(preview.totalUsd).toBe(1025);
    expect(preview.selected.pricedUsd).toBe(1025);
    expect(preview.snapshot?.settlementAmount).toBe(735000);
    expect(preview.snapshot?.fifoCostCup).toBe(697000);
    expect(preview.snapshot?.ownerFeeCup).toBe(14700);
    expect(preview.snapshot?.netProfitCup).toBe(23300);
    const after = createWire(original, input);
    expect(accountBalance(after, "chase")).toBe(accountBalance(original, "chase") - 1025);
    expect(counterpartyBalance(after, "cp1", "CUP")).toBe(counterpartyBalance(original, "cp1", "CUP") + 735000);
    expect(ownerDebt(after, "chase")).toBeCloseTo(ownerDebt(original, "chase") + 21, 2);
    expect(after.outflows[0].snapshot).toEqual(preview.snapshot);
    const reversed = reverseOutflow(after, after.outflows[0].id);
    expect(accountBalance(reversed, "chase")).toBe(accountBalance(original, "chase"));
    expect(counterpartyBalance(reversed, "cp1", "CUP")).toBe(counterpartyBalance(original, "cp1", "CUP"));
  });

  it("impide wires superiores al saldo al sumar fee", () => {
    const state = createSeedState();
    const preview = previewDemoWire(state, { accountId: "chase", principalUsd: 6380, feeUsd: 25, settlementCurrency: "USD", rateOrPercent: 5 });
    expect(preview.canCreate).toBe(false);
    expect(() => createWire(state, { accountId: "chase", counterpartyId: "cp1", principalUsd: 6380, feeUsd: 25, settlementCurrency: "USD", rateOrPercent: 5 })).toThrow();
  });

  it("un cobro reduce la deuda y sube efectivo en la misma moneda sin duplicar capital", () => {
    const state = createSeedState();
    const before = capitalTotal(state);
    const after = collectDebt(state, "cp1", "USD", 100);
    expect(after.cashUsd - state.cashUsd).toBe(100);
    expect(counterpartyBalance(after, "cp1", "USD")).toBe(counterpartyBalance(state, "cp1", "USD") - 100);
    expect(capitalTotal(after)).toBe(before);
  });

  it("editar la deuda fija exactamente el saldo y actualiza el capital", () => {
    const original = createSeedState();
    const balance = remeseroDebt(original, "r1");
    const adjusted = setRemeseroDebt(original, "r1", 10_000);
    expect(remeseroDebt(adjusted, "r1")).toBe(10_000);
    expect(capitalTotal(adjusted)).toBeCloseTo(capitalTotal(original)! + (balance - 10_000) / original.usdCupRate!, 2);
    expect(remeseroDebt(setRemeseroDebt(adjusted, "r1", -5_000), "r1")).toBe(-5_000);
  });

  it("gastos y cambios se registran y el gasto se revierte", () => {
    const original = createSeedState();
    const expense = addExpense(original, "CUP", 12500, "Transporte ficticio");
    expect(expense.cashCup).toBe(original.cashCup - 12500);
    expect(reverseExpense(expense, expense.expenses[0].id).cashCup).toBe(original.cashCup);
    const fx = exchangeCurrency(original, "USD", 100, 700);
    expect(fx.cashUsd).toBe(original.cashUsd - 100);
    expect(fx.cashCup).toBe(original.cashCup + 70000);
  });
});
