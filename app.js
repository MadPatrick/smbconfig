const API = "/api";

let state = {
  users: [],
  groups: [],
  shares: []
};

const SAFE_NAME = /^[a-zA-Z0-9._-]{1,32}$/;
const SAFE_PATH = /^\/[a-zA-Z0-9._/\-]{1,240}$/;

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
  document.getElementById("alertBox").innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${escapeHtml(msg)}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[s]));
}

function render() {
  document.getElementById("statUsers").innerText = state.users.length;
  document.getElementById("statGroups").innerText = state.groups.length;
  document.getElementById("statShares").innerText = state.shares.length;

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
      <td>${escapeHtml((g.members || []).join(", "))}</td>
    </tr>`).join("");

  document.getElementById("sharesTable").innerHTML = state.shares.map(s => `
    <tr>
      <td class="mono">${escapeHtml(s.name)}</td>
      <td class="mono">${escapeHtml(s.path)}</td>
      <td>${escapeHtml(s.group || "")}</td>
      <td><span class="badge ${s.configured ? "bg-success" : "bg-secondary"}">${s.configured ? "ja" : "nee"}</span></td>
    </tr>`).join("");

  fillSelect("groupUserSelect", state.users.map(u => u.name));
  fillSelect("groupSelect", state.groups.map(g => g.name));
  fillSelect("shareGroup", state.groups.map(g => g.name));
  fillSelect("aclGroup", state.groups.map(g => g.name));
  fillSelect("aclShare", state.shares.map(s => s.name));
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

async function loadAll() {
  try {
    state = await api("GET", "/state");
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

async function createShare() {
  try {
    const name = validateName(document.getElementById("shareName").value, "share naam");
    const path = validatePath(document.getElementById("sharePath").value);
    const group = validateName(document.getElementById("shareGroup").value, "groepsnaam");
    await api("POST", "/shares", { name, path, group });
    document.getElementById("shareName").value = "";
    document.getElementById("sharePath").value = "";
    alertMsg("success", "Share aangemaakt");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function setAcl() {
  try {
    const share = document.getElementById("aclShare").value;
    const group = document.getElementById("aclGroup").value;
    const mode = document.getElementById("aclMode").value;
    validateName(share, "share naam");
    validateName(group, "groepsnaam");
    if (!["read", "write", "none"].includes(mode)) throw new Error("Ongeldige ACL mode");
    await api("POST", "/shares/acl", { share, group, mode });
    alertMsg("success", "ACL opgeslagen");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

loadAll();
