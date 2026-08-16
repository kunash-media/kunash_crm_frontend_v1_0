import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, LineChart, Line, Legend,
} from "recharts";
import "./Reports.css";

const API_BASE = "http://localhost:9090/api/lead/v1/reports";

const GRANULARITIES = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-Yearly" },
  { value: "YEARLY", label: "Annually" },
];

// Consistent color per bucket name so bar + trend colors line up
const BUCKET_COLORS = [
  "#f97316", "#ea580c", "#c2410c", "#fb923c", "#fdba74",
  "#ef4444", "#dc2626", "#f59e0b", "#d97706", "#9a3412",
];
function colorForBucket(name, index) {
  if (name === "Unclassified") return "#b07850";
  return BUCKET_COLORS[index % BUCKET_COLORS.length];
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-lbl">{label}</div>
      {payload.map((p) => (
        <div className="chart-tip-row" key={p.dataKey || p.name}>
          <span className="chart-tip-dot" style={{ background: p.color || p.fill }} />
          <span>{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
}

const Reports = () => {
  const [outcome, setOutcome] = useState("lost"); // "lost" | "won"
  const [granularity, setGranularity] = useState("MONTHLY");
  const [source, setSource] = useState("");
  const [staffPrimeId, setStaffPrimeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [report, setReport] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (source.trim()) params.set("source", source.trim());
      if (staffPrimeId.trim()) params.set("staffPrimeId", staffPrimeId.trim());
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      params.set("granularity", granularity);

      const endpoint = outcome === "lost" ? "lost-reasons" : "won-reasons";
      const res = await fetch(`${API_BASE}/${endpoint}?${params.toString()}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = await res.json();
      setReport(data);
    } catch (err) {
      setError(err.message || "Failed to load report");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [outcome, granularity, source, staffPrimeId, fromDate, toDate]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    fetch(`${API_BASE}/buckets`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setBuckets)
      .catch(() => setBuckets([]));
  }, []);

  const resetFilters = () => {
    setSource("");
    setStaffPrimeId("");
    setFromDate("");
    setToDate("");
    setGranularity("MONTHLY");
  };

  const filtersActive = source || staffPrimeId || fromDate || toDate || granularity !== "MONTHLY";

  const barData = useMemo(() => {
    if (!report) return [];
    return report.bucketBreakdown.map((b) => ({ name: b.bucketName, count: b.count }));
  }, [report]);

  // Reshape trend[] (periodLabel + bucketCounts map) into recharts-friendly rows,
  // one row per period, one column per bucket.
  const { trendData, trendBucketNames } = useMemo(() => {
    if (!report || !report.trend || !report.trend.length) {
      return { trendData: [], trendBucketNames: [] };
    }
    const bucketNameSet = new Set();
    report.trend.forEach((t) => Object.keys(t.bucketCounts || {}).forEach((k) => bucketNameSet.add(k)));
    const names = Array.from(bucketNameSet);

    const rows = report.trend.map((t) => {
      const row = { period: t.periodLabel };
      names.forEach((n) => { row[n] = t.bucketCounts?.[n] ?? 0; });
      return row;
    });
    return { trendData: rows, trendBucketNames: names };
  }, [report]);

  const topBucket = barData.length ? barData[0] : null;
  const totalMatched = barData.reduce((sum, b) => sum + b.count, 0);
  const relevantBuckets = buckets.filter(
    (b) => b.active && (b.applicableTo === outcome.toUpperCase() || b.applicableTo === "BOTH")
  );

  return (
    <div className="reports-root">
      <div className="reports-header">
        <div>
          <div className="reports-title">Reason Insights</div>
          <div className="reports-sub">
            Why leads are {outcome === "lost" ? "lost" : "won"} — parsed from{" "}
            {outcome === "lost" ? "lost-reason text" : "notes & follow-up history"}, no LLM required.
          </div>
        </div>
        <div className="reports-toggle">
          <button
            className={`reports-toggle-btn ${outcome === "lost" ? "active-lost" : ""}`}
            onClick={() => setOutcome("lost")}
          >
            Lost Leads
          </button>
          <button
            className={`reports-toggle-btn ${outcome === "won" ? "active-won" : ""}`}
            onClick={() => setOutcome("won")}
          >
            Won Leads
          </button>
        </div>
      </div>

      <div className="reports-filters">
        <div className="rf-field">
          <label>Source</label>
          <input
            type="text"
            placeholder="e.g. Facebook"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>
        <div className="rf-field">
          <label>Staff ID</label>
          <input
            type="text"
            placeholder="e.g. 3"
            value={staffPrimeId}
            onChange={(e) => setStaffPrimeId(e.target.value)}
          />
        </div>
        <div className="rf-field">
          <label>From</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="rf-field">
          <label>To</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="rf-field" style={{ minWidth: 260 }}>
          <label>Trend Granularity</label>
          <div className="rf-granularity">
            {GRANULARITIES.map((g) => (
              <button
                key={g.value}
                className={`rf-gran-btn ${granularity === g.value ? "active" : ""}`}
                onClick={() => setGranularity(g.value)}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <button className="rf-reset" onClick={resetFilters} disabled={!filtersActive}>
          Reset Filters
        </button>
      </div>

      <div className="reports-stats">
        <div className="rstat-card">
          <div className="rstat-icon">📋</div>
          <div className="rstat-info">
            <div className="rstat-value">{report?.totalRecords ?? 0}</div>
            <div className="rstat-label">Total {outcome === "lost" ? "Lost" : "Won"} Leads</div>
          </div>
        </div>
        <div className="rstat-card">
          <div className="rstat-icon">🏆</div>
          <div className="rstat-info">
            <div className="rstat-value">{topBucket ? topBucket.count : "—"}</div>
            <div className="rstat-label">Top Reason: {topBucket ? topBucket.name : "N/A"}</div>
          </div>
        </div>
        <div className="rstat-card">
          <div className="rstat-icon">🗂️</div>
          <div className="rstat-info">
            <div className="rstat-value">{barData.length}</div>
            <div className="rstat-label">Distinct Reason Buckets</div>
          </div>
        </div>
        <div className="rstat-card">
          <div className="rstat-icon">🔎</div>
          <div className="rstat-info">
            <div className="rstat-value">{totalMatched}</div>
            <div className="rstat-label">Total Bucket Matches</div>
          </div>
        </div>
      </div>

      <div className="reports-charts-row">
        <div className="report-chart-card">
          <div className="report-chart-title">Reason Breakdown</div>
          <div className="report-chart-sub">
            {outcome === "lost" ? "Why leads are being lost" : "What's driving conversions"}
          </div>
          {loading ? (
            <div className="reports-loading">
              <span className="reports-spin">⏳</span> Loading...
            </div>
          ) : error ? (
            <div className="reports-empty"><p>{error}</p></div>
          ) : barData.length === 0 ? (
            <div className="reports-empty"><p>No data for the selected filters.</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(234,88,12,0.12)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#7c4520" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: "#1c0d03", fontWeight: 600 }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {barData.map((entry, i) => (
                    <Cell key={entry.name} fill={colorForBucket(entry.name, i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="report-chart-card">
          <div className="report-chart-title">Trend Over Time</div>
          <div className="report-chart-sub">
            Bucket counts by {GRANULARITIES.find((g) => g.value === granularity)?.label.toLowerCase()} period
          </div>
          {loading ? (
            <div className="reports-loading">
              <span className="reports-spin">⏳</span> Loading...
            </div>
          ) : trendData.length === 0 ? (
            <div className="reports-empty"><p>No trend data for the selected filters.</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData} margin={{ left: 4, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(234,88,12,0.12)" />
                <XAxis dataKey="period" tick={{ fontSize: 10.5, fill: "#7c4520" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7c4520" }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {trendBucketNames.map((name, i) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={colorForBucket(name, i)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {relevantBuckets.length > 0 && (
        <div className="report-chart-card">
          <div className="report-chart-title">Active Reason Buckets</div>
          <div className="report-chart-sub">Editable keyword dictionary — update via backend, no redeploy needed</div>
          <div className="bucket-chip-list">
            {relevantBuckets.map((b) => (
              <span className="bucket-chip" key={b.bucketPrimeId}>{b.bucketName}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;