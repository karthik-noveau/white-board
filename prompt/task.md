# 🗂️ Whiteboard System – Deep Feature Analysis (CamelCase Files + Module CSS)

---

## **1️⃣ Canvas (`canvas/`)**

### **canvas.jsx**

**Styles File:** `canvas.module.css`
**Features:**

1. **Infinite Canvas (pan/zoom/fit-to-view)**

   - Drag freely, zoom ±10%, pinch on touch devices
   - Fit-to-view adjusts viewport to show all nodes/edges
   - Virtualized rendering for performance

2. **Background themes:**

   - White, gray, dotted, lined
   - Optional snap-to-grid for precise placement

**CSS Styles:**

- **Background:** Off-white `#FAFAFA`, theme variations
- **Borders:** None (clean full background)
- **Font:** `DM Sans`, 14px, medium, color `#000000`
- **Positioning:** Full-screen container with flex/absolute fill
- **Extras:** Cursor styles (`grab`, `grabbing`)

**Why it matters:**
Foundation of the board; smooth pan/zoom + themes ensure comfort and performance.

---

### **grid.jsx**

**Styles File:** `grid.module.css`
**Features:**

- Toggle grid (solid/dotted)
- Snap-to-grid for node alignment

**CSS Styles:**

- **Grid lines:** 1px solid, color `#D0D0D0`
- **Dot grid:** radius 1–2px, opacity `0.5`
- **Spacing:** 20px/40px adjustable
- **Animations:** Fade in/out when toggled

**Why it matters:**
Provides visual guides for structured layouts and clarity.

---

## **2️⃣ Nodes (`nodes/`)**

### **node.jsx**

**Styles File:** `node.module.css`
**Features:**

- Node types: Text, Rich Text, Code (Monaco/Prism), Image, Sticky, Container/Group
- Interactive: resize/rotate handles, inline editing, z-index, color/theme customization

**CSS Styles:**

- **Node box:** Rounded corners (8px), white bg, border `1px solid #303030`, shadow `0 2px 4px rgba(0,0,0,0.1)`
- **Font:** `DM Sans`, 14px, color `#333333`
- **Hover:** Border highlight `#38B26C`
- **Handles:** 6px dots, positioned on corners/sides
- **Padding:** 8–12px

**Why it matters:**
Nodes represent tasks, ideas, or data. Interaction flexibility allows dynamic mapping.

---

### **groupNode.jsx**

**Styles File:** `groupNode.module.css`
**Features:**

- Collapse/expand group nodes
- Drag multiple nodes together
- Maintain relative positions

**CSS Styles:**

- **Border:** Dashed `2px #606060`
- **Background:** Slightly tinted (`rgba(56, 178, 108, 0.05)`)
- **Collapse button:** Rounded, small (20px), positioned top-right
- **Animation:** Smooth 200ms expand/collapse
- **Highlight:** Thicker border on drag

**Why it matters:**
Supports complex hierarchies without clutter, keeps boards manageable.

---

## **3️⃣ Edges (`edges/`)**

### **edge.jsx**

**Styles File:** `edge.module.css`
**Features:**

- Styles: straight, curved (Bezier), orthogonal
- Arrowheads: start, end, both, none
- Inline labels, auto-routing to avoid overlap

**CSS Styles:**

- **Line stroke:** 2px, default gray `#999999`, hover highlight `#38B26C`
- **Arrowheads:** Filled triangles, size 8–12px
- **Labels:** `DM Sans`, 12px, bg white, border `1px solid #D0D0D0`, padding 2px 6px, position auto
- **Routing:** Margin around nodes (10px gap)

**Why it matters:**
Edges visualize relationships clearly and prevent cluttered layouts.

---

## **4️⃣ Drawing Layer (`drawing/`)**

### **drawingLayer.jsx**

**Styles File:** `drawingLayer.module.css`
**Features:**

- Freehand pen, shapes (rect, circle, arrow, polygon)
- Eraser, stroke width/color/opacity
- Layer ordering above/below nodes, undo/redo

**CSS Styles:**

- **Shapes:** Border `1–3px`, color selectable
- **Active tool:** Button highlight (`#38B26C`)
- **Cursor:** Pen/eraser icons
- **Layering:** `z-index` higher than nodes, lower than UI toolbar

**Why it matters:**
Adds expressiveness for brainstorming, sketching, or presentations.

---

## **5️⃣ UI Components (`ui/`)**

### **toolbar.jsx**

**Styles File:** `toolbar.module.css`
**Features:**

- Buttons for node/group creation, drawing tools, zoom, save/export
- Tooltips, hover effects, keyboard shortcuts

**CSS Styles:**

- **Background:** White, shadow `0 2px 6px rgba(0,0,0,0.1)`
- **Button:** 36px, rounded (8px), hover `#F0F0F0`, active `#38B26C`
- **Tooltip:** Small, gray bg `#303030`, white text

**Why it matters:**
All major actions are accessible for efficiency.

---

### **sidebar.jsx**

**Styles File:** `sidebar.module.css`
**Features:**

- Node list/tree view, click to focus
- Hierarchical indentation for parent/child

**CSS Styles:**

- **Sidebar width:** 280px
- **Background:** Light gray `#F9F9F9`
- **Items:** Padding 8px, hover highlight `#EAEAEA`
- **Indentation:** 16px left margin per level

**Why it matters:**
Provides structured overview for large boards.

---

✅ **Summary of Feature Philosophy with camelCase Naming:**

1. **Modularity:** Each component has **its own camelCase CSS module**.
2. **Scalability:** Supports hundreds of nodes, edges, drawings, and groups.
3. **Interactivity:** Drag, resize, rotate, inline edit.
4. **Collaboration:** Multi-user sync and conflict-free editing.
5. **Persistence & Export:** Reliable, multiple formats.
6. **Pixel-Perfect UI:** Every button, node, edge, and tooltip is precisely styled.
7. **CamelCase Naming:** Consistent and easy imports across JS/React modules.
