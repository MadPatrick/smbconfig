const API = "http://localhost:5000";

let state = {
  users: [],
  groups: [],
  shares: []
};

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

async function api(path, method = "GET", data = null) {
  const opts = { method, headers: {} };
  if (data) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(data);
  }
  const res = await fetch(API + path, opts);
  const text = await res.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  if (!res.ok) throw new Error(payload.error || payload.message || "API fout");
  return payload;
}

async function loadAll() {
  try {
    const data = await api("/api/state");
    state = data;
    render();
  } catch (e) {
    alertMsg("danger", e.message);
  }
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

async function createUser() {
  try {
    await api("/api/users", "POST", {
      username: document.getElementById("newUsername").value,
      password: document.getElementById("newPassword").value
    });
    alertMsg("success", "Gebruiker aangemaakt");
    document.getElementById("newPassword").value = "";
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function disableUser(username) {
  if (!confirm(`Gebruiker ${username} uitschakelen?`)) return;
  try {
    await api(`/api/users/${encodeURIComponent(username)}/disable`, "POST");
    alertMsg("success", "Gebruiker uitgeschakeld");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function deleteUser(username) {
  if (!confirm(`Gebruiker ${username} verwijderen?`)) return;
  try {
    await api(`/api/users/${encodeURIComponent(username)}`, "DELETE");
    alertMsg("success", "Gebruiker verwijderd");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function createGroup() {
  try {
    await api("/api/groups", "POST", { groupname: document.getElementById("newGroup").value });
    alertMsg("success", "Groep aangemaakt");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function addUserToGroup() {
  try {
    await api("/api/groups/add-user", "POST", {
      username: document.getElementById("groupUserSelect").value,
      groupname: document.getElementById("groupSelect").value
    });
    alertMsg("success", "Gebruiker toegevoegd aan groep");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function createShare() {
  try {
    await api("/api/shares", "POST", {
      name: document.getElementById("shareName").value,
      path: document.getElementById("sharePath").value,
      group: document.getElementById("shareGroup").value
    });
    alertMsg("success", "Share aangemaakt. Herstart/reload Samba indien nodig.");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function setAcl() {
  try {
    await api("/api/shares/acl", "POST", {
      share: document.getElementById("aclShare").value,
      group: document.getElementById("aclGroup").value,
      mode: document.getElementById("aclMode").value
    });
    alertMsg("success", "ACL opgeslagen");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

loadAll();
