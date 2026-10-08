import { refineTemplate } from './templateWorkspaces.js';

const templateCatalog = [
  {
    "id": "product-roadmap",
    "name": "Product roadmap",
    "description": "Choose what to deliver now, test next, and explore later.",
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
    "description": "Move from a clear outcome to milestones, owners, and a launch.",
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
    "description": "Explore a question from four angles and choose an idea to test.",
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
    "description": "Explain a concept, connect examples, and check what you remember.",
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
    "description": "Choose a priority, protect your focus time, and review the week.",
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
    "description": "Turn a focused discussion into decisions, owners, and next steps.",
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
    description: 'Collect customer evidence, compare opportunities, and plan a useful test.',
    accent: 'violet', category: 'product', tags: ['customer', 'research', 'validation', 'experiment'],
    steps: [
      'Frame the customer problem and map the people affected by it.',
      'Capture evidence, compare solutions, and surface the riskiest assumptions.',
      'Choose a small experiment and agree what result would justify the next step.',
    ],
  },
  {
    id: 'business-strategy', name: 'Business strategy', complexity: 'complex',
    description: 'Connect your strategic choices to initiatives and measurable outcomes.',
    accent: 'green', category: 'strategy', tags: ['business', 'goals', 'positioning', 'execution'],
    steps: [
      'Define the ambition and choose the customers and opportunities to focus on.',
      'Describe your distinct value and the capabilities needed to deliver it.',
      'Give each initiative an owner, a success signal, and a reason to revisit it.',
    ],
  },
  {
    id: 'website-architecture', name: 'Website architecture', complexity: 'complex',
    description: 'Give every page a purpose, organize its content, and prepare to publish.',
    accent: 'blue', category: 'product', tags: ['website', 'sitemap', 'navigation', 'content', 'UX'],
    steps: [
      'Name the main visitor goal and choose the sections your site needs.',
      'Give each page a clear purpose and connect it to useful supporting content.',
      'Walk through discovery, evaluation, action, and support before designing pages.',
    ],
  },
  {
    id: 'product-launch', name: 'Product launch', complexity: 'complex',
    description: 'Align your message, release owners, readiness checks, and follow-up.',
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
