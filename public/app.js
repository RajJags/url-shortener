const form = document.getElementById("create-form");
const formMessage = document.getElementById("form-message");
const urlList = document.getElementById("url-list");
const serviceMeta = document.getElementById("service-meta");
const refreshButton = document.getElementById("refresh-button");
const submitButton = document.getElementById("submit-button");
const template = document.getElementById("url-item-template");

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Request failed.");
  }

  return payload;
}

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

function setMessage(message, tone = "muted") {
  formMessage.textContent = message;
  formMessage.style.color = tone === "error" ? "#ff8b7a" : tone === "success" ? "#83e0d7" : "#9fb0c2";
}

function buildMetaLine(item) {
  const clicks = `${item.clicks} click${item.clicks === 1 ? "" : "s"}`;
  const updated = `Updated ${formatDate(item.updatedAt)}`;
  const expiry = item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : "No expiration";
  return `${clicks} • ${updated} • ${expiry}`;
}

async function loadMeta() {
  const meta = await fetchJson("/api");
  serviceMeta.innerHTML = `
    <strong>Status:</strong> ${meta.status}<br />
    <strong>Storage:</strong> ${meta.storage}<br />
    <strong>Cache:</strong> ${meta.cache.mode}
  `;
}

async function copyLink(value) {
  await navigator.clipboard.writeText(value);
  setMessage("Short link copied to clipboard.", "success");
}

async function deleteLink(code) {
  const response = await fetch(`/api/urls/${encodeURIComponent(code)}`, { method: "DELETE" });

  if (!response.ok) {
    throw new Error("Unable to delete this short URL.");
  }

  await loadUrls();
  setMessage("Short URL deleted.", "success");
}

function renderUrls(items) {
  urlList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No short URLs yet. Create one above to get started.";
    urlList.appendChild(empty);
    return;
  }

  for (const item of items) {
    const fragment = template.content.cloneNode(true);
    const shortLink = fragment.querySelector(".short-link");
    const originalLink = fragment.querySelector(".original-link");
    const metaLine = fragment.querySelector(".meta-line");
    const copyButton = fragment.querySelector(".copy-button");
    const deleteButton = fragment.querySelector(".delete-button");

    shortLink.href = item.shortUrl;
    shortLink.textContent = item.shortUrl;
    originalLink.textContent = item.originalUrl;
    metaLine.textContent = buildMetaLine(item);

    copyButton.addEventListener("click", () => {
      void copyLink(item.shortUrl);
    });

    deleteButton.addEventListener("click", () => {
      void deleteLink(item.code).catch((error) => {
        setMessage(error.message, "error");
      });
    });

    urlList.appendChild(fragment);
  }
}

async function loadUrls() {
  const payload = await fetchJson("/api/urls");
  renderUrls(payload.data || []);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setMessage("Creating short URL...");

  const formData = new FormData(form);
  const expiresAtRaw = String(formData.get("expiresAt") || "").trim();
  const payload = {
    url: String(formData.get("url") || "").trim(),
    customAlias: String(formData.get("customAlias") || "").trim() || undefined,
    expiresAt: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : undefined,
  };

  try {
    const result = await fetchJson("/api/urls", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    form.reset();
    await loadUrls();
    setMessage(`${result.message} ${result.data.shortUrl}`, "success");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener("click", () => {
  void loadUrls().catch((error) => {
    setMessage(error.message, "error");
  });
});

async function init() {
  try {
    await Promise.all([loadMeta(), loadUrls()]);
  } catch (error) {
    setMessage(error.message, "error");
  }
}

void init();
