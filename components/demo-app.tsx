"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Banknote,
  BarChart3, BookOpen, Building2, CalendarDays, Check, ChevronDown, ChevronUp,
  CircleDollarSign, CircleHelp, Coins, Copy, DollarSign, Landmark, LayoutDashboard,
  List, Menu, MessageCircle, PencilLine, Play, Plus, ReceiptText, RefreshCcw,
  RotateCcw, Scale, Search, ShieldCheck, SlidersHorizontal, Sparkles, TrendingUp,
  Trash2, Users, Wallet, X,
} from "lucide-react";
import type { DriveStep, Driver, Popover, PopoverDOM } from "driver.js";
import { continueTourStep } from "@/lib/tour-navigation";
import {
  STORAGE_KEY, accountBalance, addAccountExpense, addExpense, addIncoming,
  assignTransaction, canDeleteTransaction, capitalTotal, collectDebt, counterpartyBalance,
  createSeedState, createWire, deleteTransaction, exchangeCurrency, inventoryForAccount,
  ownerDebt, payRemesero, pendingAssignments, previewDemoWire, readDemoState,
  remeseroDebt, restoreTransaction, reverseExchange, reverseExpense, reverseOutflow,
  setFinanceState, setRemeseroDebt, setRemeseroPrice, unassignTransaction, zelleSummary,
  type Currency, type DemoState, type Section,
} from "@/lib/demo-engine";

type Modal = "incoming" | "assign" | "wire" | "accountExpense" | "price" | "debt" | "remeseroPayment" | "cash" | "expense" | "exchange" | "collect" | "explain" | null;
type Chapter = "completo" | "transacciones" | "cuentas" | "remeseros" | "finanzas";
type TourSnapshot = {
  data: DemoState;
  section: Section;
  modal: Modal;
  selectedId: string;
  selectedAccount: string;
  selectedPerson: string;
  expandedAccount: string | null;
  expandedCounterparty: string | null;
  incoming: { accountId: string; sender: string; amountUsd: string };
  assignTo: string;
  wire: { accountId: string; counterpartyId: string; principalUsd: string; feeUsd: string; settlementCurrency: Currency; rateOrPercent: string };
  accountMovementType: "wire" | "expense";
  simpleAmount: string;
  simpleCurrency: Currency;
  tourTransactionId: string;
};
const money = (value: number, currency: Currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const number = (value: number, digits = 0) => new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
const parseAmountInput = (value: string) => Number(value.replace(/,/g, ""));
const formatAmountInput = (value: string) => {
  const cleaned = value.replace(/[^\d.]/g, "");
  const [whole, ...fraction] = cleaned.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction.length ? `${grouped}.${fraction.join("")}` : grouped;
};
const date = (value: string) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
const sections: { id: Section; label: string; icon: typeof Activity }[] = [
  { id: "inicio", label: "Dashboard", icon: LayoutDashboard },
  { id: "transacciones", label: "Transacciones", icon: List },
  { id: "cuentas", label: "Cuentas", icon: Wallet },
  { id: "remeseros", label: "Remeseros", icon: Users },
  { id: "finanzas", label: "Finanzas", icon: Landmark },
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bankFilter, setBankFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [senderFilter, setSenderFilter] = useState("");
  const [amountFilter, setAmountFilter] = useState("");
  const [remeseroFilter, setRemeseroFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [showTrash, setShowTrash] = useState(false);
  const [expandedOwner, setExpandedOwner] = useState<string | null>(null);
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [expandedCounterparty, setExpandedCounterparty] = useState<string | null>(null);
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [showAllExchanges, setShowAllExchanges] = useState(false);
  const [detailRemesero, setDetailRemesero] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [explanation, setExplanation] = useState({ title: "", body: "" });
  const driverRef = useRef<Driver | null>(null);
  const tourTransactionRef = useRef("");
  const tourStepRef = useRef<string | null>(null);
  const tourSnapshotsRef = useRef<TourSnapshot[]>([]);
  const tourMaxReachedRef = useRef(0);
  const tourStepsRef = useRef<DriveStep[]>([]);
  const tourCurrentIndexRef = useRef(0);
  const tourMoveTimerRef = useRef<number | null>(null);

  const [incoming, setIncoming] = useState({ accountId: "chase", sender: "", amountUsd: "" });
  const [assignTo, setAssignTo] = useState("r1");
  const [wire, setWire] = useState({ accountId: "chase", counterpartyId: "cp1", principalUsd: "1000", feeUsd: "25", settlementCurrency: "CUP" as Currency, rateOrPercent: "735" });
  const [accountMovementType, setAccountMovementType] = useState<"wire" | "expense">("wire");
  const [accountExpenseAmount, setAccountExpenseAmount] = useState("");
  const [simpleAmount, setSimpleAmount] = useState("");
  const [simpleNote, setSimpleNote] = useState("");
  const [simpleCurrency, setSimpleCurrency] = useState<Currency>("CUP");
  const [debtKind, setDebtKind] = useState<"deuda" | "fondo">("deuda");
  const [simpleRate, setSimpleRate] = useState("700");
  const [financeFields, setFinanceFields] = useState({ cashUsd: "", cashCup: "", usdCupRate: "" });
  const tourViewRef = useRef<TourSnapshot | null>(null);
  tourViewRef.current = data ? {
    data, section, modal, selectedId, selectedAccount, selectedPerson,
    expandedAccount, expandedCounterparty, incoming, assignTo, wire,
    accountMovementType, simpleAmount, simpleCurrency,
    tourTransactionId: tourTransactionRef.current,
  } : null;

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
    setSection("inicio"); setModal(null); setShowTrash(false); setDetailRemesero(null); setExpandedAccount(null);
    setToast("Escenario ficticio restaurado.");
  };
  const explain = (title: string, body: string) => { setExplanation({ title, body }); setModal("explain"); };
  const closeModal = () => {
    setModal(null);
    if (driverRef.current?.isActive()) driverRef.current.destroy();
  };
  const navigate = (next: Section) => { setSection(next); setDetailRemesero(null); setMenuOpen(false); };
  const clearFilters = () => {
    setSearch(""); setCodeFilter(""); setBankFilter("all"); setAccountFilter("all");
    setSenderFilter(""); setAmountFilter(""); setRemeseroFilter("all"); setDateFilter("all");
  };
  const showTourNotice = (message: string) => {
    const popover = driverRef.current?.getState("popover") as PopoverDOM | undefined;
    if (!popover) return;
    let notice = popover.description.querySelector<HTMLParagraphElement>(".demo-tour-notice");
    if (!notice) {
      notice = document.createElement("p");
      notice.className = "demo-tour-notice";
      notice.setAttribute("role", "alert");
      popover.description.appendChild(notice);
    }
    notice.textContent = message;
    driverRef.current?.refresh();
  };
  const restoreTourSnapshot = (snapshot: TourSnapshot) => {
    dataRef.current = snapshot.data;
    setData(snapshot.data);
    setSection(snapshot.section);
    setModal(snapshot.modal);
    setSelectedId(snapshot.selectedId);
    setSelectedAccount(snapshot.selectedAccount);
    setSelectedPerson(snapshot.selectedPerson);
    setExpandedAccount(snapshot.expandedAccount);
    setExpandedCounterparty(snapshot.expandedCounterparty);
    setIncoming(snapshot.incoming);
    setAssignTo(snapshot.assignTo);
    setWire(snapshot.wire);
    setAccountMovementType(snapshot.accountMovementType);
    setSimpleAmount(snapshot.simpleAmount);
    setSimpleCurrency(snapshot.simpleCurrency);
    tourTransactionRef.current = snapshot.tourTransactionId;
  };
  const moveTourTo = (index: number) => {
    const instance = driverRef.current;
    if (!instance?.isActive()) return;
    const snapshot = tourSnapshotsRef.current[index];
    if (snapshot) restoreTourSnapshot(snapshot);
    const step = tourStepsRef.current[index];
    if (step) step.disableActiveInteraction = index < tourMaxReachedRef.current || !step.data?.interactive;
    tourStepRef.current = null;
    if (tourMoveTimerRef.current !== null) window.clearTimeout(tourMoveTimerRef.current);
    tourMoveTimerRef.current = window.setTimeout(() => {
      tourMoveTimerRef.current = null;
      if (instance.isActive()) instance.moveTo(index);
    }, 120);
  };
  const advanceTour = (step: string) => {
    const instance = driverRef.current;
    if (!instance?.isActive() || instance.getActiveStep()?.data?.key !== step) return;
    const index = instance.getActiveIndex();
    if (index === undefined || index < tourMaxReachedRef.current) return;
    tourMaxReachedRef.current = index + 1;
    moveTourTo(index + 1);
  };
  const navigateFromControl = (next: Section) => {
    navigate(next);
    advanceTour(`navigate-${next}`);
  };
  const toggleCounterparty = (personId: string) => {
    const guided = personId === "cp1" && driverRef.current?.isActive()
      && driverRef.current.getActiveStep()?.data?.key === "expand-counterparty";
    setExpandedCounterparty(guided || expandedCounterparty !== personId ? personId : null);
    if (guided) advanceTour("expand-counterparty");
  };
  const openWire = (accountId: string) => {
    const guided = tourStepRef.current === "expand-account";
    setExpandedAccount(accountId);
    setSelectedAccount(accountId);
    setAccountMovementType("wire");
    setWire({ accountId, counterpartyId: "cp1", principalUsd: guided ? "" : "1000", feeUsd: guided ? "" : "25", settlementCurrency: "CUP", rateOrPercent: "735" });
    if (accountId === "chase") advanceTour("expand-account");
  };
  const openModal = (next: Modal, id = "") => {
    setSelectedId(id); setModal(next); setSimpleAmount(""); setSimpleNote("");
    if (next === "cash" && dataRef.current) setFinanceFields({ cashUsd: String(dataRef.current.cashUsd), cashCup: String(dataRef.current.cashCup), usdCupRate: String(dataRef.current.usdCupRate) });
    if (next === "price" && dataRef.current) setSimpleAmount(String(dataRef.current.remeseros.find((person) => person.id === id)?.price ?? ""));
    if (next === "debt" && dataRef.current) { const balance = remeseroDebt(dataRef.current, id); setSimpleAmount(formatAmountInput(String(Math.abs(balance)))); setDebtKind(balance < 0 ? "fondo" : "deuda"); }
    if (next === "wire") {
      setSelectedAccount(id || "chase");
      setWire({ accountId: id || "chase", counterpartyId: "cp1", principalUsd: "1000", feeUsd: "25", settlementCurrency: "CUP", rateOrPercent: "735" });
    }
    if (next === "collect") setSelectedPerson(id || "cp1");
    if (next === "price" && id === "r1") advanceTour("open-price");
    if (next === "collect" && id === "cp1") advanceTour("open-collect");
  };

  const startTour = useCallback(async (chapter: Chapter) => {
    driverRef.current?.destroy();
    setShowWelcome(false); setShowChapters(false);
    setToast("");
    window.localStorage.setItem("transactions-demo-tour-seen", "yes");
    const fresh = createSeedState();
    dataRef.current = fresh; setData(fresh);
    tourTransactionRef.current = ""; tourStepRef.current = null;
    tourSnapshotsRef.current = []; tourMaxReachedRef.current = 0; tourCurrentIndexRef.current = 0;
    clearFilters(); setShowTrash(false); setModal(null); setExpandedAccount(null);
    setExpandedCounterparty(null); setDetailRemesero(null); setMenuOpen(false);
    setIncoming({ accountId: "chase", sender: "", amountUsd: "" });
    const { driver } = await import("driver.js");
    const t: DriveStep[] = [];
    const add = (key: string, element: string | (() => Element), title: string, description: string, options: { action?: boolean; actionComplete?: () => boolean; prepareNext?: () => void; canContinue?: () => boolean } = {}) => {
      const popover: Popover = {
        title, description, side: "bottom", align: "start",
        showButtons: t.length ? ["previous", "next", "close"] : ["next", "close"],
      };
      popover.onPrevClick = (_element, _step, context) => {
        const index = context.driver.getActiveIndex();
        if (index !== undefined && index > 0) moveTourTo(index - 1);
      };
      popover.onNextClick = (_element, _step, context) => {
        const index = context.driver.getActiveIndex();
        if (index === undefined) return;
        continueTourStep({
          isLastStep: index === t.length - 1,
          isReview: index < tourMaxReachedRef.current,
          requiresAction: options.action,
          actionComplete: options.actionComplete,
          prepareNext: options.prepareNext,
          canContinue: options.canContinue,
        }, {
          finish: () => context.driver.destroy(),
          notify: showTourNotice,
          advance: () => {
            if (index === tourMaxReachedRef.current) {
              if (key === "wire-fields" && tourViewRef.current) tourSnapshotsRef.current[index] = tourViewRef.current;
              tourMaxReachedRef.current = index + 1;
            }
            moveTourTo(index + 1);
          },
        });
      };
      t.push({
        element, waitForElement: 5000,
        disableActiveInteraction: !options.action && key !== "wire-fields",
        data: { key, interactive: options.action || key === "wire-fields" },
        onHighlightStarted: () => { tourStepRef.current = key; },
        onHighlighted: (_element, _step, context) => {
          tourStepRef.current = key;
          const index = context.driver.getActiveIndex();
          if (index !== undefined) tourCurrentIndexRef.current = index;
          if (index !== undefined && index > tourMaxReachedRef.current) tourMaxReachedRef.current = index;
          if (index !== undefined && !tourSnapshotsRef.current[index] && tourViewRef.current) {
            tourSnapshotsRef.current[index] = tourViewRef.current;
          }
        }, popover,
      });
    };
    const navTarget = (sectionId: Section) => () => document.querySelector(
      `${window.matchMedia("(max-width: 767px)").matches ? "#mobile" : "#desktop"}-nav-${sectionId}`,
    ) as Element;
    if (chapter === "completo") {
      add("intro", "#dashboard-kpis", "Bienvenido a Transactions Demo", "Verás las mismas secciones del sistema real, con datos ficticios guardados solo en tu navegador.");
      add("navigate-transacciones", navTarget("transacciones"), "Abre Transacciones", "Pulsa Transacciones en la barra de navegación para comenzar.", { action: true });
    }
    if (chapter === "completo" || chapter === "transacciones") {
      add("transactions-overview", "#transaction-toolbar", "1 · Transacciones", "Aquí llegan las entradas Zelle. Puedes buscarlas por remitente o código y revisar la papelera.");
      add("new-transaction", "#new-transaction-btn", "Crea una entrada", "Pulsa Nueva transacción. Se abrirá el mismo formulario que usarías para registrar una entrada manual.", { action: true });
      add("create-incoming", "#incoming-form", "Completa el formulario", "Elige Cuenta principal, escribe un remitente ficticio y un importe positivo en USD (por ejemplo, 1,200). Pulsa Crear entrada ficticia; si falta un dato, el formulario no avanzará.", { action: true });
      add("created-transaction", "#demo-new-tx", "Entrada pendiente", "Ya aparece en Transacciones y aumenta el saldo Zelle. Aún no tiene remesero, así que su importe se reserva en el capital.");
      add("click-assign", "#assign-demo-btn", "Asigna la entrada", "Pulsa Asignar en la transacción que acabas de crear.", { action: true });
      add("choose-remesero", "#assign-remesero-select", "Elige a Ada Demo", "Selecciona a Ada Demo para seguir el ejemplo. Su precio actual determinará la deuda en CUP.", { action: true });
      add("confirm-assign", "#assign-confirm-btn", "Confirma la asignación", "Revisa la deuda estimada y pulsa Confirmar asignación. No avanzaremos si no has elegido un remesero.", { action: true });
      add("assigned-result", "#demo-new-tx", "Asignación completada", "La entrada deja de estar pendiente y aparece como deuda del remesero seleccionado.");
      if (chapter === "completo") add("navigate-cuentas", navTarget("cuentas"), "Ahora, Cuentas", "Pulsa Cuentas en la barra de navegación para ver el saldo y preparar una salida.", { action: true });
    }
    if (chapter === "completo" || chapter === "cuentas") {
      add("accounts-overview", "#account-card-chase", "2 · Cuentas", "Cada cuenta muestra el saldo disponible, sus entradas y salidas, y el costo del Zelle que queda.");
      add("expand-account", "#wire-action-btn", "Abre la cuenta", "Pulsa Expandir en la cuenta principal para ver el formulario de salida y su historial.", { action: true });
      add("wire-fields", "#wire-fields", "Prepara el wire", "Escribe un principal (por ejemplo, 1,000 USD) y un fee (por ejemplo, 25 USD). Revisa la persona, la moneda y la tasa. De Zelle saldrá principal más fee. Pulsa Siguiente cuando el formulario sea válido.", {
        canContinue: () => {
          const valid = Boolean(document.querySelector("#wire-preview-panel")) && !document.querySelector<HTMLButtonElement>("#wire-confirm-btn")?.disabled;
          if (!valid) showTourNotice("Revisa los importes: el principal y el fee no pueden superar el saldo disponible.");
          return valid;
        },
      });
      add("wire-preview", "#wire-preview-panel", "Revisa costo y ganancia", "Aquí ves cuánto costó obtener el Zelle que vas a sacar, cuánto pagará la persona y la ganancia estimada después de la comisión.");
      add("confirm-wire", "#wire-confirm-btn", "Registra el wire", "Pulsa Registrar para confirmar la operación ficticia. Si el saldo es insuficiente, el botón permanece deshabilitado.", { action: true });
      add("wire-result", "#account-balance-chase", "Saldo actualizado", "El principal y el fee salieron de la cuenta. El historial conserva el costo y la ganancia calculados al confirmar.");
      if (chapter === "completo") add("navigate-remeseros", navTarget("remeseros"), "Ahora, Remeseros", "Pulsa Remeseros en la barra de navegación para ver su deuda y precio.", { action: true });
    }
    if (chapter === "completo" || chapter === "remeseros") {
      add("remesero-overview", "#remesero-card-r1", "3 · Remeseros", "Cada tarjeta muestra el precio actual y la deuda. Cambiar el precio no modifica operaciones ya asignadas.");
      add("open-price", "#remesero-actions-r1 button:last-child", "Cambia el precio", "Pulsa Precio en la tarjeta de Ada Demo para editar el valor de futuras asignaciones.", { action: true });
      add("change-price", "#price-form", "Guarda un precio nuevo", "Prueba, por ejemplo, 690 CUP por USD y pulsa Guardar precio. La deuda ya calculada permanecerá igual.", { action: true });
      add("price-result", "#remesero-card-r1", "Precio actualizado", "La tarjeta muestra el nuevo precio. También puedes pagar en CUP, editar la deuda o abrir el detalle pulsando la tarjeta.");
      if (chapter === "completo") add("navigate-finanzas", navTarget("finanzas"), "Ahora, Finanzas", "Pulsa Finanzas en la barra de navegación para ver cómo se reúne toda la información.", { action: true });
    }
    if (chapter === "completo" || chapter === "finanzas") {
      add("capital-overview", "#capital-kpi", "4 · Capital neto", "Reúne efectivo, Zelle y deudas. Las entradas aún sin remesero se reservan para no mostrar como libre un dinero que después se deberá pagar.");
      add("zelle-overview", "#zelle-valuation", "¿A qué precio se obtuvo el Zelle?", "La tarjeta muestra cuánto Zelle tiene un costo conocido y el precio promedio de esa parte. Lo que aún no tiene precio se indica por separado.");
      add("expand-counterparty", "#external-debt-card-cp1 > .real-external-head", "Abre una deuda externa", "Pulsa la tarjeta de Cliente Demo A o Siguiente para abrir su cuenta corriente y continuar al cobro.", {
        action: true,
        actionComplete: () => tourViewRef.current?.expandedCounterparty === "cp1",
        prepareNext: () => setExpandedCounterparty("cp1"),
      });
      add("open-collect", "#external-debt-card-cp1 .real-external-body .real-button.outline", "Registra un cobro", "Pulsa Registrar cobro. Se abrirá el formulario de esta persona.", { action: true });
      add("confirm-collect", "#collect-form", "Completa el cobro", "Elige USD, escribe un importe positivo —por ejemplo, 100— y pulsa Registrar cobro. La deuda bajará y el efectivo subirá por el mismo importe.", { action: true });
      add("collect-result", "#cash-kpi", "Cobro reflejado", "Comprueba el efectivo actualizado. Los gastos, cambios de moneda y otros movimientos también pueden explorarse con datos ficticios.");
    }
    navigate(chapter === "completo" ? "inicio" : chapter);
    tourStepsRef.current = t;
    window.setTimeout(() => {
      const instance = driver({
        showProgress: true, allowClose: true, allowKeyboardControl: false, overlayClickBehavior: "none",
        nextBtnText: "Siguiente", prevBtnText: "Anterior", doneBtnText: "Terminar",
        popoverClass: "demo-driver-popover", steps: t,
        onDestroyed: () => {
          if (tourMoveTimerRef.current !== null) window.clearTimeout(tourMoveTimerRef.current);
          tourMoveTimerRef.current = null;
          if (tourCurrentIndexRef.current < tourMaxReachedRef.current) {
            const latest = tourSnapshotsRef.current[tourMaxReachedRef.current];
            if (latest) restoreTourSnapshot(latest);
          }
          tourStepRef.current = null;
          setModal(null);
        },
      });
      driverRef.current = instance;
      instance.drive();
    }, 160);
  }, [commit]);

  const value = data;
  const summary = useMemo(() => value ? zelleSummary(value) : null, [value]);
  const pending = useMemo(() => value ? pendingAssignments(value) : null, [value]);
  const capital = useMemo(() => value ? capitalTotal(value) : null, [value]);
  const wirePreview = useMemo(() => value && ((section === "cuentas" && expandedAccount === wire.accountId && accountMovementType === "wire") || modal === "wire") ? previewDemoWire(value, {
    accountId: wire.accountId, principalUsd: Number(wire.principalUsd), feeUsd: Number(wire.feeUsd), settlementCurrency: wire.settlementCurrency, rateOrPercent: Number(wire.rateOrPercent),
  }) : null, [value, modal, wire, section, expandedAccount, accountMovementType]);
  if (!value || !summary || !pending) return <div className="loading"><Activity size={28} /> Preparando escenario ficticio…</div>;

  const filteredTx = value.transactions.filter((tx) => {
    if (tx.deletedAt) return false;
    const account = value.accounts.find((entry) => entry.id === tx.accountId);
    const remesero = value.remeseros.find((entry) => entry.id === tx.remeseroId);
    const occurred = new Date(tx.occurredAt);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysAgo = (count: number) => new Date(startOfToday.getTime() - count * 86_400_000);
    return (!search || tx.sender.toLowerCase().includes(search.toLowerCase()))
      && (!codeFilter || tx.confirmationCode.toLowerCase().includes(codeFilter.toLowerCase()))
      && (bankFilter === "all" || account?.bank === bankFilter)
      && (accountFilter === "all" || tx.accountId === accountFilter)
      && (!senderFilter || tx.sender.toLowerCase().includes(senderFilter.toLowerCase()))
      && (!amountFilter || tx.amountUsd === Number(amountFilter))
      && (remeseroFilter === "all" || (remeseroFilter === "unassigned" ? !tx.remeseroId : remesero?.id === remeseroFilter))
      && (dateFilter === "all" || (dateFilter === "today" ? occurred >= startOfToday : dateFilter === "yesterday" ? occurred >= daysAgo(1) && occurred < startOfToday : dateFilter === "week" ? occurred >= daysAgo(7) : occurred >= new Date(now.getFullYear(), now.getMonth(), 1)));
  }).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const activeTx = showTrash ? value.transactions.filter((tx) => tx.deletedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) : filteredTx;
  const recentTx = value.transactions.filter((tx) => !tx.deletedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 4);
  const totalReceived = filteredTx.reduce((sum, tx) => sum + tx.amountUsd, 0);
  const todayCount = filteredTx.filter((tx) => new Date(tx.occurredAt).toDateString() === new Date().toDateString()).length;
  const filterCount = [bankFilter !== "all", accountFilter !== "all", Boolean(senderFilter.trim()), Boolean(codeFilter.trim()), Boolean(amountFilter), remeseroFilter !== "all", dateFilter !== "all"].filter(Boolean).length;
  const totalRemeseroDebt = value.remeseros.reduce((sum, person) => sum + remeseroDebt(value, person.id), 0);
  const totalOwnerDebt = value.accounts.reduce((sum, account) => sum + ownerDebt(value, account.id), 0);
  const activeWires = value.outflows.filter((item) => item.kind === "wire" && !item.reversedAt);
  const monthWires = activeWires.filter((item) => { const when = new Date(item.occurredAt); const today = new Date(); return when.getFullYear() === today.getFullYear() && when.getMonth() === today.getMonth(); });
  const profitTotals = (items: typeof activeWires) => ({ netCup: items.reduce((sum, item) => sum + (item.snapshot?.netProfitCup ?? 0), 0), netUsd: items.reduce((sum, item) => sum + (item.snapshot?.netProfitUsd ?? 0), 0), grossCup: items.reduce((sum, item) => sum + (item.snapshot?.grossProfitCup ?? 0), 0), commissionCup: items.reduce((sum, item) => sum + (item.snapshot?.ownerFeeCup ?? 0), 0), exact: items.filter((item) => item.snapshot?.status === "EXACT").length, estimated: items.filter((item) => item.snapshot?.status === "ESTIMATED").length });
  const volumeDays = Array.from({ length: 12 }, (_, index) => {
    const day = new Date(); day.setDate(day.getDate() - (11 - index));
    return { label: day.toLocaleDateString("es-ES", { day: "numeric", month: "short" }), key: day.toDateString() };
  });
  const volumeBars = volumeDays.map((day) => filteredTx.filter((tx) => new Date(tx.occurredAt).toDateString() === day.key).reduce((sum, tx) => sum + tx.amountUsd, 0));
  const largestVolume = Math.max(1, ...volumeBars);
  const bankTotals = value.accounts.map((account) => ({ name: account.bank, total: filteredTx.filter((tx) => tx.accountId === account.id).reduce((sum, tx) => sum + tx.amountUsd, 0) }));
  const largestBank = Math.max(1, ...bankTotals.map((item) => item.total));
  const currentAccount = value.accounts.find((account) => account.id === selectedAccount) ?? value.accounts[0];
  const currentRemesero = value.remeseros.find((person) => person.id === selectedId) ?? value.remeseros[0];
  const currentCounterparty = value.counterparties.find((person) => person.id === selectedPerson) ?? value.counterparties[0];

  const stat = (label: string, amount: string, meta: string, Icon: typeof Activity, accent = "blue", id?: string) => <div className={`stat-card accent-${accent}`} id={id}><div className="stat-top"><span>{label}</span><Icon size={18} /></div><strong>{amount}</strong><small>{meta}</small></div>;
  const empty = (message: string) => <p className="empty-state">{message}</p>;
  const modalTitle: Record<Exclude<Modal, null>, string> = { incoming: "Nueva transacción", assign: "Asignar transacción", wire: "Registrar wire", accountExpense: "Gasto de cuenta Zelle", price: "Cambiar precio", debt: "Editar deuda", remeseroPayment: "Pago a remesero", cash: "Balances y tasa", expense: "Nuevo gasto", exchange: "Cambio de moneda", collect: "Cobrar deuda", explain: explanation.title };

  const filterBar = <div className="real-filter-bar" id="transaction-toolbar">
    <label className="real-search"><Search size={16} /><input placeholder="Buscar por sender..." value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar por sender" />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch("")}><X size={15} /></button>}</label>
    <button type="button" className="real-filter-toggle" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}><span><SlidersHorizontal size={16} /> Filtros {filterCount > 0 && <b>{filterCount}</b>}</span>{filtersOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
    {filtersOpen && <div className="real-filter-panel"><div className="real-date-filter"><span>Fecha</span><div>{[{ id: "all", text: "Todas las fechas" }, { id: "today", text: "Hoy" }, { id: "yesterday", text: "Ayer" }, { id: "week", text: "Última semana" }, { id: "month", text: "Último mes" }].map((item) => <button key={item.id} type="button" className={dateFilter === item.id ? "active" : ""} onClick={() => setDateFilter(item.id)}>{item.text}</button>)}</div></div><div className="real-filter-grid two"><label>Banco<select value={bankFilter} onChange={(event) => setBankFilter(event.target.value)}><option value="all">Todos los bancos</option>{[...new Set(value.accounts.map((account) => account.bank))].map((bank) => <option key={bank}>{bank}</option>)}</select></label><label>Cuenta<select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option value="all">Todas las cuentas</option>{value.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label></div><div className="real-filter-grid four"><label>Sender<input value={senderFilter} onChange={(event) => setSenderFilter(event.target.value)} placeholder="Nombre del sender" /></label><label>Código<input value={codeFilter} onChange={(event) => setCodeFilter(event.target.value)} placeholder="Código de confirmación" /></label><label>Monto<input inputMode="decimal" value={amountFilter} onChange={(event) => setAmountFilter(event.target.value)} placeholder="Monto exacto" /></label><label>Remesero<select value={remeseroFilter} onChange={(event) => setRemeseroFilter(event.target.value)}><option value="all">Todos</option><option value="unassigned">Sin remesero</option>{value.remeseros.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label></div>{filterCount > 0 && <button type="button" className="real-clear" onClick={clearFilters}><X size={15} /> Limpiar todos los filtros</button>}</div>}
  </div>;

  const transactionCard = (tx: DemoState["transactions"][number], allowDelete: boolean, showActions = true) => {
    const account = value.accounts.find((entry) => entry.id === tx.accountId);
    const remesero = value.remeseros.find((entry) => entry.id === tx.remeseroId);
    const isDemo = tx.id === tourTransactionRef.current;
    return <article className="real-transaction-card" id={isDemo ? "demo-new-tx" : undefined} key={tx.id}>
      <div className="real-tx-icon"><ArrowDownLeft size={17} /></div>
      <div className="real-tx-content">
        <div className="real-tx-heading"><div><strong>{tx.sender}</strong><small>{account?.name}</small></div><b>+{money(tx.amountUsd)}</b></div>
        <div className="real-badges"><span className="bank">{account?.bank}</span><span className="account">{account?.name}</span><span className={remesero ? "assigned" : "unassigned"}>{remesero ? `Asignado: ${remesero.name}` : "Sin asignar"}</span>{tx.deletedAt && <span className="deleted">En papelera</span>}<button type="button" className="real-code" title="Copiar código" onClick={() => { void navigator.clipboard.writeText(tx.confirmationCode); setToast("Código copiado."); }}><Copy size={12} /> {tx.confirmationCode}</button></div>
        <p className="real-tx-date">{date(tx.occurredAt)}</p>
        {showActions && <div className="real-tx-actions">{tx.deletedAt ? <button type="button" className="real-button" onClick={() => commit((current) => restoreTransaction(current, tx.id), "Transacción restaurada.")}><RotateCcw size={14} /> Restaurar</button> : <>
          <button type="button" className="real-button outline" id={isDemo ? "assign-demo-btn" : undefined} onClick={() => {
            setAssignTo(isDemo && tourStepRef.current === "click-assign" ? "" : tx.remeseroId ?? "r1");
            openModal("assign", tx.id);
            if (isDemo) advanceTour("click-assign");
          }}>{remesero ? "Reasignar" : "Asignar"}</button>
          {remesero ? <button type="button" className="real-button destructive" onClick={() => commit((current) => unassignTransaction(current, tx.id), "Transacción desasignada.")}>Desasignar</button> : allowDelete && <button type="button" className="real-button amber" disabled={!canDeleteTransaction(value, tx.id)} title={!canDeleteTransaction(value, tx.id) ? "El lote ya fue consumido" : "Enviar a papelera"} onClick={() => commit((current) => deleteTransaction(current, tx.id), "Transacción enviada a papelera.")}><Trash2 size={14} /> Eliminar</button>}
        </>}</div>}
      </div>
    </article>;
  };

  const wireForm = <form className="real-account-form" onSubmit={(event) => {
    event.preventDefault();
    if (accountMovementType === "expense") {
      if (commit((current) => addAccountExpense(current, selectedAccount, Number(accountExpenseAmount)), "Gasto Zelle registrado.")) setAccountExpenseAmount("");
      return;
    }
    if (commit((current) => createWire(current, { accountId: wire.accountId, counterpartyId: wire.counterpartyId, principalUsd: Number(wire.principalUsd), feeUsd: Number(wire.feeUsd), settlementCurrency: wire.settlementCurrency, rateOrPercent: Number(wire.rateOrPercent) }), "Wire ficticio registrado.")) {
      setExpandedAccount(wire.accountId);
      advanceTour("confirm-wire");
    }
  }}>
    <p className="real-form-title">Registrar salida</p>
    <div className="real-account-fields" id="wire-fields">
      <label>Tipo<select value={accountMovementType} onChange={(event) => setAccountMovementType(event.target.value as "wire" | "expense")}><option value="wire">WIRE</option><option value="expense">GASTO</option></select></label>
      <label>Monto<input inputMode="decimal" value={accountMovementType === "wire" ? wire.principalUsd : accountExpenseAmount} onChange={(event) => accountMovementType === "wire" ? setWire({ ...wire, principalUsd: event.target.value }) : setAccountExpenseAmount(event.target.value)} placeholder="0.00" /></label>
      {accountMovementType === "wire" && <>
        <label>Persona<select value={wire.counterpartyId} onChange={(event) => setWire({ ...wire, counterpartyId: event.target.value })}>{value.counterparties.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
        <label>Deuda en<select value={wire.settlementCurrency} onChange={(event) => setWire({ ...wire, settlementCurrency: event.target.value as Currency, rateOrPercent: event.target.value === "CUP" ? "735" : "5" })}><option value="CUP">CUP</option><option value="USD">USD</option></select></label>
        <label>{wire.settlementCurrency === "CUP" ? "Tasa CUP/USD" : "Recargo al cliente (%)"}<input inputMode="decimal" value={wire.rateOrPercent} onChange={(event) => setWire({ ...wire, rateOrPercent: event.target.value })} /></label>
        <label>Fee del wire (USD)<input inputMode="decimal" value={wire.feeUsd} onChange={(event) => setWire({ ...wire, feeUsd: event.target.value })} /></label>
        <label>Comisión del dueño (%)<input value={number(value.accounts.find((account) => account.id === wire.accountId)?.ownerFeePercent ?? 0, 2)} readOnly /><small>Predeterminada de la cuenta.</small></label>
      </>}
    </div>
    {accountMovementType === "wire" && <div className="real-wire-preview" id="wire-preview-panel"><p>{wirePreview?.selected.averagePrice == null ? `El débito total de ${money(wirePreview?.totalUsd ?? 0)} todavía no tiene precio asignado.` : `Estos ${money(wirePreview?.totalUsd ?? 0)} se tiraron a un promedio de ${number(wirePreview.selected.averagePrice, 2)} CUP/USD.`}</p><div className="real-preview-grid"><span>Principal: <b>{money(Number(wire.principalUsd || 0))}</b></span><span>Fee: <b>{money(Number(wire.feeUsd || 0))}</b></span><span>Sale de Zelle: <b>{money(wirePreview?.totalUsd ?? 0)}</b></span></div><div className="real-preview-grid"><span>Valorados: <b>{money(wirePreview?.selected.pricedUsd ?? 0)}</b></span><span>Sin precio: <b>{money(wirePreview?.selected.unpricedUsd ?? 0)}</b></span><span>Costo: <b>{money(wirePreview?.snapshot?.fifoCostCup ?? 0, "CUP")}</b></span></div><div className="real-net-profit">Ganancia neta {wirePreview?.snapshot?.status === "EXACT" ? "exacta" : wirePreview?.snapshot?.status === "ESTIMATED" ? "estimada" : "no disponible"}: <b>{wirePreview?.snapshot?.netProfitCup == null ? "—" : `${money(wirePreview.snapshot.netProfitCup, "CUP")} / ${money(wirePreview.snapshot.netProfitUsd ?? 0)}`}</b></div><small>Bruta: {money(wirePreview?.snapshot?.grossProfitCup ?? 0, "CUP")} · Comisión dueño: {money(wirePreview?.snapshot?.ownerFeeCup ?? 0, "CUP")} · Quedarán {money(wirePreview?.remaining.balanceUsd ?? 0)}</small>{wirePreview?.error && <div className="field-error">{wirePreview.error}</div>}</div>}
    <button className="real-button primary" id="wire-confirm-btn" type="submit" disabled={accountMovementType === "wire" ? !wirePreview?.canCreate : !(Number(accountExpenseAmount) > 0)}>Registrar</button>
  </form>;

  return <div className="real-shell">
    <header className="real-header"><div className="real-header-inner"><div className="real-brand-area"><button className="real-icon-button real-menu-button" aria-label="Abrir menú" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="real-brand-mark"><Activity size={20} /></div><div className="real-brand-copy"><strong>Transactions Demo</strong><small>Panel de Transacciones</small></div></div><div className="real-header-actions"><span className="real-demo-badge"><i /> Datos simulados</span><button className="real-icon-button" aria-label="Actualizar" title="Actualizar" onClick={() => setToast("Datos locales actualizados.")}><RefreshCcw size={19} /></button><button className="real-icon-button" aria-label="Reiniciar demo" title="Reiniciar demo" onClick={reset}><RotateCcw size={19} /></button></div></div></header>
    {menuOpen && <><button className="real-menu-overlay" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} /><aside className="real-mobile-menu"><div className="real-mobile-menu-title">Menú <button aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>{sections.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "active" : ""} onClick={() => navigate(id)}><Icon size={19} />{label}</button>)}</aside></>}
    <main className="real-main"><div className="real-container"><nav className="real-desktop-nav" aria-label="Secciones principales">{sections.map(({ id, label, icon: Icon }) => <button key={id} id={`desktop-nav-${id}`} className={section === id ? "active" : ""} onClick={() => navigateFromControl(id)}><Icon size={16} />{label}</button>)}</nav><div className="real-demo-note"><ShieldCheck size={15} /> Modo demostración: todos los datos son ficticios y permanecen en este navegador. <button onClick={() => setShowChapters(true)}><BookOpen size={15} /> Ver recorrido</button></div><div className="real-view">
        {section === "inicio" && <div className="real-section">
          {filterBar}
          <div className="real-dashboard-kpis" id="dashboard-kpis">
            {stat("Total Recibido", money(totalReceived), `${filteredTx.length} transacciones`, DollarSign)}
            {stat("Promedio", money(filteredTx.length ? totalReceived / filteredTx.length : 0), "por transacción", TrendingUp)}
            <div className="real-bank-totals"><h3>Por banco</h3>{bankTotals.map((item) => <div key={item.name}><span>{item.name}</span><strong>{money(item.total)}</strong></div>)}</div>
            {stat("Hoy", String(todayCount), "transacciones", CalendarDays)}
          </div>
          <div className="real-charts"><div className="real-chart-card"><h3>Transacciones en el tiempo</h3><p>Volumen recibido en los últimos 12 días</p><div className="real-chart-bars">{volumeBars.map((amount, index) => <div key={volumeDays[index].key}><i style={{ height: `${Math.max(4, amount / largestVolume * 100)}%` }} title={`${volumeDays[index].label}: ${money(amount)}`} /><span>{volumeDays[index].label}</span></div>)}</div></div><div className="real-chart-card"><h3>Distribución por banco</h3><p>Entradas por banco</p><div className="real-bank-rings">{bankTotals.map((item, index) => <div key={item.name}><span className={`real-bank-ring ring-${index}`} style={{ background: `conic-gradient(${index ? "#22c55e" : "#0ea5e9"} ${item.total / Math.max(totalReceived, 1) * 100}%, #1b2330 0)` }} /><div><strong>{item.name}</strong><small>{money(item.total)}</small></div></div>)}</div></div></div>
          <h2 className="real-list-title">Transacciones Recientes</h2>
          <div className="real-transaction-list">{recentTx.length ? recentTx.map((tx) => transactionCard(tx, false)) : empty("No se encontraron transacciones")}</div>
        </div>}

        {section === "transacciones" && <div className="real-section">
          <div className="real-page-heading"><div><h2>Transacciones</h2><p>{activeTx.length} de {showTrash ? value.transactions.filter((tx) => tx.deletedAt).length : filteredTx.length} transacciones {showTrash ? "eliminadas" : "activas"}</p></div><div className="real-heading-actions"><div className="real-toggle" role="group" aria-label="Vista de transacciones"><button className={!showTrash ? "active" : ""} onClick={() => setShowTrash(false)}>Activas</button><button className={showTrash ? "active" : ""} onClick={() => setShowTrash(true)}>Papelera</button></div><button className="real-button primary" id="new-transaction-btn" onClick={() => { openModal("incoming"); advanceTour("new-transaction"); }}><Plus size={16} /><span className="desktop-only">Nueva transacción</span><span className="mobile-only">Nueva</span></button></div></div>
          {!showTrash && filterBar}
          <div className="real-transaction-list">{activeTx.length ? activeTx.map((tx) => transactionCard(tx, true)) : empty(showTrash ? "La papelera está vacía" : "No se encontraron transacciones")}</div>
        </div>}

        {section === "cuentas" && <div className="real-section">
          <div className="real-page-heading"><div><h2>Cuentas</h2><p>{value.accounts.length} activas · 0 archivadas · Saldo total: {number(summary.balanceUsd, 2)}</p></div><button className="real-button outline" onClick={() => setToast("Cuentas actualizadas desde los datos locales.")}>Actualizar</button></div>
          <div className="real-account-kpis"><div><span>Saldo</span><strong>{number(summary.balanceUsd, 2)}</strong></div><div><span>Entradas</span><strong>{number(value.transactions.filter((tx) => !tx.deletedAt).reduce((sum, tx) => sum + tx.amountUsd, 0), 2)}</strong></div><div><span>Salidas</span><strong>{number(value.outflows.filter((item) => !item.reversedAt).reduce((sum, item) => sum + item.totalUsd, 0), 2)}</strong></div></div>
          <div className="real-account-list">{summary.accounts.map((account) => { const accountData = value.accounts.find((item) => item.id === account.accountId)!; const expanded = expandedAccount === account.accountId; const incomingCount = value.transactions.filter((tx) => tx.accountId === account.accountId && !tx.deletedAt).length; const incomingTotal = value.transactions.filter((tx) => tx.accountId === account.accountId && !tx.deletedAt).reduce((sum, tx) => sum + tx.amountUsd, 0); const outgoingTotal = value.outflows.filter((item) => item.accountId === account.accountId && !item.reversedAt).reduce((sum, item) => sum + item.totalUsd, 0); return <article className="real-account-card" id={account.accountId === "chase" ? "account-card-chase" : undefined} key={account.accountId}><div className="real-account-head"><div><h3>{account.name}</h3><p>{incomingCount} transferencias · Última entrada: {date(value.transactions.filter((tx) => tx.accountId === account.accountId)[0]?.occurredAt ?? new Date().toISOString())}</p></div><div className="real-account-buttons"><button className="real-button outline" onClick={() => explain("Configurar dueño", "En el sistema completo puedes elegir el dueño, su comisión, salario y saldo inicial. Los datos de esta cuenta demo son ficticios.")}>Configurar dueño</button><button className="real-button outline" onClick={() => explain("Archivar cuenta", "En la aplicación real puedes archivar cuentas sin borrar su historial. Esta demo mantiene las cuentas de ejemplo para el recorrido.")}>Archivar</button><button className="real-button ghost" id={account.accountId === "chase" ? "wire-action-btn" : undefined} onClick={() => expanded ? setExpandedAccount(null) : openWire(account.accountId)}>{expanded ? "Contraer" : "Expandir"}{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button></div></div><p className="real-account-owner">Dueño: <strong>{accountData.owner}</strong> · Salario {money(accountData.monthlySalaryUsd)}/mes</p><div className="real-account-metrics"><div id={account.accountId === "chase" ? "account-balance-chase" : undefined}><span>Saldo actual</span><strong>{number(account.balanceUsd, 2)}</strong></div><div><span>Entradas</span><strong>{number(incomingTotal, 2)}</strong></div><div><span>Salidas</span><strong>{number(outgoingTotal, 2)}</strong></div></div>{expanded && <div className="real-account-expanded">{wireForm}<div className="real-account-history"><h4>Historial</h4>{value.outflows.filter((item) => item.accountId === account.accountId).length ? value.outflows.filter((item) => item.accountId === account.accountId).map((item) => <div key={item.id} className={item.reversedAt ? "reversed" : ""}><div><span className="real-history-tag">{item.kind === "wire" ? "WIRE" : "GASTO"}</span><strong>−{number(item.totalUsd, 2)} USD</strong><small>{date(item.occurredAt)}{item.kind === "wire" ? ` · Principal ${number(item.principalUsd, 2)} + fee ${number(item.feeUsd, 2)} · Ganancia neta ${item.snapshot?.netProfitUsd == null ? "no disponible" : `${number(item.snapshot.netProfitUsd, 2)} USD`}` : ""}</small></div>{item.reversedAt ? <span>Revertido</span> : <button className="real-button ghost" onClick={() => commit((current) => reverseOutflow(current, item.id), "Salida revertida; Zelle y deuda actualizados.")}>Revertir</button>}</div>) : <p>Sin movimientos.</p>}</div></div>}</article>; })}</div>
        </div>}

        {section === "remeseros" && <div className="real-section">
          {detailRemesero ? (() => { const person = value.remeseros.find((entry) => entry.id === detailRemesero); if (!person) return null; const entries = value.transactions.filter((tx) => tx.remeseroId === person.id && !tx.deletedAt); return <div className="real-detail"><button className="real-button ghost" onClick={() => setDetailRemesero(null)}>← Volver a remeseros</button><div className="real-page-heading"><div><h2>{person.name}</h2><p>Detalle del remesero · precio actual {number(person.price)} CUP/USD</p></div></div><div className="real-remesero-summary"><div><span>Deuda actual</span><strong>{number(remeseroDebt(value, person.id), 2)} CUP</strong></div><div><span>Operaciones</span><strong>{entries.length}</strong></div><div><span>Total asignado</span><strong>{money(entries.reduce((sum, tx) => sum + tx.amountUsd, 0))}</strong></div></div><div className="real-detail-card"><h3>Operaciones asignadas</h3>{entries.map((tx) => transactionCard(tx, false, false))}<p>Los cuadres y cortes manuales se calculan sobre el historial completo en la aplicación real.</p></div></div>; })() : <><div className="real-page-heading"><div><h2>Remeseros</h2><p>{value.remeseros.length} remeseros · Deuda total: {number(totalRemeseroDebt, 2)}</p></div><button className="real-button outline" onClick={() => setToast("Remeseros actualizados desde los datos locales.")}>Actualizar</button></div><div className="real-remesero-list">{value.remeseros.map((person) => <article className="real-remesero-card" id={person.id === "r1" ? "remesero-card-r1" : undefined} key={person.id}><button className="real-remesero-link" aria-label={`Ver detalle de ${person.name}`} onClick={() => setDetailRemesero(person.id)} /><div className="real-remesero-content"><div className="real-remesero-summary"><div><span>Nombre</span><strong>{person.name}</strong></div><div><span>Precio</span><strong>{number(person.price, 2)}</strong></div><div className="debt"><span>Deuda actual</span><strong>{number(remeseroDebt(value, person.id), 2)}</strong></div></div><div className="real-remesero-actions" id={person.id === "r1" ? "remesero-actions-r1" : undefined}><button className="real-button outline" onClick={() => explain("Compartir cuadre", "En el sistema completo este botón comparte el cuadre desde el último corte. Aquí puedes explorar las operaciones ficticias sin enviar mensajes reales.")}><MessageCircle size={15} /> Compartir</button><button className="real-button outline" onClick={() => openModal("remeseroPayment", person.id)}><DollarSign size={15} /> Pagar</button><button className="real-button outline" onClick={() => openModal("debt", person.id)}><PencilLine size={15} /> Editar deuda</button><button className="real-button outline" onClick={() => openModal("price", person.id)}><CircleDollarSign size={15} /> Precio</button></div></div></article>)}</div></>}
        </div>}

        {section === "finanzas" && <div className="real-section real-finances">
          <div className="real-page-heading"><div><h2>Finanzas</h2><p>Posición financiera actual y deudas externas auditables.</p></div><div className="real-finance-actions"><button className="real-button outline" onClick={() => setToast("Finanzas actualizadas desde los datos locales.")}><RefreshCcw size={15} /> Actualizar</button><button className="real-button outline" onClick={() => openModal("expense")}><ReceiptText size={15} /> Registrar gasto</button><button className="real-button outline" onClick={() => openModal("exchange")}><ArrowLeftRight size={15} /> Cambiar moneda</button><button className="real-button primary" onClick={() => openModal("cash")}><SlidersHorizontal size={15} /> Editar balances</button></div></div>
          <div className="real-capital" id="capital-kpi"><div><span><Scale size={16} /> Capital neto total</span><strong>{capital === null ? "Pendiente de tasa" : `${money(capital)} USD`}</strong><p>Conversión actual: 1 USD = {number(value.usdCupRate)} CUP</p><small>Reserva incluida: −{money(pending.amountUsd)} USD por {pending.count} transacciones sin remesero.</small><small>Deuda neta con dueños incluida: −{money(totalOwnerDebt)} USD.</small></div></div>
          <div className="real-finance-kpis">{stat("Efectivo USD", money(value.cashUsd), "", Banknote, "blue", "cash-kpi")}{stat("Efectivo CUP", `${number(value.cashCup, 2)} CUP`, "", Wallet)}{stat("Zelle USD", money(summary.balanceUsd), "", Landmark)}{stat("Remeseros neto", `${number(-totalRemeseroDebt, 2)} CUP`, "", Users)}{stat("Pendiente de asignar", `−${money(pending.amountUsd)}`, `${pending.count} transacciones reservadas`, CircleDollarSign, "amber")}</div>
          <div className="real-profit-grid">{[{ title: "Ganancia de wires · Mes actual", values: profitTotals(monthWires) }, { title: "Ganancia de wires · Histórica", values: profitTotals(activeWires) }].map(({ title, values }) => <div className="real-profit-card" key={title}><span>{title}</span><strong>{number(values.netCup, 2)} CUP</strong><b>{number(values.netUsd, 2)} USD netos</b><small>Bruta: {number(values.grossCup, 2)} CUP · Comisión dueños: {number(values.commissionCup, 2)} CUP</small><small>Exacta neta: {values.exact} · Estimada neta: {values.estimated}</small></div>)}</div>
          <div className="real-finance-card"><h3>Deuda con dueños de cuentas</h3><div className="real-owner-totals"><span>Por pagar <b>{money(Math.max(0, totalOwnerDebt))}</b></span><span>Créditos <b>{money(Math.max(0, -totalOwnerDebt))}</b></span><span>Balance neto <b>{money(totalOwnerDebt)}</b></span></div>{value.accounts.map((account) => <button className="real-owner-account" key={account.id} onClick={() => setExpandedOwner(expandedOwner === account.id ? null : account.id)}><span>{account.name} · {account.owner}</span><strong>{money(ownerDebt(value, account.id))}</strong>{expandedOwner === account.id && <small>Comisión {number(account.ownerFeePercent, 2)} % · Salario {money(account.monthlySalaryUsd)}/mes · Saldo inicial {money(account.openingOwnerDebtUsd)}. En la aplicación completa se gestionan pagos, salarios y ajustes auditables.</small>}</button>)}</div>
          <div className="real-valuation" id="zelle-valuation"><h3>Valoración del Zelle</h3><div className="real-valuation-kpis"><div><span>Precio promedio</span><strong>{summary.averagePrice === null ? "Sin valoración" : `${number(summary.averagePrice, 2)} CUP/USD`}</strong></div><div><span>Costo valorado</span><strong>{number(summary.costCup, 2)} CUP</strong></div><div><span>Cobertura</span><strong>{number(summary.coveragePercent, 2)}%</strong><small>{number(summary.pricedUsd, 2)} de {number(summary.balanceUsd, 2)} USD</small></div><div><span>Sin precio / déficit</span><strong className="amber-text">{number(summary.unpricedUsd, 2)} USD</strong></div></div><div className="real-valuation-accounts">{summary.accounts.map((account) => <div key={account.id}><div><strong>{account.name}</strong><small>{number(account.pricedUsd, 2)} USD valorados · {number(account.unpricedUsd, 2)} USD sin precio</small></div><div><strong>{number(account.balanceUsd, 2)} USD</strong><small>{account.averagePrice == null ? "Sin promedio" : `${number(account.averagePrice, 2)} CUP/USD`}</small></div></div>)}</div></div>
          <div className="real-finance-columns"><div className="real-finance-stack"><div className="real-finance-card"><div className="real-card-head"><h3>Gastos recientes</h3>{value.expenses.length > 3 && <button className="real-button ghost" onClick={() => setShowAllExpenses(!showAllExpenses)}>{showAllExpenses ? "Mostrar menos" : `Ver todos (${value.expenses.length})`} <ChevronDown size={15} /></button>}</div><div className="real-finance-list">{(showAllExpenses ? value.expenses : value.expenses.slice(0, 3)).map((item) => <div key={item.id} className={item.reversedAt ? "reversed" : ""}><div><strong>{item.note}</strong><small>{date(item.occurredAt)} · {number(item.amount, 2)} {item.currency}</small></div><span>−{number(item.amount, 2)} {item.currency}</span>{!item.reversedAt && <button className="real-icon-button" aria-label={`Revertir gasto ${item.note}`} onClick={() => commit((current) => reverseExpense(current, item.id), "Gasto revertido.")}><RotateCcw size={15} /></button>}</div>)}</div></div><div className="real-finance-card"><div className="real-card-head"><h3>Cambios de moneda</h3>{value.exchanges.length > 3 && <button className="real-button ghost" onClick={() => setShowAllExchanges(!showAllExchanges)}>{showAllExchanges ? "Mostrar menos" : `Ver todos (${value.exchanges.length})`} <ChevronDown size={15} /></button>}</div><div className="real-finance-list">{(showAllExchanges ? value.exchanges : value.exchanges.slice(0, 3)).map((item) => <div key={item.id} className={item.reversedAt ? "reversed" : ""}><div><strong>{number(item.amount, 2)} {item.from} → {number(item.from === "USD" ? item.amount * item.rate : item.amount / item.rate, 2)} {item.from === "USD" ? "CUP" : "USD"}</strong><small>Tasa {number(item.rate, 2)} · {date(item.occurredAt)}</small></div>{!item.reversedAt && <button className="real-icon-button" aria-label="Revertir cambio" onClick={() => commit((current) => reverseExchange(current, item.id), "Cambio revertido.")}><RotateCcw size={15} /></button>}</div>)}</div></div><div className="real-finance-card"><h3>Desglose del capital</h3><div className="real-breakdown"><div><span>Deuda con remeseros</span><strong>{number(Math.max(0, totalRemeseroDebt), 2)} CUP</strong></div><div><span>Externas por cobrar</span><strong>{number(value.counterparties.reduce((sum, person) => sum + Math.max(0, counterpartyBalance(value, person.id, "USD")), 0), 2)} USD</strong></div><div><span>Externas por pagar</span><strong>{number(value.counterparties.reduce((sum, person) => sum + Math.max(0, -counterpartyBalance(value, person.id, "USD")), 0), 2)} USD</strong></div><div><span>Remeseros neto USD</span><strong>{number(-totalRemeseroDebt / value.usdCupRate, 2)}</strong></div></div></div><div className="real-finance-card"><div className="real-card-head"><h3>Deudas externas</h3><button className="real-button outline" onClick={() => explain("Agregar contraparte", "En la aplicación completa puedes agregar personas, fijar saldos, registrar pagos y cobros. Esta demo ya incluye tres contrapartes ficticias.")}><Plus size={14} /> Agregar</button></div>{value.counterparties.map((person) => <div className="real-external" id={person.id === "cp1" ? "external-debt-card-cp1" : undefined} key={person.id}><button className="real-external-head" onClick={() => toggleCounterparty(person.id)}><span>{person.name}<small>Cuenta corriente en USD y CUP</small></span><span>{number(counterpartyBalance(value, person.id, "USD"), 2)} USD · {number(counterpartyBalance(value, person.id, "CUP"), 2)} CUP</span>{expandedCounterparty === person.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>{expandedCounterparty === person.id && <div className="real-external-body"><p>Saldo positivo: te debe. Saldo negativo: le debes.</p><button className="real-button outline" onClick={() => { setSimpleCurrency("USD"); openModal("collect", person.id); }}>Registrar cobro</button><button className="real-button ghost" onClick={() => explain("Movimientos de deuda", "En el sistema completo puedes fijar saldos, registrar pagos, revertir movimientos y consultar todo el historial auditable.")}>Otros movimientos</button></div>}</div>)}</div></div><aside className="real-finance-aside"><div className="real-finance-card"><h3>Totales actuales</h3><div className="real-breakdown"><div><span>Efectivo USD</span><strong>{money(value.cashUsd)}</strong></div><div><span>Efectivo CUP</span><strong>{money(value.cashCup, "CUP")}</strong></div><div><span>Zelle</span><strong>{money(summary.balanceUsd)}</strong></div><div><span>Reserva pendiente</span><strong>−{money(pending.amountUsd)}</strong></div><div><span>Deuda dueños</span><strong>−{money(totalOwnerDebt)}</strong></div></div></div></aside></div>
        </div>}
      </div></div></main>
    <nav className="real-bottom-nav" aria-label="Navegación móvil">{sections.map(({ id, label, icon: Icon }) => <button key={id} id={`mobile-nav-${id}`} className={section === id ? "selected" : ""} onClick={() => navigateFromControl(id)}><Icon size={20} /><span>{id === "transacciones" ? "Transacc." : id === "inicio" ? "Inicio" : label}</span></button>)}</nav>
    {toast && <div role="status" className="toast"><Check size={17} /> {toast}<button aria-label="Cerrar aviso" onClick={() => setToast("")}><X size={15} /></button></div>}

    {showWelcome && <div className="overlay"><div className="welcome-card"><div className="welcome-icon"><Sparkles size={29} /></div><div className="eyebrow">UNA VISITA GUIADA</div><h2>Conoce Transactions Demo</h2><p>En pocos minutos podrás simular una entrada Zelle, asignarla, hacer un wire y cobrar una deuda. Todo ocurre con datos ficticios en tu navegador.</p><div className="welcome-actions"><button className="primary-button" onClick={() => startTour("completo")}><Play size={16} /> Empezar recorrido</button><button className="ghost-button" onClick={() => { setShowWelcome(false); window.localStorage.setItem("transactions-demo-tour-seen", "yes"); }}>Explorar por mi cuenta</button></div></div></div>}
    {showChapters && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowChapters(false); }}><div className="dialog chapter-dialog" role="dialog" aria-modal="true" aria-label="Elegir recorrido"><button className="dialog-close" aria-label="Cerrar" onClick={() => setShowChapters(false)}><X size={19} /></button><div className="eyebrow">RECORRIDOS INTERACTIVOS</div><h2>Explora a tu ritmo</h2><p className="dialog-intro">Elige el recorrido completo o un capítulo. Cada recorrido empieza con el escenario ficticio inicial y sus acciones modifican únicamente tu navegador.</p><div className="chapter-list">{[{ id: "completo", title: "Recorrido completo", text: "Del pago entrante al capital neto", icon: Sparkles }, { id: "transacciones", title: "Transacciones", text: "Entrada, búsqueda y asignación", icon: ArrowDownLeft }, { id: "cuentas", title: "Cuentas", text: "Costo del Zelle, wire y ganancia", icon: Landmark }, { id: "remeseros", title: "Remeseros", text: "Precio, deuda y operaciones", icon: Users }, { id: "finanzas", title: "Finanzas", text: "Capital, valoración y cobros", icon: Wallet }].map(({ id, title, text, icon: Icon }) => <button key={id} onClick={() => startTour(id as Chapter)}><Icon size={19} /><span><strong>{title}</strong><small>{text}</small></span><ArrowRight size={17} /></button>)}</div></div></div>}
    {modal && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><div className="dialog" role="dialog" aria-modal="true" aria-label={modalTitle[modal]}><button className="dialog-close" aria-label="Cerrar" onClick={closeModal}><X size={19} /></button><div className="eyebrow">OPERACIÓN SIMULADA</div><h2>{modalTitle[modal]}</h2>
      {modal === "incoming" && <form id="incoming-form" onSubmit={(event) => {
        event.preventDefault();
        if (tourStepRef.current === "create-incoming" && incoming.accountId !== "chase") {
          setToast("Para seguir el recorrido, selecciona Cuenta principal.");
          return;
        }
        if (commit((current) => {
          const next = addIncoming(current, { ...incoming, amountUsd: Number(incoming.amountUsd) });
          if (tourStepRef.current === "create-incoming") tourTransactionRef.current = next.transactions[0].id;
          return next;
        }, "Entrada ficticia agregada.")) {
          setModal(null); setIncoming({ accountId: "chase", sender: "", amountUsd: "" });
          advanceTour("create-incoming");
        }
      }}><label>Cuenta<select value={incoming.accountId} onChange={(event) => setIncoming({ ...incoming, accountId: event.target.value })}>{value.accounts.map((account) => <option key={account.id} value={account.id}>{account.bank} · {account.name}</option>)}</select></label><label>Remitente ficticio<input required placeholder="Nombre del remitente" value={incoming.sender} onChange={(event) => setIncoming({ ...incoming, sender: event.target.value })} /></label><label>Importe USD<input required type="number" min="0.01" step="0.01" value={incoming.amountUsd} onChange={(event) => setIncoming({ ...incoming, amountUsd: event.target.value })} /></label><div className="note-box">La entrada aumenta Zelle y permanece pendiente de asignar.</div><button className="primary-button full" type="submit">Crear entrada ficticia</button></form>}
      {modal === "assign" && <form onSubmit={(event) => {
        event.preventDefault();
        if (!assignTo) { setToast("Selecciona un remesero antes de confirmar."); return; }
        if (commit((current) => assignTransaction(current, selectedId, assignTo), "Transacción asignada.")) {
          setModal(null);
          advanceTour("confirm-assign");
        }
      }}><p className="dialog-intro">Selecciona un remesero; se guardará su precio actual en esta operación.</p><label>Remesero<select id="assign-remesero-select" value={assignTo} onChange={(event) => {
        setAssignTo(event.target.value);
        if (tourStepRef.current === "choose-remesero" && event.target.value !== "r1") setToast("En este ejemplo, selecciona Ada Demo.");
        if (event.target.value === "r1") advanceTour("choose-remesero");
      }}><option value="">Selecciona un remesero</option>{value.remeseros.map((person) => <option key={person.id} value={person.id}>{person.name} · {number(person.price)} CUP/USD</option>)}</select></label><div className="note-box">Deuda estimada: {money((value.transactions.find((tx) => tx.id === selectedId)?.amountUsd ?? 0) * (value.remeseros.find((person) => person.id === assignTo)?.price ?? 0), "CUP")}</div><button className="primary-button full" id="assign-confirm-btn" type="submit" disabled={!assignTo || (tourStepRef.current === "choose-remesero" && assignTo !== "r1")}>Confirmar asignación</button></form>}
      {modal === "wire" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => createWire(current, { accountId: wire.accountId, counterpartyId: wire.counterpartyId, principalUsd: Number(wire.principalUsd), feeUsd: Number(wire.feeUsd), settlementCurrency: wire.settlementCurrency, rateOrPercent: Number(wire.rateOrPercent) }), "Wire ficticio registrado.")) setModal(null); }}><div className="form-grid"><label>Cuenta<select value={wire.accountId} onChange={(event) => setWire({ ...wire, accountId: event.target.value })}>{value.accounts.map((account) => <option key={account.id} value={account.id}>{account.bank} · {account.name}</option>)}</select></label><label>Contraparte<select value={wire.counterpartyId} onChange={(event) => setWire({ ...wire, counterpartyId: event.target.value })}>{value.counterparties.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>Principal USD<input type="number" min="0.01" step="0.01" value={wire.principalUsd} onChange={(event) => setWire({ ...wire, principalUsd: event.target.value })} /></label><label>Fee del wire USD<input type="number" min="0" step="0.01" value={wire.feeUsd} onChange={(event) => setWire({ ...wire, feeUsd: event.target.value })} /></label><label>Liquidación<select value={wire.settlementCurrency} onChange={(event) => setWire({ ...wire, settlementCurrency: event.target.value as Currency, rateOrPercent: event.target.value === "CUP" ? "735" : "5" })}><option value="CUP">CUP</option><option value="USD">USD</option></select></label><label>{wire.settlementCurrency === "CUP" ? "Tasa CUP/USD" : "Recargo al cliente (%)"}<input type="number" min="0.01" step="0.01" value={wire.rateOrPercent} onChange={(event) => setWire({ ...wire, rateOrPercent: event.target.value })} /></label></div><div className="wire-preview" id="wire-preview-panel"><div className="preview-heading"><strong>Vista previa del wire</strong><span className={`status ${wirePreview?.snapshot?.status === "EXACT" ? "assigned" : "pending"}`}>{wirePreview?.snapshot?.status === "EXACT" ? "Exacta" : wirePreview?.snapshot?.status === "ESTIMATED" ? "Estimada" : "No disponible"}</span></div><div className="breakdown-row"><span>Principal + fee = débito Zelle</span><strong>{money(wirePreview?.totalUsd ?? 0)}</strong></div><div className="breakdown-row"><span>Cobro a {value.counterparties.find((person) => person.id === wire.counterpartyId)?.name}</span><strong>{money(wirePreview?.snapshot?.settlementAmount ?? 0, wire.settlementCurrency)}</strong></div><div className="breakdown-row"><span>Costo FIFO · {number(wirePreview?.selected.pricedUsd ?? 0, 2)} USD valorados</span><strong>{wirePreview?.snapshot?.fifoCostCup == null ? "Sin precio" : money(wirePreview.snapshot.fifoCostCup, "CUP")}</strong></div><div className="breakdown-row"><span>Comisión dueño · {number(wirePreview?.snapshot?.ownerFeePercent ?? 0, 2)} %</span><strong>{money(wirePreview?.snapshot?.ownerFeeCup ?? 0, "CUP")}</strong></div><div className="breakdown-row profit"><span>Ganancia neta</span><strong>{wirePreview?.snapshot?.netProfitCup == null ? "No disponible" : `${money(wirePreview.snapshot.netProfitCup, "CUP")} / ${money(wirePreview.snapshot.netProfitUsd ?? 0)}`}</strong></div><small>Saldo restante estimado: {money(wirePreview?.remaining.balanceUsd ?? 0)} · tasa global {number(value.usdCupRate)}</small>{wirePreview?.error && <div className="field-error">{wirePreview.error}</div>}</div><button className="primary-button full" id="wire-confirm-btn" type="submit" disabled={!wirePreview?.canCreate}>Confirmar wire ficticio</button></form>}
      {modal === "accountExpense" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => addAccountExpense(current, selectedAccount, Number(simpleAmount)), "Gasto Zelle registrado.")) setModal(null); }}><p className="dialog-intro">Reduce el saldo de {currentAccount.name} y consume inventario FIFO. No modifica efectivo.</p><label>Importe USD<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><button className="primary-button full" type="submit">Registrar gasto Zelle</button></form>}
      {modal === "price" && <form id="price-form" onSubmit={(event) => {
        event.preventDefault();
        if (tourStepRef.current === "change-price" && Number(simpleAmount) === currentRemesero.price) { setToast("Introduce un precio distinto para ver el cambio."); return; }
        if (commit((current) => setRemeseroPrice(current, selectedId, Number(simpleAmount)), "Nuevo precio guardado para futuras asignaciones.")) {
          setModal(null);
          advanceTour("change-price");
        }
      }}><p className="dialog-intro">El precio nuevo no cambia el valor aplicado a operaciones anteriores.</p><label>Precio de {currentRemesero.name} · CUP por USD<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><button className="primary-button full" type="submit">Guardar precio</button></form>}
      {modal === "debt" && <form onSubmit={(event) => { event.preventDefault(); const amount = parseAmountInput(simpleAmount); if (commit((current) => setRemeseroDebt(current, selectedId, amount === 0 ? 0 : debtKind === "fondo" ? -amount : amount), "Deuda de demo ajustada.")) setModal(null); }}><p className="dialog-intro">Fija el saldo final de {currentRemesero.name}. La edición no mueve efectivo; en el sistema completo genera un corte manual auditable.</p><label>Tipo de saldo<select value={parseAmountInput(simpleAmount) === 0 ? "deuda" : debtKind} disabled={parseAmountInput(simpleAmount) === 0} onChange={(event) => setDebtKind(event.target.value as "deuda" | "fondo")}><option value="deuda">Deuda</option><option value="fondo">Fondo</option></select></label><label>Saldo final en CUP<input required type="text" inputMode="decimal" value={simpleAmount} onChange={(event) => setSimpleAmount(formatAmountInput(event.target.value))} /></label><button className="primary-button full" type="submit">Guardar deuda</button></form>}
      {modal === "remeseroPayment" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => payRemesero(current, selectedId, Number(simpleAmount)), "Pago registrado: deuda y efectivo CUP reducidos.")) setModal(null); }}><p className="dialog-intro">Se reducirá la deuda de {currentRemesero.name} y el efectivo CUP por el mismo importe.</p><label>Pago en CUP<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><div className="note-box">Efectivo CUP después: {money(value.cashCup - Number(simpleAmount || 0), "CUP")}</div><button className="primary-button full" type="submit">Registrar pago</button></form>}
      {modal === "cash" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => setFinanceState(current, { cashUsd: Number(financeFields.cashUsd), cashCup: Number(financeFields.cashCup), usdCupRate: Number(financeFields.usdCupRate) }), "Balances de demo actualizados.")) setModal(null); }}><p className="dialog-intro">Edita los balances fuera de Zelle y la tasa global de esta simulación.</p><label>Efectivo USD<input type="number" step="0.01" value={financeFields.cashUsd} onChange={(event) => setFinanceFields({ ...financeFields, cashUsd: event.target.value })} /></label><label>Efectivo CUP<input type="number" step="0.01" value={financeFields.cashCup} onChange={(event) => setFinanceFields({ ...financeFields, cashCup: event.target.value })} /></label><label>Tasa CUP por 1 USD<input type="number" min="0.01" step="0.01" value={financeFields.usdCupRate} onChange={(event) => setFinanceFields({ ...financeFields, usdCupRate: event.target.value })} /></label><button className="primary-button full" type="submit">Actualizar balances</button></form>}
      {modal === "expense" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => addExpense(current, simpleCurrency, Number(simpleAmount), simpleNote), "Gasto de efectivo registrado.")) setModal(null); }}><p className="dialog-intro">Este gasto afecta el efectivo, no el inventario Zelle.</p><label>Moneda<select value={simpleCurrency} onChange={(event) => setSimpleCurrency(event.target.value as Currency)}><option value="CUP">CUP</option><option value="USD">USD</option></select></label><label>Importe<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><label>Concepto<input required value={simpleNote} onChange={(event) => setSimpleNote(event.target.value)} placeholder="Ej. Transporte" /></label><button className="primary-button full" type="submit">Registrar gasto</button></form>}
      {modal === "exchange" && <form onSubmit={(event) => { event.preventDefault(); if (commit((current) => exchangeCurrency(current, simpleCurrency, Number(simpleAmount), Number(simpleRate)), "Cambio de moneda registrado.")) setModal(null); }}><label>Dirección<select value={simpleCurrency} onChange={(event) => setSimpleCurrency(event.target.value as Currency)}><option value="USD">USD → CUP</option><option value="CUP">CUP → USD</option></select></label><label>Importe de origen<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><label>Tasa de esta operación<input required type="number" min="0.01" step="0.01" value={simpleRate} onChange={(event) => setSimpleRate(event.target.value)} /></label><div className="note-box">Recibirás aproximadamente {money(simpleCurrency === "USD" ? Number(simpleAmount || 0) * Number(simpleRate || 0) : Number(simpleAmount || 0) / Number(simpleRate || 1), simpleCurrency === "USD" ? "CUP" : "USD")}.</div><button className="primary-button full" type="submit">Registrar cambio</button></form>}
      {modal === "collect" && <form id="collect-form" onSubmit={(event) => {
        event.preventDefault();
        if (tourStepRef.current === "confirm-collect" && simpleCurrency !== "USD") {
          setToast("Para este ejemplo, elige USD.");
          return;
        }
        if (commit((current) => collectDebt(current, selectedPerson, simpleCurrency, Number(simpleAmount)), "Cobro registrado: deuda y efectivo actualizados.")) {
          setModal(null);
          advanceTour("confirm-collect");
        }
      }}><p className="dialog-intro">Cobrar a {currentCounterparty.name} disminuye su saldo firmado y aumenta el efectivo de la misma moneda.</p><label>Moneda<select value={simpleCurrency} onChange={(event) => setSimpleCurrency(event.target.value as Currency)}><option value="USD">USD</option><option value="CUP">CUP</option></select></label><label>Importe cobrado<input required type="number" min="0.01" step="0.01" value={simpleAmount} onChange={(event) => setSimpleAmount(event.target.value)} /></label><div className="note-box">Deuda después: {money(counterpartyBalance(value, selectedPerson, simpleCurrency) - Number(simpleAmount || 0), simpleCurrency)}</div><button className="primary-button full" type="submit">Registrar cobro</button></form>}
      {modal === "explain" && <><p className="dialog-intro">{explanation.body}</p><button className="primary-button full" onClick={() => setModal(null)}>Entendido</button></>}
    </div></div>}
  </div>;
}
