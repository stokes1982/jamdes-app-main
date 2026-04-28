const http = require("node:http");
const path = require("node:path");
const crypto = require("node:crypto");
const { promises: fs } = require("node:fs");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const ADMIN_PIN = process.env.ADMIN_PIN || "james";
const SESSION_SECRET = process.env.SESSION_SECRET
  || crypto.createHash("sha256").update(`${ADMIN_PIN}:james-pt-booking`).digest("hex");
const SESSION_COOKIE = "james_pt_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;
const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const DATA_DIR = path.join(ROOT_DIR, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const trainer = {
  name: "James",
  businessName: "James PT",
  location: "Private studio",
  email: "james@example.com",
  phone: "07123 456789"
};

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8"
};

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildSeedStore() {
  const slots = [];
  const bookings = [];
  const sampleClientId = crypto.randomUUID();
  const clients = [{
    id: sampleClientId,
    accessCode: "MAYA-2841",
    name: "Maya Collins",
    email: "maya@example.com",
    phone: "07000 111222",
    goals: "Lower body strength and confidence with barbell work.",
    exercises: [{
      id: crypto.randomUUID(),
      title: "Goblet squat",
      instructions: "3 sets of 10 reps at a steady tempo. Rest for 60 seconds between sets.",
      frequency: "Twice this week",
      createdAt: new Date().toISOString()
    }],
    progressPhotos: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: null
  }];
  const sessionByHour = {
    "06:30": "Strength",
    "07:45": "Conditioning",
    "12:15": "Mobility",
    "17:30": "Strength",
    "18:45": "Conditioning",
    "09:00": "Strength",
    "10:15": "Mobility"
  };

  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);

  for (let dayOffset = 0; dayOffset < 18; dayOffset += 1) {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + dayOffset);
    const dayNumber = day.getDay();
    const date = localDateKey(day);

    let times = [];
    if (dayNumber >= 1 && dayNumber <= 5) {
      times = ["06:30", "12:15", "17:30", "18:45"];
    } else if (dayNumber === 6) {
      times = ["09:00", "10:15"];
    }

    for (const time of times) {
      slots.push({
        id: crypto.randomUUID(),
        date,
        time,
        duration: 60,
        type: sessionByHour[time] || "Personal training",
        location: trainer.location,
        status: "open"
      });
    }
  }

  const sampleSlot = slots.find((slot) => slot.date >= localDateKey(new Date()));
  if (sampleSlot) {
    sampleSlot.status = "booked";
    bookings.push({
      id: crypto.randomUUID(),
      slotId: sampleSlot.id,
      clientId: sampleClientId,
      name: "Maya Collins",
      email: "maya@example.com",
      phone: "07000 111222",
      goals: "Lower body strength and confidence with barbell work.",
      focus: "",
      sessionNotes: "",
      createdAt: new Date().toISOString()
    });
  }

  return {
    trainer,
    clients,
    slots,
    bookings
  };
}

function generateClientCode() {
  const number = String(crypto.randomInt(100000, 999999));
  return `JP-${number}`;
}

function profileComplete(client) {
  return Boolean(client?.name && client?.email && client?.phone);
}

function sanitizeClient(client, includeCode = false) {
  if (!client) return null;
  return {
    id: client.id,
    ...(includeCode ? { accessCode: client.accessCode } : {}),
    name: client.name || "",
    email: client.email || "",
    phone: client.phone || "",
    goals: client.goals || "",
    exercises: Array.isArray(client.exercises) ? client.exercises : [],
    progressPhotos: Array.isArray(client.progressPhotos) ? client.progressPhotos : [],
    profileComplete: profileComplete(client),
    createdAt: client.createdAt || null,
    lastLoginAt: client.lastLoginAt || null
  };
}

function migrateStore(store) {
  let changed = false;

  store.trainer ||= trainer;
  store.clients ||= [];
  store.slots ||= [];
  store.bookings ||= [];

  if (!Array.isArray(store.clients)) {
    store.clients = [];
    changed = true;
  }

  for (const booking of store.bookings) {
    if (booking.clientId) continue;

    let client = store.clients.find((item) => {
      const sameEmail = booking.email && item.email && item.email.toLowerCase() === booking.email.toLowerCase();
      const sameName = booking.name && item.name && item.name.toLowerCase() === booking.name.toLowerCase();
      return sameEmail || sameName;
    });

    if (!client) {
      client = {
        id: crypto.randomUUID(),
        accessCode: generateClientCode(),
        name: booking.name || "",
        email: booking.email || "",
        phone: booking.phone || "",
        goals: booking.goals || "",
        exercises: [],
        progressPhotos: [],
        createdAt: booking.createdAt || new Date().toISOString(),
        lastLoginAt: null
      };
      store.clients.push(client);
    }

    booking.clientId = client.id;
    booking.focus ||= "";
    booking.sessionNotes ||= "";
    changed = true;
  }

  for (const client of store.clients) {
    client.id ||= crypto.randomUUID();
    client.accessCode ||= generateClientCode();
    client.name ||= "";
    client.email ||= "";
    client.phone ||= "";
    client.goals ||= "";
    if (!Array.isArray(client.exercises)) {
      client.exercises = [];
      changed = true;
    }
    if (!Array.isArray(client.progressPhotos)) {
      client.progressPhotos = [];
      changed = true;
    }
    client.createdAt ||= new Date().toISOString();
    client.lastLoginAt ||= null;
  }

  for (const booking of store.bookings) {
    if (booking.focus === undefined) {
      booking.focus = "";
      changed = true;
    }
    if (booking.sessionNotes === undefined) {
      booking.sessionNotes = "";
      changed = true;
    }
  }

  return changed;
}

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await saveStore(buildSeedStore());
  }
}

async function loadStore() {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const store = JSON.parse(raw);
  if (migrateStore(store)) {
    await saveStore(store);
  }
  return store;
}

async function saveStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmpFile, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  await fs.rename(tmpFile, DATA_FILE);
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function safeCompare(value, expected) {
  const supplied = Buffer.from(String(value || ""));
  const target = Buffer.from(String(expected || ""));

  return supplied.length === target.length
    && crypto.timingSafeEqual(supplied, target);
}

function parseCookies(req) {
  return String(req.headers.cookie || "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce((cookies, cookie) => {
      const separatorIndex = cookie.indexOf("=");
      if (separatorIndex === -1) {
        return cookies;
      }
      const name = decodeURIComponent(cookie.slice(0, separatorIndex));
      const value = decodeURIComponent(cookie.slice(separatorIndex + 1));
      cookies[name] = value;
      return cookies;
    }, {});
}

function signSession(payload) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function createSessionToken(sessionData = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    ...sessionData,
    issuedAt: now,
    expiresAt: now + SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID()
  })).toString("base64url");
  return `${payload}.${signSession(payload)}`;
}

function sessionCookie(token) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`
  ].join("; ");
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

function getSession(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) {
    return null;
  }

  const [payload, signature] = String(token).split(".");
  if (!payload || !signature || !safeCompare(signature, signSession(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (Number(session.expiresAt) <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function hasAppAccess(req) {
  return Boolean(getSession(req));
}

function requireAppAccess(req, res) {
  if (hasAppAccess(req)) {
    return true;
  }
  sendError(res, 401, "Access code required.");
  return false;
}

function requireClient(req, res) {
  const session = getSession(req);
  if (session?.role === "client" && session.clientId) {
    return session;
  }
  sendError(res, 401, "Client login required.");
  return null;
}

function hasAdminAccess(req) {
  const suppliedPin = String(req.headers["x-admin-pin"] || "");
  return safeCompare(suppliedPin, ADMIN_PIN);
}

function requireAdmin(req, res) {
  if (hasAdminAccess(req)) {
    return true;
  }
  sendError(res, 401, "Coach PIN required.");
  return false;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 8_000_000) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function sortSlots(slots) {
  return slots.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function isAllowedImageData(value) {
  return /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i.test(String(value || ""));
}

async function handleApi(req, res, pathname) {
  if (req.method === "POST" && (pathname === "/api/auth/client-login" || pathname === "/api/auth/login")) {
    const payload = await readBody(req);
    const accessCode = normalizeText(payload.accessCode).toUpperCase();
    const store = await loadStore();
    const client = store.clients.find((item) => safeCompare(String(item.accessCode).toUpperCase(), accessCode));

    if (!client) {
      sendError(res, 401, "Incorrect access code.");
      return;
    }

    client.lastLoginAt = new Date().toISOString();
    await saveStore(store);

    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": sessionCookie(createSessionToken({
        role: "client",
        clientId: client.id
      }))
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/admin-login") {
    const payload = await readBody(req);
    const pin = normalizeText(payload.pin);

    if (!safeCompare(pin, ADMIN_PIN)) {
      sendError(res, 401, "Incorrect coach PIN.");
      return;
    }

    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": sessionCookie(createSessionToken({
        role: "admin"
      }))
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    sendJson(res, 200, { ok: true }, {
      "Set-Cookie": clearSessionCookie()
    });
    return;
  }

  if (!requireAppAccess(req, res)) return;

  if (req.method === "POST" && pathname === "/api/admin/check") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/state") {
    const session = getSession(req);
    const isCoach = session?.role === "admin" && hasAdminAccess(req);
    const store = await loadStore();
    const currentClient = session?.role === "client"
      ? store.clients.find((client) => client.id === session.clientId)
      : null;
    sortSlots(store.slots);
    sendJson(res, 200, {
      trainer: store.trainer,
      slots: store.slots,
      session: {
        role: session?.role || "client"
      },
      currentClient: sanitizeClient(currentClient),
      clients: isCoach ? store.clients.map((client) => sanitizeClient(client, true)) : [],
      bookings: isCoach ? store.bookings : []
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/client/profile") {
    const session = requireClient(req, res);
    if (!session) return;

    const payload = await readBody(req);
    const store = await loadStore();
    const client = store.clients.find((item) => item.id === session.clientId);

    if (!client) {
      sendError(res, 404, "Client account not found.");
      return;
    }

    const name = normalizeText(payload.name);
    const email = normalizeText(payload.email).toLowerCase();
    const phone = normalizeText(payload.phone);
    const goals = normalizeText(payload.goals);

    if (!name || !email || !phone) {
      sendError(res, 400, "Name, email and phone are required.");
      return;
    }

    if (!email.includes("@")) {
      sendError(res, 400, "Please enter a valid email address.");
      return;
    }

    client.name = name;
    client.email = email;
    client.phone = phone;
    client.goals = goals;
    await saveStore(store);
    sendJson(res, 200, { client: sanitizeClient(client) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/client/progress-photos") {
    const session = requireClient(req, res);
    if (!session) return;

    const payload = await readBody(req);
    const imageData = normalizeText(payload.imageData);
    const note = normalizeText(payload.note);

    if (!isAllowedImageData(imageData)) {
      sendError(res, 400, "Please upload a PNG, JPG or WebP image.");
      return;
    }

    if (imageData.length > 5_500_000) {
      sendError(res, 400, "Please choose an image under about 4 MB.");
      return;
    }

    const store = await loadStore();
    const client = store.clients.find((item) => item.id === session.clientId);
    if (!client) {
      sendError(res, 404, "Client account not found.");
      return;
    }

    client.progressPhotos ||= [];
    if (client.progressPhotos.length >= 30) {
      sendError(res, 400, "Progress photo limit reached.");
      return;
    }

    const photo = {
      id: crypto.randomUUID(),
      imageData,
      note,
      createdAt: new Date().toISOString()
    };

    client.progressPhotos.unshift(photo);
    await saveStore(store);
    sendJson(res, 201, { photo, client: sanitizeClient(client) });
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/client/progress-photos/")) {
    const session = requireClient(req, res);
    if (!session) return;

    const photoId = decodeURIComponent(pathname.replace("/api/client/progress-photos/", ""));
    const store = await loadStore();
    const client = store.clients.find((item) => item.id === session.clientId);
    if (!client) {
      sendError(res, 404, "Client account not found.");
      return;
    }

    client.progressPhotos = (client.progressPhotos || []).filter((photo) => photo.id !== photoId);
    await saveStore(store);
    sendJson(res, 200, { ok: true, client: sanitizeClient(client) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/bookings") {
    const session = requireClient(req, res);
    if (!session) return;

    const payload = await readBody(req);
    const store = await loadStore();
    const client = store.clients.find((item) => item.id === session.clientId);
    const requestedSlotIds = Array.isArray(payload.slotIds)
      ? payload.slotIds
      : [payload.slotId];
    const slotIds = [...new Set(requestedSlotIds.map(normalizeText).filter(Boolean))];
    const slots = slotIds.map((slotId) => store.slots.find((item) => item.id === slotId));

    if (!client) {
      sendError(res, 404, "Client account not found.");
      return;
    }

    if (!profileComplete(client)) {
      sendError(res, 400, "Complete your details before booking.");
      return;
    }

    if (!slotIds.length) {
      sendError(res, 400, "Select at least one session.");
      return;
    }

    if (slotIds.length > 20) {
      sendError(res, 400, "You can book up to 20 sessions at once.");
      return;
    }

    if (slots.some((slot) => !slot)) {
      sendError(res, 404, "One or more sessions are no longer available.");
      return;
    }

    const unavailableSlot = slots.find((slot) => (
      slot.status !== "open" || store.bookings.some((booking) => booking.slotId === slot.id)
    ));

    if (unavailableSlot) {
      sendError(res, 409, "One or more selected sessions have already been booked.");
      return;
    }

    const createdAt = new Date().toISOString();
    const focus = normalizeText(payload.focus || payload.goals);
    const bookings = slots.map((slot) => ({
      id: crypto.randomUUID(),
      slotId: slot.id,
      clientId: client.id,
      clientName: client.name,
      clientEmail: client.email,
      clientPhone: client.phone,
      goals: client.goals,
      focus,
      createdAt
    }));

    for (const slot of slots) {
      slot.status = "booked";
    }
    store.bookings.push(...bookings);
    await saveStore(store);
    sendJson(res, 201, {
      bookings,
      booking: bookings[0],
      slots
    });
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/bookings/") && pathname.endsWith("/notes")) {
    if (!requireAdmin(req, res)) return;

    const bookingId = decodeURIComponent(pathname.replace("/api/bookings/", "").replace("/notes", ""));
    const payload = await readBody(req);
    const store = await loadStore();
    const booking = store.bookings.find((item) => item.id === bookingId);

    if (!booking) {
      sendError(res, 404, "Booking not found.");
      return;
    }

    booking.sessionNotes = normalizeText(payload.sessionNotes);
    await saveStore(store);
    sendJson(res, 200, { booking });
    return;
  }

  if (req.method === "POST" && pathname === "/api/clients") {
    if (!requireAdmin(req, res)) return;

    const payload = await readBody(req);
    const store = await loadStore();
    let accessCode = normalizeText(payload.accessCode).toUpperCase();

    if (!accessCode) {
      do {
        accessCode = generateClientCode();
      } while (store.clients.some((client) => safeCompare(String(client.accessCode).toUpperCase(), accessCode)));
    }

    if (store.clients.some((client) => safeCompare(String(client.accessCode).toUpperCase(), accessCode))) {
      sendError(res, 409, "That access code is already in use.");
      return;
    }

    const client = {
      id: crypto.randomUUID(),
      accessCode,
      name: normalizeText(payload.name),
      email: normalizeText(payload.email).toLowerCase(),
      phone: normalizeText(payload.phone),
      goals: normalizeText(payload.goals),
      exercises: [],
      progressPhotos: [],
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };

    store.clients.push(client);
    await saveStore(store);
    sendJson(res, 201, { client: sanitizeClient(client, true) });
    return;
  }

  if (req.method === "POST" && pathname.startsWith("/api/clients/") && pathname.endsWith("/exercises")) {
    if (!requireAdmin(req, res)) return;

    const clientId = decodeURIComponent(pathname.replace("/api/clients/", "").replace("/exercises", ""));
    const payload = await readBody(req);
    const title = normalizeText(payload.title);
    const instructions = normalizeText(payload.instructions);
    const frequency = normalizeText(payload.frequency);

    if (!title || !instructions) {
      sendError(res, 400, "Exercise name and instructions are required.");
      return;
    }

    const store = await loadStore();
    const client = store.clients.find((item) => item.id === clientId);
    if (!client) {
      sendError(res, 404, "Client not found.");
      return;
    }

    const exercise = {
      id: crypto.randomUUID(),
      title,
      instructions,
      frequency,
      createdAt: new Date().toISOString()
    };

    client.exercises ||= [];
    client.exercises.unshift(exercise);
    await saveStore(store);
    sendJson(res, 201, { exercise, client: sanitizeClient(client, true) });
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/clients/") && pathname.includes("/exercises/")) {
    if (!requireAdmin(req, res)) return;

    const [, clientIdRaw, exerciseIdRaw] = pathname.match(/^\/api\/clients\/([^/]+)\/exercises\/([^/]+)$/) || [];
    if (!clientIdRaw || !exerciseIdRaw) {
      sendError(res, 404, "Route not found.");
      return;
    }

    const clientId = decodeURIComponent(clientIdRaw);
    const exerciseId = decodeURIComponent(exerciseIdRaw);
    const store = await loadStore();
    const client = store.clients.find((item) => item.id === clientId);
    if (!client) {
      sendError(res, 404, "Client not found.");
      return;
    }

    client.exercises = (client.exercises || []).filter((exercise) => exercise.id !== exerciseId);
    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/bookings/")) {
    if (!requireAdmin(req, res)) return;

    const bookingId = decodeURIComponent(pathname.replace("/api/bookings/", ""));
    const store = await loadStore();
    const booking = store.bookings.find((item) => item.id === bookingId);

    if (!booking) {
      sendError(res, 404, "Booking not found.");
      return;
    }

    store.bookings = store.bookings.filter((item) => item.id !== bookingId);
    const slot = store.slots.find((item) => item.id === booking.slotId);
    if (slot) {
      slot.status = "open";
    }

    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && pathname === "/api/slots") {
    if (!requireAdmin(req, res)) return;

    const payload = await readBody(req);
    const date = normalizeText(payload.date);
    const time = normalizeText(payload.time);
    const duration = Number(payload.duration || 60);
    const type = normalizeText(payload.type) || "Personal training";
    const location = normalizeText(payload.location) || trainer.location;

    if (!isValidDate(date) || !isValidTime(time)) {
      sendError(res, 400, "Please add a valid date and time.");
      return;
    }

    if (!Number.isInteger(duration) || duration < 30 || duration > 180) {
      sendError(res, 400, "Duration must be between 30 and 180 minutes.");
      return;
    }

    const store = await loadStore();
    const duplicate = store.slots.some((slot) => slot.date === date && slot.time === time);
    if (duplicate) {
      sendError(res, 409, "A session already exists at that time.");
      return;
    }

    const slot = {
      id: crypto.randomUUID(),
      date,
      time,
      duration,
      type,
      location,
      status: "open"
    };

    store.slots.push(slot);
    sortSlots(store.slots);
    await saveStore(store);
    sendJson(res, 201, { slot });
    return;
  }

  if (req.method === "DELETE" && pathname.startsWith("/api/slots/")) {
    if (!requireAdmin(req, res)) return;

    const slotId = decodeURIComponent(pathname.replace("/api/slots/", ""));
    const store = await loadStore();
    const slot = store.slots.find((item) => item.id === slotId);

    if (!slot) {
      sendError(res, 404, "Session not found.");
      return;
    }

    store.slots = store.slots.filter((item) => item.id !== slotId);
    store.bookings = store.bookings.filter((booking) => booking.slotId !== slotId);
    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendError(res, 404, "Route not found.");
}

async function serveStatic(req, res, pathname) {
  let requestPath = pathname === "/" ? "/index.html" : pathname;

  if (requestPath === "/app") {
    requestPath = "/index.html";
  }

  if (requestPath === "/index.html" && !hasAppAccess(req)) {
    requestPath = "/login.html";
  }

  const safePath = path.normalize(decodeURIComponent(requestPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url.pathname);
      return;
    }
    await serveStatic(req, res, url.pathname);
  } catch (error) {
    sendError(res, 500, error.message || "Something went wrong.");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Try PORT=3001 npm start.`);
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log(`James PT booking app running at http://${HOST}:${PORT}`);
});
