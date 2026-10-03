import { nodeSize, palettes, rootColors } from "./boardAppearance.js";

const xml = value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const number = value => Math.round(value * 1000) / 1000;
const colorAttributes = color => {
  const rgba = color.match(/^rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)$/);
  return rgba ? `fill="rgb(${rgba[1]},${rgba[2]},${rgba[3]})" fill-opacity="${rgba[4]}"` : `fill="${xml(color)}"`;
};
export const MAX_EXPORT_SIDE = 16384;
export const MAX_EXPORT_PIXELS = 64_000_000;

export function selectExportNodes(nodes, selectedIds, scope) {
  if (scope !== "selection") return nodes;
  const chosen = new Set(selectedIds);
  // Selecting a frame exports its contents, including nested frames.
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) if (chosen.has(node.frameId) && !chosen.has(node.id)) { chosen.add(node.id); changed = true; }
  }
  return nodes.filter(node => chosen.has(node.id));
}

export function rasterSize(width, height, requestedScale) {
  if (![width, height, requestedScale].every(value => Number.isFinite(value) && value > 0)) throw new Error("Invalid export size.");
  const scale = Math.min(requestedScale, MAX_EXPORT_SIDE / width, MAX_EXPORT_SIDE / height, Math.sqrt(MAX_EXPORT_PIXELS / (width * height)));
  return { width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale)), scale, limited: scale < requestedScale - .001 };
}

export function pdfLayout(width, height, paper = "a4") {
  let pageWidth, pageHeight;
  if (paper === "board") {
    // PDF dimensions are points; keep pages inside the PDF 200-inch limit.
    const ratio = Math.min(.75, 14000 / Math.max(width, height));
    pageWidth = width * ratio; pageHeight = height * ratio;
    return { pageWidth, pageHeight, x: 0, y: 0, width: pageWidth, height: pageHeight };
  }
  const sizes = { a4: [595.28, 841.89], a3: [841.89, 1190.55], letter: [612, 792] };
  [pageWidth, pageHeight] = sizes[paper] || sizes.a4;
  if (width > height) [pageWidth, pageHeight] = [pageHeight, pageWidth];
  const scale = Math.min((pageWidth - 48) / width, (pageHeight - 48) / height);
  return { pageWidth, pageHeight, x: (pageWidth - width * scale) / 2, y: (pageHeight - height * scale) / 2, width: width * scale, height: height * scale };
}

export function exportDimensions(prepared, options) {
  if (!prepared) return null;
  const page = options.format === "pdf" ? pdfLayout(prepared.width, prepared.height, options.paper) : null;
  const requestedScale = page ? page.width / 72 * options.dpi / prepared.width : options.scale;
  const size = rasterSize(prepared.width, prepared.height, requestedScale || 4);
  return { ...size, page, dpi: page ? Math.floor(size.width / (page.width / 72)) : null };
}

export function boardBounds(nodes, edges, padding = 48) {
  if (!nodes.length) return null;
  const ids = new Set(nodes.map(node => node.id));
  const points = [];
  for (const node of nodes) {
    const { width, height } = nodeSize(node), angle = (node.rotate || 0) * Math.PI / 180;
    const halfWidth = Math.abs(width * Math.cos(angle)) / 2 + Math.abs(height * Math.sin(angle)) / 2;
    const halfHeight = Math.abs(width * Math.sin(angle)) / 2 + Math.abs(height * Math.cos(angle)) / 2;
    points.push([node.x + width / 2 - halfWidth, node.y + height / 2 - halfHeight], [node.x + width / 2 + halfWidth, node.y + height / 2 + halfHeight]);
  }
  for (const edge of edges) {
    if (!edge || !ids.has(edge.from) || !ids.has(edge.to)) continue;
    // Canvas paths use absolute M/L/Q/C commands. Their control-point hull also
    // contains the entire curve, including manually routed paths outside nodes.
    const values = (edge.path?.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi) || []).map(Number);
    for (let index = 0; index + 1 < values.length; index += 2) points.push([values[index], values[index + 1]]);
    if (edge.label && edge.control) {
      const half = Math.min(90, Math.max(20, edge.label.length * 2.85 + 8));
      points.push([edge.control.x - half, edge.control.y - 11], [edge.control.x + half, edge.control.y + 11]);
    }
  }
  const valid = points.filter(point => point.every(Number.isFinite));
  if (!valid.length) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x, y] of valid) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
  return { x: Math.floor(left - padding), y: Math.floor(top - padding), width: Math.ceil(right - left + padding * 2), height: Math.ceil(bottom - top + padding * 2) };
}

function measuredText(source) {
  if (!source) return "";
  // Lay out an unscaled copy. Text ranges retain native wrapping and inline
  // formatting while the exported SVG uses portable vector text, not HTML.
  const clone = source.cloneNode(true);
  const originals = [source, ...source.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((element, index) => {
    const computed = getComputedStyle(element);
    copies[index].style.cssText = [...computed].map(property => `${property}:${computed.getPropertyValue(property)}`).join(";");
    copies[index].style.backgroundImage = "none";
    for (const attribute of [...copies[index].attributes]) {
      if (/^on/i.test(attribute.name) || ["id", "src", "srcset", "href", "xlink:href"].includes(attribute.name)) copies[index].removeAttribute(attribute.name);
    }
  });
  Object.assign(clone.style, { position: "fixed", left: "-100000px", top: "0px", transform: "none", transition: "none", visibility: "hidden", outline: "none", boxShadow: "none", pointerEvents: "none" });
  clone.removeAttribute("data-export-node");
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  clone.querySelectorAll("button,[contenteditable],input,textarea,script,style,link,iframe,object,embed,img,audio,video").forEach(element => element.remove());
  document.body.appendChild(clone);
  try {
    const origin = clone.getBoundingClientRect(), canvas = document.createElement("canvas"), context = canvas.getContext("2d"), output = [];
    for (const field of clone.querySelectorAll(":scope > h3, :scope > p")) {
      const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const textNode = walker.currentNode, style = getComputedStyle(textNode.parentElement);
        const fontSize = parseFloat(style.fontSize);
        if (!fontSize || style.display === "none") continue;
        context.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
        const metrics = context.measureText("Mg"), ascent = metrics.fontBoundingBoxAscent ?? fontSize * .8, descent = metrics.fontBoundingBoxDescent ?? fontSize * .2;
        const range = document.createRange();
        let run = null, offset = 0;
        const flush = () => {
          if (!run?.text.trim()) return;
          let decoration = style.textDecorationLine;
          for (let parent = textNode.parentElement; parent && parent !== field; parent = parent.parentElement) {
            if (["U", "INS"].includes(parent.tagName)) decoration += " underline";
            if (["S", "STRIKE", "DEL"].includes(parent.tagName)) decoration += " line-through";
          }
          const y = run.top - origin.top + (run.height - ascent - descent) / 2 + ascent;
          output.push(`<text x="${number(run.left - origin.left)}" y="${number(y)}" ${colorAttributes(style.color)} font-family="${xml(style.fontFamily)}" font-size="${fontSize}" font-weight="${xml(style.fontWeight)}" font-style="${xml(style.fontStyle)}" letter-spacing="${xml(style.letterSpacing === "normal" ? "0" : style.letterSpacing)}" text-decoration="${xml(decoration.replace(/none/g, "").trim() || "none")}" xml:space="preserve">${xml(run.text)}</text>`);
        };
        for (const character of textNode.textContent) {
          range.setStart(textNode, offset); offset += character.length; range.setEnd(textNode, offset);
          const rect = range.getBoundingClientRect();
          if (!rect.width || !rect.height) continue;
          if (!run || Math.abs(run.top - rect.top) > .5) { flush(); run = { left: rect.left, top: rect.top, height: rect.height, text: "" }; }
          run.text += character;
        }
        flush();
      }
      // List markers are generated by CSS and are not text nodes.
      for (const item of field.querySelectorAll("li")) {
        const rect = item.getBoundingClientRect(), style = getComputedStyle(item), size = parseFloat(style.fontSize);
        const ordered = item.parentElement.tagName === "OL", siblings = [...item.parentElement.children];
        const marker = ordered ? `${(Number(item.parentElement.start) || 1) + siblings.indexOf(item)}.` : "•";
        output.push(`<text x="${number(rect.left - origin.left - 5)}" y="${number(rect.top - origin.top + size)}" text-anchor="end" fill="${xml(style.color)}" font-size="${size}" font-family="${xml(style.fontFamily)}">${marker}</text>`);
      }
    }
    return output.join("");
  } finally { clone.remove(); }
}

function fallbackText(node, width, height, colors) {
  const title = xml(node.title), note = xml(node.note);
  const frame = node.kind === "frame", x = frame ? 20 : width / 2, y = frame ? 28 : height / 2 - (note ? 4 : -4), anchor = frame ? "start" : "middle";
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="13" font-weight="600" ${colorAttributes(colors.text)}>${title}</text>${note ? `<text x="${x}" y="${y + 19}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="10" ${colorAttributes(colors.note)}>${note}</text>` : ""}`;
}

export function createBoardSvg(nodes, edges, background = "white", elements = new Map()) {
  const bounds = boardBounds(nodes, edges);
  if (!bounds) return null;
  const { x, y, width, height } = bounds, ids = new Set(nodes.map(node => node.id));
  const backdrop = background === "transparent" ? "" : `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${background === "grid" ? "#f8f9fb" : "#fff"}"/>${background === "grid" ? `<defs><pattern id="export-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#cfd2d9"/></pattern></defs><rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#export-grid)"/>` : ""}`;
  const renderNode = (node, index) => {
    const size = nodeSize(node), [bg, border] = palettes[node.color] || palettes.white, colors = node.root ? rootColors(node) : { fill: bg, text: "#303139", note: "#777983" };
    const rx = node.shape === "pill" ? size.height / 2 : node.shape === "rectangle" ? 2 : node.shape === "soft" ? 20 : 9;
    const ellipse = ["circle", "ellipse"].includes(node.shape);
    const geometry = ellipse ? `<ellipse cx="${size.width / 2}" cy="${size.height / 2}" rx="${size.width / 2}" ry="${size.height / 2}"` : `<rect width="${size.width}" height="${size.height}" rx="${rx}"`;
    const clip = `export-node-${index}`;
    const content = measuredText(elements.get(String(node.id))) || fallbackText(node, size.width, size.height, colors);
    return `<g transform="translate(${node.x} ${node.y}) rotate(${node.rotate || 0} ${size.width / 2} ${size.height / 2})"><defs><clipPath id="${clip}">${geometry}/></clipPath></defs>${geometry} fill="${colors.fill}"${node.kind === "frame" ? ' fill-opacity=".35" stroke-dasharray="5 4"' : ""} stroke="${border}" stroke-width="1"/><g clip-path="url(#${clip})">${content}</g></g>`;
  };
  const frameMarkup = nodes.map((node, index) => node.kind === "frame" ? renderNode(node, index) : "").join("");
  const connections = edges.filter(edge => edge && ids.has(edge.from) && ids.has(edge.to)).map(edge => {
    const weight = edge.weight === "bold" ? 3.5 : edge.weight === "thin" ? 1.25 : 2;
    const dash = edge.pattern === "dashed" ? ' stroke-dasharray="9 7"' : edge.pattern === "dotted" ? ' stroke-dasharray="2 7"' : "";
    const half = Math.min(90, Math.max(20, (edge.label || "").length * 2.85 + 8));
    const label = edge.label && edge.control ? `<rect x="${edge.control.x - half}" y="${edge.control.y - 11}" width="${half * 2}" height="22" rx="7" fill="white" stroke="#e4e1e9"/><text x="${edge.control.x}" y="${edge.control.y + 3.5}" text-anchor="middle" fill="#73717d" font-family="Arial,sans-serif" font-size="10">${xml(edge.label.length > 28 ? `${edge.label.slice(0, 27)}…` : edge.label)}</text>` : "";
    return `<g><path d="${xml(edge.path)}" fill="none" stroke="#aeb1ba" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"${dash}/>${label}</g>`;
  }).join("");
  const shapes = nodes.map((node, index) => node.kind !== "frame" ? renderNode(node, index) : "").join("");
  return { width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x} ${y} ${width} ${height}">${backdrop}${frameMarkup}${connections}${shapes}</svg>` };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

async function rasterize(prepared, size, opaque) {
  const url = URL.createObjectURL(new Blob([prepared.svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("Could not render this board.")); image.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This board is too large for an image. Try SVG.");
    if (opaque) { context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height); }
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export async function createPdfBlob(imageBlob, page, title) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: [page.pageWidth, page.pageHeight], orientation: page.pageWidth > page.pageHeight ? "landscape" : "portrait", compress: true });
  pdf.setProperties({ title, creator: "Nova" });
  pdf.addImage(new Uint8Array(await imageBlob.arrayBuffer()), "PNG", page.x, page.y, page.width, page.height, undefined, "FAST");
  return pdf.output("blob");
}

export async function exportVisualFile(prepared, options, title) {
  if (!prepared) throw new Error("Nothing to export.");
  const filename = title.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "") || "board";
  if (options.format === "svg") { downloadBlob(new Blob([prepared.svg], { type: "image/svg+xml;charset=utf-8" }), `${filename}.svg`); return; }
  const dimensions = exportDimensions(prepared, options);
  const canvas = await rasterize(prepared, dimensions, ["jpg", "pdf"].includes(options.format));
  try {
    const mime = options.format === "jpg" ? "image/jpeg" : options.format === "webp" ? "image/webp" : "image/png";
    const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, 1));
    if (!blob || blob.type !== mime) throw new Error(`This browser could not create ${options.format.toUpperCase()}. Try PNG or SVG.`);
    if (options.format === "pdf") {
      downloadBlob(await createPdfBlob(blob, dimensions.page, title), `${filename}.pdf`);
    } else downloadBlob(blob, `${filename}.${options.format}`);
  } finally { canvas.width = 1; canvas.height = 1; }
}
