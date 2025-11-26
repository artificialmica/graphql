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
  if (json.errors) throw new Error("GraphQL error");
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
    const msg = document.getElementById("login-message");

    msg.textContent = "Signing in...";

    try {
      const credentials = btoa(`${id}:${pw}`);

      const res = await fetch(API_SIGNIN, {
        method: "POST",
        headers: { "Authorization": `Basic ${credentials}` }
      });

      if (!res.ok) throw new Error();

      const token = await res.json();
      localStorage.setItem("jwt", token);

      renderProfile();
    } catch {
      msg.textContent = "Login failed.";
    }
  };
}


function drawXPGraph(container, points) {
  const width = 900;
  const height = 260;
  const padding = 40;

  if (!points.length) {
    container.innerHTML = "<p>No XP yet.</p>";
    return;
  }

  const maxX = points.length - 1;
  const maxY = Math.max(...points.map(p => p.y));

  const scaleX = (x) => padding + (x / maxX) * (width - padding * 2);
  const scaleY = (y) => height - padding - (y / maxY) * (height - padding * 2);

  let path = "";
  points.forEach((p, i) => {
    const x = scaleX(p.x);
    const y = scaleY(p.y);
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  container.innerHTML = `
    <svg width="${width}" height="${height}">
      <path d="${path}" stroke="#d552f4" stroke-width="3" fill="none" stroke-linecap="round" />
      <rect id="xp-hover" width="${width}" height="${height}" fill="transparent"></rect>
      <text id="xp-tip" visibility="hidden" fill="white" font-size="12"></text>
    </svg>
  `;

  const svg = container.querySelector("svg");
  const hover = container.querySelector("#xp-hover");
  const tip = container.querySelector("#xp-tip");

  hover.addEventListener("mousemove", (evt) => {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());

    let closest = points[0];
    let minDist = Infinity;
    const mouseX = cursor.x;

    points.forEach(p => {
      const px = scaleX(p.x);
      const dist = Math.abs(px - mouseX);
      if (dist < minDist) { closest = p; minDist = dist; }
    });

    tip.textContent = `${closest.y} XP — ${closest.date}`;
    let tx = cursor.x + 10;
    let ty = cursor.y - 10;

    const textWidth = tip.getComputedTextLength();
    if (tx + textWidth > width - padding) tx = width - padding - textWidth;
    if (tx < padding) tx = padding;
    if (ty < padding) ty = padding + 10;

    tip.setAttribute("x", tx);
    tip.setAttribute("y", ty);
    tip.setAttribute("visibility", "visible");
  });

  hover.addEventListener("mouseout", () => {
    tip.setAttribute("visibility", "hidden");
  });
}

function drawPassFailGraph(container, pass, fail) {
  const total = pass + fail || 1;
  const percent = (pass / total);
  const angle = percent * 360;

  const radius = 80;
  const cx = 100;
  const cy = 100;

  function pointAt(angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad)
    };
  }

  const end = pointAt(angle);
  const largeArc = angle > 180 ? 1 : 0;

  container.innerHTML = `
    <svg width="200" height="200">

      <circle
        cx="${cx}" cy="${cy}" r="${radius}"
        fill="rgba(255,255,255,0.15)"
        stroke="white" stroke-width="2"
      />

      <path d="
        M ${cx} ${cy - radius}
        A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}
        L ${cx} ${cy}
      "
      fill="#e09bff" />

      <text
        x="${cx}" y="${cy + 5}"
        font-size="22" fill="white"
        text-anchor="middle"
      >
        ${(percent * 100).toFixed(0)}%
      </text>
    </svg>
  `;
}

function drawAuditGraph(container, ratio) {
  const scaled = Math.min(ratio / 2, 1);   // 2.0 = full bar
  const percent = Math.round(scaled * 100);

  container.innerHTML = `
    <div class="audit-wrapper">
      <div class="audit-track">
        <div class="audit-fill" style="width:${percent}%;"></div>
      </div>

      <div class="audit-value">${ratio.toFixed(2)}</div>
    </div>
  `;
}


async function renderProfile() {
  const html = await fetch("index.html").then(res => res.text());
  // document.body.innerHTML = html; this fucking line ruined everything ffs

  const userData = await graphqlRequest(USER_QUERY);
  const xpData = await graphqlRequest(XP_QUERY);
  const pfData = await graphqlRequest(PASS_FAIL_QUERY);

  const user = userData.user[0];
  const xp = xpData.transaction;
  const passCount = pfData.progress.filter(x => x.grade === 1).length;
  const failCount = pfData.progress.filter(x => x.grade === 0).length;

  document.getElementById("welcome-text").textContent =
    `Welcome, ${user.firstName} ${user.lastName}`;

  const statsList = document.getElementById("stats-list");
  statsList.innerHTML = `
    <li><strong>Username:</strong> ${user.login}</li>
    <li><strong>Email:</strong> ${user.email}</li>
    <li><strong>Audit Ratio:</strong> ${user.auditRatio.toFixed(2)}</li>
    <li><strong>Total XP:</strong> ${xp.reduce((a,b)=>a+b.amount,0)}</li>
    <li><strong>Passes:</strong> ${passCount}</li>
    <li><strong>Fails:</strong> ${failCount}</li>
  `;

  const sortedXP = xp.sort((a,b)=> new Date(a.createdAt) - new Date(b.createdAt));

  const points = sortedXP.map((entry, i) => ({
    x: i,
    y: entry.amount,
    date: new Date(entry.createdAt).toLocaleString()
  }));

  drawXPGraph(document.getElementById("xp-graph"), points);
  drawPassFailGraph(document.getElementById("passfail-graph"), passCount, failCount);
  drawAuditGraph(document.getElementById("audit-graph"), user.auditRatio);
}

if (localStorage.getItem("jwt")) {
  renderProfile();
} else {
  renderLogin();
}
