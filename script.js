/* =====================================================================
   DOSSIER — shop logic
   Sections: 1) Config  2) Products  3) Cart  4) Rendering
             5) Drawer/Modal  6) Checkout + Razorpay  7) AI Chat  8) Init
   ===================================================================== */

/* ---------------------------------------------------------------------
   1) CONFIG — API keys + endpoints
   --------------------------------------------------------------------- */
const GROQ_API_KEY      = "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";
const GROQ_API_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL        = "llama-3.3-70b-versatile";

// ⚠️  Add your live Razorpay Key ID here when you're ready to accept payments.
// Get it from: https://dashboard.razorpay.com/app/keys
const RAZORPAY_KEY_ID   = "YOUR_RAZORPAY_KEY_ID";

/* ---------------------------------------------------------------------
   2) PRODUCT DATA — edit name / price / desc to match what you sell
   --------------------------------------------------------------------- */
const PRODUCTS = [
  {
    id: "atlas-ui",
    name: "Atlas UI Kit",
    ext: ".FIGMA",
    icon: "layers",
    tab: "marigold",
    price: 1499,
    desc: "120+ components for product teams, built around Figma's auto layout.",
  },
  {
    id: "async-playbook",
    name: "The Async Playbook",
    ext: ".PDF",
    icon: "doc",
    tab: "clay",
    price: 399,
    desc: "A 64-page field guide to running a remote team without the meetings.",
  },
  {
    id: "motion-foundations",
    name: "Motion Foundations",
    ext: ".MP4",
    icon: "play",
    tab: "teal",
    price: 2499,
    desc: "Three hours of video on animation principles for interface designers.",
  },
  {
    id: "ledger-pro",
    name: "Ledger Pro",
    ext: ".ZIP",
    icon: "archive",
    tab: "teal",
    price: 799,
    desc: "A spreadsheet system for freelancers to track invoices and tax set-asides.",
  },
  {
    id: "brandmark-pack",
    name: "Brandmark Pack",
    ext: ".AI",
    icon: "pen",
    tab: "marigold",
    price: 999,
    desc: "40 editable logo marks, plus a one-page guide for using them well.",
  },
  {
    id: "strategy-session",
    name: "1:1 Strategy Session",
    ext: ".CAL",
    icon: "calendar",
    tab: "clay",
    price: 3999,
    desc: "A 45-minute call to pressure-test your product, pricing or positioning.",
  },
];

const TAB_COLORS = {
  marigold: { color: "var(--marigold)", tint: "rgba(232,163,61,.18)" },
  clay:     { color: "var(--clay)",     tint: "rgba(193,84,44,.16)"  },
  teal:     { color: "var(--teal)",     tint: "rgba(63,140,130,.18)" },
};

const ICONS = {
  doc:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 16.5h6M9 9.5h2"/></svg>`,
  play:     `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M11 9.5l4.5 2.5-4.5 2.5z"/></svg>`,
  layers:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 4.5-8 4.5-8-4.5z"/><path d="M4 12l8 4.5 8-4.5"/><path d="M4 16.5l8 4.5 8-4.5"/></svg>`,
  archive:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="13" rx="1.5"/><path d="M4 7l1.5-3h13L20 7"/><path d="M12 11v5M12 11l-1.6 1.6M12 11l1.6 1.6"/></svg>`,
  pen:      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17c3-7 6-10.5 10-13"/><circle cx="4.5" cy="17.5" r="1.5"/><circle cx="14" cy="4" r="1.5"/><path d="M11 9l4 4"/></svg>`,
  calendar: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8.5 14l2 2 4-4.2"/></svg>`,
  user:     `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`,
};

/* ---------------------------------------------------------------------
   3) CART STATE
   --------------------------------------------------------------------- */
const cart = {};

function cartItems()    { return Object.entries(cart).filter(([, q]) => q > 0).map(([id, qty]) => ({ product: PRODUCTS.find(p => p.id === id), qty })); }
function cartSubtotal() { return cartItems().reduce((s, { product, qty }) => s + product.price * qty, 0); }
function cartCount()    { return cartItems().reduce((s, { qty }) => s + qty, 0); }
function formatPrice(n) { return "₹" + n.toLocaleString("en-IN"); }

/* ---------------------------------------------------------------------
   4) RENDERING
   --------------------------------------------------------------------- */
const productGrid   = document.getElementById("product-grid");
const cartCountEl   = document.getElementById("cart-count");
const cartItemsEl   = document.getElementById("cart-items");
const cartSubEl     = document.getElementById("cart-subtotal");
const checkoutBtn   = document.getElementById("checkout-btn");

function productActionHTML(product) {
  const qty = cart[product.id] || 0;
  if (qty === 0) {
    return `<button class="add-btn" data-action="add" data-id="${product.id}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Add
    </button>`;
  }
  return `<div class="qty-stepper">
    <button data-action="dec" data-id="${product.id}" aria-label="Remove one">–</button>
    <span>${qty}</span>
    <button data-action="inc" data-id="${product.id}" aria-label="Add one more">+</button>
  </div>`;
}

function renderProducts() {
  productGrid.innerHTML = PRODUCTS.map(p => {
    const tab = TAB_COLORS[p.tab];
    return `
      <article class="product-card" data-ext="${p.ext}" style="--tab-color:${tab.color};--tab-tint:${tab.tint}">
        <div class="product-icon">${ICONS[p.icon]}</div>
        <h3>${p.name}</h3>
        <p class="desc">${p.desc}</p>
        <div class="product-foot">
          <span class="price">${formatPrice(p.price)}</span>
          <span id="action-${p.id}">${productActionHTML(p)}</span>
        </div>
      </article>`;
  }).join("");
}

function refreshProductAction(id) {
  const el = document.getElementById(`action-${id}`);
  if (el) el.innerHTML = productActionHTML(PRODUCTS.find(p => p.id === id));
}

function renderCart() {
  const items = cartItems();
  cartCountEl.textContent = cartCount();
  cartSubEl.textContent   = formatPrice(cartSubtotal());
  checkoutBtn.disabled    = items.length === 0;

  if (items.length === 0) {
    cartItemsEl.innerHTML = `<p class="cart-empty">Nothing filed yet. Add something from the catalog.</p>`;
    return;
  }
  cartItemsEl.innerHTML = items.map(({ product, qty }) => {
    const tab = TAB_COLORS[product.tab];
    return `
      <div class="cart-row">
        <div class="cart-row-icon" style="--tab-color:${tab.color};--tab-tint:${tab.tint}">${ICONS[product.icon]}</div>
        <div class="cart-row-body">
          <h4>${product.name}</h4>
          <div class="cart-row-foot">
            <span class="cart-row-price">${qty} × ${formatPrice(product.price)}</span>
            <button class="cart-remove" data-action="remove" data-id="${product.id}">Remove</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

function setQty(id, qty) {
  cart[id] = Math.max(0, qty);
  refreshProductAction(id);
  renderCart();
}

productGrid.addEventListener("click", e => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const { action, id } = btn.dataset;
  const cur = cart[id] || 0;
  if (action === "add" || action === "inc") setQty(id, cur + 1);
  if (action === "dec") setQty(id, cur - 1);
});

cartItemsEl.addEventListener("click", e => {
  const btn = e.target.closest("[data-action='remove']");
  if (btn) setQty(btn.dataset.id, 0);
});

/* ---------------------------------------------------------------------
   5) DRAWER / MODAL CONTROLS
   --------------------------------------------------------------------- */
const cartDrawer       = document.getElementById("cart-drawer");
const drawerBackdrop   = document.getElementById("drawer-backdrop");
const checkoutModal    = document.getElementById("checkout-modal");
const checkoutBackdrop = document.getElementById("checkout-backdrop");

function openCart()  { cartDrawer.classList.add("open"); drawerBackdrop.classList.add("show"); cartDrawer.setAttribute("aria-hidden","false"); document.getElementById("cart-toggle").setAttribute("aria-expanded","true"); }
function closeCart() { cartDrawer.classList.remove("open"); drawerBackdrop.classList.remove("show"); cartDrawer.setAttribute("aria-hidden","true"); document.getElementById("cart-toggle").setAttribute("aria-expanded","false"); }

document.getElementById("cart-toggle").addEventListener("click", openCart);
document.getElementById("cart-close").addEventListener("click", closeCart);
drawerBackdrop.addEventListener("click", closeCart);

function openCheckout() {
  if (!cartItems().length) return;
  renderReceipt();
  document.getElementById("checkout-form-panel").hidden  = false;
  document.getElementById("checkout-success-panel").hidden = true;
  closeCart();
  checkoutModal.classList.add("open");
  checkoutBackdrop.classList.add("show");
  checkoutModal.setAttribute("aria-hidden","false");
}
function closeCheckout() {
  checkoutModal.classList.remove("open");
  checkoutBackdrop.classList.remove("show");
  checkoutModal.setAttribute("aria-hidden","true");
}

checkoutBtn.addEventListener("click", openCheckout);
document.getElementById("checkout-close").addEventListener("click", closeCheckout);
checkoutBackdrop.addEventListener("click", closeCheckout);
document.getElementById("success-close").addEventListener("click", closeCheckout);
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeCheckout(); closeCart(); closeChatWidget(); } });

function renderReceipt() {
  const rows  = cartItems().map(({ product, qty }) => `<div class="receipt-row"><span>${product.name} × ${qty}</span><span>${formatPrice(product.price * qty)}</span></div>`).join("");
  const total = `<div class="receipt-row total"><span>Total</span><span>${formatPrice(cartSubtotal())}</span></div>`;
  document.getElementById("receipt-lines").innerHTML = rows + total;
}

/* ---------------------------------------------------------------------
   6) CHECKOUT + RAZORPAY
   Replace RAZORPAY_KEY_ID above with your live key to take real payments.
   --------------------------------------------------------------------- */
document.getElementById("checkout-form").addEventListener("submit", e => {
  e.preventDefault();
  payWithRazorpay(cartSubtotal(), document.getElementById("checkout-email").value);
});

function payWithRazorpay(amountRupees, email) {
  const isLive = RAZORPAY_KEY_ID !== "YOUR_RAZORPAY_KEY_ID" && typeof Razorpay !== "undefined";

  if (!isLive) {
    showToast("Demo mode — add your Razorpay key to take real payments");
    setTimeout(() => showSuccess({ demo: true, email }), 500);
    return;
  }

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: amountRupees * 100,
    currency: "INR",
    name: "Dossier",
    description: `${cartCount()} item(s)`,
    prefill: { email },
    theme: { color: "#E8A33D" },
    handler: res => showSuccess({ demo: false, email, paymentId: res.razorpay_payment_id }),
    modal: { ondismiss: () => showToast("Checkout closed — your cart is still here") },
  };

  const rzp = new Razorpay(options);
  rzp.on("payment.failed", () => showToast("Payment failed — please try again"));
  rzp.open();
}

function showSuccess({ demo, email, paymentId }) {
  document.getElementById("checkout-form-panel").hidden    = true;
  document.getElementById("checkout-success-panel").hidden = false;
  document.getElementById("success-copy").textContent = demo
    ? `No payment was taken (demo mode). Files would be sent to ${email}.`
    : `Payment ${paymentId} received. Files are on their way to ${email}.`;
  Object.keys(cart).forEach(id => (cart[id] = 0));
  PRODUCTS.forEach(p => refreshProductAction(p.id));
  renderCart();
}

/* ---------------------------------------------------------------------
   7) AI CHAT — powered by Groq (Llama 3.3 70B)
   --------------------------------------------------------------------- */
const SYSTEM_PROMPT = `You are a friendly, concise shopping assistant for Dossier — a digital goods store. Help customers find the right product, answer questions about pricing, downloads, licensing and refunds. Keep replies short (2–4 sentences unless more detail is needed). Never recommend products outside the catalog.

CATALOG:
• Atlas UI Kit (.FIGMA) — ₹1,499 — 120+ Figma auto-layout components for product designers and teams. Great for UI designers building apps or design systems.
• The Async Playbook (.PDF) — ₹399 — 64-page guide for running async-first remote teams without back-to-back meetings. Great for team leads and founders.
• Motion Foundations (.MP4) — ₹2,499 — 3 hours of video lessons on animation principles for interface designers. Great for designers who want to add motion to their work.
• Ledger Pro (.ZIP) — ₹799 — Freelancer spreadsheet system for tracking invoices and tax set-asides. Perfect for freelancers and solo consultants.
• Brandmark Pack (.AI) — ₹999 — 40 editable vector logo marks in Adobe Illustrator format plus a usage guide. For designers and small business owners needing instant brand assets.
• 1:1 Strategy Session (.CAL) — ₹3,999 — A 45-minute video call to review and improve product strategy, pricing, or market positioning. Ideal for founders and product leads.

POLICIES:
- Files are delivered instantly after payment via an on-screen download link + email.
- 14-day no-questions-asked refund policy (just send an email).
- Lifetime updates included for all file-based products.
- License covers personal and client work; resale of raw files is not allowed.
- Payments via Razorpay (supports UPI, cards, net banking).

If asked about something unrelated to Dossier, politely redirect.`;

// Chat conversation history (starts empty; system prompt is sent with every API call)
let chatHistory = [];

const chatWidget    = document.getElementById("chat-widget");
const chatFab       = document.getElementById("chat-fab");
const chatMessages  = document.getElementById("chat-messages");
const chatInput     = document.getElementById("chat-input");
const chatSendBtn   = document.getElementById("chat-send");
const chatSuggEl    = document.getElementById("chat-suggestions");

let chatOpened = false;

function openChatWidget() {
  chatWidget.classList.add("open");
  chatWidget.setAttribute("aria-hidden", "false");
  chatFab.classList.add("active");
  chatFab.setAttribute("aria-expanded", "true");
  chatFab.querySelector(".chat-fab-open").hidden = true;
  chatFab.querySelector(".chat-fab-close").hidden = false;

  // Show welcome message the first time only
  if (!chatOpened) {
    chatOpened = true;
    appendMsg("assistant", "Hi! I'm the Dossier AI. Tell me what you're trying to accomplish and I'll point you to the right product. 👋");
  }
  chatInput.focus();
}

function closeChatWidget() {
  chatWidget.classList.remove("open");
  chatWidget.setAttribute("aria-hidden", "true");
  chatFab.classList.remove("active");
  chatFab.setAttribute("aria-expanded", "false");
  chatFab.querySelector(".chat-fab-open").hidden = false;
  chatFab.querySelector(".chat-fab-close").hidden = true;
}

chatFab.addEventListener("click", () => {
  chatWidget.classList.contains("open") ? closeChatWidget() : openChatWidget();
});

document.getElementById("ai-banner-btn")?.addEventListener("click", openChatWidget);
document.getElementById("hero-ai-btn")?.addEventListener("click", openChatWidget);

// Suggestion chips
chatSuggEl.addEventListener("click", e => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const msg = chip.dataset.msg;
  chatSuggEl.classList.add("hidden"); // hide chips after first use
  sendChatMessage(msg);
});

// Clear chat
document.getElementById("chat-clear").addEventListener("click", () => {
  chatHistory = [];
  chatMessages.innerHTML = "";
  chatSuggEl.classList.remove("hidden");
  appendMsg("assistant", "Chat cleared! What can I help you find?");
});

// Input controls
chatInput.addEventListener("input", () => {
  chatSendBtn.disabled = chatInput.value.trim() === "";
});
chatInput.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey && chatInput.value.trim()) {
    e.preventDefault();
    sendChatMessage(chatInput.value.trim());
  }
});
chatSendBtn.addEventListener("click", () => {
  if (chatInput.value.trim()) sendChatMessage(chatInput.value.trim());
});

async function sendChatMessage(text) {
  chatInput.value = "";
  chatSendBtn.disabled = true;
  chatSuggEl.classList.add("hidden");

  appendMsg("user", text);
  chatHistory.push({ role: "user", content: text });

  const typingEl = appendTypingIndicator();

  try {
    const reply = await callGroq(chatHistory);
    typingEl.remove();
    appendMsg("assistant", reply);
    chatHistory.push({ role: "assistant", content: reply });
  } catch (err) {
    typingEl.remove();
    appendMsg("assistant", "Sorry, I had trouble reaching the AI right now. Please try again in a moment.");
    console.error("Groq API error:", err);
  }
}

async function callGroq(history) {
  const response = await fetch(GROQ_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 512,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history,
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

function appendMsg(role, text) {
  const isUser = role === "user";
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  wrap.innerHTML = `
    <div class="msg-avatar">${isUser ? ICONS.user : "✦"}</div>
    <div class="msg-bubble">${escapeHtml(text)}</div>`;
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function appendTypingIndicator() {
  const wrap = document.createElement("div");
  wrap.className = "msg assistant";
  wrap.innerHTML = `<div class="msg-avatar">✦</div><div class="typing-indicator"><span></span><span></span><span></span></div>`;
  chatMessages.appendChild(wrap);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return wrap;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

/* ---------------------------------------------------------------------
   8) MISC / INIT
   --------------------------------------------------------------------- */
const toastEl = document.getElementById("toast");
let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
}

const navToggle = document.getElementById("nav-toggle");
const mainNav   = document.getElementById("main-nav");
navToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(open));
});
mainNav.querySelectorAll("a").forEach(a =>
  a.addEventListener("click", () => { mainNav.classList.remove("open"); navToggle.setAttribute("aria-expanded","false"); })
);

document.getElementById("year").textContent = new Date().getFullYear();

renderProducts();
renderCart();
