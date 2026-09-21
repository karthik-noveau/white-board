import DOMPurify from "dompurify";

const richTextTags = ["b", "strong", "i", "em", "u", "s", "strike", "del", "br", "div", "p", "span", "ul", "ol", "li", "blockquote", "pre", "code", "a", "font", "sub", "sup"];
const textStyles = new Set(["color", "background-color", "font-size", "font-family", "font-weight", "font-style", "text-decoration", "text-align", "line-height", "letter-spacing", "white-space"]);

function cleanRichText(html) {
  const fragment = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: richTextTags,
    ALLOWED_ATTR: ["href", "title", "style", "color", "face", "size", "start", "type"],
    RETURN_DOM_FRAGMENT: true,
  });
  for (const element of fragment.querySelectorAll("[style]")) {
    const declarations = [...element.style].map(key => [key, element.style.getPropertyValue(key)]);
    element.removeAttribute("style");
    for (const [key, value] of declarations) {
      if (textStyles.has(key) && !/url\s*\(|expression\s*\(|[\\@]/i.test(value)) element.style.setProperty(key, value);
    }
  }
  const container = document.createElement("div");
  container.append(fragment);
  return container.innerHTML;
}

// Shared rich text is external content; only text formatting may enter the DOM.
export function sanitizeSharedProject(project) {
  return { ...project, board: sanitizeBoard(project.board) };
}

function sanitizeBoard(board) {
  return { ...board, nodes: board.nodes.map(node => ({
    ...node,
    ...(node.titleHtml != null ? { titleHtml: cleanRichText(node.titleHtml) } : {}),
    ...(node.noteHtml != null ? { noteHtml: cleanRichText(node.noteHtml) } : {}),
    ...(node.links ? { links: node.links.filter(link => /^(https?:\/\/|mailto:|tel:)/i.test(link.url)) } : {}),
  })), ...(board.savedViews ? { savedViews: board.savedViews.map(view => ({
    ...view, ...(view.board ? { board: sanitizeBoard(view.board) } : {}),
  })) } : {}) };
}
