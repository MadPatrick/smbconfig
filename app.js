const STORAGE_KEY = "smb-webadmin-state";

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

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
    } catch (e) {
      console.error("Opgeslagen gegevens konden niet worden gelezen, opnieuw beginnen.", e);
      state = { users: [], groups: [], shares: [] };
    }
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function loadAll() {
  loadState();
  render();
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
      <td><span class="badge ${s.configured ? 'bg-success' : 'bg-secondary'}">${s.configured ? 'ja' : 'nee'}</span></td>
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

function createUser() {
  try {
    const username = validateName(document.getElementById("newUsername").value, "gebruikersnaam");
    const password = document.getElementById("newPassword").value;
    if (password.length < 8) throw new Error("Wachtwoord moet minimaal 8 tekens zijn");
    if (state.users.some(u => u.name === username)) throw new Error("Gebruiker bestaat al");
    state.users.push({ name: username, disabled: false });
    saveState();
    alertMsg("success", "Gebruiker aangemaakt");
    document.getElementById("newUsername").value = "";
    document.getElementById("newPassword").value = "";
    render();
  } catch (e) { alertMsg("danger", e.message); }
}

function disableUser(username) {
  if (!confirm(`Gebruiker ${username} uitschakelen?`)) return;
  try {
    const user = state.users.find(u => u.name === username);
    if (!user) throw new Error("Gebruiker niet gevonden");
    user.disabled = true;
    saveState();
    alertMsg("success", "Gebruiker uitgeschakeld");
    render();
  } catch (e) { alertMsg("danger", e.message); }
}

function deleteUser(username) {
  if (!confirm(`Gebruiker ${username} verwijderen?`)) return;
  try {
    const idx = state.users.findIndex(u => u.name === username);
    if (idx === -1) throw new Error("Gebruiker niet gevonden");
    state.users.splice(idx, 1);
    state.groups.forEach(g => {
      if (g.members) g.members = g.members.filter(m => m !== username);
    });
    saveState();
    alertMsg("success", "Gebruiker verwijderd");
    render();
  } catch (e) { alertMsg("danger", e.message); }
}

function createGroup() {
  try {
    const groupname = validateName(document.getElementById("newGroup").value, "groepsnaam");
    if (state.groups.some(g => g.name === groupname)) throw new Error("Groep bestaat al");
    state.groups.push({ name: groupname, members: [] });
    saveState();
    alertMsg("success", "Groep aangemaakt");
    document.getElementById("newGroup").value = "";
    render();
  } catch (e) { alertMsg("danger", e.message); }
}

function addUserToGroup() {
  try {
    const username = document.getElementById("groupUserSelect").value;
    const groupname = document.getElementById("groupSelect").value;
    validateName(username, "gebruikersnaam");
    validateName(groupname, "groepsnaam");
    const group = state.groups.find(g => g.name === groupname);
    if (!group) throw new Error("Groep niet gevonden");
    if (!group.members) group.members = [];
    if (!group.members.includes(username)) group.members.push(username);
    saveState();
    alertMsg("success", "Gebruiker toegevoegd aan groep");
    render();
  } catch (e) { alertMsg("danger", e.message); }
}

function createShare() {
  try {
    const name = validateName(document.getElementById("shareName").value, "share naam");
    const path = validatePath(document.getElementById("sharePath").value);
    const group = validateName(document.getElementById("shareGroup").value, "groepsnaam");
    if (state.shares.some(s => s.name === name)) throw new Error("Share bestaat al");
    state.shares.push({ name, path, group, configured: true, acls: {} });
    saveState();
    alertMsg("success", "Share aangemaakt.");
    document.getElementById("shareName").value = "";
    document.getElementById("sharePath").value = "";
    render();
  } catch (e) { alertMsg("danger", e.message); }
}

function setAcl() {
  try {
    const share = document.getElementById("aclShare").value;
    const group = document.getElementById("aclGroup").value;
    const mode = document.getElementById("aclMode").value;
    validateName(share, "share naam");
    validateName(group, "groepsnaam");
    if (!["read", "write", "none"].includes(mode)) throw new Error("Ongeldige ACL mode");
    const s = state.shares.find(s => s.name === share);
    if (!s) throw new Error("Share niet gevonden");
    if (!s.acls) s.acls = {};
    s.acls[group] = mode;
    saveState();
    alertMsg("success", "ACL opgeslagen");
    render();
  } catch (e) { alertMsg("danger", e.message); }
}

loadAll();
