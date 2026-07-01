/* =========================================================
   ANNDAAN — app logic
   Everything runs client-side. localStorage acts as the
   "database" so this can be deployed as a static site
   (e.g. GitHub Pages) with no server.
   ========================================================= */

(function () {
  "use strict";

  /* ---------- constants ---------- */
  const DB_USERS = "anndaan_users";
  const DB_LISTINGS = "anndaan_listings";
  const DB_NOTIFS = "anndaan_notifications";
  const DB_SESSION = "anndaan_session";
  const DB_SEEDED = "anndaan_seeded_v1";

  const DEFAULT_LAT = 9.9816;   // demo city centre (Kochi, Kerala)
  const DEFAULT_LNG = 76.2999;
  const CO2_PER_MEAL_KG = 0.9;  // rough estimate used for the impact counter
  const SAFE_HOLD_HOURS = 4;    // FSSAI-style soft guideline used for the warning banner

  /* ---------- tiny storage helpers ---------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };

  const uid = (prefix) => prefix + "_" + Math.random().toString(36).slice(2, 9);
  const now = () => Date.now();
  const fmtMoney = (n) => (n === 0 ? "Free" : "₹" + n);

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function jitter(base, spreadKm) {
    // rough km-to-degree offset for demo seed data
    return base + (Math.random() - 0.5) * (spreadKm / 111);
  }

  /* ---------- seed demo data (first run only) ---------- */
  function seed() {
    if (store.get(DB_SEEDED, false)) return;

    const users = [
      {
        id: "u_rest1", role: "restaurant", name: "Hotel Green Leaf", email: "restaurant@demo.com",
        password: "demo123", phone: "9800000001", address: "MG Road, Kochi",
        lat: jitter(DEFAULT_LAT, 1.5), lng: jitter(DEFAULT_LNG, 1.5),
      },
      {
        id: "u_rest2", role: "restaurant", name: "Spice Route Kitchen", email: "spiceroute@demo.com",
        password: "demo123", phone: "9800000002", address: "Marine Drive, Kochi",
        lat: jitter(DEFAULT_LAT, 1.5), lng: jitter(DEFAULT_LNG, 1.5),
      },
      {
        id: "u_ngo1", role: "ngo", name: "Snehasparsham Trust", email: "ngo@demo.com",
        password: "demo123", phone: "9800000003", address: "Kadavanthra, Kochi",
        lat: jitter(DEFAULT_LAT, 1.5), lng: jitter(DEFAULT_LNG, 1.5),
        ngoReg: "KL/NGO/2019/0451", ngoVerified: true,
      },
      {
        id: "u_user1", role: "user", name: "Anjali Menon", email: "user@demo.com",
        password: "demo123", phone: "9800000004", address: "Panampilly Nagar, Kochi",
        lat: jitter(DEFAULT_LAT, 1.5), lng: jitter(DEFAULT_LNG, 1.5),
      },
    ];
    store.set(DB_USERS, users);

    const t = now();
    const listings = [
      mkListing({
        restaurantId: "u_rest1", restaurantName: "Hotel Green Leaf", item: "Veg Thali",
        qty: 12, unit: "portions", price: 60, originalPrice: 120, prepHours: 1.5, windowMin: 25,
        createdAt: t - 5 * 60000, address: "MG Road, Kochi", ngoOnly: false,
      }),
      mkListing({
        restaurantId: "u_rest1", restaurantName: "Hotel Green Leaf", item: "Butter Naan (packs of 4)",
        qty: 20, unit: "boxes", price: 0, originalPrice: 0, prepHours: 2, windowMin: 90,
        createdAt: t - 10 * 60000, address: "MG Road, Kochi", ngoOnly: false,
      }),
      mkListing({
        restaurantId: "u_rest2", restaurantName: "Spice Route Kitchen", item: "Chicken Biryani",
        qty: 8, unit: "plates", price: 100, originalPrice: 220, prepHours: 3.5, windowMin: 18,
        createdAt: t - 12 * 60000, address: "Marine Drive, Kochi", ngoOnly: false,
      }),
      mkListing({
        restaurantId: "u_rest2", restaurantName: "Spice Route Kitchen", item: "Wedding surplus — mixed rice & curries",
        qty: 60, unit: "portions", price: 0, originalPrice: 0, prepHours: 1, windowMin: 120,
        createdAt: t - 2 * 60000, address: "Marine Drive, Kochi", ngoOnly: true,
      }),
      mkListing({
        restaurantId: "u_rest1", restaurantName: "Hotel Green Leaf", item: "Fruit salad cups",
        qty: 15, unit: "boxes", price: 40, originalPrice: 90, prepHours: 5, windowMin: 15,
        createdAt: t - 13 * 60000, address: "MG Road, Kochi", ngoOnly: false,
      }),
    ];
    store.set(DB_LISTINGS, listings);
    store.set(DB_NOTIFS, []);
    store.set(DB_SEEDED, true);
  }

  function mkListing(cfg) {
    const expiryAt = cfg.createdAt + cfg.windowMin * 60000;
    return {
      id: uid("lst"),
      restaurantId: cfg.restaurantId,
      restaurantName: cfg.restaurantName,
      item: cfg.item,
      qty: cfg.qty,
      unit: cfg.unit,
      price: cfg.price,
      originalPrice: cfg.originalPrice,
      prepHours: cfg.prepHours,
      windowMin: cfg.windowMin,
      createdAt: cfg.createdAt,
      expiryAt,
      ngoOnly: !!cfg.ngoOnly,
      lat: jitter(DEFAULT_LAT, 2),
      lng: jitter(DEFAULT_LNG, 2),
      address: cfg.address,
      status: "available", // available -> escalated -> claimed -> completed | expired
      claimedBy: null,
      claimedByName: null,
      claimedAt: null,
      otp: null,
      escalatedAt: null,
    };
  }

  /* ---------- session ---------- */
  function getSession() {
    const sid = store.get(DB_SESSION, null);
    if (!sid) return null;
    return store.get(DB_USERS, []).find((u) => u.id === sid) || null;
  }
  function setSession(userId) {
    store.set(DB_SESSION, userId);
  }
  function clearSession() {
    localStorage.removeItem(DB_SESSION);
  }

  /* ---------- notifications ---------- */
  function notify(userId, message) {
    const list = store.get(DB_NOTIFS, []);
    list.unshift({ id: uid("ntf"), userId, message, createdAt: now(), read: false });
    store.set(DB_NOTIFS, list.slice(0, 100));
    renderNotifications();
  }
  function notifyRole(role, message, excludeId) {
    store.get(DB_USERS, []).forEach((u) => {
      if (u.role === role && u.id !== excludeId) notify(u.id, message);
    });
  }

  /* ==========================================================
     ROUTER
     ========================================================== */
  const PAGES = ["home", "auth", "dashboard", "browse", "safety", "about"];

  function currentHash() {
    const h = (location.hash || "#home").replace("#", "");
    return PAGES.includes(h) ? h : "home";
  }

  function navigateTo(page) {
    location.hash = "#" + page;
  }

  function renderRoute() {
    const page = currentHash();
    PAGES.forEach((p) => {
      const el = document.getElementById("page-" + p);
      if (el) el.hidden = p !== page;
    });
    document.querySelectorAll("[data-nav]").forEach((a) => {
      a.classList.toggle("active", a.dataset.nav === page);
    });
    closeMobileNav();
    if (page === "dashboard") renderDashboard();
    if (page === "browse") renderBrowse();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  window.addEventListener("hashchange", renderRoute);

  /* ==========================================================
     NAVBAR / AUTH STATE
     ========================================================== */
  function refreshAuthUI() {
    const user = getSession();
    const authArea = document.getElementById("authArea");
    const userArea = document.getElementById("userArea");
    const chip = document.getElementById("userChip");

    if (user) {
      authArea.hidden = true;
      userArea.hidden = false;
      const roleLabel = user.role === "ngo" ? "NGO" : user.role === "restaurant" ? "Restaurant" : "Buyer";
      chip.textContent = `${user.name} · ${roleLabel}`;
    } else {
      authArea.hidden = false;
      userArea.hidden = true;
    }
  }

  document.getElementById("logoutBtn").addEventListener("click", () => {
    clearSession();
    refreshAuthUI();
    toast("Logged out");
    navigateTo("home");
  });

  function closeMobileNav() {
    document.getElementById("navlinks").classList.remove("open");
  }
  document.getElementById("hamburger").addEventListener("click", () => {
    document.getElementById("navlinks").classList.toggle("open");
  });

  /* ==========================================================
     TOAST
     ========================================================== */
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3200);
  }

  /* ==========================================================
     NOTIFICATION PANEL
     ========================================================== */
  const bellBtn = document.getElementById("bellBtn");
  const notifPanel = document.getElementById("notifPanel");
  bellBtn.addEventListener("click", () => {
    notifPanel.hidden = !notifPanel.hidden;
    if (!notifPanel.hidden) markAllRead();
  });
  document.addEventListener("click", (e) => {
    if (!notifPanel.hidden && !notifPanel.contains(e.target) && e.target !== bellBtn) {
      notifPanel.hidden = true;
    }
  });

  function markAllRead() {
    const user = getSession();
    if (!user) return;
    const list = store.get(DB_NOTIFS, []).map((n) => (n.userId === user.id ? { ...n, read: true } : n));
    store.set(DB_NOTIFS, list);
    renderNotifications();
  }

  function timeAgo(ts) {
    const s = Math.round((now() - ts) / 1000);
    if (s < 60) return s + "s ago";
    if (s < 3600) return Math.floor(s / 60) + "m ago";
    return Math.floor(s / 3600) + "h ago";
  }

  function renderNotifications() {
    const user = getSession();
    const dot = document.getElementById("bellDot");
    const list = document.getElementById("notifList");
    if (!user) {
      dot.hidden = true;
      list.innerHTML = '<p class="muted">Log in to see notifications.</p>';
      return;
    }
    const mine = store.get(DB_NOTIFS, []).filter((n) => n.userId === user.id).slice(0, 25);
    dot.hidden = !mine.some((n) => !n.read);
    list.innerHTML = mine.length
      ? mine
          .map(
            (n) => `<div class="notif-item ${n.read ? "" : "unread"}">${escapeHtml(n.message)}<time>${timeAgo(n.createdAt)}</time></div>`
          )
          .join("")
      : '<p class="muted">No notifications yet.</p>';
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

   /* ---------- pull real user data from Supabase ---------- */
  async function loadUserFromSupabase(authUserId) {
    const { data: profile } = await db
      .from("profiles")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle();

    if (!profile) return null;

    const { data: authData } = await db.auth.getUser();
    const email = authData?.user?.email || "";

    let extra = {
      address: "",
      lat: jitter(DEFAULT_LAT, 2),
      lng: jitter(DEFAULT_LNG, 2),
      ngoReg: null,
      ngoVerified: undefined,
    };

    if (profile.role === "restaurant") {
      const { data: rest } = await db
        .from("restaurants")
        .select("*")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (rest) {
        extra.address = rest.address || "";
        if (rest.lat != null) extra.lat = rest.lat;
        if (rest.lng != null) extra.lng = rest.lng;
      }
    }

    return {
      id: authUserId,
      role: profile.role,
      name: profile.full_name || "",
      email,
      phone: profile.phone || "",
      ...extra,
    };
  }

  /* ==========================================================
     AUTH PAGE
     ========================================================== */
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const isLogin = tab.dataset.tab === "login";
      document.getElementById("loginForm").hidden = !isLogin;
      document.getElementById("signupForm").hidden = isLogin;
    });
  });

  document.getElementById("signupRole").addEventListener("change", (e) => {
    document.getElementById("signupRegWrap").hidden = e.target.value !== "ngo";
  });

   /*
  document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const pw = document.getElementById("loginPassword").value;
    const user = store.get(DB_USERS, []).find((u) => u.email.toLowerCase() === email && u.password === pw);
    const errEl = document.getElementById("loginError");
    if (!user) {
      errEl.textContent = "No account matches that email and password.";
      return;
    }
    errEl.textContent = "";
    setSession(user.id);
    refreshAuthUI();
    renderNotifications();
    toast(`Welcome back, ${user.name}`);
    navigateTo("dashboard");
  });
*/

   document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("loginError");
    const email = document.getElementById("loginEmail").value.trim().toLowerCase();
    const pw = document.getElementById("loginPassword").value;

    const { data, error } = await db.auth.signInWithPassword({ email, password: pw });
    if (error) {
      errEl.textContent = "No account matches that email and password.";
      return;
    }
    errEl.textContent = "";

    const user = await loadUserFromSupabase(data.user.id);
    if (!user) {
      errEl.textContent = "Logged in, but couldn't load your profile.";
      return;
    }

    const users = store.get(DB_USERS, []).filter((u) => u.id !== user.id);
    users.push(user);
    store.set(DB_USERS, users);

    setSession(user.id);
    refreshAuthUI();
    renderNotifications();
    toast(`Welcome back, ${user.name}`);
    navigateTo("dashboard");
  });
   
  document.querySelectorAll("[data-demo]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const map = { restaurant: "restaurant@demo.com", ngo: "ngo@demo.com", user: "user@demo.com" };
      document.getElementById("loginEmail").value = map[btn.dataset.demo];
      document.getElementById("loginPassword").value = "demo123";
    });
  });


   /*
  document.getElementById("signupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const errEl = document.getElementById("signupError");
    const role = document.getElementById("signupRole").value;
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const phone = document.getElementById("signupPhone").value.trim();
    const password = document.getElementById("signupPassword").value;
    const address = document.getElementById("signupAddress").value.trim();
    const ngoReg = document.getElementById("signupReg").value.trim();

    if (role === "ngo" && !ngoReg) {
      errEl.textContent = "NGO registration number is required for NGO accounts.";
      return;
    }
    if (password.length < 6) {
      errEl.textContent = "Password must be at least 6 characters.";
      return;
    }
    const users = store.get(DB_USERS, []);
    if (users.some((u) => u.email.toLowerCase() === email)) {
      errEl.textContent = "An account with that email already exists.";
      return;
    }
    errEl.textContent = "";

    const newUser = {
      id: uid("usr"), role, name, email, phone, password, address,
      lat: jitter(DEFAULT_LAT, 2), lng: jitter(DEFAULT_LNG, 2),
      ngoReg: role === "ngo" ? ngoReg : null,
      ngoVerified: role === "ngo" ? true : undefined, // simulated instant verification for this demo
    };
    users.push(newUser);
    store.set(DB_USERS, users);
    setSession(newUser.id);
    refreshAuthUI();
    renderNotifications();
    toast(role === "ngo" ? "NGO account created — verification simulated ✔" : "Account created!");
    e.target.reset();
    navigateTo("dashboard");
  });
  */

   document.getElementById("google-login").addEventListener("click", async () => {
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: "https://onlineforall.run.place/#dashboard" },
    });
    if (error) toast("Google sign-in failed. Try again.");
  });

  /* ---------- handle returning from Google login ---------- */
  (async function checkGoogleRedirect() {
    const { data } = await db.auth.getUser();
    if (!data?.user) return;
    if (getSession()) return; // already logged in locally, nothing to do

    const user = await loadUserFromSupabase(data.user.id);
    if (!user) return;

    const users = store.get(DB_USERS, []).filter((u) => u.id !== user.id);
    users.push(user);
    store.set(DB_USERS, users);
    setSession(user.id);
    refreshAuthUI();
    renderNotifications();
    toast(`Welcome, ${user.name || "there"}!`);
  })();


   document.getElementById("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = document.getElementById("signupError");
    const role = document.getElementById("signupRole").value;
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim().toLowerCase();
    const phone = document.getElementById("signupPhone").value.trim();
    const password = document.getElementById("signupPassword").value;
    const address = document.getElementById("signupAddress").value.trim();
    const ngoReg = document.getElementById("signupReg").value.trim();

    if (role === "ngo" && !ngoReg) {
      errEl.textContent = "NGO registration number is required for NGO accounts.";
      return;
    }
    if (password.length < 6) {
      errEl.textContent = "Password must be at least 6 characters.";
      return;
    }
    errEl.textContent = "";

    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { role, full_name: name, phone } },
    });
    if (error) {
      errEl.textContent = error.message;
      return;
    }

    const authUserId = data.user.id;

    if (role === "restaurant") {
      await db.from("restaurants").insert({
        user_id: authUserId, name, phone, address,
        lat: jitter(DEFAULT_LAT, 2), lng: jitter(DEFAULT_LNG, 2),
      });
    }

    const user = await loadUserFromSupabase(authUserId);
    if (user && role === "ngo") {
      user.ngoReg = ngoReg;
      user.ngoVerified = true;
    }

    if (user) {
      const users = store.get(DB_USERS, []).filter((u) => u.id !== authUserId);
      users.push(user);
      store.set(DB_USERS, users);
    }

    setSession(authUserId);
    refreshAuthUI();
    renderNotifications();
    toast(role === "ngo" ? "NGO account created — verification simulated ✔" : "Account created!");
    e.target.reset();
    navigateTo("dashboard");
  });
   

  /* ==========================================================
     COUNTDOWN HELPERS
     ========================================================== */
  function remainingMs(listing) {
    return listing.expiryAt - now();
  }
  function fmtCountdown(ms) {
    if (ms <= 0) return "Expired";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  function escalationThresholdMs(listing) {
    return Math.min(20 * 60000, listing.windowMin * 60000 * 0.25);
  }

  /* ---------- state engine: run on every tick ---------- */
  function tickListings() {
    const listings = store.get(DB_LISTINGS, []);
    let changed = false;
    listings.forEach((l) => {
      if (l.status === "available" || l.status === "escalated") {
        const rem = remainingMs(l);
        if (rem <= 0) {
          l.status = "expired";
          changed = true;
        } else if (l.status === "available" && l.price > 0 && !l.ngoOnly && rem <= escalationThresholdMs(l)) {
          l.status = "escalated";
          l.escalatedAt = now();
          changed = true;
          notifyRole("ngo", `🚨 "${l.item}" from ${l.restaurantName} just went free — unclaimed with time running out.`);
        }
      }
    });
    if (changed) store.set(DB_LISTINGS, listings);
    return changed;
  }

  /* ==========================================================
     DASHBOARD (restaurant / claimant)
     ========================================================== */
  function renderDashboard() {
    const user = getSession();
    document.getElementById("dashLocked").hidden = !!user;
    document.getElementById("dashRestaurant").hidden = !(user && user.role === "restaurant");
    document.getElementById("dashClaimant").hidden = !(user && user.role !== "restaurant");
    if (!user) return;

    if (user.role === "restaurant") {
      renderRestaurantDashboard(user);
    } else {
      renderClaimantDashboard(user);
    }
  }

  function renderRestaurantDashboard(user) {
    document.getElementById("restDashName").textContent = user.name;
    const listings = store.get(DB_LISTINGS, []).filter((l) => l.restaurantId === user.id);
    const completed = listings.filter((l) => l.status === "completed");
    const mealsGiven = completed.reduce((sum, l) => sum + Number(l.qty), 0);
    const earned = completed.filter((l) => l.price > 0).reduce((sum, l) => sum + Number(l.price), 0);
    const donated = completed.filter((l) => l.price === 0).length;

    document.getElementById("restImpact").innerHTML = [
      chip(`${listings.length} listings`),
      chip(`${mealsGiven} meals moved`),
      chip(`₹${earned} earned`),
      chip(`${donated} donations completed`),
    ].join("");

    const wrap = document.getElementById("restListings");
    if (!listings.length) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = listings
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((l) => restaurantListingCard(l))
      .join("");

    wrap.querySelectorAll("[data-verify]").forEach((btn) => {
      btn.addEventListener("click", () => openVerifyModal(btn.dataset.verify));
    });
    wrap.querySelectorAll("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => cancelListing(btn.dataset.cancel));
    });
  }

  function chip(text) {
    return `<span class="impact-chip">${escapeHtml(text)}</span>`;
  }

  function statusTag(l) {
    const map = {
      available: '<span class="tag tag--status">Listed</span>',
      escalated: '<span class="tag tag--escalated">🚨 Escalated — free</span>',
      claimed: '<span class="tag tag--status">Claimed — awaiting pickup</span>',
      completed: '<span class="tag tag--donation">Picked up ✔</span>',
      expired: '<span class="tag tag--status">Expired</span>',
    };
    return map[l.status] || "";
  }

  function restaurantListingCard(l) {
    const rem = remainingMs(l);
    const timerClass = rem <= 0 ? "expired" : "";
    let actions = "";
    if (l.status === "claimed") {
      actions = `<button class="btn btn--primary btn--sm" data-verify="${l.id}">Verify pickup (OTP)</button>`;
    } else if (l.status === "available" || l.status === "escalated") {
      actions = `<button class="btn btn--ghost btn--sm" data-cancel="${l.id}">Cancel listing</button>`;
    }
    return `
      <div class="lcard" style="padding-bottom:16px;">
        <div class="lcard__top">
          <div class="lcard__tags">
            <span class="tag ${l.price === 0 ? "tag--donation" : "tag--discount"}">${l.price === 0 ? "Donation" : "Discounted"}</span>
            ${l.ngoOnly ? '<span class="tag tag--ngo">NGO only</span>' : ""}
            ${statusTag(l)}
          </div>
          <span class="lcard__timer ${timerClass}">${fmtCountdown(rem)}</span>
        </div>
        <h4>${escapeHtml(l.item)}</h4>
        <p class="lcard__meta">${l.qty} ${escapeHtml(l.unit)} · listed ${timeAgo(l.createdAt)}${l.claimedByName ? ` · claimed by ${escapeHtml(l.claimedByName)}` : ""}</p>
        <div class="lcard__price">
          ${l.originalPrice > l.price ? `<span class="strike">₹${l.originalPrice}</span>` : ""}
          <span class="now">${fmtMoney(l.price)}</span>
        </div>
        ${actions ? `<div class="lcard__perf"></div><div class="lcard__foot">${actions}</div>` : '<div style="height:16px"></div>'}
      </div>`;
  }

  function cancelListing(id) {
    const listings = store.get(DB_LISTINGS, []);
    const l = listings.find((x) => x.id === id);
    if (!l) return;
    l.status = "expired";
    store.set(DB_LISTINGS, listings);
    toast("Listing cancelled.");
    renderRestaurantDashboard(getSession());
  }

  function renderClaimantDashboard(user) {
    document.getElementById("claimantEyebrow").textContent = user.role === "ngo" ? "NGO DASHBOARD" : "YOUR ACCOUNT";
    document.getElementById("claimantName").textContent = user.name;

    document.getElementById("ngoBadgeRow").hidden = user.role !== "ngo";
    if (user.role === "ngo") {
      document.getElementById("ngoRegNo").textContent = user.ngoReg || "—";
    }

    const claims = store.get(DB_LISTINGS, []).filter((l) => l.claimedBy === user.id);
    const completed = claims.filter((l) => l.status === "completed");
    const mealsReceived = completed.reduce((sum, l) => sum + Number(l.qty), 0);
    const saved = completed.filter((l) => l.price > 0).reduce((sum, l) => sum + (l.originalPrice - l.price), 0);

    const impactBits =
      user.role === "ngo"
        ? [chip(`${completed.length} donations received`), chip(`${mealsReceived} meals`), chip(`~${mealsReceived * 3} people served (est.)`)]
        : [chip(`${completed.length} pickups completed`), chip(`${mealsReceived} meals`), chip(`₹${saved} saved`)];
    document.getElementById("claimantImpact").innerHTML = impactBits.join("");

    const wrap = document.getElementById("myClaims");
    if (!claims.length) {
      wrap.innerHTML = "";
      return;
    }
    wrap.innerHTML = claims
      .slice()
      .sort((a, b) => b.claimedAt - a.claimedAt)
      .map((l) => claimantListingCard(l))
      .join("");
    wrap.querySelectorAll("[data-ticket]").forEach((btn) => {
      btn.addEventListener("click", () => openTicketModal(btn.dataset.ticket));
    });
  }

  function claimantListingCard(l) {
    const rem = remainingMs(l);
    const showTicket = l.status === "claimed";
    return `
      <div class="lcard" style="padding-bottom:16px;">
        <div class="lcard__top">
          <div class="lcard__tags">
            <span class="tag ${l.price === 0 ? "tag--donation" : "tag--discount"}">${l.price === 0 ? "Donation" : "Discounted"}</span>
            ${statusTag(l)}
          </div>
          <span class="lcard__timer ${rem <= 0 ? "expired" : ""}">${l.status === "completed" ? "Done" : fmtCountdown(rem)}</span>
        </div>
        <h4>${escapeHtml(l.item)}</h4>
        <p class="lcard__meta">${escapeHtml(l.restaurantName)} · ${l.qty} ${escapeHtml(l.unit)}</p>
        <div class="lcard__price"><span class="now">${fmtMoney(l.price)}</span></div>
        ${showTicket ? `<div class="lcard__perf"></div><div class="lcard__foot"><button class="btn btn--outline btn--sm" data-ticket="${l.id}">View pickup ticket</button></div>` : '<div style="height:16px"></div>'}
      </div>`;
  }

  /* ==========================================================
     LISTING FORM (restaurant)
     ========================================================== */
  const lfIsDonation = document.getElementById("lfIsDonation");
  const lfPriceWrap = document.getElementById("lfPriceWrap");
  lfIsDonation.addEventListener("change", () => {
    lfPriceWrap.hidden = lfIsDonation.checked;
    if (lfIsDonation.checked) document.getElementById("lfPrice").value = 0;
  });

  document.getElementById("lfPrep").addEventListener("input", (e) => {
    document.getElementById("lfSafetyWarn").hidden = !(Number(e.target.value) > SAFE_HOLD_HOURS);
  });

  let pendingListingLoc = null;
  document.getElementById("lfUseLocation").addEventListener("click", () => {
    const status = document.getElementById("lfLocStatus");
    if (!navigator.geolocation) {
      status.textContent = "Geolocation isn't available in this browser — using approximate area default.";
      return;
    }
    status.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        pendingListingLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        status.textContent = "Location set from your device ✔";
      },
      () => {
        status.textContent = "Couldn't get your location — using approximate area default.";
      },
      { timeout: 8000 }
    );
  });

  document.getElementById("listingForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const user = getSession();
    if (!user || user.role !== "restaurant") return;
    const errEl = document.getElementById("lfError");

    const item = document.getElementById("lfItem").value.trim();
    const qty = Number(document.getElementById("lfQty").value);
    const unit = document.getElementById("lfUnit").value;
    const isDonation = document.getElementById("lfIsDonation").checked;
    const price = isDonation ? 0 : Number(document.getElementById("lfPrice").value || 0);
    const prepHours = Number(document.getElementById("lfPrep").value);
    const windowMin = Number(document.getElementById("lfWindow").value);
    const address = document.getElementById("lfAddress").value.trim();
    const safetyOk = document.getElementById("lfSafetyConfirm").checked;

    if (!item || !qty || !windowMin || !address) {
      errEl.textContent = "Please fill in all required fields.";
      return;
    }
    if (!isDonation && (!price || price <= 0)) {
      errEl.textContent = "Set a price greater than ₹0, or mark this as a free donation instead.";
      return;
    }
    if (!safetyOk) {
      errEl.textContent = "Please confirm the hygiene & safety checkbox before publishing.";
      return;
    }
    errEl.textContent = "";

    const loc = pendingListingLoc || { lat: user.lat, lng: user.lng };
    const listings = store.get(DB_LISTINGS, []);
    const listing = mkListing({
      restaurantId: user.id,
      restaurantName: user.name,
      item, qty, unit,
      price, originalPrice: isDonation ? 0 : Math.round(price * 2),
      prepHours, windowMin, createdAt: now(), address,
      ngoOnly: document.getElementById("lfNgoOnly").checked,
    });
    listing.lat = loc.lat;
    listing.lng = loc.lng;
    listings.push(listing);
    store.set(DB_LISTINGS, listings);

    notifyRole(listing.ngoOnly || isDonation ? "ngo" : "user", `New ${isDonation ? "donation" : "discounted"} listing near you: "${item}" from ${user.name}.`, user.id);
    if (isDonation || listing.ngoOnly) notifyRole("ngo", `New surplus for NGOs: "${item}" from ${user.name}.`, user.id);

    toast("Listing published!");
    e.target.reset();
    lfPriceWrap.hidden = false;
    document.getElementById("lfSafetyWarn").hidden = true;
    pendingListingLoc = null;
    document.getElementById("lfLocStatus").textContent = "Location not set — using approximate area default.";
    renderRestaurantDashboard(user);
  });

  /* ==========================================================
     BROWSE PAGE
     ========================================================== */
  let browserGeo = null; // {lat,lng} if user granted location
  document.getElementById("geoBtn").addEventListener("click", () => {
    const status = document.getElementById("geoStatus");
    if (!navigator.geolocation) {
      status.textContent = "Geolocation isn't available in this browser.";
      return;
    }
    status.textContent = "Locating…";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        browserGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        status.textContent = "Showing distances from your current location.";
        renderBrowse();
      },
      () => {
        status.textContent = "Location denied — showing distances from Kochi city centre (default).";
      },
      { timeout: 8000 }
    );
  });

  ["radiusFilter", "typeFilter", "sortFilter"].forEach((id) => {
    document.getElementById(id).addEventListener("change", renderBrowse);
  });

  function renderBrowse() {
    const origin = browserGeo || { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
    const radius = Number(document.getElementById("radiusFilter").value);
    const type = document.getElementById("typeFilter").value;
    const sort = document.getElementById("sortFilter").value;
    const user = getSession();

    let listings = store.get(DB_LISTINGS, []).filter((l) => l.status === "available" || l.status === "escalated");

    // role gating: NGO-only bulk listings hidden from regular buyers
    listings = listings.filter((l) => !l.ngoOnly || (user && user.role === "ngo"));

    listings = listings.map((l) => ({ ...l, distanceKm: haversineKm(origin.lat, origin.lng, l.lat, l.lng) }));
    listings = listings.filter((l) => l.distanceKm <= radius);

    if (type === "discount") listings = listings.filter((l) => l.price > 0 && l.status !== "escalated");
    if (type === "donation") listings = listings.filter((l) => l.price === 0);
    if (type === "escalated") listings = listings.filter((l) => l.status === "escalated");

    if (sort === "distance") listings.sort((a, b) => a.distanceKm - b.distanceKm);
    else if (sort === "newest") listings.sort((a, b) => b.createdAt - a.createdAt);
    else listings.sort((a, b) => remainingMs(a) - remainingMs(b)); // urgency

    const grid = document.getElementById("browseGrid");
    document.getElementById("browseEmpty").hidden = listings.length > 0;
    grid.innerHTML = listings.map((l) => browseCard(l, user)).join("");

    grid.querySelectorAll("[data-claim]").forEach((btn) => {
      btn.addEventListener("click", () => openClaimModal(btn.dataset.claim));
    });
  }

  function browseCard(l, user) {
    const rem = remainingMs(l);
    const canClaim = !!user && user.role !== "restaurant";
    let btnLabel = "Log in to claim";
    let btnAttrs = 'data-nav="auth" href="#auth"';
    let tagEl = "a";
    if (canClaim) {
      btnLabel = l.price === 0 || l.status === "escalated" ? "Claim — free" : `Claim for ${fmtMoney(l.price)}`;
      btnAttrs = `data-claim="${l.id}"`;
      tagEl = "button";
    }
    return `
      <div class="lcard">
        <div class="lcard__top">
          <div class="lcard__tags">
            <span class="tag ${l.price === 0 || l.status === "escalated" ? "tag--donation" : "tag--discount"}">${l.status === "escalated" ? "Escalated" : l.price === 0 ? "Donation" : "Discounted"}</span>
            ${l.ngoOnly ? '<span class="tag tag--ngo">NGO only</span>' : ""}
          </div>
          <span class="lcard__timer">${fmtCountdown(rem)}</span>
        </div>
        <h4>${escapeHtml(l.item)}</h4>
        <p class="lcard__meta">${escapeHtml(l.restaurantName)} · ${l.distanceKm.toFixed(1)} km away · ${l.qty} ${escapeHtml(l.unit)}</p>
        <div class="lcard__price">
          ${l.originalPrice > l.price ? `<span class="strike">₹${l.originalPrice}</span>` : ""}
          <span class="now">${l.status === "escalated" ? "Free" : fmtMoney(l.price)}</span>
        </div>
        <div class="lcard__perf"></div>
        <div class="lcard__foot">
          <${tagEl} class="btn btn--primary btn--sm" ${btnAttrs}>${btnLabel}</${tagEl}>
        </div>
      </div>`;
  }

  /* ==========================================================
     CLAIM MODAL
     ========================================================== */
  let claimTargetId = null;
  const claimOverlay = document.getElementById("claimModalOverlay");

  function openClaimModal(listingId) {
    const l = store.get(DB_LISTINGS, []).find((x) => x.id === listingId);
    if (!l) return;
    claimTargetId = listingId;
    const priceLabel = l.status === "escalated" || l.price === 0 ? "free" : fmtMoney(l.price);
    document.getElementById("claimModalText").textContent =
      `Claim "${l.item}" (${l.qty} ${l.unit}) from ${l.restaurantName} for ${priceLabel}. ` +
      `You'll get a pickup OTP — collect within the remaining window.`;
    claimOverlay.hidden = false;
  }
  document.getElementById("claimCancelBtn").addEventListener("click", () => (claimOverlay.hidden = true));
  document.getElementById("claimModalClose").addEventListener("click", () => (claimOverlay.hidden = true));

  document.getElementById("claimConfirmBtn").addEventListener("click", () => {
    const user = getSession();
    if (!user || !claimTargetId) return;
    const listings = store.get(DB_LISTINGS, []);
    const l = listings.find((x) => x.id === claimTargetId);
    if (!l || (l.status !== "available" && l.status !== "escalated")) {
      toast("Sorry — this listing was just claimed by someone else.");
      claimOverlay.hidden = true;
      renderBrowse();
      return;
    }
    l.status = "claimed";
    l.claimedBy = user.id;
    l.claimedByName = user.name;
    l.claimedAt = now();
    l.otp = String(Math.floor(1000 + Math.random() * 9000));
    store.set(DB_LISTINGS, listings);

    notify(l.restaurantId, `"${l.item}" was claimed by ${user.name}. Ask for OTP ${l.otp} at pickup.`);
    toast("Claimed! Your pickup ticket is ready.");
    claimOverlay.hidden = true;
    renderBrowse();
    openTicketModal(l.id);
  });

  /* ==========================================================
     TICKET MODAL (OTP + QR)
     ========================================================== */
  const ticketOverlay = document.getElementById("ticketModalOverlay");
  function openTicketModal(listingId) {
    const l = store.get(DB_LISTINGS, []).find((x) => x.id === listingId);
    if (!l) return;
    document.getElementById("ticketId").textContent = "#" + l.id.slice(-6).toUpperCase();
    document.getElementById("ticketItem").textContent = l.item;
    document.getElementById("ticketMeta").textContent = `${l.restaurantName} · ${l.qty} ${l.unit} · ${l.address}`;
    document.getElementById("ticketOtp").textContent = l.otp || "----";
    document.getElementById("ticketTag").textContent = l.status === "completed" ? "PICKED UP" : "CLAIMED";

    const qrEl = document.getElementById("ticketQr");
    qrEl.innerHTML = "";
    if (window.QRCode) {
      new QRCode(qrEl, {
        text: `ANNDAAN|${l.id}|OTP:${l.otp}`,
        width: 128,
        height: 128,
        colorDark: "#201A12",
        colorLight: "#ffffff",
      });
    } else {
      qrEl.innerHTML = '<p class="muted small">QR unavailable offline — use the OTP above.</p>';
    }
    ticketOverlay.hidden = false;
  }
  document.getElementById("ticketModalClose").addEventListener("click", () => (ticketOverlay.hidden = true));

  /* ==========================================================
     VERIFY PICKUP MODAL (restaurant side)
     ========================================================== */
  const verifyOverlay = document.getElementById("verifyModalOverlay");
  function openVerifyModal(listingId) {
    document.getElementById("verifyListingId").value = listingId;
    document.getElementById("verifyOtpInput").value = "";
    document.getElementById("verifyError").textContent = "";
    verifyOverlay.hidden = false;
  }
  document.getElementById("verifyModalClose").addEventListener("click", () => (verifyOverlay.hidden = true));

  document.getElementById("verifyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = document.getElementById("verifyListingId").value;
    const entered = document.getElementById("verifyOtpInput").value.trim();
    const listings = store.get(DB_LISTINGS, []);
    const l = listings.find((x) => x.id === id);
    const errEl = document.getElementById("verifyError");
    if (!l) return;
    if (entered !== l.otp) {
      errEl.textContent = "That code doesn't match. Ask the claimant to re-check their ticket.";
      return;
    }
    l.status = "completed";
    store.set(DB_LISTINGS, listings);
    notify(l.claimedBy, `Pickup confirmed for "${l.item}" — thank you!`);
    toast("Pickup verified — listing closed out.");
    verifyOverlay.hidden = true;
    renderRestaurantDashboard(getSession());
  });

  /* ==========================================================
     GLOBAL IMPACT STATS (home page)
     ========================================================== */
  function renderHomeStats() {
    const listings = store.get(DB_LISTINGS, []);
    const completed = listings.filter((l) => l.status === "completed");
    const meals = completed.reduce((sum, l) => sum + Number(l.qty), 0);
    const ngoDonations = completed.filter((l) => l.price === 0).length;
    const co2 = Math.round(meals * CO2_PER_MEAL_KG);
    document.getElementById("statMeals").textContent = meals.toLocaleString("en-IN");
    document.getElementById("statNgo").textContent = ngoDonations.toLocaleString("en-IN");
    document.getElementById("statCo2").textContent = co2.toLocaleString("en-IN");
  }

  /* ---------- hero demo ticket countdown (purely decorative) ---------- */
  function tickDemoTimer() {
    const el = document.getElementById("demoTimer");
    if (!el) return;
    let [m, s] = el.textContent.split(":").map(Number);
    s -= 1;
    if (s < 0) {
      s = 59;
      m -= 1;
    }
    if (m < 0) {
      m = 24;
      s = 59;
    } // loop for demo purposes
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  /* ==========================================================
     GLOBAL TICK LOOP — keeps everything live
     ========================================================== */
  function tick() {
    tickListings();
    tickDemoTimer();
    renderHomeStats();
    const page = currentHash();
    if (page === "browse") renderBrowse();
    if (page === "dashboard") renderDashboard();
    renderNotifications();
  }

  /* ==========================================================
     INIT
     ========================================================== */
  function init() {
    seed();
    refreshAuthUI();
    renderHomeStats();
    renderNotifications();
    renderRoute();
    setInterval(tick, 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
