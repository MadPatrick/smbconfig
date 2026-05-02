const API = "/api";

let state = {
  users: [],
  groups: [],
  shares: [],
  nfs: [],
  smbconfig: {},
  sysinfo: {}
};

const SAFE_NAME = /^[a-zA-Z0-9._-]{1,32}$/;
const SAFE_PATH = /^\/[a-zA-Z0-9._/\-]{1,240}$/;

const CONFIG_FIELDS = {
  "netbios name": "cfg-netbios-name",
  "workgroup": "cfg-workgroup",
  "server string": "cfg-server-string",
  "unix password sync": "cfg-unix-password-sync",
  "security": "cfg-security",
  "ntlm auth": "cfg-ntlm-auth",
  "guest account": "cfg-guest-account",
  "map to guest": "cfg-map-to-guest",
  "bind interfaces only": "cfg-bind-interfaces-only",
  "interfaces": "cfg-interfaces",
  "socket options": "cfg-socket-options",
  "aio read size": "cfg-aio-read-size",
  "aio write size": "cfg-aio-write-size",
  "use sendfile": "cfg-use-sendfile",
  "min receivefile size": "cfg-min-receivefile-size",
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
    // collapse sidebar on mobile after navigation
    const nav = document.getElementById("sidebarNav");
    if (nav && window.innerWidth < 768) {
      bootstrap.Collapse.getOrCreateInstance(nav).hide();
    }
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
  }, 4000);
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

  const si = state.sysinfo || {};
  document.getElementById("siHostname").innerText = si.hostname || "-";
  document.getElementById("siIp").innerText       = si.ip       || "-";
  document.getElementById("siDistro").innerText   = si.distro   || "-";
  document.getElementById("siKernel").innerText   = si.kernel   || "-";
  document.getElementById("siArch").innerText     = si.arch     || "-";
  document.getElementById("siSamba").innerText    = si.samba    || "-";
  document.getElementById("siUptime").innerText   = si.uptime   || "-";

  fillSmbConfigForm(cfg);

  const ifaceEl = document.getElementById("cfg-interfaces");
  if (ifaceEl) {
    const currentVal = cfg["interfaces"] || "";
    ifaceEl.innerHTML = '<option value="">-- niet ingesteld --</option>' +
      (state.interfaces || []).map(iface => `<option value="${escapeHtml(iface)}">${escapeHtml(iface)}</option>`).join("");
    if (currentVal && !(state.interfaces || []).includes(currentVal)) {
      const opt = document.createElement("option");
      opt.value = currentVal;
      opt.text = currentVal;
      ifaceEl.appendChild(opt);
    }
    ifaceEl.value = currentVal;
  }

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

  document.getElementById("nfsTable").innerHTML = (state.nfs || []).map(e => {
    const ep = escapeHtml(e.path);
    const eid = btoa(e.path);
    return `
    <tr>
      <td class="mono">${ep}</td>
      <td><input type="text" class="form-control form-control-sm" id="nc-${eid}" value="${escapeHtml(e.client)}"></td>
      <td><input type="text" class="form-control form-control-sm" id="no-${eid}" value="${escapeHtml(e.options)}"></td>
      <td>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteNfsExport('${ep}')">Verwijderen</button>
      </td>
    </tr>`;
  }).join("");
}

function fillSelect(id, values) {
  const el = document.getElementById(id);
  el.innerHTML = values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

async function loadAll() {
  try {
    const [stateData, smbconfig, interfaces, sysinfo, nfs] = await Promise.all([
      api("GET", "/state"),
      api("GET", "/smbconfig"),
      api("GET", "/interfaces"),
      api("GET", "/sysinfo"),
      api("GET", "/nfs")
    ]);
    state = { ...stateData, smbconfig, interfaces, sysinfo, nfs };
    render();
  } catch (e) {
    alertMsg("danger", "Kan gegevens niet laden: " + e.message);
  }
  await loadMounts();
}

async function createUser() {
  try {
    const username = validateName(document.getElementById("newUsername").value, "gebruikersnaam");
    const password = document.getElementById("newPassword").value;
    const passwordConfirm = document.getElementById("newPasswordConfirm").value;
    if (password.length < 8) throw new Error("Wachtwoord moet minimaal 8 tekens zijn");
    if (password !== passwordConfirm) throw new Error("Wachtwoorden komen niet overeen");
    await api("POST", "/users", { username, password });
    document.getElementById("newUsername").value = "";
    document.getElementById("newPassword").value = "";
    document.getElementById("newPasswordConfirm").value = "";
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

async function createNfsExport() {
  try {
    const path = validatePath(document.getElementById("nfsPath").value);
    const client = document.getElementById("nfsClient").value.trim() || "*";
    const options = document.getElementById("nfsOptions").value.trim() || "rw,sync,no_subtree_check";
    await api("POST", "/nfs", { path, client, options });
    document.getElementById("nfsPath").value = "";
    document.getElementById("nfsClient").value = "";
    document.getElementById("nfsOptions").value = "";
    alertMsg("success", "NFS export aangemaakt");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function updateNfsExport(path, silent = false) {
  try {
    validatePath(path);
    const eid = btoa(path);
    const client = document.getElementById("nc-" + eid).value.trim();
    const options = document.getElementById("no-" + eid).value.trim();
    await api("POST", "/nfs/update", { path, client, options });
    if (!silent) {
      alertMsg("success", `NFS export ${escapeHtml(path)} opgeslagen`);
      await loadAll();
    }
  } catch (e) { alertMsg("danger", e.message); }
}

async function updateAllNfsExports() {
  try {
    await Promise.all((state.nfs || []).map(e => updateNfsExport(e.path, true)));
    alertMsg("success", "Alle NFS exports opgeslagen");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function deleteNfsExport(path) {
  if (!confirm(`NFS export ${path} verwijderen? De map op schijf blijft bewaard.`)) return;
  try {
    await api("DELETE", `/nfs/${path.slice(1)}`);
    alertMsg("success", "NFS export verwijderd");
    await loadAll();
  } catch (e) { alertMsg("danger", e.message); }
}

async function loadMounts() {
  try {
    const [mounts, disks] = await Promise.all([
      api("GET", "/mounts"),
      api("GET", "/mounts/disks")
    ]);
    state.mounts = mounts;
    state.disks = disks;
    renderMounts();
  } catch (e) {
    alertMsg("danger", "Kan schijfgegevens niet laden: " + e.message);
  }
}

function renderMounts() {
  const disks = state.disks || [];
  document.getElementById("disksTable").innerHTML = disks.length
    ? disks.map(d => {
        const hasUuid = !!d.uuid;
        const btnUse = hasUuid
          ? `<button class="btn btn-sm btn-outline-primary" onclick="useDiskUuid('${escapeHtml(d.uuid)}','${escapeHtml(d.fstype)}')">Gebruik UUID</button>`
          : `<span class="text-muted">-</span>`;
        return `<tr>
          <td class="mono">${escapeHtml(d.name)}</td>
          <td><span class="badge bg-secondary">${escapeHtml(d.type)}</span></td>
          <td class="mono">${escapeHtml(d.uuid) || '<span class="text-muted">-</span>'}</td>
          <td>${escapeHtml(d.fstype) || '<span class="text-muted">-</span>'}</td>
          <td>${escapeHtml(d.size)}</td>
          <td>${escapeHtml(d.label) || '<span class="text-muted">-</span>'}</td>
          <td class="mono">${escapeHtml(d.mountpoint) || '<span class="text-muted">-</span>'}</td>
          <td>${btnUse}</td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="8" class="text-muted">Geen schijven gevonden</td></tr>';

  const mounts = state.mounts || [];
  document.getElementById("mountsTable").innerHTML = mounts.length
    ? mounts.map(m => {
        const uuid = escapeHtml(m.uuid);
        const spec = escapeHtml(m.spec);
        const display = m.uuid ? `<span class="mono">${uuid}</span>` : `<span class="mono">${spec}</span>`;
        const autoBadge = m.auto
          ? '<span class="badge bg-success">ja</span>'
          : '<span class="badge bg-secondary">nee</span>';
        const editBtn = m.uuid
          ? `<button class="btn btn-sm btn-outline-secondary" onclick="openEditMount('${uuid}','${escapeHtml(m.mountpoint)}','${escapeHtml(m.fstype)}','${escapeHtml(m.options)}')">Bewerken</button> `
          : "";
        const delBtn = m.uuid
          ? `<button class="btn btn-sm btn-outline-danger" onclick="removeMount('${uuid}')">Verwijderen</button>`
          : "";
        return `<tr>
          <td>${display}</td>
          <td class="mono">${escapeHtml(m.mountpoint)}</td>
          <td>${escapeHtml(m.fstype)}</td>
          <td class="mono">${escapeHtml(m.options)}</td>
          <td>${autoBadge}</td>
          <td>${editBtn}${delBtn}</td>
        </tr>`;
      }).join("")
    : '<tr><td colspan="6" class="text-muted">Geen mounts geconfigureerd</td></tr>';

  // Populate UUID dropdown with available (not yet in fstab) disk UUIDs
  const mountedUuids = new Set((state.mounts || []).map(m => m.uuid).filter(Boolean));
  const uuidSel = document.getElementById("mountUuid");
  if (uuidSel) {
    const currentVal = uuidSel.value;
    uuidSel.innerHTML = '<option value="">— Selecteer UUID —</option>';
    (state.disks || [])
      .filter(d => d.uuid && !mountedUuids.has(d.uuid))
      .forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.uuid;
        const label = [d.uuid, d.name, d.label, d.fstype, d.size]
          .filter(Boolean).join(" · ");
        opt.textContent = label;
        uuidSel.appendChild(opt);
      });
    if ([...uuidSel.options].some(o => o.value === currentVal)) uuidSel.value = currentVal;
  }

  // Populate mountpoint datalist from all known paths: NFS exports, Samba share paths, existing fstab mountpoints
  const allPaths = [
    ...(state.nfs || []).map(e => e.path),
    ...(state.shares || []).map(s => s.path),
    ...(state.mounts || []).map(m => m.mountpoint),
  ].filter(Boolean);
  const uniquePaths = [...new Set(allPaths)].sort();
  const dl = document.getElementById("mountpointSuggestions");
  if (dl) {
    dl.innerHTML = "";
    uniquePaths.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p;
      dl.appendChild(opt);
    });
  }
}

function onMountUuidChange() {
  const uuidSel = document.getElementById("mountUuid");
  const uuid = uuidSel ? uuidSel.value : "";
  if (!uuid) return;
  const disk = (state.disks || []).find(d => d.uuid === uuid);
  if (disk && disk.fstype) {
    const sel = document.getElementById("mountFstype");
    if (sel && [...sel.options].some(o => o.value === disk.fstype)) sel.value = disk.fstype;
  }
}

function useDiskUuid(uuid, fstype) {
  const sel = document.getElementById("mountUuid");
  if (sel && [...sel.options].some(o => o.value === uuid)) {
    sel.value = uuid;
  }
  if (fstype) {
    const fsSel = document.getElementById("mountFstype");
    if (fsSel && [...fsSel.options].some(o => o.value === fstype)) fsSel.value = fstype;
  }
  const btn = document.querySelector('[data-page="mounts"]');
  if (btn) btn.click();
  if (sel) sel.focus();
}

async function addMount() {
  try {
    const uuid = document.getElementById("mountUuid").value.trim();
    if (!uuid) throw new Error("UUID is verplicht");
    const mountpoint = validatePath(document.getElementById("mountPoint").value.trim());
    const fstype = document.getElementById("mountFstype").value;
    const options = document.getElementById("mountOptions").value.trim() || "defaults";
    await api("POST", "/mounts", { uuid, mountpoint, fstype, options });
    document.getElementById("mountUuid").value = "";
    document.getElementById("mountPoint").value = "";
    document.getElementById("mountOptions").value = "defaults";
    alertMsg("success", "Mount toegevoegd aan fstab");
    await loadMounts();
  } catch (e) { alertMsg("danger", e.message); }
}

function openEditMount(uuid, mountpoint, fstype, options) {
  document.getElementById("editMountUuid").value = uuid;
  const display = document.getElementById("editMountUuidDisplay");
  if (display) display.value = uuid;
  document.getElementById("editMountPoint").value = mountpoint;
  document.getElementById("editMountOptions").value = options;
  const fsSel = document.getElementById("editMountFstype");
  if ([...fsSel.options].some(o => o.value === fstype)) fsSel.value = fstype;
  new bootstrap.Modal(document.getElementById("editMountModal")).show();
}

async function saveEditMount() {
  try {
    const uuid = document.getElementById("editMountUuid").value;
    const mountpoint = validatePath(document.getElementById("editMountPoint").value.trim());
    const fstype = document.getElementById("editMountFstype").value;
    const options = document.getElementById("editMountOptions").value.trim() || "defaults";
    await api("POST", "/mounts/update", { uuid, mountpoint, fstype, options });
    bootstrap.Modal.getInstance(document.getElementById("editMountModal")).hide();
    alertMsg("success", "Mount bijgewerkt");
    await loadMounts();
  } catch (e) { alertMsg("danger", e.message); }
}

async function removeMount(uuid) {
  if (!confirm(`Mount met UUID ${uuid} verwijderen uit fstab?`)) return;
  try {
    await api("DELETE", `/mounts/${encodeURIComponent(uuid)}`);
    alertMsg("success", "Mount verwijderd uit fstab");
    await loadMounts();
  } catch (e) { alertMsg("danger", e.message); }
}

loadAll();
