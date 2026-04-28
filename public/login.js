const clientForm = document.querySelector("#client-login-form");
const adminForm = document.querySelector("#admin-login-form");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2800);
}

clientForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const accessCode = String(new FormData(clientForm).get("accessCode") || "").trim();

  try {
    const response = await fetch("/api/auth/client-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ accessCode })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not sign in.");
    }

    sessionStorage.removeItem("jamesAdminPin");
    window.location.href = "/app";
  } catch (error) {
    showToast(error.message);
  }
});

adminForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const pin = String(new FormData(adminForm).get("pin") || "").trim();

  try {
    const response = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ pin })
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Could not sign in.");
    }

    sessionStorage.setItem("jamesAdminPin", pin);
    window.location.href = "/app";
  } catch (error) {
    showToast(error.message);
  }
});
