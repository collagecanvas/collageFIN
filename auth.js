// frontend/auth.js
// Simple email + password auth wiring for Collage Canvas

export function initAuth() {
  const authSection   = document.getElementById("authentication");
  const loginForm     = document.getElementById("login-form");
  const signupForm    = document.getElementById("signup-form");
  const authTabs      = document.getElementById("auth-tabs");
  const loginTabBtn   = document.getElementById("auth-tab-login");
  const signupTabBtn  = document.getElementById("auth-tab-signup");
  const skipButton    = document.getElementById("auth-skip");
  const authErrorBox  = document.getElementById("auth-error");

  const GOOGLE_CLIENT_ID =
  window.location.hostname === "collagecanvas.github.io"
    ? "982146144346-9kl9vc6egf6eu74071v9cgkgdfn6cps1.apps.googleusercontent.com" //gitpage
    : "982146144346-c3duna21jgkfvlfsi2jllf0lri5vhe54.apps.googleusercontent.com"; //localhost
  
  

  // ---------- Helpers ----------

  function showError(msg) {
    if (!authErrorBox) return;
    authErrorBox.textContent = msg;
    authErrorBox.hidden = false;
    authErrorBox.style.display = "block";
  }

  function clearError() {
    if (!authErrorBox) return;
    authErrorBox.textContent = "";
    authErrorBox.style.display = "none";
    authErrorBox.hidden = true;
  }

  // ---------- Show / Hide Password (RemixIcon) ----------

  document.querySelectorAll(".toggle-password").forEach(icon => {
    icon.addEventListener("click", () => {
      const targetId = icon.getAttribute("data-target");
      const input = document.getElementById(targetId);

      if (!input) return;

      if (input.type === "password") {
        input.type = "text";
        icon.classList.remove("ri-eye-line");
        icon.classList.add("ri-eye-off-line");
      } else {
        input.type = "password";
        icon.classList.remove("ri-eye-off-line");
        icon.classList.add("ri-eye-line");
      }
    });
  });

  function switchToLogin() {
    if (loginTabBtn)  loginTabBtn.classList.add("active");
    if (signupTabBtn) signupTabBtn.classList.remove("active");

    const loginPanel  = document.getElementById("auth-panel-login");
    const signupPanel = document.getElementById("auth-panel-signup");

    if (loginPanel)  loginPanel.hidden = false;
    if (signupPanel) signupPanel.hidden = true;

    clearError();
  }

  function switchToSignup() {
    if (loginTabBtn)  loginTabBtn.classList.remove("active");
    if (signupTabBtn) signupTabBtn.classList.add("active");

    const loginPanel  = document.getElementById("auth-panel-login");
    const signupPanel = document.getElementById("auth-panel-signup");

    if (loginPanel)  loginPanel.hidden = true;
    if (signupPanel) signupPanel.hidden = false;

    clearError();
  }

  function enterAppAsGuest() {
    if (typeof window.setLoggedOut === "function") {
      window.setLoggedOut();
    }
    if (authSection) authSection.classList.add("is-hidden");
  }

  function enterAppAsLoggedIn(user) {
    try {
      localStorage.setItem("cc_user", JSON.stringify(user));
    } catch (err) {
      console.warn("[auth] failed to store user to localStorage", err);
    }

    if (typeof window.setLoggedInUser === "function") {
      window.setLoggedInUser(user);
    }

    if (authSection) authSection.classList.add("is-hidden");
  }

  // ---------- Tab switching ----------

  if (loginTabBtn) {
    loginTabBtn.addEventListener("click", () => {
      switchToLogin();
    });
  }

  if (signupTabBtn) {
    signupTabBtn.addEventListener("click", () => {
      switchToSignup();
    });
  }

  // ---------- Skip for now (guest mode) ----------

  if (skipButton) {
    skipButton.addEventListener("click", e => {
      e.preventDefault();
      clearError();
      console.log("[auth] skipping login, continue as guest");
      enterAppAsGuest();
    });
  }

  // ---------- Login submit (email/password) ----------

  if (loginForm) {
    loginForm.addEventListener("submit", async e => {
      e.preventDefault();
      clearError();

      const emailInput    = document.getElementById("login-email");
      const passwordInput = document.getElementById("login-password");

      const email    = emailInput ? emailInput.value.trim() : "";
      const password = passwordInput ? passwordInput.value : "";

      if (!email || !password) {
        showError("Please fill in both email and password.");
        return;
      }

      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          let msg = "Login failed. Check your email and password.";
          try {
            const data = await res.json();
            if (data && data.error) msg = data.error;
          } catch (_) {}
          showError(msg);
          return;
        }

        const user = await res.json();
        console.log("[auth] logged in user:", user);
        enterAppAsLoggedIn(user);
      } catch (err) {
        console.error("[auth] login error:", err);
        showError("Network error while logging in.");
      }
    });
  }

  // ---------- Signup submit (email/password) ----------

  if (signupForm) {
    signupForm.addEventListener("submit", async e => {
      e.preventDefault();
      clearError();

      const idInput    = document.getElementById("signup-identifier");
      const passInput  = document.getElementById("signup-password");
      const pass2Input = document.getElementById("signup-password-confirm");

      const identifier = idInput ? idInput.value.trim() : "";
      const password   = passInput ? passInput.value : "";
      const password2  = pass2Input ? pass2Input.value : "";

      const email = identifier;

      if (!email || !password || !password2) {
        showError("Please fill in all fields.");
        return;
      }
      if (password !== password2) {
        showError("Passwords do not match.");
        return;
      }
      if (password.length < 4) {
        showError("Password must be at least 4 characters.");
        return;
      }

      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          let msg = "Sign up failed.";
          try {
            const data = await res.json();
            if (data && data.error) msg = data.error;
          } catch (_) {}
          showError(msg);
          return;
        }

        const user = await res.json();
        console.log("[auth] signed up user:", user);
        enterAppAsLoggedIn(user);
      } catch (err) {
        console.error("[auth] signup error:", err);
        showError("Network error while signing up.");
      }
    });
  }

  

  // ---------- Google Login / Signup (popup) ----------

  // const googleLoginBtn  = document.getElementById("login-google");
  // const googleSignupBtn = document.getElementById("signup-google");

  // async function startGoogleFlow(mode) {
  //   console.log("[auth] startGoogleFlow mode =", mode);

  //   if (!window.google || !google.accounts || !google.accounts.id) {
  //     console.error("[auth] Google Identity Services SDK not loaded");
  //     showError("Google sign-in is currently unavailable. Please try again later.");
  //     return;
  //   }

  //   google.accounts.id.initialize({
  //     client_id: GOOGLE_CLIENT_ID,
  //     callback: async (response) => {
  //       console.log("[auth] GIS callback, has credential =", !!response?.credential);

  //       const credential = response.credential;

  //       // --- CASE 1: running on GitHub Pages → frontend-only login ---
  //       if (window.location.hostname === "collagecanvas.github.io") {
  //         try {
  //           // decode JWT payload (NOT secure, but fine for demo-only UX)
  //           const payload = JSON.parse(
  //             atob(credential.split(".")[1] || "")
  //           );

  //           const user = {
  //             id: "google_" + payload.sub,
  //             email: payload.email,
  //             displayName: payload.name || payload.email || "Google user",
  //             avatarUrl: payload.picture || null,
  //           };

  //           console.log("[auth] frontend-only Google user =", user);
  //           enterAppAsLoggedIn(user);
  //         } catch (err) {
  //           console.error("[auth] failed to decode Google credential", err);
  //           showError("Google sign-in failed (decode error).");
  //         }
  //         return;
  //       }

  //       // --- CASE 2: running on localhost:4000 → use real backend ---
  //       try {
  //         const res = await fetch("/api/auth/google", {
  //           method: "POST",
  //           headers: { "Content-Type": "application/json" },
  //           body: JSON.stringify({ credential, mode }),
  //         });

  //         console.log("[auth] /api/auth/google status =", res.status);

  //         if (!res.ok) {
  //           showError("Google sign-in failed.");
  //           return;
  //         }

  //         const data = await res.json();
  //         if (!data.user) {
  //           showError("Google sign-in failed.");
  //           return;
  //         }

  //         enterAppAsLoggedIn(data.user);
  //       } catch (err) {
  //         console.error("[auth] google error", err);
  //         showError("Network error during Google sign-in.");
  //       }
  //     },
  //     ux_mode: "popup", 
  //     auto_select: false,
  //     // The use_fedcm_for_prompt parameter is removed to enable FedCM (the new standard).
  //   });

  //   google.accounts.id.prompt();
  // }
  
  // if (googleLoginBtn) {
  //   googleLoginBtn.addEventListener("click", (e) => {
  //     e.preventDefault();
  //     startGoogleFlow("login");
  //   });
  // }

  // if (googleSignupBtn) {
  //   googleSignupBtn.addEventListener("click", (e) => {
  //     e.preventDefault();
  //     startGoogleFlow("signup");
  //   });
  // }


let isGoogleInitialized = false;

  // This function sets up the GIS client, but only runs if the 'google' object exists.
  function initializeGoogleClient() {
    if (isGoogleInitialized || !window.google || !google.accounts || !google.accounts.id) {
        return;
    }
    isGoogleInitialized = true;
    
    // The core initialization that was previously inside startGoogleFlow
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response) => {
        console.log("[auth] GIS callback, has credential =", !!response?.credential);

        const credential = response.credential;
        const mode = "login"; 

        if (window.location.hostname === "collagecanvas.github.io") {
          try {
            const payload = JSON.parse(atob(credential.split(".")[1] || ""));
            const user = {
              id: "google_" + payload.sub,
              email: payload.email,
              displayName: payload.name || payload.email || "Google user",
              avatarUrl: payload.picture || null,
            };
            enterAppAsLoggedIn(user);
          } catch (err) {
            console.error("[auth] failed to decode Google credential", err);
            showError("Google sign-in failed (decode error).");
          }
          return;
        }

        try {
          const res = await fetch("/api/auth/google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential, mode }),
          });

          console.log("[auth] /api/auth/google status =", res.status);

          if (!res.ok) {
            showError("Google sign-in failed.");
            return;
          }

          const data = await res.json();
          if (!data.user) {
            showError("Google sign-in failed.");
            return;
          }

          enterAppAsLoggedIn(data.user);
        } catch (err) {
          console.error("[auth] google error", err);
          showError("Test Google sign-in.");
        }
      },
      ux_mode: "popup", 
      auto_select: false,
    });
  }

  // Expose the function globally so the HTML 'onload' can call it.
  window.initializeGoogleAuth = initializeGoogleClient;

  // ---------- Google Login / Signup (popup) ----------

  const googleLoginBtn  = document.getElementById("login-google");
  const googleSignupBtn = document.getElementById("signup-google");

  // This function is called on button click
  async function startGoogleFlow(mode) {
    console.log("[auth] startGoogleFlow mode =", mode);
    
    // Attempt to initialize just before prompting, in case the onload fired first.
    initializeGoogleClient();

    if (!window.google || !google.accounts || !google.accounts.id) {
      showError("Google sign-in is currently unavailable. Please try again later.");
      return;
    }

    // Only call prompt(), as initialize() is now separate.
    google.accounts.id.prompt();
  }
  
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startGoogleFlow("login");
    });
  }

  if (googleSignupBtn) {
    googleSignupBtn.addEventListener("click", (e) => {
      e.preventDefault();
      startGoogleFlow("signup");
    });
  }


  // default state: show login tab
  switchToLogin();
}


// if user not login but already create collage, it will force them to login

window.forceLoginPanel = function () {
  // show the auth overlay
  const authSection = document.getElementById("authentication");
  if (authSection) authSection.classList.remove("is-hidden");

  // switch to login tab
  const loginPanel  = document.getElementById("auth-panel-login");
  const signupPanel = document.getElementById("auth-panel-signup");

  const loginTabBtn  = document.getElementById("auth-tab-login");
  const signupTabBtn = document.getElementById("auth-tab-signup");

  if (loginTabBtn) loginTabBtn.classList.add("active");
  if (signupTabBtn) signupTabBtn.classList.remove("active");

  if (loginPanel)  loginPanel.hidden = false;
  if (signupPanel) signupPanel.hidden = true;
};