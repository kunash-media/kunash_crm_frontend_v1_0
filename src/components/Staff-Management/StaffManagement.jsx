import "../Staff-Management/StaffManagement.css";
import { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {Eye, Pencil} from "lucide-react";

const API_STAFF = "http://localhost:9090/api/v1/staff";
const API_LEAD = "http://localhost:9090/api/lead/v1";

const EMPTY_FORM = {
  staffFirstName: "",
  staffMiddleName: "",
  staffLastName: "",
  staffMobile: "",
  staffEmail: "",
  staffWorkingEmail: "",
  staffAddress: "",
  staffSalary: "",
  joiningDate: "",
  staffRole: "",
  staffDepartment: "",
  staffPassword: "",
};

const StaffManagement = () => {
  const [staffList, setStaffList] = useState([]);
  const [stats, setStats] = useState({ totalStaff: 0, totalLeads: 0, pendingFollowups: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // overlay: { mode: "view" | "edit" | "add" | "delete", staff: {...} | null }
  const [overlay, setOverlay] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [assignedLeads, setAssignedLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  const fetchStaff = useCallback(async (pageNum = 0) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_STAFF}?page=${pageNum}&size=20`);
      if (!res.ok) throw new Error("Failed to load staff list");
      const data = await res.json();
      setStaffList(data.content || []);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load staff list");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_STAFF}/stats`);
      if (!res.ok) throw new Error("Failed to load stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchStaff(page);
  }, [page, fetchStaff]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setErrors({});
    setOverlay({ mode: "add", staff: null });
  };

  const openView = async (staff) => {
    setOverlay({ mode: "view", staff });
    setAssignedLeads([]);
    setLeadsLoading(true);
    try {
      const res = await fetch(`${API_LEAD}/by-staff/${staff.staffPrimeId}?page=0&size=50`);
      if (res.ok) {
        const data = await res.json();
        setAssignedLeads(data.content || []);
      }
    } catch (err) {
      console.error("Failed to load assigned leads:", err);
    } finally {
      setLeadsLoading(false);
    }
  };

  const openEdit = (staff) => {
    setForm({
      staffFirstName: staff.staffFirstName || "",
      staffMiddleName: staff.staffMiddleName || "",
      staffLastName: staff.staffLastName || "",
      staffMobile: staff.staffMobile || "",
      staffEmail: staff.staffEmail || "",
      staffWorkingEmail: staff.staffWorkingEmail || "",
      staffAddress: staff.staffAddress || "",
      staffSalary: staff.staffSalary || "",
      joiningDate: staff.joiningDate || "",
      staffRole: staff.staffRole || "",
      staffDepartment: staff.staffDepartment || "",
      staffPassword: "",
    });
    setErrors({});
    setOverlay({ mode: "edit", staff });
  };

  const openDeleteConfirm = (staff) => {
    setOverlay({ mode: "delete", staff });
  };

  const closeOverlay = () => {
    if (isSaving) return;
    setOverlay(null);
    setAssignedLeads([]);
  };

  const validate = (isAdd) => {
    const err = {};
    if (!form.staffFirstName.trim()) err.staffFirstName = "First name is required";
    if (!form.staffLastName.trim()) err.staffLastName = "Last name is required";
    if (!form.staffEmail.trim() || !/\S+@\S+\.\S+/.test(form.staffEmail)) err.staffEmail = "Valid email is required";
    if (!form.staffMobile.trim() || !/^[6-9]\d{9}$/.test(form.staffMobile)) err.staffMobile = "Enter a valid 10-digit mobile number";
    if (!form.staffRole.trim()) err.staffRole = "Role is required";
    if (isAdd && !form.staffPassword.trim()) err.staffPassword = "Password is required";
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleAddSave = async () => {
    if (!validate(true)) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setIsSaving(true);
    try {
      const payload = { ...form, staffSalary: form.staffSalary ? Number(form.staffSalary) : null };
      const res = await fetch(API_STAFF, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || "Staff with this email/mobile already exists");
      }
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      toast.success("Staff added successfully");
      closeOverlay();
      fetchStaff(page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || "Failed to add staff");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!validate(false)) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setIsSaving(true);
    try {
      const { staffPassword, ...rest } = form; // eslint-disable-line no-unused-vars
      const payload = { ...rest, staffSalary: form.staffSalary ? Number(form.staffSalary) : null };
      const res = await fetch(`${API_STAFF}/${overlay.staff.staffPrimeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 409) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || "Staff with this email/mobile already exists");
      }
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      toast.success("Staff updated successfully");
      closeOverlay();
      fetchStaff(page);
    } catch (err) {
      toast.error(err.message || "Failed to update staff");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_STAFF}/${overlay.staff.staffPrimeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      toast.success(
        `${overlay.staff.staffFirstName} ${overlay.staff.staffLastName} removed — their leads have been unassigned`
      );
      closeOverlay();
      fetchStaff(page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || "Failed to delete staff");
    } finally {
      setIsSaving(false);
    }
  };

  const fullName = (s) => [s.staffFirstName, s.staffMiddleName, s.staffLastName].filter(Boolean).join(" ");

  return (
    <div className="staff-root">
      <div className="staff-header">
        <div>
          <h1 className="staff-title">Staff Management</h1>
          <p className="staff-subtitle">Manage your team and lead assignments</p>
        </div>
        <button className="btn-save" onClick={openAdd}>+ Add Staff</button>
      </div>

      {/* Stat Cards */}
      <div className="staff-stats-grid">
        <div className="staff-stat-card">
          <span className="staff-stat-label">Total Staff</span>
          <span className="staff-stat-value">{stats.totalStaff}</span>
        </div>
        <div className="staff-stat-card">
          <span className="staff-stat-label">Total Leads</span>
          <span className="staff-stat-value">{stats.totalLeads}</span>
        </div>
        <div className="staff-stat-card staff-stat-card-warn">
          <span className="staff-stat-label">Pending Followups</span>
          <span className="staff-stat-value">{stats.pendingFollowups}</span>
        </div>
      </div>

      {/* Table */}
      <div className="staff-table-wrap">
        {loading ? (
          <div className="staff-empty">Loading staff...</div>
        ) : staffList.length === 0 ? (
          <div className="staff-empty">No staff records yet. Add your first staff member.</div>
        ) : (
          <table className="staff-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Name</th>
                <th>Role</th>
                <th>Department</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Joining Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {staffList.map((s) => (
                <tr key={s.staffPrimeId}>
                  <td>{s.staffStrId}</td>
                  <td>{fullName(s)}</td>
                  <td>{s.staffRole}</td>
                  <td>{s.staffDepartment}</td>
                  <td>{s.staffMobile}</td>
                  <td>{s.staffEmail}</td>
                  <td>{s.joiningDate ? new Date(s.joiningDate).toLocaleDateString("en-IN") : "—"}</td>
                  <td className="staff-actions">
                    <button className="staff-action-btn" title="View" onClick={() => openView(s)}><Eye size={15}style={{marginLeft:6}} ></Eye></button>
                    <button className="staff-action-btn" title="Edit" onClick={() => openEdit(s)}><Pencil size={15} style={{marginLeft:6}}></Pencil></button>
                    <button className="staff-action-btn staff-action-danger" title="Delete" onClick={() => openDeleteConfirm(s)}>🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div className="staff-pagination">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span>Page {page + 1} of {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>

      {/* ── Overlay: Add / Edit ── */}
      {(overlay?.mode === "add" || overlay?.mode === "edit") && (
        <div className="staff-overlay-backdrop" onClick={(e) => e.target === e.currentTarget && closeOverlay()}>
          <div className="staff-overlay-card">
            <div className="staff-overlay-header">
              <h3>{overlay.mode === "add" ? "Add Staff" : "Edit Staff"}</h3>
              <button className="staff-close-btn" onClick={closeOverlay} disabled={isSaving}>✕</button>
            </div>

            <div className="staff-form-grid">
              <div className="fg">
                <label>First Name <span className="required">*</span></label>
                <input name="staffFirstName" value={form.staffFirstName} onChange={handleChange} className={errors.staffFirstName ? "error" : ""} disabled={isSaving} />
                {errors.staffFirstName && <span className="error-msg">{errors.staffFirstName}</span>}
              </div>

              <div className="fg">
                <label>Middle Name</label>
                <input name="staffMiddleName" value={form.staffMiddleName} onChange={handleChange} disabled={isSaving} />
              </div>

              <div className="fg">
                <label>Last Name <span className="required">*</span></label>
                <input name="staffLastName" value={form.staffLastName} onChange={handleChange} className={errors.staffLastName ? "error" : ""} disabled={isSaving} />
                {errors.staffLastName && <span className="error-msg">{errors.staffLastName}</span>}
              </div>

              <div className="fg">
                <label>Mobile <span className="required">*</span></label>
                <input name="staffMobile" value={form.staffMobile} onChange={handleChange} maxLength={10} className={errors.staffMobile ? "error" : ""} disabled={isSaving} />
                {errors.staffMobile && <span className="error-msg">{errors.staffMobile}</span>}
              </div>

              <div className="fg">
                <label>Email <span className="required">*</span></label>
                <input type="email" name="staffEmail" value={form.staffEmail} onChange={handleChange} className={errors.staffEmail ? "error" : ""} disabled={isSaving} />
                {errors.staffEmail && <span className="error-msg">{errors.staffEmail}</span>}
              </div>

              <div className="fg">
                <label>Working Email</label>
                <input type="email" name="staffWorkingEmail" value={form.staffWorkingEmail} onChange={handleChange} disabled={isSaving} />
              </div>

              <div className="fg">
                <label>Role <span className="required">*</span></label>
                <input name="staffRole" value={form.staffRole} onChange={handleChange} className={errors.staffRole ? "error" : ""} disabled={isSaving} />
                {errors.staffRole && <span className="error-msg">{errors.staffRole}</span>}
              </div>

              <div className="fg">
                <label>Department</label>
                <input name="staffDepartment" value={form.staffDepartment} onChange={handleChange} disabled={isSaving} />
              </div>

              <div className="fg">
                <label>Salary</label>
                <input type="number" name="staffSalary" value={form.staffSalary} onChange={handleChange} disabled={isSaving} />
              </div>

              <div className="fg">
                <label>Joining Date</label>
                <input type="date" name="joiningDate" value={form.joiningDate} onChange={handleChange} disabled={isSaving} />
              </div>

              <div className="fg full">
                <label>Address</label>
                <input name="staffAddress" value={form.staffAddress} onChange={handleChange} disabled={isSaving} />
              </div>

              {overlay.mode === "add" && (
                <div className="fg full">
                  <label>Password <span className="required">*</span></label>
                  <input type="password" name="staffPassword" value={form.staffPassword} onChange={handleChange} className={errors.staffPassword ? "error" : ""} disabled={isSaving} />
                  {errors.staffPassword && <span className="error-msg">{errors.staffPassword}</span>}
                </div>
              )}
            </div>

            <div className="staff-overlay-actions">
              <button className="btn-cancel" onClick={closeOverlay} disabled={isSaving}>Cancel</button>
              <button className="btn-save" onClick={overlay.mode === "add" ? handleAddSave : handleEditSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay: View ── */}
      {overlay?.mode === "view" && (
        <div className="staff-overlay-backdrop" onClick={(e) => e.target === e.currentTarget && closeOverlay()}>
          <div className="staff-overlay-card">
            <div className="staff-overlay-header">
              <h3>{fullName(overlay.staff)}</h3>
              <button className="staff-close-btn" onClick={closeOverlay}>✕</button>
            </div>

            <div className="staff-view-grid">
              <div><span className="staff-view-label">Staff ID</span><span>{overlay.staff.staffStrId}</span></div>
              <div><span className="staff-view-label">Role</span><span>{overlay.staff.staffRole}</span></div>
              <div><span className="staff-view-label">Department</span><span>{overlay.staff.staffDepartment || "—"}</span></div>
              <div><span className="staff-view-label">Mobile</span><span>{overlay.staff.staffMobile}</span></div>
              <div><span className="staff-view-label">Email</span><span>{overlay.staff.staffEmail}</span></div>
              <div><span className="staff-view-label">Working Email</span><span>{overlay.staff.staffWorkingEmail || "—"}</span></div>
              <div><span className="staff-view-label">Joining Date</span><span>{overlay.staff.joiningDate ? new Date(overlay.staff.joiningDate).toLocaleDateString("en-IN") : "—"}</span></div>
              <div className="staff-view-full"><span className="staff-view-label">Address</span><span>{overlay.staff.staffAddress || "—"}</span></div>
            </div>

            <div className="staff-assigned-leads">
              <h4>Assigned Leads</h4>
              {leadsLoading ? (
                <p className="staff-empty-sub">Loading leads...</p>
              ) : assignedLeads.length === 0 ? (
                <p className="staff-empty-sub">No leads currently assigned.</p>
              ) : (
                <table className="staff-mini-table">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Follow-up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignedLeads.map((l) => (
                      <tr key={l.leadPrimeId}>
                        <td>{l.firstName} {l.lastName}</td>
                        <td>{l.company || "—"}</td>
                        <td>{l.status}</td>
                        <td>{l.followUpDate ? new Date(l.followUpDate).toLocaleDateString("en-IN") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay: Delete confirm ── */}
      {overlay?.mode === "delete" && (
        <div className="staff-overlay-backdrop" onClick={(e) => e.target === e.currentTarget && closeOverlay()}>
          <div className="staff-overlay-card staff-overlay-card-sm">
            <div className="staff-overlay-header">
              <h3>Remove Staff</h3>
              <button className="staff-close-btn" onClick={closeOverlay} disabled={isSaving}>✕</button>
            </div>
            <p className="staff-delete-msg">
              Remove <strong>{fullName(overlay.staff)}</strong>? Any leads currently assigned to them will become unassigned.
              This can be undone by an admin later.
            </p>
            <div className="staff-overlay-actions">
              <button className="btn-cancel" onClick={closeOverlay} disabled={isSaving}>Cancel</button>
              <button className="staff-btn-danger" onClick={handleDeleteConfirm} disabled={isSaving}>
                {isSaving ? "Removing..." : "Remove Staff"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;