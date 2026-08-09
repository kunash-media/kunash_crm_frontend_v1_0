import "../Dashboard/Dashboard.css";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import confetti from "canvas-confetti";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, CalendarClock, Mail, Repeat, CheckCircle2, XCircle,
  Eye, Pencil, History, CalendarPlus, Handshake, FileSpreadsheet,
  X, MessageSquareText, BellRing, CalendarCheck2, Inbox,
  FileText, FileX2, Loader2, MessageCircle, Send,
} from "lucide-react";

const API_BASE = "http://localhost:9090/api/lead/v1";
const FILE_ORIGIN = "http://localhost:9090";
const STAT_API_BASE = "http://localhost:9090/api/stat/v1";
const STAFF_API_BASE = "http://localhost:9090/api/v1/staff";

async function apiGetAbsolute(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return res.json();
}

/* ─────────────────────────────────────────────────────────────
   CONSTANTS & HELPERS
───────────────────────────────────────────────────────────── */
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const PRIORITY_CFG = {
  P1: { color: "#ef4444", bg: "rgba(239,68,68,0.13)" },
  P2: { color: "#f59e0b", bg: "rgba(245,158,11,0.13)" },
  P3: { color: "#3b82f6", bg: "rgba(59,130,246,0.13)" },
};
const STATUS_CFG = {
  hot:  { label:"Hot",  color:"#ef4444", bg:"rgba(239,68,68,0.12)"  },
  warm: { label:"Warm", color:"#f59e0b", bg:"rgba(245,158,11,0.12)" },
  cold: { label:"Cold", color:"#3b82f6", bg:"rgba(59,130,246,0.12)" },
};

const WORK_TYPE_CFG = {
  static:   { label:"Static Website"   },
  dynamic:  { label:"Dynamic Website"  },
  meta_ads: { label:"Meta Ads"         },
  campaign: { label:"Campaign Running" },
};

const REQUIREMENT_CATEGORIES = [
  "Website Design","Ecommerce Website","Dynamic Website","Landing Page",
  "Google Ads","Meta Ads","LinkedIn Marketing","SEO","Social Media Marketing",
  "Graphic Design","Software Development","Mobile App","HRMS","CRM",
  "Custom Development","Other",
];

/* Deterministic hash → dark HSL color (dummy chart use) */
const colorForKey = (key) => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue   = Math.abs(hash) % 360;
  const sat   = 55 + (Math.abs(hash >> 8) % 20);
  const light = 24 + (Math.abs(hash >> 4) % 14);
  return `hsl(${hue}, ${sat}%, ${light}%)`;
};

const BADGE_GRADIENTS = [
  "linear-gradient(135deg,#f97316,#ea580c)",
  "linear-gradient(135deg,#a855f7,#7c3aed)",
  "linear-gradient(135deg,#14b8a6,#0d9488)",
  "linear-gradient(135deg,#f43f5e,#e11d48)",
  "linear-gradient(135deg,#84cc16,#65a30d)",
  "linear-gradient(135deg,#06b6d4,#0891b2)",
];
const gradForKey = (key = "") => {
  let hash = 0;
  for (let i = 0; i < String(key).length; i++) hash = String(key).charCodeAt(i) + ((hash << 5) - hash);
  return BADGE_GRADIENTS[Math.abs(hash) % BADGE_GRADIENTS.length];
};

const pad   = (n) => String(n).padStart(2,"0");
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const keyToDate = (k) => { const [y,m,d]=k.split("-"); return new Date(+y,+m-1,+d); };

const fmtDate = (v) => {
  if (!v) return "—";
  const d = typeof v==="string" ? keyToDate(v) : v;
  return d.toLocaleDateString("en-IN",{ day:"2-digit", month:"short", year:"numeric" });
};
const fmtDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString("en-IN",{ day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
};

const today = new Date();
const rel = (offset) => {
  const d = new Date(today);
  d.setDate(d.getDate() + offset);
  return toKey(d);
};

const EMPTY_FORM = {
  firstName:"", lastName:"", email:"", phone:"", company:"",
  status:"warm", priority:"P2", notes:"", followUpDate:"", followupStatus:"pending",
  requirementCategory: REQUIREMENT_CATEGORIES[0], source:"Website", tags:"",
  assignedStaffId: "",
};

const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 10;

/* ─────────────────────────────────────────────────────────────
   DUMMY DATA — used ONLY for the stat cards + charts (kept as-is for now)
───────────────────────────────────────────────────────────── */
const DUMMY_LEADS = [
  {
    id:"d1", firstName:"Arjun", lastName:"Mehta", email:"arjun@techwave.io",
    phone:"+91 98201 33410", company:"TechWave Solutions",
    status:"hot", priority:"P1", requirementCategory:"Software Development",
    followUpDate: rel(0), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-5).toISOString(),
    workType:"meta_ads", emailSent:true, outcome:null,
  },
  {
    id:"d6", firstName:"Ananya", lastName:"Joshi", email:"ananya@healthplus.in",
    phone:"+91 91234 56789", company:"HealthPlus Clinics",
    status:"cold", priority:"P3", requirementCategory:"Dynamic Website",
    followUpDate: rel(-3), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-15).toISOString(),
    workType:"static", emailSent:false, outcome:"lost",
  },
  {
    id:"d2", firstName:"Priya", lastName:"Sharma", email:"priya@finedge.com",
    phone:"+91 99112 87654", company:"FinEdge Capital",
    status:"warm", priority:"P2", requirementCategory:"CRM",
    followUpDate: rel(2), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-3).toISOString(),
    workType:"static", emailSent:true, outcome:null,
  },
  {
    id:"d3", firstName:"Rahul", lastName:"Nair", email:"rahul.nair@cloudops.in",
    phone:"+91 90000 12345", company:"CloudOps India",
    status:"cold", priority:"P3", requirementCategory:"Google Ads",
    followUpDate: rel(5), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-10).toISOString(),
    workType:"campaign", emailSent:false, outcome:"lost",
  },
  {
    id:"d4", firstName:"Sneha", lastName:"Kulkarni", email:"sneha@growthlab.co",
    phone:"+91 87654 32100", company:"GrowthLab Agency",
    status:"hot", priority:"P1", requirementCategory:"Landing Page",
    followUpDate: rel(1), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-2).toISOString(),
    workType:"dynamic", emailSent:true, outcome:"won",
  },
  {
    id:"d5", firstName:"Vikram", lastName:"Desai", email:"vikram@nexaretail.com",
    phone:"+91 80000 99887", company:"Nexa Retail",
    status:"warm", priority:"P2", requirementCategory:"Meta Ads",
    followUpDate: rel(7), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-7).toISOString(),
    workType:"meta_ads", emailSent:true, outcome:null,
  },
  {
    id:"d7", firstName:"Karthik", lastName:"Iyer", email:"karthik@autoserv.io",
    phone:"+91 77889 11223", company:"AutoServ Logistics",
    status:"hot", priority:"P2", requirementCategory:"Software Development",
    followUpDate: rel(0), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-1).toISOString(),
    workType:"campaign", emailSent:true, outcome:"won",
  },
  {
    id:"d8", firstName:"Meera", lastName:"Pillai", email:"meera@urbanstyle.in",
    phone:"+91 90123 44556", company:"UrbanStyle Fashion",
    status:"warm", priority:"P2", requirementCategory:"SEO",
    followUpDate: rel(4), followupStatus:"pending",
    createdAt: new Date(today.getFullYear(), today.getMonth(), today.getDate()-4).toISOString(),
    workType:"static", emailSent:true, outcome:null,
  },
];

/* WhatsApp standard follow-up template — swap this later with the real/approved copy */
/* WhatsApp templates — swap these later with the real/approved copies */
const WA_TEMPLATES = {
  followup: {
    label: "Follow-up",
    build: (lead) =>
      `Hi ${lead.firstName || "there"}, this is a quick follow-up regarding your requirement for *${lead.requirementCategory || "our services"}*. ` +
      `We'd love to help you move forward — let us know a good time to connect.\n\n` +
      `Best regards,\nTeam Kunash`,
  },
  meeting_reminder: {
    label: "Meeting Reminder",
    build: (lead) =>
      `Hi ${lead.firstName || "there"}, just a friendly reminder about our upcoming meeting regarding *${lead.requirementCategory || "your requirement"}*. ` +
      `Please let us know if the scheduled time still works for you.\n\n` +
      `Best regards,\nTeam Kunash`,
  },
  payment_reminder: {
    label: "Payment Reminder",
    build: (lead) =>
      `Hi ${lead.firstName || "there"}, this is a gentle reminder regarding the pending payment for *${lead.requirementCategory || "your project"}*. ` +
      `Kindly complete the remaining payment at your earliest convenience so we can continue without delays.\n\n` +
      `Best regards,\nTeam Kunash`,
  },
};
/* build 42-cell calendar grid */
const buildGrid = (year, month) => {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const daysInPrev  = new Date(year, month,   0).getDate();
  const cells = [];
  for (let i = firstDow-1; i >= 0; i--)
    cells.push({ d: new Date(year, month-1, daysInPrev-i), out: true });
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ d: new Date(year, month, d), out: false });
  let t = 1;
  while (cells.length < 42)
    cells.push({ d: new Date(year, month+1, t++), out: true });
  return cells;
};

/* ─────────────────────────────────────────────────────────────
   API HELPERS
───────────────────────────────────────────────────────────── */
async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

async function apiSendLeadForm(path, method, payload, docFile) {
  const formData = new FormData();
  formData.append("lead", new Blob([JSON.stringify(payload)], { type: "application/json" }));
  if (docFile) formData.append("docFile", docFile);
  const res = await fetch(`${API_BASE}${path}`, { method, body: formData });
  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message || "A lead with this phone/email already exists");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ─────────────────────────────────────────────────────────────
   SMALL SHARED PIECES
───────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, Icon, accent }) => (
  <div className="stat-card">
    <div className="stat-icon" style={{ background: accent.bg, color: accent.color }}>
      <Icon size={19} strokeWidth={2.1} />
    </div>
    <div className="stat-info">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label && <p className="chart-tip-lbl">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey || p.name} className="chart-tip-row">
          <span className="chart-tip-dot" style={{ background: p.color || p.fill }} />
          {p.name}: <b>{p.value}</b>
        </p>
      ))}
    </div>
  );
};

const StatusPill = ({ status }) => (
  <span className="status-pill" style={{ color: STATUS_CFG[status]?.color, background: STATUS_CFG[status]?.bg }}>
    {STATUS_CFG[status]?.label || status || "—"}
  </span>
);
const PriorityPill = ({ priority }) => (
  <span className="status-pill" style={{ color: PRIORITY_CFG[priority]?.color, background: PRIORITY_CFG[priority]?.bg }}>
    {priority}
  </span>
);
const FollowupStatusPill = ({ status }) => (
  <span className={`fus-pill fus-${status || "pending"}`}>
    {status === "done" ? "Done" : status ? status : "Pending"}
  </span>
);

const OverlayShell = ({ onClose, className = "", children }) => {
  const ref = useRef(null);
  return (
    <div className="mo-overlay" ref={ref} onClick={(e) => e.target === ref.current && onClose()}>
      <div className={`mo-card ${className}`}>{children}</div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   CALENDAR GRID
───────────────────────────────────────────────────────────── */
const CalendarGrid = ({ year, month, leadsByDate, onDayClick }) => {
  const cells = useMemo(() => buildGrid(year, month), [year, month]);
  const todayKey = toKey(today);

  return (
    <div className="cg-wrap">
      <div className="cg-header">
        {DAY_LABELS.map((d) => <span key={d} className="cg-dow">{d}</span>)}
      </div>
      <div className="cg-body">
        {cells.map(({ d, out }, idx) => {
          const key      = toKey(d);
          const dayLeads = leadsByDate[key] || [];
          const isToday  = key === todayKey;
          const hasBlink = isToday && dayLeads.length > 0;

          return (
            <div
              key={idx}
              className={[
                "cg-cell",
                out      ? "cg-out"    : "",
                isToday  ? "cg-today"  : "",
                dayLeads.length ? "cg-has" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => dayLeads.length && onDayClick(d, dayLeads)}
            >
              <span className={`cg-num ${isToday ? "cg-num-today" : ""}`}>{d.getDate()}</span>

              {dayLeads.length > 0 && (
                <div className="cg-chips">
                  <span
                    className={`cg-badge ${hasBlink ? "cg-blink" : ""}`}
                    style={{
                      background: gradForKey(dayLeads[0].leadStrId || dayLeads[0].leadPrimeId),
                      outline: `2px solid ${PRIORITY_CFG[dayLeads[0].priority]?.color}`,
                      outlineOffset: "1px",
                    }}
                  >
                    {dayLeads.length}
                  </span>
                  {dayLeads.slice(0,2).map((l) => (
                    <div key={l.leadPrimeId} className="cg-chip" style={{
                      background:  STATUS_CFG[l.status]?.bg,
                      borderLeft: `2px solid ${STATUS_CFG[l.status]?.color}`,
                      color: STATUS_CFG[l.status]?.color,
                    }}>
                      {l.firstName}
                    </div>
                  ))}
                  {dayLeads.length > 2 && <div className="cg-chip cg-more">+{dayLeads.length-2}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ── Charts (dummy data — untouched logic) ── */
const TrendBarChart = ({ data }) => (
  <ResponsiveContainer width="100%" height={220}>
    <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="rgba(234,88,12,0.12)" />
      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#b07850", fontWeight: 600 }} axisLine={false} tickLine={false} />
      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#b07850" }} axisLine={false} tickLine={false} width={26} />
      <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(249,115,22,0.06)" }} />
      <Bar dataKey="count" name="Leads" fill="url(#barGrad)" radius={[5, 5, 0, 0]} maxBarSize={34} />
    </BarChart>
  </ResponsiveContainer>
);

const DoughnutChart = ({ counts }) => {
  const data = useMemo(() =>
    Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => ({ key, name: WORK_TYPE_CFG[key].label, value, color: colorForKey(key) })),
  [counts]);
  if (data.length === 0) return <p className="up-empty">No source data yet</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} cornerRadius={4} stroke="none">
          {data.map((d) => <Cell key={d.key} fill={d.color} />)}
        </Pie>
        <Tooltip content={<ChartTooltip />} />
        <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "#7c4520", fontWeight: 500 }} />
      </PieChart>
    </ResponsiveContainer>
  );
};

/* ─────────────────────────────────────────────────────────────
   OVERLAY: Day leads table
───────────────────────────────────────────────────────────── */
const DayLeadsOverlay = ({ date, leads, onClose, onView, onEdit, onDone, onNextFollowup, onHistory, onDoc, busyId }) => (
  <OverlayShell onClose={onClose} className="mo-wide">
    <div className="mo-head">
      <div>
        <p className="mo-sub">{fmtDate(date).toUpperCase()}</p>
        <h2 className="mo-title">Follow-ups for this day</h2>
      </div>
      <button className="mo-x" onClick={onClose}><X size={16} /></button>
    </div>
    <div className="mo-body">
      <div className="tbl-scroll">
        <table className="lead-tbl day-ov-tbl">
          <thead>
            <tr className="sticky top-0">
              <th>First Name</th><th>Last Name</th><th>Mobile</th><th>Company</th>
              <th>Requirement</th><th>Priority</th><th>Follow-up Date</th><th>Note</th>
              <th>Status</th><th className="action-th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.leadPrimeId} className={`tbl-row tbl-${l.status}`}>
                <td className="td-name">{l.firstName}</td>
                <td className="td-name">{l.lastName}</td>
                <td className="td-phone">{l.phone}</td>
                <td className="td-co">{l.company || "—"}</td>
                <td>{l.requirementCategory || "—"}</td>
                <td><PriorityPill priority={l.priority} /></td>
                <td>{fmtDate(l.followUpDate)}</td>
                <td className="td-note">{(l.notes || "—").slice(0, 40)}</td>
                <td><FollowupStatusPill status={l.followupStatus} /></td>
                <td className="action-th">
                  <ActionRow lead={l} busyId={busyId}
                    onView={onView} onEdit={onEdit} onDone={onDone}
                    onNextFollowup={onNextFollowup} onHistory={onHistory} onDoc={onDoc} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <div className="mo-foot"><button className="btn-cancel" onClick={onClose}>Close</button></div>
  </OverlayShell>
);

/* ── OVERLAY: Mark as done ── */
const DoneOverlay = ({ lead, onClose, onSubmit, saving }) => {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!note.trim()) { setErr("Please add a note before submitting"); return; }
    onSubmit(lead, note.trim());
  };
  return (
    <OverlayShell onClose={onClose}>
      <div className="mo-head">
        <div><p className="mo-sub">MARK AS DONE</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <div className="fg">
          <label>Follow-up Note *</label>
          <textarea rows={4} placeholder="What happened on this call/meeting?"
            value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} className={err ? "fe" : ""} disabled={saving} />
          {err && <span className="fe-msg">{err}</span>}
        </div>
      </div>
      <div className="mo-foot">
        <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-save btn-done" onClick={submit} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : "Submit"}
        </button>
      </div>
    </OverlayShell>
  );
};

/* ── OVERLAY: Mark as lost ── */
const LostOverlay = ({ lead, onClose, onSubmit, saving }) => {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!reason.trim()) { setErr("Please add a reason before submitting"); return; }
    onSubmit(lead, reason.trim());
  };
  return (
    <OverlayShell onClose={onClose}>
      <div className="mo-head">
        <div><p className="mo-sub">MARK AS LOST</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <div className="fg">
          <label>Lost Reason *</label>
          <textarea rows={4} placeholder="Why was this lead lost?"
            value={reason} onChange={(e) => { setReason(e.target.value); setErr(""); }} className={err ? "fe" : ""} disabled={saving} />
          {err && <span className="fe-msg">{err}</span>}
        </div>
      </div>
      <div className="mo-foot">
        <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-save btn-delete" onClick={submit} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : "Mark Lost"}
        </button>
      </div>
    </OverlayShell>
  );
};

const LostReasonOverlay = ({ lead, onClose, onRevert, saving }) => (
  <OverlayShell onClose={onClose}>
    <div className="mo-head">
      <div><p className="mo-sub">LOST REASON</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
      <button className="mo-x" onClick={onClose}><X size={16} /></button>
    </div>
    <div className="mo-body">
      <p className="vg-val vg-notes">{lead.lostReason || "No reason recorded"}</p>
    </div>
    <div className="mo-foot">
      <button className="btn-cancel" onClick={onClose} disabled={saving}>Close</button>
      <button className="btn-save" onClick={() => onRevert(lead)} disabled={saving}>
        {saving ? <Loader2 size={15} className="spin" /> : "Revert to Pipeline"}
      </button>
    </div>
  </OverlayShell>
);

/* ── OVERLAY: Assign / reassign staff ── */
const AssignStaffOverlay = ({ lead, staffList, onClose, onSubmit, saving }) => {
  const [staffId, setStaffId] = useState(lead.assignedStaffId ? String(lead.assignedStaffId) : "");

  const submit = () => {
    onSubmit(lead, staffId ? Number(staffId) : null);
  };

  return (
    <OverlayShell onClose={onClose}>
      <div className="mo-head">
        <div><p className="mo-sub">ASSIGN STAFF</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <div className="fg">
          <label>Staff Member</label>
          <select value={staffId} disabled={saving} onChange={(e) => setStaffId(e.target.value)}>
            <option value="">Unassigned</option>
            {staffList.map((s) => (
              <option key={s.staffPrimeId} value={s.staffPrimeId}>
                {s.staffFirstName} {s.staffLastName} ({s.staffRole})
              </option>
            ))}
          </select>
        </div>
        {lead.assignedStaffName && (
          <p className="doc-empty-msg" style={{ marginTop: 8 }}>
            Currently assigned: {lead.assignedStaffName}
          </p>
        )}
      </div>
      <div className="mo-foot">
        <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-save" onClick={submit} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : "Save Assignment"}
        </button>
      </div>
    </OverlayShell>
  );
};

/* ── OVERLAY: Next follow-up ── */
const NextFollowupOverlay = ({ lead, onClose, onSubmit, saving }) => {
  const [date, setDate] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    if (!date) { setErr("Pick a follow-up date"); return; }
    onSubmit(lead, date);
  };
  return (
    <OverlayShell onClose={onClose}>
      <div className="mo-head">
        <div><p className="mo-sub">NEXT FOLLOW-UP</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <div className="fg">
          <label>Next Follow-up Date *</label>
          <input type="date" value={date} className={err ? "fe" : ""} disabled={saving}
            onChange={(e) => { setDate(e.target.value); setErr(""); }} />
          {err && <span className="fe-msg">{err}</span>}
        </div>
      </div>
      <div className="mo-foot">
        <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-save" onClick={submit} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : "Submit"}
        </button>
      </div>
    </OverlayShell>
  );
};

/* ── OVERLAY: History ── */
const HistoryOverlay = ({ lead, history, loading, onClose }) => (
  <OverlayShell onClose={onClose}>
    <div className="mo-head">
      <div><p className="mo-sub">FOLLOW-UP HISTORY</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
      <button className="mo-x" onClick={onClose}><X size={16} /></button>
    </div>
    <div className="mo-body">
      {loading ? (
        <div className="hist-empty"><Loader2 size={26} className="spin" /><p>Loading history…</p></div>
      ) : (!history || history.length === 0) ? (
        <div className="hist-empty">
          <Inbox size={30} strokeWidth={1.5} />
          <p>No past follow-ups for this lead</p>
        </div>
      ) : (
        <div className="hist-list">
          {history.map((h) => (
            <div key={h.followupPrimeId} className={`hist-item hist-${h.followupStatus === "done" ? "done" : "next-followup"}`}>
              <div className="hist-icon">{h.followupStatus === "done" ? <CheckCircle2 size={14} /> : <CalendarPlus size={14} />}</div>
              <div className="hist-content">
                <div className="hist-row">
                  <span className="hist-date">{fmtDate(h.followupDate)}</span>
                  <span className="hist-tag">{h.followupStatus === "done" ? "Completed" : "Scheduled"}</span>
                </div>
                <p className="hist-note">{h.followupNotes || "—"}</p>
                <p className="hist-at">Logged {fmtDateTime(h.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    <div className="mo-foot"><button className="btn-save" onClick={onClose}>Close</button></div>
  </OverlayShell>
);

/* ── OVERLAY: read-only lead detail ── */
const LeadDetailOverlay = ({ lead, onClose, onDoc }) => (
  <OverlayShell onClose={onClose} className="mo-view">
    <div className="mo-head">
      <div><p className="mo-sub">LEAD DETAILS</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
      <button className="mo-x" onClick={onClose}><X size={16} /></button>
    </div>
    <div className="mo-body">
      <div className="vg-section">
        <p className="vg-section-title">Basic Information</p>
        <div className="vg-grid">
          <div className="vg-item"><span className="vg-lbl">First Name</span><span className="vg-val">{lead.firstName}</span></div>
          <div className="vg-item"><span className="vg-lbl">Last Name</span><span className="vg-val">{lead.lastName}</span></div>
          <div className="vg-item"><span className="vg-lbl">Email</span><span className="vg-val">{lead.email}</span></div>
          <div className="vg-item"><span className="vg-lbl">Phone</span><span className="vg-val">{lead.phone}</span></div>
          <div className="vg-item"><span className="vg-lbl">Company</span><span className="vg-val">{lead.company || "—"}</span></div>
        </div>
      </div>
      <div className="vg-section">
        <p className="vg-section-title">Lead Details</p>
        <div className="vg-grid">
          <div className="vg-item"><span className="vg-lbl">Requirement</span><span className="vg-val">{lead.requirementCategory || "—"}</span></div>
          <div className="vg-item"><span className="vg-lbl">Status</span><StatusPill status={lead.status} /></div>
          <div className="vg-item"><span className="vg-lbl">Priority</span><PriorityPill priority={lead.priority} /></div>
          <div className="vg-item"><span className="vg-lbl">Follow-up</span><span className="vg-val">{fmtDate(lead.followUpDate)}</span></div>
          <div className="vg-item"><span className="vg-lbl">Follow-up Status</span><FollowupStatusPill status={lead.followupStatus} /></div>
          
          <div className="vg-item"><span className="vg-lbl">Assigned Staff</span><span className="vg-val">{lead.assignedStaffName || "Unassigned"}</span></div>
          <div className="vg-item"><span className="vg-lbl">Created</span><span className="vg-val">{fmtDateTime(lead.createdAt)}</span></div>
        
        </div>
      </div>
      <div className="vg-section">
        <p className="vg-section-title">Document</p>
        {lead.docFileUrl ? (
          <button className="btn-save" style={{ width: "fit-content" }} onClick={() => onDoc(lead)}>
            <FileText size={14} style={{ marginRight: 6 }} /> {lead.docFileName || "View Document"}
          </button>
        ) : (
          <p className="doc-empty-msg"><FileX2 size={16} /> No document uploaded</p>
        )}
      </div>
      <div className="vg-section">
        <p className="vg-section-title">Notes</p>
        <p className="vg-val vg-notes">{lead.notes || "—"}</p>
      </div>
    </div>
    <div className="mo-foot"><button className="btn-save" onClick={onClose}>Close</button></div>
  </OverlayShell>
);

/* ── Edit / Add form (now with file upload, matching AddLead.jsx) ── */
const LeadFormModal = ({ date, lead, staffList, onClose, onSave, saving }) => {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    ...(lead ? { ...lead, assignedStaffId: lead.assignedStaffId || "" } : { followUpDate: toKey(date || today), assignedStaffId: "" }),
  }));
  
  const [errs, setErrs] = useState({});
  const [docFile, setDocFile] = useState(null);
  const [fileErr, setFileErr] = useState("");
  const [phoneCheck, setPhoneCheck] = useState({ checking: false, exists: false, checked: false, leadPrimeId: null, leadStrId: null, firstName: null, lastName: null });
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    // Skip check if editing and phone hasn't changed from the lead's own number
    if (lead && form.phone === lead.phone) {
      setPhoneCheck({ checking: false, exists: false, checked: false, leadPrimeId: null, leadStrId: null, firstName: null, lastName: null });
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      setPhoneCheck({ checking: false, exists: false, checked: false, leadPrimeId: null, leadStrId: null, firstName: null, lastName: null });
      return;
    }
    let active = true;
    setPhoneCheck((p) => ({ ...p, checking: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/check-phone?phone=${form.phone}`);
        const data = await res.json();
        if (active) setPhoneCheck({
          checking: false,
          exists: !!data.exists,
          checked: true,
          leadPrimeId: data.leadPrimeId,
          leadStrId: data.leadStrId,
          firstName: data.firstName,
          lastName: data.lastName,
        });
      } catch {
        if (active) setPhoneCheck({ checking: false, exists: false, checked: false, leadPrimeId: null, leadStrId: null, firstName: null, lastName: null });
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [form.phone, lead]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileErr(`${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit`);
      return;
    }
    setFileErr("");
    setDocFile(file);
  };

const validate = () => {
    const e = {};
    if (!form.firstName.trim()) e.firstName = "First name is required";
    if (!form.lastName.trim())  e.lastName  = "Last name is required";
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Valid email required";
    if (!/^[6-9]\d{9}$/.test((form.phone||"").replace(/\D/g,""))) e.phone = "Valid 10-digit mobile required";
if (phoneCheck.checked && phoneCheck.exists) {
      e.phone = `Already exists: ${phoneCheck.firstName || ""} ${phoneCheck.lastName || ""} (${phoneCheck.leadStrId || "ID " + phoneCheck.leadPrimeId})`;
    }
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrs(e); return; }
    onSave(form, !!lead, docFile);
  };

  return (
    <OverlayShell onClose={onClose}>
      <div className="mo-head">
        <div>
          <p className="mo-sub">{lead ? "EDIT LEAD" : fmtDate(date).toUpperCase()}</p>
          <h2 className="mo-title">{lead ? "Update Lead" : "Add New Lead"}</h2>
        </div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <div className="fg-grid">
          <div className="fg">
            <label>First Name *</label>
            <input value={form.firstName} placeholder="Arjun" className={errs.firstName ? "fe" : ""} disabled={saving} onChange={(e) => set("firstName", e.target.value)} />
            {errs.firstName && <span className="fe-msg">{errs.firstName}</span>}
          </div>
          <div className="fg">
            <label>Last Name *</label>
            <input value={form.lastName} placeholder="Mehta" className={errs.lastName ? "fe" : ""} disabled={saving} onChange={(e) => set("lastName", e.target.value)} />
            {errs.lastName && <span className="fe-msg">{errs.lastName}</span>}
          </div>
          <div className="fg">
            <label>Email *</label>
            <input type="email" value={form.email} placeholder="arjun@company.com" className={errs.email ? "fe" : ""} disabled={saving} onChange={(e) => set("email", e.target.value)} />
            {errs.email && <span className="fe-msg">{errs.email}</span>}
          </div>
          <div className="fg">
            <label>Phone *</label>
            <input type="tel" value={form.phone} maxLength={10} placeholder="9876543210" className={errs.phone ? "fe" : ""} disabled={saving}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g,"").slice(0,10))} />
            {errs.phone && <span className="fe-msg">{errs.phone}</span>}
            {!errs.phone && phoneCheck.checking && <span className="fe-msg" style={{ color: "#b07850" }}>Checking…</span>}          </div>
          <div className="fg">
            <label>Company</label>
            <input value={form.company} placeholder="Acme Corp" disabled={saving} onChange={(e) => set("company", e.target.value)} />
          </div>
          <div className="fg">
            <label>Requirement Category</label>
            <select value={form.requirementCategory} disabled={saving} onChange={(e) => set("requirementCategory", e.target.value)}>
              {REQUIREMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="fg">
            <label>Assign Staff</label>
            <select value={form.assignedStaffId} disabled={saving} onChange={(e) => set("assignedStaffId", e.target.value)}>
              <option value="">Unassigned</option>
              {(staffList || []).map((s) => (
                <option key={s.staffPrimeId} value={s.staffPrimeId}>
                  {s.staffFirstName} {s.staffLastName} ({s.staffRole})
                </option>
              ))}
            </select>
          </div>


          <div className="fg">
            <label>Status</label>
            <select value={form.status} disabled={saving} onChange={(e) => set("status", e.target.value)}>
              <option value="hot">🔥 Hot</option>
              <option value="warm">🌤 Warm</option>
              <option value="cold">❄️ Cold</option>
            </select>
          </div>
          <div className="fg">
            <label>Priority</label>
            <div className="prio-row">
              {["P1","P2","P3"].map((p) => (
                <button key={p} type="button" disabled={saving} className={`prio-btn prio-${p.toLowerCase()} ${form.priority===p?"active":""}`} onClick={() => set("priority", p)}>{p}</button>
              ))}
            </div>
          </div>
          <div className="fg fg-full">
            <label>Follow-up Date</label>
            <input type="date" value={form.followUpDate} disabled={saving} onChange={(e) => set("followUpDate", e.target.value)} />
          </div>
          <div className="fg fg-full">
            <label>Notes</label>
            <textarea rows={3} placeholder="Add context about this lead…" value={form.notes} disabled={saving} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <div className="fg fg-full">
            <label className="file-drop" htmlFor="dash-lead-attachment">
              <span className="file-drop-icon">📎 Upload file</span>
              <span className="file-drop-hint">PDF, DOC, DOCX, JPG, PNG — up to {MAX_FILE_SIZE_MB}MB</span>
            </label>
            <input
              id="dash-lead-attachment"
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileSelect}
              className="file-input-hidden"
              disabled={saving}
            />
            {fileErr && <span className="fe-msg">{fileErr}</span>}
            {docFile && (
              <div className="file-list">
                <div className="file-chip">
                  <span className="file-chip-name">{docFile.name}</span>
                  <span className="file-chip-size">{(docFile.size / 1024).toFixed(0)} KB</span>
                  <button type="button" className="file-chip-remove" onClick={() => setDocFile(null)} disabled={saving}>✕</button>
                </div>
              </div>
            )}
            {!docFile && lead?.docFileUrl && (
              <p className="doc-empty-msg" style={{ marginTop: 8 }}>
                <FileText size={14} /> Existing: {lead.docFileName || "document"} (uploading a new file will replace it)
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="mo-foot">
        <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-save" onClick={submit} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : (lead ? "Update Lead" : "Save Lead")}
        </button>
      </div>
    </OverlayShell>
  );
};

/* ── OVERLAY: Convert ── */
const ConvertOverlay = ({ lead, onClose, onConfirm, saving }) => {
  const [totalAmount, setTotalAmount] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [remainPayFollowUpDate, setRemainPayFollowUpDate] = useState("");
  const [errs, setErrs] = useState({});

  const handleTotalChange = (v) => {
    const clean = v.replace(/^-+/, "");
    setTotalAmount(clean);
    // auto-suggest 60% advance; user can still overwrite it manually after
    const n = parseFloat(clean);
    if (!Number.isNaN(n) && n > 0) {
      setAdvanceAmount(String(Math.round(n * 0.6)));
    }
    setErrs((e) => ({ ...e, totalAmount: undefined }));
  };

  const validate = () => {
    const e = {};
    const total = parseFloat(totalAmount);
    const advance = parseFloat(advanceAmount);
    if (!totalAmount || Number.isNaN(total) || total <= 0) e.totalAmount = "Enter a valid total amount";
    if (!advanceAmount || Number.isNaN(advance) || advance < 0) e.advanceAmount = "Enter a valid advance amount";
    if (!e.advanceAmount && !e.totalAmount && advance > total) e.advanceAmount = "Advance can't exceed total";
    
    const remaining = total - advance;
    if (!e.totalAmount && !e.advanceAmount && remaining > 0 && !remainPayFollowUpDate) {
      e.remainPayFollowUpDate = "Pick a follow-up date for the remaining payment";
    }
    
    return e;
  };

  const submit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrs(e); return; }
     onConfirm(lead, {
       totalAmount: parseFloat(totalAmount),
       advanceAmount: parseFloat(advanceAmount),
       remainPayFollowUpDate: remainPayFollowUpDate || null,
     });  
    };

  return (
    <OverlayShell onClose={onClose}>
      <div className="mo-head">
        <div><p className="mo-sub">CONVERT LEAD</p><h2 className="mo-title">{lead.firstName} {lead.lastName}</h2></div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <div className="convert-body" style={{ paddingBottom: 8 }}>
          <Handshake size={40} strokeWidth={1.5} className="convert-icon" />
          <p className="convert-msg">Mark this lead as a closed, won deal?</p>
        </div>
        <div className="fg-grid">
          <div className="fg">
            <label>Total Amount *</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 85000"
              value={totalAmount}
              className={errs.totalAmount ? "fe" : ""}
              disabled={saving}
              onChange={(e) => handleTotalChange(e.target.value)}
            />
            {errs.totalAmount && <span className="fe-msg">{errs.totalAmount}</span>}
          </div>
          <div className="fg">
            <label>Advance Amount (60%)</label>
            <input
              type="number"
              min="0"
              placeholder="e.g. 51000"
              value={advanceAmount}
              className={errs.advanceAmount ? "fe" : ""}
              disabled={saving}
              onChange={(e) => { setAdvanceAmount(e.target.value.replace(/^-+/, "")); setErrs((er) => ({ ...er, advanceAmount: undefined })); }}            
            />
            {errs.advanceAmount && <span className="fe-msg">{errs.advanceAmount}</span>}
          </div>

           <div className="fg">
            <label>Remaining Payment</label>
             <input
               type="date"
               value={remainPayFollowUpDate}
               className={errs.remainPayFollowUpDate ? "fe" : ""}
               disabled={saving}
               onChange={(e) => { setRemainPayFollowUpDate(e.target.value); setErrs((er) => ({ ...er, remainPayFollowUpDate: undefined })); }}
             />
             {errs.remainPayFollowUpDate && <span className="fe-msg">{errs.remainPayFollowUpDate}</span>}
           </div>
        </div>
      </div>
      <div className="mo-foot">
        <button className="btn-cancel" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-save btn-convert" onClick={submit} disabled={saving}>
          {saving ? <Loader2 size={15} className="spin" /> : "Deal Done! 🎉"}
        </button>
      </div>
    </OverlayShell>
  );
};
/* ── OVERLAY: Confirm delete ── */
const DeleteConfirmOverlay = ({ label, onCancel, onConfirm, saving }) => (
  <OverlayShell onClose={onCancel}>
    <div className="mo-head">
      <div><p className="mo-sub">CONFIRM DELETE</p><h2 className="mo-title">{label}</h2></div>
      <button className="mo-x" onClick={onCancel}><X size={16} /></button>
    </div>
    <div className="mo-body convert-body">
      <FileX2 size={40} strokeWidth={1.5} className="delete-icon" />
      <p className="convert-msg">This action can't be undone. Are you sure?</p>
    </div>
    <div className="mo-foot">
      <button className="btn-cancel" onClick={onCancel} disabled={saving}>No, Keep It</button>
      <button className="btn-save btn-delete" onClick={onConfirm} disabled={saving}>
        {saving ? <Loader2 size={15} className="spin" /> : "Yes, Delete"}
      </button>
    </div>
  </OverlayShell>
);

/* ── Celebration burst (confetti + sound) ── */
// Drop your own clap sound at public/sounds/clap.mp3 — this path is a placeholder.
const CLAP_SOUND_URL = "/sounds/clap.mp3";
const CelebrationOverlay = ({ name }) => (
  <div className="celebrate-overlay">
    <div className="celebrate-card">
      <Handshake size={46} className="celebrate-icon" />
      <h2>Deal Closed! 🎉</h2>
      <p>{name} is officially a customer. Great work!</p>
    </div>
  </div>
);

/* ── OVERLAY: Bulk email (dummy, untouched) ── */
const BulkEmailOverlay = ({ count, onClose, onSend }) => (
  <OverlayShell onClose={onClose}>
    <div className="mo-head">
      <div><p className="mo-sub">SEND EMAIL</p><h2 className="mo-title">{count} lead{count!==1?"s":""} selected</h2></div>
      <button className="mo-x" onClick={onClose}><X size={16} /></button>
    </div>
    <div className="mo-body">
      <p className="email-hint">Choose a message template to send to all selected leads:</p>
      <div className="email-tpl-row">
        <button className="email-tpl-btn" onClick={() => onSend("followup")}>
          <MessageSquareText size={20} /><span>Follow-up</span>
        </button>
        <button className="email-tpl-btn" onClick={() => onSend("meet_reminder")}>
          <CalendarCheck2 size={20} /><span>Meet Reminder</span>
        </button>
        <button className="email-tpl-btn" onClick={() => onSend("normal_reminder")}>
          <BellRing size={20} /><span>Normal Reminder</span>
        </button>
      </div>
    </div>
    <div className="mo-foot"><button className="btn-cancel" onClick={onClose}>Cancel</button></div>
  </OverlayShell>
);

/* ── OVERLAY: Bulk WhatsApp forward — pick a template first, then send ── */

const CALENDAR_API_BASE = "http://localhost:9090/api/calendar/v1";

/* Calls the backend, which creates a real Google Calendar event with Meet
   conferencing attached (via the connected Google account) and returns the
   actual meet.google.com/xxx-xxxx-xxx join link. */
async function fetchMeetLink(lead, dateStr, timeStr) {
  const res = await fetch(`${CALENDAR_API_BASE}/schedule-meeting`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      leadFirstName: lead.firstName,
      leadLastName: lead.lastName,
      requirementCategory: lead.requirementCategory,
      meetingDate: dateStr,
      meetingTime: timeStr,
      durationMinutes: 30,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to schedule meeting (${res.status})`);
  }
  const data = await res.json();
  return data.meetLink;
}

/* ── OVERLAY: Bulk WhatsApp forward — pick a template first, then send ── */
/* ── OVERLAY: Bulk WhatsApp forward — pick a template first, then send ── */
const BulkWhatsAppOverlay = ({ leads, onClose }) => {
  const [template, setTemplate] = useState(null); // null = still choosing
  const [sentIds, setSentIds] = useState([]);
  const [meetDate, setMeetDate] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [sendingId, setSendingId] = useState(null); // leadPrimeId currently generating a Meet link

  const isMeeting = template === "meeting_reminder";
  const meetDetailsReady = !isMeeting || (meetDate && meetTime);

  const sendOne = async (lead) => {
    const phoneDigits = (lead.phone || "").replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      toast.error(`${lead.firstName} has no valid phone number`);
      return;
    }
    if (isMeeting && !meetDetailsReady) {
      toast.error("Pick a meeting date and time first");
      return;
    }

    setSendingId(lead.leadPrimeId);
    try {
      let msg = WA_TEMPLATES[template].build(lead);

      if (isMeeting) {
        const meetLink = await fetchMeetLink(lead, meetDate, meetTime);
        const whenText = new Date(`${meetDate}T${meetTime}`).toLocaleString("en-IN", {
          day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
        });
        msg = `${msg}\n\nScheduled for: ${whenText}\nJoin here: ${meetLink}`;
      }

      const waPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
      setSentIds((p) => [...p, lead.leadPrimeId]);
    } catch (err) {
      console.error("Failed to prepare WhatsApp message:", err);
      toast.error(err.message || `Failed to schedule meeting for ${lead.firstName}`);
    } finally {
      setSendingId(null);
    }
  };

  const sendAll = async () => {
    if (isMeeting && !meetDetailsReady) {
      toast.error("Pick a meeting date and time first");
      return;
    }
    // sequential (not parallel) — each Meet event is a separate Calendar API call,
    // and staggering keeps the browser from blocking multiple wa.me popups at once
    for (const lead of leads) {
      if (sentIds.includes(lead.leadPrimeId)) continue;
      await sendOne(lead);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  // Step 1 — template selection (must pick before any send is possible)
  if (!template) {
    return (
      <OverlayShell onClose={onClose}>
        <div className="mo-head">
          <div><p className="mo-sub">SELECT TEMPLATE</p><h2 className="mo-title">{leads.length} lead{leads.length!==1?"s":""} selected</h2></div>
          <button className="mo-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mo-body">
          <p className="email-hint">Choose a WhatsApp message template to send to all selected leads:</p>
          <div className="email-tpl-row">
            <button className="email-tpl-btn" onClick={() => setTemplate("followup")}>
              <MessageSquareText size={20} /><span>Follow-up</span>
            </button>
            <button className="email-tpl-btn" onClick={() => setTemplate("meeting_reminder")}>
              <CalendarCheck2 size={20} /><span>Meeting Reminder</span>
            </button>
            <button className="email-tpl-btn" onClick={() => setTemplate("payment_reminder")}>
              <BellRing size={20} /><span>Payment Reminder</span>
            </button>
          </div>
        </div>
        <div className="mo-foot"><button className="btn-cancel" onClick={onClose}>Cancel</button></div>
      </OverlayShell>
    );
  }

  // Step 2 — preview + per-lead / bulk send, now that a template is locked in
  return (
    <OverlayShell onClose={onClose} className="mo-wide">
      <div className="mo-head">
        <div>
          <p className="mo-sub">FORWARD WHATSAPP — {WA_TEMPLATES[template].label.toUpperCase()}</p>
          <h2 className="mo-title">{leads.length} lead{leads.length!==1?"s":""} selected</h2>
        </div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <p className="email-hint">
          Opens WhatsApp Web/App with a pre-filled "{WA_TEMPLATES[template].label}" message for each contact. Each tab needs to be sent manually inside WhatsApp.
        </p>
        <button className="wa-change-tpl" onClick={() => { setTemplate(null); setSentIds([]); setMeetDate(""); setMeetTime(""); }}>
          ← Change template
        </button>

        {isMeeting && (
          <div className="wa-meet-picker">
            <div className="fg">
              <label>Meeting Date *</label>
              <input type="date" value={meetDate} onChange={(e) => setMeetDate(e.target.value)} />
            </div>
            <div className="fg">
              <label>Meeting Time *</label>
              <input type="time" value={meetTime} onChange={(e) => setMeetTime(e.target.value)} />
            </div>
              <p className="wa-meet-note">
              A real Google Meet link is generated automatically for each lead and appended to the message — no extra steps needed on their end.
            </p>
          </div>
        )}

        <div className="wa-lead-list">
          {leads.map((lead) => (
            <div key={lead.leadPrimeId} className="wa-lead-row">
              <div className="wa-lead-info">
                <span className="wa-lead-name">{lead.firstName} {lead.lastName}</span>
                <span className="wa-lead-phone">{lead.phone || "—"}</span>
                <span className="wa-lead-req">{lead.requirementCategory || "—"}</span>
              </div>
              <button
                className={`act-btn act-wa ${sentIds.includes(lead.leadPrimeId) ? "act-wa-sent" : ""}`}
                onClick={() => sendOne(lead)}
                title="Open in WhatsApp"
                disabled={(isMeeting && !meetDetailsReady) || sendingId === lead.leadPrimeId}
              >
                {sendingId === lead.leadPrimeId ? <Loader2 size={15} className="spin" />
                  : sentIds.includes(lead.leadPrimeId) ? <CheckCircle2 size={15} />
                  : <Send size={15} />}
              </button>
            </div>
          ))}
        </div>
      </div>
       <div className="mo-foot">
        <button className="btn-cancel" onClick={onClose}>Close</button>
        <button className="flex gap-1 btn-save" onClick={sendAll} disabled={(isMeeting && !meetDetailsReady) || sendingId !== null}>
          {sendingId !== null ? <Loader2 size={15} className="spin" style={{ marginRight: 6 }} /> : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.26 4.9L2 22l5.25-1.28A9.96 9.96 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.2c-1.6 0-3.13-.43-4.46-1.24l-.32-.19-3.13.76.77-3.05-.21-.32A8.16 8.16 0 0 1 3.84 12c0-4.53 3.68-8.2 8.2-8.2 4.53 0 8.2 3.67 8.2 8.2 0 4.53-3.67 8.2-8.2 8.2Zm4.5-6.13c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.42-.55-.42-.14 0-.3-.02-.46-.02-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z"/>
      </svg>}
          Send All
        </button>
      </div>
    </OverlayShell>
  );
};

/* ── OVERLAY: Export to Excel ── */
const ExportOverlay = ({ statusFilter, onClose, onExport }) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const noFilter = !from && !to && !month && statusFilter === "all";

  return (
    <OverlayShell onClose={onClose}>
      <div className="mo-head">
        <div><p className="mo-sub">EXPORT LEADS</p><h2 className="mo-title">Download Excel Sheet</h2></div>
        <button className="mo-x" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="mo-body">
        <div className="fg-grid">
          <div className="fg"><label>From Date</label><input type="date" value={from} onChange={(e)=>{setFrom(e.target.value); setMonth("");}} /></div>
          <div className="fg"><label>To Date</label><input type="date" value={to} onChange={(e)=>{setTo(e.target.value); setMonth("");}} /></div>
          <div className="fg fg-full"><label>Or Pick a Month</label><input type="month" value={month} onChange={(e)=>{setMonth(e.target.value); setFrom(""); setTo("");}} /></div>
        </div>
        <p className="export-note">
          {noFilter
            ? "No filters selected — this will export all leads."
            : `Exporting leads${statusFilter!=="all" ? ` marked "${STATUS_CFG[statusFilter]?.label}"` : ""}${month ? ` for ${month}` : (from||to) ? ` from ${from||"…"} to ${to||"…"}` : ""}.`}
        </p>
      </div>
      <div className="mo-foot">
        <button className="btn-cancel-sheet" onClick={onClose}>Cancel</button>
        <button className="btn-save-sheet" onClick={() => onExport({ from, to, month })}>
          <FileSpreadsheet size={15} style={{ marginRight: 6 }} /> Export
        </button>
      </div>
    </OverlayShell>
  );
};

/* ── Shared action-button row (used by both tabs) ── */
const ActionRow = ({ lead, busyId, onView, onEdit, onDone, onNextFollowup, onHistory, onDoc, onConvert, onDelete, onLost, onAssignStaff }) => {
  const isBusy = busyId === lead.leadPrimeId;
  return (
    <div className="act-row">
      <button className="act-btn act-v" title="View" onClick={() => onView(lead)} disabled={isBusy}><Eye size={15} /></button>
      <button className="act-btn act-e" title="Edit" onClick={() => onEdit(lead)} disabled={isBusy}><Pencil size={15} /></button>
      {onAssignStaff && (
        <button className="act-btn act-assign" title={lead.assignedStaffName ? `Assigned: ${lead.assignedStaffName}` : "Assign staff"} onClick={() => onAssignStaff(lead)} disabled={isBusy}>
          <Users size={15} />
        </button>
      )}      
      {onDone && <button className="act-btn act-done" title="Mark done" onClick={() => onDone(lead)} disabled={isBusy}><CheckCircle2 size={15} /></button>}
      {onNextFollowup && <button className="act-btn act-next" title="Next follow-up" onClick={() => onNextFollowup(lead)} disabled={isBusy}><CalendarPlus size={15} /></button>}
      <button className="act-btn act-hist" title="History" onClick={() => onHistory(lead)} disabled={isBusy}><History size={15} /></button>
      <button
        className={`act-btn act-doc ${!lead.docFileUrl ? "act-doc-empty" : ""}`}
        title={lead.docFileUrl ? "View document" : "No document uploaded"}
        onClick={() => onDoc(lead)}
        disabled={isBusy}
      >
        {lead.docFileUrl ? <FileText size={15} /> : <FileX2 size={15} />}
      </button>
      {onConvert && <button className="act-btn act-convert" title="Convert" onClick={() => onConvert(lead)} disabled={isBusy}><Handshake size={15} /></button>}
       {onLost && <button className="act-btn act-d" title="Mark lost" onClick={() => onLost(lead)} disabled={isBusy}><XCircle size={15} /></button>}
      {onDelete && <button className="act-btn act-d" title="Delete" onClick={() => onDelete(lead.leadPrimeId)} disabled={isBusy}>🗑</button>}
      {isBusy && <Loader2 size={14} className="spin" />}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   DASHBOARD (root)
───────────────────────────────────────────────────────────── */
const Dashboard = () => {
  const [leads, setLeads]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [activeYM, setActiveYM] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [activeTab, setActiveTab] = useState("pipeline"); // "pipeline" | "nextFollowups"

  const [dayOverlay,  setDayOverlay]  = useState(null);
  const [editLead,    setEditLead]    = useState(null);
  const [addingNew,   setAddingNew]   = useState(false);
  const [viewLead,    setViewLead]    = useState(null);
  const [doneLead,    setDoneLead]    = useState(null);
  const [nextLead,    setNextLead]    = useState(null);
  const [histLead,    setHistLead]    = useState(null);
  const [histData,    setHistData]    = useState([]);
  const [histLoading, setHistLoading] = useState(false);
 const [convertLead, setConvertLead] = useState(null);
  const [lostLead,    setLostLead]    = useState(null);
  const [viewLostReason, setViewLostReason] = useState(null);

  const [celebrate,   setCelebrate]   = useState(null);
  const [assignStaffLead, setAssignStaffLead] = useState(null);
  const [staffList, setStaffList] = useState([]);

  const [bulkEmailOpen, setBulkEmailOpen] = useState(false);
  const [bulkWhatsAppOpen, setBulkWhatsAppOpen] = useState(false);
  const [exportOpen,    setExportOpen]    = useState(false);

  const [search,   setSearch]   = useState("");
  const [stFilter, setStFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  /* ── Fetch leads ── */
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const page = await apiGet(`/all-leads?page=0&size=200`);
      setLeads(page.content || []);
    } catch (err) {
      console.error("Failed to load leads:", err);
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, []);

  
  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const fetchStaffList = useCallback(async () => {
    try {
      const res = await fetch(`${STAFF_API_BASE}/dropdown`);
      if (!res.ok) throw new Error(`Failed to load staff (${res.status})`);
      const data = await res.json();
      setStaffList(data);
    } catch (err) {
      console.error("Failed to load staff dropdown:", err);
      // non-blocking — dashboard still works without staff assignment if this fails
    }
  }, []);

  useEffect(() => { fetchStaffList(); }, [fetchStaffList]);



  

const visibleLeads = useMemo(
    () => leads.filter((l) => !l.leadConverted && !l.deletedLead && l.leadOutcome !== "lost"),
    [leads]
  );

  const lostLeadsList = useMemo(
    () => leads.filter((l) => !l.deletedLead && l.leadOutcome === "lost"),
    [leads]
  );
 
  /* ── Stats — live from /api/stat/v1/lead-stats ── */
  const [stats, setStats] = useState({ totalLeads: 0, todayFollowups: 0, totalFollowups: 0, won: 0, lost: 0 });

  const fetchStats = useCallback(async () => {
    try {
      const data = await apiGetAbsolute(`${STAT_API_BASE}/lead-stats`);
      setStats(data);
    } catch (err) {
      console.error("Failed to load stat cards:", err);
      toast.error("Failed to load stat cards");
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

   const [monthlyTrend, setMonthlyTrend] = useState([]);
  const [monthlyTrendLoading, setMonthlyTrendLoading] = useState(true);

  const fetchMonthlyTrend = useCallback(async () => {
    setMonthlyTrendLoading(true);
    try {
      const data = await apiGet(`/monthly-count?monthsBack=6`);
      setMonthlyTrend(data.map((d) => ({ key: d.monthKey, label: d.monthLabel, count: d.count })));
    } catch (err) {
      console.error("Failed to load monthly lead trend:", err);
      toast.error("Failed to load monthly trend chart");
    } finally {
      setMonthlyTrendLoading(false);
    }
  }, []);

  useEffect(() => { fetchMonthlyTrend(); }, [fetchMonthlyTrend]);
  const workTypeDist = useMemo(() => {
    const counts = { static: 0, dynamic: 0, meta_ads: 0, campaign: 0 };
    DUMMY_LEADS.forEach((l) => { if (l.workType && counts[l.workType] !== undefined) counts[l.workType]++; });
    return counts;
  }, []);

  const leadsByDate = useMemo(() => {
    const map = {};
    visibleLeads.forEach((l) => {
      if (!l.followUpDate || l.followupStatus === "done") return;
      (map[l.followUpDate] = map[l.followUpDate] || []).push(l);
    });
    return map;
  }, [visibleLeads]);

  const upcoming = useMemo(() => {
    const todayKey = toKey(today);
    return [...visibleLeads]
      .filter((l) => l.followUpDate && l.followupStatus !== "done")
      .sort((a, b) => {
        const isTodayA = a.followUpDate === todayKey, isTodayB = b.followUpDate === todayKey;
        if (isTodayA && !isTodayB) return -1;
        if (isTodayB && !isTodayA) return 1;
        return a.followUpDate.localeCompare(b.followUpDate);
      })
      .slice(0, 6);
  }, [visibleLeads]);

  const pipelineLeads = useMemo(() =>
    visibleLeads.filter((l) =>
      (stFilter === "all" || l.status === stFilter) &&
      [l.firstName, l.lastName, l.email, l.company || ""].some((f) => (f||"").toLowerCase().includes(search.toLowerCase()))
    ),
  [visibleLeads, stFilter, search]);

  const nextFollowupLeads = useMemo(() =>
    visibleLeads.filter((l) =>
      (l.followupCount || 0) > 1 &&
      (stFilter === "all" || l.status === stFilter) &&
      [l.firstName, l.lastName, l.email, l.company || ""].some((f) => (f||"").toLowerCase().includes(search.toLowerCase()))
    ),
  [visibleLeads, stFilter, search]);

  const lostFilteredLeads = useMemo(() =>
    lostLeadsList.filter((l) =>
      [l.firstName, l.lastName, l.email, l.company || ""].some((f) => (f||"").toLowerCase().includes(search.toLowerCase()))
    ),
  [lostLeadsList, search]);

const activeList = activeTab === "pipeline" ? pipelineLeads : activeTab === "nextFollowups" ? nextFollowupLeads : lostFilteredLeads;

  const visIds    = activeList.map((l) => l.leadPrimeId);
  const allCheck  = visIds.length > 0 && visIds.every((id) => selected.includes(id));
  const toggleAll = () => allCheck
    ? setSelected((p) => p.filter((id) => !visIds.includes(id)))
    : setSelected((p) => [...new Set([...p, ...visIds])]);
  const toggleOne = (id) => setSelected((p) => p.includes(id) ? p.filter((s) => s !== id) : [...p, id]);


  /* ── CRUD ── */
  const handleSave = async (form, isEdit, docFile) => {
    setBusyId(isEdit ? form.leadPrimeId : -1);
    try {
      const payload = {
        firstName: form.firstName, lastName: form.lastName, email: form.email, phone: form.phone,
        company: form.company, status: form.status, priority: form.priority, source: form.source || "Website",
        requirementCategory: form.requirementCategory, tags: form.tags || "",
        followUpDate: form.followUpDate, followupStatus: form.followupStatus || "pending",
        notes: form.notes, leadConverted: false,
        assignedStaffId: form.assignedStaffId ? Number(form.assignedStaffId) : null,

      };
      if (isEdit) {
        await apiSendLeadForm(`/${form.leadPrimeId}`, "PATCH", payload, docFile);
        toast.success("Lead updated");
      } else {
        await apiSendLeadForm(``, "POST", payload, docFile);
        toast.success("Lead created");
        fetchMonthlyTrend(); // new lead affects this month's count
      }
      await fetchLeads();
      setEditLead(null);
      setAddingNew(false);
    } catch (err) {
      console.error("Save failed:", err);
      toast.error(err.message || "Failed to save lead");
    } finally {
      setBusyId(null);
    }
  };



  const delOne = (id) => setDeleteTarget({ type: "one", id });
  const delBulk = () => { if (selected.length) setDeleteTarget({ type: "bulk" }); };

  const confirmDelete = async () => {
    setBusyId(-1);
    try {
      if (deleteTarget.type === "one") {
        const res = await fetch(`${API_BASE}/delete-lead/${deleteTarget.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error(`Delete failed (${res.status})`);
        toast.success("Lead deleted");
        setSelected((p) => p.filter((s) => s !== deleteTarget.id));
      } else {
        const res = await fetch(`${API_BASE}/delete-bulk`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selected),
        });
        if (!res.ok) throw new Error(`Bulk delete failed (${res.status})`);
        toast.success(`${selected.length} lead(s) deleted`);
        setSelected([]);
      }
      await fetchLeads();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error(err.message || "Failed to delete");
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  };

  /* ── Follow-up flow ── */
  const handleDoneSubmit = async (lead, note) => {
    setBusyId(lead.leadPrimeId);
    try {
      const res = await fetch(`${API_BASE}/add/${lead.leadPrimeId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followupDate: lead.followUpDate, followupStatus: "done", followupNotes: note }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);

      toast.success("Follow-up marked as done");
      setDoneLead(null);
      setDayOverlay((ov) => ov ? { ...ov, leads: ov.leads.filter((x) => x.leadPrimeId !== lead.leadPrimeId) } : ov);
      await fetchLeads();
    } catch (err) {
      console.error("Mark done failed:", err);
      toast.error(err.message || "Failed to mark follow-up as done");
    } finally {
      setBusyId(null);
    }
  };

  const handleNextFollowupSubmit = async (lead, newDate) => {
    setBusyId(lead.leadPrimeId);
    try {
      const res = await fetch(`${API_BASE}/add/${lead.leadPrimeId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followupDate: newDate, followupStatus: "pending", followupNotes: `Carried forward to ${fmtDate(newDate)}` }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);

      toast.success("Next follow-up scheduled");
      setNextLead(null);
      setDayOverlay((ov) => ov ? { ...ov, leads: ov.leads.filter((x) => x.leadPrimeId !== lead.leadPrimeId) } : ov);
      await fetchLeads();
    } catch (err) {
      console.error("Schedule failed:", err);
      toast.error(err.message || "Failed to schedule next follow-up");
    } finally {
      setBusyId(null);
    }
  };

  /* ── History ── */
  const openHistory = async (lead) => {
    setHistLead(lead);
    setHistLoading(true);
    try {
      const data = await apiGet(`/history/${lead.leadPrimeId}/followup`);
      setHistData(data);
    } catch (err) {
      console.error("History fetch failed:", err);
      toast.error("Failed to load history");
      setHistData([]);
    } finally {
      setHistLoading(false);
    }
  };

  /* ── Doc view ── */
  const openDoc = (lead) => {
    if (!lead.docFileUrl) {
      toast.info("No document uploaded for this lead");
      return;
    }
    window.open(`${FILE_ORIGIN}${lead.docFileUrl}`, "_blank", "noopener,noreferrer");
  };

  /* ── Convert + celebration (confetti + clap sound) ── */
  const CLIENT_API_BASE = "http://localhost:9090/api/client/v1";

  const handleConvertConfirm = async (lead, amounts) => {
    setBusyId(lead.leadPrimeId);
    try {
      const res = await fetch(`${CLIENT_API_BASE}/convert-lead/${lead.leadPrimeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(amounts),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed (${res.status})`);
      }

      setConvertLead(null);

      // confetti burst
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0 } }), 200);
      setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1 } }), 200);

      // clap sound
      try {
        const audio = new Audio(CLAP_SOUND_URL);
        audio.volume = 0.6;
        audio.play().catch((e) => console.warn("Clap sound blocked by browser autoplay policy:", e));
      } catch (e) {
        console.warn("Clap sound failed to load:", e);
      }

      setCelebrate(`${lead.firstName} ${lead.lastName}`);
      setTimeout(() => setCelebrate(null), 2600);
      await fetchLeads();
    } catch (err) {
      console.error("Convert failed:", err);
      toast.error(err.message || "Failed to convert lead");
    } finally {
      setBusyId(null);
    }
  };


  const handleLostSubmit = async (lead, reason) => {
    setBusyId(lead.leadPrimeId);
    try {
      const res = await fetch(`${API_BASE}/${lead.leadPrimeId}/outcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadOutcome: "lost", lostReason: reason }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed (${res.status})`);
      }
      toast.success("Lead marked as lost");
      setLostLead(null);
      await fetchLeads();
      fetchStats();
    } catch (err) {
      console.error("Mark lost failed:", err);
      toast.error(err.message || "Failed to mark lead as lost");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevertLost = async (lead) => {
    setBusyId(lead.leadPrimeId);
    try {
      const res = await fetch(`${API_BASE}/${lead.leadPrimeId}/outcome`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadOutcome: "open" }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed (${res.status})`);
      }
      toast.success("Lead restored to pipeline");
      await fetchLeads();
      fetchStats();
    } catch (err) {
      console.error("Revert failed:", err);
      toast.error(err.message || "Failed to restore lead");
    } finally {
      setBusyId(null);
    }
  };


   const handleAssignStaffSubmit = async (lead, staffId) => {
    setBusyId(lead.leadPrimeId);
    try {
      const payload = {
        firstName: lead.firstName, lastName: lead.lastName, email: lead.email, phone: lead.phone,
        company: lead.company, status: lead.status, priority: lead.priority, source: lead.source || "Website",
        requirementCategory: lead.requirementCategory, tags: lead.tags || "",
        followUpDate: lead.followUpDate, followupStatus: lead.followupStatus || "pending",
        notes: lead.notes, leadConverted: lead.leadConverted || false,
        assignedStaffId: staffId,
      };
      await apiSendLeadForm(`/${lead.leadPrimeId}`, "PATCH", payload, null);
      toast.success(staffId ? "Staff assigned" : "Staff unassigned");
      setAssignStaffLead(null);
      await fetchLeads();
    } catch (err) {
      console.error("Assign staff failed:", err);
      toast.error(err.message || "Failed to assign staff");
    } finally {
      setBusyId(null);
    }
  };


  /* ── Bulk email (dummy — untouched) ── */
  const handleBulkSend = (template) => {
    const recipients = visibleLeads.filter((l) => selected.includes(l.leadPrimeId)).map((l) => l.email);
    console.log("Sending", template, "to", recipients);
    toast.success(`"${template.replace("_"," ")}" email queued for ${recipients.length} lead(s).`);
    setBulkEmailOpen(false);
  };

  /* ── Export to Excel ── */
  const handleExport = ({ from, to, month }) => {
    let rows = visibleLeads.filter((l) => stFilter === "all" || l.status === stFilter);
    if (month) {
      rows = rows.filter((l) => l.followUpDate && l.followUpDate.startsWith(month));
    } else if (from || to) {
      rows = rows.filter((l) => {
        if (!l.followUpDate) return false;
        if (from && l.followUpDate < from) return false;
        if (to && l.followUpDate > to) return false;
        return true;
      });
    }
    const data = rows.map((l) => ({
      "First Name": l.firstName, "Last Name": l.lastName, "Email": l.email, "Phone": l.phone,
      "Company": l.company || "", "Requirement": l.requirementCategory || "",
      "Status": STATUS_CFG[l.status]?.label || l.status, "Priority": l.priority,
      "Follow-up Date": fmtDate(l.followUpDate), "Follow-up Status": l.followupStatus === "done" ? "Done" : "Pending",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, `leads-export-${toKey(today)}.xlsx`);

    toast.success("Excel sheet downloaded");
    setExportOpen(false);
  };

  const prevMonth = () => setActiveYM(({year,month}) => month===0 ? {year:year-1,month:11} : {year,month:month-1});
  const nextMonth = () => setActiveYM(({year,month}) => month===11 ? {year:year+1,month:0} : {year,month:month+1});

  const todayKey = toKey(today);
  const selectedLeadsForWA = useMemo(
    () => visibleLeads.filter((l) => selected.includes(l.leadPrimeId)),
    [visibleLeads, selected]
  );

  return (
    <div className="root-dashboard">
      {/* <ToastContainer position="top-right" autoClose={2500} theme="light" /> */}
      <nav className="dash-nav">
        <div className="nav-brand">
          <span className="font-mono text-sm font-thin text-gray-600">Hey! Let's make it happen :)</span>
        </div>
        <button className="btn-save" onClick={() => setAddingNew(true)}>+ Add Lead</button>
      </nav>

      <div className="dash-body">

        <section className="stats-row">
          <StatCard label="Total Leads"      value={stats.totalLeads}     Icon={Users}         accent={{ bg:"rgba(249,115,22,.13)", color:"#ea580c" }} />
          <StatCard label="Today Follow-ups" value={stats.todayFollowups} Icon={CalendarClock} accent={{ bg:"rgba(239,68,68,.13)",  color:"#ef4444" }} />
          <StatCard label="Total Follow-ups" value={stats.totalFollowups} Icon={Repeat}        accent={{ bg:"rgba(245,158,11,.13)", color:"#f59e0b" }} />
          <StatCard label="Won"              value={stats.won}            Icon={CheckCircle2}  accent={{ bg:"rgba(34,197,94,.13)",  color:"#16a34a" }} />
          <StatCard label="Lost Leads"       value={stats.lost}           Icon={XCircle}       accent={{ bg:"rgba(107,114,128,.13)",color:"#6b7280" }} />
        </section>

        <section className="cal-section">
          <div className="cal-left">
            <div className="cal-month-block">
              <p className="cal-month-name">{MONTH_NAMES[activeYM.month].toUpperCase()}</p>
              <h1 className="cal-year">{activeYM.year}</h1>
            </div>

            <div className="cal-upcoming">
              <p className="up-heading">UPCOMING EVENTS</p>
              <div className="up-list">
                {loading && <p className="up-empty">Loading…</p>}
                {!loading && upcoming.length===0 && <p className="up-empty">No upcoming follow-ups</p>}
                {upcoming.map((lead) => {
                  const isToday = lead.followUpDate === todayKey;
                  return (
                    <div key={lead.leadPrimeId} className={`up-card ${isToday?"up-card-today":""}`} onClick={() => setViewLead(lead)}>
                      {isToday && <span className="up-today-tag">TODAY</span>}
                      <div className="up-row">
                        <span className="up-name">{lead.firstName} {lead.lastName}</span>
                        <span className="up-date">{fmtDate(lead.followUpDate)}</span>
                      </div>
                      <div className="up-row">
                        <span className="up-co">{lead.company || lead.email}</span>
                        <span className="up-prio" style={{color:PRIORITY_CFG[lead.priority]?.color}}>{lead.priority}</span>
                      </div>
                      <p className="up-note">{(lead.notes||"").slice(0,52)||"—"}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="cal-right">
            <div className="cal-nav">
              <button className="cal-nav-btn" onClick={prevMonth}>‹</button>
              <span className="cal-nav-label">{MONTH_NAMES[activeYM.month]} {activeYM.year}</span>
              <button className="cal-nav-btn" onClick={nextMonth}>›</button>
            </div>
            <CalendarGrid
              year={activeYM.year}
              month={activeYM.month}
              leadsByDate={leadsByDate}
              onDayClick={(date, dayLeads) => setDayOverlay({ date, leads: dayLeads })}
            />
          </div>
        </section>

        <section className="charts-row">
          <div className="chart-card">
            <p className="chart-title">Monthly Lead Trend</p>
            {monthlyTrendLoading ? (
              <div className="chart-loading"><Loader2 size={22} className="spin" /></div>
            ) : (
              <TrendBarChart data={monthlyTrend} />
            )}
          </div>
          <div className="chart-card">
            <p className="chart-title">Working Category Distribution</p>
            <DoughnutChart counts={workTypeDist} />
          </div>
        </section>

        <section className="tbl-section">
          <div className="tbl-top">
            <div>
              <h2 className="tbl-title">Lead Pipeline</h2>
              <p className="tbl-sub">{activeList.length} lead{activeList.length!==1?"s":""}</p>
            </div>
            <div className="tbl-bulk">
              <button className="btn-export" onClick={() => setExportOpen(true)}>
                <FileSpreadsheet size={15} /> Export
              </button>
              {selected.length>0 && (
                <>
                  <button className="btn-bulk-del" onClick={delBulk}>🗑 Delete ({selected.length})</button>
                  <button className="btn-bulk-email" onClick={() => setBulkEmailOpen(true)}>
                    <Mail size={14} /> Email ({selected.length})
                  </button>
                  <button className="btn-bulk-whatsapp" onClick={() => setBulkWhatsAppOpen(true)}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.45 1.26 4.9L2 22l5.25-1.28A9.96 9.96 0 0 0 12.04 22c5.52 0 10-4.48 10-10s-4.48-10-10-10Zm0 18.2c-1.6 0-3.13-.43-4.46-1.24l-.32-.19-3.13.76.77-3.05-.21-.32A8.16 8.16 0 0 1 3.84 12c0-4.53 3.68-8.2 8.2-8.2 4.53 0 8.2 3.67 8.2 8.2 0 4.53-3.67 8.2-8.2 8.2Zm4.5-6.13c-.24-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.63.79-.77.95-.14.16-.28.18-.53.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.33-.76-1.82-.2-.48-.4-.42-.55-.42-.14 0-.3-.02-.46-.02-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.13 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.44-.59 1.64-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28Z"/>
                  </svg> WhatsApp ({selected.length})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="lead-subtabs">
            <button className={`subtab-btn ${activeTab==="pipeline"?"active":""}`} onClick={() => { setActiveTab("pipeline"); setSelected([]); }}>
              All Leads
            </button>
            <button className={`subtab-btn ${activeTab==="nextFollowups"?"active":""}`} onClick={() => { setActiveTab("nextFollowups"); setSelected([]); }}>
              Next Follow-ups {nextFollowupLeads.length > 0 && <span className="subtab-badge">{nextFollowupLeads.length}</span>}
            </button>
              <button className={`subtab-btn ${activeTab==="lost"?"active":""}`} onClick={() => { setActiveTab("lost"); setSelected([]); }}>
              Lost Leads {lostLeadsList.length > 0 && <span className="subtab-badge">{lostLeadsList.length}</span>}
            </button>
          </div>

           <div className="tbl-filters">
            <div className="srch-wrap">
              <span className="srch-ico">⌕</span>
              <input className="srch-input" placeholder="Search name, email, company…" value={search} onChange={(e)=>setSearch(e.target.value)} />
            </div>
            <div className="st-filters">
              {["all","hot","warm","cold"].map((s)=>(
                <button key={s} className={`st-btn st-${s} ${stFilter===s?"active":""}`} onClick={()=>setStFilter(s)}>
                  {s==="all"?"All":STATUS_CFG[s].label}
                </button>
              ))}
            </div>
            <button
              className="btn-reset-filters"
              onClick={() => { setSearch(""); setStFilter("all"); setSelected([]); }}
              disabled={!search && stFilter === "all" && selected.length === 0}
            >
              Reset
            </button>
          </div>

          <div className="tbl-scroll">
            <table className="lead-tbl">
              <thead>
                <tr>
                  <th><input type="checkbox" className="chk" checked={allCheck} onChange={toggleAll}/></th>
                  <th>Name</th><th>Company</th><th>Email</th><th>Phone</th>
                  <th>Status</th><th>Priority</th><th>Follow-up</th>
                  {activeTab==="nextFollowups" && <th>Total Follow-ups</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="tbl-empty"><Loader2 size={16} className="spin" /> Loading leads…</td></tr>
                )}
                {!loading && activeList.length===0 && (
                  <tr><td colSpan={9} className="tbl-empty">
                    {activeTab === "pipeline" ? "No leads found — click any calendar date to view follow-ups."
                      : activeTab === "nextFollowups" ? "No leads with multiple follow-ups yet."
                      : "No lost leads yet."}
                  </td></tr>
                )}
                {!loading && activeList.map((lead) => {
                  const isFollowToday = lead.followUpDate === todayKey;
                  return (
                    <tr key={lead.leadPrimeId} className={`tbl-row tbl-${lead.status} ${selected.includes(lead.leadPrimeId)?"tbl-sel":""}`}>
                      <td><input type="checkbox" className="chk" checked={selected.includes(lead.leadPrimeId)} onChange={()=>toggleOne(lead.leadPrimeId)}/></td>
                      <td className="td-name">{lead.firstName} {lead.lastName}</td>
                      <td className="td-co">{lead.company||"—"}</td>
                      <td className="td-email">{lead.email}</td>
                      <td className="td-phone">{lead.phone}</td>
                      <td><StatusPill status={lead.status} /></td>
                      <td><PriorityPill priority={lead.priority} /></td>
                      <td>
                        <span className={`fu-date ${isFollowToday?"fu-today":""}`}>
                          {fmtDate(lead.followUpDate)}{isFollowToday && <span className="fu-dot"/>}
                        </span>
                      </td>
                      {activeTab==="nextFollowups" && <td>{lead.followupCount || 0}</td>}
                      <td>
                        {activeTab === "lost" ? (
                          <div className="act-row">
                            <button className="act-btn act-v" title="View" onClick={() => setViewLead(lead)} disabled={busyId === lead.leadPrimeId}><Eye size={15} /></button>
                            <button className="act-btn act-d" title="View reason" onClick={() => setViewLostReason(lead)} disabled={busyId === lead.leadPrimeId}><FileText size={15} /></button>
                            <button className="act-btn act-done" title="Revert to pipeline" onClick={() => handleRevertLost(lead)} disabled={busyId === lead.leadPrimeId}><History size={15} /></button>
                            {busyId === lead.leadPrimeId && <Loader2 size={14} className="spin" />}
                          </div>
                        ) : (
                          <ActionRow
                            lead={lead} busyId={busyId}
                            onView={setViewLead} onEdit={setEditLead}
                            onDone={setDoneLead} onNextFollowup={setNextLead}
                            onHistory={openHistory} onDoc={openDoc}
                            onConvert={setConvertLead} onDelete={delOne} onLost={setLostLead}
                            onAssignStaff={setAssignStaffLead}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* ── MODALS / OVERLAYS ── */}
      {dayOverlay && (
        <DayLeadsOverlay
          date={dayOverlay.date}
          leads={dayOverlay.leads}
          busyId={busyId}
          onClose={() => setDayOverlay(null)}
          onView={setViewLead}
          onEdit={setEditLead}
          onDone={setDoneLead}
          onNextFollowup={setNextLead}
          onHistory={openHistory}
          onDoc={openDoc}
        />
      )}
       {(editLead || addingNew) && (
        <LeadFormModal
          lead={editLead}
          staffList={staffList}
          saving={busyId !== null}
          onClose={() => { setEditLead(null); setAddingNew(false); }}
          onSave={handleSave}
        />
      )}
      {viewLead    && <LeadDetailOverlay lead={viewLead} onClose={() => setViewLead(null)} onDoc={openDoc} />}
      {doneLead    && <DoneOverlay lead={doneLead} saving={busyId === doneLead.leadPrimeId} onClose={() => setDoneLead(null)} onSubmit={handleDoneSubmit} />}
      {nextLead    && <NextFollowupOverlay lead={nextLead} saving={busyId === nextLead.leadPrimeId} onClose={() => setNextLead(null)} onSubmit={handleNextFollowupSubmit} />}
      {histLead    && <HistoryOverlay lead={histLead} history={histData} loading={histLoading} onClose={() => { setHistLead(null); setHistData([]); }} />}
      {convertLead && <ConvertOverlay lead={convertLead} saving={busyId === convertLead.leadPrimeId} onClose={() => setConvertLead(null)} onConfirm={handleConvertConfirm} />}
      {lostLead    && <LostOverlay lead={lostLead} saving={busyId === lostLead.leadPrimeId} onClose={() => setLostLead(null)} onSubmit={handleLostSubmit} />}
      {assignStaffLead && <AssignStaffOverlay lead={assignStaffLead} staffList={staffList} saving={busyId === assignStaffLead.leadPrimeId} onClose={() => setAssignStaffLead(null)} onSubmit={handleAssignStaffSubmit} />}
      
      {viewLostReason && <LostReasonOverlay lead={viewLostReason} saving={busyId === viewLostReason.leadPrimeId} onClose={() => setViewLostReason(null)} onRevert={(l) => { setViewLostReason(null); handleRevertLost(l); }} />}
      {deleteTarget && (
        <DeleteConfirmOverlay
          label={deleteTarget.type === "one" ? "Delete this lead?" : `Delete ${selected.length} leads?`}
          saving={busyId === -1}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      )}
      {celebrate       && <CelebrationOverlay name={celebrate} />}
      {bulkEmailOpen    && <BulkEmailOverlay count={selected.length} onClose={() => setBulkEmailOpen(false)} onSend={handleBulkSend} />}
      {bulkWhatsAppOpen && <BulkWhatsAppOverlay key={selectedLeadsForWA.map(l=>l.leadPrimeId).join(",")} leads={selectedLeadsForWA} onClose={() => setBulkWhatsAppOpen(false)} />}      {exportOpen       && <ExportOverlay statusFilter={stFilter} onClose={() => setExportOpen(false)} onExport={handleExport} />}
    </div>
  );
};

export default Dashboard;