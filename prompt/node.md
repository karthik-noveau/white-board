#### 🧠 Prompt: _Text Node + Auto-Connect on Click_

**Goal:** Build a whiteboard feature where clicking a text node automatically creates a new connected text node with an arrow.
**Feature Context:**

- Framework: React + Canvas or SVG (your choice)
- Library allowed: ReactFlow or custom SVG logic
- Styling: CSS Module (camelCase naming convention)
- Each node contains editable text
- When I click on a node, a new text node appears next to it (right side) and connects automatically via an arrow
- Arrow should smoothly connect from center-right of first node to center-left of new node
- Keep component modular:
  - `TextNode.jsx`
  - `Edge.jsx`
  - `Canvas.jsx` (main parent that manages nodes and edges)
- Maintain clean React state (useState / useReducer) for storing node and edge data
- Keep all CSS isolated (`textNode.module.css`, `edge.module.css`, `canvas.module.css`)
  **Interactions:**

1. Click anywhere → Add first node
2. Click existing node → Adds a new node connected by arrow
3. Drag nodes → Edges auto-update
   **Deliverable:**
   Generate production-ready React code (JSX + CSS Modules) for this specific feature only.
   Don’t include other systems like zoom, grid, or toolbar.

---

### 💡 Example Expected Flow (After You Run the Prompt)

1. You click the canvas → `TextNode 1` appears.
2. You click `TextNode 1` → `TextNode 2` appears to the right.
3. An arrow connects `TextNode 1 → TextNode 2`.
4. Clicking `TextNode 2` creates another one to the right, and so on
