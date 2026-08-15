import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockedDeps = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  getLatestMock: vi.fn(),
  upsertDailyMock: vi.fn(),
}));

vi.mock("electron", () => ({
  net: {
    fetch: mockedDeps.fetchMock,
  },
}));

vi.mock("../electron/main/db.js", () => ({
  bcvRateRepo: {
    getLatest: mockedDeps.getLatestMock,
    upsertDaily: mockedDeps.upsertDailyMock,
  },
}));

function createBcvHtml({
  usdRaw = "36,50000000",
  dateLabel = "martes, 15 agosto 2026",
} = {}) {
  return `
    <section id="dolar">
      <strong class="strong-tb">${usdRaw}</strong>
    </section>
    <div>
      Fecha Valor: <span>${dateLabel}</span>
    </div>
  `;
}

function createOkHtmlResponse(html) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(html),
  };
}

describe("BCV sync service", () => {
  let service;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    service = await import("../electron/main/bcv-rate-service.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should skip remote fetch when local rate is already updated", async () => {
    mockedDeps.getLatestMock.mockReturnValue({
      valueDateISO: "9999-12-31",
      valueUsd: 40,
    });

    const result = await service.refreshBcvUsdRate();

    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("already-updated-for-today");
    expect(mockedDeps.fetchMock).not.toHaveBeenCalled();
  });

  it("should parse remote BCV payload and persist rate", async () => {
    mockedDeps.getLatestMock.mockReturnValue(null);
    mockedDeps.upsertDailyMock.mockImplementation((payload) => ({ id: 1, ...payload }));

    const html = createBcvHtml();
    mockedDeps.fetchMock.mockImplementation(async () => createOkHtmlResponse(html));

    const result = await service.refreshBcvUsdRate({
      force: true,
      reason: "tdd-sync-test",
    });

    expect(result.ok).toBe(true);
    expect(result.updated).toBe(true);
    expect(mockedDeps.upsertDailyMock).toHaveBeenCalledTimes(1);

    const persistedPayload = mockedDeps.upsertDailyMock.mock.calls[0][0];
    expect(persistedPayload.valueUsd).toBe(36.5);
    expect(persistedPayload.valueDateISO).toBe("2026-08-15");
    expect(persistedPayload.rawPayload.reason).toBe("tdd-sync-test");
  });

  it("should return controlled failure result on connectivity errors", async () => {
    mockedDeps.getLatestMock.mockReturnValue(null);
    mockedDeps.fetchMock.mockRejectedValue(new Error("network unreachable"));

    const result = await service.refreshBcvUsdRateSafe({ force: true });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("refresh-failed");
    expect(result.error).toContain("network unreachable");

    const status = await service.getBcvUsdRateStatus();
    expect(status.isOnline).toBe(false);
    expect(status.lastSyncError).toContain("network unreachable");
  });

  it("should enforce and persist manual rate in offline scenarios", async () => {
    mockedDeps.upsertDailyMock.mockImplementation((payload) => ({ id: 2, ...payload }));

    await expect(service.setManualBcvUsdRate(0)).rejects.toThrow(
      "La tasa manual debe ser un numero mayor a cero.",
    );

    const result = await service.setManualBcvUsdRate(39.25);

    expect(result.ok).toBe(true);
    expect(result.reason).toBe("manual-rate-set");

    const payload = mockedDeps.upsertDailyMock.mock.calls.at(-1)[0];
    expect(payload.sourceUrl).toBe("manual://local");
    expect(payload.valueUsd).toBe(39.25);
  });

  it("should require manual rate when offline and no fresh local rate exists", async () => {
    mockedDeps.getLatestMock.mockReturnValue(null);
    mockedDeps.fetchMock.mockRejectedValue(new Error("failed to fetch"));

    const status = await service.getBcvUsdRateStatus();

    expect(status.isOnline).toBe(false);
    expect(status.hasFreshRateForToday).toBe(false);
    expect(status.requiresManualRate).toBe(true);
  });
});
