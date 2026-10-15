import { describe, expect, it, vi } from "vitest";
import { continueTourStep } from "../lib/tour-navigation";

const navigation = () => ({ advance: vi.fn(), finish: vi.fn(), notify: vi.fn() });

describe("continuación del recorrido", () => {
  it("abre la deuda externa antes de avanzar del paso 3 al 4 al pulsar Siguiente", () => {
    let expandedCounterparty: string | null = null;
    const visited: Array<string | null> = [];
    const controls = navigation();
    controls.advance.mockImplementation(() => { visited.push(expandedCounterparty); });
    continueTourStep({
      isLastStep: false, isReview: false, requiresAction: true,
      actionComplete: () => expandedCounterparty === "cp1",
      prepareNext: () => { expandedCounterparty = "cp1"; },
    }, controls);
    expect(visited).toEqual(["cp1"]);
    expect(controls.notify).not.toHaveBeenCalled();
  });

  it("avanza si la tarjeta ya estaba abierta y conserva su apertura", () => {
    let expandedCounterparty = "cp1";
    const controls = navigation();
    continueTourStep({
      isLastStep: false, isReview: false, requiresAction: true,
      actionComplete: () => expandedCounterparty === "cp1",
      prepareNext: () => { expandedCounterparty = "cp1"; },
    }, controls);
    expect(expandedCounterparty).toBe("cp1");
    expect(controls.advance).toHaveBeenCalledOnce();
  });

  it("no permite saltarse una confirmación financiera pendiente", () => {
    const controls = navigation();
    continueTourStep({ isLastStep: false, isReview: false, requiresAction: true }, controls);
    expect(controls.advance).not.toHaveBeenCalled();
    expect(controls.notify).toHaveBeenCalledWith("Completa la acción señalada para continuar.");
  });

  it("respeta la validación del formulario de wire", () => {
    const controls = navigation();
    continueTourStep({ isLastStep: false, isReview: false, canContinue: () => false }, controls);
    expect(controls.advance).not.toHaveBeenCalled();
  });

  it("revisa pasos completados sin volver a ejecutar sus acciones", () => {
    const controls = navigation();
    const prepareNext = vi.fn();
    continueTourStep({ isLastStep: false, isReview: true, requiresAction: true, prepareNext }, controls);
    expect(prepareNext).not.toHaveBeenCalled();
    expect(controls.advance).toHaveBeenCalledOnce();
  });

  it("termina el recorrido en su último paso", () => {
    const controls = navigation();
    continueTourStep({ isLastStep: true, isReview: false }, controls);
    expect(controls.finish).toHaveBeenCalledOnce();
    expect(controls.advance).not.toHaveBeenCalled();
  });
});
