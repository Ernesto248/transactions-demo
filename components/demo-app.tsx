"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Banknote,
  BarChart3, BookOpen, Building2, Check, ChevronDown, CircleHelp, Coins,
  CreditCard, DollarSign, Eye, Landmark, Menu, Play, Plus, RefreshCcw,
  RotateCcw, Search, ShieldCheck, Sparkles, TrendingUp, Trash2, Users, Wallet, X,
} from "lucide-react";
import type { DriveStep, Driver, Popover } from "driver.js";
import {
  STORAGE_KEY, accountBalance, addAccountExpense, addExpense, addIncoming,
  assignTransaction, canDeleteTransaction, capitalTotal, collectDebt, counterpartyBalance,
  createSeedState, createWire, deleteTransaction, exchangeCurrency, inventoryForAccount,
  ownerDebt, payRemesero, pendingAssignments, previewDemoWire, readDemoState,
  remeseroDebt, restoreTransaction, reverseExchange, reverseExpense, reverseOutflow,
  setFinanceState, setRemeseroPrice, unassignTransaction, zelleSummary,
  type Currency, type DemoState, type Section,
} from "@/lib/demo-engine";

type Modal = "incoming" | "assign" | "wire" | "accountExpense" | "price" | "remeseroPayment" | "cash" | "expense" | "exchange" | "collect" | "explain" | null;
type Chapter = "completo" | "transacciones" | "cuentas" | "remeseros" | "finanzas";
const money = (value: number, currency: Currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const number = (value: number, digits = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
const date = (value: string) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
const sections: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: "inicio", label: "Inicio", icon: BarChart3 },
  { id: "transacciones", label: "Transacciones", icon: ArrowDownLeft },
  { id: "cuentas", label: "Cuentas", icon: Landmark },
  { id: "remeseros", label: "Remeseros", icon: Users },
  { id: "finanzas", label: "Finanzas", icon: Wallet },
];

export default function DemoApp() {
  const [data, setData] = useState<DemoState | null>(null);
  const dataRef = useRef<DemoState | null>(null);
  const [section, setSection] = useState<Section>("inicio");
  const [modal, setModal] = useState<Modal>(null);
  const [selectedId, setSelectedId] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("chase");
  const [selectedPerson, setSelectedPerson] = useState("cp1");
  const [search, setSearch] = useState("");
  const [codeFilter, setCodeFilter] = useState("");
  const [showTrash, setShowTrash] = useState(false);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [detailRemesero, setDetailRemesero] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [explanation, setExplanation] = useState({ title: "", body: "" });
  const driverRef = useRef<Driver | null>(null);
  const tourTransactionRef = useRef("");

  const [incoming, setIncoming] = useState({ accountId: "chase", sender: "", amountUsd: "" });
  const [assignTo, setAssignTo] = useState("r1");
  const [wire, setWire] = useState({ accountId: "chase", counterpartyId: "cp1", principalUsd: "1000", feeUsd: "25", settlementCurrency: "CUP" as Currency, rateOrPercent: "735" });
  const [simpleAmount, setSimpleAmount] = useState("");
  const [simpleNote, setSimpleNote] = useState("");
  const [simpleCurrency, setSimpleCurrency] = useState<Currency>("CUP");
  const [simpleRate, setSimpleRate] = useState("700");
  const [financeFields, setFinanceFields] = useState({ cashUsd: "", cashCup: "", usdCupRate: "" });

  useEffect(() => {
    const loaded = readDemoState(window.localStorage.getItem(STORAGE_KEY));
    dataRef.current = loaded;
    setData(loaded);
    setShowWelcome(window.localStorage.getItem("transactions-demo-tour-seen") !== "yes");
  }, []);
  useEffect(() => { if (data) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }, [data]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4200); return () => window.clearTimeout(timer); }, [toast]);

  const commit = useCallback((action: (current: DemoState) => DemoState, message: string) => {
    const current = dataRef.current;
    if (!current) return false;
    try {
      const next = action(current);
      dataRef.current = next;
      setData(next);
      if (message) setToast(message);
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : "No se pudo completar la acción.");
      return false;
    }
  }, []);
  const reset = () => {
    driverRef.current?.destroy();
    const seed = createSeedState();
    dataRef.current = seed;
    setData(seed);
    setSection("inicio"); setModal(null); setShowTrash(false); setDetailRemesero(null);
    setToast("Escenario ficticio restaurado.");
  };
  const explain = (title: string, body: string) => { setExplanation({ title, body }); setModal("explain"); };
  const navigate = (next: Section) => { setSection(next); setDetailRemesero(null); setMenuOpen(false); };
  const openModal = (next: Modal, id = "") => {
    setSelectedId(id); setModal(next); setSimpleAmount(""); setSimpleNote("");
    if (next === "cash" && dataRef.current) setFinanceFields({ cashUsd: String(dataRef.current.cashUsd), cashCup: String(dataRef.current.cashCup), usdCupRate: String(dataRef.current.usdCupRate) });
    if (next === "price" && dataRef.current) setSimpleAmount(String(dataRef.current.remeseros.find((person) => person.id === id)?.price ?? ""));
    if (next === "wire") {
      setSelectedAccount(id || "chase");
      setWire({ accountId: id || "chase", counterpartyId: "cp1", principalUsd: "1000", feeUsd: "25", settlementCurrency: "CUP", rateOrPercent: "735" });
    }
    if (next === "collect") setSelectedPerson(id || "cp1");
  };

  const startTour = useCallback(async (chapter: Chapter) => {
    driverRef.current?.destroy();
    setShowWelcome(false); setShowChapters(false);
    window.localStorage.setItem("transactions-demo-tour-seen", "yes");
    const fresh = createSeedState();
    dataRef.current = fresh; setData(fresh);
    tourTransactionRef.current = "";
    setSearch(""); setCodeFilter(""); setShowTrash(false); setModal(null);
    const { driver } = await import("driver.js");
    type TourStep = DriveStep & { demoSection: Section };
    const wait = (fn: () => void, instance: Driver) => { fn(); window.setTimeout(() => instance.moveNext(), 150); };
    const t: TourStep[] = [];
    const add = (demoSection: Section, element: string, title: string, description: string, onNextClick?: (instance: Driver) => void) => {
      const popover: Popover = { title, description, side: "bottom", align: "start" };
      if (onNextClick) popover.onNextClick = (_element, _step, options) => onNextClick(options.driver);
      t.push({ demoSection, element, waitForElement: 5000, popover });
    };
    if (chapter === "completo") add("inicio", "#demo-hero", "Bienvenido a Transactions Demo", "Todos los datos son ficticios y viven únicamente en este navegador. En cuatro capítulos verás el recorrido de una operación realista.", (instance) => wait(() => navigate("transacciones"), instance));
    if (chapter === "completo" || chapter === "transacciones") {
      add("transacciones", "#transaction-toolbar", "1 · Transacciones", "Aquí llegan los pagos Zelle. Puedes buscar por remitente o código, y revisar entradas activas o la papelera.");
      add("transacciones", "#new-transaction-btn", "Simula una entrada", "Pulsa Siguiente: llegará un pago ficticio de 1,200 USD a la cuenta principal.", (instance) => wait(() => {
        const current = dataRef.current;
        if (!current) return;
        const next = addIncoming(current, { accountId: "chase", sender: "Comercio Demo Central", amountUsd: 1200 });
        tourTransactionRef.current = next.transactions[0].id;
        dataRef.current = next; setData(next); setToast("Entrada simulada recibida.");
      }, instance));
      add("transacciones", "#demo-new-tx", "Sin asignación", "La entrada aumenta Zelle, pero aparece en Pendiente de asignar hasta elegir un remesero.");
      add("transacciones", "#assign-demo-btn", "Asignar a Ada Demo", "Pulsa Siguiente para aplicar su precio de 680 CUP/USD. La reserva pendiente se convertirá en deuda real.", (instance) => wait(() => {
        const current = dataRef.current;
        const txId = tourTransactionRef.current;
        if (current && txId) commit((value) => assignTransaction(value, txId, "r1"), "Entrada asignada a Ada Demo.");
      }, instance));
      if (chapter === "completo") add("transacciones", "#transaction-toolbar", "Siguiente: Cuentas", "Verás el inventario Zelle y cómo una salida consume los lotes más antiguos.", (instance) => wait(() => navigate("cuentas"), instance));
    }
    if (chapter === "completo" || chapter === "cuentas") {
      add("cuentas", "#account-card-chase", "2 · Cuentas", "Cada cuenta tiene saldo, valoración FIFO y una comisión propia para su dueño.");
      add("cuentas", "#wire-action-btn", "Prepara un wire", "Pulsa Siguiente para abrir un wire ficticio de 1,000 USD con fee de 25 USD.", (instance) => wait(() => openModal("wire", "chase"), instance));
      add("cuentas", "#wire-preview-panel", "Costo y ganancia antes de confirmar", "La deuda del cliente usa solo el principal. Zelle descuenta principal + fee; FIFO valora todo el débito y la comisión reduce la ganancia neta.");
      add("cuentas", "#wire-confirm-btn", "Confirma la simulación", "Pulsa Siguiente para registrar este wire localmente. Verás el nuevo saldo y quedará una fotografía de la ganancia.", (instance) => wait(() => {
        commit((value) => createWire(value, { accountId: "chase", counterpartyId: "cp1", principalUsd: 1000, feeUsd: 25, settlementCurrency: "CUP", rateOrPercent: 735 }), "Wire ficticio registrado.");
        setModal(null);
      }, instance));
      add("cuentas", "#account-balance-chase", "Saldo actualizado", "El débito total ya se restó de la cuenta. El historial conserva costo, comisión y ganancia del momento del wire.");
      if (chapter === "completo") add("cuentas", "#account-card-chase", "Siguiente: Remeseros", "Ahora comprueba cómo una asignación cambia la deuda de quien recoge el Zelle.", (instance) => wait(() => navigate("remeseros"), instance));
    }
    if (chapter === "completo" || chapter === "remeseros") {
      add("remeseros", "#remesero-card-r1", "3 · Remeseros", "La deuda se calcula con las entradas asignadas y el precio aplicado al asignar; cambiar el precio futuro no reescribe el pasado.");
      add("remeseros", "#remesero-actions-r1", "Precio, pago y detalle", "Puedes cambiar el precio, registrar un pago en CUP o abrir la tarjeta para revisar sus operaciones.");
      if (chapter === "completo") add("remeseros", "#remesero-card-r1", "Siguiente: Finanzas", "La última parada une Zelle, efectivo, deudas, reservas y valoración.", (instance) => wait(() => navigate("finanzas"), instance));
    }
    if (chapter === "completo" || chapter === "finanzas") {
      add("finanzas", "#capital-kpi", "4 · Capital neto", "Combina efectivo, Zelle, deudas externas y obligaciones con remeseros y dueños. Las entradas sin asignar se reservan una sola vez.");
      add("finanzas", "#zelle-valuation", "Valoración del Zelle", "El promedio FIFO solo incluye USD con precio. Los lotes sin asignación aparecen como Sin precio y la cobertura lo hace visible.");
      add("finanzas", "#external-debt-card-cp1", "Cobrar una deuda", "Pulsa Siguiente para registrar un cobro ficticio de 100 USD a Cliente Demo A: baja su deuda y sube tu efectivo.", (instance) => wait(() => commit((value) => collectDebt(value, "cp1", "USD", 100), "Cobro registrado: deuda −100 USD y efectivo +100 USD."), instance));
      add("finanzas", "#cash-kpi", "Movimiento vinculado", "Observa el efectivo actualizado. Puedes explorar gastos reversibles, cambio de moneda y los saldos de cada persona por tu cuenta.");
    }
    const first = t[0]?.demoSection ?? "inicio";
    navigate(first);
    window.setTimeout(() => {
      const instance = driver({
        showProgress: true, allowClose: true, overlayClickBehavior: "none",
        nextBtnText: "Siguiente", prevBtnText: "Anterior", doneBtnText: "Terminar",
        popoverClass: "demo-driver-popover", steps: t,
        onPrevClick: (_element, _step, options) => {
          const previous = t[Math.max(0, (options.index ?? 0) - 1)];
          if (!previous) return;
          if (previous.element === "#wire-preview-panel" || previous.element === "#wire-confirm-btn") openModal("wire", "chase");
          else setModal(null);
          navigate(previous.demoSection);
          window.setTimeout(() => options.driver.movePrevious(), 120);
        },
        onDestroyed: () => setModal(null),
      });
      driverRef.current = instance;
      instance.drive();
    }, 160);
  }, [commit]);

  const value = data;
  const summary = useMemo(() => value ? zelleSummary(value) : null, [value]);
  const pending = useMemo(() => value ? pendingAssignments(value) : null, [value]);
  const capital = useMemo(() => value ? capitalTotal(value) : null, [value]);
  const wirePreview = useMemo(() => value && modal === "wire" ? previewDemoWire(value, {
    accountId: wire.accountId, principalUsd: Number(wire.principalUsd), feeUsd: Number(wire.feeUsd), settlementCurrency: wire.settlementCurrency, rateOrPercent: Number(wire.rateOrPercent),
  }) : null, [value, modal, wire]);
  if (!value || !summary || !pending) return <div className="loading"><Activity size={28} /> Preparando escenario ficticio…</div>;

  const activeTx = value.transactions.filter((tx) => Boolean(tx.deletedAt) === showTrash && (!search || tx.sender.toLowerCase().includes(search.toLowerCase())) && (!codeFilter || tx.confirmationCode.toLowerCase().includes(codeFilter.toLowerCase()))).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const recentTx = value.transactions.filter((tx) => !tx.deletedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 4);
  const totalRemeseroDebt = value.remeseros.reduce((sum, person) => sum + remeseroDebt(value, person.id), 0);
  const totalOwnerDebt = value.accounts.reduce((sum, account) => sum + ownerDebt(value, account.id), 0);
  const volumeDays = Array.from({ length: 12 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() - (11 - index));
    return { label: day.toLocaleDateString("es-ES", { day: "numeric", month: "short" }), key: day.toDateString() };
  });
  const volumeBars = volumeDays.map((day) => value.transactions.filter((tx) => !tx.deletedAt && new Date(tx.occurredAt).toDateString() === day.key).reduce((sum, tx) => sum + tx.amountUsd, 0));
  const largestVolume = Math.max(1, ...volumeBars);
  const bankTotals = value.accounts.map((account) => ({ name: account.bank, total: value.transactions.filter((tx) => !tx.deletedAt && tx.accountId === account.id).reduce((sum, tx) => sum + tx.amountUsd, 0) }));
  const largestBank = Math.max(1, ...bankTotals.map((item) => item.total));
  const currentAccount = value.accounts.find((account) => account.id === selectedAccount) ?? value.accounts[0];
  const currentRemesero = value.remeseros.find((person) => person.id === selectedId) ?? value.remeseros[0];
  const currentCounterparty = value.counterparties.find((person) => person.id === selectedPerson) ?? value.counterparties[0];

  const stat = (label: string, amount: string, meta: string, Icon: typeof Activity, accent = "blue", id?: string) => <div className={`stat-card accent-${accent}`} id={id}><div className="stat-top"><span>{label}</span><Icon size={18} /></div><strong>{amount}</strong><small>{meta}</small></div>;
  const empty = (message: string) => <p className="empty-state">{message}</p>;
  const modalTitle: Record<Exclude<Modal, null>, string> = { incoming: "Nueva transacción", assign: "Asignar transacción", wire: "Registrar wire", accountExpense: "Gasto de cuenta Zelle", price: "Cambiar precio", remeseroPayment: "Pago a remesero", cash: "Balances y tasa", expense: "Nuevo gasto", exchange: "Cambio de moneda", collect: "Cobrar deuda", explain: explanation.title };

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><Activity size={23} /></div><div><strong>Transactions</strong><span>DEMO</span></div></div>
      <div className="sidebar-label">ESPACIO DE TRABAJO</div>
      <nav aria-label="Secciones principales">{sections.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${section === id ? "selected" : ""}`} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span>{section === id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-demo"><Sparkles size={17} /><span>Entorno de demostración<br /><small>Sin datos reales</small></span></div><button className="sidebar-help" onClick={() => setShowChapters(true)}><BookOpen size={17} /> Ver recorridos</button></div>
    </aside>

    <div className="main-wrap">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}><Menu size={21} /></button><div className="breadcrumb">Panel <span>/</span> <strong>{sections.find((item) => item.id === section)?.label}</strong></div><div className="top-actions"><span className="demo-pill"><span /> DEMO · DATOS FICTICIOS</span><button className="top-button" onClick={() => setShowChapters(true)}><Play size={15} /> <span>Recorrido</span></button><button className="top-button subtle" onClick={reset}><RotateCcw size={15} /> <span>Reiniciar demo</span></button></div></header>
      <main className="content">
        {section === "inicio" && <>
          <div className="hero" id="demo-hero"><div><div className="eyebrow"><Sparkles size={14} /> VISTA INTERACTIVA</div><h1>Todo tu movimiento,<br /><em>en un solo lugar.</em></h1><p>Explora cómo una entrada Zelle se asigna, se valora y se convierte en una operación financiera. Esta es una simulación: no hay bancos ni clientes conectados.</p><div className="hero-actions"><button className="primary-button" onClick={() => startTour("completo")}><Play size={16} /> Iniciar recorrido <ArrowRight size={16} /></button><button className="ghost-button" onClick={() => setShowChapters(true)}><BookOpen size={17} /> Elegir capítulo</button></div></div><div className="hero-visual"><div className="hero-line"><span>Entrada Zelle</span><span>→</span><span>Asignación</span><span>→</span><span>Wire</span></div><div className="hero-amount">{money(summary.balanceUsd)}</div><div className="hero-sub">Saldo disponible entre {value.accounts.length} cuentas</div><div className="hero-bars" aria-label="Volumen de entradas de los últimos doce días">{volumeBars.map((amount, index) => <i key={volumeDays[index].key} style={{ height: `${Math.max(12, amount / largestVolume * 100)}%` }} title={`${volumeDays[index].label}: ${money(amount)}`} />)}</div></div></div>
          <div className="section-heading"><div><h2>Resumen del negocio</h2><p>Los números cambian cuando interactúas con la demo.</p></div><span className="live-label"><span /> Actualizado en tu navegador</span></div>
          <div className="stats-grid">{stat("Zelle disponible", money(summary.balanceUsd), `${value.accounts.length} cuentas conectadas · simuladas`, Landmark)}{stat("Capital neto", capital === null ? "Pendiente" : money(capital), "Después de reservas y deudas", TrendingUp, "green")}{stat("Pendiente de asignar", money(pending.amountUsd), `${pending.count} transacciones sin remesero`, ArrowDownLeft, "amber")}{stat("Deuda con remeseros", money(totalRemeseroDebt, "CUP"), "Obligación en CUP", Users, "purple")}</div>
          <div className="two-column"><div className="panel"><div className="panel-head"><div><h3>Actividad reciente</h3><p>Entradas que alimentan el inventario Zelle</p></div><button className="text-link" onClick={() => navigate("transacciones")}>Ver todas <ArrowRight size={14} /></button></div><div className="compact-list">{recentTx.map((tx) => <div className="compact-row" key={tx.id}><div className="avatar">{tx.sender.charAt(0)}</div><div className="row-main"><strong>{tx.sender}</strong><small>{value.accounts.find((account) => account.id === tx.accountId)?.bank} · {date(tx.occurredAt)}</small></div><b>{money(tx.amountUsd)}</b></div>)}</div></div><div className="panel"><div className="panel-head"><div><h3>Cómo funciona</h3><p>Un flujo claro de principio a fin</p></div></div><div className="workflow-list">{[{ n: "01", title: "Recibe", desc: "Cada pago entra como transacción." }, { n: "02", title: "Asigna", desc: "Se aplica el precio del remesero." }, { n: "03", title: "Valora", desc: "FIFO determina el costo del Zelle." }, { n: "04", title: "Controla", desc: "Capital y deudas se actualizan." }].map((item) => <div key={item.n}><span>{item.n}</span><div><strong>{item.title}</strong><small>{item.desc}</small></div></div>)}</div></div></div>
          <div className="panel bank-chart"><div className="panel-head"><div><h3>Entradas por banco</h3><p>Distribución dinámica de las transacciones activas</p></div><BarChart3 size={20} /></div><div className="bank-chart-body">{bankTotals.map((item) => <div className="bank-chart-row" key={item.name}><span>{item.name}</span><div className="progress-track"><div style={{ width: `${item.total / largestBank * 100}%` }} /></div><strong>{money(item.total)}</strong></div>)}</div></div>
        </>}

        {section === "transacciones" && <>
          <div className="page-title"><div><div className="eyebrow">MOVIMIENTO ZELLE</div><h1>Transacciones</h1><p>Entradas, asignaciones y trazabilidad del dinero.</p></div><button className="primary-button" id="new-transaction-btn" onClick={() => openModal("incoming")}><Plus size={17} /> Nueva transacción</button></div>
          <div className="stats-grid three">{stat("Total activo", money(value.transactions.filter((tx) => !tx.deletedAt).reduce((sum, tx) => sum + tx.amountUsd, 0)), `${value.transactions.filter((tx) => !tx.deletedAt).length} entradas`, DollarSign)}{stat("Asignado", money(value.transactions.filter((tx) => !tx.deletedAt && tx.remeseroId).reduce((sum, tx) => sum + tx.amountUsd, 0)), "Con precio aplicado", Check, "green")}{stat("Pendiente", money(pending.amountUsd), `${pending.count} por asignar`, CircleHelp, "amber")}</div>
          <div className="panel transaction-panel"><div className="panel-head"><div><h3>Historial de entradas</h3><p>Busca por remitente o código de confirmación.</p></div><div className="segmented"><button className={!showTrash ? "active" : ""} onClick={() => setShowTrash(false)}>Activas</button><button className={showTrash ? "active" : ""} onClick={() => setShowTrash(true)}>Papelera</button></div></div><div className="filter-row" id="transaction-toolbar"><label className="search-field"><Search size={17} /><input aria-label="Buscar remitente" placeholder="Buscar remitente…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="search-field"><CreditCard size={17} /><input aria-label="Código" placeholder="Código de confirmación" value={codeFilter} onChange={(event) => setCodeFilter(event.target.value)} /></label></div><div className="transaction-list">{activeTx.length ? activeTx.map((tx) => { const remesero = value.remeseros.find((person) => person.id === tx.remeseroId); const account = value.accounts.find((entry) => entry.id === tx.accountId); const isDemo = tx.id === tourTransactionRef.current; return <div className="transaction-row" id={isDemo ? "demo-new-tx" : undefined} key={tx.id}><div className="tx-icon"><ArrowDownLeft size={20} /></div><div className="tx-main"><strong>{tx.sender}</strong><small>{account?.bank} · {account?.name} · {date(tx.occurredAt)}</small><span className="tx-code">{tx.confirmationCode}</span></div><div className="tx-side"><strong>{money(tx.amountUsd)}</strong><span className={`status ${remesero ? "assigned" : "pending"}`}>{remesero ? `Asignada · ${remesero.name}` : "Sin asignar"}</span><div className="row-actions">{showTrash ? <button onClick={() => commit((current) => restoreTransaction(current, tx.id), "Transacción restaurada.")}>Restaurar</button> : remesero ? <button onClick={() => commit((current) => unassignTransaction(current, tx.id), "Transacción desasignada.")}>Desasignar</button> : <><button id={isDemo ? "assign-demo-btn" : undefined} onClick={() => { setAssignTo("r1"); openModal("assign", tx.id); }}>Asignar</button><button className="muted-action" disabled={!canDeleteTransaction(value, tx.id)} title={!canDeleteTransaction(value, tx.id) ? "El lote ya fue consumido" : "Enviar a papelera"} onClick={() => commit((current) => deleteTransaction(current, tx.id), "Transacción enviada a papelera.")}><Trash2 size={14} /> Eliminar</button></>}</div></div></div>; }) : empty("No hay transacciones que coincidan con estos filtros.")}</div></div>
        </>}

        {section === "cuentas" && <>
          <div className="page-title"><div><div className="eyebrow">SALDOS ZELLE</div><h1>Cuentas</h1><p>Disponibilidad, valoración y salidas por cuenta.</p></div><button className="ghost-button" onClick={() => explain("Cuentas bancarias", "En el sistema completo, las cuentas se crean automáticamente al recibir correos bancarios o desde administración. Aquí solo usamos cuentas ficticias.")}><CircleHelp size={17} /> Cómo se crean</button></div>
          <div className="stats-grid three">{stat("Zelle total", money(summary.balanceUsd), "Saldos actuales", Landmark)}{stat("Zelle valorado", money(summary.pricedUsd), `${number(summary.coveragePercent, 2)} % de cobertura`, Coins, "green")}{stat("Sin precio", money(summary.unpricedUsd), "Lotes sin remesero", CircleHelp, "amber")}</div>
          <div className="accounts-grid">{summary.accounts.map((account) => <div className="panel account-card" id={account.id === "chase" ? "account-card-chase" : undefined} key={account.id}><div className="account-top"><div className="bank-icon"><Building2 size={23} /></div><div className="row-main"><strong>{account.name}</strong><small>{account.bank} · Dueña/o: {account.owner}</small></div><span className="status assigned">Activa</span></div><div className="account-amount" id={account.id === "chase" ? "account-balance-chase" : undefined}><small>SALDO DISPONIBLE</small><strong>{money(account.balanceUsd)}</strong></div><div className="account-metrics"><div><span>Valorado</span><strong>{money(account.pricedUsd)}</strong></div><div><span>Sin precio</span><strong>{money(account.unpricedUsd)}</strong></div><div><span>Precio medio</span><strong>{account.averagePrice === null ? "—" : number(account.averagePrice, 2)}</strong></div></div><div className="progress-track"><div style={{ width: `${account.coveragePercent}%` }} /></div><div className="account-actions"><button className="primary-button small" id={account.id === "chase" ? "wire-action-btn" : undefined} onClick={() => openModal("wire", account.id)}><ArrowUpRight size={15} /> Wire</button><button className="outline-button small" onClick={() => { setSelectedAccount(account.id); openModal("accountExpense", account.id); }}><Banknote size={15} /> Gasto Zelle</button><button className="icon-button" title="Deuda con dueño" aria-label={`Ver deuda con ${account.owner}`} onClick={() => setExpandedOwner(expandedOwner === account.id ? null : account.id)}><ChevronDown size={17} /></button></div>{expandedOwner === account.id && <div className="owner-detail"><strong>Deuda con {account.owner}: {money(ownerDebt(value, account.id))}</strong><p>Comisión {number(account.ownerFeePercent, 2)} % · Salario configurado {money(account.monthlySalaryUsd)}/mes. El registro de salarios y pagos al dueño está ilustrado; no se genera automáticamente en esta demo.</p><button className="text-link" onClick={() => explain("Deuda con dueños", "La aplicación completa conserva un subledger auditable de comisiones, salarios, ajustes y pagos realizados desde Zelle. Aquí ves un ejemplo calculado con las comisiones de los wires simulados.")}>Conocer funcionamiento <ArrowRight size={14} /></button></div>}</div>)}</div>
          <div className="panel"><div className="panel-head"><div><h3>Salidas de cuentas</h3><p>Los wires conservan una fotografía del costo y la ganancia.</p></div></div><div className="history-list">{value.outflows.map((item) => { const account = value.accounts.find((entry) => entry.id === item.accountId); return <div className={`history-row ${item.reversedAt ? "reversed" : ""}`} key={item.id}><div className={`history-icon ${item.kind === "wire" ? "purple" : "amber"}`}>{item.kind === "wire" ? <ArrowUpRight size={18} /> : <Banknote size={18} />}</div><div className="row-main"><strong>{item.kind === "wire" ? "Wire" : "Gasto Zelle"} · {account?.name}</strong><small>{date(item.occurredAt)} · {item.reversedAt ? "Revertido" : `Débito ${money(item.totalUsd)}`}</small>{item.kind === "wire" && <small>Principal {money(item.principalUsd)} + fee {money(item.feeUsd)} · Ganancia neta {item.snapshot?.netProfitUsd == null ? "no disponible" : money(item.snapshot.netProfitUsd)} ({item.snapshot?.status === "EXACT" ? "exacta" : item.snapshot?.status === "ESTIMATED" ? "estimada" : "sin cálculo histórico"})</small>}</div><div className="history-end"><strong>{money(item.totalUsd)}</strong>{!item.reversedAt && <button className="text-link" onClick={() => commit((current) => reverseOutflow(current, item.id), "Salida revertida; Zelle y deuda actualizados.")}>Revertir</button>}</div></div>; })}</div></div>
        </>}

        {section === "remeseros" && <>
          <div className="page-title"><div><div className="eyebrow">EQUIPO Y OBLIGACIONES</div><h1>Remeseros</h1><p>Precio aplicado, operaciones y deuda en CUP.</p></div><button className="ghost-button" onClick={() => explain("Nuevo remesero", "En el sistema completo puedes crear remeseros, editar su saldo inicial y generar cuadres auditables. Esta demo contiene tres perfiles ficticios.")}><Plus size={17} /> Nuevo remesero</button></div>
          <div className="stats-grid three">{stat("Deuda total", money(totalRemeseroDebt, "CUP"), "Obligación con remeseros", Users, "purple")}{stat("Operaciones asignadas", number(value.transactions.filter((tx) => tx.remeseroId && !tx.deletedAt).length), "Entradas con precio aplicado", Check, "green")}{stat("Sin asignar", money(pending.amountUsd), `${pending.count} entradas pendientes`, CircleHelp, "amber")}</div>
          {detailRemesero ? (() => { const person = value.remeseros.find((entry) => entry.id === detailRemesero); if (!person) return null; const entries = value.transactions.filter((tx) => tx.remeseroId === person.id && !tx.deletedAt); return <div className="panel detail-panel"><button className="text-link" onClick={() => setDetailRemesero(null)}>← Volver a remeseros</button><div className="detail-hero"><div className="large-avatar">{person.name.charAt(0)}</div><div><h2>{person.name}</h2><p>Precio actual {number(person.price)} CUP/USD · Deuda {money(remeseroDebt(value, person.id), "CUP")}</p></div></div><div className="panel-head"><h3>Operaciones asignadas</h3></div><div className="history-list">{entries.map((tx) => <div className="history-row" key={tx.id}><div className="history-icon blue"><ArrowDownLeft size={18} /></div><div className="row-main"><strong>{tx.sender}</strong><small>{date(tx.occurredAt)} · Precio aplicado {number(tx.priceApplied ?? 0)} CUP/USD</small></div><strong>{money(tx.amountUsd)}</strong></div>)}</div><div className="note-box">Los cuadres y cortes manuales se calculan sobre el historial real en la aplicación completa; esta vista de demo muestra la relación actual entre entradas, precio y pagos.</div></div>; })() : <div className="remeseros-grid">{value.remeseros.map((person) => { const transactions = value.transactions.filter((tx) => tx.remeseroId === person.id && !tx.deletedAt); return <div className="panel remesero-card" id={person.id === "r1" ? "remesero-card-r1" : undefined} key={person.id} onClick={() => setDetailRemesero(person.id)} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") setDetailRemesero(person.id); }}><div className="remesero-top"><div className="large-avatar">{person.name.charAt(0)}</div><div><strong>{person.name}</strong><small>{transactions.length} operaciones activas</small></div><ArrowRight size={17} /></div><div className="remesero-debt"><span>DEUDA ACTUAL</span><strong>{money(remeseroDebt(value, person.id), "CUP")}</strong></div><div className="remesero-price"><span>Precio actual</span><strong>{number(person.price)} CUP/USD</strong></div><div className="remesero-actions" id={person.id === "r1" ? "remesero-actions-r1" : undefined}><button onClick={(event) => { event.stopPropagation(); openModal("price", person.id); }}><Coins size={15} /> Precio</button><button onClick={(event) => { event.stopPropagation(); openModal("remeseroPayment", person.id); }}><Banknote size={15} /> Pagar</button><button onClick={(event) => { event.stopPropagation(); explain("Cuadre de remesero", "El sistema completo permite compartir un cuadre desde el último pago o ajuste manual, mostrando asignaciones netas y saldo inicial. Esta demo ilustra el balance actual."); }}><BarChart3 size={15} /> Cuadre</button><button onClick={(event) => { event.stopPropagation(); setDetailRemesero(person.id); }}><Eye size={15} /> Historial</button></div></div>; })}</div>}
        </>}

        {section === "finanzas" && <>
          <div className="page-title"><div><div className="eyebrow">POSICIÓN FINANCIERA</div><h1>Finanzas</h1><p>Capital, liquidez, deudas y costo del Zelle.</p></div><div className="page-actions"><button className="outline-button" onClick={() => openModal("expense")}><Plus size={16} /> Gasto</button><button className="outline-button" onClick={() => openModal("exchange")}><ArrowLeftRight size={16} /> Cambiar moneda</button><button className="primary-button" onClick={() => openModal("cash")}><Wallet size={16} /> Editar balances</button></div></div>
          <div className="capital-card" id="capital-kpi"><div><span>CAPITAL NETO ESTIMADO</span><strong>{capital === null ? "Pendiente de tasa" : money(capital)}</strong><p>Incluye Zelle y efectivo; resta la reserva sin asignar y las obligaciones. La tasa global actual es {number(value.usdCupRate)} CUP por 1 USD.</p></div><div className="capital-symbol"><TrendingUp size={35} /></div></div>
          <div className="stats-grid four">{stat("Efectivo USD", money(value.cashUsd), "Fuera de Zelle", Wallet, "blue", "cash-kpi")}{stat("Efectivo CUP", money(value.cashCup, "CUP"), "Convertido con tasa global", Banknote, "green")}{stat("Pendiente de asignar", `−${money(pending.amountUsd)}`, `${pending.count} entradas reservadas`, CircleHelp, "amber")}{stat("Dueños de cuentas", `−${money(totalOwnerDebt)}`, "Comisiones y saldo inicial", Users, "purple")}</div>
          <div className="two-column"><div className="panel" id="zelle-valuation"><div className="panel-head"><div><h3>Valoración del Zelle</h3><p>Inventario FIFO por cuenta</p></div><div className="circle-icon"><Coins size={19} /></div></div><div className="valuation-total"><span>PRECIO PROMEDIO</span><strong>{summary.averagePrice === null ? "Sin precio" : `${number(summary.averagePrice, 2)} CUP/USD`}</strong><small>Costo valorado: {money(summary.costCup, "CUP")}</small></div><div className="coverage"><span>Cobertura del inventario <b>{number(summary.coveragePercent, 2)} %</b></span><div className="progress-track"><div style={{ width: `${summary.coveragePercent}%` }} /></div></div><div className="mini-grid"><div><span>Valorado</span><strong>{money(summary.pricedUsd)}</strong></div><div><span>Sin precio</span><strong>{money(summary.unpricedUsd)}</strong></div></div></div><div className="panel"><div className="panel-head"><div><h3>Obligaciones y patrimonio</h3><p>Componentes del Capital neto</p></div><div className="circle-icon purple"><BarChart3 size={19} /></div></div><div className="breakdown-row"><span>Zelle disponible</span><strong>{money(summary.balanceUsd)}</strong></div><div className="breakdown-row negative"><span>Reserva sin asignar</span><strong>−{money(pending.amountUsd)}</strong></div><div className="breakdown-row negative"><span>Deuda remeseros</span><strong>−{money(totalRemeseroDebt, "CUP")}</strong></div><div className="breakdown-row negative"><span>Deuda dueños</span><strong>−{money(totalOwnerDebt)}</strong></div><div className="breakdown-row"><span>Tasa global</span><strong>{number(value.usdCupRate)} CUP/USD</strong></div><div className="note-box">La reserva de entradas sin asignar y la valoración “Sin precio” son métricas distintas; el capital descuenta la primera, no ambas.</div></div></div>
          <div className="section-heading"><div><h2>Deudas externas</h2><p>Cuentas por cobrar y pagar en USD y CUP.</p></div></div><div className="counterparty-grid">{value.counterparties.map((person) => <div className="panel counterparty-card" id={person.id === "cp1" ? "external-debt-card-cp1" : undefined} key={person.id}><div className="counterparty-title"><div className="avatar">{person.name.charAt(0)}</div><div><strong>{person.name}</strong><small>Saldo firmado por moneda</small></div></div><div className="mini-grid"><div><span>USD</span><strong className={counterpartyBalance(value, person.id, "USD") < 0 ? "negative-text" : ""}>{money(counterpartyBalance(value, person.id, "USD"))}</strong></div><div><span>CUP</span><strong className={counterpartyBalance(value, person.id, "CUP") < 0 ? "negative-text" : ""}>{money(counterpartyBalance(value, person.id, "CUP"), "CUP")}</strong></div></div><div className="counterparty-actions"><button className="outline-button small" onClick={() => { setSimpleCurrency("USD"); openModal("collect", person.id); }}><ArrowDownLeft size={15} /> Registrar cobro</button><button className="text-link" onClick={() => explain("Deudas externas", "Un saldo positivo significa que la persona debe al negocio; uno negativo significa que el negocio le debe. El sistema completo admite movimientos, setters, pagos y reversiones auditables.")}>Cómo funciona <ArrowRight size={13} /></button></div></div>)}</div>
          <div className="two-column"><div className="panel"><div className="panel-head"><div><h3>Gastos de efectivo</h3><p>Restan del balance en la moneda elegida</p></div><button className="text-link" onClick={() => openModal("expense")}>Agregar <Plus size={14} /></button></div><div className="history-list">{value.expenses.slice(0, 3).map((item) => <div className={`history-row ${item.reversedAt ? "reversed" : ""}`} key={item.id}><div className="history-icon amber"><Banknote size={17} /></div><div className="row-main"><strong>{item.note}</strong><small>{date(item.occurredAt)}{item.reversedAt ? " · Revertido" : ""}</small></div><div className="history-end"><strong>−{money(item.amount, item.currency)}</strong>{!item.reversedAt && <button className="text-link" onClick={() => commit((current) => reverseExpense(current, item.id), "Gasto revertido.")}>Revertir</button>}</div></div>)}</div></div><div className="panel"><div className="panel-head"><div><h3>Cambios de moneda</h3><p>Movimientos de efectivo entre USD y CUP</p></div><button className="text-link" onClick={() => openModal("exchange")}>Agregar <Plus size={14} /></button></div><div className="history-list">{value.exchanges.slice(0, 3).map((item) => <div className={`history-row ${item.reversedAt ? "reversed" : ""}`} key={item.id}><div className="history-icon blue"><ArrowLeftRight size={17} /></div><div className="row-main"><strong>{item.from} → {item.from === "USD" ? "CUP" : "USD"}</strong><small>{date(item.occurredAt)} · Tasa {number(item.rate)}{item.reversedAt ? " · Revertido" : ""}</small></div><div className="history-end"><strong>{money(item.amount, item.from)}</strong>{!item.reversedAt && <button className="text-link" onClick={() => commit((current) => reverseExchange(current, item.id), "Cambio revertido.")}>Revertir</button>}</div></div>)}</div></div></div>
        </>}
      </main>
      <footer className="footer">Transactions Demo · Todos los datos son ficticios y se guardan solo en este navegador. No se conecta a bancos ni realiza pagos.</footer>
    </div>
    <nav className="bottom-nav" aria-label="Navegación móvil">{sections.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "selected" : ""} onClick={() => navigate(id)}><Icon size={21} /><span>{label}</span></button>)}</nav>
    {toast && <div role="status" className="toast"><Check size={17} /> {toast}<button aria-label="Cerrar aviso" onClick={() => setToast("")}><X size={15} /></button></div>}

    {showWelcome && <div className="overlay"><div className="welcome-card"><div className="welcome-icon"><Sparkles size={29} /></div><div className="eyebrow">UNA VISITA GUIADA</div><h2>Conoce Transactions Demo</h2><p>En pocos minutos podrás simular una entrada Zelle, asignarla, hacer un wire y cobrar una deuda. Todo ocurre con datos ficticios en tu navegador.</p><div className="welcome-actions"><button className="primary-button" onClick={() => startTour("completo")}><Play size={16} /> Empezar recorrido</button><button className="ghost-button" onClick={() => { setShowWelcome(false); window.localStorage.setItem("transactions-demo-tour-seen", "yes"); }}>Explorar por mi cuenta</button></div></div></div>}
    {showChapters && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowChapters(false); }}><div className="dialog chapter-dialog" role="dialog" aria-modal="true" aria-label="Elegir recorrido"><button className="dialog-close" aria-label="Cerrar" onClick={() => setShowChapters(false)}><X size={19} /></button><div className="eyebrow">RECORRIDOS INTERACTIVOS</div><h2>Explora a tu ritmo</h2><p className="dialog-intro">Elige el recorrido completo o un capítulo. Cada recorrido empieza con el escenario ficticio inicial y sus acciones modifican únicamente tu navegador.</p><div className="chapter-list">{[{ id: "completo", title: "Recorrido completo", text: "Del pago entrante al capital neto", icon: Sparkles }, { id: "transacciones", title: "Transacciones", text: "Entrada, búsqueda y asignación", icon: ArrowDownLeft }, { id: "cuentas", title: "Cuentas", text: "FIFO, wire, fee y ganancia", icon: Landmark }, { id: "remeseros", title: "Remeseros", text: "Precio, deuda y operaciones", icon: Users }, { id: "finanzas", title: "Finanzas", text: "Capital, valoración y cobros", icon: Wallet }].map(({ id, title, text, icon: Icon }) => <button key={id} onClick={() => startTour(id as Chapter)}><Icon size={19} /><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={17} /></button>)}</div></div></div>}
    {modal && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><div className="dialog" role="dialog" aria-modal="true" aria-label={modalTitle[modal]}><button className="dialog-close" aria-label="Cerrar" onClick={() => setModal(null)}><X size={19} /></button><div className="eyebrow">OPERACIÓN SIMULADA</div><h2>{modalTitle[modal]}</h2>
      {modal === "incoming" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => addIncoming(current, { ...incoming, amountUsd: Number(incoming.amountUsd) }), "Entrada ficticia agregada.")) { setModal(null); setIncoming({ accountId: "chase", sender: "", amountUsd: "" }); } }}><label>Cuenta<select value={incoming.accountId} onChange={(event) => setIncoming({ ...incoming, accountId: event.target.value })}>{value.accounts.map((account) => <option key={account.id} value={account.id}>{account.bank} · {account.name}</option>)}</select></label><label>Remitente ficticio<input required placeholder="Nombre del remitente" value={incoming.sender} onChange={(event) => setIncoming({ ...incoming, sender: event.target.value })} /></label><label>Importe USD<input required type="number" min="0.01" step="0.01" value={incoming.amountUsd} onChange={(event) => setIncoming({ ...incoming, amountUsd: event.target.value })} /></label><div className="note-box">La entrada aumenta Zelle y permanece pendiente de asignar.</div><button className="primary-button full" type="submit">Crear entrada ficticia</button></form>}
      {modal === "assign" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => assignTransaction(current, selectedId, assignTo), "Transacción asignada.")) setModal(null); }}><p className="dialog-intro">Selecciona un remesero; se guardará su precio actual en esta operación.</p><label>Remesero<select value={assignTo} onChange={(event) => setAssignTo(event.target.value)}>{value.remeseros.map((person) => <option key={person.id} value={person.id}>{person.name} · {number(person.price)} CUP/USD</option>)}</select></label><div className="note-box">Deuda estimada: {money((value.transactions.find((tx) => tx.id === selectedId)?.amountUsd ?? 0) * (value.remeseros.find((person) => person.id === assignTo)?.price ?? 0), "CUP")}</div><button className="primary-button full" type="submit">Confirmar asignación</button></form>}
      {modal === "wire" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => createWire(current, { accountId: wire.accountId, counterpartyId: wire.counterpartyId, principalUsd: Number(wire.principalUsd), feeUsd: Number(wire.feeUsd), settlementCurrency: wire.settlementCurrency, rateOrPercent: Number(wire.rateOrPercent) }), "Wire ficticio registrado.")) setModal(null); }}><div className="form-grid"><label>Cuenta<select value={wire.accountId} onChange={(event) => setWire({ ...wire, accountId: event.target.value })}>{value.accounts.map((account) => <option key={account.id} value={account.id}>{account.bank} · {account.name}</option>)}</select></label><label>Contraparte<select value={wire.counterpartyId} onChange={(event) => setWire({ ...wire, counterpartyId: event.target.value })}>{value.counterparties.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Principal USD<input type="number" min="0.01" step="0.01" value={wire.principalUsd} onChange={(event) => setWire({ ...wire, principalUsd: event.target.value })} /></label><label>Fee del wire USD<input type="number" min="0" step="0.01" value={wire.feeUsd} onChange={(event) => setWire({ ...wire, feeUsd: event.target.value })} /></label><label>Liquidación<select value={wire.settlementCurrency} onChange={(event) => setWire({ ...wire, settlementCurrency: event.target.value as Currency, rateOrPercent: event.target.value === "CUP" ? "735" : "5" })}><option value="CUP">CUP</option><option value="USD">USD</option></select></label><label>{wire.settlementCurrency === "CUP" ? "Tasa CUP/USD" : "Recargo al cliente (%)"}<input type="number" min="0.01" step="0.01" value={wire.rateOrPercent} onChange={(event) => setWire({ ...wire, rateOrPercent: event.target.value })} /></label></div><div className="wire-preview" id="wire-preview-panel"><div className="preview-heading"><strong>Vista previa del wire</strong><span className={`status ${wirePreview?.snapshot?.status === "EXACT" ? "assigned" : "pending"}`}>{wirePreview?.snapshot?.status === "EXACT" ? "Exacta" : wirePreview?.snapshot?.status === "ESTIMATED" ? "Estimada" : "No disponible"}</span></div><div className="breakdown-row"><span>Principal + fee = débito Zelle</span><strong>{money(wirePreview?.totalUsd ?? 0)}</strong></div><div className="breakdown-row"><span>Cobro a {value.counterparties.find((person) => person.id === wire.counterpartyId)?.name}</span><strong>{money(wirePreview?.snapshot?.settlementAmount ?? 0, wire.settlementCurrency)}</strong></div><div className="breakdown-row"><span>Costo FIFO · {number(wirePreview?.selected.pricedUsd ?? 0, 2)} USD valorados</span><strong>{wirePreview?.snapshot?.fifoCostCup == null ? "Sin precio" : money(wirePreview.snapshot.fifoCostCup, "CUP")}</strong></div><div className="breakdown-row"><span>Comisión dueño · {number(wirePreview?.snapshot?.ownerFeePercent ?? 0, 2)} %</span><strong>{money(wirePreview?.snapshot?.ownerFeeCup ?? 0, "CUP")}</strong></div><div className="breakdown-row profit"><span>Ganancia neta</span><strong>{wirePreview?.snapshot?.netProfitCup == null ? "No disponible" : `${money(wirePreview.snapshot.netProfitCup, "CUP")} / ${money(wirePreview.snapshot.netProfitUsd ?? 0)}`}</strong></div><small>Saldo restante estimado: {money(wirePreview?.remaining.balanceUsd ?? 0)} · tasa global {number(value.usdCupRate)}</small>{wirePreview?.error && <div className="field-error">{wirePreview.error}</div>}</div><button className="primary-button full" id="wire-confirm-btn" type="submit" disabled={!wirePreview?.canCreate}>Confirmar wire ficticio</button></form>}
      {modal === "accountExpense" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => addAccountExpense(current, selectedAccount, Number(simpleAmount)), "Gasto Zelle registrado.")) setModal(null); }}><p className="dialog-intro">Reduce el saldo de {currentAccount.name} y consume inventario FIFO. No modifica efectivo.</p><label>Importe USD<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><button className="primary-button full" type="submit">Registrar gasto Zelle</button></form>}
      {modal === "price" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => setRemeseroPrice(current, selectedId, Number(simpleAmount)), "Nuevo precio guardado para futuras asignaciones.")) setModal(null); }}><p className="dialog-intro">El precio nuevo no cambia el valor aplicado a operaciones anteriores.</p><label>Precio de {currentRemesero.name} · CUP por USD<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><button className="primary-button full" type="submit">Guardar precio</button></form>}
      {modal === "remeseroPayment" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => payRemesero(current, selectedId, Number(simpleAmount)), "Pago registrado: deuda y efectivo CUP reducidos.")) setModal(null); }}><p className="dialog-intro">Se reducirá la deuda de {currentRemesero.name} y el efectivo CUP por el mismo importe.</p><label>Pago en CUP<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><div className="note-box">Efectivo CUP después: {money(value.cashCup - Number(simpleAmount || 0), "CUP")}</div><button className="primary-button full" type="submit">Registrar pago</button></form>}
      {modal === "cash" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => setFinanceState(current, { cashUsd: Number(financeFields.cashUsd), cashCup: Number(financeFields.cashCup), usdCupRate: Number(financeFields.usdCupRate) }), "Balances de demo actualizados.")) setModal(null); }}><p className="dialog-intro">Edita los balances fuera de Zelle y la tasa global de esta simulación.</p><label>Efectivo USD<input type="number" step="0.01" value={financeFields.cashUsd} onChange={(event) => setFinanceFields({ ...financeFields, cashUsd: event.target.value })} /></label><label>Efectivo CUP<input type="number" step="0.01" value={financeFields.cashCup} onChange={(event) => setFinanceFields({ ...financeFields, cashCup: event.target.value })} /></label><label>Tasa CUP por 1 USD<input type="number" min="0.01" step="0.01" value={financeFields.usdCupRate} onChange={(event) => setFinanceFields({ ...financeFields, usdCupRate: event.target.value })} /></label><button className="primary-button full" type="submit">Actualizar balances</button></form>}
      {modal === "expense" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => addExpense(current, simpleCurrency, Number(simpleAmount), simpleNote), "Gasto de efectivo registrado.")) setModal(null); }}><p className="dialog-intro">Este gasto afecta el efectivo, no el inventario Zelle.</p><label>Moneda<select value={simpleCurrency} onChange={(event) => setSimpleCurrency(event.target.value as Currency)}><option value="CUP">CUP</option><option value="USD">USD</option></select></label><label>Importe<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><label>Concepto<input required value={simpleNote} onChange={(event) => setSimpleNote(event.target.value)} placeholder="Ej. Transporte" /></label><button className="primary-button full" type="submit">Registrar gasto</button></form>}
      {modal === "exchange" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => exchangeCurrency(current, simpleCurrency, Number(simpleAmount), Number(simpleRate)), "Cambio de moneda registrado.")) setModal(null); }}><label>Dirección<select value={simpleCurrency} onChange={(event) => setSimpleCurrency(event.target.value as Currency)}><option value="USD">USD → CUP</option><option value="CUP">CUP → USD</option></select></label><label>Importe de origen<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><label>Tasa de esta operación<input required type="number" min="0.01" step="0.01" value={simpleRate} onChange={(event) => setSimpleRate(event.target.value)} /></label><div className="note-box">Recibirás aproximadamente {money(simpleCurrency === "USD" ? Number(simpleAmount || 0) * Number(simpleRate || 0) : Number(simpleAmount || 0) / Number(simpleRate || 1), simpleCurrency === "USD" ? "CUP" : "USD")}.</div><button className="primary-button full" type="submit">Registrar cambio</button></form>}
      {modal === "collect" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => collectDebt(current, selectedPerson, simpleCurrency, Number(simpleAmount)), "Cobro registrado: deuda y efectivo actualizados.")) setModal(null); }}><p className="dialog-intro">Cobrar a {currentCounterparty.name} disminuye su saldo firmado y aumenta el efectivo de la misma moneda.</p><label>Moneda<select value={simpleCurrency} onChange={(event) => setSimpleCurrency(event.target.value as Currency)}><option value="USD">USD</option><option value="CUP">CUP</option></select></label><label>Importe cobrado<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><div className="note-box">Deuda después: {money(counterpartyBalance(value, selectedPerson, simpleCurrency) - Number(simpleAmount || 0), simpleCurrency)}</div><button className="primary-button full" type="submit">Registrar cobro</button></form>}
      {modal === "explain" && <><p className="dialog-intro">{explanation.body}</p><button className="primary-button full" onClick={() => setModal(null)}>Entendido</button></>}
    </div></div>}
  </div>;
}
