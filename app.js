const API_SIGNIN = "https://learn.reboot01.com/api/auth/signin";
const API_GRAPHQL = "https://learn.reboot01.com/api/graphql-engine/v1/graphql";

// Basic query - user info
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

// Query with arguments - filter by type
const XP_QUERY = `
{
  transaction(where: { type: { _eq: "xp" }}) {
    amount
    createdAt
    path
  }
}
`;

// Basic query - progress data
const PASS_FAIL_QUERY = `
{
  progress {
    grade
    createdAt
  }
}
`;

// Nested query - demonstrates querying related tables
const PROGRESS_DETAIL_QUERY = `
{
  progress(limit: 10, order_by: { createdAt: desc }, where: { path: { _is_null: false }}) {
    id
    grade
    createdAt
    path
    user {
      login
      firstName
    }
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
  if (json.errors) {
    console.error("GraphQL errors:", json.errors);
    throw new Error("GraphQL error: " + JSON.stringify(json.errors));
  }
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
    } catch (err) {
      console.error("Login error:", err);
      msg.textContent = "Login failed.";
    }
  };
}

function drawXPGraph(container, points) {
  const width = container.clientWidth || 900;
  const height = container.clientHeight || 280;
  const paddingTop = 20;
  const paddingBottom = 20;
  const paddingLeft = 5;
  const paddingRight = 5;

  if (!points.length) {
    container.innerHTML = "<p>No XP yet.</p>";
    return;
  }

  const maxX = points.length - 1;
  const allYValues = points.map(p => p.y);
  const maxY = Math.max(...allYValues);
  const minY = Math.min(...allYValues);
  
  // Add 5% padding to top and bottom for better visualization
  const yRange = maxY - minY;
  const yPadding = yRange * 0.05;
  const displayMinY = Math.max(0, minY - yPadding);
  const displayMaxY = maxY + yPadding;

  const scaleX = (x) => paddingLeft + (x / maxX) * (width - paddingLeft - paddingRight);
  const scaleY = (y) => {
    const normalizedY = (y - displayMinY) / (displayMaxY - displayMinY);
    return height - paddingBottom - normalizedY * (height - paddingTop - paddingBottom);
  };

  let path = "";
  points.forEach((p, i) => {
    const x = scaleX(p.x);
    const y = scaleY(p.y);
    path += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <!-- XP line -->
      <path d="${path}" stroke="#d552f4" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
      
      <!-- Interactive hover area -->
      <rect id="xp-hover" width="${width}" height="${height}" fill="transparent"></rect>
      <text id="xp-tip" visibility="hidden" fill="white" font-size="12" font-weight="bold"></text>
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

    tip.textContent = `${closest.y.toLocaleString()} XP — ${closest.date}`;
    let tx = cursor.x + 10;
    let ty = cursor.y - 10;

    const textWidth = tip.getComputedTextLength();
    if (tx + textWidth > width - paddingRight) tx = width - paddingRight - textWidth;
    if (tx < paddingLeft) tx = paddingLeft;
    if (ty < paddingTop + 10) ty = paddingTop + 10;

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
      <text x="${cx}" y="${cy + 25}" font-size="12" fill="white" text-anchor="middle">
        Pass Rate
      </text>
    </svg>
  `;
}

function drawAuditGraph(container, ratio) {
  const scaled = Math.min(ratio / 2, 1);
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

// XP by Project/Path Bar Chart
function drawXPByProjectGraph(container, transactions) {
  if (!transactions.length) {
    container.innerHTML = "<p>No project data.</p>";
    return;
  }

  // Group XP by path (project)
  const pathMap = {};
  transactions.forEach(t => {
    const path = t.path || "Unknown";
    // Extract project name from path (e.g., "/madere/div-01/graphql" -> "graphql")
    const parts = path.split('/');
    const projectName = parts[parts.length - 1] || parts[parts.length - 2] || "Unknown";
    
    // Skip deprecated projects
    if (projectName.toLowerCase().includes('deprecated')) {
      return;
    }
    
    if (!pathMap[projectName]) {
      pathMap[projectName] = 0;
    }
    pathMap[projectName] += t.amount;
  });

  // Convert to array and sort
  const projectArray = Object.entries(pathMap)
    .map(([name, xp]) => ({ name, xp }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 8); // Top 8

  if (projectArray.length === 0) {
    container.innerHTML = "<p>No project data available.</p>";
    return;
  }

  const maxXP = Math.max(...projectArray.map(p => p.xp));

  const width = 850;
  const barHeight = 24;
  const padding = 10;
  const labelWidth = 180;
  const height = padding * 2 + projectArray.length * (barHeight + 5);

  let barsHTML = '';
  projectArray.forEach((proj, i) => {
    const y = padding + i * (barHeight + 5);
    const barWidth = (proj.xp / maxXP) * (width - labelWidth - padding * 2);
    
    barsHTML += `
      <g>
        <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#9b6bff" />
        <text x="${labelWidth - 5}" y="${y + barHeight/2 + 5}" fill="white" font-size="11" text-anchor="end">
          ${proj.name.substring(0, 25)}
        </text>
        <text x="${labelWidth + barWidth + 5}" y="${y + barHeight/2 + 5}" fill="white" font-size="11">
          ${proj.xp.toLocaleString()}
        </text>
      </g>
    `;
  });

  container.innerHTML = `
    <svg width="${width}" height="${height}">
      ${barsHTML}
    </svg>
  `;
}

function loadProfileHTML() {
  document.body.innerHTML = `
    <div id="app">

        <header class="top-bar">
            <p id="welcome-text">Loading...</p>
            <button id="logout-btn" class="logout-button">Logout</button>
        </header>

        <main class="main-grid">

            <section class="big-graph-box">

                <div class="section-label">XP Over Time (Cumulative)</div>
                <div class="xp-box">
                    <div id="xp-graph"></div>
                </div>

                <div class="small-graphs-row">

                    <div class="subgraph">
                        <div class="section-label">Pass / Fail Ratio</div>
                        <div id="passfail-graph"></div>
                    </div>

                    <div class="subgraph">
                        <div class="section-label">Audit Ratio</div>
                        <div id="audit-graph"></div>
                    </div>

                </div>

                <div class="section-label">Top Projects by XP</div>
                <div class="project-box">
                    <div id="project-graph"></div>
                </div>

            </section>

            <aside class="stats-column">

                <div class="stats-title">
                    Stats
                </div>

                <div class="stats-box">
                    <ul id="stats-list"></ul>
                </div>

                <div class="stats-box" id="results-section">
                    <!-- Recent results will be populated here -->
                </div>

            </aside>

        </main>

        <footer class="bottom-strip">
            <span class="elven-font">End of Scroll</span>
        </footer>

    </div>
  `;
}

async function renderProfile() {
  try {
    // FIRST: Load the profile HTML structure
    loadProfileHTML();

    // Add logout button handler immediately
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        localStorage.removeItem("jwt");
        renderLogin();
      };
    }

    // THEN: Fetch all data
    const userData = await graphqlRequest(USER_QUERY);
    const xpData = await graphqlRequest(XP_QUERY);
    const pfData = await graphqlRequest(PASS_FAIL_QUERY);
    const progressDetail = await graphqlRequest(PROGRESS_DETAIL_QUERY);

    const user = userData.user[0];
    const xp = xpData.transaction;
    const passCount = pfData.progress.filter(x => x.grade >= 1).length;
    const failCount = pfData.progress.filter(x => x.grade === 0).length;
    const progressResults = progressDetail.progress || [];

    // Update welcome text
    document.getElementById("welcome-text").textContent =
      `Welcome, ${user.firstName} ${user.lastName}`;

    // Update stats
    const statsList = document.getElementById("stats-list");
    const totalXP = xp.reduce((a, b) => a + b.amount, 0);
    statsList.innerHTML = `
      <li><strong>Username:</strong> ${user.login}</li>
      <li><strong>Email:</strong> ${user.email}</li>
      <li><strong>Audit Ratio:</strong> ${user.auditRatio.toFixed(2)}</li>
      <li><strong>Total XP:</strong> ${totalXP.toLocaleString()}</li>
      <li><strong>Passes:</strong> ${passCount}</li>
      <li><strong>Fails:</strong> ${failCount}</li>
    `;

    // Add recent results section (nested query demo)
    const resultsSection = document.getElementById("results-section");
    if (progressResults.length > 0) {
      // Filter to show only the most recent result per project (no duplicates)
      const projectMap = new Map();
      progressResults.forEach(r => {
        const path = r.path || 'unknown';
        const parts = path.split('/');
        const projectName = parts[parts.length - 1] || parts[parts.length - 2] || 'Unknown Project';
        
        // Only keep the first (most recent) occurrence of each project
        if (!projectMap.has(projectName)) {
          projectMap.set(projectName, r);
        }
      });
      
      const uniqueResults = Array.from(projectMap.values());
      
      const resultsHTML = uniqueResults.map(r => {
        // Safety check for nested user data
        const userName = r.user ? r.user.firstName || r.user.login : 'You';
        
        // Grade logic: >= 1 is pass, 0 is fail, null/undefined is in progress
        const isPassed = r.grade !== null && r.grade !== undefined && r.grade >= 1;
        const isFailed = r.grade === 0;
        const isInProgress = r.grade === null || r.grade === undefined;
        
        let gradeClass, gradeSymbol;
        if (isPassed) {
          gradeClass = 'pass';
          gradeSymbol = '✓';
        } else if (isInProgress) {
          gradeClass = 'in-progress';
          gradeSymbol = '⋯';
        } else {
          gradeClass = 'fail';
          gradeSymbol = '✗';
        }
        
        // Extract project name from path
        const path = r.path || '';
        const parts = path.split('/');
        const projectName = parts[parts.length - 1] || parts[parts.length - 2] || 'Unknown Project';
        
        return `
          <div class="result-item">
            <span class="result-grade ${gradeClass}">
              ${gradeSymbol}
            </span>
            <span class="result-info">
              <div class="result-project">${projectName}</div>
              <div class="result-date">${new Date(r.createdAt).toLocaleDateString()}</div>
            </span>
          </div>
        `;
      }).join('');
      resultsSection.innerHTML = `
        <div class="results-title">Recent Results</div>
        ${resultsHTML}
      `;
    } else {
      resultsSection.innerHTML = '<div class="results-title">No recent results</div>';
    }

    // XP over time graph (cumulative)
    const sortedXP = xp.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let cumulativeXP = 0;
    const points = sortedXP.map((entry, i) => {
      cumulativeXP += entry.amount;
      return {
        x: i,
        y: cumulativeXP,
        date: new Date(entry.createdAt).toLocaleString()
      };
    });

    drawXPGraph(document.getElementById("xp-graph"), points);

    // Pass/Fail ratio graph
    drawPassFailGraph(document.getElementById("passfail-graph"), passCount, failCount);

    // Audit ratio graph
    drawAuditGraph(document.getElementById("audit-graph"), user.auditRatio);

    // XP by Project graph
    drawXPByProjectGraph(document.getElementById("project-graph"), xp);

  } catch (err) {
    console.error("Error rendering profile:", err);
    // If there's an auth error, go back to login
    if (err.message.includes("GraphQL error") || err.message.includes("Unauthorized")) {
      localStorage.removeItem("jwt");
      renderLogin();
    }
  }
}

// Initialize
if (localStorage.getItem("jwt")) {
  renderProfile();
} else {
  renderLogin();
}