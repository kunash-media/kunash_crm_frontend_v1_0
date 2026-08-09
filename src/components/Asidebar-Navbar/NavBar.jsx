import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { logoutApi } from "../../api/authApi";
import "./layout.css";

import { X, FileText, FileX2 } from "lucide-react";


/* ── Route → display name map ── add future routes here ── */
const ROUTE_META = {
  "/dashboard":   { label: "Dashboard",   parent: null },
  "/leads/add":   { label: "Add Lead",    parent: "Dashboard" },
  "/clients":     { label: "Client List", parent: "Dashboard" },
  "/invoices":    { label: "Invoice",     parent: "Dashboard" },
  "/reports":     { label: "Reports",     parent: "Dashboard" },
  "/settings":    { label: "Settings",    parent: "Dashboard" },
};

const API_BASE = "http://localhost:9090/api/lead/v1";
const FILE_ORIGIN = "http://localhost:9090";

const NotificationPanel = ({ onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const NOTIFS = [
    { id: 1, title: "Follow-up due today",  body: "Arjun Mehta — TechWave Solutions", time: "Just now",  unread: true  },
    { id: 2, title: "New lead assigned",    body: "Karthik Iyer — AutoServ Logistics", time: "2 min ago", unread: true  },
    { id: 3, title: "Invoice #INV-0042",    body: "Marked as paid by FinEdge Capital", time: "1 hr ago",  unread: false },
    { id: 4, title: "Report ready",         body: "Q2 pipeline report generated",      time: "Yesterday", unread: false },
  ];

  return (
    <div className="notif-panel" ref={ref}>
      <div className="notif-head">
        <span className="notif-title">Notifications</span>
        <button className="notif-clear">Mark all read</button>
      </div>
      <ul className="notif-list">
        {NOTIFS.map((n) => (
          <li key={n.id} className={`notif-item ${n.unread ? "notif-unread" : ""}`}>
            <div className="notif-dot-wrap">
              {n.unread && <span className="notif-dot" />}
            </div>
            <div className="notif-content">
              <p className="notif-item-title">{n.title}</p>
              <p className="notif-item-body">{n.body}</p>
              <p className="notif-item-time">{n.time}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

// replace the entire ProfilePanel component with:
const ProfilePanel = ({ onClose, admin, onLogoutClick }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const initial = admin?.mobile ? admin.mobile.slice(-1) : "A";

  return (
    <div className="profile-panel" ref={ref}>
      <div className="profile-info">
        <div className="profile-avatar-lg">{initial}</div>
        <div>
          <p className="profile-name">{admin?.mobile || "Admin"}</p>
          <p className="profile-email">{admin?.role || ""}</p>
        </div>
      </div>
      <div className="profile-divider" />
      <ul className="profile-menu">
        {[
          { icon: "👤", label: "My Profile" },
        ].map((item) => (
          <li key={item.label}>
            <button className="profile-menu-item" onClick={item.action || onClose}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="profile-divider" />
      <button className="profile-logout" onClick={onLogoutClick}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        Sign Out
      </button>
    </div>
  );
};



const STATUS_CFG = {
  hot:  { label:"Hot",  color:"#ef4444", bg:"rgba(239,68,68,0.12)"  },
  warm: { label:"Warm", color:"#f59e0b", bg:"rgba(245,158,11,0.12)" },
  cold: { label:"Cold", color:"#3b82f6", bg:"rgba(59,130,246,0.12)" },
};

const fmtDate = (v) => {
  if (!v) return "—";
  const [y,m,d] = v.split("-");
  return new Date(+y,+m-1,+d).toLocaleDateString("en-IN",{ day:"2-digit", month:"short", year:"numeric" });
};
const fmtDateTime = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-IN",{ day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
};

const NavStatusPill = ({ status }) => (
  <span className="status-pill" style={{ color: STATUS_CFG[status]?.color, background: STATUS_CFG[status]?.bg }}>
    {STATUS_CFG[status]?.label || status || "—"}
  </span>
);

/* ── Search suggestion dropdown ── */
const SearchSuggestions = ({ results, loading, onView, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div className="search-suggest-panel" ref={ref}>
      {loading && <div className="search-suggest-empty">Searching…</div>}
      {!loading && results.length === 0 && (
        <div className="search-suggest-empty">No matching leads</div>
      )}
      {!loading && results.map((lead) => (
        <div key={lead.leadPrimeId} className="search-suggest-item">
          <div className="search-suggest-info">
            <span className="search-suggest-name">{lead.firstName} {lead.lastName}</span>
            <span className="search-suggest-meta">
              {lead.phone} {lead.company ? `· ${lead.company}` : ""}
            </span>
          </div>
          {lead.status && (
            <span className={`search-suggest-status status-${(lead.status || "").toLowerCase()}`}>
              {lead.status}
            </span>
          )}
          <button className="search-suggest-view-btn" onClick={() => onView(lead.leadPrimeId)}>
            View
          </button>
        </div>
      ))}
    </div>
  );
};

/* ── Lead view overlay (simple info popup) ── */
const NavLeadViewOverlay = ({ lead, loading, onClose }) => {
  const ref = useRef(null);
  return (
    <div className="mo-overlay" ref={ref} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="mo-card mo-view">
        <div className="mo-head">
          <div>
            <p className="mo-sub">LEAD DETAILS</p>
            <h2 className="mo-title">{loading ? "Loading…" : `${lead.firstName} ${lead.lastName}`}</h2>
          </div>
          <button className="mo-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mo-body">
          {loading ? (
            <p className="search-suggest-empty">Fetching lead details…</p>
          ) : (
            <>
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
                  <div className="vg-item"><span className="vg-lbl">Status</span><NavStatusPill status={lead.status} /></div>
                  <div className="vg-item"><span className="vg-lbl">Follow-up</span><span className="vg-val">{fmtDate(lead.followUpDate)}</span></div>
                  <div className="vg-item"><span className="vg-lbl">Created</span><span className="vg-val">{fmtDateTime(lead.createdAt)}</span></div>
                </div>
              </div>
              <div className="vg-section">
                <p className="vg-section-title">Document</p>
                {lead.docFileUrl ? (
                  <button
                    className="btn-save"
                    style={{ width: "fit-content" }}
                    onClick={() => window.open(`${FILE_ORIGIN}${lead.docFileUrl}`, "_blank", "noopener,noreferrer")}
                  >
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
            </>
          )}
        </div>
        <div className="mo-foot"><button className="btn-save" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
};

// add this new component, right after ProfilePanel, before NavBar:
const LogoutConfirmOverlay = ({ onConfirm, onCancel, loading }) => (
  <div className="logout-overlay">
    <div className="logout-overlay-card">
      <h3>Sign out?</h3>
      <p>You'll need to log in again to access the admin panel.</p>
      <div className="logout-overlay-actions">
        <button className="logout-cancel-btn" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="logout-confirm-btn" onClick={onConfirm} disabled={loading}>
          {loading ? "Signing out…" : "Sign Out"}
        </button>
      </div>
    </div>
  </div>
);


const NavBar = () => {
  const location = useLocation();
  const navigate  = useNavigate();
  const { admin, markLoggedOut } = useAuth();
 const [search,          setSearch]          = useState("");
const [suggestions,     setSuggestions]     = useState([]);
const [showSuggestions, setShowSuggestions] = useState(false);
const [searchLoading,   setSearchLoading]   = useState(false);
const [viewLead,        setViewLead]        = useState(null);
const [viewLoading,     setViewLoading]     = useState(false);
const debounceRef = useRef(null);
const abortRef     = useRef(null);

  
  const [showNotif,     setShowNotif]     = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut,    setLoggingOut]    = useState(false);


  // PLACEMENT: add after the new state declarations, before handleLogout

useEffect(() => {
  const query = search.trim();

  if (debounceRef.current) clearTimeout(debounceRef.current);

  if (query.length < 2) {
    setSuggestions([]);
    setShowSuggestions(false);
    setSearchLoading(false);
    return;
  }

  debounceRef.current = setTimeout(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSearchLoading(true);
    setShowSuggestions(true);

    try {
      // ⚠️ ASSUMPTION — adjust base path if your backend isn't proxied at same origin
      const res = await fetch(
        `${API_BASE}/search?query=${encodeURIComponent(query)}&limit=8`,
        { signal: controller.signal, credentials: "include" }
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      setSuggestions(data);
    } catch (err) {
      if (err.name !== "AbortError") {
        setSuggestions([]);
      }
    } finally {
      setSearchLoading(false);
    }
  }, 300);

  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };
}, [search]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutApi(); // clears admin_token + refresh_token httpOnly cookies server-side
    } catch (err) {
      // even if the API call fails, clear local state so the user isn't stuck logged in visually
    } finally {
      markLoggedOut();
      setLoggingOut(false);
      setShowLogoutConfirm(false);
      navigate("/login", { replace: true }); // works from any page — NavBar is centralized
    }
  };

  const meta     = ROUTE_META[location.pathname] || { label: "Page", parent: null };
  const unreadCount = 2;


  const handleSearchKeyDown = (e) => {
    if (e.key === "Escape") {
      setShowSuggestions(false);
      setSearch("");
    }
  };

  const handleViewLead = async (leadPrimeId) => {
  setShowSuggestions(false);
  setViewLead({});       // opens overlay immediately in loading state
  setViewLoading(true);
  try {
    const res = await fetch(`${API_BASE}/${leadPrimeId}`);
    if (!res.ok) throw new Error("Failed to load lead");
    setViewLead(await res.json());
  } catch (err) {
    console.error("Failed to fetch lead detail:", err);
    setViewLead(null);
  } finally {
    setViewLoading(false);
  }
};

  return (
    <header className="navbar">

      {/* ── Left: Breadcrumb ── */}
      <div className="navbar-left">
        {meta.parent && (
          <>
            <button
              className="navbar-bc-parent"
              onClick={() => navigate("/dashboard")}
            >
              {meta.parent}
            </button>
            <span className="navbar-bc-sep">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </span>
          </>
        )}
        <span className="navbar-bc-current">{meta.label}</span>
      </div>

      {/* ── Center: Search ── */}
      
<div className="navbar-search-wrap">
  <span className="navbar-search-icon" aria-hidden="true">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  </span>
  <input
    className="navbar-search"
    type="text"
    placeholder="Search name, mobile, company…"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    onKeyDown={handleSearchKeyDown}
    onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
  />
  <span className="navbar-search-kbd">⌘K</span>

  {showSuggestions && (
    <SearchSuggestions
      results={suggestions}
      loading={searchLoading}
      onView={handleViewLead}
      onClose={() => setShowSuggestions(false)}
    />
  )}
</div>

      {/* ── Right: Actions ── */}
      <div className="navbar-right">

        {/* Notification bell */}
        <div className="navbar-action-wrap">
          <button
            className={`navbar-action-btn ${showNotif ? "navbar-action-active" : ""}`}
            onClick={() => { setShowNotif((p) => !p); setShowProfile(false); }}
            aria-label="Notifications"
            title="Notifications"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="navbar-badge">{unreadCount}</span>
            )}
          </button>
          {showNotif && <NotificationPanel onClose={() => setShowNotif(false)} />}
        </div>

        {/* Divider */}
        <div className="navbar-vdiv" />

        {/* Profile */}
        <div className="navbar-action-wrap">
          <button
            className={`navbar-profile-btn ${showProfile ? "navbar-action-active" : ""}`}
            onClick={() => { setShowProfile((p) => !p); setShowNotif(false); }}
            aria-label="Profile menu"
          >
            <div className="navbar-avatar">A</div>
            <div className="navbar-profile-info">
              <span className="navbar-profile-name">Admin</span>
               <p className="profile-email">{admin?.role || ""}</p>
            </div>
            <span className="navbar-chevron" style={{ transform: showProfile ? "rotate(180deg)" : "rotate(0deg)" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </span>
          </button>
          {showProfile && (
            <ProfilePanel
              admin={admin}
              onClose={() => setShowProfile(false)}
              onLogoutClick={() => { setShowProfile(false); setShowLogoutConfirm(true); }}
            />
          )}
        </div>

      </div>

      {viewLead && createPortal(
        <NavLeadViewOverlay
          lead={viewLead}
          loading={viewLoading}
          onClose={() => setViewLead(null)}
        />,
        document.body
      )}

      {showLogoutConfirm && createPortal(
        <LogoutConfirmOverlay
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
          loading={loggingOut}
        />,
        document.body
      )}
    </header>
  );
};

export default NavBar;