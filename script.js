let grid = [];
let width = 0, height = 0;
let selectedBooths = [];
let boothPositions = {};
let zoomLevel = 1;
const ENTRANCE_CODE = "ENTRANCE"; // 🏁 Fixed starting point

const mapDiv = document.getElementById("map");
const computeBtn = document.getElementById("computeRoute");
const routeListDiv = document.getElementById("routeList");
const fileInput = document.getElementById("fileInput");
const textInput = document.getElementById("textInput");
const applyInputBtn = document.getElementById("applyInput");
const refreshBtn = document.getElementById("refresh");
var slider = document.getElementById("zoom");

// --- Default map zoom ---
const windowWidth = window.innerWidth;
if (windowWidth < 1000) { // small screens
  slider.value = 200;
} else { // desktop
  slider.value = 100;
}

// --- Load local CSV map ---
window.addEventListener("DOMContentLoaded", () => {
  fetch("map.csv")
    .then(res => res.text())
    .then(text => {
      const results = Papa.parse(text);
      grid = results.data.filter(r => r.length > 0);
      height = grid.length;
      width = Math.max(...grid.map(r => r.length));
      renderMap();
      computeBtn.disabled = false;
    })
    .catch(err => alert("Error loading CSV: " + err));
});

// --- Load user input CSV map ---
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  Papa.parse(file, {
    complete: (results) => {
      grid = results.data.filter(r => r.length > 0);
      height = grid.length;
      width = Math.max(...grid.map(r => r.length));
      renderMap();
      computeBtn.disabled = false;
    },
  });
});

// --- Render map ---
function renderMap() {
  mapDiv.innerHTML = "";
  mapDiv.style.gridTemplateColumns = `repeat(${width}, 54px)`;
  mapDiv.style.transform = `scale(${slider.value/100})`;
  boothPositions = {};
  selectedBooths = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const booth = grid[y][x]?.trim();
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.x = x;
      cell.dataset.y = y;

      if (booth) {
        cell.classList.add("booth");
        if (booth.toUpperCase() === ENTRANCE_CODE) cell.classList.add("entrance");
        cell.textContent = booth;
        boothPositions[booth] = { x, y };
        cell.onclick = () => toggleSelect(booth, cell);
      } else {
        cell.classList.add("empty");
      }
      mapDiv.appendChild(cell);
    }
  }
  mapDiv.style.transform = `scale(${this.value/100})`;
}

// --- Click selection ---
function toggleSelect(booth, cell) {
  if (booth.toUpperCase() === ENTRANCE_CODE) return; // can't deselect entrance
  if (selectedBooths.includes(booth)) {
    selectedBooths = selectedBooths.filter(b => b !== booth);
    cell.classList.remove("selected");
  } else {
    selectedBooths.push(booth);
    cell.classList.add("selected");
  }
}

// --- Refresh booths ---
refreshBtn.addEventListener("click", () => {
  textInput.value = "";
  selectedBooths = [];
  renderMap();
  routeListDiv.innerHTML = "";
});

// --- Add booths from text input ---
applyInputBtn.addEventListener("click", () => {
  let inputVal = textInput.value.trim().split(",");
  if (inputVal.length < 2) {
    inputVal = inputVal[0].split("\n");
  }
  if (!inputVal) return;
  const boothCodes = inputVal.map(b => b.trim()).filter(b => b);
  const notFoundBooth = [];
  for (const booth of boothCodes) {
    if (boothPositions[booth] && !selectedBooths.includes(booth)) {
      selectedBooths.push(booth);
        const cell = document.querySelector(`.cell.booth:not(.entrance):not(.selected)`);
      const targetCell = Array.from(document.querySelectorAll(".cell.booth"))
        .find(c => c.textContent === booth);
      if (targetCell) targetCell.classList.add("selected");
    }
      else if (!boothPositions[booth]) {
      notFoundBooth.push(booth);
    }
  }
  if (notFoundBooth.length > 0) {
    alert("Booth " + notFoundBooth.map(e => e + ", ") + " not found")
  }
});

// --- Compute route ---
computeBtn.addEventListener("click", async () => {
  const entrance = ENTRANCE_CODE in boothPositions ? ENTRANCE_CODE : null;
  if (selectedBooths.length < 1 && !entrance) return alert("Select at least 1 booth.");
  const route = entrance ? [entrance, ...selectedBooths] : [...selectedBooths];
  const ordered = findShortestRoute(route);
  displayRouteList(ordered);
  await animateRoute(ordered);
});

// --- Display route list ---
function displayRouteList(route) {
  routeListDiv.innerHTML = "<b>🧭 Visit Order:</b><br>" + route.join(" ➜ ");
}

// --- Animate route ---
async function animateRoute(route) {
  document.querySelectorAll(".path").forEach(c => c.classList.remove("path"));
  for (let i = 0; i < route.length - 1; i++) {
    const startBooth = route[i];
    const goalBooth = route[i + 1];
    const start = nearestAisleCell(startBooth);
    const goal = nearestAisleCell(goalBooth);
    if (!start || !goal) continue;
    const path = bfs(start, goal);
    if (!path) continue;
    for (const p of path) {
      const cell = document.querySelector(`[data-x="${p.x}"][data-y="${p.y}"]`);
      if (cell && cell.classList.contains("empty")) {
        cell.classList.add("path");
        await sleep(20);
      }
    }
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// --- Helper: get nearest aisle next to booth ---
function nearestAisleCell(booth) {
  const pos = boothPositions[booth];
  if (!pos) return null;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (const [dx, dy] of dirs) {
    const nx = pos.x + dx, ny = pos.y + dy;
    if (nx >= 0 && ny >= 0 && nx < width && ny < height && !grid[ny][nx]) {
      return { x: nx, y: ny };
    }
  }
  return null;
}

// --- BFS pathfinding ---
function bfs(start, goal) {
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  const parent = {};

  while (queue.length) {
    const cur = queue.shift();
    if (cur.x === goal.x && cur.y === goal.y) {
      const path = [];
      let k = `${goal.x},${goal.y}`;
      while (k) {
        const [x, y] = k.split(',').map(Number);
        path.push({x, y});
        k = parent[k];
      }
      return path.reverse();
    }

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (grid[ny][nx]) continue;
      const key = `${nx},${ny}`;
      if (!visited.has(key)) {
        visited.add(key);
        parent[key] = `${cur.x},${cur.y}`;
        queue.push({x: nx, y: ny});
      }
    }
  }
  return null;
}

// --- Nearest neighbor heuristic ---
function findShortestRoute(booths) {
  const route = [booths[0]];
  const remaining = booths.slice(1);
  while (remaining.length) {
    const last = route[route.length - 1];
    const lastPos = boothPositions[last];
    let best = remaining[0];
    let bestDist = Infinity;
    for (const b of remaining) {
      const dist = Math.hypot(
        boothPositions[b].x - lastPos.x,
        boothPositions[b].y - lastPos.y
      );
      if (dist < bestDist) {
        bestDist = dist;
        best = b;
      }
    }
    route.push(best);
    remaining.splice(remaining.indexOf(best), 1);
  }
  return route;
}

// --- Download map ---
document.getElementById("downloadMap").onclick = async () => {
  const mapDiv = document.getElementById("map");
  const wrapper = document.getElementById("mapWrapper");

  // Save current transform and scroll (so we can restore later)
  const prevTransform = mapDiv.style.transform;
  const prevTransformOrigin = mapDiv.style.transformOrigin;
  const prevScrollTop = wrapper.scrollTop;
  const prevScrollLeft = wrapper.scrollLeft;

  // Temporarily reset zoom and scroll to capture the full content
  mapDiv.style.transform = "none";
  mapDiv.style.transformOrigin = "top left";
  wrapper.scrollTop = 0;
  wrapper.scrollLeft = 0;

  // Temporarily make the wrapper large enough to show the full map
  const prevWidth = wrapper.style.width;
  const prevHeight = wrapper.style.height;
  wrapper.style.width = `${mapDiv.scrollWidth}px`;
  wrapper.style.height = `${mapDiv.scrollHeight}px`;

  await html2canvas(mapDiv, {
    scale: 2,
    useCORS: true,
    width: mapDiv.scrollWidth,
    height: mapDiv.scrollHeight,
    backgroundColor: "#181A1B"
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = "routed_map_full.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  // Restore original state
  mapDiv.style.transform = prevTransform;
  mapDiv.style.transformOrigin = prevTransformOrigin;
  wrapper.style.width = prevWidth;
  wrapper.style.height = prevHeight;
  wrapper.scrollTop = prevScrollTop;
  wrapper.scrollLeft = prevScrollLeft;
};

// Zoom slider
slider.oninput = function() {
  mapDiv.style.transform = `scale(${this.value/100})`;
}
