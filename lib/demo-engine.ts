// Reglas puras adaptadas del cálculo FIFO, ganancia de wire y capital del producto.
// Este módulo no importa código de servidor ni accede a la red o a localStorage.

export const DEMO_VERSION = 2;
export const STORAGE_KEY = `transactions-demo-state-v${DEMO_VERSION}`;
export type Currency = "USD" | "CUP";
export type Section = "inicio" | "transacciones" | "cuentas" | "remeseros" | "finanzas";

export type DemoAccount = {
  id: string; name: string; bank: string; owner: string;
  ownerFeePercent: number; monthlySalaryUsd: number; openingOwnerDebtUsd: number;
};
export type DemoRemesero = { id: string; name: string; price: number; openingDebtCup: number };
export type DemoTransaction = {
  id: string; accountId: string; sender: string; amountUsd: number;
  confirmationCode: string; occurredAt: string; remeseroId: string | null;
  priceApplied: number | null; deletedAt: string | null;
};
export type WireSnapshot = {
  settlementCurrency: Currency; settlementAmount: number; globalRate: number;
  fifoCostCup: number | null; averagePrice: number | null;
  pricedUsd: number; unpricedUsd: number;
  status: "EXACT" | "ESTIMATED" | "UNAVAILABLE";
  ownerFeePercent: number; ownerFeeCup: number; ownerFeeUsd: number;
  grossProfitCup: number | null; grossProfitUsd: number | null;
  netProfitCup: number | null; netProfitUsd: number | null;
};
export type DemoOutflow = {
  id: string; accountId: string; kind: "wire" | "expense";
  principalUsd: number; feeUsd: number; totalUsd: number; occurredAt: string;
  counterpartyId: string | null; snapshot: WireSnapshot | null; reversedAt: string | null;
};
export type DemoCounterparty = { id: string; name: string; openingUsd: number; openingCup: number };
export type DemoDebtMovement = {
  id: string; counterpartyId: string; currency: Currency; delta: number;
  cashDelta: number; occurredAt: string; note: string;
};
export type DemoPayment = { id: string; remeseroId: string; amountCup: number; occurredAt: string };
export type DemoExpense = { id: string; currency: Currency; amount: number; note: string; occurredAt: string; reversedAt: string | null };
export type DemoExchange = { id: string; from: Currency; amount: number; rate: number; occurredAt: string; reversedAt: string | null };
export type DemoState = {
  version: number; accounts: DemoAccount[]; remeseros: DemoRemesero[];
  transactions: DemoTransaction[]; outflows: DemoOutflow[];
  counterparties: DemoCounterparty[]; debtMovements: DemoDebtMovement[];
  payments: DemoPayment[]; expenses: DemoExpense[]; exchanges: DemoExchange[];
  cashUsd: number; cashCup: number; usdCupRate: number;
};

export const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const cents = (value: number) => Math.round(value * 100);
const usd = (value: number) => round(value / 100);
const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
const now = () => new Date().toISOString();
const past = (days: number, hour = 12) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export function createSeedState(): DemoState {
  return {
    version: DEMO_VERSION,
    accounts: [
      { id: "chase", name: "Cuenta principal", bank: "Chase", owner: "Dueña Demo A", ownerFeePercent: 2, monthlySalaryUsd: 2000, openingOwnerDebtUsd: 180 },
      { id: "td", name: "Cuenta comercial", bank: "TD Bank", owner: "Dueño Demo B", ownerFeePercent: 2.5, monthlySalaryUsd: 0, openingOwnerDebtUsd: 90 },
    ],
    remeseros: [
      { id: "r1", name: "Ada Demo", price: 680, openingDebtCup: 0 },
      { id: "r2", name: "Bruno Demo", price: 685, openingDebtCup: 0 },
      { id: "r3", name: "Celia Demo", price: 687, openingDebtCup: 0 },
    ],
    transactions: [
      { id: "tx-1", accountId: "chase", sender: "Comercio Demo Norte", amountUsd: 3000, confirmationCode: "DEMO-582041", occurredAt: past(12, 10), remeseroId: "r1", priceApplied: 680, deletedAt: null },
      { id: "tx-2", accountId: "chase", sender: "Comercio Demo Sur", amountUsd: 4000, confirmationCode: "DEMO-582128", occurredAt: past(9, 15), remeseroId: "r2", priceApplied: 685, deletedAt: null },
      { id: "tx-3", accountId: "td", sender: "Comercio Demo Este", amountUsd: 2500, confirmationCode: "DEMO-583014", occurredAt: past(8, 9), remeseroId: "r3", priceApplied: 687, deletedAt: null },
      { id: "tx-4", accountId: "chase", sender: "Persona Demo A", amountUsd: 1200, confirmationCode: "DEMO-583350", occurredAt: past(5, 13), remeseroId: null, priceApplied: null, deletedAt: null },
      { id: "tx-5", accountId: "td", sender: "Comercio Demo Oeste", amountUsd: 800, confirmationCode: "DEMO-583621", occurredAt: past(4, 11), remeseroId: null, priceApplied: null, deletedAt: null },
      { id: "tx-6", accountId: "td", sender: "Persona Demo B", amountUsd: 2000, confirmationCode: "DEMO-584013", occurredAt: past(2, 16), remeseroId: "r1", priceApplied: 680, deletedAt: null },
    ],
    outflows: [
      { id: "out-1", accountId: "chase", kind: "wire", principalUsd: 1800, feeUsd: 15, totalUsd: 1815, occurredAt: past(7, 14), counterpartyId: "cp1", reversedAt: null, snapshot: {
        settlementCurrency: "CUP", settlementAmount: 1278000, globalRate: 700,
        fifoCostCup: 1234200, averagePrice: 680, pricedUsd: 1815, unpricedUsd: 0,
        status: "EXACT", ownerFeePercent: 2, ownerFeeCup: 25560, ownerFeeUsd: 36.51,
        grossProfitCup: 43800, grossProfitUsd: 62.57, netProfitCup: 18240, netProfitUsd: 26.06,
      } },
      { id: "out-2", accountId: "td", kind: "expense", principalUsd: 250, feeUsd: 0, totalUsd: 250, occurredAt: past(3, 12), counterpartyId: null, reversedAt: null, snapshot: null },
    ],
    counterparties: [
      { id: "cp1", name: "Cliente Demo A", openingUsd: 500, openingCup: 0 },
      { id: "cp2", name: "Cliente Demo B", openingUsd: -200, openingCup: 0 },
      { id: "cp3", name: "Cliente Demo C", openingUsd: 0, openingCup: 2000000 },
    ],
    debtMovements: [
      { id: "debt-1", counterpartyId: "cp1", currency: "CUP", delta: 1278000, cashDelta: 0, occurredAt: past(7, 14), note: "Wire de ejemplo" },
    ],
    payments: [{ id: "pay-1", remeseroId: "r2", amountCup: 450000, occurredAt: past(3, 10) }],
    expenses: [{ id: "exp-1", currency: "CUP", amount: 28000, note: "Mensajería", occurredAt: past(6, 10), reversedAt: null }],
    exchanges: [{ id: "fx-1", from: "USD", amount: 100, rate: 700, occurredAt: past(5, 10), reversedAt: null }],
    cashUsd: 1500, cashCup: 4000000, usdCupRate: 700,
  };
}

export function readDemoState(raw: string | null): DemoState {
  if (!raw) return createSeedState();
  try {
    const value = JSON.parse(raw) as DemoState;
    if (value.version !== DEMO_VERSION || !Array.isArray(value.transactions) || !Array.isArray(value.accounts)) return createSeedState();
    return value;
  } catch { return createSeedState(); }
}

export type Valuation = {
  balanceUsd: number; pricedUsd: number; unpricedUsd: number; costCup: number;
  averagePrice: number | null; coveragePercent: number; deficitUsd: number;
};
type Lot = { id: string; remainingCents: number; price: number | null };
type Inventory = { lots: Lot[]; valuation: Valuation };

function summarize(lots: Lot[], deficitCents = 0): Valuation {
  const priced = lots.filter((lot) => lot.price !== null).reduce((sum, lot) => sum + lot.remainingCents, 0);
  const unpriced = lots.filter((lot) => lot.price === null).reduce((sum, lot) => sum + lot.remainingCents, 0);
  const costCup = round(lots.reduce((sum, lot) => sum + lot.remainingCents * (lot.price ?? 0), 0) / 100);
  const total = priced + unpriced;
  return {
    balanceUsd: usd(total - deficitCents), pricedUsd: usd(priced), unpricedUsd: usd(unpriced),
    costCup, averagePrice: priced ? round(costCup / usd(priced), 6) : null,
    coveragePercent: total ? round(priced / total * 100) : 0, deficitUsd: usd(deficitCents),
  };
}

function consume(lots: Lot[], requestedCents: number) {
  const selected: Lot[] = [];
  let remaining = requestedCents;
  while (remaining > 0 && lots.length) {
    const lot = lots[0];
    const taken = Math.min(remaining, lot.remainingCents);
    selected.push({ ...lot, remainingCents: taken });
    lot.remainingCents -= taken;
    remaining -= taken;
    if (lot.remainingCents === 0) lots.shift();
  }
  return { selected, deficitCents: remaining };
}

export function inventoryForAccount(state: DemoState, accountId: string): Inventory {
  const lots: Lot[] = [];
  let deficitCents = 0;
  const events = [
    ...state.transactions.filter((tx) => tx.accountId === accountId && !tx.deletedAt).map((tx) => ({ id: tx.id, amount: tx.amountUsd, date: tx.occurredAt, price: tx.priceApplied, kind: "in" as const })),
    ...state.outflows.filter((item) => item.accountId === accountId && !item.reversedAt).map((item) => ({ id: item.id, amount: item.totalUsd, date: item.occurredAt, price: null, kind: "out" as const })),
  ].sort((a, b) => a.date.localeCompare(b.date) || (a.kind === "in" ? -1 : 1) || a.id.localeCompare(b.id));
  for (const event of events) {
    if (event.kind === "out") { deficitCents += consume(lots, cents(event.amount)).deficitCents; continue; }
    let amount = cents(event.amount);
    const absorbed = Math.min(amount, deficitCents);
    deficitCents -= absorbed;
    amount -= absorbed;
    if (amount > 0) lots.push({ id: event.id, remainingCents: amount, price: event.price });
  }
  return { lots, valuation: summarize(lots, deficitCents) };
}

export function zelleSummary(state: DemoState) {
  const accounts = state.accounts.map((account) => ({ ...account, accountId: account.id, ...inventoryForAccount(state, account.id).valuation }));
  const pricedUsd = round(accounts.reduce((sum, account) => sum + account.pricedUsd, 0));
  const unpricedUsd = round(accounts.reduce((sum, account) => sum + account.unpricedUsd, 0));
  const costCup = round(accounts.reduce((sum, account) => sum + account.costCup, 0));
  return {
    accounts, pricedUsd, unpricedUsd, costCup,
    balanceUsd: round(accounts.reduce((sum, account) => sum + account.balanceUsd, 0)),
    averagePrice: pricedUsd ? round(costCup / pricedUsd, 6) : null,
    coveragePercent: pricedUsd + unpricedUsd ? round(pricedUsd / (pricedUsd + unpricedUsd) * 100) : 0,
  };
}

export type DemoWirePreview = {
  canCreate: boolean; error: string | null; principalUsd: number; feeUsd: number;
  totalUsd: number; availableUsd: number; selected: Valuation; remaining: Valuation;
  snapshot: WireSnapshot | null;
};

export function previewDemoWire(state: DemoState, input: {
  accountId: string; principalUsd: number; feeUsd: number;
  settlementCurrency: Currency; rateOrPercent: number;
}): DemoWirePreview {
  const account = state.accounts.find((entry) => entry.id === input.accountId);
  const inventory = inventoryForAccount(state, input.accountId);
  const totalUsd = round(input.principalUsd + input.feeUsd);
  const valid = !!account && input.principalUsd > 0 && input.feeUsd >= 0 &&
    input.rateOrPercent > 0 && state.usdCupRate > 0 && totalUsd <= inventory.valuation.balanceUsd;
  const lots = inventory.lots.map((lot) => ({ ...lot }));
  const consumed = consume(lots, cents(Math.max(0, Math.min(totalUsd, inventory.valuation.balanceUsd))));
  const selected = summarize(consumed.selected);
  const remaining = summarize(lots);
  const settlementAmount = input.settlementCurrency === "CUP"
    ? round(input.principalUsd * input.rateOrPercent)
    : round(input.principalUsd * (1 + input.rateOrPercent / 100));
  const ownerFeePercent = account?.ownerFeePercent ?? 0;
  const ownerFeeAmount = round((input.settlementCurrency === "CUP" ? settlementAmount : input.principalUsd) * ownerFeePercent / 100);
  const ownerFeeCup = round(input.settlementCurrency === "CUP" ? ownerFeeAmount : ownerFeeAmount * state.usdCupRate);
  const ownerFeeUsd = round(input.settlementCurrency === "USD" ? ownerFeeAmount : ownerFeeAmount / state.usdCupRate);
  const status = selected.pricedUsd === 0 ? "UNAVAILABLE" : selected.unpricedUsd > 0 ? "ESTIMATED" : "EXACT";
  const fifoCostCup = status === "UNAVAILABLE" ? null : round(selected.costCup + selected.unpricedUsd * (selected.averagePrice ?? 0));
  const grossProfitCup = fifoCostCup === null ? null : round((input.settlementCurrency === "CUP" ? settlementAmount : settlementAmount * state.usdCupRate) - fifoCostCup);
  const netProfitCup = grossProfitCup === null ? null : round(grossProfitCup - ownerFeeCup);
  return {
    canCreate: valid,
    error: !account ? "Selecciona una cuenta" : state.usdCupRate <= 0 ? "Configura la tasa global" : totalUsd > inventory.valuation.balanceUsd ? "Saldo Zelle insuficiente para principal y fee" : !valid ? "Revisa los importes" : null,
    principalUsd: input.principalUsd, feeUsd: input.feeUsd, totalUsd,
    availableUsd: inventory.valuation.balanceUsd, selected, remaining,
    snapshot: account ? {
      settlementCurrency: input.settlementCurrency, settlementAmount, globalRate: state.usdCupRate,
      fifoCostCup, averagePrice: selected.averagePrice, pricedUsd: selected.pricedUsd,
      unpricedUsd: selected.unpricedUsd, status, ownerFeePercent, ownerFeeCup, ownerFeeUsd,
      grossProfitCup, grossProfitUsd: grossProfitCup === null ? null : round(grossProfitCup / state.usdCupRate),
      netProfitCup, netProfitUsd: netProfitCup === null ? null : round(netProfitCup / state.usdCupRate),
    } : null,
  };
}

export function accountBalance(state: DemoState, accountId: string) { return inventoryForAccount(state, accountId).valuation.balanceUsd; }
export function remeseroDebt(state: DemoState, remeseroId: string) {
  const remesero = state.remeseros.find((entry) => entry.id === remeseroId);
  return round((remesero?.openingDebtCup ?? 0) + state.transactions.filter((tx) => !tx.deletedAt && tx.remeseroId === remeseroId).reduce((sum, tx) => sum + tx.amountUsd * (tx.priceApplied ?? 0), 0) - state.payments.filter((item) => item.remeseroId === remeseroId).reduce((sum, item) => sum + item.amountCup, 0));
}
export function counterpartyBalance(state: DemoState, counterpartyId: string, currency: Currency) {
  const person = state.counterparties.find((entry) => entry.id === counterpartyId);
  return round((currency === "USD" ? person?.openingUsd : person?.openingCup) ?? 0) +
    round(state.debtMovements.filter((movement) => movement.counterpartyId === counterpartyId && movement.currency === currency).reduce((sum, movement) => sum + movement.delta, 0));
}
export function ownerDebt(state: DemoState, accountId: string) {
  const account = state.accounts.find((entry) => entry.id === accountId);
  return round((account?.openingOwnerDebtUsd ?? 0) + state.outflows.filter((item) => item.accountId === accountId && item.kind === "wire" && !item.reversedAt).reduce((sum, item) => sum + (item.snapshot?.ownerFeeUsd ?? 0), 0));
}
export function pendingAssignments(state: DemoState) {
  const items = state.transactions.filter((tx) => !tx.deletedAt && tx.amountUsd > 0 && tx.remeseroId === null);
  return { count: items.length, amountUsd: round(items.reduce((sum, tx) => sum + tx.amountUsd, 0)) };
}
export function capitalTotal(state: DemoState) {
  if (state.usdCupRate <= 0) return null;
  const zelleUsd = zelleSummary(state).balanceUsd;
  const pendingUsd = pendingAssignments(state).amountUsd;
  const externalUsd = state.counterparties.reduce((sum, person) => sum + counterpartyBalance(state, person.id, "USD"), 0);
  const externalCup = state.counterparties.reduce((sum, person) => sum + counterpartyBalance(state, person.id, "CUP"), 0);
  const remeserosCup = state.remeseros.reduce((sum, person) => sum + remeseroDebt(state, person.id), 0);
  const ownersUsd = state.accounts.reduce((sum, account) => sum + ownerDebt(state, account.id), 0);
  return round(state.cashUsd + zelleUsd - pendingUsd + externalUsd - ownersUsd + (state.cashCup + externalCup - remeserosCup) / state.usdCupRate);
}

export function addIncoming(state: DemoState, input: { accountId: string; sender: string; amountUsd: number }) {
  if (!state.accounts.some((account) => account.id === input.accountId) || !input.sender.trim() || input.amountUsd <= 0) throw new Error("Completa la cuenta, el remitente y un importe válido.");
  const transaction: DemoTransaction = {
    id: uid("tx"), accountId: input.accountId, sender: input.sender.trim(),
    amountUsd: round(input.amountUsd), confirmationCode: `DEMO-${Math.floor(100000 + Math.random() * 900000)}`,
    occurredAt: now(), remeseroId: null, priceApplied: null, deletedAt: null,
  };
  return { ...state, transactions: [transaction, ...state.transactions] };
}
export function assignTransaction(state: DemoState, transactionId: string, remeseroId: string) {
  const remesero = state.remeseros.find((entry) => entry.id === remeseroId);
  const transaction = state.transactions.find((entry) => entry.id === transactionId);
  if (!remesero || !transaction || transaction.deletedAt) throw new Error("Transacción o remesero no disponible.");
  if (transaction.remeseroId) throw new Error("La transacción ya está asignada.");
  return { ...state, transactions: state.transactions.map((entry) => entry.id === transactionId ? { ...entry, remeseroId, priceApplied: remesero.price } : entry) };
}
export function unassignTransaction(state: DemoState, transactionId: string) {
  return { ...state, transactions: state.transactions.map((entry) => entry.id === transactionId ? { ...entry, remeseroId: null, priceApplied: null } : entry) };
}
export function createWire(state: DemoState, input: {
  accountId: string; counterpartyId: string; principalUsd: number; feeUsd: number;
  settlementCurrency: Currency; rateOrPercent: number;
}) {
  if (!state.counterparties.some((person) => person.id === input.counterpartyId)) throw new Error("Selecciona una contraparte.");
  const preview = previewDemoWire(state, input);
  if (!preview.canCreate || !preview.snapshot) throw new Error(preview.error ?? "No se puede registrar el wire.");
  const wireId = uid("wire");
  const outflow: DemoOutflow = {
    id: wireId, accountId: input.accountId, kind: "wire", principalUsd: round(input.principalUsd),
    feeUsd: round(input.feeUsd), totalUsd: preview.totalUsd, occurredAt: now(),
    counterpartyId: input.counterpartyId, snapshot: preview.snapshot, reversedAt: null,
  };
  const debt: DemoDebtMovement = {
    id: uid("debt"), counterpartyId: input.counterpartyId,
    currency: input.settlementCurrency, delta: preview.snapshot.settlementAmount,
    cashDelta: 0, occurredAt: outflow.occurredAt, note: `Cobro por wire ${wireId}`,
  };
  return { ...state, outflows: [outflow, ...state.outflows], debtMovements: [debt, ...state.debtMovements] };
}
export function collectDebt(state: DemoState, counterpartyId: string, currency: Currency, amount: number) {
  if (!state.counterparties.some((person) => person.id === counterpartyId) || amount <= 0) throw new Error("Selecciona una persona y un importe válido.");
  const movement: DemoDebtMovement = { id: uid("debt"), counterpartyId, currency, delta: -round(amount), cashDelta: round(amount), occurredAt: now(), note: "Cobro registrado" };
  return { ...state, debtMovements: [movement, ...state.debtMovements], cashUsd: round(state.cashUsd + (currency === "USD" ? amount : 0)), cashCup: round(state.cashCup + (currency === "CUP" ? amount : 0)) };
}
export function payRemesero(state: DemoState, remeseroId: string, amountCup: number) {
  if (!state.remeseros.some((person) => person.id === remeseroId) || amountCup <= 0) throw new Error("Selecciona un remesero y un importe válido.");
  return { ...state, payments: [{ id: uid("pay"), remeseroId, amountCup: round(amountCup), occurredAt: now() }, ...state.payments], cashCup: round(state.cashCup - amountCup) };
}
export function addExpense(state: DemoState, currency: Currency, amount: number, note: string) {
  if (amount <= 0 || !note.trim()) throw new Error("Escribe un importe y concepto válidos.");
  return { ...state, expenses: [{ id: uid("exp"), currency, amount: round(amount), note: note.trim(), occurredAt: now(), reversedAt: null }, ...state.expenses], cashUsd: round(state.cashUsd - (currency === "USD" ? amount : 0)), cashCup: round(state.cashCup - (currency === "CUP" ? amount : 0)) };
}
export function reverseExpense(state: DemoState, expenseId: string) {
  const expense = state.expenses.find((entry) => entry.id === expenseId && !entry.reversedAt);
  if (!expense) throw new Error("El gasto ya fue revertido.");
  return { ...state, expenses: state.expenses.map((entry) => entry.id === expenseId ? { ...entry, reversedAt: now() } : entry), cashUsd: round(state.cashUsd + (expense.currency === "USD" ? expense.amount : 0)), cashCup: round(state.cashCup + (expense.currency === "CUP" ? expense.amount : 0)) };
}
export function addAccountExpense(state: DemoState, accountId: string, amountUsd: number) {
  if (!state.accounts.some((entry) => entry.id === accountId) || amountUsd <= 0 || accountBalance(state, accountId) < amountUsd) throw new Error("Importe mayor que el saldo disponible.");
  const outflow: DemoOutflow = { id: uid("out"), accountId, kind: "expense", principalUsd: round(amountUsd), feeUsd: 0, totalUsd: round(amountUsd), occurredAt: now(), counterpartyId: null, snapshot: null, reversedAt: null };
  return { ...state, outflows: [outflow, ...state.outflows] };
}
export function reverseOutflow(state: DemoState, outflowId: string) {
  const item = state.outflows.find((entry) => entry.id === outflowId && !entry.reversedAt);
  if (!item) throw new Error("Esta salida ya fue revertida.");
  const debtMovements = item.kind === "wire" && item.counterpartyId && item.snapshot
    ? [{ id: uid("debt"), counterpartyId: item.counterpartyId, currency: item.snapshot.settlementCurrency, delta: -item.snapshot.settlementAmount, cashDelta: 0, occurredAt: now(), note: `Reversión del wire ${item.id}` }, ...state.debtMovements]
    : state.debtMovements;
  return { ...state, outflows: state.outflows.map((entry) => entry.id === outflowId ? { ...entry, reversedAt: now() } : entry), debtMovements };
}
export function exchangeCurrency(state: DemoState, from: Currency, amount: number, rate: number) {
  if (amount <= 0 || rate <= 0) throw new Error("Importe y tasa deben ser mayores que cero.");
  const converted = round(from === "USD" ? amount * rate : amount / rate);
  return { ...state, exchanges: [{ id: uid("fx"), from, amount: round(amount), rate, occurredAt: now(), reversedAt: null }, ...state.exchanges], cashUsd: round(state.cashUsd + (from === "USD" ? -amount : converted)), cashCup: round(state.cashCup + (from === "CUP" ? -amount : converted)) };
}
export function reverseExchange(state: DemoState, exchangeId: string) {
  const item = state.exchanges.find((entry) => entry.id === exchangeId && !entry.reversedAt);
  if (!item) throw new Error("El cambio ya fue revertido.");
  const converted = round(item.from === "USD" ? item.amount * item.rate : item.amount / item.rate);
  return { ...state, exchanges: state.exchanges.map((entry) => entry.id === exchangeId ? { ...entry, reversedAt: now() } : entry), cashUsd: round(state.cashUsd + (item.from === "USD" ? item.amount : -converted)), cashCup: round(state.cashCup + (item.from === "CUP" ? item.amount : -converted)) };
}
export function setFinanceState(state: DemoState, input: { cashUsd: number; cashCup: number; usdCupRate: number }) {
  if (![input.cashUsd, input.cashCup, input.usdCupRate].every(Number.isFinite) || input.usdCupRate <= 0) throw new Error("Indica importes válidos y una tasa mayor que cero.");
  return { ...state, cashUsd: round(input.cashUsd), cashCup: round(input.cashCup), usdCupRate: round(input.usdCupRate) };
}
export function setRemeseroPrice(state: DemoState, remeseroId: string, price: number) {
  if (price <= 0) throw new Error("El precio debe ser mayor que cero.");
  return { ...state, remeseros: state.remeseros.map((person) => person.id === remeseroId ? { ...person, price: round(price) } : person) };
}
export function setRemeseroDebt(state: DemoState, remeseroId: string, targetCup: number) {
  if (!Number.isFinite(targetCup) || !state.remeseros.some((person) => person.id === remeseroId)) throw new Error("Indica una deuda válida.");
  const difference = round(targetCup - remeseroDebt(state, remeseroId));
  return { ...state, remeseros: state.remeseros.map((person) => person.id === remeseroId ? { ...person, openingDebtCup: round(person.openingDebtCup + difference) } : person) };
}
export function canDeleteTransaction(state: DemoState, transactionId: string) {
  const transaction = state.transactions.find((entry) => entry.id === transactionId);
  if (!transaction || transaction.deletedAt || transaction.remeseroId) return false;
  return inventoryForAccount(state, transaction.accountId).lots.some((lot) => lot.id === transactionId && lot.remainingCents === cents(transaction.amountUsd));
}
export function deleteTransaction(state: DemoState, transactionId: string) {
  if (!canDeleteTransaction(state, transactionId)) throw new Error("Esta entrada está asignada o ya fue consumida por una salida.");
  return { ...state, transactions: state.transactions.map((entry) => entry.id === transactionId ? { ...entry, deletedAt: now() } : entry) };
}
export function restoreTransaction(state: DemoState, transactionId: string) {
  return { ...state, transactions: state.transactions.map((entry) => entry.id === transactionId ? { ...entry, deletedAt: null } : entry) };
}
