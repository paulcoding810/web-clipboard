const MAX_ITEMS = 10;
const STORAGE_KEY = "clipboardHistory";
let history = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let deletedItem = null;
let undoTimeout = null;

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 1500);
}

function addItem(content, type) {
  if (history.length >= MAX_ITEMS) {
    showToast("Clear history to add");
    return;
  }
  history.unshift({ content, type, id: Date.now() });
  save();
  render();
}

function deleteItem(id) {
  const idx = history.findIndex((i) => i.id === id);
  if (idx === -1) return;

  deletedItem = { item: history[idx], index: idx };
  history = history.filter((i) => i.id !== id);
  save();
  render();
  showUndoToast();
}

function showUndoToast() {
  const t = document.getElementById("undoToast");
  document.getElementById("undoMsg").textContent = "Item deleted";
  t.classList.add("show");

  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => {
    t.classList.remove("show");
    deletedItem = null;
  }, 4000);
}

document.getElementById("undoBtn").addEventListener("click", () => {
  if (deletedItem) {
    history.splice(deletedItem.index, 0, deletedItem.item);
    save();
    render();
    document.getElementById("undoToast").classList.remove("show");
    deletedItem = null;
    if (undoTimeout) clearTimeout(undoTimeout);
  }
});

function copyItem(item) {
  if (item.type === "text") {
    navigator.clipboard
      .writeText(item.content)
      .then(() => {
        showToast("Copied to clipboard!");
      })
      .catch(() => {
        const ta = document.createElement("textarea");
        ta.value = item.content;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        showToast("Copied to clipboard!");
      });
  } else if (item.type === "image") {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (navigator.clipboard && navigator.clipboard.write) {
          navigator.clipboard
            .write([new ClipboardItem({ "image/png": blob })])
            .then(() => showToast("Image copied!"))
            .catch(() => showToast("Image copy not supported in this browser"));
        } else {
          showToast("Image copy not supported in this browser");
        }
      }, "image/png");
    };
    img.src = item.content;
  }
}

function render() {
  const el = document.getElementById("history");
  if (history.length === 0) {
    el.innerHTML =
      '<div class="empty">No items yet. Paste or type to add!</div>';
    return;
  }
  el.innerHTML = history
    .map((item) => {
      if (item.type === "text") {
        return `<div class="item text-item" data-id="${item.id}">
          <pre class="text-content">${escapeHtml(item.content)}</pre>
          <span class="label">text</span>
          <button class="copy" onclick="copyItem(history.find(i => i.id === ${item.id}))">⧉</button>
          <button class="edit" onclick="event.stopPropagation(); editItem(${item.id})">✎</button>
          <button class="delete" onclick="event.stopPropagation(); deleteItem(${item.id})">×</button>
        </div>`;
      } else {
        return `<div class="item image-item"><img src="${item.content}" alt="clipboard image"><span class="label">image</span><button class="copy" onclick="copyItem(history.find(i => i.id === ${item.id}))">⧉</button><button class="delete" onclick="event.stopPropagation(); deleteItem(${item.id})">×</button></div>`;
      }
    })
    .join("");
}

function editItem(id) {
  const item = history.find((i) => i.id === id);
  if (!item || item.type !== "text") return;

  const el = document.querySelector(`.item[data-id="${id}"]`);
  if (!el) return;

  el.classList.add("edit-mode");
  el.innerHTML = `
    <textarea id="edit-textarea-${id}">${escapeHtml(item.content)}</textarea>
    <div class="edit-actions">
      <button class="save" onclick="saveEdit(${id})">Save</button>
      <button class="cancel" onclick="cancelEdit(${id})">Cancel</button>
    </div>
  `;

  const textarea = document.getElementById(`edit-textarea-${id}`);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.metaKey) {
      e.preventDefault();
      saveEdit(id);
    }
  });
  textarea.addEventListener("paste", (e) => {
    e.stopPropagation();
  });
  textarea.focus();
}

function saveEdit(id) {
  const item = history.find((i) => i.id === id);
  if (!item) return;

  const textarea = document.getElementById(`edit-textarea-${id}`);
  const newContent = textarea.value;

  if (newContent.trim()) {
    item.content = newContent;
    save();
  }
  render();
}

function cancelEdit(id) {
  render();
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const input = document.getElementById("textInput");

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.value.trim()) {
    addItem(e.target.value.trim(), "text");
    e.target.value = "";
  }
});

document.addEventListener("paste", (e) => {
  if (input == document.activeElement) return;

  const cd = e.clipboardData || window.clipboardData;
  if (!cd) {
    showToast("No clipboard!");
    return;
  }

  const types = cd.types || [];
  const hasText = Array.from(types).some(
    (t) => t === "text/plain" || t.startsWith("text/")
  );

  const hasImage = Array.from(types).some(
    (t) => t.startsWith("image/") || t.startsWith("Files")
  );

  if (hasText) {
    const text = cd.getData("text");
    if (text) {
      addItem(text, "text");
      return;
    }
  }

  if (hasImage && cd.files.length > 0) {
    const file = cd.files[0];
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => addItem(reader.result, "image");
      reader.readAsDataURL(file);
    }
  }
});

render();
