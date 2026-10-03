import { screenElements, studioColors } from "./canvasStudio.js";
import { nodeSize } from "./boardAppearance.js";

const escape = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);

function lines(text, width, fontSize, maxLines) {
  const limit = Math.max(4, Math.floor(width / (fontSize * .53))), result = [];
  for (const paragraph of String(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && (line + " " + word).length > limit) { result.push(line); line = ""; }
      line += (line ? " " : "") + word;
    }
    result.push(line);
  }
  return result.slice(0, maxLines).map((line, index) => index === maxLines - 1 && result.length > maxLines ? `${line.replace(/\s+\S*$/, "")}…` : line);
}

function textMarkup(text, x, y, width, height, size, color, weight = 400, lineHeight = 1.45) {
  return lines(text, width, size, Math.max(1, Math.floor((height - size - 2) / (size * lineHeight)) + 1)).map((line, index) => `<text x="${x}" y="${y + size + index * size * lineHeight}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="Inter,Arial,sans-serif">${escape(line)}</text>`).join("");
}

export function studioElementSvg(item, key) {
  const { x, y, w, h } = item, tone = studioColors[item.tone] || studioColors.violet;
  let content = "";
  if (item.role === "heading") content = textMarkup(item.text, 0, 0, w, h, 30, "#202334", 650, 1.22);
  else if (item.role === "text") content = textMarkup(item.text, 0, 0, w, h, 15, "#657080", 400, 1.55);
  else if (item.role === "label") content = textMarkup(item.text, 0, 3, w, h, 10.5, item.tone ? tone : "#7a8090", 600);
  else if (item.role === "button") content = `<rect width="${w}" height="${h}" rx="12" fill="${tone}"/><text x="${w / 2}" y="${h / 2 + 5}" text-anchor="middle" fill="white" font-size="14" font-weight="600" font-family="Inter,Arial,sans-serif">${escape(item.text.slice(0, 45))}</text>`;
  else if (item.role === "card") content = `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="14" fill="#fff" stroke="#e3e4eb"/><rect x="16" y="${h / 2 - 19}" width="38" height="38" rx="11" fill="${tone}" opacity=".12"/><path d="m28 ${h / 2} 5 5 9-10" fill="none" stroke="${tone}" stroke-width="2"/>${textMarkup(item.text, 68, h / 2 - 23, w - 100, 25, 15, "#202334", 600)}${textMarkup(item.detail, 68, h / 2 + 2, w - 100, 20, 11, "#687181")}<path d="m${w - 25} ${h / 2 - 4} 4 4-4 4" fill="none" stroke="#9a9faf" stroke-width="1.5"/>`;
  else if (item.role === "artwork") {
    const id = `studio-art-${String(key).replace(/[^a-zA-Z0-9_-]/g, "")}`;
    content = `<defs><clipPath id="${id}"><rect width="${w}" height="${h}" rx="18"/></clipPath></defs><g clip-path="url(#${id})"><rect width="${w}" height="${h}" fill="${tone}" opacity=".13"/><circle cx="${w * .78}" cy="${h * .27}" r="${h * .13}" fill="#fff" opacity=".85"/><path d="M${-w * .1} ${h}Q${w * .15} ${h * .06} ${w * .6} ${h}Z" fill="${tone}" opacity=".24"/><path d="M${w * .15} ${h}Q${w * .57} ${-h * .2} ${w * 1.2} ${h}Z" fill="${tone}" opacity=".5"/><path d="M${w * .55} ${h}Q${w * .7} ${h * .36} ${w * 1.2} ${h}Z" fill="${tone}" opacity=".85"/><rect x="18" y="${h - 42}" width="${w - 36}" height="27" rx="7" fill="#fff" opacity=".93"/>${textMarkup(item.text, 28, h - 37, w - 56, 18, 10, "#383b4c", 500)}</g>`;
  }
  const clip = `studio-element-${String(key).replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return `<g transform="translate(${x} ${y})"><defs><clipPath id="${clip}"><rect width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${clip})">${content}</g></g>`;
}

export function studioScreenSvg(screen, prefix = screen.id) {
  const { width, height } = nodeSize(screen);
  return `<rect width="${width}" height="${height}" rx="18" fill="#fcfcfe"/>${screenElements(screen).map((item, index) => studioElementSvg(item, `${prefix}-${index}`)).join("")}`;
}
