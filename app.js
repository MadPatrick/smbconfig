const API = "/api";

let state = {
  users: [],
  groups: [],
  shares: [],
  smbconfig: {}
};

const SAFE_NAME = /^[a-zA-Z0-9._-]{1,32}$/;
const SAFE_PATH = /^\/[a-zA-Z0-9._/\-]{1,240}$/;

const CONFIG_FIELDS = {
  "netbios name": "cfg-netbios-name",
  "workgroup": "cfg-workgroup",
  "server string": "cfg-server-string",
  "security": "cfg-security",
  "ntlm auth": "cfg-ntlm-auth",
  "guest account": "cfg-guest-account",
  "map to guest": "cfg-map-to-guest",
  "bind interfaces only": "cfg-bind-interfaces-only",
  "interfaces": "cfg-interfaces",
  "max log size": "cfg-max-log-size",
  "logging": "cfg-logging",
  "log file": "cfg-log-file",
  "wins support": "cfg-wins-support",
  "local master": "cfg-local-master",
  "preferred master": "cfg-preferred-master",
  "domain master": "cfg-domain-master",
  "os level": "cfg-os-level",
  "force create mode": "cfg-force-create-mode",
  "force directory mode": "cfg-force-directory-mode",
  "server min protocol": "cfg-server-min-protocol",
  "server max protocol": "cfg-server-max-protocol",
  "pam password change": "cfg-pam-password-change",
  "passwd program": "cfg-passwd-program",
  "passwd chat": "cfg-passwd-chat",
  "obey pam restrictions": "cfg-obey-pam-restrictions",
  "panic action": "cfg-panic-action",
};

function validateName(value, field = "naam") {
  if (!value || !SAFE_NAME.test(value)) throw new Error(`Ongeldige ${field}`);
  return value;
}

function validatePath(value) {
  if (!value || !SAFE_PATH.test(value) || value.includes("..")) throw new Error("Ongeldig pad");
  return value;
}

async function api(method, path, body) {
  const opts = {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined
  };
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

document.querySelectorAll("[data-page]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-page]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.classList.add("d-none"));
    document.getElementById("page-" + btn.dataset.page).classList.remove("d-none");
  });
});

function alertMsg(type, msg) {
  const box = document.getElementById("alertBox");
  box.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(msg)}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
  setTimeout(() => {
    const alert = box.querySelector(".alert");
    if (alert) {
      alert.classList.remove("show");
      alert.addEventListener("transitionend", () => alert.remove(), { once: true });
    }
  }, 10000);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[s]));
}

function yesNoBadge(val) {
  if (val === "yes") return '<span class="badge bg-success">ja</span>';
  if (val === "no")  return '<span class="badge bg-secondary">nee</span>';
  return '<span class="badge bg-light text-dark">-</span>';
}

function render() {
  document.getElementById("statUsers").innerText = state.users.length;
  document.getElementById("statGroups").innerText = state.groups.length;
  document.getElementById("statShares").innerText = state.shares.length;

  const cfg = state.smbconfig || {};
  document.getElementById("cfgNetbiosName").innerText = cfg["netbios name"] || "-";
  document.getElementById("cfgWorkgroup").innerText = cfg["workgroup"] || "-";
  document.getElementById("cfgInterfaces").innerText = cfg["interfaces"] || "-";
  document.getElementById("cfgSecurity").innerText = cfg["security"] || "-";
  document.getElementById("cfgNtlmAuth").innerText = cfg["ntlm auth"] || "-";

  fillSmbConfigForm(cfg);

  document.getElementById("usersTable").innerHTML = state.users.map(u => `
    <tr>
      <td class="mono">${escapeHtml(u.name)}</td>
      <td>${u.disabled ? '<span class="badge bg-warning text-dark">disabled</span>' : '<span class="badge bg-success">enabled</span>'}</td>
      <td>
        <button class="btn btn-sm btn-outline-warning" onclick="disableUser('${escapeHtml(u.name)}')">Disable</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${escapeHtml(u.name)}')">Verwijderen</button>
      </td>
    </tr>`).join("");

  document.getElementById("groupsTable").innerHTML = state.groups.map(g => `
    <tr>
      <td class="mono">${escapeHtml(g.name)}</td>
      <td>${(g.members || []).map(m => `
        <span class="badge bg-secondary me-1">
          ${escapeHtml(m)}
          <button type="button" class="btn-close btn-close-white ms-1" style="font-size:.6em;vertical-align:middle;" title="Verwijder uit groep" onclick="removeUserFromGroup('${escapeHtml(m)}','${escapeHtml(g.name)}')"></button>
        </span>`).join("")}</td>
      <td><button class="btn btn-sm btn-outline-danger" onclick="deleteGroup('${escapeHtml(g.name)}')">Verwijderen</button></td>
    </tr>`).join("");

  document.getElementById("sharesTable").innerHTML = state.shares.map(s => {
    const sn = escapeHtml(s.name);
    const groupOptions = `<option value=""${!s.group ? ' selected' : ''}>-- geen groep --</option>` +
      state.groups.map(g => `<option value="${escapeHtml(g.name)}"${s.group === g.name ? ' selected' : ''}>${escapeHtml(g.name)}</option>`).join("");
    return `
    <tr>
      <td class="mono">${sn}</td>
      <td class="mono">${escapeHtml(s.path)}</td>
      <td><select class="form-select form-select-sm" id="sg-${sn}">${groupOptions}</select></td>
      <td>
        <select class="form-select form-select-sm" id="sro-${sn}">
          <option value="no"${s.read_only !== 'yes' ? ' selected' : ''}>Lezen + schrijven</option>
          <option value="yes"${s.read_only === 'yes' ? ' selected' : ''}>Lezen</option>
        </select>
      </td>
      <td class="text-center"><input type="checkbox" class="form-check-input" id="sb-${sn}"${s.browseable === 'yes' ? ' checked' : ''}></td>
      <td class="text-center"><input type="checkbox" class="form-check-input" id="sgo-${sn}"${s.guest_ok === 'yes' ? ' checked' : ''}></td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteShare('${sn}')">Verwijderen</button>
      </td>
    </tr>`;
  }).join("");

  fillSelect("groupUserSelect", state.users.map(u => u.name));
  fillSelect("groupSelect", state.groups.map(g => g.name));
  const shareGroupEl = document.getElementById("shareGroup");
  shareGroupEl.innerHTML = `<option value="none">-- geen groep --</option>` +
    state.groups.map(g => `<option value="${escapeHtml(g.name)}">${escapeHtml(g.name)}</option>`).join("");
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

async function loadAll() {
  try {
    const [stateData, smbconfig] = await Promise.all([
      api("GET", "/state"),
      api("GET", "/smbconfig")
    ]);
    state = { ...stateData, smbconfig };
    render();
  } catch (e) {
    alertMsg("danger", "Kan gegevens niet laden: " + e.message);
  }
}

async function createUser() {
  try {
    const username = validateName(document.getElementById("newUsername").value, "gebruikersnaam");
    const password = document.getElementById("newPassword").value;
    if (password.length < 8) throw new Error("Wachtwoord moet minimaal 8 tekens zijn");
    await api("POST", "/users", { username, password });
    document.getElementById("newUsername").value = "";
    document.getElementById("newPassword").value = "";
    alertMsg("success", "Gebruiker aangemaakt");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function disableUser(username) {
  if (!confirm(`Gebruiker ${username} uitschakelen?`)) return;
  try {
    await api("POST", `/users/${encodeURIComponent(username)}/disable`);
    alertMsg("success", "Gebruiker uitgeschakeld");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function deleteUser(username) {
  if (!confirm(`Gebruiker ${username} verwijderen?`)) return;
  try {
    await api("DELETE", `/users/${encodeURIComponent(username)}`);
    alertMsg("success", "Gebruiker verwijderd");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function createGroup() {
  try {
    const groupname = validateName(document.getElementById("newGroup").value, "groepsnaam");
    await api("POST", "/groups", { groupname });
    document.getElementById("newGroup").value = "";
    alertMsg("success", "Groep aangemaakt");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function addUserToGroup() {
  try {
    const username = document.getElementById("groupUserSelect").value;
    const groupname = document.getElementById("groupSelect").value;
    validateName(username, "gebruikersnaam");
    validateName(groupname, "groepsnaam");
    await api("POST", "/groups/add-user", { username, groupname });
    alertMsg("success", "Gebruiker toegevoegd aan groep");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function removeUserFromGroup(username, groupname) {
  if (!confirm(`Gebruiker ${username} uit groep ${groupname} verwijderen?`)) return;
  try {
    await api("POST", "/groups/remove-user", { username, groupname });
    alertMsg("success", `Gebruiker ${username} verwijderd uit groep ${groupname}`);
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function deleteGroup(groupname) {
  if (!confirm(`Groep ${groupname} verwijderen?`)) return;
  try {
    await api("DELETE", `/groups/${encodeURIComponent(groupname)}`);
    alertMsg("success", "Groep verwijderd");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function createShare() {
  try {
    const name = validateName(document.getElementById("shareName").value, "share naam");
    const path = validatePath(document.getElementById("sharePath").value);
    const group = document.getElementById("shareGroup").value;
    if (group !== "none") validateName(group, "groepsnaam");
    await api("POST", "/shares", { name, path, group });
    document.getElementById("shareName").value = "";
    document.getElementById("sharePath").value = "";
    alertMsg("success", "Share aangemaakt");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function updateShare(sharename, silent = false) {
  try {
    validateName(sharename, "share naam");
    const group = document.getElementById("sg-" + sharename).value;
    const read_only = document.getElementById("sro-" + sharename).value;
    const browseable = document.getElementById("sb-" + sharename).checked ? "yes" : "no";
    const guest_ok = document.getElementById("sgo-" + sharename).checked ? "yes" : "no";
    if (group) validateName(group, "groepsnaam");
    await api("POST", `/shares/${encodeURIComponent(sharename)}/update`, { group, read_only, browseable, guest_ok });
    if (!silent) {
      alertMsg("success", `Share ${escapeHtml(sharename)} opgeslagen`);
      await loadAll();
    }
  } catch (e) { alertMsg("danger", e.message); }
}

async function updateAllShares() {
  try {
    await Promise.all(state.shares.map(s => updateShare(s.name, true)));
    alertMsg("success", "Alle shares opgeslagen");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function deleteShare(sharename) {
  if (!confirm(`Share ${sharename} verwijderen? De map op schijf blijft bewaard.`)) return;
  try {
    await api("DELETE", `/shares/${encodeURIComponent(sharename)}`);
    alertMsg("success", "Share verwijderd");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

function fillSmbConfigForm(cfg) {
  for (const [key, id] of Object.entries(CONFIG_FIELDS)) {
    const el = document.getElementById(id);
    if (el) el.value = cfg[key] || "";
  }
}

async function saveSmbConfig() {
  try {
    const data = {};
    for (const [key, id] of Object.entries(CONFIG_FIELDS)) {
      const el = document.getElementById(id);
      if (el) data[key] = el.value;
    }
    await api("POST", "/smbconfig", data);
    alertMsg("success", "Configuratie opgeslagen");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

loadAll();
