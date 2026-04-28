const state = {
  slots: [],
  bookings: [],
  clients: [],
  currentClient: null,
  session: null,
  trainer: null,
  selectedSlotIds: [],
  filter: "all",
  view: "client",
  adminPin: sessionStorage.getItem("jamesAdminPin") || ""
};

const els = {
  tabs: document.querySelectorAll("[data-view]"),
  views: document.querySelectorAll(".view"),
  filters: document.querySelectorAll("[data-filter]"),
  clientWelcome: document.querySelector("#client-welcome"),
  exerciseList: document.querySelector("#exercise-list"),
  photoForm: document.querySelector("#photo-form"),
  photoList: document.querySelector("#photo-list"),
  slotList: document.querySelector("#slot-list"),
  adminList: document.querySelector("#admin-list"),
  selectedSession: document.querySelector("#selected-session"),
  bookingForm: document.querySelector("#booking-form"),
  profileForm: document.querySelector("#profile-form"),
  slotForm: document.querySelector("#slot-form"),
  clientForm: document.querySelector("#client-form"),
  clientList: document.querySelector("#client-list"),
  pinForm: document.querySelector("#pin-form"),
  adminLock: document.querySelector("#admin-lock"),
  coachDashboard: document.querySelector("#coach-dashboard"),
  lockButton: document.querySelector("#lock-button"),
  logoutButton: document.querySelector("#logout-button"),
  openCount: document.querySelector("#open-count"),
  bookedCount: document.querySelector("#booked-count"),
  nextSlot: document.querySelector("#next-slot"),
  toast: document.querySelector("#toast")
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short"
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric"
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function api(path, options = {}) {
  const { headers, ...fetchOptions } = options;
  const response = await fetch(path, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && (data.error === "Access code required." || data.error === "Client login required.")) {
      window.location.href = "/";
    }
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

function adminHeaders() {
  return {
    "x-admin-pin": state.adminPin
  };
}

async function adminApi(path, options = {}) {
  try {
    return await api(path, {
      ...options,
      headers: {
        ...adminHeaders(),
        ...(options.headers || {})
      }
    });
  } catch (error) {
    if (error.message === "Coach PIN required.") {
      lockCoachView();
    }
    throw error;
  }
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function bookingForSlot(slotId) {
  return state.bookings.find((booking) => booking.slotId === slotId);
}

function clientForBooking(booking) {
  if (!booking) return null;
  return state.clients.find((client) => client.id === booking.clientId) || null;
}

function clientProfileComplete() {
  return Boolean(state.currentClient?.name && state.currentClient?.email && state.currentClient?.phone);
}

function isOpen(slot) {
  return slot.status === "open" && slot.date >= todayKey();
}

function selectedSlots() {
  return state.selectedSlotIds
    .map((slotId) => state.slots.find((slot) => slot.id === slotId))
    .filter(Boolean)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function isSelected(slotId) {
  return state.selectedSlotIds.includes(slotId);
}

function timeBucket(time) {
  const hour = Number(time.slice(0, 2));
  if (hour < 11) return "morning";
  if (hour < 15) return "lunch";
  return "evening";
}

function availableSlots() {
  return state.slots
    .filter((slot) => slot.date >= todayKey())
    .filter((slot) => state.filter === "all" || timeBucket(slot.time) === state.filter)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2800);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(new Error("Could not read that image.")));
    reader.readAsDataURL(file);
  });
}

function renderStats() {
  const openSlots = state.slots.filter(isOpen);
  const booked = state.slots.filter((slot) => slot.status === "booked").length;
  const next = openSlots.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0];

  els.openCount.textContent = String(openSlots.length);
  els.bookedCount.textContent = String(booked);
  els.nextSlot.textContent = next ? `${formatDate(next.date)}, ${next.time}` : "-";
}

function renderSlots() {
  state.selectedSlotIds = state.selectedSlotIds.filter((slotId) => {
    const slot = state.slots.find((item) => item.id === slotId);
    return slot && isOpen(slot);
  });

  const slots = availableSlots();
  if (!slots.length) {
    els.slotList.innerHTML = '<div class="empty-state">No open sessions match this filter.</div>';
    return;
  }

  const groups = new Map();
  for (const slot of slots) {
    if (!groups.has(slot.date)) groups.set(slot.date, []);
    groups.get(slot.date).push(slot);
  }

  els.slotList.innerHTML = Array.from(groups.entries()).map(([date, daySlots]) => `
    <section class="day-group" aria-label="${escapeHtml(formatDate(date))}">
      <h2 class="day-heading">${escapeHtml(formatDate(date))}</h2>
      ${daySlots.map((slot) => {
        const booked = slot.status !== "open";
        const selected = isSelected(slot.id);
        return `
        <button class="slot-card ${booked ? "is-booked" : ""} ${selected ? "is-selected" : ""}" type="button" data-slot-id="${escapeHtml(slot.id)}" ${booked ? "disabled" : ""} aria-pressed="${selected ? "true" : "false"}">
          <span class="slot-main">
            <span class="time-block">
              <span class="time-icon" aria-hidden="true">↗</span>
              <span class="time-copy">
                <strong>${escapeHtml(slot.time)}</strong>
                <span>${escapeHtml(slot.type)}</span>
              </span>
            </span>
            <span class="pill ${booked ? "booked" : ""}">${booked ? "Booked" : `${escapeHtml(slot.duration)} min`}</span>
          </span>
          <span class="slot-meta">
            <span>${escapeHtml(slot.location)}</span>
            <span>${escapeHtml(timeBucket(slot.time))}</span>
          </span>
        </button>
      `;
      }).join("")}
    </section>
  `).join("");
}

function renderSelectedSession() {
  const slots = selectedSlots();
  if (!slots.length) {
    els.selectedSession.innerHTML = `
      <span class="badge">Selected sessions</span>
      <strong>No sessions selected</strong>
      <span class="muted">Awaiting selection.</span>
    `;
    return;
  }

  els.selectedSession.innerHTML = `
    <span class="badge">Selected sessions</span>
    <strong>${escapeHtml(slots.length)} ${slots.length === 1 ? "session" : "sessions"} selected</strong>
    <div class="selection-list">
      ${slots.map((slot) => `
        <span>${escapeHtml(formatDate(slot.date))} · ${escapeHtml(slot.time)} · ${escapeHtml(slot.type)}</span>
      `).join("")}
    </div>
  `;
}

function renderAdminList() {
  const upcomingSlots = state.slots
    .filter((slot) => slot.date >= todayKey())
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 40);

  if (!upcomingSlots.length) {
    els.adminList.innerHTML = '<div class="empty-state">No upcoming slots.</div>';
    return;
  }

  els.adminList.innerHTML = upcomingSlots.map((slot) => {
    const booking = bookingForSlot(slot.id);
    const client = clientForBooking(booking);
    const booked = slot.status === "booked" || Boolean(booking);
    const clientName = client?.name || booking?.clientName || booking?.name || "Client";
    const clientPhone = client?.phone || booking?.clientPhone || booking?.phone || "";
    const bookingFocus = booking?.focus || booking?.goals || "";
    const sessionNotes = booking?.sessionNotes || "";
    return `
      <article class="admin-item">
        <div class="admin-main">
          <div class="time-block">
            <span class="time-icon" aria-hidden="true">${booked ? "✓" : "+"}</span>
            <div class="time-copy">
              <strong>${escapeHtml(formatDate(slot.date))}, ${escapeHtml(slot.time)}</strong>
              <span>${escapeHtml(slot.type)} · ${escapeHtml(slot.duration)} min</span>
            </div>
          </div>
          <span class="pill ${booked ? "booked" : ""}">${booked ? "Booked" : "Open"}</span>
        </div>
        <div class="admin-meta">
          <span>${escapeHtml(slot.location)}</span>
          ${booking ? `
  <span>
    <strong>Booked by:</strong> ${escapeHtml(clientName)}${clientPhone ? " · " + escapeHtml(clientPhone) : ""}
  </span>
` : ""}
          ${bookingFocus ? '<span>' + escapeHtml(bookingFocus) + '</span>' : ''}
        </div>
        ${booking ? `
          <form class="session-note-form" data-session-note-form="${escapeHtml(booking.id)}">
            <label>
              Session notes
              <textarea name="sessionNotes" rows="3">${escapeHtml(sessionNotes)}</textarea>
            </label>
            <button class="ghost-button" type="submit">Save notes</button>
          </form>
        ` : ""}
        <div class="admin-actions">
          ${booking ? `<button class="ghost-button" type="button" data-cancel-booking="${escapeHtml(booking.id)}">Cancel booking</button>` : ""}
          <button class="danger-button" type="button" data-delete-slot="${escapeHtml(slot.id)}">Remove slot</button>
        </div>
      </article>
    `;
  }).join("");
}

function renderProfileForm() {
  if (!state.currentClient) return;

  els.profileForm.elements.name.value = state.currentClient.name || "";
  els.profileForm.elements.email.value = state.currentClient.email || "";
  els.profileForm.elements.phone.value = state.currentClient.phone || "";
  els.profileForm.elements.goals.value = state.currentClient.goals || "";
}

function renderClientList() {
  if (!state.clients.length) {
    els.clientList.innerHTML = '<div class="empty-state">No client logins issued yet.</div>';
    return;
  }

  els.clientList.innerHTML = state.clients.map((client) => `
    <article class="client-item client-card">
      <div class="client-card-head">
        <div>
          <strong>${escapeHtml(client.name || "New client")}</strong>
          <span>${escapeHtml(client.email || "Details not completed")}</span>
        </div>
        <span class="code-chip">${escapeHtml(client.accessCode)}</span>
      </div>

      <div class="client-card-grid">
        <section>
          <h3>Home exercises</h3>
          <div class="mini-list">
            ${(client.exercises || []).length ? (client.exercises || []).map((exercise) => `
              <div class="mini-item">
                <strong>${escapeHtml(exercise.title)}</strong>
                ${exercise.frequency ? `<span>${escapeHtml(exercise.frequency)}</span>` : ""}
                <p>${escapeHtml(exercise.instructions)}</p>
                <button class="danger-button compact-button" type="button" data-client-id="${escapeHtml(client.id)}" data-delete-exercise="${escapeHtml(exercise.id)}">Remove</button>
              </div>
            `).join("") : '<span class="muted">No exercises assigned.</span>'}
          </div>
        </section>

        <section>
          <h3>Progress photos</h3>
          <div class="admin-photo-grid">
            ${(client.progressPhotos || []).length ? (client.progressPhotos || []).slice(0, 6).map((photo) => `
              <figure>
                <img src="${escapeHtml(photo.imageData)}" alt="Progress photo for ${escapeHtml(client.name || "client")}">
                <figcaption>${escapeHtml(photo.note || dateTimeFormatter.format(new Date(photo.createdAt)))}</figcaption>
              </figure>
            `).join("") : '<span class="muted">No photos uploaded.</span>'}
          </div>
        </section>
      </div>

      <form class="exercise-form" data-exercise-form="${escapeHtml(client.id)}">
        <label>
          Exercise
          <input name="title" autocomplete="off" required>
        </label>
        <label>
          Frequency
          <input name="frequency" autocomplete="off" placeholder="e.g. 3 times this week">
        </label>
        <label class="wide-field">
          Instructions
          <textarea name="instructions" rows="3" required></textarea>
        </label>
        <button class="primary-button" type="submit">Add exercise</button>
      </form>
    </article>
  `).join("");
}

function renderClientWelcome() {
  const name = state.currentClient?.name || "";
  els.clientWelcome.innerHTML = `
    <p class="eyebrow">Client portal</p>
    <h1>Welcome${name ? `, ${escapeHtml(name)}` : ""}</h1>
    <span class="muted">Your bookings, home training and progress are all in one place.</span>
  `;
}

function renderExerciseList() {
  const exercises = state.currentClient?.exercises || [];
  if (!exercises.length) {
    els.exerciseList.innerHTML = '<div class="empty-state compact-empty">No home exercises assigned yet.</div>';
    return;
  }

  els.exerciseList.innerHTML = exercises.map((exercise) => `
    <article class="exercise-item">
      <div>
        <strong>${escapeHtml(exercise.title)}</strong>
        ${exercise.frequency ? `<span>${escapeHtml(exercise.frequency)}</span>` : ""}
      </div>
      <p>${escapeHtml(exercise.instructions)}</p>
    </article>
  `).join("");
}

function renderPhotoList() {
  const photos = state.currentClient?.progressPhotos || [];
  if (!photos.length) {
    els.photoList.innerHTML = '<div class="empty-state compact-empty">No progress photos uploaded yet.</div>';
    return;
  }

  els.photoList.innerHTML = photos.map((photo) => `
    <article class="photo-item">
      <img src="${escapeHtml(photo.imageData)}" alt="Progress upload from ${escapeHtml(dateTimeFormatter.format(new Date(photo.createdAt)))}">
      <div>
        <strong>${escapeHtml(dateTimeFormatter.format(new Date(photo.createdAt)))}</strong>
        ${photo.note ? `<span>${escapeHtml(photo.note)}</span>` : ""}
      </div>
      <button class="danger-button compact-button" type="button" data-delete-photo="${escapeHtml(photo.id)}">Remove</button>
    </article>
  `).join("");
}

function render() {
  renderStats();
  renderClientWelcome();
  renderExerciseList();
  renderPhotoList();
  renderSlots();
  renderSelectedSession();
  renderAdminList();
  renderProfileForm();
  renderClientList();
  renderCoachAccess();
}

function renderCoachAccess() {
  const unlocked = Boolean(state.adminPin);
  els.adminLock.classList.toggle("is-hidden", unlocked);
  els.coachDashboard.classList.toggle("is-hidden", !unlocked);
}

async function loadState() {
  const data = await api("/api/state", {
    headers: state.adminPin ? adminHeaders() : {}
  });
  state.slots = data.slots || [];
  state.bookings = data.bookings || [];
  state.clients = data.clients || [];
  state.currentClient = data.currentClient || null;
  state.session = data.session || null;
  state.trainer = data.trainer || null;
  state.selectedSlotIds = state.selectedSlotIds.filter((slotId) => {
    const slot = state.slots.find((item) => item.id === slotId);
    return slot && isOpen(slot);
  });
  if (state.session?.role === "admin" && state.adminPin) {
    setView("coach");
  }
  render();
}

function setDefaultSlotDate() {
  const dateInput = els.slotForm.elements.date;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  dateInput.value = `${year}-${month}-${day}`;
  els.slotForm.elements.time.value = "17:30";
}

function lockCoachView() {
  state.adminPin = "";
  state.bookings = [];
  sessionStorage.removeItem("jamesAdminPin");
  render();
}

function setView(viewName) {
  state.view = viewName;
  els.tabs.forEach((item) => item.classList.toggle("is-active", item.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("is-active", view.id === `${viewName}-view`));
}

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setView(tab.dataset.view);
  });
});

els.filters.forEach((filter) => {
  filter.addEventListener("click", () => {
    state.filter = filter.dataset.filter;
    els.filters.forEach((item) => item.classList.toggle("is-active", item === filter));
    renderSlots();
  });
});

els.slotList.addEventListener("click", (event) => {
  const card = event.target.closest("[data-slot-id]");
  if (!card) return;
  const slot = state.slots.find((item) => item.id === card.dataset.slotId);
  if (!slot || !isOpen(slot)) return;
  if (isSelected(slot.id)) {
    state.selectedSlotIds = state.selectedSlotIds.filter((slotId) => slotId !== slot.id);
  } else {
    state.selectedSlotIds = [...state.selectedSlotIds, slot.id];
  }
  renderSlots();
  renderSelectedSession();
});

els.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(els.profileForm).entries());

  try {
    const data = await api("/api/client/profile", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.currentClient = data.client;
    renderProfileForm();
    showToast("Details saved.");
  } catch (error) {
    showToast(error.message);
  }
});

els.photoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = els.photoForm.elements.photo.files[0];
  if (!file) {
    showToast("Choose a photo first.");
    return;
  }

  if (file.size > 4_000_000) {
    showToast("Choose an image under about 4 MB.");
    return;
  }

  try {
    const imageData = await readFileAsDataUrl(file);
    const note = String(new FormData(els.photoForm).get("note") || "").trim();
    const data = await api("/api/client/progress-photos", {
      method: "POST",
      body: JSON.stringify({ imageData, note })
    });
    state.currentClient = data.client;
    els.photoForm.reset();
    renderPhotoList();
    showToast("Progress photo uploaded.");
  } catch (error) {
    showToast(error.message);
  }
});

els.photoList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-photo]");
  if (!button) return;

  try {
    const data = await api(`/api/client/progress-photos/${encodeURIComponent(button.dataset.deletePhoto)}`, {
      method: "DELETE"
    });
    state.currentClient = data.client;
    renderPhotoList();
    showToast("Progress photo removed.");
  } catch (error) {
    showToast(error.message);
  }
});

els.bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!state.selectedSlotIds.length) {
    showToast("Select at least one session.");
    return;
  }

  if (!clientProfileComplete()) {
    showToast("Save your details first.");
    return;
  }

  const formData = new FormData(els.bookingForm);
  const payload = Object.fromEntries(formData.entries());
  payload.slotIds = state.selectedSlotIds;

  try {
    const data = await api("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    els.bookingForm.reset();
    state.selectedSlotIds = [];
    await loadState();
    showToast(`${data.bookings.length} ${data.bookings.length === 1 ? "session" : "sessions"} booked.`);
  } catch (error) {
    showToast(error.message);
  }
});

els.slotForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(els.slotForm).entries());

  try {
    await adminApi("/api/slots", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    els.slotForm.elements.time.value = payload.time;
    await loadState();
    showToast("Slot added.");
  } catch (error) {
    showToast(error.message);
  }
});

els.clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(els.clientForm).entries());

  try {
    const data = await adminApi("/api/clients", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    els.clientForm.reset();
    await loadState();
    showToast(`Client code created: ${data.client.accessCode}`);
  } catch (error) {
    showToast(error.message);
  }
});

els.clientList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-exercise-form]");
  if (!form) return;
  event.preventDefault();

  const clientId = form.dataset.exerciseForm;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    await adminApi(`/api/clients/${encodeURIComponent(clientId)}/exercises`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    form.reset();
    await loadState();
    showToast("Exercise added.");
  } catch (error) {
    showToast(error.message);
  }
});

els.clientList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-exercise]");
  if (!button) return;

  try {
    await adminApi(`/api/clients/${encodeURIComponent(button.dataset.clientId)}/exercises/${encodeURIComponent(button.dataset.deleteExercise)}`, {
      method: "DELETE"
    });
    await loadState();
    showToast("Exercise removed.");
  } catch (error) {
    showToast(error.message);
  }
});

els.pinForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pin = String(new FormData(els.pinForm).get("pin") || "").trim();
  if (!pin) return;

  state.adminPin = pin;
  try {
    await adminApi("/api/admin/check", {
      method: "POST"
    });
    sessionStorage.setItem("jamesAdminPin", pin);
    els.pinForm.reset();
    await loadState();
    showToast("Coach view unlocked.");
  } catch (error) {
    lockCoachView();
    showToast(error.message);
  }
});

els.lockButton.addEventListener("click", () => {
  lockCoachView();
  showToast("Coach view locked.");
});

els.logoutButton.addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", {
      method: "POST"
    });
  } finally {
    sessionStorage.removeItem("jamesAdminPin");
    window.location.href = "/";
  }
});

els.adminList.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-session-note-form]");
  if (!form) return;
  event.preventDefault();

  const bookingId = form.dataset.sessionNoteForm;
  const sessionNotes = String(new FormData(form).get("sessionNotes") || "").trim();

  try {
    await adminApi(`/api/bookings/${encodeURIComponent(bookingId)}/notes`, {
      method: "POST",
      body: JSON.stringify({ sessionNotes })
    });
    await loadState();
    showToast("Session notes saved.");
  } catch (error) {
    showToast(error.message);
  }
});

els.adminList.addEventListener("click", async (event) => {
  const cancelButton = event.target.closest("[data-cancel-booking]");
  const deleteButton = event.target.closest("[data-delete-slot]");

  try {
    if (cancelButton) {
      await adminApi(`/api/bookings/${encodeURIComponent(cancelButton.dataset.cancelBooking)}`, {
        method: "DELETE"
      });
      await loadState();
      showToast("Booking cancelled.");
    }

    if (deleteButton) {
      await adminApi(`/api/slots/${encodeURIComponent(deleteButton.dataset.deleteSlot)}`, {
        method: "DELETE"
      });
      state.selectedSlotIds = state.selectedSlotIds.filter((slotId) => slotId !== deleteButton.dataset.deleteSlot);
      await loadState();
      showToast("Slot removed.");
    }
  } catch (error) {
    showToast(error.message);
  }
});

async function init() {
  setDefaultSlotDate();

  if (state.adminPin) {
    try {
      await adminApi("/api/admin/check", {
        method: "POST"
      });
    } catch {
      state.adminPin = "";
      sessionStorage.removeItem("jamesAdminPin");
    }
  }

  await loadState();
}

init().catch((error) => showToast(error.message));
