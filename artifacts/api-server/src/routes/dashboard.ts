import { Router, type IRouter } from "express";
import { and, asc, gte, lte } from "drizzle-orm";
import { db, webspecsRollups, type WebSpecsRollup } from "@workspace/db";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

type VisitorCategory = WebSpecsRollup["category"];

const require = createRequire(import.meta.url);
const chartJsPath = path.resolve(
  path.dirname(require.resolve("chart.js")),
  "chart.umd.min.js",
);
const chartJs = readFileSync(chartJsPath, "utf8").replace(
  /\n\/\/# sourceMappingURL=.*$/,
  "",
);

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_HOURS = 24;
const MAX_HOURS = 24 * 31;

const dashboardCategories: Array<{
  key: VisitorCategory;
  label: string;
  color: string;
}> = [
  { key: "human", label: "Human", color: "#38bdf8" },
  {
    key: "training_crawler",
    label: "Training crawler",
    color: "#a78bfa",
  },
  { key: "agent_fetch", label: "Agent fetch", color: "#fbbf24" },
  { key: "unidentified_bot", label: "Unidentified bot", color: "#94a3b8" },
  {
    key: "suspicious_spoofed",
    label: "Suspicious / spoofed",
    color: "#fb7185",
  },
];

function parseHours(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return DEFAULT_HOURS;
  }

  return Math.min(Math.max(Number(value), 1), MAX_HOURS);
}

function startOfHour(value: Date): Date {
  const hour = new Date(value);
  hour.setUTCMinutes(0, 0, 0);
  return hour;
}

function formatBucket(value: Date): string {
  return value.toISOString();
}

type DashboardBucket = {
  bucketStart: string;
  counts: Record<VisitorCategory, number>;
};

function buildBuckets(
  rows: WebSpecsRollup[],
  hours: number,
  now = new Date(),
): DashboardBucket[] {
  const end = startOfHour(now);
  const start = new Date(end.getTime() - (hours - 1) * HOUR_MS);
  const buckets = new Map<string, DashboardBucket>();

  for (let index = 0; index < hours; index += 1) {
    const bucketStart = new Date(start.getTime() + index * HOUR_MS);
    const counts = Object.fromEntries(
      dashboardCategories.map(({ key }) => [key, 0]),
    ) as Record<VisitorCategory, number>;
    buckets.set(formatBucket(bucketStart), {
      bucketStart: formatBucket(bucketStart),
      counts,
    });
  }

  for (const row of rows) {
    const bucketStart = new Date(row.bucketStart);
    const bucket = buckets.get(formatBucket(bucketStart));
    if (bucket) {
      bucket.counts[row.category] += row.requestCount;
    }
  }

  return [...buckets.values()];
}

function escapeForScript(value: string): string {
  return value.replace(/</g, "\\u003c");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInstallConfig(baseUrl: string) {
  const snippetUrl = `${baseUrl}/snippet.js`;
  const serverCode = `import { createWebSpecsMiddleware } from "@workspace/webspecs-middleware";

app.use(
  createWebSpecsMiddleware({
    store: { insert: (event) => myEventStore.insert(event) },
    hashSalt: process.env.WEBSPECS_HASH_SALT!,
  }),
);`;
  const browserCode = `<!-- Render the request ID from res.locals.webSpecsRequestId -->
<meta name="webspecs-request-id" content="{{webSpecsRequestId}}">
<script async src="${snippetUrl}"></script>`;

  return {
    snippetUrl,
    serverCode,
    browserCode,
    allCode: `${serverCode}

${browserCode}`,
  };
}

function renderDashboard(baseUrl: string): string {
  const install = buildInstallConfig(baseUrl);
  const config = escapeForScript(
    JSON.stringify({
      dataUrl: `${baseUrl}/dashboard/data`,
      chartUrl: `${baseUrl}/dashboard/chart.js`,
      install,
    }),
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Local WebSpecs traffic dashboard">
    <title>WebSpecs · Local traffic</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #07111f;
        --panel: #0d1b2e;
        --panel-strong: #12253d;
        --line: #203751;
        --text: #e5edf7;
        --muted: #91a4ba;
        --accent: #38bdf8;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at 85% -20%, #12385a 0, transparent 42%), var(--bg);
        color: var(--text);
      }
      main { max-width: 1180px; margin: 0 auto; padding: 48px 24px 64px; }
      header { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 34px; }
      .eyebrow { margin: 0 0 10px; color: var(--accent); font-size: 12px; font-weight: 700; letter-spacing: .15em; text-transform: uppercase; }
      h1 { margin: 0; font-size: clamp(30px, 5vw, 46px); letter-spacing: -.04em; line-height: 1; }
      .subtitle { margin: 12px 0 0; color: var(--muted); font-size: 15px; }
      .actions { display: flex; align-items: center; gap: 10px; }
      select, button {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        color: var(--text);
        min-height: 40px;
        padding: 0 13px;
        font: inherit;
      }
      button { cursor: pointer; background: var(--accent); border-color: var(--accent); color: #052034; font-weight: 700; }
      button:hover { filter: brightness(1.08); }
      button:disabled { cursor: wait; opacity: .6; }
      .cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 20px; }
      .card, .chart-panel, .table-panel { border: 1px solid var(--line); border-radius: 14px; background: rgba(13, 27, 46, .9); box-shadow: 0 18px 50px rgba(0, 0, 0, .14); }
      .card { padding: 20px; }
      .card-label { color: var(--muted); font-size: 13px; }
      .card-value { margin-top: 10px; font-size: 30px; font-variant-numeric: tabular-nums; letter-spacing: -.04em; }
      .card-note { margin-top: 6px; color: var(--muted); font-size: 12px; }
      .chart-panel { padding: 22px 22px 16px; }
      .panel-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 20px; }
      h2 { margin: 0; font-size: 17px; letter-spacing: -.01em; }
      .panel-meta { color: var(--muted); font-size: 12px; text-align: right; }
      .chart-wrap { position: relative; height: 380px; }
      .install-panel { margin-bottom: 20px; border: 1px solid rgba(56, 189, 248, .35); border-radius: 14px; background: linear-gradient(135deg, rgba(18, 55, 86, .92), rgba(13, 27, 46, .94)); padding: 22px; }
      .install-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
      .install-heading .subtitle { max-width: 680px; }
      .install-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .code-card { overflow: hidden; border: 1px solid var(--line); border-radius: 10px; background: rgba(7, 17, 31, .7); }
      .code-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--line); }
      .code-card-title { color: var(--text); font-size: 13px; font-weight: 700; }
      .copy-button { min-height: 34px; padding: 0 10px; border-radius: 7px; background: transparent; color: var(--accent); border-color: rgba(56, 189, 248, .5); font-size: 12px; }
      .copy-button:hover { background: rgba(56, 189, 248, .12); }
      .copy-button.is-copied { color: #bbf7d0; border-color: #4ade80; }
      pre { margin: 0; padding: 14px; overflow-x: auto; color: #c7d7e8; font: 12px/1.65 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
      .table-panel { margin-top: 20px; overflow: hidden; }
      .table-heading { padding: 20px 22px; border-bottom: 1px solid var(--line); }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { padding: 14px 22px; border-bottom: 1px solid rgba(32, 55, 81, .72); text-align: left; }
      th { color: var(--muted); font-weight: 500; }
      td:last-child, th:last-child { text-align: right; }
      tr:last-child td { border-bottom: 0; }
      .dot { display: inline-block; width: 8px; height: 8px; margin-right: 9px; border-radius: 50%; }
      .empty, .error { display: none; margin: 16px 0 0; border-radius: 9px; padding: 12px 14px; font-size: 13px; }
      .empty { background: rgba(56, 189, 248, .08); color: #a8ddf5; }
      .error { background: rgba(251, 113, 133, .1); color: #fecdd3; }
      footer { margin-top: 22px; color: var(--muted); font-size: 12px; line-height: 1.6; }
      footer strong { color: var(--text); font-weight: 600; }
      @media (max-width: 760px) {
        main { padding: 30px 16px 44px; }
        header { align-items: flex-start; flex-direction: column; }
        .actions { width: 100%; }
        select, button { flex: 1; }
        .install-heading { flex-direction: column; }
        .install-heading > button { width: 100%; }
        .install-grid { grid-template-columns: 1fr; }
        .cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .chart-wrap { height: 300px; }
        th, td { padding-left: 14px; padding-right: 14px; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="eyebrow">WebSpecs / local only</p>
          <h1>Traffic, classified.</h1>
          <p class="subtitle">Hourly request activity from this instance’s own database.</p>
        </div>
        <div class="actions">
          <label>
            <span class="sr-only" style="position:absolute;left:-10000px">Time range</span>
            <select id="hours">
              <option value="24">Last 24 hours</option>
              <option value="48">Last 48 hours</option>
              <option value="168">Last 7 days</option>
              <option value="744">Last 31 days</option>
            </select>
          </label>
          <button id="refresh" type="button">Refresh</button>
        </div>
      </header>

      <section class="install-panel" aria-labelledby="install-title">
        <div class="install-heading">
          <div>
            <p class="eyebrow">One click / one tap</p>
            <h2 id="install-title">Add WebSpecs to your site</h2>
            <p class="subtitle">Copy the server middleware and the browser tag. Both point to this local instance; there is no hosted script or data relay.</p>
          </div>
          <button class="copy-button" type="button" data-copy="all">Copy all setup</button>
        </div>
        <div class="install-grid">
          <article class="code-card">
            <div class="code-card-header">
              <span class="code-card-title">1. Server request logging</span>
              <button class="copy-button" type="button" data-copy="server">Copy</button>
            </div>
            <pre>${escapeHtml(install.serverCode)}</pre>
          </article>
          <article class="code-card">
            <div class="code-card-header">
              <span class="code-card-title">2. Browser signal</span>
              <button class="copy-button" type="button" data-copy="browser">Copy</button>
            </div>
            <pre>${escapeHtml(install.browserCode)}</pre>
          </article>
        </div>
      </section>

      <section class="cards" aria-label="Traffic totals">
        <article class="card"><div class="card-label">Total requests</div><div class="card-value" id="total">—</div><div class="card-note" id="range">Loading…</div></article>
        <article class="card"><div class="card-label">Human traffic</div><div class="card-value" id="human">—</div><div class="card-note" id="human-note">—</div></article>
        <article class="card"><div class="card-label">Crawler + agent</div><div class="card-value" id="crawlers">—</div><div class="card-note">Training crawlers and agent fetches</div></article>
        <article class="card"><div class="card-label">Suspicious / spoofed</div><div class="card-value" id="suspicious">—</div><div class="card-note">Behavioral risk threshold reached</div></article>
      </section>

      <section class="chart-panel">
        <div class="panel-heading">
          <div><h2>Requests by hour</h2><div class="subtitle">Counts use the stored hourly rollups.</div></div>
          <div class="panel-meta" id="updated">—</div>
        </div>
        <div class="chart-wrap"><canvas id="traffic-chart" aria-label="Hourly traffic chart"></canvas></div>
        <div class="empty" id="empty">No hourly rollups are available for this range yet. The dashboard is connected to this instance and will fill in as events are persisted.</div>
        <div class="error" id="error" role="alert"></div>
      </section>

      <section class="table-panel">
        <div class="table-heading"><h2>Latest hour</h2><div class="subtitle" id="latest-hour">—</div></div>
        <table>
          <thead><tr><th>Category</th><th>Requests</th></tr></thead>
          <tbody id="latest-table"></tbody>
        </table>
      </section>

      <footer><strong>Private by default.</strong> This page makes no third-party requests. Data is read from the adopter’s own WebSpecs database; IP addresses are never displayed.</footer>
    </main>
    <script>window.__WEBSPECS_DASHBOARD__ = ${config};</script>
    <script src="${baseUrl}/dashboard/chart.js"></script>
    <script>
      (() => {
        const config = window.__WEBSPECS_DASHBOARD__;
        const categories = [
          { key: "human", label: "Human", color: "#38bdf8" },
          { key: "training_crawler", label: "Training crawler", color: "#a78bfa" },
          { key: "agent_fetch", label: "Agent fetch", color: "#fbbf24" },
          { key: "unidentified_bot", label: "Unidentified bot", color: "#94a3b8" },
          { key: "suspicious_spoofed", label: "Suspicious / spoofed", color: "#fb7185" }
        ];
        let chart;
        const number = new Intl.NumberFormat();
        const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric" });
        const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
        const $ = (id) => document.getElementById(id);
        const setText = (id, value) => { $(id).textContent = value; };

         async function copyInstall(kind, button) {
           const value = config.install[kind + "Code"] || config.install.allCode;
           const original = button.textContent;
           try {
             await navigator.clipboard.writeText(value);
           } catch (_) {
             const helper = document.createElement("textarea");
             helper.value = value;
             helper.style.position = "fixed";
             helper.style.opacity = "0";
             document.body.appendChild(helper);
             helper.select();
             document.execCommand("copy");
             helper.remove();
           }
           button.textContent = "Copied";
           button.classList.add("is-copied");
           window.setTimeout(() => {
             button.textContent = original;
             button.classList.remove("is-copied");
           }, 1600);
         }

        function showError(message) {
          const error = $("error");
          error.textContent = message;
          error.style.display = "block";
        }

        function formatPercent(value, total) {
          return total === 0 ? "0%" : Math.round((value / total) * 100) + "% of requests";
        }

        function render(data) {
          const rows = data.buckets;
          const totals = Object.fromEntries(categories.map(({ key }) => [key, 0]));
          rows.forEach((row) => categories.forEach(({ key }) => { totals[key] += row.counts[key] || 0; }));
          const total = Object.values(totals).reduce((sum, value) => sum + value, 0);
          const crawlerTotal = totals.training_crawler + totals.agent_fetch;
          setText("total", number.format(total));
          setText("human", number.format(totals.human));
          setText("human-note", formatPercent(totals.human, total));
          setText("crawlers", number.format(crawlerTotal));
          setText("suspicious", number.format(totals.suspicious_spoofed));
          setText("range", data.hours + (data.hours === 1 ? " hour" : " hours"));
          setText("updated", "Updated " + fullDate.format(new Date(data.generatedAt)));
          $("empty").style.display = total === 0 ? "block" : "none";
          const labels = rows.map((row) => date.format(new Date(row.bucketStart)));
          const datasets = categories.map(({ key, label, color }) => ({
            label, data: rows.map((row) => row.counts[key] || 0), backgroundColor: color, borderColor: color, borderWidth: 0, borderRadius: 3, borderSkipped: false
          }));
          if (chart) chart.destroy();
          chart = new Chart($("traffic-chart"), {
            type: "bar",
            data: { labels, datasets },
            options: {
              responsive: true, maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              scales: {
                x: { stacked: true, grid: { display: false }, ticks: { color: "#91a4ba", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
                y: { stacked: true, beginAtZero: true, grid: { color: "rgba(145, 164, 186, .14)" }, ticks: { color: "#91a4ba", precision: 0 } }
              },
              plugins: {
                legend: { position: "bottom", labels: { color: "#e5edf7", usePointStyle: true, pointStyle: "circle", padding: 18 } },
                tooltip: { callbacks: { footer(items) { return "Total: " + number.format(items.reduce((sum, item) => sum + item.raw, 0)); } } }
              }
            }
          });

          const latest = rows[rows.length - 1];
          setText("latest-hour", latest ? fullDate.format(new Date(latest.bucketStart)) : "No data");
          $("latest-table").innerHTML = categories.map(({ key, label, color }) =>
            "<tr><td><span class='dot' style='background:" + color + "'></span>" + label + "</td><td>" + number.format(latest?.counts[key] || 0) + "</td></tr>"
          ).join("");
        }

        async function load() {
          const button = $("refresh");
          const error = $("error");
          button.disabled = true;
          error.style.display = "none";
          try {
            const response = await fetch(config.dataUrl + "?hours=" + encodeURIComponent($("hours").value), { headers: { Accept: "application/json" } });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Could not load traffic data.");
            render(data);
          } catch (cause) {
            showError(cause instanceof Error ? cause.message : "Could not load traffic data.");
          } finally {
            button.disabled = false;
          }
        }

        $("refresh").addEventListener("click", load);
        $("hours").addEventListener("change", load);
         document.querySelectorAll("[data-copy]").forEach((button) => {
           button.addEventListener("click", () => copyInstall(button.dataset.copy, button));
         });
        load();
      })();
    </script>
  </body>
</html>`;
}

const router: IRouter = Router();

router.get("/dashboard", (request, response) => {
  response.type("html").send(renderDashboard(request.baseUrl));
});

router.get("/dashboard/chart.js", (_request, response) => {
  response
    .type("application/javascript")
    .set("Cache-Control", "public, max-age=86400")
    .send(chartJs);
});

router.get("/dashboard/data", async (request, response) => {
  if (!db) {
    response.status(503).json({
      error: "Database is not configured. Set DATABASE_URL for the local dashboard.",
    });
    return;
  }

  const hours = parseHours(request.query["hours"]);
  const end = startOfHour(new Date());
  const start = new Date(end.getTime() - (hours - 1) * HOUR_MS);

  try {
    const rows = await db
      .select()
      .from(webspecsRollups)
      .where(
        and(
          gte(webspecsRollups.bucketStart, start),
          lte(webspecsRollups.bucketStart, end),
        ),
      )
      .orderBy(asc(webspecsRollups.bucketStart));

    response.json({
      generatedAt: new Date().toISOString(),
      hours,
      categories: dashboardCategories,
      buckets: buildBuckets(rows, hours),
    });
  } catch (error) {
    request.log.error({ err: error }, "Unable to read WebSpecs dashboard rollups");
    response.status(500).json({
      error: "Unable to read dashboard rollups from the local database.",
    });
  }
});

export default router;