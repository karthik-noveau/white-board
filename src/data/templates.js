import { refineTemplate } from './templateWorkspaces.js';

const templateCatalog = [
  {
    "id": "product-roadmap",
    "name": "Product roadmap",
    "description": "Connect vision, bets, releases, and outcomes.",
    "accent": "violet",
    "category": "product",
    "tags": [
      "release",
      "priorities",
      "now next later"
    ],
    "steps": [
      "Name the customer outcome you want to achieve.",
      "Connect each strategic bet to a release or experiment.",
      "Add a measurable success signal before committing to the work."
    ]
  },
  {
    "id": "project-plan",
    "name": "Project plan",
    "description": "Organize phases, owners, and delivery milestones.",
    "accent": "blue",
    "category": "planning",
    "tags": [
      "milestones",
      "delivery",
      "kickoff"
    ],
    "steps": [
      "Write a concrete outcome and a definition of done.",
      "Add deliverables, an owner, and a date under each phase.",
      "Connect dependencies and review launch readiness with the team."
    ]
  },
  {
    "id": "brainstorm",
    "name": "Radial brainstorm",
    "description": "Expand one idea in every direction.",
    "accent": "green",
    "category": "strategy",
    "tags": [
      "ideation",
      "creative",
      "workshop"
    ],
    "steps": [
      "Replace Big idea with a specific question or challenge.",
      "Add possibilities freely under Why, What, How, and Who.",
      "Star promising ideas and choose one small experiment to try."
    ]
  },
  {
    "id": "study-notes",
    "name": "Study notes",
    "description": "Connect concepts, evidence, and questions.",
    "accent": "blue",
    "category": "life",
    "tags": [
      "school",
      "exam",
      "revision",
      "education"
    ],
    "steps": [
      "Name a topic and explain it in your own words.",
      "Connect the key ideas to examples and supporting evidence.",
      "Turn unresolved questions into prompts for your next review."
    ]
  },
  {
    "id": "weekly-plan",
    "name": "Weekly priorities",
    "description": "Make space for focused work, commitments, and a Friday reset.",
    "accent": "blue",
    "category": "planning",
    "tags": [
      "personal",
      "productivity",
      "schedule"
    ],
    "steps": [
      "Name the week and choose the outcome that matters most.",
      "Break priorities into small actions and reserve time for them.",
      "Review on Friday: celebrate progress and move unfinished work deliberately."
    ]
  },
  {
    "id": "meeting-agenda",
    "name": "Meeting to action",
    "description": "Keep a meeting focused and leave with decisions, owners, and dates.",
    "accent": "violet",
    "category": "teamwork",
    "tags": [
      "agenda",
      "notes",
      "action items",
      "sync"
    ],
    "steps": [
      "Name the desired outcome and share any reading in advance.",
      "Timebox discussion around decisions that need the group.",
      "Close by reading back each action, owner, and due date."
    ]
  },
  {
    id: 'product-discovery', name: 'Product discovery', complexity: 'complex',
    description: 'Capture research in evidence tables, interview checklists, and experiment notes.',
    accent: 'violet', category: 'product', tags: ['customer', 'research', 'validation', 'experiment'],
    steps: [
      'Frame the customer problem and map the people affected by it.',
      'Capture evidence, compare solutions, and surface the riskiest assumptions.',
      'Choose a small experiment and agree what result would justify the next step.',
    ],
  },
  {
    id: 'business-strategy', name: 'Business strategy', complexity: 'complex',
    description: 'Work through strategic choices with scorecards, action lists, and review notes.',
    accent: 'green', category: 'strategy', tags: ['business', 'goals', 'positioning', 'execution'],
    steps: [
      'Define the ambition and choose the customers and opportunities to focus on.',
      'Describe your distinct value and the capabilities needed to deliver it.',
      'Give each initiative an owner, a success signal, and a reason to revisit it.',
    ],
  },
  {
    id: 'website-architecture', name: 'Website architecture', complexity: 'complex',
    description: 'Plan pages with content tables, checklists, code, and design references.',
    accent: 'blue', category: 'product', tags: ['website', 'sitemap', 'navigation', 'content', 'UX'],
    steps: [
      'Name the main visitor goal and choose the sections your site needs.',
      'Give each page a clear purpose and connect it to useful supporting content.',
      'Walk through discovery, evaluation, action, and support before designing pages.',
    ],
  },
  {
    id: 'product-launch', name: 'Product launch', complexity: 'complex',
    description: 'Coordinate release tables, readiness checklists, assets, and launch-day notes.',
    accent: 'violet', category: 'planning', tags: ['launch', 'release', 'marketing', 'readiness'],
    steps: [
      'Agree who the launch is for, the promise, and the outcome you will measure.',
      'Assign owners to readiness work and resolve dependencies before releasing.',
      'Monitor the launch, compare the signals, and choose the next improvement.',
    ],
  }
];

export const templateCategories = [
  { id: "planning", name: "Planning", icon: "calendar", description: "Turn priorities into a plan you can follow." },
  { id: "product", name: "Product & research", icon: "layout", description: "Understand your customers and build with purpose." },
  { id: "teamwork", name: "Teamwork", icon: "comment", description: "Get aligned, share ownership, and work better together." },
  { id: "strategy", name: "Strategy & ideas", icon: "spark", description: "Explore possibilities and make a confident decision." },
  { id: "life", name: "Learning & life", icon: "map", description: "Make room for learning, personal goals, and adventures." },
];

export const templates = templateCatalog.map(refineTemplate);

export const featuredTemplateIds = ["weekly-plan", "project-plan", "meeting-agenda"];

export function filterTemplates(category = "all", query = "") {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const featuredRank = id => { const index = featuredTemplateIds.indexOf(id); return index < 0 ? featuredTemplateIds.length : index; };
  return templates.filter(template => {
    if (category !== "all" && template.category !== category) return false;
    const categoryName = templateCategories.find(item => item.id === template.category)?.name || "";
    const text = [template.name, template.description, categoryName, ...template.tags].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  }).sort((a, b) => featuredRank(a.id) - featuredRank(b.id));
}
