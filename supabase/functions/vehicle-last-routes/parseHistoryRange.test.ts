import { describe, expect, it } from "vitest";

import { parseHistoryRange } from "./range";

describe("parseHistoryRange", () => {
  it("aceita um intervalo válido de um dia", () => {
    expect(parseHistoryRange({ from: "2026-09-07", to: "2026-09-07" })).toEqual({
      from: "2026-09-07",
      to: "2026-09-07",
    });
  });

  it("aceita um intervalo válido de 92 dias", () => {
    expect(parseHistoryRange({ from: "2026-06-01", to: "2026-08-31" })).toEqual({
      from: "2026-06-01",
      to: "2026-08-31",
    });
  });

  it("rejeita um intervalo de 93 dias", () => {
    expect(parseHistoryRange({ from: "2026-06-01", to: "2026-09-01" })).toBeNull();
  });

  it("rejeita from maior que to", () => {
    expect(parseHistoryRange({ from: "2026-09-08", to: "2026-09-07" })).toBeNull();
  });

  it.each([
    { from: "2026-9-1", to: "2026-09-07" },
    { from: "ontem", to: "2026-09-07" },
    { from: "", to: "2026-09-07" },
    {},
  ])("rejeita formato inválido ou ausente: %o", (body) => {
    expect(parseHistoryRange(body)).toBeNull();
  });
});
