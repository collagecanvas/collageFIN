// ===== Binder setup (front-end) =====================================

const BINDER_MIN_PAGES = 3;
const BINDER_MAX_PAGES = 10;

const binderState = {
  binderId: null,
  ownerUserId: null,
  visibility: "private",
  pages: [],                 
  coverCollageId: null,      
  allUserCollages: [],      
  originalPages: [],         
  originalCoverCollageId: null,
  lastSelectedCollageId: null, 
  isPickingCoverFromPages: false,
};

// ----- DOM refs -----
let binderCoverEl;
let binderEditBtn;

let editModal;
let pagesList;
let chooseCoverBtn;
let fileInput;
let savePrivateBtn;
let savePublicBtn;
let closeEditBtn;

let coverSourceModal;
let sourcePhoneBtn;
let sourceCurrentBtn;
let sourceCloseBtn;

let coverChoiceList;

// ================== HELPERS =========================================

function binderGetCurrentUserId() {
  try {
    const raw = localStorage.getItem("cc_user");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj.id || obj.user_id || obj.userId || null;
  } catch {
    return null;
  }
}

async function binderFetchJSON(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();

  if (!res.ok) {
    // surface server JSON error if possible
    try {
      const errJson = JSON.parse(text);
      throw new Error(JSON.stringify(errJson));
    } catch {
      throw new Error(text || `Request failed: ${res.status}`);
    }
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error(`Response is not valid JSON: ${e.message}`);
  }
}

function binderResetToFresh(userId) {
  const uid = userId || binderState.ownerUserId;

  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000) + 1000;

  binderState.binderId = `binder_${ts}_${rand}`;
  binderState.ownerUserId = uid || null;
  binderState.visibility = "private";

  binderState.pages = [];
  binderState.coverCollageId = null;
  binderState.originalPages = [];
  binderState.originalCoverCollageId = null;
  binderState.lastSelectedCollageId = null;
  binderState.isPickingCoverFromPages = false; // ✅ add this

  binderRenderPagesGrid();
  binderRenderCoverPreview();
  binderRenderMainCover();
}

// ================== LOAD USER COLLAGES ==============================

async function binderLoadUserCollages(userId) {
  const [privates, publics] = await Promise.all([
    binderFetchJSON(
      `${API_BASE}/api/collages?owner=${encodeURIComponent(userId)}&visibility=private`
    ),
    binderFetchJSON(
      `${API_BASE}/api/collages?owner=${encodeURIComponent(userId)}&visibility=public`
    ),
  ]);

  const map = new Map();
  [...privates, ...publics].forEach((c) => {
    if (c && c.id) map.set(c.id, c);
  });

  binderState.allUserCollages = Array.from(map.values());
}

// ================== LOAD OR INIT BINDER =============================


async function binderLoadOrInitBinder(userId) {
  binderResetToFresh(userId);
}

// ================== RENDER PAGES GRID ===============================

function binderRenderPagesGrid() {
  if (!pagesList) return;
  pagesList.innerHTML = "";

  binderState.allUserCollages.forEach((c) => {
    const item = document.createElement("div");
    item.className = "binder-thumb";

    if (binderState.pages.includes(c.id)) {
      item.classList.add("selected");
    }

    const img = document.createElement("img");
    img.src = c.imageUrl;
    img.alt = `Collage ${c.id}`;
    item.appendChild(img);

    item.onclick = () => {
      const idx = binderState.pages.indexOf(c.id);

     
      if (binderState.isPickingCoverFromPages) {
        
        if (idx === -1) {
          if (binderState.pages.length >= BINDER_MAX_PAGES) {
            alert(`You can only add up to ${BINDER_MAX_PAGES} collages.`);
            return;
          }
          binderState.pages.push(c.id);
          binderState.lastSelectedCollageId = c.id;
          item.classList.add("selected");
        }

       
        binderState.coverCollageId = c.id;
        binderState.lastSelectedCollageId = c.id;
        binderState.isPickingCoverFromPages = false;

        binderRenderCoverPreview();  
        return; 
      }

      // Normal toggle behavior (when NOT picking cover)
      if (idx === -1) {
        if (binderState.pages.length >= BINDER_MAX_PAGES) {
          alert(`You can only add up to ${BINDER_MAX_PAGES} collages.`);
          return;
        }
        binderState.pages.push(c.id);
        binderState.lastSelectedCollageId = c.id;
        item.classList.add("selected");
      } else {
        binderState.pages.splice(idx, 1);
        item.classList.remove("selected");

        if (binderState.coverCollageId === c.id) {
          binderState.coverCollageId = null;
          binderRenderCoverPreview();
          binderRenderMainCover();
        }

        if (binderState.lastSelectedCollageId === c.id) {
          binderState.lastSelectedCollageId =
            binderState.pages.length
              ? binderState.pages[binderState.pages.length - 1]
              : null;
        }
      }
    };

    pagesList.appendChild(item);
  });
}

// ================== RENDER COVER PREVIEW ============================

function binderRenderCoverPreview() {
  if (!coverChoiceList) return;
  coverChoiceList.innerHTML = "";

  if (!binderState.coverCollageId) return;

  const c = binderState.allUserCollages.find(
    (col) => col.id === binderState.coverCollageId
  );
  if (!c) return;

  const item = document.createElement("div");
  item.className = "binder-thumb selected";

  const img = document.createElement("img");
  img.src = c.imageUrl;
  img.alt = "Binder cover";
  item.appendChild(img);

  coverChoiceList.appendChild(item);

  binderRenderMainCover();
}

// main binder card
function binderRenderMainCover() {
  if (!binderCoverEl) return;

  const c = binderState.allUserCollages.find(
    (col) => col.id === binderState.coverCollageId
  );

  if (c && c.imageUrl) {
    binderCoverEl.style.backgroundImage = `url(${c.imageUrl})`;
    binderCoverEl.style.backgroundSize = "cover";
    binderCoverEl.style.backgroundPosition = "center";
    binderCoverEl.style.borderStyle = "solid";
  } else {
    binderCoverEl.style.backgroundImage = "";
    binderCoverEl.style.backgroundSize = "";
    binderCoverEl.style.backgroundPosition = "";
    binderCoverEl.style.borderStyle = "dashed";
  }
}

// ================== SAVE BINDER ====================================

async function binderSave(visibility) {
  if (!binderState.ownerUserId) {
    alert("Please log in first.");
    return;
  }

  if (
    !Array.isArray(binderState.pages) ||
    binderState.pages.length < BINDER_MIN_PAGES
  ) {
    alert(`Choose at least ${BINDER_MIN_PAGES} collages for binder.`);
    return;
  }

  if (!binderState.coverCollageId) {
    alert("You haven't choose cover");
    return;
  }

  const payload = {
    owner_user_id: binderState.ownerUserId,
    cover_collage_id: binderState.coverCollageId,
    visibility: visibility || "private",
    pages: binderState.pages.slice(),
  };

  try {
    await binderFetchJSON(
      `${API_BASE}/api/binders/${encodeURIComponent(binderState.binderId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    binderState.visibility = visibility || "private";

    alert(
      visibility === "public"
        ? "Binder published to Public section."
        : "Binder saved to Private section."
    );

    if (editModal) {
      editModal.classList.add("is-hidden");
    }

    binderResetToFresh(binderState.ownerUserId);
  } catch (err) {
    console.error("[binder] save failed", err);
    alert("Failed to save binder: " + err.message);
  }
}

// ================== COVER UPLOAD (FROM PHONE) =======================

async function binderUploadCoverFromFile(file) {
  const reader = new FileReader();

  reader.onload = async () => {
    const dataUrl = reader.result;

    try {
      const created = await binderFetchJSON("${API_BASE}/api/collages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: dataUrl,
          visibility: "private",
          ownerUserID: binderState.ownerUserId,
        }),
      });
  
      binderState.allUserCollages.push(created);
      binderState.coverCollageId = created.id;
      binderState.lastSelectedCollageId = created.id;

      binderRenderCoverPreview();
      coverSourceModal.classList.add("is-hidden");
    } catch (err) {
      console.error("[binder] upload cover failed", err);
      alert("Failed to upload cover image.");
      coverSourceModal.classList.add("is-hidden");
    }
  };

  reader.readAsDataURL(file);
}

// ================== CANCEL EDIT ====================================

function binderCancelEdit() {
  binderResetToFresh(binderState.ownerUserId);

  if (editModal) {
    editModal.classList.add("is-hidden");
  }
}

// ================== INIT ===========================================

async function binderInit() {
  const userId = binderGetCurrentUserId();
  if (!userId) return;

  binderState.ownerUserId = userId;

  // DOM
  binderCoverEl = document.querySelector("#binder-section .binder-cover");
  binderEditBtn = document.getElementById("binder-edit-btn");

  editModal = document.getElementById("binder-edit-modal");
  pagesList = document.getElementById("binder-collage-list");
  chooseCoverBtn = document.getElementById("binder-choose-cover-btn");
  fileInput = document.getElementById("binder-cover-file-input");
  savePrivateBtn = document.getElementById("binder-save-private-btn");
  savePublicBtn = document.getElementById("binder-save-public-btn");
  closeEditBtn = document.getElementById("binder-modal-close");
  coverChoiceList = document.getElementById("binder-cover-choice-list");

  coverSourceModal = document.getElementById("binder-cover-source-modal");
  sourcePhoneBtn = document.getElementById("cover-source-phone");
  sourceCurrentBtn = document.getElementById("cover-source-current");
  sourceCloseBtn = document.getElementById("cover-source-close");

  await binderLoadUserCollages(userId);
  await binderLoadOrInitBinder(userId);

  // open editor
  if (binderEditBtn && editModal) {
    binderEditBtn.onclick = () => {
      binderRenderPagesGrid();
      binderRenderCoverPreview();
      editModal.classList.remove("is-hidden");
    };
  }


  if (savePrivateBtn) {
    savePrivateBtn.onclick = () => binderSave("private");
  }
  if (savePublicBtn) {
    savePublicBtn.onclick = () => binderSave("public");
  }
  if (closeEditBtn) {
    closeEditBtn.onclick = () => binderCancelEdit();
  }

  if (chooseCoverBtn && coverSourceModal) {
    chooseCoverBtn.onclick = () => {
      coverSourceModal.classList.remove("is-hidden");
    };
  }

  if (sourcePhoneBtn && fileInput) {
    sourcePhoneBtn.onclick = () => {
      fileInput.click();
    };

    fileInput.onchange = () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      binderUploadCoverFromFile(file);
      fileInput.value = "";
    };
  }


    if (sourceCurrentBtn && coverSourceModal) {
      sourceCurrentBtn.onclick = () => {
        if (binderState.pages.length < BINDER_MIN_PAGES) {
          alert(`Choose at least ${BINDER_MIN_PAGES} collages for binder first.`);
          return;
        }

 
        binderState.isPickingCoverFromPages = true;

        coverSourceModal.classList.add("is-hidden");

      };
    }


  if (sourceCloseBtn && coverSourceModal) {
    sourceCloseBtn.onclick = () => {
      coverSourceModal.classList.add("is-hidden");
    };
  }

  
  binderRenderMainCover();
}

document.addEventListener("DOMContentLoaded", binderInit);
