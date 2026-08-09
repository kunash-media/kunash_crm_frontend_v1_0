import "../Lead-Form/AddLead.css";
import { UploadCloud } from "lucide-react";
import { useState, useEffect, useRef} from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE = "http://localhost:9090/api/lead/v1"; // adjust if your backend runs on a different origin, e.g. http://localhost:8080/api/lead/v1

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STATUS_CFG = {
  hot:  { label: "Hot",  color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  warm: { label: "Warm", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cold: { label: "Cold", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
};

const PRIORITY_CFG = {
  P1: { color: "#ef4444", label: "High" },
  P2: { color: "#f59e0b", label: "Medium" },
  P3: { color: "#3b82f6", label: "Low" },
};

const LEAD_SOURCES = ["Website", "Referral", "Cold Call", "LinkedIn", "Event", "WhatsApp", "Inbound Email", "Other"];

const REQUIREMENT_CATEGORIES = [
  "Website Design",
  "Ecommerce Website",
  "Dynamic Website",
  "Landing Page",
  "Google Ads",
  "Meta Ads",
  "LinkedIn Marketing",
  "SEO",
  "Social Media Marketing",
  "Graphic Design",
  "Software Development",
  "Mobile App",
  "HRMS",
  "CRM",
  "Custom Development",
  "Other",
];

const EMPTY_LEAD = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  status: "warm",
  priority: "P2",
  followUpDate: "",
  followupStatus: "pending",
  notes: "",
  source: "Website",
  requirementCategory: REQUIREMENT_CATEGORIES[0],
  tags: "",
  assignedStaffId: "",
};

const AddLead = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_LEAD);
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const [attachments, setAttachments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [phoneCheck, setPhoneCheck] = useState({ checking: false, exists: false, checkedFor: "", existingLead: null });
  
  const [showBulkOverlay, setShowBulkOverlay] = useState(false);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResult, setBulkResult] = useState(null); // { totalRows, totalUploaded, totalSkipped, errors[] }
  const [bulkError, setBulkError] = useState("");


   useEffect(() => {
    fetch("http://localhost:9090/api/v1/staff/dropdown")
      .then(res => res.json())
      .then(data => setStaffList(data))
      .catch(err => console.error("Failed to load staff dropdown:", err));
  }, []);
  
  // Auto-set follow-up date to tomorrow by default
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const defaultDate = tomorrow.toISOString().split('T')[0];
    setForm(prev => ({ ...prev, followUpDate: defaultDate }));
  }, []);

 const phoneCheckTimer = useRef(null);
   const phoneCheckSeq = useRef(0);

  const handleChange = (e) => {
    const { name } = e.target;
    let { value } = e.target;

    if (name === "phone") {
      value = value.replace(/\D/g, "").slice(0, 10);
    }

    setForm(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));

    if (name === "phone") {
      if (phoneCheck.checkedFor && value !== phoneCheck.checkedFor) {
        setPhoneCheck({ checking: false, exists: false, checkedFor: "", existingLead: null });
      }

      if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current);

      if (value.length === 10) {
        phoneCheckTimer.current = setTimeout(() => {
          checkPhoneExists(value);
        }, 300); // debounce so we don't fire on every keystroke
      }
    }
  };

  useEffect(() => {
    return () => {
      if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current);
    };
  }, []);

   const checkPhoneExists = async (phone) => {
    const trimmed = phone.trim();
    if (trimmed.length < 10) return;

    // monotonic guard — only the most recently fired request is allowed to update state
    const seq = ++phoneCheckSeq.current;

    setPhoneCheck(prev => ({ ...prev, checking: true }));
    try {
      const res = await fetch(`${API_BASE}/check-phone?phone=${encodeURIComponent(trimmed)}`);
      if (seq !== phoneCheckSeq.current) return; // a newer request superseded this one — ignore stale response

      if (res.status === 204) {
        setPhoneCheck({ checking: false, exists: false, checkedFor: trimmed, existingLead: null });
        return;
      }
      if (res.ok) {
        const existingLead = await res.json();
        if (seq !== phoneCheckSeq.current) return;
        setPhoneCheck({ checking: false, exists: true, checkedFor: trimmed, existingLead });
        setErrors(prev => ({ ...prev, phone: `Already exists — ${existingLead.firstName} ${existingLead.lastName} (${existingLead.leadStrId})` }));
        return;
      }
      setPhoneCheck(prev => ({ ...prev, checking: false }));
    } catch (err) {
      if (seq !== phoneCheckSeq.current) return;
      console.error("Phone check failed:", err);
      setPhoneCheck(prev => ({ ...prev, checking: false }));
    }
  };

  const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp";
  const MAX_FILE_SIZE_MB = 10;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setErrors(prev => ({ ...prev, attachments: `${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit` }));
        continue;
      }
      valid.push(file);
    }
    if (valid.length) {
      setAttachments(prev => [...prev, ...valid]);
      setErrors(prev => ({ ...prev, attachments: "" }));
    }
    e.target.value = "";
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const BULK_ACCEPTED_TYPES = ".xlsx,.xls,.csv";

const handleBulkFileSelect = (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setBulkFile(file);
  setBulkResult(null);
  setBulkError("");
};

const resetBulkOverlay = () => {
  setShowBulkOverlay(false);
  setBulkFile(null);
  setBulkUploading(false);
  setBulkProgress(0);
  setBulkResult(null);
  setBulkError("");
};

const handleBulkUpload = () => {
  if (!bulkFile) return;
  setBulkUploading(true);
  setBulkProgress(0);
  setBulkError("");
  setBulkResult(null);

  const formData = new FormData();
  formData.append("file", bulkFile);

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `${API_BASE}/bulk-upload`, true);

  xhr.upload.onprogress = (evt) => {
    if (evt.lengthComputable) {
      setBulkProgress(Math.round((evt.loaded / evt.total) * 100));
    }
  };

  xhr.onload = () => {
    setBulkUploading(false);
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        const data = JSON.parse(xhr.responseText);
        setBulkResult(data);
        setBulkProgress(100);
        if (data.totalUploaded > 0) {
          toast.success(`${data.totalUploaded} lead(s) uploaded successfully`);
        }
      } catch {
        setBulkError("Upload finished but response could not be read.");
      }
    } else {
      setBulkError("Upload failed. Please check the file and try again.");
    }
  };

  xhr.onerror = () => {
    setBulkUploading(false);
    setBulkError("Upload failed. Please check your connection and try again.");
  };

  xhr.send(formData);
};

const exportBulkResultToWord = () => {
  if (!bulkResult) return;
  const { totalRows, totalUploaded, totalSkipped, errors = [] } = bulkResult;
  const dateStr = new Date().toLocaleString('en-IN');

  const rowsHtml = errors.length
    ? errors.map(e => `
        <tr>
          <td style="border:1px solid #ddd;padding:8px;">${e.rowNumber}</td>
          <td style="border:1px solid #ddd;padding:8px;">${e.reason}</td>
        </tr>`).join("")
    : `<tr><td colspan="2" style="border:1px solid #ddd;padding:8px;">No skipped entries — all rows uploaded successfully.</td></tr>`;

  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset="utf-8"><title>Bulk Upload Report</title></head>
    <body style="font-family:Calibri,Arial,sans-serif;">
      <h2 style="color:#1f2937;">Lead Bulk Upload Report</h2>
      <p style="color:#6b7280;font-size:12px;">Generated on ${dateStr}</p>
      <table style="border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:8px 16px 8px 0;"><strong>Total rows in file:</strong></td>
          <td>${totalRows}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#16a34a;"><strong>Successfully uploaded:</strong></td>
          <td style="color:#16a34a;">${totalUploaded}</td>
        </tr>
        <tr>
          <td style="padding:8px 16px 8px 0;color:#dc2626;"><strong>Skipped:</strong></td>
          <td style="color:#dc2626;">${totalSkipped}</td>
        </tr>
      </table>
      <h3 style="color:#1f2937;">Skipped Entries — Reasons</h3>
      <table style="border-collapse:collapse;width:100%;">
        <tr style="background:#f3f4f6;">
          <th style="border:1px solid #ddd;padding:8px;text-align:left;">Row No.</th>
          <th style="border:1px solid #ddd;padding:8px;text-align:left;">Reason</th>
        </tr>
        ${rowsHtml}
      </table>
    </body>
    </html>`;

    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lead_Bulk_Upload_Report_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const validate = () => {
    const err = {};
    if (!form.firstName.trim()) err.firstName = "First name is required";
    if (!form.lastName.trim()) err.lastName = "Last name is required";
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) err.email = "Valid email is required";
    
   if (!form.phone.trim()) {
      err.phone = "Phone number is required";
    } else if (!/^[6-9]\d{9}$/.test(form.phone)) {
      err.phone = "Enter a valid 10-digit mobile number";
    } else if (phoneCheck.exists && phoneCheck.checkedFor === form.phone) {
      err.phone = `Already exists — ${phoneCheck.existingLead?.firstName} ${phoneCheck.existingLead?.lastName}`;
    }
    if (!form.followUpDate) err.followUpDate = "Follow-up date is required";

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setIsSaving(true);

    try {
      const leadPayload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        company: form.company,
        status: form.status,
        priority: form.priority,
        source: form.source,
        requirementCategory: form.requirementCategory,
        tags: form.tags,
        followUpDate: form.followUpDate,
        followupStatus: form.followupStatus,
        notes: form.notes,
        leadConverted: false,
        assignedStaffId: form.assignedStaffId ? Number(form.assignedStaffId) : null,
      };

      const formData = new FormData();
      formData.append(
        "lead",
        new Blob([JSON.stringify(leadPayload)], { type: "application/json" })
      );

      // backend currently accepts a single docFile part — sending the first attachment only
      if (attachments.length > 0) {
        formData.append("docFile", attachments[0]);
      }

      const response = await fetch(`${API_BASE}`, {
        method: "POST",
        body: formData,
      });

      if (response.status === 409) {
        const errBody = await response.json().catch(() => null);
        throw new Error(errBody?.message || "A lead with this phone/email already exists");
      }
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(errText || `Request failed with status ${response.status}`);
      }

      const created = await response.json();

      toast.success(`Lead ${created.firstName} ${created.lastName} created successfully!`);
      navigate("/dashboard");
    } catch (err) {
      console.error("Failed to create lead:", err);
      toast.error(err.message || "Failed to create lead. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="add-lead-page">
      <div className="add-lead-header">
        <div>
          <h1 className="add-lead-title">Add New Lead</h1>
          <p className="add-lead-subtitle">Capture a new business opportunity</p>
        </div>

        <div className="header-actions">

          <button className="flex justify-center btn-bulk" onClick={() => setShowBulkOverlay(true)} disabled={isSaving}>
            <UploadCloud size={15} strokeWidth={2} style={{ marginRight: 6, verticalAlign: "middle" }} />
            Bulk Upload
          </button>
          <button className="btn-cancel" onClick={() => navigate("/dashboard")} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn-save"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                Saving Lead...
              </span>
            ) : (
              "Save Lead"
            )}
          </button>
        </div>
      </div>

      <div className="add-lead-content">
        {/* Main Form */}
        <div className="add-lead-form">
          <div className="form-grid">

            {/* Basic Info */}
            <div className="form-section">
              <h3 className="section-title">Basic Information</h3>

              <div className="fg">
                <label>First Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="firstName"
                  value={form.firstName}
                  onChange={handleChange}
                  placeholder="Arjun"
                  className={errors.firstName ? "error" : ""}
                  disabled={isSaving}
                />
                {errors.firstName && <span className="error-msg">{errors.firstName}</span>}
              </div>

              <div className="fg">
                <label>Last Name <span className="required">*</span></label>
                <input
                  type="text"
                  name="lastName"
                  value={form.lastName}
                  onChange={handleChange}
                  placeholder="Mehta"
                  className={errors.lastName ? "error" : ""}
                  disabled={isSaving}
                />
                {errors.lastName && <span className="error-msg">{errors.lastName}</span>}
              </div>

              <div className="fg">
                <label>Email Address <span className="required">*</span></label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="arjun@techwave.io"
                  className={errors.email ? "error" : ""}
                  disabled={isSaving}
                />
                {errors.email && <span className="error-msg">{errors.email}</span>}
              </div>

              <div className="fg">
                <label>Phone Number <span className="required">*</span></label>
                <input
                  type="tel"
                  name="phone"
                  value={form.phone}
                  onChange={handleChange}
                   onBlur={(e) => {
                    if (phoneCheckTimer.current) clearTimeout(phoneCheckTimer.current);
                    checkPhoneExists(e.target.value);
                  }}
                  placeholder="9820133410"
                  maxLength={10}
                  inputMode="numeric"
                  className={errors.phone ? "error" : ""}
                  disabled={isSaving}
                />
                {phoneCheck.checking && <span className="hint-msg">Checking...</span>}
                {errors.phone && <span className="error-msg">{errors.phone}</span>}
              </div>

              <div className="fg">
                <label>Company</label>
                <input
                  type="text"
                  name="company"
                  value={form.company}
                  onChange={handleChange}
                  placeholder="TechWave Solutions"
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Lead Details */}
            <div className="form-section">
              <h3 className="section-title">Lead Details</h3>

              <div className="fg">
                <label>Status</label>
                <div className="status-options">
                  {Object.keys(STATUS_CFG).map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`status-chip ${form.status === s ? "active" : ""}`}
                      style={{
                        background: form.status === s ? STATUS_CFG[s].bg : "",
                        color: form.status === s ? STATUS_CFG[s].color : "",
                        border: form.status === s ? `1px solid ${STATUS_CFG[s].color}` : "",
                      }}
                      onClick={() => setForm(prev => ({ ...prev, status: s }))}
                      disabled={isSaving}
                    >
                      {STATUS_CFG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fg">
                <label>Priority</label>
                <div className="prio-row">
                  {["P1", "P2", "P3"].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`prio-btn prio-${p.toLowerCase()} ${form.priority === p ? "active" : ""}`}
                      onClick={() => setForm(prev => ({ ...prev, priority: p }))}
                      disabled={isSaving}
                    >
                      {p} — {PRIORITY_CFG[p].label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="fg">
                <label>Source</label>
                <select name="source" value={form.source} onChange={handleChange} disabled={isSaving}>
                  {LEAD_SOURCES.map(src => (
                    <option key={src} value={src}>{src}</option>
                  ))}
                </select>
              </div>

              <div className="fg">
                <label>Requirement Category</label>
                <select name="requirementCategory" value={form.requirementCategory} onChange={handleChange} disabled={isSaving}>
                  {REQUIREMENT_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="fg">
                <label>Assign Staff</label>
                <select
                  name="assignedStaffId"
                  value={form.assignedStaffId}
                  onChange={handleChange}
                  disabled={isSaving}
                >
                  <option value="">Unassigned</option>
                  {staffList.map(s => (
                    <option key={s.staffPrimeId} value={s.staffPrimeId}>
                      {s.staffFirstName} {s.staffLastName} ({s.staffRole})
                    </option>
                  ))}
                </select>
              </div>

              <div className="fg">
                <label>Follow-up Date <span className="required">*</span></label>
                <input
                  type="date"
                  name="followUpDate"
                  value={form.followUpDate}
                  onChange={handleChange}
                  className={errors.followUpDate ? "error" : ""}
                  disabled={isSaving}
                />
                {errors.followUpDate && <span className="error-msg">{errors.followUpDate}</span>}
              </div>
            </div>

            {/* Additional Info */}
            <div className="form-section full-width">
              <h3 className="section-title">Additional Information</h3>

              <div className="fg full">
                <label>Tags (comma separated)</label>
                <input
                  type="text"
                  name="tags"
                  value={form.tags}
                  onChange={handleChange}
                  placeholder="enterprise, q3, demo"
                  disabled={isSaving}
                />
              </div>

             <div className="fg full">
                <label>Notes / Context</label>
                <textarea
                  name="notes"
                  rows={6}
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Requested enterprise demo. Very interested in Q3 rollout..."
                  disabled={isSaving}
                />
              </div>

              <div className="fg full">
               <label className="file-drop" htmlFor="lead-attachments">
                  <span className="file-drop-icon">📎 Upload file</span>
                  <span className="file-drop-hint">PDF, DOC, DOCX, JPG, PNG — up to {MAX_FILE_SIZE_MB}MB each</span>
                </label>
                <input
                  id="lead-attachments"
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={handleFileSelect}
                  className="file-input-hidden"
                  disabled={isSaving}
                />
                {errors.attachments && <span className="error-msg">{errors.attachments}</span>}

                {attachments.length > 0 && (
                  <div className="file-list">
                    {attachments.map((file, idx) => (
                      <div className="file-chip" key={`${file.name}-${idx}`}>
                        <span className="file-chip-name">{file.name}</span>
                        <span className="file-chip-size">{(file.size / 1024).toFixed(0)} KB</span>
                        <button
                          type="button"
                          className="file-chip-remove"
                          onClick={() => removeAttachment(idx)}
                          disabled={isSaving}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Preview Sidebar */}
        <div className="add-lead-preview">
          <div className="preview-card">
            <h4 className="preview-title ">Live Preview</h4>

            <div className="preview-content">
              <div className="preview-company">{form.company || "Company Name"}</div>

              <div className="preview-meta">
                <span className="preview-pill" style={{
                  color: STATUS_CFG[form.status].color,
                  background: STATUS_CFG[form.status].bg
                }}>
                  {STATUS_CFG[form.status].label}
                </span>
                <span className="preview-pill" style={{
                  color: PRIORITY_CFG[form.priority].color,
                  background: PRIORITY_CFG[form.priority].color + "15"
                }}>
                  {form.priority}
                </span>
              </div>

              <div className="preview-info">
                <p><strong>Email:</strong> {form.email || "—"}</p>
                <p><strong>Phone:</strong> {form.phone || "—"}</p>
                <p><strong>Follow-up:</strong> {form.followUpDate ? new Date(form.followUpDate).toLocaleDateString('en-IN') : "—"}</p>
              </div>

              {form.notes && (
                <div className="preview-notes">
                  <strong>Notes:</strong>
                  <p>{form.notes.slice(0, 120)}{form.notes.length > 120 ? "..." : ""}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showBulkOverlay && (
    <div className="bulk-overlay-backdrop" onClick={(e) => { if (e.target === e.currentTarget && !bulkUploading) resetBulkOverlay(); }}>
      <div className="bulk-overlay-card">
        <div className="bulk-overlay-header">
          <h3>Bulk Upload Leads</h3>
          {!bulkUploading && (
            <button className="bulk-close-btn" onClick={resetBulkOverlay}>✕</button>
          )}
        </div>

        {!bulkResult && (
          <>
            <p className="bulk-desc">
              Upload an Excel sheet (.xlsx, .xls, .csv) with these columns — any order, any case:
            </p>
            <div className="bulk-fields-chips">
              {["First Name", "Last Name", "Email", "Mobile", "Company", "Source"].map(f => (
                <span key={f} className="bulk-field-chip">{f}</span>
              ))}
            </div>
            <p className="bulk-desc-sub">
              First Name/Last Name, and Email or Mobile are required per row. Rows missing these, or with duplicate phone/email, will be skipped automatically.
            </p>

            <div className="fg full" style={{ marginTop: 16 }}>
              <label className="file-drop" htmlFor="bulk-lead-file">
                <span className="file-drop-icon">📄 {bulkFile ? bulkFile.name : "Choose Excel file"}</span>
                <span className="file-drop-hint">.xlsx, .xls, .csv</span>
              </label>
              <input
                id="bulk-lead-file"
                type="file"
                accept={BULK_ACCEPTED_TYPES}
                onChange={handleBulkFileSelect}
                className="file-input-hidden"
                disabled={bulkUploading}
              />
            </div>

            {bulkError && <span className="error-msg">{bulkError}</span>}

            {bulkUploading && (
              <div className="bulk-progress-wrap">
                <div className="bulk-progress-bar">
                  <div className="bulk-progress-fill" style={{ width: `${bulkProgress}%` }} />
                </div>
                <span className="bulk-progress-label">{bulkProgress}% uploaded</span>
              </div>
            )}

            <div className="bulk-overlay-actions">
              <button className="btn-cancel" onClick={resetBulkOverlay} disabled={bulkUploading}>Cancel</button>
              <button className="btn-save" onClick={handleBulkUpload} disabled={!bulkFile || bulkUploading}>
                {bulkUploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </>
        )}

      {bulkResult && (
        <>
          <div className="bulk-result-summary">
              <div className="bulk-stat">
                <span className="bulk-stat-value">{bulkResult.totalRows}</span>
                <span className="bulk-stat-label">Total Rows</span>
              </div>
              <div className="bulk-stat bulk-stat-success">
                <span className="bulk-stat-value">{bulkResult.totalUploaded}</span>
                <span className="bulk-stat-label">Uploaded</span>
              </div>
              <div className="bulk-stat bulk-stat-skip">
                <span className="bulk-stat-value">{bulkResult.totalSkipped}</span>
                <span className="bulk-stat-label">Skipped</span>
              </div>
            </div>

              {bulkResult.errors?.length > 0 && (
                <div className="bulk-error-list">
                  <p className="bulk-desc-sub" style={{ marginBottom: 8 }}>Why some rows were skipped:</p>
                  {bulkResult.errors.map((e, i) => (
                    <div className="bulk-error-row" key={i}>
                      <span className="bulk-error-row-num">Row {e.rowNumber}</span>
                      <span className="bulk-error-row-reason">{e.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="bulk-overlay-actions">
                <button className="btn-cancel" onClick={exportBulkResultToWord}>⬇ Export Report (Word)</button>
                <button className="btn-save" onClick={resetBulkOverlay}>Done</button>
              </div>
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AddLead;