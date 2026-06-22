/* Vendor Registration Wizard */

const STEPS = [
  { num: 1, label: "Company Info" },
  { num: 2, label: "Products" },
  { num: 3, label: "Documents" },
  { num: 4, label: "Banking" },
  { num: 5, label: "Review" },
];

const CATEGORIES = [
  "Chemicals","Raw Materials","Packaging","Lubricants","Spare Parts","Services","Other"
];

const MANDATORY_DOCS = [
  { key: "gst_certificate",         label: "GST Registration Certificate", mandatory: true },
  { key: "pan_card",                label: "PAN Card",                     mandatory: true },
  { key: "incorporation_certificate",label:"Company Incorporation Certificate",mandatory:true},
  { key: "bank_cheque",             label: "Bank Cancelled Cheque",        mandatory: true },
  { key: "msme_certificate",        label: "MSME Certificate",             mandatory: false },
  { key: "iso_certification",       label: "ISO / Quality Certification",  mandatory: false },
  { key: "other",                   label: "Any Other Certificate",        mandatory: false },
];

let _profile  = null;
let _curStep  = 1;

// ── Init ───────────────────────────────────────────────────────────────────────

async function initRegistrationWizard() {
  try {
    _profile = await api("GET", "/api/vendor/profile");
  } catch {
    return;
  }

  const status = _profile.status;
  const regWrap = document.getElementById("reg-wizard-wrap");
  const mainWrap = document.getElementById("main-portal-wrap");

  if (status === "approved") {
    regWrap.style.display  = "none";
    mainWrap.style.display = "block";
    return;
  }

  // Show wizard
  regWrap.style.display  = "block";
  mainWrap.style.display = "none";

  if (status === "submitted" || status === "under_review") {
    showSubmittedState();
    return;
  }
  if (status === "info_requested") {
    showInfoRequestedState(_profile.info_request_note);
    return;
  }
  if (status === "rejected") {
    showRejectedState(_profile.rejection_reason);
    return;
  }

  // Draft — show wizard
  _curStep = Math.max(1, Math.min(_profile.registration_step || 1, 5));
  renderWizard(_curStep);
}

// ── Status screens ─────────────────────────────────────────────────────────────

function showSubmittedState() {
  document.getElementById("reg-wizard-wrap").innerHTML = `
    <div style="max-width:560px;margin:60px auto;text-align:center;padding:0 20px">
      <div style="font-size:4rem;margin-bottom:16px">⏳</div>
      <h2 style="color:var(--brand-dark)">Registration Under Review</h2>
      <p style="margin:12px 0 28px;color:var(--gray-500)">
        Your registration has been submitted and is being reviewed by our team.
        We'll notify you via SMS and email once a decision is made.
      </p>
      <div class="alert alert-info" style="text-align:left">
        <strong>What happens next?</strong><br>
        Our procurement team reviews registrations within 2–3 business days.
        You'll receive an SMS and email notification once approved.
      </div>
      <button class="btn btn-ghost" style="margin-top:16px" onclick="logout()">Sign Out</button>
    </div>`;
}

function showInfoRequestedState(note) {
  document.getElementById("reg-wizard-wrap").innerHTML = `
    <div style="max-width:600px;margin:60px auto;padding:0 20px">
      <div style="text-align:center;margin-bottom:32px">
        <div style="font-size:3rem;margin-bottom:12px">ℹ️</div>
        <h2 style="color:var(--brand-dark)">Additional Information Required</h2>
        <p style="color:var(--gray-500)">Our team needs some additional information before approving your registration.</p>
      </div>
      <div class="alert alert-warning">
        <strong>Note from Amar Alum team:</strong><br>
        ${escHtml(note)}
      </div>
      <div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
        <button class="btn btn-primary btn-lg" onclick="resumeWizardForInfoRequest()">
          Update Registration
        </button>
        <button class="btn btn-ghost" onclick="logout()">Sign Out</button>
      </div>
    </div>`;
}

function resumeWizardForInfoRequest() {
  _curStep = 1;
  renderWizard(_curStep);
}

function showRejectedState(reason) {
  document.getElementById("reg-wizard-wrap").innerHTML = `
    <div style="max-width:560px;margin:60px auto;text-align:center;padding:0 20px">
      <div style="font-size:3.5rem;margin-bottom:16px">❌</div>
      <h2 style="color:var(--danger)">Registration Not Approved</h2>
      <div class="alert alert-danger" style="text-align:left;margin:20px 0">
        <strong>Reason:</strong><br>${escHtml(reason)}
      </div>
      <p style="color:var(--gray-500)">
        If you believe this is an error, please contact us at
        <a href="mailto:procurement@amaralum.com">procurement@amaralum.com</a>.
      </p>
      <button class="btn btn-ghost" style="margin-top:20px" onclick="logout()">Sign Out</button>
    </div>`;
}

// ── Wizard renderer ────────────────────────────────────────────────────────────

function renderWizard(step) {
  _curStep = step;
  const wrap = document.getElementById("reg-wizard-wrap");
  wrap.innerHTML = `
    <div style="max-width:760px;margin:0 auto;padding:24px 20px">
      <div style="margin-bottom:8px">
        <div style="font-size:1.25rem;font-weight:700;color:var(--brand-dark)">
          Complete Your Registration
        </div>
        <div style="font-size:.8125rem;color:var(--gray-500);margin-top:2px">
          Your draft is saved automatically. You can continue anytime within 30 days.
        </div>
      </div>
      ${renderProgressBar(step)}
      <div id="wizard-step-body" class="card" style="margin-top:24px">
        <div class="card-body">${renderStep(step)}</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:16px;gap:12px">
        ${step > 1 ? `<button class="btn btn-ghost" onclick="goToStep(${step-1})">← Back</button>` : '<span></span>'}
        <button class="btn btn-primary btn-lg" id="step-next-btn" onclick="submitStep(${step})">
          ${step < 5 ? "Save & Continue →" : "Submit Registration"}
        </button>
      </div>
    </div>`;

  // Bind file upload zones after render
  if (step === 3) initDocUploadZones();
  if (step === 5) populateReview();
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function renderProgressBar(current) {
  const pct = Math.round(((current - 1) / (STEPS.length - 1)) * 100);
  return `
    <div style="margin:20px 0 8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:.78rem;color:var(--gray-500)">Step ${current} of ${STEPS.length}</span>
        <span style="font-size:.78rem;color:var(--gray-500)">${pct}% complete</span>
      </div>
      <div style="background:var(--gray-200);border-radius:4px;height:6px">
        <div style="background:var(--brand-mid);width:${pct}%;height:6px;border-radius:4px;transition:width .3s"></div>
      </div>
    </div>
    <div class="wizard-steps">
      ${STEPS.map((s, i) => `
        <div class="wizard-step ${s.num < current ? 'done' : s.num === current ? 'active' : ''}">
          <div class="step-circle">${s.num < current ? '✓' : s.num}</div>
          <div class="step-label">${s.label}</div>
        </div>
        ${i < STEPS.length-1 ? `<div class="step-connector ${s.num < current ? 'done' : ''}"></div>` : ''}
      `).join('')}
    </div>`;
}

// ── Step templates ─────────────────────────────────────────────────────────────

function renderStep(n) {
  if (n === 1) return renderStep1();
  if (n === 2) return renderStep2();
  if (n === 3) return renderStep3();
  if (n === 4) return renderStep4();
  if (n === 5) return renderStep5();
  return "";
}

function v(field, fallback="") {
  return escHtml(_profile?.[field] ?? fallback);
}

function renderStep1() {
  const states = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh","Puducherry","Chandigarh","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep","Andaman and Nicobar Islands"];
  const stateOpts = states.map(s => `<option value="${s}" ${_profile?.reg_addr_state===s?"selected":""}>${s}</option>`).join("");
  const turnoverOpts = ["<1Cr","1-10Cr","10-50Cr","50-100Cr",">100Cr"].map(t =>
    `<option value="${t}" ${_profile?.annual_turnover_range===t?"selected":""}>${t}</option>`).join("");
  const typeOpts = ["Proprietorship","Partnership","Pvt Ltd","Ltd","LLP","Other"].map(t =>
    `<option value="${t}" ${_profile?.company_type===t?"selected":""}>${t}</option>`).join("");

  return `
    <h3 style="margin-bottom:20px">Step 1 — Company Information</h3>
    <div class="form-row">
      <div class="form-group">
        <label>Company Name (Legal) <span class="required">*</span></label>
        <input type="text" id="f-company_name" value="${v("company_name")}" placeholder="As per Certificate of Incorporation">
      </div>
      <div class="form-group">
        <label>Company Type <span class="required">*</span></label>
        <select id="f-company_type"><option value="">Select…</option>${typeOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>GSTIN <span class="required">*</span></label>
        <input type="text" id="f-gstin" value="${v("gstin")}" placeholder="22AAAAA0000A1Z5" maxlength="15" style="text-transform:uppercase">
      </div>
      <div class="form-group">
        <label>PAN Number <span class="required">*</span></label>
        <input type="text" id="f-pan_number" value="${v("pan_number")}" placeholder="AAAAA0000A" maxlength="10" style="text-transform:uppercase">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>MSME Registered?</label>
        <div class="radio-group" style="margin-top:8px">
          <label class="radio-item"><input type="radio" name="msme" value="1" ${_profile?.msme_registered?"checked":""}> Yes</label>
          <label class="radio-item"><input type="radio" name="msme" value="0" ${!_profile?.msme_registered?"checked":""}> No</label>
        </div>
      </div>
      <div class="form-group" id="msme-num-group" style="${_profile?.msme_registered?"":"display:none"}">
        <label>MSME Registration Number</label>
        <input type="text" id="f-msme_reg_number" value="${v("msme_reg_number")}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Year of Establishment</label>
        <input type="number" id="f-year_established" value="${v("year_established")}" min="1900" max="2026">
      </div>
      <div class="form-group">
        <label>Number of Employees</label>
        <input type="number" id="f-num_employees" value="${v("num_employees")}" min="1">
      </div>
      <div class="form-group">
        <label>Annual Turnover Range</label>
        <select id="f-annual_turnover_range"><option value="">Select…</option>${turnoverOpts}</select>
      </div>
    </div>

    <h4 style="margin:20px 0 12px;padding-top:16px;border-top:1px solid var(--gray-100)">Registered Address</h4>
    <div class="form-row">
      <div class="form-group">
        <label>Address Line 1</label>
        <input type="text" id="f-reg_addr_line1" value="${v("reg_addr_line1")}">
      </div>
      <div class="form-group">
        <label>Address Line 2</label>
        <input type="text" id="f-reg_addr_line2" value="${v("reg_addr_line2")}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>City <span class="required">*</span></label>
        <input type="text" id="f-reg_addr_city" value="${v("reg_addr_city")}">
      </div>
      <div class="form-group">
        <label>State <span class="required">*</span></label>
        <select id="f-reg_addr_state"><option value="">Select…</option>${stateOpts}</select>
      </div>
      <div class="form-group">
        <label>PIN Code <span class="required">*</span></label>
        <input type="text" id="f-reg_addr_pin" value="${v("reg_addr_pin")}" maxlength="6" inputmode="numeric">
      </div>
    </div>

    <h4 style="margin:20px 0 12px;padding-top:16px;border-top:1px solid var(--gray-100)">Primary Contact</h4>
    <div class="form-row">
      <div class="form-group">
        <label>Name <span class="required">*</span></label>
        <input type="text" id="f-contact_name" value="${v("contact_name")}">
      </div>
      <div class="form-group">
        <label>Designation</label>
        <input type="text" id="f-contact_designation" value="${v("contact_designation")}">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Mobile <span class="required">*</span></label>
        <input type="tel" id="f-contact_mobile" value="${v("contact_mobile")}" maxlength="10">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="f-contact_email" value="${v("contact_email")}">
      </div>
    </div>`;
}

function renderStep2() {
  const cats = _profile?.categories || [];
  return `
    <h3 style="margin-bottom:20px">Step 2 — Products & Categories</h3>
    <div class="form-group">
      <label>Supply Categories <span class="required">*</span> <span style="font-size:.78rem;color:var(--gray-400)">(select all that apply)</span></label>
      <div class="checkbox-group" style="margin-top:10px">
        ${CATEGORIES.map(c => `
          <label class="check-item" style="min-width:160px;padding:8px 12px;border:1px solid var(--gray-200);border-radius:var(--radius-sm);${cats.includes(c)?"background:var(--brand-light);border-color:var(--brand-mid)":""}">
            <input type="checkbox" name="category" value="${c}" ${cats.includes(c)?"checked":""}> ${c}
          </label>`).join("")}
      </div>
    </div>

    <div style="margin-top:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <label style="margin:0">Products / Materials Supplied</label>
        <button class="btn btn-sm btn-outline" onclick="addProductRow()">+ Add Product</button>
      </div>
      <div id="product-rows">
        ${(_profile?.products?.length ? _profile.products : [{}]).map((p, i) => productRowHtml(i, p)).join("")}
      </div>
    </div>`;
}

function productRowHtml(i, p={}) {
  return `
    <div class="form-row product-row" style="align-items:end" data-idx="${i}">
      <div class="form-group" style="flex:2">
        <label>Product / Material Name</label>
        <input type="text" class="prod-name" value="${escHtml(p.product_name||"")}" placeholder="e.g. Aluminium Sulphate">
      </div>
      <div class="form-group" style="flex:3">
        <label>Brief Description</label>
        <input type="text" class="prod-desc" value="${escHtml(p.description||"")}" placeholder="Grade, specification, etc.">
      </div>
      <div class="form-group" style="flex:0;min-width:40px;padding-bottom:2px">
        <button class="btn btn-sm btn-ghost" style="color:var(--danger)" onclick="this.closest('.product-row').remove()">✕</button>
      </div>
    </div>`;
}

function addProductRow() {
  const c = document.getElementById("product-rows").children.length;
  const div = document.createElement("div");
  div.innerHTML = productRowHtml(c);
  document.getElementById("product-rows").appendChild(div.firstElementChild);
}

function renderStep3() {
  const uploaded = {};
  (_profile?.documents || []).forEach(d => { uploaded[d.doc_type] = d; });

  return `
    <h3 style="margin-bottom:6px">Step 3 — Document Upload</h3>
    <p style="margin-bottom:20px;color:var(--gray-500);font-size:.875rem">
      PDF, JPG or PNG • Max 5 MB per file
    </p>
    <div id="doc-upload-list">
      ${MANDATORY_DOCS.map(doc => renderDocRow(doc, uploaded[doc.key])).join("")}
    </div>`;
}

function renderDocRow(doc, existing) {
  const needs_expiry = ["gst_certificate","transport_license","msme_certificate","iso_certification"].includes(doc.key);
  return `
    <div class="card" style="margin-bottom:12px;border:${doc.mandatory && !existing ? "1px solid var(--gray-300)" : "1px solid var(--gray-200)"}" id="doc-row-${doc.key}">
      <div class="card-body" style="padding:14px 16px">
        <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="font-weight:600;font-size:.875rem;color:var(--gray-800)">
              ${doc.label}
              ${doc.mandatory ? '<span class="required">*</span>' : '<span style="font-size:.72rem;background:var(--gray-100);color:var(--gray-500);padding:1px 6px;border-radius:8px;margin-left:4px">Optional</span>'}
            </div>
            ${existing ? `
              <div style="margin-top:6px;font-size:.78rem;color:var(--success);display:flex;align-items:center;gap:4px">
                ✓ ${escHtml(existing.file_name)}
                <button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:.72rem;color:var(--danger)" onclick="deleteDoc('${doc.key}','${existing.id}')">Remove</button>
              </div>` : `<div style="margin-top:4px;font-size:.75rem;color:var(--gray-400)">Not uploaded</div>`}
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:200px">
            ${needs_expiry ? `
              <div>
                <label style="font-size:.75rem;color:var(--gray-500);margin-bottom:3px;display:block">Expiry Date</label>
                <input type="date" class="doc-expiry" id="exp-${doc.key}" style="padding:5px 8px;font-size:.8rem" value="${existing?.expiry_date||""}">
              </div>` : ""}
            <label class="btn btn-outline btn-sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
              📎 ${existing ? "Replace" : "Upload"}
              <input type="file" class="doc-file-input" data-doctype="${doc.key}" accept=".pdf,.jpg,.jpeg,.png" style="display:none" onchange="handleDocUpload(this)">
            </label>
          </div>
        </div>
        <div class="upload-progress" id="prog-${doc.key}" style="display:none;margin-top:8px">
          <div style="background:var(--gray-200);border-radius:4px;height:4px">
            <div style="background:var(--brand-mid);height:4px;border-radius:4px;width:0%;transition:width .3s" id="prog-bar-${doc.key}"></div>
          </div>
          <div style="font-size:.75rem;color:var(--gray-400);margin-top:3px">Uploading…</div>
        </div>
      </div>
    </div>`;
}

function initDocUploadZones() {
  // file inputs already set up via onchange in HTML
}

async function handleDocUpload(input) {
  const docType = input.dataset.doctype;
  const file    = input.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) { Toast.error("File exceeds 5 MB"); return; }

  const prog    = document.getElementById(`prog-${docType}`);
  const progBar = document.getElementById(`prog-bar-${docType}`);
  if (prog) { prog.style.display = "block"; progBar.style.width = "30%"; }

  const fd = new FormData();
  fd.append("file", file);
  fd.append("doc_type", docType);
  const expiry = document.getElementById(`exp-${docType}`)?.value;
  if (expiry) fd.append("expiry_date", expiry);

  try {
    const resp = await fetch("/api/vendor/step/3/upload", {
      method: "POST", credentials: "same-origin", body: fd
    });
    if (progBar) progBar.style.width = "100%";
    const data = await resp.json();
    if (!resp.ok) { Toast.error(data.error || "Upload failed"); return; }

    Toast.success(`${data.doc_type.replace(/_/g," ")} uploaded`);
    // Refresh profile and re-render doc list
    _profile = await api("GET", "/api/vendor/profile");
    const uploaded = {};
    (_profile.documents || []).forEach(d => { uploaded[d.doc_type] = d; });
    const docDef = MANDATORY_DOCS.find(d => d.key === docType);
    if (docDef) {
      document.getElementById(`doc-row-${docType}`).outerHTML = renderDocRow(docDef, uploaded[docType]);
    }
  } catch(e) {
    Toast.error("Upload failed. Please try again.");
  } finally {
    if (prog) prog.style.display = "none";
  }
}

async function deleteDoc(docType, docId) {
  if (!confirm("Remove this document?")) return;
  try {
    await api("DELETE", `/api/vendor/document/${docId}`);
    _profile = await api("GET", "/api/vendor/profile");
    const docDef = MANDATORY_DOCS.find(d => d.key === docType);
    if (docDef) {
      document.getElementById(`doc-row-${docType}`).outerHTML = renderDocRow(docDef, null);
    }
    Toast.info("Document removed");
  } catch(e) { Toast.error(e.message); }
}

function renderStep4() {
  const accTypeOpts = ["Current","Savings"].map(t =>
    `<option value="${t}" ${_profile?.bank_account_type===t?"selected":""}>${t}</option>`).join("");
  return `
    <h3 style="margin-bottom:20px">Step 4 — Banking Details</h3>
    <div class="alert alert-info">
      🔒 Your banking details are encrypted and used only for payment processing.
    </div>
    <div class="form-row" style="margin-top:16px">
      <div class="form-group">
        <label>Account Holder Name <span class="required">*</span></label>
        <input type="text" id="f-bank_account_holder" value="${v("bank_account_holder")}">
      </div>
      <div class="form-group">
        <label>Account Type <span class="required">*</span></label>
        <select id="f-bank_account_type"><option value="">Select…</option>${accTypeOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>Account Number <span class="required">*</span></label>
        <input type="text" id="f-bank_account_number" value="${v("bank_account_number")}" inputmode="numeric">
      </div>
      <div class="form-group">
        <label>IFSC Code <span class="required">*</span></label>
        <input type="text" id="f-bank_ifsc" value="${v("bank_ifsc")}" maxlength="11" style="text-transform:uppercase" placeholder="SBIN0001234">
      </div>
    </div>
    <div class="form-group">
      <label>Bank Name</label>
      <input type="text" id="f-bank_name" value="${v("bank_name")}" placeholder="Auto-filled from IFSC if known">
    </div>
    <p style="font-size:.78rem;color:var(--gray-400);margin-top:4px">
      Please upload your Bank Cancelled Cheque in Step 3 to verify account details.
    </p>`;
}

function renderStep5() {
  return `
    <h3 style="margin-bottom:20px">Step 5 — Review & Submit</h3>
    <div id="review-content">
      <div class="empty-state"><div class="spinner"></div></div>
    </div>`;
}

async function populateReview() {
  try {
    _profile = await api("GET", "/api/vendor/profile");
  } catch { return; }

  const p = _profile;
  const missingMandatoryDocs = ["gst_certificate","pan_card","incorporation_certificate","bank_cheque"]
    .filter(d => !p.documents?.some(doc => doc.doc_type === d));

  document.getElementById("review-content").innerHTML = `
    ${missingMandatoryDocs.length ? `
      <div class="alert alert-danger">
        ⚠ Missing mandatory documents: <strong>${missingMandatoryDocs.map(d=>d.replace(/_/g," ")).join(", ")}</strong>.
        Please go back to Step 3 and upload them.
      </div>` : ""}

    <div class="card" style="margin-bottom:16px">
      <div class="card-header" style="cursor:pointer" onclick="goToStep(1)">
        <h4>Company Information</h4><span style="color:var(--brand-mid);font-size:.8rem">Edit →</span>
      </div>
      <div class="card-body">
        <div class="form-row">
          ${reviewField("Company Name", p.company_name)}
          ${reviewField("GSTIN", p.gstin)}
          ${reviewField("PAN", p.pan_number)}
          ${reviewField("Type", p.company_type)}
          ${reviewField("City", p.reg_addr_city)}
          ${reviewField("State", p.reg_addr_state)}
          ${reviewField("Contact", p.contact_name)}
          ${reviewField("Mobile", p.contact_mobile)}
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header" style="cursor:pointer" onclick="goToStep(2)">
        <h4>Categories & Products</h4><span style="color:var(--brand-mid);font-size:.8rem">Edit →</span>
      </div>
      <div class="card-body">
        <div style="font-size:.875rem;color:var(--gray-700)">
          <strong>Categories:</strong> ${(p.categories||[]).join(", ") || "—"}
        </div>
        ${p.products?.length ? `
          <div style="margin-top:8px;font-size:.875rem;color:var(--gray-700)">
            <strong>Products:</strong> ${p.products.map(pr=>pr.product_name).join(", ")}
          </div>` : ""}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header" style="cursor:pointer" onclick="goToStep(3)">
        <h4>Documents</h4><span style="color:var(--brand-mid);font-size:.8rem">Edit →</span>
      </div>
      <div class="card-body">
        ${(p.documents||[]).map(doc => `
          <div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:.875rem">
            <span style="color:var(--success)">✓</span>
            <span>${doc.doc_type.replace(/_/g," ")}</span>
            <span style="color:var(--gray-400);font-size:.75rem">${doc.file_name}</span>
          </div>`).join("") || '<span style="color:var(--gray-400)">No documents uploaded</span>'}
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-header" style="cursor:pointer" onclick="goToStep(4)">
        <h4>Banking Details</h4><span style="color:var(--brand-mid);font-size:.8rem">Edit →</span>
      </div>
      <div class="card-body">
        <div class="form-row">
          ${reviewField("Account Holder", p.bank_account_holder)}
          ${reviewField("Account No.", p.bank_account_number ? "****" + p.bank_account_number.slice(-4) : "—")}
          ${reviewField("IFSC", p.bank_ifsc)}
          ${reviewField("Bank", p.bank_name)}
          ${reviewField("Type", p.bank_account_type)}
        </div>
      </div>
    </div>

    <div class="alert alert-warning">
      By submitting, you confirm that all information provided is accurate.
      False information may result in disqualification.
    </div>`;

  if (missingMandatoryDocs.length) {
    document.getElementById("step-next-btn").disabled = true;
    document.getElementById("step-next-btn").textContent = "Upload Missing Documents First";
  }
}

function reviewField(label, value) {
  return `<div style="min-width:160px;margin-bottom:10px">
    <div style="font-size:.72rem;color:var(--gray-400);text-transform:uppercase;letter-spacing:.04em">${label}</div>
    <div style="font-size:.875rem;color:var(--gray-800);font-weight:500;margin-top:2px">${escHtml(value||"—")}</div>
  </div>`;
}

// ── Step submission ────────────────────────────────────────────────────────────

async function submitStep(step) {
  const btn = document.getElementById("step-next-btn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    if (step === 1) await saveStep1();
    else if (step === 2) await saveStep2();
    else if (step === 3) await saveStep3();
    else if (step === 4) await saveStep4();
    else if (step === 5) await finalSubmit();
  } catch(e) {
    Toast.error(e.message || "Save failed. Please try again.");
    btn.disabled = false;
    btn.textContent = step < 5 ? "Save & Continue →" : "Submit Registration";
  }
}

async function saveStep1() {
  const payload = {
    company_name:         document.getElementById("f-company_name")?.value?.trim(),
    company_type:         document.getElementById("f-company_type")?.value,
    gstin:                document.getElementById("f-gstin")?.value?.trim().toUpperCase(),
    pan_number:           document.getElementById("f-pan_number")?.value?.trim().toUpperCase(),
    msme_registered:      document.querySelector('input[name="msme"]:checked')?.value === "1",
    msme_reg_number:      document.getElementById("f-msme_reg_number")?.value?.trim(),
    year_established:     document.getElementById("f-year_established")?.value || null,
    num_employees:        document.getElementById("f-num_employees")?.value || null,
    annual_turnover_range:document.getElementById("f-annual_turnover_range")?.value,
    reg_addr_line1:       document.getElementById("f-reg_addr_line1")?.value?.trim(),
    reg_addr_line2:       document.getElementById("f-reg_addr_line2")?.value?.trim(),
    reg_addr_city:        document.getElementById("f-reg_addr_city")?.value?.trim(),
    reg_addr_state:       document.getElementById("f-reg_addr_state")?.value,
    reg_addr_pin:         document.getElementById("f-reg_addr_pin")?.value?.trim(),
    contact_name:         document.getElementById("f-contact_name")?.value?.trim(),
    contact_designation:  document.getElementById("f-contact_designation")?.value?.trim(),
    contact_mobile:       document.getElementById("f-contact_mobile")?.value?.trim(),
    contact_email:        document.getElementById("f-contact_email")?.value?.trim(),
  };

  try {
    const res = await api("POST", "/api/vendor/step/1", payload);
    _profile = { ..._profile, ...payload };
    Toast.success("Step 1 saved");
    goToStep(2);
  } catch(e) {
    renderFieldErrors(e.data?.errors || {});
    throw e;
  }
}

async function saveStep2() {
  const cats = [...document.querySelectorAll('input[name="category"]:checked')].map(el => el.value);
  const rows = document.querySelectorAll(".product-row");
  const products = [...rows].map(r => ({
    product_name: r.querySelector(".prod-name")?.value?.trim() || "",
    description:  r.querySelector(".prod-desc")?.value?.trim() || "",
  })).filter(p => p.product_name);

  try {
    await api("POST", "/api/vendor/step/2", { categories: cats, products });
    _profile = { ..._profile, categories: cats, products };
    Toast.success("Step 2 saved");
    goToStep(3);
  } catch(e) {
    if (e.data?.errors?.categories) Toast.error(e.data.errors.categories);
    throw e;
  }
}

async function saveStep3() {
  try {
    const res = await api("POST", "/api/vendor/step/3/complete");
    Toast.success("Documents verified");
    _profile = await api("GET", "/api/vendor/profile");
    goToStep(4);
  } catch(e) {
    if (e.data?.errors?.documents) Toast.error(e.data.errors.documents);
    throw e;
  }
}

async function saveStep4() {
  const payload = {
    bank_account_holder:  document.getElementById("f-bank_account_holder")?.value?.trim(),
    bank_account_number:  document.getElementById("f-bank_account_number")?.value?.trim(),
    bank_ifsc:            document.getElementById("f-bank_ifsc")?.value?.trim().toUpperCase(),
    bank_name:            document.getElementById("f-bank_name")?.value?.trim(),
    bank_account_type:    document.getElementById("f-bank_account_type")?.value,
  };

  try {
    await api("POST", "/api/vendor/step/4", payload);
    _profile = { ..._profile, ...payload };
    Toast.success("Banking details saved");
    goToStep(5);
  } catch(e) {
    renderFieldErrors(e.data?.errors || {});
    throw e;
  }
}

async function finalSubmit() {
  if (!confirm("Are you sure you want to submit your registration? Please ensure all information is accurate.")) {
    const btn = document.getElementById("step-next-btn");
    btn.disabled = false; btn.textContent = "Submit Registration";
    return;
  }
  try {
    const res = await api("POST", "/api/vendor/submit");
    Toast.success("Registration submitted successfully!");
    setTimeout(() => showSubmittedState(), 1500);
  } catch(e) {
    if (e.data?.errors) {
      const msgs = Object.values(e.data.errors).join(" • ");
      Toast.error(msgs);
    }
    throw e;
  }
}

function goToStep(step) {
  _curStep = step;
  renderWizard(step);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderFieldErrors(errors) {
  Object.entries(errors).forEach(([field, msg]) => {
    const el = document.getElementById(`f-${field}`);
    if (el) showFieldError(el, msg);
  });
  const first = Object.keys(errors)[0];
  if (first) document.getElementById(`f-${first}`)?.focus();
}

// ── MSME toggle ───────────────────────────────────────────────────────────────

document.addEventListener("change", e => {
  if (e.target.name === "msme") {
    const g = document.getElementById("msme-num-group");
    if (g) g.style.display = e.target.value === "1" ? "block" : "none";
  }
});
