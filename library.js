// === LIBRARY: TABS + PUBLIC / PRIVATE USING REAL BACKEND ===

document.addEventListener("DOMContentLoaded", () => {
  let CURRENT_USER_ID = null;
  let IS_LOGGED_IN = false;
  let currentUser = null;

  // restore auth state from localStorage
  try {
    const rawUser = localStorage.getItem("cc_user");
    if (rawUser) {
      currentUser = JSON.parse(rawUser);
      if (currentUser && currentUser.id) {
        CURRENT_USER_ID = currentUser.id;
        IS_LOGGED_IN = true;
        window.CURRENT_USER_ID = currentUser.id;
      }
    }
  } catch (err) {
    console.warn("[library] failed to restore user from localStorage", err);
  }

  // ===== BINDER FLIP STATE =====
  const binderFlipState = {
    binderId: null,
    pages: [],
    currentIndex: 0,
    isLoading: false,
    isAnimating: false,
  };

  // ----- DOM HOOKS -----
  const binderSection  = document.getElementById("binder-section");
  const publicSection  = document.getElementById("public-section");
  const privateSection = document.getElementById("private-section");
  const exploreSection = document.getElementById("explore-section");
  const likedSection   = document.getElementById("liked-section");
  const profileSection = document.getElementById("profile-section");

  const binderGrid  = document.getElementById("binder-grid");
  const publicGrid  = document.getElementById("public-grid");
  const privateGrid = document.getElementById("private-grid");
  const exploreGrid = document.getElementById("explore-grid");
  const likedGrid   = document.getElementById("liked-grid");

  const publicLoading  = document.getElementById("public-loading");
  const privateLoading = document.getElementById("private-loading");
  const exploreLoading = document.getElementById("explore-loading");
  const likedLoading   = document.getElementById("liked-loading");

  const topBarTitle   = document.getElementById("app-title");
  const tabsContainer = document.querySelector(".library-tabs");

  const binderTabBtn  = document.getElementById("tab-binder");
  const publicTabBtn  = document.getElementById("tab-public");
  const privateTabBtn = document.getElementById("tab-private");
  const exploreTabBtn = document.getElementById("tab-explore");
  const likedTabBtn   = document.getElementById("tab-liked");

  const homeNavItem    = document.querySelector(".bottom-nav-item.home-nav");
  const exploreNavItem = document.querySelector(".bottom-nav-item.explore-nav");
  const libraryNavItem = document.querySelector(".bottom-nav-item.library-nav");
  const likedNavItem   = document.querySelector(".bottom-nav-item.liked-nav");
  const profileNavItem = document.querySelector(".bottom-nav-item.profile-nav");

  const collageModal         = document.getElementById("collage-modal");
  const collageModalInner    = collageModal ? collageModal.querySelector(".collage-modal-inner") : null;
  const collageModalImage    = document.getElementById("collage-modal-image");
  const collageModalActions  = document.getElementById("collage-modal-actions");
  const collageModalCloseBtn = document.getElementById("collage-modal-close");
  const collageOwnerNameEl   = document.getElementById("collage-owner-name");
  const collageLikeButton    = document.getElementById("collage-like-button");
  const collageModalBinderChip = document.getElementById("collage-modal-binder-chip");
  const binderFlipInner = document.getElementById("binder-flip-inner");
  const binderBackImage = document.getElementById("binder-back-image");
  const binderFlipHintCount = collageModalBinderChip ? collageModalBinderChip.querySelector(".binder-pages-count") : null;

  // use local <audio> element for flip sound
  const flipAudioEl = document.getElementById("binder-flip-sfx");

  // profile elements (matching new HTML)
  const profileDisplayNameText = document.getElementById("profile-display-name-text"); // big name on card
  const profileDisplayNameEl   = document.getElementById("profile-display-name");      // in details list
  const profileEmailEl         = document.getElementById("profile-email");
  const profileIdEl            = document.getElementById("profile-user-id");
  const profileCreatedAtEl     = document.getElementById("profile-created-at");
  const profileTotalEl         = document.getElementById("profile-total-collages");
  const profilePublicEl        = document.getElementById("profile-public-collages");
  const profilePrivateEl       = document.getElementById("profile-private-collages");
  const profileAvatarInitials  = document.getElementById("profile-avatar-initials");
  const profileBioEl           = document.getElementById("profile-bio");
  const manageAccountBtn       = document.getElementById("profile-manage-account");


  // track what has been loaded
  let publicLoaded  = false;
  let privateLoaded = false;
  let exploreLoaded = false;
  let likedLoaded   = false;

  // ----- TOP BAR HELPERS -----

  function setTopBarForLibrary() {
    if (topBarTitle) topBarTitle.textContent = "Library";
    if (tabsContainer) tabsContainer.style.display = "flex";
  }

  function setTopBarForProfile() {
    if (topBarTitle) topBarTitle.textContent = "User Profile";
    if (tabsContainer) tabsContainer.style.display = "none";
  }

  function setTopBarForExplore() {
    if (topBarTitle) topBarTitle.textContent = "Explore";
    if (tabsContainer) tabsContainer.style.display = "none";
  }

  function setTopBarForLiked() {
    if (topBarTitle) topBarTitle.textContent = "Liked";
    if (tabsContainer) tabsContainer.style.display = "none";
  }

  // ----- FETCH HELPERS -----

  async function fetchCollages(params = {}) {
    const merged = { ...params };
    if (CURRENT_USER_ID) {
      merged.viewer = CURRENT_USER_ID;
    }

    const query = new URLSearchParams(merged);
    const url = `${API_BASE}/api/collages${query.toString() ? "?" + query.toString() : ""}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("Failed to fetch collages:", res.status, url);
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Error fetching collages:", err);
      return [];
    }
  }

    async function fetchBinders(params = {}) {
    const query = new URLSearchParams(params);
    const url = `${API_BASE}/api/binders${query.toString() ? "?" + query.toString() : ""}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("Failed to fetch binders:", res.status, url);
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Error fetching binders:", err);
      return [];
    }
  }

    async function fetchBinderCollages(binderId) {
    if (!binderId) return [];
    try {
      const res = await fetch(
        `${API_BASE}/api/binders/${encodeURIComponent(binderId)}/collages`
      );
      if (!res.ok) {
        console.error("Failed to fetch binder collages", res.status);
        return [];
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error("Error fetching binder collages", err);
      return [];
    }
  }


  async function updateCollageVisibility(collageId, visibility) {
    try {
      const res = await fetch(`${API_BASE}/api/collages/${encodeURIComponent(collageId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility }),
      });
      if (!res.ok) {
        console.error("Failed to update collage", res.status);
        alert("Failed to update collage.");
        return null;
      }
      return await res.json();
    } catch (err) {
      console.error("Error updating collage:", err);
      alert("Network error while updating collage.");
      return null;
    }
  }

  async function deleteCollage(collageId) {
    const go = confirm("Delete this collage permanently?");
    if (!go) return false;

    try {
      const res = await fetch(`${API_BASE}/api/collages/${encodeURIComponent(collageId)}`, {
        method: "DELETE",
      });

      if (res.status === 204) {
        return true;
      }

      if (!res.ok) {
        console.error("Failed to delete collage", res.status);
        alert("Failed to delete collage.");
        return false;
      }

      return true;
    } catch (err) {
      console.error("Error deleting collage:", err);
      alert("Network error while deleting collage.");
      return false;
    }
  }

  // each click from a given user increments their personal like count for this collage
  async function toggleLike(collage, context) {
    if (!CURRENT_USER_ID) {
      alert("Login to like collages.");
      if (window.forceLoginPanel) window.forceLoginPanel();
      return null;
    }

    try {
      const res = await fetch(`${API_BASE}/api/collages/${encodeURIComponent(collage.id)}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: CURRENT_USER_ID }),
      });

      if (!res.ok) {
        console.error("Failed to toggle like", res.status);
        return null;
      }

      const data = await res.json();
      collage.likeCount     = data.likeCount;
      collage.likedByViewer = !!data.liked;
      return data;
    } catch (err) {
      console.error("Error toggling like", err);
      return null;
    }
  }

  // ----- RENDER GRID -----

   function renderGrid(gridEl, collages, binderCoverMap) {
    gridEl.innerHTML = "";

    if (!collages.length) {
      const empty = document.createElement("p");
      empty.className = "public-empty";
      empty.textContent = "No collages yet.";
      gridEl.appendChild(empty);
      return;
    }

    collages.forEach((c) => {
      const item = document.createElement("div");
      item.className = "public-item";
      item.dataset.collageId = c.id;
      item.dataset.owner = c.ownerUserID || "";

      const wrapper = document.createElement("div");
      wrapper.className = "public-thumb-wrapper";

      const img = document.createElement("img");
      img.className = "public-thumb-img";
      img.src = c.imageUrl;
      img.alt = `Collage ${c.id}`;

      // owner displayName chip (bottom-left)
      if (c.ownerDisplayName || c.ownerUserID) {
        const nameChip = document.createElement("div");
        nameChip.className = "public-owner-chip";
        nameChip.textContent = c.ownerDisplayName || c.ownerUserID;
        wrapper.appendChild(nameChip);
      }

      // like count chip (top-left) – only if > 0
      if (typeof c.likeCount === "number" && c.likeCount > 0) {
        const likeChip = document.createElement("div");
        likeChip.className = "public-like-chip";

        const icon = document.createElement("i");
        icon.className = "ri-heart-fill";

        const countSpan = document.createElement("span");
        countSpan.textContent = String(c.likeCount);

        likeChip.appendChild(icon);
        likeChip.appendChild(countSpan);
        wrapper.appendChild(likeChip);
      }

      // 🔹 binder chip (bottom-right) if this collage is a binder cover
      const binderInfo =
        binderCoverMap && binderCoverMap.get && binderCoverMap.get(c.id);

      if (binderInfo && typeof binderInfo.page_count === "number" && binderInfo.page_count > 0) {
        const binderChip = document.createElement("div");
        binderChip.className = "public-binder-chip";

        const icon = document.createElement("i");
        icon.className = "ri-stack-line"; // carousel-ish icon

        const countSpan = document.createElement("span");
        countSpan.textContent = String(binderInfo.page_count);

        binderChip.appendChild(icon);
        binderChip.appendChild(countSpan);
        wrapper.appendChild(binderChip);

        // annotate the item so later we know this card represents a binder
        item.dataset.binderId = binderInfo.id;
        item.dataset.binderPages = String(binderInfo.page_count);
      }

      wrapper.appendChild(img);
      item.appendChild(wrapper);

      item.addEventListener("click", () => {
        let context = "public";
        if (gridEl.id === "private-grid") context = "private";
        if (gridEl.id === "explore-grid") context = "explore";
        if (gridEl.id === "liked-grid")   context = "liked";


        openCollageModal(c, context, binderInfo || null);
      });

      gridEl.appendChild(item);
    });
  }


  // ----- MODAL LOGIC -----

  function applyLikeButtonState(isLiked) {
    if (!collageLikeButton) return;
    const icon = collageLikeButton.querySelector("i");
    collageLikeButton.classList.toggle("is-liked", !!isLiked);
    if (icon) {
      icon.className = isLiked ? "ri-heart-fill" : "ri-heart-line";
    }
  }

    function openCollageModal(collage, context, binderInfo) {
    if (!collageModal || !collageModalImage || !collageModalActions) return;

    collageModalImage.src = collage.imageUrl;
    collageModalImage.alt = `Collage ${collage.id}`;
    collageModalActions.innerHTML = "";

    if (collageOwnerNameEl) {
      collageOwnerNameEl.textContent =
        collage.ownerDisplayName || collage.ownerUserID || "Unknown user";
    }

    // show / hide binder chip in modal + hint
    let hasBinder = false;
    if (collageModalBinderChip) {
      hasBinder =
        binderInfo &&
        typeof binderInfo.page_count === "number" &&
        binderInfo.page_count > 0;

      if (hasBinder) {
        if (binderFlipHintCount) {
          binderFlipHintCount.textContent = String(binderInfo.page_count);
        }
        collageModalBinderChip.style.display = "flex";
      } else {
        collageModalBinderChip.style.display = "none";
      }
    }

    // init flip data (async, non-blocking)
    initBinderFlipForModal(collage, hasBinder ? binderInfo : null).catch(
      (err) => console.error(err)
    );

    applyLikeButtonState(collage.likedByViewer);
  

  

    if (collageLikeButton) {
      collageLikeButton.onclick = async (e) => {
        e.stopPropagation();

        const res = await toggleLike(collage, context);
        if (!res) return;

        const nowLiked = !!res.liked;
        applyLikeButtonState(nowLiked);

        // keep all grids in sync

        if (context === "public") {
          await loadPublic();      // update my public grid
          await loadLiked();       // reflect like/unlike in Liked section
        } else if (context === "private") {
          await loadPrivate();     // update my private grid
          await loadLiked();       // reflect like/unlike in Liked section
        } else if (context === "explore") {
          await loadExplore();     // update Explore chips
          await loadLiked();       // add/remove it from Liked section
        } else if (context === "liked" && !nowLiked) {
          // un-like from Liked → remove from that grid and close
          await loadLiked();
          closeCollageModal();
        }
      };
    }



    if (context === "public") {
      const makePrivateBtn = document.createElement("button");
      makePrivateBtn.className = "buttonmaker small";
      makePrivateBtn.textContent = "Make Private";
      makePrivateBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const updated = await updateCollageVisibility(collage.id, "private");
        if (updated) {
          await loadPublic();
          await loadPrivate();
          closeCollageModal();
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "buttonmaker small";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await deleteCollage(collage.id);
        if (ok) {
          await loadPublic();
          await loadPrivate();
          closeCollageModal();
        }
      });

      collageModalActions.appendChild(makePrivateBtn);
      collageModalActions.appendChild(deleteBtn);
    } else if (context === "private") {
      const makePublicBtn = document.createElement("button");
      makePublicBtn.className = "buttonmaker small";
      makePublicBtn.textContent = "Make Public";
      makePublicBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const updated = await updateCollageVisibility(collage.id, "public");
        if (updated) {
          await loadPublic();
          await loadPrivate();
          closeCollageModal();
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "buttonmaker small";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const ok = await deleteCollage(collage.id);
        if (ok) {
          await loadPrivate();
          await loadPublic();
          closeCollageModal();
        }
      });

      collageModalActions.appendChild(makePublicBtn);
      collageModalActions.appendChild(deleteBtn);
    }

    collageModal.classList.remove("is-hidden");
  }

  function closeCollageModal() {
    if (!collageModal) return;
    collageModal.classList.add("is-hidden");
  

   // stop flip sound when modal closes
    if (flipAudioEl && typeof flipAudioEl.pause === "function") {
      try {
        flipAudioEl.pause();
        flipAudioEl.currentTime = 0;
      } catch (err) {
        console.warn("flipAudioEl pause failed", err);
      }
    }

    // reset flip animation state
    binderFlipState.isAnimating = false;
    if (binderFlipInner) {
      binderFlipInner.classList.remove("is-flipping");
    }
  }

  if (collageModalCloseBtn) {
    collageModalCloseBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeCollageModal();
    });
  }

  if (collageModal) {
    collageModal.addEventListener("click", (e) => {
      if (e.target === collageModal) {
        closeCollageModal();
      }
    });
  }

  if (collageModalInner) {
    collageModalInner.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }


  async function initBinderFlipForModal(collage, binderInfo) {
    // reset if not a binder
    if (!binderInfo || !binderInfo.id || !binderFlipInner) {
      binderFlipState.binderId = null;
      binderFlipState.pages = [];
      binderFlipState.currentIndex = 0;
      binderFlipState.isLoading = false;
      return;
    }

    binderFlipState.binderId = binderInfo.id;
    binderFlipState.isLoading = true;
    binderFlipState.pages = [];
    binderFlipState.currentIndex = 0;

    const pages = await fetchBinderCollages(binderInfo.id);
    binderFlipState.isLoading = false;

    if (!pages.length) {
      binderFlipState.pages = [];
      return;
    }

    binderFlipState.pages = pages;

    // find where this collage sits in that binder
    let startIndex = pages.findIndex((p) => p.id === collage.id);
    if (startIndex < 0) startIndex = 0;

    binderFlipState.currentIndex = startIndex;

    const current = pages[startIndex];
    if (current && current.imageUrl && collageModalImage) {
      collageModalImage.src = current.imageUrl;
      collageModalImage.alt = `Collage page ${startIndex + 1}`;
    }
  }

  function flipBinder(direction) {
    if (!binderFlipInner || !binderBackImage || !collageModalImage) return;
    if (!binderFlipState.binderId) return;
    if (binderFlipState.pages.length <= 1) return;
    if (binderFlipState.isLoading || binderFlipState.isAnimating) return;

    const len = binderFlipState.pages.length;
    let nextIndex = binderFlipState.currentIndex;

    if (direction === "prev") {
      nextIndex = (nextIndex - 1 + len) % len;
    } else {
      // default → next
      nextIndex = (nextIndex + 1) % len;
    }

    const next = binderFlipState.pages[nextIndex];
    if (!next || !next.imageUrl) return;

    binderBackImage.src = next.imageUrl;
    binderBackImage.alt = `Collage page ${nextIndex + 1}`;

     // play local flip sound
    if (flipAudioEl && typeof flipAudioEl.play === "function") {
      try {
        flipAudioEl.currentTime = 0;
        flipAudioEl.play();
      } catch (err) {
        console.warn("flipAudioEl play failed", err);
      }
    }

    binderFlipState.isAnimating = true;
    binderFlipInner.classList.add("is-flipping");

    const onEnd = () => {
      binderFlipInner.classList.remove("is-flipping");
      binderFlipState.isAnimating = false;
      binderFlipState.currentIndex = nextIndex;

      collageModalImage.src = next.imageUrl;
      collageModalImage.alt = `Collage page ${nextIndex + 1}`;

      binderFlipInner.removeEventListener("transitionend", onEnd);
    };

    binderFlipInner.addEventListener("transitionend", onEnd);
  }

  // binder chip → flip forward
  if (collageModalBinderChip && binderFlipInner) {
    collageModalBinderChip.addEventListener("click", (e) => {
      e.stopPropagation();
      flipBinder("next");
    });
  }



  // ----- LOADERS -----

  async function loadPublic() {
    if (!publicGrid || !publicLoading) return;

    publicGrid.innerHTML = "";

    if (!CURRENT_USER_ID) {
      const msg = document.createElement("p");
      msg.className = "public-empty";
      msg.textContent = "Login to see your public collages.";
      publicGrid.appendChild(msg);
      publicLoading.style.display = "none";
      publicLoaded = true;
      return;
    }

    publicLoading.style.display = "flex";

        const collages = await fetchCollages({
      owner: CURRENT_USER_ID,
      visibility: "public",
    });

    // build a map: cover_collage_id -> binder row
    let binderCoverMap = new Map();
    const binders = await fetchBinders({
      owner: CURRENT_USER_ID,
      visibility: "public",
    });
    binders.forEach((b) => {
      if (b.cover_collage_id) {
        binderCoverMap.set(b.cover_collage_id, b);
      }
    });

    renderGrid(publicGrid, collages, binderCoverMap);
    publicLoading.style.display = "none";
    publicLoaded = true;
  }


  async function loadPrivate() {
    if (!privateGrid || !privateLoading) return;

    privateGrid.innerHTML = "";

    if (!CURRENT_USER_ID) {
      const msg = document.createElement("p");
      msg.className = "public-empty";
      msg.textContent = "Login to see your private collages.";
      privateGrid.appendChild(msg);
      privateLoading.style.display = "none";
      privateLoaded = true;
      return;
    }

    privateLoading.style.display = "flex";
    const collages = await fetchCollages({
      owner: CURRENT_USER_ID,
      visibility: "private",
    });

    let binderCoverMap = new Map();
    const binders = await fetchBinders({
      owner: CURRENT_USER_ID,
      visibility: "private",
    });
    binders.forEach((b) => {
      if (b.cover_collage_id) {
        binderCoverMap.set(b.cover_collage_id, b);
      }
    });

    renderGrid(privateGrid, collages, binderCoverMap);
    privateLoading.style.display = "none";
    privateLoaded = true;
  }


  async function loadExplore() {
    if (!exploreGrid || !exploreLoading) return;

    exploreGrid.innerHTML = "";
    exploreLoading.style.display = "flex";

    const collages = await fetchCollages({
      visibility: "public",
    });

    renderGrid(exploreGrid, collages);
    exploreLoading.style.display = "none";
    exploreLoaded = true;
  }

  async function loadLiked() {
    if (!likedGrid || !likedLoading) return;

    likedGrid.innerHTML = "";

    if (!CURRENT_USER_ID) {
      const msg = document.createElement("p");
      msg.className = "public-empty";
      msg.textContent = "Login to see collages you liked.";
      likedGrid.appendChild(msg);
      likedLoading.style.display = "none";
      likedLoaded = true;
      return;
    }

    likedLoading.style.display = "flex";
    const collages = await fetchCollages({
      likedBy: CURRENT_USER_ID,
    });
    renderGrid(likedGrid, collages);
    likedLoading.style.display = "none";
    likedLoaded = true;
  }

  // ----- SECTION VISIBILITY -----

  function hideAllSections() {
    const mainEl = document.querySelector(".library-main");
    if (mainEl) mainEl.classList.remove("no-scroll");
    if (binderSection)  binderSection.style.display  = "none";
    if (publicSection)  publicSection.style.display  = "none";
    if (privateSection) privateSection.style.display = "none";
    if (exploreSection) exploreSection.style.display = "none";
    if (likedSection)   likedSection.style.display   = "none";
    if (profileSection) profileSection.style.display = "none";
  }

  // ----- PROFILE DATA -----

  async function loadProfile() {
    // guest / not logged in
    if (!CURRENT_USER_ID) {
      if (profileDisplayNameText) profileDisplayNameText.textContent = "Guest user";
      if (profileDisplayNameEl)   profileDisplayNameEl.textContent   = "—";
      if (profileEmailEl)         profileEmailEl.textContent         = "guest@example.com";
      if (profileIdEl)            profileIdEl.textContent            = "—";
      if (profileCreatedAtEl)     profileCreatedAtEl.textContent     = "—";
      if (profileTotalEl)         profileTotalEl.textContent         = "0";
      if (profilePublicEl)        profilePublicEl.textContent        = "0";
      if (profilePrivateEl)       profilePrivateEl.textContent       = "0";
      if (profileBioEl)           profileBioEl.textContent           = "—";
      if (profileAvatarInitials)  profileAvatarInitials.textContent  = "CC";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(CURRENT_USER_ID)}`);
      if (!res.ok) {
        console.error("Failed to load profile", res.status);
        return;
      }

      const data  = await res.json();
      const user  = data.user  || {};
      const stats = data.stats || {};

      const displayName =
        user.display_name || user.displayName || "User";

      const email =
        user.email || "";

      const bio =
        user.bio || "";

      const createdRaw =
        user.created_at || user.createdAt || "";

      const createdPretty = createdRaw
        ? String(createdRaw).split(" ")[0]
        : "—";

      const totalCollages   = stats.total   || stats.totalCollages   || 0;
      const publicCollages  = stats.public  || stats.publicCollages  || 0;
      const privateCollages = stats.private || stats.privateCollages || 0;

      if (profileDisplayNameText) profileDisplayNameText.textContent = displayName;
      if (profileDisplayNameEl)   profileDisplayNameEl.textContent   = displayName || "—";
      if (profileEmailEl)         profileEmailEl.textContent         = email || "—";
      if (profileIdEl)            profileIdEl.textContent            = user.id || CURRENT_USER_ID;
      if (profileCreatedAtEl)     profileCreatedAtEl.textContent     = createdPretty;
      if (profileTotalEl)         profileTotalEl.textContent         = String(totalCollages);
      if (profilePublicEl)        profilePublicEl.textContent        = String(publicCollages);
      if (profilePrivateEl)       profilePrivateEl.textContent       = String(privateCollages);
      if (profileBioEl)           profileBioEl.textContent           = bio || "—";

      const initialsSource =
        displayName || user.id || CURRENT_USER_ID || "CC";

      const initials = initialsSource
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      if (profileAvatarInitials) {
        profileAvatarInitials.textContent = initials || "CC";
      }
    } catch (err) {
      console.error("Error loading profile", err);
    }
  }

  // ----- PROFILE: EDIT -----

  let profileEditMode = false;
  let profileInputs = {
    name: null,
    email: null,
    bio: null,
  };
  let profileCancelBtn = null;

  function enterProfileEditMode() {
    if (profileEditMode) return;
    profileEditMode = true;

    if (!profileDisplayNameEl || !profileEmailEl || !profileBioEl) return;

    // create inputs if they don't exist yet
    if (!profileInputs.name) {
      profileInputs.name = document.createElement("input");
      profileInputs.name.type = "text";
      profileInputs.name.className = "profile-input";
    }
    if (!profileInputs.email) {
      profileInputs.email = document.createElement("input");
      profileInputs.email.type = "email";
      profileInputs.email.className = "profile-input";
    }
    if (!profileInputs.bio) {
      profileInputs.bio = document.createElement("textarea");
      profileInputs.bio.rows = 3;
      profileInputs.bio.className = "profile-input";
    }

    // set current values
    profileInputs.name.value =
      profileDisplayNameEl.textContent === "—" ? "" : profileDisplayNameEl.textContent.trim();
    profileInputs.email.value =
      profileEmailEl.textContent === "—" ? "" : profileEmailEl.textContent.trim();
    profileInputs.bio.value =
      profileBioEl.textContent === "—" ? "" : profileBioEl.textContent.trim();

    // hide text dd's
    profileDisplayNameEl.style.display = "none";
    profileEmailEl.style.display = "none";
    profileBioEl.style.display = "none";

    // insert inputs after the dd's
    profileDisplayNameEl.parentNode.appendChild(profileInputs.name);
    profileEmailEl.parentNode.appendChild(profileInputs.email);
    profileBioEl.parentNode.appendChild(profileInputs.bio);

    // change button text
    if (manageAccountBtn) manageAccountBtn.textContent = "Save profile";

    // add Cancel button if not there
    if (!profileCancelBtn) {
      profileCancelBtn = document.createElement("button");
      profileCancelBtn.className = "buttonmaker small";
      profileCancelBtn.textContent = "Cancel";
      const footer = document.querySelector(".profile-footer");
      const logoutBtn = document.getElementById("profile-logout");
      if (footer && logoutBtn) {
        footer.insertBefore(profileCancelBtn, logoutBtn);
      }
      profileCancelBtn.addEventListener("click", (e) => {
        e.preventDefault();
        exitProfileEditMode(true); // true = discard changes
      });
    }
  }

  function exitProfileEditMode(discard) {
    if (!profileEditMode) return;
    profileEditMode = false;

    // remove inputs from DOM
    Object.values(profileInputs).forEach((input) => {
      if (input && input.parentNode) {
        input.parentNode.removeChild(input);
      }
    });

    // show text dd's again
    if (profileDisplayNameEl) profileDisplayNameEl.style.display = "";
    if (profileEmailEl)       profileEmailEl.style.display       = "";
    if (profileBioEl)         profileBioEl.style.display         = "";

    if (manageAccountBtn) manageAccountBtn.textContent = "Manage account";

    // if discard = true, reload from server to reset any temporary changes
    if (discard) {
      loadProfile();
    }
  }

  if (manageAccountBtn) {
    manageAccountBtn.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!CURRENT_USER_ID) {
        alert("Login to manage your profile.");
        if (window.forceLoginPanel) window.forceLoginPanel();
        return;
      }

      // first click → enter edit mode
      if (!profileEditMode) {
        enterProfileEditMode();
        return;
      }

      // second click (while in edit mode) → save
      const payload = {
        display_name: profileInputs.name.value.trim(),
        email: profileInputs.email.value.trim(),
        bio: profileInputs.bio.value.trim(),
      };

      try {
        const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(CURRENT_USER_ID)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          console.error("Failed to update profile", res.status);
          alert("Failed to update profile.");
          return;
        }

        await loadProfile();
        exitProfileEditMode(false); // false = keep saved values
      } catch (err) {
        console.error("Error updating profile", err);
        alert("Network error while updating profile.");
      }
    });
  }


  // ----- TABS -----

  const tabs = [binderTabBtn, publicTabBtn, privateTabBtn, exploreTabBtn, likedTabBtn].filter(Boolean);

  function setActiveTab(tabBtn) {
    tabs.forEach((btn) => btn && btn.classList.remove("active"));
    if (tabBtn) tabBtn.classList.add("active");
  }

  if (binderTabBtn) {
    binderTabBtn.addEventListener("click", (e) => {
      e.preventDefault();
      setActiveTab(binderTabBtn);
      setTopBarForLibrary();

      hideAllSections();
      if (binderSection) binderSection.style.display = "flex";

      window.scrollTo(0, 0);
    });
  }

  if (publicTabBtn) {
    publicTabBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      setActiveTab(publicTabBtn);
      setTopBarForLibrary();

      hideAllSections();
      if (publicSection) publicSection.style.display = "flex";

      if (!publicLoaded) {
        await loadPublic();
      }

      window.scrollTo(0, 0);
    });
  }

  if (privateTabBtn) {
    privateTabBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      setActiveTab(privateTabBtn);
      setTopBarForLibrary();

      hideAllSections();
      if (privateSection) privateSection.style.display = "flex";

      if (!privateLoaded) {
        await loadPrivate();
      }

      window.scrollTo(0, 0);
    });
  }

  if (exploreTabBtn) {
    exploreTabBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      setActiveTab(exploreTabBtn);
      setTopBarForExplore();

      hideAllSections();
      if (exploreSection) exploreSection.style.display = "flex";

      if (!exploreLoaded) {
        await loadExplore();
      }

      window.scrollTo(0, 0);
    });
  }

  if (likedTabBtn) {
    likedTabBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      setActiveTab(likedTabBtn);
      setTopBarForLiked();

      hideAllSections();
      if (likedSection) likedSection.style.display = "flex";

      if (!likedLoaded) {
        await loadLiked();
      }

      window.scrollTo(0, 0);
    });
  }

  // ----- BOTTOM NAV -----

  function setActiveNav(navItem) {
    const items = document.querySelectorAll(".bottom-nav-item");
    items.forEach((el) => el.classList.remove("active"));
    if (navItem) navItem.classList.add("active");
  }

  if (homeNavItem) {
    homeNavItem.addEventListener("click", (e) => {
      e.preventDefault();

      setActiveNav(homeNavItem);
      // go to main canvas editor
      window.location.href = "index.html";
    });
  }

  if (exploreNavItem && exploreSection) {
    exploreNavItem.addEventListener("click", (e) => {
      e.preventDefault();

      setActiveNav(exploreNavItem);
      setTopBarForExplore();
      tabs.forEach((t) => t.classList.remove("active"));

      hideAllSections();
      exploreSection.style.display = "flex";

      if (!exploreLoaded) {
        loadExplore();
      }

      window.scrollTo(0, 0);
    });
  }

  if (libraryNavItem && publicSection) {
    libraryNavItem.addEventListener("click", (e) => {
      e.preventDefault();

      setActiveNav(libraryNavItem);
      setTopBarForLibrary();
      setActiveTab(publicTabBtn);

      hideAllSections();
      publicSection.style.display = "flex";

      if (!publicLoaded) {
        loadPublic();
      }

      window.scrollTo(0, 0);
    });
  }

  if (likedNavItem && likedSection) {
    likedNavItem.addEventListener("click", (e) => {
      e.preventDefault();

      setActiveNav(likedNavItem);
      setTopBarForLiked();
      tabs.forEach((t) => t.classList.remove("active"));

      hideAllSections();
      likedSection.style.display = "flex";

      if (!likedLoaded) {
        loadLiked();
      }

      window.scrollTo(0, 0);
    });
  }

  if (profileNavItem && profileSection) {
    profileNavItem.addEventListener("click", (e) => {
      e.preventDefault();

      setActiveNav(profileNavItem);
      setTopBarForProfile();
      tabs.forEach((t) => t.classList.remove("active"));

      hideAllSections();

      const mainEl = document.querySelector(".library-main");
      if (mainEl) mainEl.classList.add("no-scroll");

      profileSection.style.display = "flex";

      // refresh profile info when user opens it
      loadProfile();

      window.scrollTo(0, 0);
    });
  }

  // ----- PROFILE: LOG OUT -----

  const logoutBtn = document.getElementById("profile-logout");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();

      try {
        localStorage.removeItem("cc_user");
      } catch (err) {
        console.warn("[logout] failed to clear localStorage", err);
      }

      CURRENT_USER_ID = null;
      IS_LOGGED_IN = false;
      window.CURRENT_USER_ID = null;

      // go back to index, auth overlay will show again
      window.location.href = "index.html";
    });
  }

  // ----- INITIAL LOAD -----

  setTopBarForLibrary();
  setActiveTab(publicTabBtn);

  // mark Library nav as active
  (function () {
    const items = document.querySelectorAll(".bottom-nav-item");
    items.forEach((el) => el.classList.remove("active"));
    if (libraryNavItem) {
      libraryNavItem.classList.add("active");
    }
  })();

  hideAllSections();
  if (publicSection) publicSection.style.display = "flex";

  // load my public collages on first open
  loadPublic();
  loadProfile();
});
