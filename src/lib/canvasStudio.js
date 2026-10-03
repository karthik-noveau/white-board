import { nodeSize } from "./boardAppearance.js";

export const STUDIO_VERSION = 1;
export const studioRoles = ["heading", "text", "button", "card", "label", "artwork"];
export const studioColors = { violet: "#6436dc", blue: "#2871bc", green: "#267955", orange: "#b95d32", ink: "#202334" };
export const isStudioScreen = node => node?.kind === "frame" && validStudioScreen(node.studio);
export const studioScreens = nodes => nodes.filter(node => isStudioScreen(node) && !node.hidden);

export function validStudioScreen(studio) {
  if (!studio || studio.version !== STUDIO_VERSION || !Array.isArray(studio.elements) || studio.elements.length > 250) return false;
  const ids = new Set();
  return studio.elements.every(element => {
    if (!element || typeof element.id !== "string" || !element.id || ids.has(element.id) || !studioRoles.includes(element.role)) return false;
    ids.add(element.id);
    if (![element.x, element.y, element.w, element.h].every(Number.isFinite) || element.w <= 0 || element.h <= 0) return false;
    if (typeof element.text !== "string" || typeof element.detail !== "string") return false;
    if (element.action && (!['navigate', 'back'].includes(element.action.type) || (element.action.type === "navigate" && !(Number.isSafeInteger(element.action.target) || (typeof element.action.target === "string" && element.action.target.length > 0))))) return false;
    return true;
  });
}

export function screenElements(screen) { return isStudioScreen(screen) ? screen.studio.elements : []; }

export function createStudioCopy(project, board, id = `project-${crypto.randomUUID()}`, now = Date.now()) {
  const copy = structuredClone({ ...project, board });
  delete copy.deletedAt;
  delete copy.board.viewport;
  return { ...copy, id, title: `${project.title} · Studio`, favorite: false, created: now, updated: now, studioExperiment: { version: STUDIO_VERSION, sourceId: project.id, sourceTitle: project.title, createdAt: now } };
}

const element = (id, role, x, y, w, h, text, detail = "", extra = {}) => ({ id, role, x, y, w, h, text, detail, ...extra });

export function createScreen(id, x, y, title = "Untitled screen", device = "mobile") {
  const desktop = device === "desktop";
  return { id, kind: "frame", title, note: "Interactive screen", color: "white", shape: "round", x, y, w: desktop ? 960 : 390, h: desktop ? 640 : 720,
    studio: { version: STUDIO_VERSION, device, start: false, elements: [
      element(`element-${id}-title`, "heading", 28, 84, desktop ? 580 : 334, 76, "Make something people can use.", ""),
      element(`element-${id}-text`, "text", 28, 178, desktop ? 560 : 334, 68, "Build a screen, connect an action, and press Play."),
      element(`element-${id}-button`, "button", 28, desktop ? 530 : 624, desktop ? 260 : 334, 52, "Get started", "", { tone: "violet" }),
    ] } };
}

export function createStarterFlow(ids, x = 600, y = 600) {
  const [exploreId, detailId, savedId] = ids;
  const screens = ids.map((id, index) => createScreen(id, x + index * 510, y, ["Explore", "Place details", "Saved places"][index]));
  const go = target => ({ type: "navigate", target, transition: "slide" });
  const base = id => [element(`${id}-brand`, "label", 28, 28, 200, 26, "WANDER / CITY GUIDES", "", { tone: "violet" })];
  screens[0].studio = { ...screens[0].studio, start: true, elements: [...base(exploreId),
    element("explore-heading", "heading", 28, 86, 334, 84, "A little closer\nto somewhere new."),
    element("explore-copy", "text", 28, 190, 324, 44, "Thoughtful places for your next slow weekend."),
    element("explore-art", "artwork", 28, 260, 334, 192, "The quiet side of the city", "", { tone: "violet" }),
    element("explore-meta", "label", 28, 476, 300, 24, "CURATED FOR YOUR WEEKEND"),
    element("explore-place", "card", 28, 514, 334, 76, "The Glasshouse", "A garden café, tucked away.", { action: go(detailId) }),
    element("explore-button", "button", 28, 628, 334, 52, "Explore this place", "", { tone: "violet", action: go(detailId) }),
  ] };
  screens[1].studio.elements = [...base(detailId),
    element("detail-back", "label", 28, 76, 180, 32, "← Back to explore", "", { action: { type: "back" } }),
    element("detail-art", "artwork", 28, 134, 334, 214, "An afternoon, unhurried.", "", { tone: "green" }),
    element("detail-meta", "label", 28, 374, 330, 24, "GARDENS · COFFEE · GOOD CONVERSATION"),
    element("detail-title", "heading", 28, 418, 334, 52, "The Glasshouse"),
    element("detail-copy", "text", 28, 490, 334, 78, "Sunlight, seasonal plates, and a seat among the plants. Make a little time for yourself."),
    element("detail-save", "button", 28, 628, 334, 52, "Save this place", "", { tone: "violet", action: go(savedId) }),
  ];
  screens[2].studio.elements = [...base(savedId),
    element("saved-label", "label", 28, 112, 300, 26, "YOUR NEXT LITTLE ADVENTURE", "", { tone: "green" }),
    element("saved-heading", "heading", 28, 164, 334, 100, "Good places.\nAll in one place."),
    element("saved-copy", "text", 28, 286, 320, 46, "Your weekend is already looking better."),
    element("saved-place", "card", 28, 382, 334, 98, "The Glasshouse", "Saved to your weekend collection", { tone: "green", action: go(detailId) }),
    element("saved-tip", "text", 28, 512, 324, 58, "Keep collecting the places you want to make time for."),
    element("saved-button", "button", 28, 628, 334, 52, "Find another place", "", { tone: "violet", action: go(exploreId) }),
  ];
  return screens;
}

export function newScreenPosition(nodes) {
  const screens = studioScreens(nodes), items = screens.length ? screens : nodes;
  return { x: items.length ? Math.max(...items.map(node => node.x + nodeSize(node).width)) + 180 : 600, y: screens[0]?.y ?? 600 };
}

export function addScreenElement(screen, role, id = crypto.randomUUID()) {
  if (screen.studio.elements.length >= 250) return screen;
  const size = nodeSize(screen), width = Math.min(334, size.width - 56);
  const content = { heading: ["Your headline", 74], text: ["Add a little context.", 64], button: ["Continue", 52], card: ["A useful detail", 88], label: ["SMALL DETAILS MATTER", 26], artwork: ["A moment of inspiration", 180] };
  const [text, height] = content[role] || content.text;
  const item = element(id, studioRoles.includes(role) ? role : "text", 28, Math.min(size.height - height - 28, 84 + screen.studio.elements.length * 24), width, height, text, role === "card" ? "A supporting description" : "", { tone: "violet" });
  return { ...screen, studio: { ...screen.studio, elements: [...screen.studio.elements, item] } };
}

export function duplicateScreen(screen, id, x) {
  const copy = structuredClone(screen);
  copy.id = id; copy.x = x; copy.title = `${screen.title} copy`; copy.studio.start = false;
  copy.studio.elements = copy.studio.elements.map((item, index) => ({ ...item, id: `${id}-element-${index}`, ...(item.action?.type === "navigate" && item.action.target === screen.id ? { action: { ...item.action, target: id } } : {}) }));
  return copy;
}

export function prototypeStart(nodes, preferred) {
  const screens = studioScreens(nodes);
  return screens.find(screen => screen.id === preferred) || screens.find(screen => screen.studio.start) || screens[0] || null;
}

export function prototypeStep(nodes, history, action) {
  if (!action) return history;
  if (action.type === "back") return history.length > 1 ? history.slice(0, -1) : history;
  if (action.type !== "navigate" || !studioScreens(nodes).some(screen => screen.id === action.target)) return history;
  return [...history, action.target];
}

export function brokenInteractions(nodes) {
  const screens = studioScreens(nodes), ids = new Set(screens.map(screen => screen.id));
  return screens.flatMap(screen => screenElements(screen).filter(item => item.action?.type === "navigate" && !ids.has(item.action.target)).map(item => ({ screenId: screen.id, screenTitle: screen.title, elementId: item.id, label: item.text })));
}

// Clipboard targets must follow the newly allocated screen IDs. A target outside
// a pasted selection is cleared so another board's numeric ID cannot catch it.
export function remapStudioScreen(node, ids, clearExternal = false) {
  if (!isStudioScreen(node)) return node;
  const copy = structuredClone(node);
  copy.studio.start = false;
  copy.studio.elements = copy.studio.elements.map(item => {
    if (item.action?.type !== "navigate") return item;
    return { ...item, action: ids.has(item.action.target) ? { ...item.action, target: ids.get(item.action.target) } : clearExternal ? undefined : item.action };
  });
  return copy;
}
