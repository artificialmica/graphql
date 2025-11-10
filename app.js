function renderLogin() {
  const app = document.getElementById("app");

  app.innerHTML = `
    <div class="login-container">
      <h1>Login˚ʚ♡ɞ˚</h1>
      <form id="login-form">
        <label for="login-id">Username or Email</label>
        <input type="text" id="login-id" required>

        <label for="login-password">Password</label>
        <input type="password" id="login-password" required>

        <button type="submit">Sign In</button>
      </form>
      <p id="login-message"></p>
    </div>
  `;

  const form = document.getElementById("login-form");
  const msg = document.getElementById("login-message");

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("login-id").value.trim();
    const password = document.getElementById("login-password").value;

    msg.textContent = "Signing in...";
    msg.style.color = "#93c5fd";

    try {
      const credentials = btoa(`${id}:${password}`);

      const res = await fetch("https://learn.reboot01.com/api/auth/signin", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${credentials}`
        }
      });

      if (!res.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await res.json();
      console.log("Signin response:", data);

      // --- adjust this key after seeing your real response ---
      const token = data.jwt || data.token || data; // guess + fallback

      if (!token) {
        throw new Error("Token not found in response");
      }

      localStorage.setItem("jwt", token);
      msg.style.color = "#a7f3d0";
      msg.textContent = "Login successful!";
      
      // TODO: next step -> renderProfile();
    } catch (err) {
      console.error(err);
      msg.style.color = "#f87171";
      msg.textContent = "Login failed. Please check your credentials.";
    }
  });
}

function init() {
  renderLogin();
}

init();
