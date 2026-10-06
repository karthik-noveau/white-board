export const palettes = {
  violet: ["#f0eaff", "#7656c9", "#5b3dab"], blue: ["#e8f3ff", "#3d8ac9", "#2770ae"], amber: ["#fff3d8", "#d99a24", "#a96f05"],
  pink: ["#ffeaf1", "#d8678c", "#b54369"], green: ["#e5f6ed", "#49a878", "#278458"], orange: ["#ffeddf", "#df7d43", "#b85c27"], white: ["#ffffff", "#b8bec8", "#59616c"],
};

export const normalizeHexColor = value => {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  if (!/^(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex)) return null;
  return `#${(hex.length === 3 ? [...hex].map(char => char + char).join("") : hex).toLowerCase()}`;
};

export const isCustomColor = value => typeof value === "string" && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value);
export const isBoardColor = value => typeof value === "string" && (Object.hasOwn(palettes, value) || isCustomColor(value));

export const customColors = value => {
  if (!isCustomColor(value)) return null;
  const fill = normalizeHexColor(value);
  const channels = fill.slice(1).match(/../g).map(channel => parseInt(channel, 16));
  const linear = channels.map(channel => { const s = channel / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; });
  const luminance = linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  const lightText = luminance < .179;
  const text = lightText ? "#ffffff" : "#000000";
  const border = `#${channels.map(channel => Math.round(channel * .72 + (lightText ? 255 : 0) * .28).toString(16).padStart(2, "0")).join("")}`;
  return { fill, text, note: text, border, editor: lightText ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.04)" };
};

export const paletteFor = value => {
  const custom = customColors(value);
  return custom ? [custom.fill, custom.border, custom.border] : Object.hasOwn(palettes, value) ? palettes[value] : palettes.white;
};
export const colorSwatch = value => isCustomColor(value) ? normalizeHexColor(value) : paletteFor(value)[1];

export const rootColors = node => {
  const custom = customColors(node.color);
  if (custom) return custom;
  const color=Object.hasOwn(palettes,node.color)?node.color:"white",[background,,accent]=palettes[color],solid=color!=="white";
  return {fill:solid?(color==="violet"?"#6436dc":accent):background,text:solid?"#ffffff":"#151621",note:solid?"rgba(255,255,255,.88)":"#5f687b",editor:solid?"rgba(255,255,255,.1)":"rgba(25,25,32,.04)"};
};

export const isCardContent = node => Boolean(node.content && node.contentLayout === "card");
export const isCardText = node => isCardContent(node) && node.content.every(block => block.type === "text");

export const nodeSize = node => {
  const width = node.w || (node.shape === "circle" ? (node.root ? 144 : 124) : node.root ? 252 : 228);
  const height = node.h || (node.shape === "circle" ? (node.root ? 144 : 124) : node.root ? 108 : 92);
  if (isCardContent(node)) return { width, height: Math.max(height, node.contentHeight || 0) };
  return {
    width: node.content ? Math.max(320, node.w || 380) : width,
    height: node.content ? Math.max(100, node.h || 0, node.contentHeight || 120) : Math.max(height, node.contentHeight || 0),
  };
};
