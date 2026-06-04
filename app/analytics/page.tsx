import Header from "@/app/components/Header";
import { getRedisClient } from "@/lib/redis";
import { ACTIVE_RUN_ID } from "@/config";
import { modelStateKey, modelTradesKey, runConfigKey, runLeaderboardKey } from "@/lib/run-redis-keys";
import { ModelState, RunConfig, Trade, LeaderboardEntry } from "@/types/global";
import Link from "next/link";

const MODEL_COLORS = ["#d7d7fd", "#d7f5d0", "#ffebeb", "#f3f3f3"];
const MODEL_STROKE = ["#6060e0", "#2a8a2a", "#cc3333", "#888888"];
const STARTING_CAPITAL = 1_000_000;
const CHART_W = 1000;
const CHART_H = 260;

// ── formatters ──────────────────────────────────────────────────────────────

function fmtINR(val: number, decimals = 0) {
  if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(2)}Cr`;
  if (val >= 100_000) return `₹${(val / 100_000).toFixed(2)}L`;
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: decimals })}`;
}

function fmtPct(val: number, showSign = true) {
  const sign = showSign && val >= 0 ? "+" : "";
  return `${sign}${(val * 100).toFixed(2)}%`;
}

function fmtMonthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${names[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

// ── analytics helpers ────────────────────────────────────────────────────────

type NavPoint = { date: string; nav: number };

function computeNavHistory(trades: Trade[]): NavPoint[] {
  if (!trades.length) return [];

  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const dailyPnl = new Map<string, number>();
  for (const t of sorted) {
    if (t.pnl !== undefined) {
      const d = t.date.slice(0, 10);
      dailyPnl.set(d, (dailyPnl.get(d) ?? 0) + t.pnl);
    }
  }

  const dates = [...new Set(sorted.map((t) => t.date.slice(0, 10)))].sort();
  if (!dates.length) return [];

  let running = STARTING_CAPITAL;
  const points: NavPoint[] = [{ date: dates[0], nav: STARTING_CAPITAL }];
  for (const date of dates) {
    running += dailyPnl.get(date) ?? 0;
    if (points[points.length - 1].date !== date) {
      points.push({ date, nav: running });
    } else {
      points[points.length - 1].nav = running;
    }
  }
  return points;
}

function toSvgPath(
  points: NavPoint[],
  minNav: number,
  maxNav: number,
  padX = 0,
  padY = 14,
): string {
  if (points.length < 2) return "";
  const range = maxNav - minNav || 1;
  return points
    .map((p, i) => {
      const x = padX + (i / (points.length - 1)) * (CHART_W - 2 * padX);
      const y = CHART_H - padY - ((p.nav - minNav) / range) * (CHART_H - 2 * padY);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function computeMonthlyPnl(trades: Trade[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of trades) {
    if (t.pnl !== undefined) {
      const month = t.date.slice(0, 7);
      map.set(month, (map.get(month) ?? 0) + t.pnl);
    }
  }
  return map;
}

function heatCell(pnl: number): { bg: string; fg: string } {
  if (pnl === 0) return { bg: "#eeeeee", fg: "#444748" };
  if (pnl > 0) {
    const t = Math.min(pnl / (STARTING_CAPITAL * 0.04), 1);
    const r = Math.round(215 * (1 - t));
    const g = Math.round(128 + 127 * t);
    const b = Math.round(208 * (1 - t));
    return { bg: `rgb(${r},${g},${b})`, fg: t > 0.55 ? "#fff" : "#111" };
  }
  const t = Math.min(Math.abs(pnl) / (STARTING_CAPITAL * 0.04), 1);
  const g = Math.round(235 * (1 - t));
  const b = Math.round(235 * (1 - t));
  return { bg: `rgb(255,${g},${b})`, fg: t > 0.55 ? "#fff" : "#111" };
}

function computeDrawdownPath(hist: NavPoint[], padY = 10): string {
  if (hist.length < 2) return "";
  let peak = STARTING_CAPITAL;
  const ddPoints = hist.map((p) => {
    peak = Math.max(peak, p.nav);
    return (p.nav - peak) / peak;
  });
  const minDd = Math.min(...ddPoints, -0.005);
  return ddPoints
    .map((dd, i) => {
      const x = (i / (ddPoints.length - 1)) * CHART_W;
      const y = padY + (dd / minDd) * (200 - 2 * padY);
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

// ── page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
  const client = await getRedisClient();
  let config: RunConfig | null = null;
  let leaderboard: LeaderboardEntry[] = [];
  const statesMap = new Map<string, ModelState>();
  const tradesMap = new Map<string, Trade[]>();

  try {
    const [cfgRaw, lbRaw] = await Promise.all([
      client.get(runConfigKey(ACTIVE_RUN_ID)),
      client.get(runLeaderboardKey(ACTIVE_RUN_ID)),
    ]);
    if (cfgRaw) config = JSON.parse(cfgRaw);
    if (lbRaw) leaderboard = JSON.parse(lbRaw);

    if (config?.models.length) {
      await Promise.all(
        config.models.map(async (m) => {
          const [stRaw, trRaw] = await Promise.all([
            client.get(modelStateKey(ACTIVE_RUN_ID, m.modelId)),
            client.get(modelTradesKey(ACTIVE_RUN_ID, m.modelId)),
          ]);
          if (stRaw) statesMap.set(m.modelId, JSON.parse(stRaw));
          if (trRaw) tradesMap.set(m.modelId, JSON.parse(trRaw));
        })
      );
    }
  } finally {
    await client.disconnect();
  }

  const models = config?.models ?? [];
  const hasData = statesMap.size > 0;

  // NAV histories + global scale
  const navHistories = models.map((m) => computeNavHistory(tradesMap.get(m.modelId) ?? []));
  const allNavs = navHistories.flatMap((h) => h.map((p) => p.nav));
  const minNav = allNavs.length ? Math.min(...allNavs) * 0.985 : STARTING_CAPITAL * 0.9;
  const maxNav = allNavs.length ? Math.max(...allNavs) * 1.015 : STARTING_CAPITAL * 1.1;
  const baselineY = (
    CHART_H - 14 - ((STARTING_CAPITAL - minNav) / (maxNav - minNav || 1)) * (CHART_H - 28)
  ).toFixed(1);

  // Monthly heatmap data
  const monthlyByModel = models.map((m) => computeMonthlyPnl(tradesMap.get(m.modelId) ?? []));
  const allMonths = [
    ...new Set(monthlyByModel.flatMap((map) => [...map.keys()])),
  ].sort();

  // Daily trade activity (all models combined)
  const allTrades = [...tradesMap.values()].flat();
  const dailyCounts = new Map<string, number>();
  for (const t of allTrades) {
    const d = t.date.slice(0, 10);
    dailyCounts.set(d, (dailyCounts.get(d) ?? 0) + 1);
  }
  const tradesDays = [...dailyCounts.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  const maxDaily = Math.max(...tradesDays.map(([, c]) => c), 1);

  // Summary numbers
  const totalTrades = allTrades.length;
  const totalNav = [...statesMap.values()].reduce((s, st) => s + st.nav, 0);
  const bestEntry = leaderboard[0];

  // Drawdown paths
  const ddPaths = navHistories.map((h) => computeDrawdownPath(h));

  // Per-model win stats
  const winStats = models.map((m) => {
    const trades = tradesMap.get(m.modelId) ?? [];
    const closed = trades.filter((t) => t.pnl !== undefined);
    const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
    const losses = closed.filter((t) => (t.pnl ?? 0) < 0).length;
    const wr = closed.length > 0 ? wins / closed.length : 0;
    return { wins, losses, closed: closed.length, wr };
  });

  const HEATMAP_COLS = `120px repeat(${Math.max(allMonths.length, 1)}, minmax(44px, 1fr))`;

  return (
    <main className="landing-page">
      <Header active="analytics" />

      {/* Sub-header */}
      <div
        className="landing-terminal__header"
        style={{
          justifyContent: "flex-start",
          gap: "16px",
          borderTop: 0,
          background: "var(--landing-surface)",
          color: "var(--landing-line)",
        }}
      >
        <span style={{ fontSize: "12px" }}>ANALYTICS</span>
        <span style={{ color: "var(--landing-muted)" }}>|</span>
        <span style={{ color: "var(--landing-muted)" }}>
          {config?.season ?? "Season 1"}
        </span>
        {config?.status && (
          <>
            <span style={{ color: "var(--landing-muted)" }}>|</span>
            <span style={{ color: "var(--accent-green)", display: "flex", alignItems: "center", gap: "6px" }}>
              <i style={{ background: "var(--accent-green)", display: "inline-block", width: 8, height: 8 }} />
              {config.status.toUpperCase()}
            </span>
          </>
        )}
        {config?.startDate && (
          <>
            <span style={{ color: "var(--landing-muted)" }}>|</span>
            <span style={{ color: "var(--landing-muted)" }}>
              Started: {config.startDate}
            </span>
          </>
        )}
      </div>

      <section className="landing-section" style={{ padding: "40px 24px" }}>
        <div className="landing-section__inner">

          {/* ── Summary stats ─────────────────────────────────────────── */}
          <div
            className="arena-stat-grid arena-stat-grid--4"
            style={{
              border: "1px solid var(--landing-line)",
              boxShadow: "4px 4px 0 0 var(--landing-line)",
              gap: 0,
              marginBottom: "32px",
            }}
          >
            {(
              [
                { label: "MODELS COMPETING", value: models.length || "—" },
                { label: "TOTAL TRADES", value: totalTrades || "—" },
                {
                  label: "BEST RETURN",
                  value: bestEntry ? fmtPct(bestEntry.totalReturn) : "—",
                  color: bestEntry
                    ? bestEntry.totalReturn >= 0
                      ? "var(--accent-green)"
                      : "var(--accent-red)"
                    : undefined,
                },
                { label: "COMBINED NAV", value: totalNav > 0 ? fmtINR(totalNav) : "—" },
              ] as { label: string; value: string | number; color?: string }[]
            ).map(({ label, value, color }, i) => (
              <div
                key={label}
                style={{
                  padding: "20px 24px",
                  borderRight: i < 3 ? "1px solid var(--landing-line)" : "none",
                  background:
                    i % 2 === 0
                      ? "var(--landing-surface)"
                      : "var(--landing-surface-low)",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    color: "var(--landing-muted)",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 800,
                    color: color ?? "var(--landing-line)",
                    lineHeight: 1,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          {!hasData ? (
            <div className="landing-coming-soon" style={{ margin: "0 auto" }}>
              <strong>NO DATA YET</strong>
              <span>Run the trading engine to populate analytics.</span>
              <span style={{ marginTop: "16px" }}>
                Redis key: <code>run:{ACTIVE_RUN_ID}:model:*:state</code>
              </span>
              <Link
                href="/leaderboard"
                className="landing-button"
                style={{ marginTop: "24px" }}
              >
                VIEW LEADERBOARD →
              </Link>
            </div>
          ) : (
            <>
              {/* ── NAV Over Time ──────────────────────────────────────── */}
              <div style={{ marginBottom: "32px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "12px",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <h2
                    style={{
                      fontFamily: "IBM Plex Sans, sans-serif",
                      fontSize: "13px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      margin: 0,
                    }}
                  >
                    Portfolio NAV Over Time
                  </h2>
                  <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                    {models.map((m, i) => (
                      <span
                        key={m.modelId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "10px",
                          fontWeight: 700,
                          color: "var(--landing-muted)",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 22,
                            height: 3,
                            background: MODEL_STROKE[i % MODEL_STROKE.length],
                          }}
                        />
                        {m.name}
                      </span>
                    ))}
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        color: "var(--landing-muted)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 22,
                          height: 2,
                          background: "var(--landing-muted)",
                          borderTop: "2px dashed var(--landing-muted)",
                        }}
                      />
                      Start
                    </span>
                  </div>
                </div>

                <div className="landing-dashboard">
                  <div className="landing-dashboard__chart" style={{ padding: 0 }}>
                    <svg
                      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                      preserveAspectRatio="none"
                      style={{ display: "block", width: "100%", minHeight: "260px" }}
                    >
                      {/* Y-axis reference lines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                        const y = 14 + t * (CHART_H - 28);
                        return (
                          <line
                            key={t}
                            x1="0"
                            y1={y.toFixed(1)}
                            x2={CHART_W}
                            y2={y.toFixed(1)}
                            stroke="#e8e8e8"
                            strokeWidth="1"
                          />
                        );
                      })}
                      {/* Starting capital baseline */}
                      <line
                        x1="0"
                        y1={baselineY}
                        x2={CHART_W}
                        y2={baselineY}
                        stroke="#888"
                        strokeWidth="1"
                        strokeDasharray="8 5"
                      />
                      {/* Model NAV lines */}
                      {navHistories.map((hist, i) => {
                        if (hist.length < 2) return null;
                        const d = toSvgPath(hist, minNav, maxNav);
                        return (
                          <path
                            key={models[i].modelId}
                            d={d}
                            style={{
                              stroke: MODEL_STROKE[i % MODEL_STROKE.length],
                              strokeWidth: 2.5,
                              fill: "none",
                              strokeLinejoin: "round",
                              strokeLinecap: "round",
                            }}
                          />
                        );
                      })}
                    </svg>
                    {/* X / Y axis labels */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "6px 12px 10px",
                        borderTop: "1px solid var(--landing-surface-high)",
                      }}
                    >
                      {navHistories[0]?.length > 0 ? (
                        [
                          navHistories[0][0],
                          navHistories[0][Math.floor(navHistories[0].length / 2)],
                          navHistories[0][navHistories[0].length - 1],
                        ].map(
                          (p, i) =>
                            p && (
                              <span
                                key={i}
                                style={{ fontSize: "9px", color: "var(--landing-muted)", fontWeight: 700 }}
                              >
                                {p.date}
                              </span>
                            )
                        )
                      ) : (
                        <span style={{ fontSize: "9px", color: "var(--landing-muted)" }}>no data</span>
                      )}
                    </div>
                  </div>
                  {/* Y-axis value labels (right side) */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      borderTop: "1px solid var(--landing-line)",
                    }}
                  >
                    {[maxNav, (maxNav * 2 + minNav) / 3, (maxNav + minNav * 2) / 3, minNav].map(
                      (v, i) => (
                        <div
                          key={i}
                          style={{
                            padding: "8px 12px",
                            borderRight:
                              i < 3 ? "1px solid var(--landing-line)" : "none",
                            background: "var(--landing-surface)",
                            fontSize: "9px",
                            fontWeight: 700,
                            color: "var(--landing-muted)",
                          }}
                        >
                          {fmtINR(v)}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* ── Heatmap + Trade Activity ──────────────────────────── */}
              <div
                className="arena-stat-grid arena-stat-grid--2"
                style={{
                  gap: "24px",
                  marginBottom: "32px",
                }}
              >
                {/* Monthly Returns Heatmap */}
                <div>
                  <h2
                    style={{
                      fontFamily: "IBM Plex Sans, sans-serif",
                      fontSize: "13px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      marginBottom: "12px",
                      margin: "0 0 12px",
                    }}
                  >
                    Monthly Returns Heatmap
                  </h2>
                  <div className="landing-dashboard" style={{ padding: "16px 20px 20px" }}>
                    {allMonths.length === 0 ? (
                      <div className="landing-leaderboard__empty" style={{ minHeight: "120px" }}>
                        No monthly return data yet
                      </div>
                    ) : (
                      <>
                        {/* Month header row */}
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: HEATMAP_COLS,
                            gap: "4px",
                            marginBottom: "6px",
                          }}
                        >
                          <div />
                          {allMonths.map((m) => (
                            <div
                              key={m}
                              style={{
                                fontSize: "8px",
                                fontWeight: 700,
                                color: "var(--landing-muted)",
                                textAlign: "center",
                                padding: "2px 0",
                              }}
                            >
                              {fmtMonthLabel(m)}
                            </div>
                          ))}
                        </div>

                        {/* Model rows */}
                        {models.map((model, mi) => (
                          <div
                            key={model.modelId}
                            style={{
                              display: "grid",
                              gridTemplateColumns: HEATMAP_COLS,
                              gap: "4px",
                              marginBottom: "4px",
                              alignItems: "center",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "10px",
                                fontWeight: 700,
                                paddingRight: "8px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 8,
                                  height: 8,
                                  background: MODEL_COLORS[mi % MODEL_COLORS.length],
                                  border: "1px solid var(--landing-line)",
                                  flexShrink: 0,
                                }}
                              />
                              {model.name}
                            </div>
                            {allMonths.map((month) => {
                              const pnl = monthlyByModel[mi]?.get(month) ?? 0;
                              const { bg, fg } = heatCell(pnl);
                              const ret = pnl / STARTING_CAPITAL;
                              return (
                                <div
                                  key={month}
                                  title={`${model.name} · ${fmtMonthLabel(month)}: ${fmtPct(ret)}`}
                                  style={{
                                    background: bg,
                                    color: fg,
                                    fontSize: "8px",
                                    fontWeight: 700,
                                    textAlign: "center",
                                    padding: "7px 2px",
                                    border: "1px solid rgba(0,0,0,0.12)",
                                    cursor: "default",
                                    lineHeight: 1,
                                  }}
                                >
                                  {pnl !== 0 ? fmtPct(Math.abs(ret), false) : "—"}
                                </div>
                              );
                            })}
                          </div>
                        ))}

                        {/* Color legend */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginTop: "14px",
                          }}
                        >
                          <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--landing-muted)" }}>
                            LOSS
                          </span>
                          {[-0.04, -0.02, 0, 0.02, 0.04].map((v) => {
                            const { bg } = heatCell(v * STARTING_CAPITAL);
                            return (
                              <div
                                key={v}
                                style={{
                                  width: 20,
                                  height: 12,
                                  background: bg,
                                  border: "1px solid rgba(0,0,0,0.12)",
                                }}
                              />
                            );
                          })}
                          <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--landing-muted)" }}>
                            GAIN
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Daily Trade Activity */}
                <div>
                  <h2
                    style={{
                      fontFamily: "IBM Plex Sans, sans-serif",
                      fontSize: "13px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      margin: "0 0 12px",
                    }}
                  >
                    Daily Trade Activity
                  </h2>
                  <div className="landing-dashboard" style={{ padding: "20px" }}>
                    {tradesDays.length === 0 ? (
                      <div className="landing-leaderboard__empty" style={{ minHeight: "120px" }}>
                        No trade activity data yet
                      </div>
                    ) : (
                      <>
                        {/* Bar chart */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-end",
                            gap: "3px",
                            height: "140px",
                            padding: "0 0 4px",
                            borderBottom: "1px solid var(--landing-line)",
                            marginBottom: "6px",
                          }}
                        >
                          {tradesDays.map(([date, count]) => {
                            const h = Math.max((count / maxDaily) * 120, 3);
                            return (
                              <div
                                key={date}
                                title={`${date}: ${count} trade${count !== 1 ? "s" : ""}`}
                                style={{
                                  flex: "1 1 0",
                                  minWidth: "3px",
                                  height: `${h}px`,
                                  background: "var(--landing-line)",
                                  cursor: "default",
                                }}
                              />
                            );
                          })}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "16px",
                          }}
                        >
                          <span style={{ fontSize: "9px", color: "var(--landing-muted)", fontWeight: 700 }}>
                            {tradesDays[0]?.[0]}
                          </span>
                          <span style={{ fontSize: "9px", color: "var(--landing-muted)", fontWeight: 700 }}>
                            {tradesDays[tradesDays.length - 1]?.[0]}
                          </span>
                        </div>

                        {/* Quick stats */}
                        <div className="arena-stat-grid arena-stat-grid--3" style={{ gap: "12px" }}>
                          {[
                            { label: "TOTAL TRADES", value: String(totalTrades) },
                            { label: "ACTIVE DAYS", value: String(tradesDays.length) },
                            {
                              label: "AVG / DAY",
                              value: (totalTrades / Math.max(tradesDays.length, 1)).toFixed(1),
                            },
                          ].map(({ label, value }) => (
                            <div key={label} className="landing-terminal__stat" style={{ padding: "12px" }}>
                              <span>{label}</span>
                              <strong style={{ fontSize: "18px" }}>{value}</strong>
                            </div>
                          ))}
                        </div>

                        {/* Per-model breakdown */}
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          {models.map((m, i) => {
                            const cnt = (tradesMap.get(m.modelId) ?? []).length;
                            const pct = totalTrades > 0 ? (cnt / totalTrades) * 100 : 0;
                            return (
                              <div key={m.modelId} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    width: "80px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                  }}
                                >
                                  {m.name}
                                </span>
                                <div
                                  style={{
                                    flex: 1,
                                    background: "var(--landing-surface-high)",
                                    height: "10px",
                                    position: "relative",
                                  }}
                                >
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: 0,
                                      top: 0,
                                      height: "100%",
                                      width: `${pct}%`,
                                      background: MODEL_STROKE[i % MODEL_STROKE.length],
                                      opacity: 0.85,
                                    }}
                                  />
                                </div>
                                <span
                                  style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    color: "var(--landing-muted)",
                                    width: "28px",
                                    textAlign: "right",
                                    flexShrink: 0,
                                  }}
                                >
                                  {cnt}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Model Performance Comparison ───────────────────────── */}
              <div style={{ marginBottom: "32px" }}>
                <h2
                  style={{
                    fontFamily: "IBM Plex Sans, sans-serif",
                    fontSize: "13px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    margin: "0 0 12px",
                  }}
                >
                  Model Performance Breakdown
                </h2>
                <div className="landing-dashboard" style={{ padding: "24px" }}>
                  {leaderboard.length === 0 ? (
                    <div className="landing-leaderboard__empty">No leaderboard data yet</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                      {(
                        [
                          {
                            label: "TOTAL RETURN",
                            get: (e: LeaderboardEntry) => e.totalReturn,
                            fmt: (v: number) => fmtPct(v),
                            scale: 0.25,
                            negative: false,
                          },
                          {
                            label: "MAX DRAWDOWN",
                            get: (e: LeaderboardEntry) => e.maxDrawdown,
                            fmt: (v: number) => fmtPct(v, false),
                            scale: 0.2,
                            negative: true,
                          },
                          {
                            label: "SCORE",
                            get: (e: LeaderboardEntry) => e.score,
                            fmt: (v: number) => v.toFixed(4),
                            scale: 0.2,
                            negative: false,
                          },
                          {
                            label: "TURNOVER COST",
                            get: (e: LeaderboardEntry) => e.turnoverCost,
                            fmt: (v: number) => fmtPct(v, false),
                            scale: 0.05,
                            negative: true,
                          },
                        ] as {
                          label: string;
                          get: (e: LeaderboardEntry) => number;
                          fmt: (v: number) => string;
                          scale: number;
                          negative: boolean;
                        }[]
                      ).map(({ label, get, fmt, scale, negative }) => (
                        <div key={label}>
                          <div
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "var(--landing-muted)",
                              marginBottom: "10px",
                              textTransform: "uppercase",
                            }}
                          >
                            {label}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {leaderboard.map((entry, i) => {
                              const val = get(entry);
                              const pct = Math.min((Math.abs(val) / scale) * 100, 100);
                              const isPos = !negative && val >= 0;
                              const barColor = negative
                                ? "var(--accent-red)"
                                : isPos
                                ? "var(--accent-green)"
                                : "var(--accent-red)";
                              return (
                                <div
                                  key={entry.modelId}
                                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      width: "100px",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <i
                                      style={{
                                        display: "inline-block",
                                        width: 8,
                                        height: 8,
                                        background: MODEL_COLORS[i % MODEL_COLORS.length],
                                        border: "1px solid var(--landing-line)",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {entry.name}
                                    </span>
                                  </div>
                                  <div
                                    style={{
                                      flex: 1,
                                      background: "var(--landing-surface-container)",
                                      height: "22px",
                                      position: "relative",
                                      border: "1px solid var(--landing-surface-high)",
                                    }}
                                  >
                                    <div
                                      style={{
                                        position: "absolute",
                                        left: 0,
                                        top: 0,
                                        height: "100%",
                                        width: `${pct}%`,
                                        background: barColor,
                                        opacity: 0.82,
                                        transition: "width 0.3s ease",
                                      }}
                                    />
                                    <span
                                      style={{
                                        position: "absolute",
                                        left: `${Math.min(pct + 1, 88)}%`,
                                        top: "50%",
                                        transform: "translateY(-50%)",
                                        fontSize: "10px",
                                        fontWeight: 800,
                                        color: "var(--landing-line)",
                                        whiteSpace: "nowrap",
                                        mixBlendMode: "multiply",
                                      }}
                                    >
                                      {fmt(val)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Drawdown Chart ─────────────────────────────────────── */}
              <div style={{ marginBottom: "32px" }}>
                <h2
                  style={{
                    fontFamily: "IBM Plex Sans, sans-serif",
                    fontSize: "13px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    margin: "0 0 12px",
                  }}
                >
                  Drawdown (Underwater Equity)
                </h2>
                <div className="landing-dashboard">
                  <div className="landing-dashboard__chart" style={{ padding: 0, minHeight: "200px" }}>
                    <svg
                      viewBox="0 0 1000 200"
                      preserveAspectRatio="none"
                      style={{ display: "block", width: "100%", minHeight: "200px" }}
                    >
                      {/* Zero line at y=10 */}
                      <line
                        x1="0"
                        y1="10"
                        x2="1000"
                        y2="10"
                        stroke="#888"
                        strokeWidth="1.5"
                      />
                      {ddPaths.map((pathD, i) => {
                        if (!pathD) return null;
                        const stroke = MODEL_STROKE[i % MODEL_STROKE.length];
                        const fillD = `${pathD} L 1000 10 L 0 10 Z`;
                        return (
                          <g key={models[i].modelId}>
                            <path
                              d={fillD}
                              style={{
                                fill: stroke,
                                fillOpacity: 0.1,
                                stroke: "none",
                              }}
                            />
                            <path
                              d={pathD}
                              style={{
                                stroke,
                                strokeWidth: 2,
                                fill: "none",
                                strokeLinejoin: "round",
                              }}
                            />
                          </g>
                        );
                      })}
                    </svg>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 12px 10px",
                        borderTop: "1px solid var(--landing-surface-high)",
                      }}
                    >
                      <span style={{ fontSize: "9px", color: "var(--landing-muted)", fontWeight: 700 }}>
                        0% drawdown (peak)
                      </span>
                      <span style={{ fontSize: "9px", color: "var(--accent-red)", fontWeight: 700 }}>
                        ▼ max drawdown depth
                      </span>
                    </div>
                  </div>
                  {/* Drawdown stats per model */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(${Math.max(models.length, 1)}, 1fr)`,
                      borderTop: "1px solid var(--landing-line)",
                    }}
                  >
                    {leaderboard.map((entry, i) => (
                      <div
                        key={entry.modelId}
                        style={{
                          padding: "12px 16px",
                          borderRight:
                            i < leaderboard.length - 1
                              ? "1px solid var(--landing-line)"
                              : "none",
                          background: "var(--landing-surface)",
                        }}
                      >
                        <div style={{ fontSize: "9px", fontWeight: 700, color: "var(--landing-muted)", marginBottom: "4px" }}>
                          {entry.name}
                        </div>
                        <div
                          style={{
                            fontSize: "16px",
                            fontWeight: 800,
                            color: "var(--accent-red)",
                          }}
                        >
                          {fmtPct(entry.maxDrawdown, false)}
                        </div>
                        <div style={{ fontSize: "9px", color: "var(--landing-muted)", marginTop: "2px" }}>
                          max drawdown
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Win/Loss + Rankings ────────────────────────────────── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "24px",
                  marginBottom: "32px",
                }}
              >
                {/* Win/Loss Summary */}
                <div>
                  <h2
                    style={{
                      fontFamily: "IBM Plex Sans, sans-serif",
                      fontSize: "13px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      margin: "0 0 12px",
                    }}
                  >
                    Win / Loss Summary
                  </h2>
                  <div className="landing-dashboard" style={{ padding: "20px 24px" }}>
                    {models.map((m, i) => {
                      const { wins, losses, closed: total, wr } = winStats[i];
                      const state = statesMap.get(m.modelId);
                      const pnl = state ? state.nav - STARTING_CAPITAL : 0;
                      return (
                        <div
                          key={m.modelId}
                          style={{ marginBottom: i < models.length - 1 ? "24px" : 0 }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-end",
                              marginBottom: "6px",
                            }}
                          >
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              <i
                                style={{
                                  display: "inline-block",
                                  width: 8,
                                  height: 8,
                                  background: MODEL_COLORS[i % MODEL_COLORS.length],
                                  border: "1px solid var(--landing-line)",
                                }}
                              />
                              {m.name}
                            </span>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 800,
                                color:
                                  wr >= 0.5
                                    ? "var(--accent-green)"
                                    : "var(--accent-red)",
                              }}
                            >
                              {total > 0 ? `${(wr * 100).toFixed(0)}% win` : "—"}
                            </span>
                          </div>
                          {total > 0 ? (
                            <>
                              <div
                                style={{
                                  height: "14px",
                                  display: "flex",
                                  border: "1px solid var(--landing-line)",
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${wr * 100}%`,
                                    background: "var(--accent-green)",
                                    height: "100%",
                                  }}
                                />
                                <div
                                  style={{
                                    flex: 1,
                                    background: "var(--accent-red)",
                                    height: "100%",
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  marginTop: "4px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    color: "var(--accent-green)",
                                  }}
                                >
                                  {wins} wins
                                </span>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    color: "var(--landing-muted)",
                                  }}
                                >
                                  {total} closed &nbsp;|&nbsp;{" "}
                                  <span
                                    style={{
                                      color:
                                        pnl >= 0
                                          ? "var(--accent-green)"
                                          : "var(--accent-red)",
                                    }}
                                  >
                                    {pnl >= 0 ? "+" : ""}
                                    {fmtINR(pnl)} P&L
                                  </span>
                                </span>
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: 700,
                                    color: "var(--accent-red)",
                                  }}
                                >
                                  {losses} losses
                                </span>
                              </div>
                            </>
                          ) : (
                            <div
                              style={{
                                fontSize: "10px",
                                color: "var(--landing-muted)",
                                padding: "8px 0",
                              }}
                            >
                              No closed trades yet
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Rankings */}
                <div>
                  <h2
                    style={{
                      fontFamily: "IBM Plex Sans, sans-serif",
                      fontSize: "13px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      margin: "0 0 12px",
                    }}
                  >
                    Live Rankings
                  </h2>
                  <div className="landing-dashboard" style={{ padding: 0 }}>
                    <div
                      className="landing-leaderboard__head"
                      style={{
                        gridTemplateColumns: "28px 2fr 1fr 1fr 1fr",
                        padding: "0 16px",
                      }}
                    >
                      <span>#</span>
                      <span>MODEL</span>
                      <span style={{ textAlign: "right" }}>RETURN</span>
                      <span style={{ textAlign: "right" }}>DRAWDOWN</span>
                      <span style={{ textAlign: "right" }}>SCORE</span>
                    </div>
                    <div
                      className="landing-leaderboard"
                      style={{
                        minHeight: "auto",
                        border: 0,
                        borderTop: "1px solid var(--landing-line)",
                      }}
                    >
                      {leaderboard.length === 0 ? (
                        <div className="landing-leaderboard__empty">
                          No rankings yet
                        </div>
                      ) : (
                        leaderboard.map((entry, i) => (
                          <div
                            key={entry.modelId}
                            className="landing-leaderboard__row"
                            style={{
                              gridTemplateColumns: "28px 2fr 1fr 1fr 1fr",
                              padding: "0 16px",
                            }}
                          >
                            <span style={{ fontWeight: 800 }}>{entry.rank}</span>
                            <strong style={{ justifyContent: "flex-start" }}>
                              <i
                                style={{
                                  background: MODEL_COLORS[i % MODEL_COLORS.length],
                                  border: "1px solid var(--landing-line)",
                                }}
                              />
                              {entry.name}
                            </strong>
                            <span
                              style={{
                                textAlign: "right",
                                fontWeight: 700,
                                color:
                                  entry.totalReturn >= 0
                                    ? "var(--accent-green)"
                                    : "var(--accent-red)",
                              }}
                            >
                              {fmtPct(entry.totalReturn)}
                            </span>
                            <span
                              style={{
                                textAlign: "right",
                                fontWeight: 700,
                                color: "var(--accent-red)",
                              }}
                            >
                              {fmtPct(entry.maxDrawdown, false)}
                            </span>
                            <span
                              style={{
                                textAlign: "right",
                                fontWeight: 800,
                                color:
                                  entry.score >= 0
                                    ? "var(--accent-green)"
                                    : "var(--accent-red)",
                              }}
                            >
                              {entry.score >= 0 ? "+" : ""}
                              {entry.score.toFixed(4)}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Scoring formula */}
                    <div
                      style={{
                        borderTop: "1px solid var(--landing-line)",
                        padding: "12px 16px",
                        background: "var(--landing-surface-low)",
                        fontSize: "10px",
                        color: "var(--landing-muted)",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>FORMULA: </span>
                      <code>score = return − 0.5×drawdown − 0.1×cost</code>
                    </div>
                  </div>

                  <Link
                    href="/leaderboard"
                    className="landing-button"
                    style={{ display: "flex", justifyContent: "center", marginTop: "12px" }}
                  >
                    FULL LEADERBOARD →
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
