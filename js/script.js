/* ================= ANNDAAN — script.js ================= */
"use strict";

/* ---------- Storage helpers ---------- */
const DB = {
  get: (k, d) => JSON.parse(localStorage.getItem("anndaan_" + k)) ?? d,
  set: (k, v) => localStorage.setItem("anndaan_" + k, JSON.stringify(v)),
};
const uid = () => Math.random().toString(36).slice(2, 10);
const genOTP = () => String(Math.floor(1000 + Math.random() * 9000));
const $ = (id) => document.getElementById(id);

/* ---------- Toasts ---------- */
function toast(msg, err = false) {
  const t = document.createElement("div");
  t.className = "toast" + (err ? " err" : "");
  t.textContent = msg;
  $("toastStack").appendChild(t);
  setTimeout(() => t.remove(), 4200);
}

/* ---------- Seed demo data (first run) ---------- */
function seed() {
  if (DB.get("seeded", false)) return;
  const restoId = "resto-demo";
  DB.set("users", [
    { id: restoId, name: "Spice Route Kitchen", email: "resto@demo.in", pass: "demo123", role: "restaurant", city: "Indiranagar, Bengaluru", fssai: "10012345678901", lat: 12.9719, lng: 77.6412 },
    { id: "ngo-demo", name: "Anna Seva Foundation", email: "ngo@demo.in", pass: "demo123", role: "ngo", city: "Bengaluru", ngoReg: "KA/2019/0234567", verified: true },
    { id: "user-demo", name: "Demo Customer", email: "user@demo.in", pass: "demo123", role: "customer", city: "Bengaluru" },
  ]);
  const now = Date.now();
  DB.set("listings", [
    mkListing({ restaurantId: restoId, restaurantName: "Spice Route Kitchen", city: "Indiranagar, Bengaluru", item: "Veg Biryani", qty: 8, veg: "veg", type: "paid", price: 60, orig: 120, windowMins: 90, lat: 12.9719, lng: 77.6412 }),
    mkListing({ restaurantId: restoId, restaurantName: "Spice Route Kitchen", city: "Indiranagar, Bengaluru", item: "Paneer Butter Masala + Rotis", qty: 5, veg: "veg", type: "paid", price: 90, orig: 180, windowMins: 60, lat: 12.9719, lng: 77.6412 }),
    mkListing({ restaurantId: restoId, restaurantName: "Spice Route Kitchen", city: "Indiranagar, Bengaluru", item: "Assorted Wedding Buffet Surplus", qty: 40, veg: "veg", type: "donation", price: 0, orig: 0, windowMins: 120, lat: 12.9719, lng: 77.6412 }),
    mkListing({ restaurantId: restoId, restaurantName: "Spice Route Kitchen", city: "Indiranagar, Bengaluru", item: "Chicken Curry + Rice", qty: 6, veg: "nonveg", type: "paid", price: 75, orig: 150, windowMins: 45, lat: 12.9719, lng: 77.6412 }),
  ]);
  DB.set("seeded", true);
}
function mkListing(o) {
  const now = Date.now();
  return {
    id: uid(), status: "open", claimedBy: null, claimedByName: null, otp: null,
    createdAt: now,
    expiresAt: now + o.windowMins * 60000,
    escalateAt: o.type === "paid" ? now + Math.round(o.windowMins * 0.6) * 60000 : null,
    escalated: false, prepTime: "recently prepared",
    ...o,
  };
}

/* ---------- Session ---------- */
let session = DB.get("session", null);
const users = () => DB.get("users", []);
const listings = () => DB.get("listings", []);
const saveListings = (l) => DB.set("listings", l);

/* ---------- Geolocation ---------- */
let userPos = null;
function requestLocation() {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (p) => { userPos = { lat: p.coords.latitude, lng: p.coords.longitude }; renderAll(); },
    () => {}, { timeout: 5000 }
  );
}
function distKm(a, b) {
  if (!a || !b || b.lat == null) return null;
  const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/* ---------- Auth UI ---------- */
let pendingRole = "customer";
function openAuth(mode, role) {
  closeModals();
  $("authModal").classList.remove("hidden");
  switchAuth(mode);
  if (role) selectRole(role);
}
function switchAuth(mode) {
  $("tabLogin").classList.toggle("active", mode === "login");
  $("tabSignup").classList.toggle("active", mode === "signup");
  $("loginForm").classList.toggle("hidden", mode !== "login");
  $("signupForm").classList.toggle("hidden", mode !== "signup");
}
function selectRole(role) {
  pendingRole = role;
  document.querySelectorAll(".role-opt").forEach((b) => b.classList.toggle("active", b.dataset.role === role));
  $("fssaiField").classList.toggle("hidden", role !== "restaurant");
  $("ngoField").classList.toggle("hidden", role !== "ngo");
  $("nameLabel").firstChild.textContent = role === "restaurant" ? "Restaurant name" : role === "ngo" ? "NGO name" : "Full name";
  $("suFssai").required = role === "restaurant";
  $("suNgoReg").required = role === "ngo";
}
document.querySelectorAll(".role-opt").forEach((b) => b.addEventListener("click", () => selectRole(b.dataset.role)));

function handleSignup(e) {
  e.preventDefault();
  const email = $("suEmail").value.trim().toLowerCase();
  if (users().some((u) => u.email === email)) return toast("An account with this email already exists.", true);
  const u = {
    id: uid(), name: $("suName").value.trim(), email, pass: $("suPass").value,
    role: pendingRole, city: $("suCity").value.trim(),
    fssai: $("suFssai").value.trim(), ngoReg: $("suNgoReg").value.trim(),
    verified: pendingRole === "ngo",
    lat: userPos?.lat, lng: userPos?.lng,
  };
  DB.set("users", [...users(), u]);
  login(u);
  toast(`Welcome to Anndaan, ${u.name}! 🌱`);
}
function handleLogin(e) {
  e.preventDefault();
  const u = users().find((x) => x.email === $("liEmail").value.trim().toLowerCase() && x.pass === $("liPass").value);
  if (!u) return toast("Invalid email or password.", true);
  login(u);
  toast(`Welcome back, ${u.name}!`);
}
function login(u) {
  session = { id: u.id, name: u.name, role: u.role };
  DB.set("session", session);
  closeModals();
  renderAll();
}
function logout() {
  session = null;
  DB.set("session", null);
  renderAll();
  window.scrollTo({ top: 0 });
}
function goHome(e) { e.preventDefault(); if (!session) window.scrollTo({ top: 0, behavior: "smooth" }); }

/* ---------- Modals ---------- */
function closeModals() {
  ["authModal", "listingModal", "otpModal"].forEach((id) => $(id).classList.add("hidden"));
}
document.querySelectorAll(".modal-overlay").forEach((m) =>
  m.addEventListener("click", (e) => { if (e.target === m) closeModals(); })
);

/* ---------- Restaurant: create listing ---------- */
function openListingModal() {
  $("lsPrep").value = new Date().toTimeString().slice(0, 5);
  $("listingModal").classList.remove("hidden");
}
function togglePriceFields() {
  const donation = $("lsType").value === "donation";
  $("lsPriceWrap").classList.toggle("hidden", donation);
  $("lsOrigWrap").querySelector("label").classList.toggle("hidden", donation);
  $("lsPrice").required = !donation;
}
function createListing(e) {
  e.preventDefault();
  // Food safety rule: prep time within last 4 hours
  const [h, m] = $("lsPrep").value.split(":").map(Number);
  const prep = new Date(); prep.setHours(h, m, 0, 0);
  if (prep > new Date()) prep.setDate(prep.getDate() - 1);
  const ageHrs = (Date.now() - prep.getTime()) / 3600000;
  if (ageHrs > 4) return toast("⛔ FSSAI rule: food prepared more than 4 hours ago cannot be listed.", true);

  const me = users().find((u) => u.id === session.id);
  const type = $("lsType").value;
  const l = mkListing({
    restaurantId: me.id, restaurantName: me.name, city: me.city,
    item: $("lsItem").value.trim(), qty: +$("lsQty").value, veg: $("lsVeg").value,
    type, price: type === "donation" ? 0 : +$("lsPrice").value,
    orig: type === "donation" ? 0 : +$("lsOrig").value,
    windowMins: +$("lsWindow").value,
    lat: me.lat ?? userPos?.lat, lng: me.lng ?? userPos?.lng,
  });
  l.prepTime = $("lsPrep").value;
  saveListings([listings(), l].flat());
  closeModals();
  e.target.reset();
  toast("📢 Listing published! Nearby claimants are being notified.");
  renderAll();
}

/* ---------- Claiming ---------- */
function claimListing(id) {
  if (!session) return openAuth("login");
  const all = listings();
  const l = all.find((x) => x.id === id);
  if (!l || l.status !== "open") return toast("This listing is no longer available.", true);
  if (l.type === "donation" && !l.escalated && session.role !== "ngo")
    return toast("Free donations can only be claimed by verified NGOs.", true);
  if (l.escalated && session.role === "customer")
    return toast("Escalated listings are reserved for NGOs.", true);
  l.status = "claimed";
  l.claimedBy = session.id;
  l.claimedByName = session.name;
  l.otp = genOTP();
  saveListings(all);
  showOTP(l);
  renderAll();
}
function showOTP(l) {
  $("otpModalBody").innerHTML = `
    <button class="modal-x" onclick="closeModals()">✕</button>
    <h2 style="margin-bottom:6px">🎉 Claimed!</h2>
    <p style="color:var(--ink-3);font-size:.9rem">${l.item} · ${l.qty} servings<br>from <strong>${l.restaurantName}</strong></p>
    <div class="otp-big">${l.otp}</div>
    <p style="font-size:.85rem;color:var(--ink-3)">Show this OTP at pickup. It proves the handoff and confirms the food wasn't wasted.</p>
    <button class="btn btn-primary btn-block" style="margin-top:18px" onclick="closeModals()">Got it</button>`;
  $("otpModal").classList.remove("hidden");
}

/* ---------- Restaurant: verify pickup ---------- */
function verifyPickup(id) {
  const l = listings().find((x) => x.id === id);
  $("otpModalBody").innerHTML = `
    <button class="modal-x" onclick="closeModals()">✕</button>
    <h2>Confirm handoff 🔐</h2>
    <p style="color:var(--ink-3);font-size:.9rem">${l.item} — claimed by <strong>${l.claimedByName}</strong>.<br>Enter the OTP the claimant shows you:</p>
    <input class="otp-input" id="otpEntry" maxlength="4" inputmode="numeric" placeholder="••••">
    <button class="btn btn-primary btn-block" onclick="confirmOTP('${id}')">Confirm collection</button>`;
  $("otpModal").classList.remove("hidden");
  setTimeout(() => $("otpEntry").focus(), 100);
}
function confirmOTP(id) {
  const all = listings();
  const l = all.find((x) => x.id === id);
  if ($("otpEntry").value.trim() === l.otp) {
    l.status = "collected";
    saveListings(all);
    closeModals();
    toast(`✅ Handoff confirmed! ${l.qty} servings rescued. 🌍`);
    renderAll();
  } else toast("Incorrect OTP. Please try again.", true);
}
function cancelListing(id) {
  const all = listings();
  const l = all.find((x) => x.id === id);
  l.status = "cancelled";
  saveListings(all);
  toast("Listing cancelled.");
  renderAll();
}

/* ---------- Timer engine: countdowns, escalation, expiry ---------- */
function tick() {
  const all = listings();
  let changed = false;
  const now = Date.now();
  for (const l of all) {
    if (l.status === "open" && now > l.expiresAt) { l.status = "expired"; changed = true; }
    else if (l.status === "open" && l.type === "paid" && !l.escalated && l.escalateAt && now > l.escalateAt) {
      l.escalated = true; l.price = 0; changed = true;
      toast(`🤝 "${l.item}" unclaimed — auto-escalated to NGOs (now FREE).`);
    }
  }
  if (changed) { saveListings(all); renderAll(); }
  else document.querySelectorAll("[data-expires]").forEach((el) => {
    const rem = +el.dataset.expires - now;
    el.textContent = fmtTimer(rem);
    el.className = "l-timer " + (rem < 5 * 60000 ? "danger" : rem < 15 * 60000 ? "warn" : "");
  });
}
function fmtTimer(ms) {
  if (ms <= 0) return "expired";
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
  return `⏱ ${m}:${String(s).padStart(2, "0")} left`;
}
setInterval(tick, 1000);

/* ---------- Rendering ---------- */
let filterText = "", sortBy = "time";

function listingCard(l, viewer) {
  const d = userPos ? distKm(userPos, l) : null;
  const isMineResto = viewer?.role === "restaurant" && l.restaurantId === viewer.id;
  const isMyClaim = viewer && l.claimedBy === viewer.id;
  let action = "";

  if (l.status === "open") {
    if (!viewer) action = `<button class="btn btn-primary btn-sm" onclick="openAuth('login')">Log in to claim</button>`;
    else if (isMineResto) action = `<button class="btn btn-danger btn-sm" onclick="cancelListing('${l.id}')">Cancel</button>`;
    else {
      const ngoOnly = (l.type === "donation" || l.escalated);
      const canClaim = ngoOnly ? viewer.role === "ngo" : viewer.role === "customer" || viewer.role === "ngo";
      action = canClaim
        ? `<button class="btn btn-primary btn-sm" onclick="claimListing('${l.id}')">${l.price ? "Claim & Pay ₹" + l.price : "Claim Free"}</button>`
        : `<span class="badge b-escalated">NGO only</span>`;
    }
  } else if (l.status === "claimed") {
    if (isMineResto) action = `<button class="btn btn-primary btn-sm" onclick="verifyPickup('${l.id}')">Verify OTP</button>`;
    else if (isMyClaim) action = `<span class="otp-chip">OTP ${l.otp}</span>`;
    else action = `<span class="badge b-status">Claimed</span>`;
  } else action = `<span class="badge b-status">${l.status}</span>`;

  const timer = l.status === "open"
    ? `<span class="l-timer" data-expires="${l.expiresAt}">${fmtTimer(l.expiresAt - Date.now())}</span>` : "";

  return `<article class="l-card">
    <div class="l-top">
      <div class="l-badges">
        ${l.escalated ? '<span class="badge b-escalated">Escalated → NGO</span>' :
          l.type === "donation" ? '<span class="badge b-free">Free · NGO</span>' : '<span class="badge b-paid">Discounted</span>'}
        <span class="badge ${l.veg === "veg" ? "b-veg" : "b-nonveg"}">${l.veg === "veg" ? "Veg" : "Non-veg"}</span>
      </div>
      ${timer}
    </div>
    <div class="l-body">
      <h3>${l.item}</h3>
      <div class="l-meta">🏪 ${l.restaurantName} · 📍 ${l.city}</div>
      <div class="l-meta">🍽 ${l.qty} servings · 👨‍🍳 prepared ${l.prepTime}</div>
      <div class="l-price">${l.price ? "₹" + l.price + (l.orig ? `<s>₹${l.orig}</s>` : "") : "FREE"}</div>
    </div>
    <div class="l-foot">
      <span class="l-dist">${d != null ? "📍 " + d.toFixed(1) + " km away" : "📍 enable location"}</span>
      ${action}
    </div>
  </article>`;
}

function renderAll() {
  const me = session ? users().find((u) => u.id === session.id) : null;
  // Nav
  $("loginBtn").classList.toggle("hidden", !!session);
  $("signupBtn").classList.toggle("hidden", !!session);
  $("logoutBtn").classList.toggle("hidden", !session);
  $("navUser").classList.toggle("hidden", !session);
  if (session) $("navUser").textContent =
    (session.role === "restaurant" ? "🏪 " : session.role === "ngo" ? "🤝 " : "🍛 ") + session.name;

  $("landing").classList.toggle("hidden", !!session);
  $("dashboard").classList.toggle("hidden", !session);
  document.querySelectorAll(".landing-only").forEach((el) => el.classList.toggle("hidden", !!session));

  // Public preview
  if (!session) {
    const open = listings().filter((l) => l.status === "open");
    $("publicListings").innerHTML = open.length
      ? open.slice(0, 6).map((l) => listingCard(l, null)).join("")
      : `<p style="grid-column:1/-1;text-align:center;color:var(--ink-3)">No live listings right now — check back after dinner service! 🌙</p>`;
    return;
  }
  renderDashboard(me);
}

function renderDashboard(me) {
  const all = listings();
  let mine, title, sub, stats;

  if (me.role === "restaurant") {
    $("newListingBtn").classList.remove("hidden");
    mine = all.filter((l) => l.restaurantId === me.id);
    title = `🏪 ${me.name}`;
    sub = `FSSAI: ${me.fssai || "—"} · ${me.city}`;
    const rescued = mine.filter((l) => l.status === "collected").reduce((s, l) => s + l.qty, 0);
    stats = [
      [mine.filter((l) => l.status === "open").length, "Active listings"],
      [mine.filter((l) => l.status === "claimed").length, "Awaiting pickup"],
      [rescued, "Servings rescued"],
      ["₹" + mine.filter((l) => l.status === "collected" && l.type === "paid").reduce((s, l) => s + l.price * l.qty, 0), "Revenue recovered"],
    ];
    $("dashEmptyMsg").textContent = "List your first surplus item and turn tonight's write-off into impact.";
  } else if (me.role === "ngo") {
    $("newListingBtn").classList.add("hidden");
    mine = all.filter((l) =>
      (l.status === "open" && (l.type === "donation" || l.escalated)) || l.claimedBy === me.id);
    title = `🤝 ${me.name}`;
    sub = `Verified NGO · Reg: ${me.ngoReg || "—"} · Donations & escalated listings shown below`;
    const fed = all.filter((l) => l.claimedBy === me.id && l.status === "collected").reduce((s, l) => s + l.qty, 0);
    stats = [
      [mine.filter((l) => l.status === "open").length, "Available to claim"],
      [all.filter((l) => l.claimedBy === me.id && l.status === "claimed").length, "Pickups pending"],
      [fed, "People fed"],
    ];
    $("dashEmptyMsg").textContent = "No donations available right now — you'll see escalated listings here instantly.";
  } else {
    $("newListingBtn").classList.add("hidden");
    mine = all.filter((l) =>
      (l.status === "open" && l.type === "paid" && !l.escalated) || l.claimedBy === me.id);
    title = `🍛 Hey, ${me.name.split(" ")[0]}!`;
    sub = "Discounted surplus near you — claim before the timer runs out.";
    const saved = all.filter((l) => l.claimedBy === me.id && l.status === "collected")
      .reduce((s, l) => s + (l.orig - l.price) * l.qty, 0);
    stats = [
      [mine.filter((l) => l.status === "open").length, "Deals live now"],
      [all.filter((l) => l.claimedBy === me.id && l.status === "claimed").length, "Pickups pending"],
      ["₹" + saved, "Money saved"],
    ];
    $("dashEmptyMsg").textContent = "No deals right now — most surplus appears after lunch & dinner service.";
  }

  $("dashTitle").textContent = title;
  $("dashSub").textContent = sub;
  $("dashStats").innerHTML = stats.map(([n, l]) => `<div class="ds-card"><h3>${n}</h3><p>${l}</p></div>`).join("");
  $("dashToolbar").innerHTML = `
    <input type="search" placeholder="🔍 Search food…" value="${filterText}" oninput="filterText=this.value;renderAll()">
    <select onchange="sortBy=this.value;renderAll()">
      <option value="time" ${sortBy === "time" ? "selected" : ""}>⏱ Expiring soonest</option>
      <option value="dist" ${sortBy === "dist" ? "selected" : ""}>📍 Nearest first</option>
      <option value="price" ${sortBy === "price" ? "selected" : ""}>💰 Cheapest first</option>
    </select>
    <button class="btn btn-outline btn-sm" onclick="requestLocation()">📍 Use my location</button>`;

  let shown = mine.filter((l) => l.item.toLowerCase().includes(filterText.toLowerCase()));
  shown.sort((a, b) => {
    if (sortBy === "dist" && userPos) return (distKm(userPos, a) ?? 1e9) - (distKm(userPos, b) ?? 1e9);
    if (sortBy === "price") return a.price - b.price;
    return a.expiresAt - b.expiresAt;
  });
  // active first
  const order = { open: 0, claimed: 1, collected: 2, expired: 3, cancelled: 4 };
  shown.sort((a, b) => order[a.status] - order[b.status]);

  $("dashListings").innerHTML = shown.map((l) => listingCard(l, me)).join("");
  $("dashEmpty").classList.toggle("hidden", shown.length > 0);
}

/* ---------- Animated stat counters ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const el = en.target, target = +el.dataset.count;
    let cur = 0; const step = Math.max(1, Math.ceil(target / 60));
    const iv = setInterval(() => {
      cur = Math.min(target, cur + step);
      el.textContent = cur + (target >= 60 ? "M+" : target > 30 ? "%" : target === 14 ? "B" : "M");
      if (cur >= target) clearInterval(iv);
    }, 25);
    io.unobserve(el);
  });
}, { threshold: 0.4 });
document.querySelectorAll("[data-count]").forEach((el) => io.observe(el));

/* ---------- Init ---------- */
seed();
requestLocation();
renderAll();
tick();
