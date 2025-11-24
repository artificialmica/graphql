const API_SIGNIN = "https://learn.reboot01.com/api/auth/signin";
const API_GRAPHQL = "https://learn.reboot01.com/api/graphql-engine/v1/graphql";

const USER_QUERY = `
{
  user {
    firstName
    lastName
    login
    email
    auditRatio
  }
}
`;

const XP_QUERY = `
{
  transaction(where: { type: { _eq: "xp" }}) {
    amount
    createdAt
  }
}
`;

const PASS_FAIL_QUERY = `
{
  progress {
    grade
  }
}
`;

async function graphqlRequest(query) {
  const token = localStorage.getItem("jwt");

  const res = await fetch(API_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({ query })
  });

  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

function renderLogin() {
  document.body.innerHTML = `
    <div class="login-container">
      <h1>Login˚ʚ♡ɞ˚</h1>

      <label>Username / Email</label>
      <input id="login-id">

      <label>Password</label>
      <input id="login-password" type="password">

      <button id="login-btn">Login</button>

      <p id="login-message"></p>
    </div>
  `;

  document.getElementById("login-btn").onclick = async () => {
    const id = document.getElementById("login-id").value.trim();
    const pw = document.getElementById("login-password").value;

    try {
      const credentials = btoa(`${id}:${pw}`);

      const res = await fetch(API_SIGNIN, {
        method: "POST",
        headers: { "Authorization": `Basic ${credentials}` }
      });

      if (!res.ok) throw new Error();

      const token = await res.json();
      localStorage.setItem("jwt", token);

      location.reload();
    } catch {
      document.getElementById("login-message").textContent =
        "Invalid credentials.";
    }
  };
}


// --- XP LINE GRAPH ---
function drawXPGraph(container, points) {
  const width = 900;
  const height = 250;
  const padding = 40;

  if (!points.length) {
    container.innerHTML = "<p>No XP yet.</p>";
    return;
  }

  const maxX = points.length - 1;
  const maxY = Math.max(...points.map(p => p.y));

  const scaleX = (x) => padding + (x / maxX) * (width - padding * 2);
  const scaleY = (y) =>
    height - padding - (y / maxY) * (height - padding * 2);

  let path = "";
  points.forEach((p, i) => {
    const x = scaleX(p.x);
    const y = scaleY(p.y);
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  container.innerHTML = `
    <svg width="${width}" height="${height}">
      <path d="${path}"
        stroke="#d552f4"
        stroke-width="3"
        fill="none"
        stroke-linecap="round"/>
    </svg>
  `;
}

// --- PASS/FAIL PIE CHART ---
function drawPassFailGraph(container, pass, fail) {
  const total = pass + fail || 1;
  const percent = Math.round((pass / total) * 100);

  container.innerHTML = `
    <svg width="200" height="200" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16"
        stroke="#ffffff55" stroke-width="2" fill="none"/>

      <path d="
        M 18 2
        A 16 16 0 ${percent > 50 ? 1 : 0} 1
        ${18 + 16 * Math.sin(2 * Math.PI * percent / 100)}
        ${18 - 16 * Math.cos(2 * Math.PI * percent / 100)}
      "
      stroke="#e09bff" stroke-width="3" fill="none"/>

      <text x="18" y="22"
        font-size="10" fill="white" text-anchor="middle">
        ${percent}%
      </text>
    </svg>
  `;
}

// --- AUDIT BAR ---
function drawAuditBar(container, ratio) {
  const r = ratio.toFixed(2);
  const percent = Math.min((ratio / 2.0) * 100, 100);

  container.innerHTML = `
    <div class="audit-wrapper">
      <div class="audit-track">
        <div class="audit-fill" style="width:${percent}%"></div>
      </div>
      <div class="audit-value">${r}</div>
    </div>
  `;
}

async function renderProfile() {
  const token = localStorage.getItem("jwt");
  if (!token) return renderLogin();

  // HTML structure is already present → do NOT rewrite body
  const app = document.getElementById("app");

  document.getElementById("welcome-text").textContent = "Loading...";

  try {
    const userData = await graphqlRequest(USER_QUERY);
    const xpData = await graphqlRequest(XP_QUERY);
    const pfData = await graphqlRequest(PASS_FAIL_QUERY);

    const user = userData.user[0];
    const xp = xpData.transaction;
    const passCount = pfData.progress.filter(p => p.grade === 1).length;
    const failCount = pfData.progress.filter(p => p.grade === 0).length;

    // Update welcome bar
    document.getElementById("welcome-text").textContent =
      `Welcome, ${user.firstName} ${user.lastName}`;

    // Sidebar stats
    document.getElementById("stats-list").innerHTML = `
      <li><strong>Username:</strong> ${user.login}</li>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>Audit Ratio:</strong> ${user.auditRatio.toFixed(2)}</li>
      <li><strong>Total XP:</strong> ${
        xp.reduce((a,b)=>a+b.amount, 0)
      }</li>
      <li><strong>Passes:</strong> ${passCount}</li>
      <li><strong>Fails:</strong> ${failCount}</li>
    `;

    // XP graph data
    const sortedXP = xp.sort(
      (a,b) => new Date(a.createdAt) - new Date(b.createdAt)
    );

    const points = sortedXP.map((e,i)=>({ x:i, y:e.amount }));

    // Draw graphs
    drawXPGraph(document.getElementById("xp-graph"), points);
    drawPassFailGraph(document.getElementById("passfail-graph"), passCount, failCount);
    drawAuditBar(document.getElementById("audit-graph"), user.auditRatio);

  } catch (err) {
    console.error(err);
    renderLogin();
  }
}

if (localStorage.getItem("jwt")) {
  renderProfile();
} else {
  renderLogin();
}
