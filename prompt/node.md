- **Anchor click = immediate node creation** (no menu, no confirmation).
- Each click updates **state** → pushes a new node + edge.
- Layout offsets are calculated **dynamically per anchor click**.

Here’s how I’d refine your prompt so the output code behaves as you expect 👇

---

# 🧠 **Updated Prompt: Interactive Whiteboard System**

**🎯 Goal:**
Build a **whiteboard system** with interactive nodes, dynamic connections, and comprehensive canvas controls. Clicking any anchor point of a node **automatically spawns a new connected node** without extra steps. Each anchor expands in an **alternating non-colliding pattern**.

---

## **Implementation Requirements**

- **Framework:** React (with plain Canvas/SVG).
- **Styling:** CSS Modules (`camelCase`).
- **Files:**

  - `Canvas.jsx` (manages state + layout rules, canvas interactions)
  - `TextNode.jsx` (renders node, text, anchors, lock icon)
  - `Edge.jsx` (renders connecting arrows)
  - Styles: `canvas.module.css`, `textNode.module.css`, `edge.module.css`

---

## **Critical Auto-Creation Behavior**

- Each **anchor click** = **instant node + edge creation**.
- No confirmation, no context menu, no button press.
- Placement calculated automatically per **anchor’s sequence counter**.
- **Anchor Visibility:** Anchors are only visible when their parent node is clicked/selected.

---

## **Features (Pixel-Perfect)**

### 📝 **Text Nodes**

- Draggable, edges auto-adjust.
- 4 anchors (top, right, bottom, left).
- Anchors are **individually clickable** → each manages its own sequence. 
- Anchors should show only when i click the node

### 🔄 **Expansion Rules**

- **Top Anchor**:

  - 1st click → node above.
  - 2nd → node right of the above node.
  - 3rd → node left.
  - 4th → further right.
  - 5th → further left.
  - Pattern continues alternating.

- **Right Anchor**:

  - 1st click → node right.
  - 2nd → below that node.
  - 3rd → above.
  - 4th → further below.
  - 5th → further above.
  - Alternates vertically.

- **Bottom Anchor**: mirror of **Top** (expands downward alternating left-right).

- **Left Anchor**: mirror of **Right** (expands left alternating up-down).

### 🔗 **Edges**

- **Elbow Connectors:** Edges are rendered as elbow (90-degree bend) arrow connectors.
- **Arrowheads:** Edges feature arrowheads at the target node.

---

## **Canvas Interactions**

1.  **Click "Create Node" button** → first text node appears centered.
2.  **Click an anchor** → new node is created instantly at correct offset.
3.  **Click again** → new nodes keep expanding alternately without overlap.
4.  **Drag** → edges auto-update.
5.  **Zoom:** Canvas can be zoomed using mouse wheel, `+`/`-` buttons, and keyboard (`cmd/ctr + +`/`cmd/ctr + -`/`cmd/ctr + 0`).
7.  **Canvas Locking:** Entire canvas can be locked/unlocked, preventing all interactions.
8.  **Fullscreen:** Toggle fullscreen mode via a toolbar button.

---

## **Toolbar Options**

- **Create Node Button:** Adds a new node to the canvas.
- **Lock Canvas Button:** Toggles locking/unlocking all canvas interactions.
- **Fullscreen Button:** Toggles fullscreen mode.
- **Zoom In Button (`+`):** Zooms in the canvas.
- **Zoom Out Button (`-`):** Zooms out the canvas.

---

## **Keyboard Actions**

- **Zoom In:** `cmd/ctr + +`
- **Cener** `cmd/ctr + 0`
- **Zoom Out:** `cmd/ctr + -`
- **Drag** `cmd/ctr + mouse left and move`

---

## **Overview Mini-map**

- Displays a scaled-down view of the entire canvas.
- Shows nodes, edges, and a transparent rectangle representing the main canvas viewport.
- **Interactive:** Dragging the viewport rectangle on the mini-map pans the main canvas.

---

## **UI/UX Enhancements**

- **Dotted Background:** Main canvas has a subtle dotted grid background.
- **Refined Styling:** Improved styling for buttons, nodes, and anchors.

---

## **State Management**

- `nodes: { id, text, x, y, anchorUsage: { top: count, right: count, bottom: count, left: count } }`
- `edges: { id, sourceId, sourceAnchor, targetId }`
- `transform: { x: number, y: number, scale: number }` (for canvas zoom/pan)
- `isCanvasLocked: boolean`
- `activeNodeId: string | null` (for anchor visibility)

- On each anchor click:

  1. Increment anchor’s counter.
  2. Compute new `(x,y)` with alternating offset logic.
  3. Add new node + new edge to state.

---

## **Deliverable**

✅ React code with **auto node creation on anchor click**
✅ Each anchor expands nodes in alternating sequence
✅ Non-overlapping layout
✅ Modular clean structure (Canvas, TextNode, Edge)
✅ Comprehensive canvas controls (zoom, center, pan, lock, fullscreen)
✅ Interactive overview mini-map
✅ Refined UI/UX