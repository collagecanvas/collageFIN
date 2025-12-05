// ================== ASSETS ==================
let APP_IMAGES = [];
let APP_BACKGROUNDS = [];

// ================== GLOBAL STATE ==================
const state = {
  layers: [],
  background: null,
  selectedLayerId: null,
};

let IS_LOGGED_IN = false;
let CURRENT_USER_ID = null;
let UNSAVED_FINAL = false;
let HAS_SAVED_CURRENT = false;

// ================== LOAD ASSETS ==================
async function loadAssets() {
  const res = await fetch("/api/assets");
  if (!res.ok) throw new Error("Failed to load /api/assets");
  const data = await res.json();

  APP_IMAGES = data.images || [];
  APP_BACKGROUNDS = data.backgrounds || [];

  console.log("[assets] loaded", data);
}

// ================== MODAL HELPERS ==================
function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("is-open");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("is-open");
}

function initModalCloseDelegates() {
  document.body.addEventListener("click", (e) => {
    const id = e.target.getAttribute("data-close-modal");
    if (id) closeModal(id);
  });
}

// ================== LAYER HELPERS ==================
function createLayer({ src, source = "device" }) {
  const id = "layer_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

  return {
    id,
    type: "image",
    src,
    source,
    x: 80 + Math.random() * 40,
    y: 80 + Math.random() * 40,
    scale: 1,
    rotation: 0,
    order: state.layers.length + 1,
  };
}

function createTextLayer({
  text = "Your text",
  x = 100,
  y = 100,
  fontSize = 24,
  color = "#ffffff",
  fontFamily,
}) {
  const id = "text_" + Date.now() + "_" + Math.floor(Math.random() * 9999);

  return {
    id,
    type: "text",
    text,
    x,
    y,
    scale: 1,
    rotation: 0,
    order: state.layers.length + 1,
    fontSize,
    color,
    fontFamily:
      fontFamily ||
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  };
}

function getLayer(id) {
  return state.layers.find((l) => l.id === id) || null;
}

function getMaxOrder() {
  return state.layers.reduce((m, l) => Math.max(m, l.order), 0);
}

function setSelectedLayer(id) {
  state.selectedLayerId = id;
  updateLayerSelectionUI();
  updateSelectedOutline();
}

// ================== DOM HELPERS ==================
function updateSelectedOutline() {
  const items = document.querySelectorAll(".layer-item");
  items.forEach((el) => {
    const lid = el.dataset.layerId;
    if (lid === state.selectedLayerId) {
      el.classList.add("is-selected");
    } else {
      el.classList.remove("is-selected");
    }
  });
}

// ================== LAYER ACTION ACTIVE UI ==================
function setActiveAction(button) {
  const buttons = document.querySelectorAll(".layer-action-text");
  buttons.forEach((b) => b.classList.remove("active"));
  if (button) button.classList.add("active");
}

// ================== CANVAS RENDER ==================
function renderCanvas() {
  const canvas = document.getElementById("collagecanvas");
  const placeholder = document.getElementById("canvas-placeholder");
  if (!canvas) return;

  const old = canvas.querySelectorAll(".canvas-bg, .layer-item");
  old.forEach((node) => node.remove());

  const hasContent = state.background || state.layers.length > 0;
  if (placeholder) {
    placeholder.style.display = hasContent ? "none" : "flex";
  }

  if (state.background) {
    const bg = document.createElement("img");
    bg.src = state.background.src;
    bg.className = "canvas-bg";
    bg.draggable = false;
    bg.addEventListener("dragstart", (e) => e.preventDefault());
    canvas.appendChild(bg);
  }

  state.layers
    .slice()
    .sort((a, b) => a.order - b.order)
    .forEach((layer) => {
      let el;

      if (layer.type === "text") {
        el = document.createElement("div");
        el.textContent = layer.text || "Your text";
        el.className = "layer-item layer-text";
        el.dataset.layerId = layer.id;

        const fontFamily =
          layer.fontFamily ||
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

        el.style.fontFamily = fontFamily;
        el.style.fontSize = (layer.fontSize || 24) + "px";
        el.style.color = layer.color || "#ffffff";
        el.style.textAlign = "center";
        el.style.padding = "4px 8px";
        el.style.whiteSpace = "pre-wrap";

        el.addEventListener("dblclick", () => {
          setSelectedLayer(layer.id);
          const newText = prompt("Edit text", layer.text || "");
          if (newText !== null) {
            layer.text = newText;
            renderCanvas();
          }
        });
      } else {
        el = document.createElement("img");
        el.src = layer.src;
        el.className = "layer-item";
        el.dataset.layerId = layer.id;

        const baseSize = 120;
        el.style.width = baseSize + "px";
        el.style.height = baseSize + "px";
        el.style.objectFit = "contain";
        el.draggable = false;
        el.addEventListener("dragstart", (e) => e.preventDefault());
      }

      el.style.zIndex = layer.order;
      el.style.touchAction = "none";

      applyLayerTransform(el, layer);
      makeLayerDraggable(el, layer);

      canvas.appendChild(el);
    });

  updateSelectedOutline();
}

// ================== TRANSFORM HELPERS ==================
function applyLayerTransform(el, layer) {
  el.style.transform =
    `translate(${layer.x}px, ${layer.y}px) ` +
    `scale(${layer.scale}) ` +
    `rotate(${layer.rotation}deg)`;
}

// ================== CLEAR CANVAS ==================
function clearCanvas() {
  state.layers = [];
  state.background = null;
  state.selectedLayerId = null;
  updateLayerSelectionUI();
  renderCanvas();
}

// ================== DRAG + PINCH / ROTATE ==================
function makeLayerDraggable(el, layer) {
  let dragging = false;
  let gesture = false;
  const pointerData = new Map();

  let startX = 0;
  let startY = 0;
  let layerStartX = 0;
  let layerStartY = 0;

  let initialDistance = 0;
  let initialAngle = 0;
  let initialScale = 1;
  let initialRotation = 0;

  function distance(p1, p2) {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function angle(p1, p2) {
    return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
  }

  function onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();

    setSelectedLayer(layer.id);

    if (el.setPointerCapture) {
      el.setPointerCapture(e.pointerId);
    }
    pointerData.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointerData.size === 1) {
      dragging = true;
      gesture = false;

      startX = e.clientX;
      startY = e.clientY;
      layerStartX = layer.x;
      layerStartY = layer.y;
    } else if (pointerData.size === 2) {
      dragging = false;
      gesture = true;

      const [p1, p2] = [...pointerData.values()];
      initialDistance = distance(p1, p2);
      initialAngle = angle(p1, p2);

      initialScale = layer.scale;
      initialRotation = layer.rotation;
    }
  }

  function onPointerMove(e) {
    if (!pointerData.has(e.pointerId)) return;
    pointerData.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesture && pointerData.size >= 2) {
      const [p1, p2] = [...pointerData.values()];
      const newDist = distance(p1, p2);
      const newAngle = angle(p1, p2);

      const scaleFactor = newDist / initialDistance;
      layer.scale = Math.max(0.2, Math.min(5, initialScale * scaleFactor));

      const angleDiff = newAngle - initialAngle;
      layer.rotation = initialRotation + angleDiff;

      applyLayerTransform(el, layer);
      updateLayerSelectionUI();
      return;
    }

    if (dragging) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      layer.x = layerStartX + dx;
      layer.y = layerStartY + dy;

      applyLayerTransform(el, layer);
    }
  }

  function onPointerUp(e) {
    pointerData.delete(e.pointerId);
    dragging = false;

    if (pointerData.size < 2) {
      gesture = false;
    }

    try {
      if (el.releasePointerCapture) {
        el.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}
  }

  el.addEventListener("pointerdown", onPointerDown);
  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
}

// ================== LAYER TOOLS UI ==================
function updateLayerSelectionUI() {
  const nameEl = document.getElementById("layer-selected-label");
  const scaleSlider = document.getElementById("scale-slider");
  const rotateSlider = document.getElementById("rotate-slider");
  const textTools = document.getElementById("text-tools");

  const layer = getLayer(state.selectedLayerId);

  if (!layer) {
    if (nameEl) nameEl.textContent = "None";
    if (scaleSlider) scaleSlider.value = 50;
    if (rotateSlider) rotateSlider.value = -180;
    if (textTools) textTools.style.display = "none";
    setActiveAction(null);
    return;
  }

  if (nameEl) {
    if (layer.type === "text") {
      nameEl.textContent = "Text layer";
    } else {
      const srcShort = layer.source === "device" ? "From gallery" : "App image";
      nameEl.textContent = srcShort;
    }
  }
  if (scaleSlider) scaleSlider.value = Math.round(layer.scale * 50);
  if (rotateSlider) rotateSlider.value = Math.round(layer.rotation);

  if (textTools) {
    textTools.style.display = layer.type === "text" ? "flex" : "none";
  }
}

// ================== BACKGROUND REMOVAL ==================
async function removeBackgroundFromLayer(layer) {
  return new Promise((resolve, reject) => {
    if (!layer || !layer.src) {
      resolve();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        function sampleAt(x, y) {
          const idx = (y * canvas.width + x) * 4;
          return [data[idx], data[idx + 1], data[idx + 2]];
        }

        const samples = [
          sampleAt(0, 0),
          sampleAt(canvas.width - 1, 0),
          sampleAt(0, canvas.height - 1),
          sampleAt(canvas.width - 1, canvas.height - 1),
        ];

        let r = 0,
          g = 0,
          b = 0;
        samples.forEach(([sr, sg, sb]) => {
          r += sr;
          g += sg;
          b += sb;
        });
        r /= samples.length;
        g /= samples.length;
        b /= samples.length;

        const threshold = 40;

        for (let i = 0; i < data.length; i += 4) {
          const dr = data[i] - r;
          const dg = data[i + 1] - g;
          const db = data[i + 2] - b;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist < threshold) {
            data[i + 3] = 0;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        layer.src = canvas.toDataURL("image/png");
        resolve();
      } catch (err) {
        console.error("[remove-bg] failed processing", err);
        reject(err);
      }
    };

    img.onerror = (err) => {
      console.error("[remove-bg] image load error", err);
      reject(err);
    };

    img.src = layer.src;
  });
}

// ================== MODALS ==================
function buildImageModal() {
  const grid = document.getElementById("image-modal-grid");
  if (!grid) return;
  grid.innerHTML = "";

  APP_IMAGES.forEach((img) => {
    const item = document.createElement("div");
    item.className = "modal-item";
    item.dataset.id = img.id;

    const imgEl = document.createElement("img");
    imgEl.src = img.src;

    const checkbox = document.createElement("div");
    checkbox.className = "modal-item-checkbox";
    checkbox.textContent = "+";

    item.appendChild(imgEl);
    item.appendChild(checkbox);

    item.addEventListener("click", () => {
      item.classList.toggle("selected");
      checkbox.textContent = item.classList.contains("selected") ? "✓" : "+";
    });

    grid.appendChild(item);
  });
}

function buildBackgroundModal() {
  const grid = document.getElementById("bg-modal-grid");
  if (!grid) return;
  grid.innerHTML = "";

  APP_BACKGROUNDS.forEach((bg) => {
    const item = document.createElement("div");
    item.className = "modal-item";

    const imgEl = document.createElement("img");
    imgEl.src = bg.src;

    item.appendChild(imgEl);

    item.addEventListener("click", () => {
      state.background = { src: bg.src };
      closeModal("bg-modal");
      renderCanvas();
    });

    grid.appendChild(item);
  });
}

// ================== GENERATE COLLAGE ==================
async function captureCollageAsPng() {
  const area = document.getElementById("collagecanvas");
  if (!area) {
    throw new Error("Collage canvas element not found");
  }

  const rect = area.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  const canvas = document.createElement("canvas");
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  if (state.background && state.background.src) {
    try {
      const bgImg = await loadImage(state.background.src);

      const targetW = rect.width;
      const targetH = rect.height;

      const imgW = bgImg.naturalWidth || bgImg.width;
      const imgH = bgImg.naturalHeight || bgImg.height;

      const imgRatio = imgW / imgH;
      const targetRatio = targetW / targetH;

      let drawW, drawH, offsetX, offsetY;

      if (imgRatio > targetRatio) {
        const scale = targetH / imgH;
        drawW = imgW * scale;
        drawH = targetH;
        offsetX = (targetW - drawW) / 2;
        offsetY = 0;
      } else {
        const scale = targetW / imgW;
        drawW = targetW;
        drawH = imgH * scale;
        offsetX = 0;
        offsetY = (targetH - drawH) / 2;
      }

      ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);
    } catch (err) {
      console.warn("Failed to load background for capture", err);
      ctx.fillStyle = "#f5e6ff";
      ctx.fillRect(0, 0, rect.width, rect.height);
    }
      
  } else {
    ctx.fillStyle = "#f5e6ff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }

  const layers = state.layers.slice().sort((a, b) => a.order - b.order);

  for (const layer of layers) {
    if (layer.type === "image") {
      try {
        const img = await loadImage(layer.src);
        const baseSize = 120;
        const half = baseSize / 2;

        const scale = layer.scale || 1;
        const rotationRad = ((layer.rotation || 0) * Math.PI) / 180;

        const imgW = img.naturalWidth || img.width;
        const imgH = img.naturalHeight || img.height;
        const imgRatio = imgW / imgH;
        const boxRatio = 1;

        let drawW, drawH;
        if (imgRatio > boxRatio) {
          drawW = baseSize;
          drawH = baseSize / imgRatio;
        } else {
          drawH = baseSize;
          drawW = baseSize * imgRatio;
        }

        ctx.save();
        ctx.translate(layer.x + half, layer.y + half);
        ctx.rotate(rotationRad);
        ctx.scale(scale, scale);
        ctx.drawImage(
          img,
          0,
          0,
          imgW,
          imgH,
          -drawW / 2,
          -drawH / 2,
          drawW,
          drawH
        );
        ctx.restore();
      } catch (err) {
        console.warn("Failed to draw image layer", err);
      }
    } else if (layer.type === "text") {
      ctx.save();

      const fontSize = layer.fontSize || 24;
      const fontFamily =
        layer.fontFamily ||
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

      const scale = layer.scale || 1;
      const rotationRad = ((layer.rotation || 0) * Math.PI) / 180;

      ctx.translate(layer.x, layer.y);
      ctx.rotate(rotationRad);
      ctx.scale(scale, scale);

      ctx.font = `${fontSize}px ${fontFamily}`;
      ctx.fillStyle = layer.color || "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(layer.text || "Your text", 0, 0);

      ctx.restore();
    }
  }

  return canvas.toDataURL("image/png");
}

// ================== CONNECT TO BACKEND ==================
async function saveCollageToServer(visibility) {
  const hasContent = state.layers.length > 0 || !!state.background;
  if (!hasContent) {
    alert("Add at least one image or background before saving.");
    return;
  }

  if (!CURRENT_USER_ID) {
    alert("You need to be logged in before saving or publishing.");
    return;
  }

  try {
    const imageData = await captureCollageAsPng();

    const res = await fetch("/api/collages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageData,
        visibility,
        ownerUserID: CURRENT_USER_ID,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Failed to save collage:", errText);
      alert("Failed to save collage. Check console for details.");
      return;
    }

    const record = await res.json();
    console.log("Saved collage record:", record);

    alert(
      visibility === "public"
        ? "Collage published! 🎉"
        : "Collage saved as private 💾"
    );
  } catch (err) {
    console.error("Error saving collage:", err);
    alert("Unexpected error while saving the collage.");
  }
}

// ================== MAIN INIT ==================
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadAssets();
  } catch (err) {
    console.error(err);
    alert("Failed to load /api/assets");
  }

  initModalCloseDelegates();
  buildImageModal();
  buildBackgroundModal();

  const canvas = document.getElementById("collagecanvas");
  if (canvas) {
    canvas.addEventListener("pointerdown", (e) => {
      if (e.target === canvas) {
        state.selectedLayerId = null;
        updateLayerSelectionUI();
        updateSelectedOutline();
      }
    });
  }

  const clearBtn = document.getElementById("btn-clear-canvas");
  const libraryBtn = document.getElementById("btn-go-library");
  const loginHint = document.getElementById("login-hint");
  const layerTools = document.getElementById("layer-tools");
  const controlsSection = document.querySelector(".controls-section");
  const createActions = document.getElementById("create-actions");
  const finalActions = document.getElementById("final-actions");
  const createMoreRow = document.getElementById("create-more-row");
  const createMoreBtn = document.getElementById("btn-create-more");

  if (finalActions) finalActions.style.display = "none";
  if (libraryBtn) libraryBtn.style.display = "none";

  // ----- AUTH BRIDGE FROM AUTH.JS -----

  window.setLoggedInUser = function (user) {
    IS_LOGGED_IN = true;
    if (user && user.id) {
      CURRENT_USER_ID = user.id;
    }
    console.log("[main] logged in as:", CURRENT_USER_ID);

    const authSection = document.getElementById("authentication");
    if (authSection) authSection.classList.add("is-hidden");

    if (layerTools) layerTools.style.display = "flex";
    if (controlsSection) controlsSection.style.display = "block";
    if (createActions) createActions.style.display = "flex";
    if (clearBtn) clearBtn.style.display = "inline-flex";
    if (finalActions) finalActions.style.display = "none";

    if (loginHint) loginHint.style.display = "none";
    if (libraryBtn) libraryBtn.style.display = "inline-flex";
  };

  window.setLoggedOut = function () {
    IS_LOGGED_IN = false;
    CURRENT_USER_ID = null;
    console.log("[main] logged out");

    const authSection = document.getElementById("authentication");
    if (authSection) authSection.classList.remove("is-hidden");

    if (libraryBtn) libraryBtn.style.display = "none";
    if (loginHint) loginHint.style.display = "block";
  };

  try {
    const rawUser = localStorage.getItem("cc_user");
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user && user.id) {
        window.setLoggedInUser(user);
      }
    }
  } catch (err) {
    console.warn("[main] failed to restore user from storage", err);
  }

  if (!IS_LOGGED_IN && loginHint) {
    loginHint.style.display = "block";
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      UNSAVED_FINAL = false;
      clearCanvas();
    });
  }

  // ----- LIBRARY BUTTON -----

  if (libraryBtn) {
    libraryBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const hasContent = state.layers.length > 0 || !!state.background;
      const isUnsaved = hasContent && !HAS_SAVED_CURRENT;

      if (isUnsaved) {
        const go = confirm(
          "You haven't Save Private or Publish the collage."
        );
        if (!go) {
          return;
        }
      }
      window.location.href = "library.html";
    });
  }

  // ----- FROM GALLERY -----

  const fileInput = document.getElementById("file-input");
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const files = Array.from(e.target.files).filter((f) =>
        f.type.startsWith("image/")
      );
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          state.layers.push(
            createLayer({ src: evt.target.result, source: "device" })
          );
          renderCanvas();
        };
        reader.readAsDataURL(file);
      });
      e.target.value = "";
    });
  }

  // ----- APP IMAGES MODAL -----

  const appImgBtn = document.getElementById("btn-app-images");
  if (appImgBtn) {
    appImgBtn.addEventListener("click", () => {
      buildImageModal();
      openModal("image-modal");
    });
  }

  const imageModalAdd = document.getElementById("image-modal-add");
  if (imageModalAdd) {
    imageModalAdd.addEventListener("click", () => {
      const grid = document.getElementById("image-modal-grid");
      const items = grid.querySelectorAll(".modal-item.selected");

      items.forEach((item) => {
        const id = item.dataset.id;
        const meta = APP_IMAGES.find((i) => i.id === id);
        if (meta) {
          state.layers.push(
            createLayer({ src: meta.src, source: "app" })
          );
        }
      });

      closeModal("image-modal");
      renderCanvas();
    });
  }

  // ----- BACKGROUND MODAL -----

  const bgBtn = document.getElementById("btn-bg");
  if (bgBtn) {
    bgBtn.addEventListener("click", () => {
      buildBackgroundModal();
      openModal("bg-modal");
    });
  }

  // ----- LAYER TOOLS -----

  const scaleSlider = document.getElementById("scale-slider");
  if (scaleSlider) {
    scaleSlider.addEventListener("input", (e) => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer) return;
      layer.scale = Number(e.target.value) / 100;

      const el = document.querySelector(
        `.layer-item[data-layer-id="${layer.id}"]`
      );
      if (el) applyLayerTransform(el, layer);
    });
  }

  const rotateSlider = document.getElementById("rotate-slider");
  if (rotateSlider) {
    rotateSlider.addEventListener("input", (e) => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer) return;
      layer.rotation = Number(e.target.value);

      const el = document.querySelector(
        `.layer-item[data-layer-id="${layer.id}"]`
      );
      if (el) applyLayerTransform(el, layer);
    });
  }

  const frontBtn = document.getElementById("btn-layer-front");
  if (frontBtn) {
    frontBtn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer) return;
      setActiveAction(frontBtn);
      layer.order = getMaxOrder() + 1;
      renderCanvas();
    });
  }

  const backBtn = document.getElementById("btn-layer-back");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer) return;
      setActiveAction(backBtn);
      layer.order = 1;
      renderCanvas();
    });
  }

  const deleteBtn = document.getElementById("btn-layer-delete");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer) return;
      setActiveAction(deleteBtn);
      state.layers = state.layers.filter(
        (l) => l.id !== state.selectedLayerId
      );
      state.selectedLayerId = null;
      updateLayerSelectionUI();
      renderCanvas();
    });
  }

  const removeBgBtn = document.getElementById("btn-remove-bg");
  if (removeBgBtn) {
    removeBgBtn.addEventListener("click", async () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer || layer.type !== "image") return;

      setActiveAction(removeBgBtn);

      removeBgBtn.disabled = true;
      const originalText = removeBgBtn.textContent;
      removeBgBtn.textContent = "Removing...";

      try {
        await removeBackgroundFromLayer(layer);
        renderCanvas();
      } catch (err) {
        console.error("[remove-bg] failed", err);
      } finally {
        removeBgBtn.textContent = originalText;
        removeBgBtn.disabled = false;
      }
    });
  }

  const addTextBtn = document.getElementById("btn-add-text");

  if (addTextBtn) {
    addTextBtn.addEventListener("click", () => {
      setActiveAction(addTextBtn);

      const current = getLayer(state.selectedLayerId);

      if (current && current.type === "text") {
        const updated = prompt("Edit text", current.text || "");
        if (updated !== null) {
          current.text = updated;
          renderCanvas();
        }
        return;
      }

      const newLayer = createTextLayer({
        text: "Your text",
        x: 120 + Math.random() * 40,
        y: 120 + Math.random() * 40,
        fontSize: 24,
        color: "#ffffff",
      });

      state.layers.push(newLayer);
      setSelectedLayer(newLayer.id);
      renderCanvas();
    });
  }

  // ----- TEXT TOOLS -----

  const textEditBtn = document.getElementById("btn-text-edit");
  const textFontBtn = document.getElementById("btn-text-font");
  const textColorBtn = document.getElementById("btn-text-color");

  if (textEditBtn) {
    textEditBtn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer || layer.type !== "text") return;
      const updated = prompt("Edit text", layer.text || "");
      if (updated !== null) {
        layer.text = updated;
        renderCanvas();
      }
    });
  }

  if (textFontBtn) {
    textFontBtn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer || layer.type !== "text") return;
      openModal("text-font-modal");
    });
  }

  if (textColorBtn) {
    textColorBtn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer || layer.type !== "text") return;
      openModal("text-color-modal");
    });
  }

  const fontOptions = document.querySelectorAll(".text-font-option");
  fontOptions.forEach((btn) => {
    const font = btn.dataset.font;
    if (font) {
      btn.style.fontFamily = font;
    }

    btn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer || layer.type !== "text") return;

      if (font) {
        layer.fontFamily = font;
        renderCanvas();
      }
      closeModal("text-font-modal");
    });
  });

  const colorSwatches = document.querySelectorAll(".text-color-swatch");
  colorSwatches.forEach((btn) => {
    btn.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer || layer.type !== "text") return;
      const color = btn.dataset.color;
      if (color) {
        layer.color = color;
        renderCanvas();
      }
      closeModal("text-color-modal");
    });
  });

  const customColorInput = document.getElementById("text-color-custom");
  const customColorApply = document.getElementById("text-color-apply");
  if (customColorInput && customColorApply) {
    customColorApply.addEventListener("click", () => {
      const layer = getLayer(state.selectedLayerId);
      if (!layer || layer.type !== "text") return;
      const color = customColorInput.value;
      if (color) {
        layer.color = color;
        renderCanvas();
      }
      closeModal("text-color-modal");
    });
  }

  // ================== DONE → FINAL MODAL ==================

  const doneBtn = document.getElementById("btn-done");

  const finalModal = document.getElementById("final-modal");
  const finalModalMessage = document.getElementById("final-modal-message");
  const finalModalActions = document.getElementById("final-modal-actions");
  const finalModalGuest = document.getElementById("final-modal-guest");
  const modalPublishBtn = document.getElementById("final-modal-publish");
  const modalPrivateBtn = document.getElementById("final-modal-private");
  const modalLoginBtn = document.getElementById("final-modal-login-btn");

  if (finalModal) {
    const closeEls = finalModal.querySelectorAll(
      '[data-close-modal="final-modal"]'
    );
    closeEls.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (layerTools) layerTools.style.display = "flex";
        if (controlsSection) controlsSection.style.display = "block";
        if (createActions) createActions.style.display = "flex";
        if (clearBtn) clearBtn.style.display = "inline-flex";
        if (finalActions) finalActions.style.display = "none";
        if (createMoreRow) createMoreRow.style.display = "none";

        if (IS_LOGGED_IN && CURRENT_USER_ID) {
          if (loginHint) loginHint.style.display = "none";
          if (libraryBtn) libraryBtn.style.display = "inline-flex";
        } else {
          if (loginHint) loginHint.style.display = "block";
          if (libraryBtn) libraryBtn.style.display = "none";
        }
      });
    });
  }

  function showPostSaveCreateMore() {
    if (layerTools) layerTools.style.display = "none";
    if (controlsSection) controlsSection.style.display = "none";
    if (createActions) createActions.style.display = "none";
    if (clearBtn) clearBtn.style.display = "none";
    if (finalActions) finalActions.style.display = "none";
    if (createMoreRow) createMoreRow.style.display = "flex";
  }

  function handlePublishClick() {
    UNSAVED_FINAL = false;
    HAS_SAVED_CURRENT = true;
    saveCollageToServer("public");
    closeModal("final-modal");
    showPostSaveCreateMore();
  }

  function handlePrivateClick() {
    UNSAVED_FINAL = false;
    HAS_SAVED_CURRENT = true;
    saveCollageToServer("private");
    closeModal("final-modal");
    showPostSaveCreateMore();
  }

  function handleCreateMoreClick() {
    UNSAVED_FINAL = false;
    HAS_SAVED_CURRENT = false;
    clearCanvas();

    if (layerTools) layerTools.style.display = "flex";
    if (controlsSection) controlsSection.style.display = "block";
    if (createActions) createActions.style.display = "flex";
    if (clearBtn) clearBtn.style.display = "inline-flex";
    if (finalActions) finalActions.style.display = "none";
    if (createMoreRow) createMoreRow.style.display = "none";

    if (IS_LOGGED_IN && CURRENT_USER_ID) {
      if (loginHint) loginHint.style.display = "none";
      if (libraryBtn) libraryBtn.style.display = "inline-flex";
    } else {
      if (loginHint) loginHint.style.display = "block";
      if (libraryBtn) libraryBtn.style.display = "none";
    }

    window.scrollTo(0, 0);
  }

  const publishBtn = document.getElementById("btn-publish");
  const saveBtn = document.getElementById("btn-save-private");

  if (publishBtn) publishBtn.addEventListener("click", handlePublishClick);
  if (saveBtn) saveBtn.addEventListener("click", handlePrivateClick);
  if (modalPublishBtn) modalPublishBtn.addEventListener("click", handlePublishClick);
  if (modalPrivateBtn) modalPrivateBtn.addEventListener("click", handlePrivateClick);
  if (createMoreBtn) createMoreBtn.addEventListener("click", handleCreateMoreClick);

  if (modalLoginBtn) {
    modalLoginBtn.addEventListener("click", () => {
      closeModal("final-modal");
      if (typeof window.forceLoginPanel === "function") {
        window.forceLoginPanel();
      }
    });
  }

  if (doneBtn) {
    doneBtn.addEventListener("click", () => {
      const hasContent = state.layers.length > 0 || !!state.background;
      if (!hasContent) {
        alert("Add at least one image or background before finishing.");
        return;
      }

      if (layerTools) layerTools.style.display = "none";
      if (controlsSection) controlsSection.style.display = "none";
      if (createActions) createActions.style.display = "none";
      if (clearBtn) clearBtn.style.display = "none";
      if (finalActions) finalActions.style.display = "none";

      UNSAVED_FINAL = true;

      if (IS_LOGGED_IN && CURRENT_USER_ID) {
        finalModalMessage.textContent =
          "What would you like to do with this collage?";
        finalModalActions.style.display = "flex";
        finalModalGuest.style.display = "none";

        openModal("final-modal");

        if (loginHint) loginHint.style.display = "none";
      } else {
        finalModalMessage.textContent =
          "You need to be logged in to publish or save this collage.";
        finalModalActions.style.display = "none";
        finalModalGuest.style.display = "flex";

        if (loginHint) loginHint.style.display = "none";

        openModal("final-modal");
      }
    });
  }

  if (loginHint) {
    loginHint.style.cursor = "pointer";
    loginHint.addEventListener("click", () => {
      if (!IS_LOGGED_IN && typeof window.forceLoginPanel === "function") {
        window.forceLoginPanel();
      }
    });
  }

  updateLayerSelectionUI();
  renderCanvas();
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
  // Wait for the entire page and all resources to finish loading
  window.addEventListener('load', () => {
    // Register the worker located at the root of your application
    navigator.serviceWorker.register('/service-worker.js') 
      .then(registration => {
        console.log('[SW] ServiceWorker registration successful with scope:', registration.scope);
      })
      .catch(error => {
        console.error('[SW] ServiceWorker registration failed:', error);
      });
  });
}