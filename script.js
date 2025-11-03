// import html2canvasModule from 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';

let grid = [];
let width = 0, height = 0;
let selectedBooths = [];
let boothPositions = {};
let zoom = 1;
const ENTRANCE_CODE = "ENTRANCE";

const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const zoomSlider = document.getElementById("zoom");
const fileInput = document.getElementById("fileInput");
const computeBtn = document.getElementById("computeRoute");
const applyInputBtn = document.getElementById("applyInput");
const refreshBtn = document.getElementById("refresh");
const routeListDiv = document.getElementById("routeList");
const textInput = document.getElementById("textInput");
const cellSize = 30;

// --- Load default map ---
window.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("map.csv");
  const text = await res.text();
  const data = Papa.parse(text).data.filter(r => r.length);
  setupGrid(data);
});

// --- Load CSV input ---
fileInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    complete: res => setupGrid(res.data.filter(r => r.length))
  });
});

function setupGrid(data) {
  grid = data.map(r => r.map(v => v.trim() || ""));
  height = grid.length;
  width = Math.max(...grid.map(r => r.length));
  boothPositions = {};
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const b = grid[y][x];
      if (b) boothPositions[b] = { x, y };
    }
  }
  drawMap();
}

function drawMap() {
  // Resize canvas based on zoom
  canvas.width = width * cellSize * zoom;
  canvas.height = height * cellSize * zoom;
  ctx.setTransform(zoom, 0, 0, zoom, 0, 0);
  ctx.clearRect(0, 0, width * cellSize, height * cellSize);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "10px sans-serif";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const booth = grid[y][x];
      const cx = x * cellSize;
      const cy = y * cellSize;

      // --- Background color ---
      if (!booth) {
        ctx.fillStyle = "#1f1f1f";
      } else if (booth.toUpperCase() === ENTRANCE_CODE) {
        ctx.fillStyle = "#2a9d8f";
      } else if (selectedBooths.includes(booth)) {
        ctx.fillStyle = "#e76f51";
      } else {
        ctx.fillStyle = "#264653";
      }
      ctx.fillRect(cx, cy, cellSize, cellSize);

      // --- Booth text ---
      if (booth) {
        ctx.fillStyle = "#fff";
        ctx.fillText(
          booth,
          cx + cellSize / 2,
          cy + cellSize / 2,
          cellSize - 4 // limit width so text doesn’t overflow
        );
      }
    }
  }

  // --- Grid lines ---
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 0.5;
  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(width * cellSize, y * cellSize);
    ctx.stroke();
  }
  for (let x = 0; x <= width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, height * cellSize);
    ctx.stroke();
  }
}

// --- Canvas click to select booths ---
canvas.addEventListener("click", e => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / (cellSize * zoom));
  const y = Math.floor((e.clientY - rect.top) / (cellSize * zoom));
  const booth = grid[y]?.[x];
  if (!booth || booth.toUpperCase() === ENTRANCE_CODE) return;
  if (selectedBooths.includes(booth))
    selectedBooths = selectedBooths.filter(b => b !== booth);
  else
    selectedBooths.push(booth);
  drawMap();
});

// --- Apply text input ---
applyInputBtn.addEventListener("click", () => {
  const booths = textInput.value.split(/[\n,]+/).map(b => b.trim()).filter(Boolean);
  selectedBooths = booths.filter(b => boothPositions[b]);
  drawMap();
});

// --- Refresh ---
refreshBtn.addEventListener("click", () => {
  selectedBooths = [];
  textInput.value = "";
  drawMap();
  routeListDiv.textContent = "";
});

// --- Zoom ---
zoomSlider.oninput = e => {
  zoom = e.target.value / 100;
  drawMap();
};

// --- Route calculation ---
computeBtn.addEventListener("click", async () => {
  if (!boothPositions[ENTRANCE_CODE]) return alert("No ENTRANCE found");
  if (!selectedBooths.length) return alert("Select booths first");
  const route = [ENTRANCE_CODE, ...selectedBooths];
  const ordered = findShortestRoute(route);
  displayRouteList(ordered);
  await animateRoute(ordered);
});

// --- Route display ---
function displayRouteList(route) {
  routeListDiv.innerHTML = "<b>🧭 Visit Order:</b><br>" + route.join(" ➜ ");
}

// --- Simple BFS ---
function bfs(start, goal) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  const q = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  const parent = {};
  while (q.length) {
    const cur = q.shift();
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let k = `${goal.x},${goal.y}`;
      while (k) {
        const [x,y] = k.split(',').map(Number);
        path.push({x,y});
        k = parent[k];
      }
      return path.reverse();
    }
    for (const [dx,dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx<0||ny<0||nx>=width||ny>=height) continue;
      if (grid[ny][nx]) continue;
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        parent[key] = `${cur.x},${cur.y}`;
        q.push({x:nx,y:ny});
      }
    }
  }
  return [];
}

// --- Nearest neighbor heuristic ---
function findShortestRoute(booths) {
  const route = [booths[0]];
  const remaining = booths.slice(1);
  while (remaining.length) {
    const last = route[route.length - 1];
    const lp = boothPositions[last];
    let best = remaining[0];
    let bestDist = Infinity;
    for (const b of remaining) {
      const bp = boothPositions[b];
      const dist = Math.hypot(bp.x - lp.x, bp.y - lp.y);
      if (dist < bestDist) { best = b; bestDist = dist; }
    }
    route.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return route;
}

// --- Animate route ---
async function animateRoute(route) {
  for (let i = 0; i < route.length - 1; i++) {
    const a = nearestAisleCell(route[i]);
    const b = nearestAisleCell(route[i + 1]);
    const path = bfs(a, b);
    for (const p of path) {
      ctx.fillStyle = "#f4a261";
      ctx.fillRect(p.x * cellSize, p.y * cellSize, cellSize, cellSize);
    }
    await new Promise(r => setTimeout(r, 300));
  }
}

function nearestAisleCell(booth) {
  const pos = boothPositions[booth];
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx, dy] of dirs) {
    const nx = pos.x + dx, ny = pos.y + dy;
    if (nx>=0&&ny>=0&&nx<width&&ny<height&&!grid[ny][nx]) return {x:nx,y:ny};
  }
  return pos;
}

// --- Download map as image ---
document.getElementById("downloadMap").onclick = async () => {
  const canvasImage = await html2canvas(canvas, { backgroundColor: "#181A1B" });
  const link = document.createElement("a");
  link.download = "routed_map.png";
  link.href = canvasImage.toDataURL();
  link.click();
};
