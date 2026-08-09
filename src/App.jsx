import "./components/Asidebar-Navbar/layout.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./routes/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import AsideBar from "./components/Asidebar-Navbar/AsideBar.jsx";
import NavBar   from "./components/Asidebar-Navbar/NavBar.jsx";
import Dashboard from "./components/Dashboard/Dashboard.jsx";
import AddLead from "./components/Lead-Form/AddLead.jsx";
import Invoice from "./components/Invoice/Invoice.jsx";
import ClientList from "./components/Client-List/ClientList.jsx";
import WFormatter from "./components/W-Formatter/WFormatter.jsx";
import LoginForm from "./components/Login-Form/LoginForm.jsx";
import StaffManagement from "./components/Staff-Management/StaffManagement.jsx";

/* ─────────────────────────────────────────────────────────────
   AUTH GUARD — dummy session check for now.
   Swap isAuthed() with a real token/session check once the
   backend auth API is wired.
───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   PLACEHOLDER — swap each one for the real component once built
───────────────────────────────────────────────────────────── */
const ComingSoon = ({ title }) => (
  <div style={{
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    height: "60vh", gap: "12px",
  }}>
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
      stroke="var(--or-400, #fb923c)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
    <h2 style={{ fontFamily: "var(--ff-display,'Space Grotesk',sans-serif)", fontSize: "20px", fontWeight: 700, color: "var(--tx-hi,#1c0d03)" }}>
      {title}
    </h2>
    <p style={{ fontSize: "14px", color: "var(--tx-mute,#b07850)" }}>
      This section is coming soon.
    </p>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   LAYOUT WRAPPER — AsideBar + NavBar + page content
   All new routes just need a <Route> added below.
───────────────────────────────────────────────────────────── */
const AppLayout = ({ children }) => (
  <div className="app-shell">
    <AsideBar />
    <div className="app-main">
      <NavBar />
      <main className="app-content">
        {children}
      </main>
    </div>
  </div>
);

function App() {
  const { isAuthenticated } = useAuth();
  return (
  <>
    <ToastContainer position="top-right" autoClose={3000} />
    <Routes>
      {/* <Route path="/" element={<Navigate to={isAuthed() ? "/dashboard" : "/login"} replace />} /> */}
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      <Route path="/login" element={<LoginForm />} />

      <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
      <Route path="/leads/add" element={<ProtectedRoute><AppLayout><AddLead /></AppLayout></ProtectedRoute>} />
      <Route path="/clients" element={<ProtectedRoute><AppLayout><ClientList /></AppLayout></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><AppLayout><Invoice /></AppLayout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><AppLayout><ComingSoon title="Reports" /></AppLayout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppLayout><ComingSoon title="Settings" /></AppLayout></ProtectedRoute>} />
      <Route path="/w-formatter" element={<ProtectedRoute><AppLayout><WFormatter title="W-formatter" /></AppLayout></ProtectedRoute>} />
      <Route path="/staff" element={<ProtectedRoute><AppLayout><StaffManagement title="staff" /></AppLayout></ProtectedRoute>} />


      <Route path="*" element={<ProtectedRoute><AppLayout><ComingSoon title="Page Not Found" /></AppLayout></ProtectedRoute>} />
    </Routes>
  </>
  );
}

export default App;