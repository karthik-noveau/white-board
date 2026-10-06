import { refineTemplate } from './templateWorkspaces.js';

const settings={shape:"round",color:"white",structure:"elbow",pattern:"solid",weight:"regular"};
const node=(id,x,y,title,note,color="white",shape="round",root=false)=>({id,x,y,title,note,color,shape,root});
const edge=(id,from,to,side="right")=>({id,from,to,side,structure:"elbow",pattern:"solid",weight:"regular"});
const board=(nodes,edges,globalSettings={})=>({nodes,edges:edges.map(connection=>({...connection,...(globalSettings.structure?{structure:globalSettings.structure}:{}),...(globalSettings.pattern?{pattern:globalSettings.pattern}:{})})),globalSettings:{...settings,...globalSettings}});

const starterTemplates=[
  {id:"product-roadmap",name:"Product roadmap",description:"Connect vision, bets, releases, and outcomes.",accent:"violet",board:board([
    node(1,1180,740,"Product vision","Where we are going","violet","round",true),node(2,1580,500,"Customer value","Problems worth solving","pink"),node(3,1580,740,"Strategic bets","What we believe","green"),node(4,1580,980,"Success signals","How we measure","amber"),node(5,1940,630,"Now","Current release"),node(6,1940,850,"Next","Upcoming opportunities")
  ],[edge(1,1,2),edge(2,1,3),edge(3,1,4),edge(4,3,5),edge(5,3,6)] )},
  {id:"project-plan",name:"Project plan",description:"Organize phases, owners, and delivery milestones.",accent:"blue",board:board([
    node(1,1180,760,"Project outcome","Definition of done","blue","soft",true),node(2,780,570,"Discover","Scope and constraints","amber"),node(3,780,930,"Prepare","People and resources","orange"),node(4,1580,570,"Build","Core delivery","green"),node(5,1580,760,"Launch","Release readiness","pink"),node(6,1580,950,"Learn","Review and improve","white")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5),edge(5,1,6)])},
  {id:"customer-journey",name:"Customer journey",description:"Map stages, moments, emotions, and opportunities.",accent:"pink",board:board([
    node(1,650,760,"Discover","First signal","pink","pill",true),node(2,1000,760,"Consider","Explore options","white","pill"),node(3,1350,760,"Start","First experience","green","pill"),node(4,1700,760,"Adopt","Build a habit","blue","pill"),node(5,2050,760,"Advocate","Share the value","violet","pill"),node(6,1350,1010,"Opportunity","Remove first-run friction","amber","soft")
  ],[edge(1,1,2),edge(2,2,3),edge(3,3,4),edge(4,4,5),edge(5,3,6,"bottom")],{shape:"pill"})},
  {id:"swot",name:"SWOT analysis",description:"Balance internal strengths with external signals.",accent:"orange",board:board([
    node(1,1230,760,"Strategic position","What should we do?","orange","soft",true),node(2,780,500,"Strengths","Internal advantages","green","soft"),node(3,780,1000,"Weaknesses","Internal constraints","pink","soft"),node(4,1680,500,"Opportunities","External upside","blue","soft"),node(5,1680,1000,"Threats","External risk","amber","soft")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5)])},
  {id:"brainstorm",name:"Radial brainstorm",description:"Expand one idea in every direction.",accent:"green",board:board([
    node(1,1230,760,"Big idea","Think freely","green","circle",true),node(2,1230,390,"Why?","Purpose and impact","pink","ellipse"),node(3,1710,760,"What?","Possibilities","blue","ellipse"),node(4,1230,1130,"How?","Approaches","orange","ellipse"),node(5,750,760,"Who?","People involved","violet","ellipse"),node(6,1650,430,"Wild card","Unexpected angle","amber","pill")
  ],[edge(1,1,2,"top"),edge(2,1,3),edge(3,1,4,"bottom"),edge(4,1,5,"left"),edge(5,2,6)])},
  {id:"org-chart",name:"Team map",description:"Visualize teams, roles, and reporting lines.",accent:"violet",board:board([
    node(1,1230,400,"Leadership","Direction and alignment","violet","round",true),node(2,780,720,"Product","Strategy and discovery","blue"),node(3,1230,720,"Design","Experience and systems","pink"),node(4,1680,720,"Engineering","Platform and delivery","green"),node(5,650,990,"Research","Customer insight"),node(6,910,990,"Growth","Adoption"),node(7,1550,990,"Web","Experience"),node(8,1810,990,"Platform","Foundations")
  ],[edge(1,1,2,"bottom"),edge(2,1,3,"bottom"),edge(3,1,4,"bottom"),edge(4,2,5,"bottom"),edge(5,2,6,"bottom"),edge(6,4,7,"bottom"),edge(7,4,8,"bottom")])},
  {id:"decision-tree",name:"Decision tree",description:"Compare choices, evidence, and consequences.",accent:"amber",board:board([
    node(1,720,760,"Decision","What are we choosing?","amber","soft",true),node(2,1120,570,"Option A","Primary path","green"),node(3,1120,950,"Option B","Alternative path","blue"),node(4,1520,450,"Upside","Best outcome","white","pill"),node(5,1520,690,"Risk","What could fail","pink","pill"),node(6,1520,830,"Upside","Best outcome","white","pill"),node(7,1520,1070,"Risk","What could fail","orange","pill")
  ],[edge(1,1,2),edge(2,1,3),edge(3,2,4),edge(4,2,5),edge(5,3,6),edge(6,3,7)])},
  {id:"study-notes",name:"Study notes",description:"Connect concepts, evidence, and questions.",accent:"blue",board:board([
    node(1,1180,720,"Core concept","Course or chapter","blue","soft",true),node(2,760,500,"Definition","Explain simply","white","rectangle"),node(3,760,940,"Key question","What is unresolved?","pink","rectangle"),node(4,1580,450,"Key idea","Explain in your own words","green","round"),node(5,1580,720,"Related idea","How does it connect?","amber","round"),node(6,1580,990,"Example","Apply the concept","orange","round")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5),edge(5,1,6)],{pattern:"dotted"})},
  {id:"retrospective",name:"Team retrospective",description:"Reflect on wins, friction, and next actions.",accent:"green",board:board([
    node(1,1230,500,"Team retrospective","Learn together","green","pill",true),node(2,760,820,"Went well","Keep doing","green","soft"),node(3,1230,820,"Was difficult","Understand friction","pink","soft"),node(4,1700,820,"Try next","Small experiments","blue","soft"),node(5,760,1080,"Celebrate","Recognize the team","white","pill"),node(6,1230,1080,"Root cause","Look beneath","orange","pill"),node(7,1700,1080,"Owner + date","Make it real","amber","pill")
  ],[edge(1,1,2,"bottom"),edge(2,1,3,"bottom"),edge(3,1,4,"bottom"),edge(4,2,5,"bottom"),edge(5,3,6,"bottom"),edge(6,4,7,"bottom")])},
  {id:"content-system",name:"Content system",description:"Plan themes, channels, stories, and cadence.",accent:"orange",board:board([
    node(1,1180,740,"Editorial direction","What we want to own","orange","round",true),node(2,780,520,"Audience","Who we serve","pink","pill"),node(3,780,960,"Voice","How we sound","violet","pill"),node(4,1580,470,"Educate","Teach one useful skill","blue","soft"),node(5,1580,650,"Inspire","Share a new perspective","green","soft"),node(6,1580,830,"Build trust","Show evidence and results","amber","soft"),node(7,1580,1010,"Invite action","Offer a clear next step","orange","soft")
  ],[edge(1,1,2,"left"),edge(2,1,3,"left"),edge(3,1,4),edge(4,1,5),edge(5,1,6),edge(6,1,7)],{structure:"curve"})},
];

export const templateCategories = [
  { id: "planning", name: "Planning", icon: "calendar", description: "Turn priorities into a plan you can follow." },
  { id: "product", name: "Product & research", icon: "layout", description: "Understand your customers and build with purpose." },
  { id: "teamwork", name: "Teamwork", icon: "comment", description: "Get aligned, share ownership, and work better together." },
  { id: "strategy", name: "Strategy & ideas", icon: "spark", description: "Explore possibilities and make a confident decision." },
  { id: "content", name: "Content & marketing", icon: "pencil", description: "Give every story, page, and campaign a clear direction." },
  { id: "life", name: "Learning & life", icon: "map", description: "Make room for learning, personal goals, and adventures." },
];

// Short prompts stay readable on the canvas; the library supplies the walkthrough.
const starterGuides = {
  "product-roadmap": { category: "product", tags: ["release", "priorities", "now next later"], steps: ["Name the customer outcome you want to achieve.", "Connect each strategic bet to a release or experiment.", "Add a measurable success signal before committing to the work."] },
  "project-plan": { category: "planning", tags: ["milestones", "delivery", "kickoff"], steps: ["Write a concrete outcome and a definition of done.", "Add deliverables, an owner, and a date under each phase.", "Connect dependencies and review launch readiness with the team."] },
  "customer-journey": { category: "product", tags: ["experience", "user", "UX", "onboarding"], steps: ["Choose one customer and the task they are trying to complete.", "Record their action and biggest friction at each stage.", "Use the opportunity branch to choose one experience to improve."] },
  swot: { category: "strategy", tags: ["business", "analysis", "opportunities"], steps: ["Name the business, project, or decision you are assessing.", "Add evidence to each quadrant, separating internal from external factors.", "Turn your strongest opportunity and biggest risk into next actions."] },
  brainstorm: { category: "strategy", tags: ["ideation", "creative", "workshop"], steps: ["Replace Big idea with a specific question or challenge.", "Add possibilities freely under Why, What, How, and Who.", "Star promising ideas and choose one small experiment to try."] },
  "org-chart": { category: "teamwork", tags: ["roles", "people", "organization"], steps: ["Replace the example teams with your actual structure.", "Add a name and a responsibility to each role.", "Connect reporting lines and identify gaps in ownership."] },
  "decision-tree": { category: "strategy", tags: ["choices", "tradeoffs", "risk"], steps: ["Write the decision and the date it needs to be made.", "Compare each option using the same benefits, risks, and evidence.", "Choose a path and record what would make you reconsider."] },
  "study-notes": { category: "life", tags: ["school", "exam", "revision", "education"], steps: ["Name a topic and explain it in your own words.", "Connect the key ideas to examples and supporting evidence.", "Turn unresolved questions into prompts for your next review."] },
  retrospective: { category: "teamwork", tags: ["agile", "sprint", "reflection", "workshop"], steps: ["Choose a sprint or project to reflect on together.", "Add specific examples of what worked and what caused friction.", "Choose one experiment and give it an owner and a review date."] },
  "content-system": { category: "content", tags: ["editorial", "social", "publishing"], steps: ["Define your audience and the point of view you want to be known for.", "Add a real story idea beneath each content theme.", "Assign a channel, owner, and publishing date to each story."] },
};

// Balanced branches leave generous connector lanes without an oversized canvas.
function practicalTemplate({ id, name, description, category, accent, tags, steps, root, branches }) {
  const nodes = [{ ...node(1, 1194, 790, ...root, accent, "round", true), w: 272, h: 108 }];
  const edges = [];
  branches.forEach(([title, noteText, children], index) => {
    const left = index < 2, side = left ? "left" : "right";
    const y = index % 2 === 0 ? 600 : 980;
    const parentId = nodes.length + 1;
    nodes.push({ ...node(parentId, left ? 824 : 1576, y, title, noteText, accent), w: 260, h: 108 });
    edges.push(edge(edges.length + 1, 1, parentId, side));
    children.forEach(([childTitle, childNote], childIndex) => {
      const childId = nodes.length + 1;
      nodes.push({ ...node(childId, left ? 454 : 1946, y - 80 + childIndex * 160, childTitle, childNote), w: 260, h: 108 });
      edges.push(edge(edges.length + 1, parentId, childId, side));
    });
  });
  return { id, name, description, category, accent, tags, steps, board: board(nodes, edges) };
}

const practicalTemplates = [
  {
    id: "weekly-plan", name: "Weekly priorities", description: "Make space for focused work, commitments, and a Friday reset.", category: "planning", accent: "blue", tags: ["personal", "productivity", "schedule"],
    root: ["This week", "A realistic plan for your time"],
    steps: ["Name the week and choose the outcome that matters most.", "Break priorities into small actions and reserve time for them.", "Review on Friday: celebrate progress and move unfinished work deliberately."],
    branches: [
      ["Top priorities", "Choose three things that matter", [["Must finish", "What needs to be done?"], ["Meaningful progress", "What would move you forward?"]]],
      ["Commitments", "Check your real capacity", [["Meetings & deadlines", "What is already on the calendar?"], ["Make room", "What can you defer or decline?"]]],
      ["Focus time", "Protect time to do the work", [["Next action", "Break one priority into a task"], ["Time blocks", "When will you work on it?"]]],
      ["Friday reset", "Close the loop", [["Wins & lessons", "What worked this week?"], ["Carry forward", "What belongs in next week?"]]],
    ],
  },
  {
    id: "okr-planning", name: "Goals & OKRs", description: "Connect a quarterly goal to measurable results and weekly action.", category: "planning", accent: "violet", tags: ["objectives", "quarterly", "metrics"],
    root: ["Quarterly objective", "What change do we want to see?"],
    steps: ["Write one ambitious, clear objective for the quarter.", "Give each key result a baseline, target, and accountable owner.", "Choose initiatives and a weekly check-in to track the evidence."],
    branches: [
      ["Key result 1", "Define a measurable outcome", [["Baseline → target", "Where are we; where next?"], ["Owner & evidence", "Who measures it, and how?"]]],
      ["Key result 2", "Measure another success signal", [["Baseline → target", "Use a number and a deadline"], ["Owner & evidence", "Name the source of truth"]]],
      ["Initiatives", "Work that can change the result", [["First experiment", "Smallest useful step"], ["Dependencies", "What needs to happen first?"]]],
      ["Weekly check-in", "Learn and adjust", [["Confidence & risk", "What could block the target?"], ["Next decision", "Continue, adapt, or stop?"]]],
    ],
  },
  {
    id: "event-plan", name: "Event planner", description: "Bring the audience, logistics, run of show, and follow-up together.", category: "planning", accent: "amber", tags: ["workshop", "conference", "meetup", "logistics"],
    root: ["Our event", "Purpose, date, and place"],
    steps: ["Define who the event is for and what they should leave with.", "Assign an owner and deadline to each logistical detail.", "Walk through the run of show and prepare a backup for the biggest risk."],
    branches: [
      ["Audience & outcome", "Make the event worth attending", [["Who is coming?", "Guest list and capacity"], ["Success looks like", "What should people take away?"]]],
      ["Logistics", "Get the essentials in place", [["Venue & equipment", "Space, access, and tech check"], ["Budget & suppliers", "Costs, bookings, and owners"]]],
      ["Run of show", "Plan the experience", [["Agenda & speakers", "Timing and who leads each part"], ["Backup plan", "What if something changes?"]]],
      ["Communication", "Before and after", [["Invitations", "Message, channel, and RSVP"], ["Follow-up", "Resources, feedback, thanks"]]],
    ],
  },
  {
    id: "user-research", name: "User research plan", description: "Turn assumptions into interview questions, evidence, and decisions.", category: "product", accent: "pink", tags: ["customer", "interview", "discovery", "UX"],
    root: ["Research question", "What do we need to learn?"],
    steps: ["Start with the decision this research will inform.", "Recruit relevant participants and ask about recent, real experiences.", "Group observations into themes and connect each insight to evidence."],
    branches: [
      ["Learning goals", "Expose the unknowns", [["Assumptions", "What do we believe today?"], ["Decision to inform", "What will the findings change?"]]],
      ["Participants", "Hear from the right people", [["Recruiting criteria", "Who has this problem?"], ["Recruitment plan", "Where and when to reach them"]]],
      ["Interview guide", "Ask about real experiences", [["Recent experience", "Walk me through the last time"], ["Workarounds", "What did you try instead?"]]],
      ["Synthesis", "Turn observations into insight", [["Patterns & evidence", "Quotes, examples, and themes"], ["Recommended action", "What should we test next?"]]],
    ],
  },
  {
    id: "feature-brief", name: "Feature brief", description: "Agree on the problem, smallest useful scope, and success criteria.", category: "product", accent: "blue", tags: ["PRD", "requirements", "MVP", "design"],
    root: ["Feature proposal", "One problem worth solving"],
    steps: ["Describe the user problem with evidence, before proposing a solution.", "Set the smallest useful scope and explicitly name what is excluded.", "Agree on a success metric and a rollout decision with your team."],
    branches: [
      ["The problem", "Why this matters now", [["User & need", "Who struggles, and with what?"], ["Evidence", "Feedback, behavior, or data"]]],
      ["The solution", "A clear first version", [["Core experience", "The main path through it"], ["Out of scope", "What are we leaving for later?"]]],
      ["Delivery", "Make the work achievable", [["Dependencies", "People, systems, decisions"], ["Risks & questions", "What must we validate first?"]]],
      ["Success", "Know whether it helped", [["Metric & target", "What change will we measure?"], ["Rollout & learning", "Who gets it first; review when?"]]],
    ],
  },
  {
    id: "meeting-agenda", name: "Meeting to action", description: "Keep a meeting focused and leave with decisions, owners, and dates.", category: "teamwork", accent: "violet", tags: ["agenda", "notes", "action items", "sync"],
    root: ["Meeting outcome", "What must we leave with?"],
    steps: ["Name the desired outcome and share any reading in advance.", "Timebox discussion around decisions that need the group.", "Close by reading back each action, owner, and due date."],
    branches: [
      ["Before we meet", "Help everyone arrive prepared", [["People & roles", "Who decides; who contributes?"], ["Pre-reading", "What context do we need?"]]],
      ["Discussion", "Give each topic a timebox", [["Topic & question", "What needs the group's input?"], ["Parking lot", "Useful, but outside this meeting"]]],
      ["Decisions", "Record the outcome", [["What we agreed", "Decision and reason behind it"], ["Still open", "What evidence is missing?"]]],
      ["Actions", "Leave with clear ownership", [["Task & owner", "One person per next action"], ["Due date & follow-up", "When will we check progress?"]]],
    ],
  },
  {
    id: "onboarding", name: "30 / 60 / 90 day plan", description: "Help a new teammate learn, contribute, and take ownership.", category: "teamwork", accent: "green", tags: ["new hire", "employee", "onboarding", "manager"],
    root: ["A strong start", "New role, manager, start date"],
    steps: ["Adapt the milestones to the role and agree on expectations together.", "Add a buddy, key contacts, and resources for the first month.", "Schedule 30, 60, and 90 day conversations to review progress and support."],
    branches: [
      ["Before day one", "Remove first-day friction", [["Tools & access", "Equipment, accounts, workspace"], ["People & context", "Buddy, team, essential reading"]]],
      ["First 30 days", "Learn and build relationships", [["Listen & observe", "Customers, team, and workflows"], ["First small win", "A useful task with support"]]],
      ["By day 60", "Contribute with confidence", [["Own a deliverable", "A clear outcome to work toward"], ["Feedback check-in", "What is working; what is hard?"]]],
      ["By day 90", "Take ownership", [["Lead an initiative", "Make a measurable contribution"], ["Next growth goal", "Agree on the next milestone"]]],
    ],
  },
  {
    id: "root-cause", name: "Root cause analysis", description: "Trace a recurring problem to evidence, causes, and a lasting fix.", category: "strategy", accent: "amber", tags: ["problem solving", "incident", "five whys", "fishbone"],
    root: ["The problem", "What happened; where and when?"],
    steps: ["Describe the observed problem without assigning blame.", "Ask why, distinguish evidence from assumptions, and look for contributing factors.", "Choose a corrective action and a signal that will show whether it worked."],
    branches: [
      ["Facts & impact", "Agree on the observed facts", [["Timeline", "Key events and observations"], ["Who was affected?", "Scope, duration, and impact"]]],
      ["Possible causes", "Explore without blame", [["Process & handoffs", "Where could the flow fail?"], ["Tools & conditions", "What allowed it to happen?"]]],
      ["Trace the cause", "Ask why; verify each step", [["Evidence to check", "What supports this explanation?"], ["Contributing factors", "What else had to be true?"]]],
      ["Prevent a repeat", "Address the underlying cause", [["Action & owner", "What changes; who leads?"], ["Verify the fix", "Measure results on a set date"]]],
    ],
  },
  {
    id: "campaign-plan", name: "Campaign plan", description: "Align your audience, message, channels, and measures of success.", category: "content", accent: "pink", tags: ["launch", "marketing", "promotion", "social"],
    root: ["Campaign goal", "One outcome to work toward"],
    steps: ["Choose one audience, a clear offer, and the action you want them to take.", "Plan each channel around that message and assign the assets.", "Set a baseline, a target, and a review date before launch."],
    branches: [
      ["Audience", "Be specific about who", [["Need & motivation", "Why would they care now?"], ["Desired action", "What should they do next?"]]],
      ["Message & offer", "Give them a reason to act", [["Core promise", "One clear benefit"], ["Proof & call to action", "Proof and a clear next step"]]],
      ["Channels & assets", "Meet people where they are", [["Channel mix", "Email, social, partners, search"], ["Production plan", "Assets, owners, and deadlines"]]],
      ["Launch & measure", "Learn from real results", [["Schedule & budget", "Timing, spend, checkpoints"], ["Success metric", "Baseline, target, review date"]]],
    ],
  },
  {
    id: "article-outline", name: "Article outline", description: "Shape a useful article around a reader question and a clear takeaway.", category: "content", accent: "orange", tags: ["writing", "blog", "essay", "story"],
    root: ["Working headline", "What will the reader learn?"],
    steps: ["Identify one reader question and the takeaway your article will deliver.", "Build the argument with evidence and a concrete example.", "Draft the introduction last, then cut anything that does not serve the reader."],
    branches: [
      ["Reader & purpose", "Write for someone specific", [["Reader question", "What are they trying to solve?"], ["Main takeaway", "One thing they should remember"]]],
      ["Opening", "Make the value clear", [["Hook", "Question, scene, or observation"], ["Promise", "What this article will explain"]]],
      ["The argument", "Build understanding step by step", [["Key point & evidence", "Claim, source, and explanation"], ["Example & nuance", "Show it; address an objection"]]],
      ["Ending & review", "Leave the reader with a next step", [["Conclusion", "Connect back to the takeaway"], ["Final edit", "Clarity, facts, links, next action"]]],
    ],
  },
  {
    id: "website-plan", name: "Website sitemap", description: "Plan your pages around visitor needs and clear next steps.", category: "content", accent: "blue", tags: ["web", "navigation", "information architecture", "design"],
    root: ["Our website", "Who it serves; what it helps do"],
    steps: ["Name the primary visitor and the task your website must help them finish.", "Use each branch as a page group and add the essential pages underneath.", "Check that every page has a purpose, an owner, and a clear next step."],
    branches: [
      ["Discover", "Help visitors understand you", [["Home", "Value proposition and next step"], ["About", "Story, people, and credibility"]]],
      ["Explore", "Help visitors evaluate the offer", [["Product or services", "Benefits, details, and proof"], ["Pricing or packages", "Options and common questions"]]],
      ["Learn", "Answer real visitor questions", [["Resources", "Guides, articles, and examples"], ["Help & FAQ", "Answers and support routes"]]],
      ["Take action", "Make the next step obvious", [["Contact or sign up", "A short, purposeful form"], ["Confirmation", "What happens after submitting?"]]],
    ],
  },
  {
    id: "learning-plan", name: "Learning plan", description: "Build a skill through focused study, practice, and useful feedback.", category: "life", accent: "green", tags: ["skill", "course", "education", "practice"],
    root: ["Skill to develop", "What do you want to master?"],
    steps: ["Choose an observable skill and a small project that will demonstrate it.", "Pick a few resources and schedule regular practice, not just reading.", "Seek feedback and update the plan based on what remains difficult."],
    branches: [
      ["Starting point", "Know where you are", [["What I know", "Existing skills and experience"], ["What I need", "Gaps and a realistic deadline"]]],
      ["Study", "Keep the resource list focused", [["Core resource", "One course, book, or guide"], ["Key concepts", "Ideas to explain in your words"]]],
      ["Practice", "Learn by doing", [["Small project", "Put the skill to use"], ["Practice schedule", "When and how often?"]]],
      ["Feedback & progress", "Make learning visible", [["Get feedback", "Who can review your work?"], ["Next milestone", "What can you now do unaided?"]]],
    ],
  },
  {
    id: "career-plan", name: "Career growth plan", description: "Connect the work you want to do with skills, evidence, and opportunities.", category: "life", accent: "violet", tags: ["personal", "development", "goals", "promotion"],
    root: ["My next chapter", "What kind of work do I want?"],
    steps: ["Describe the work and conditions you want more of.", "Choose one skill gap and a project that will demonstrate progress.", "Plan a conversation with someone who can offer feedback or an opportunity."],
    branches: [
      ["Direction", "Define what matters to you", [["Strengths & energy", "What work brings out your best?"], ["Target role", "Responsibilities you want next"]]],
      ["Skills to grow", "Close a meaningful gap", [["Priority skill", "What unlocks the next step?"], ["Learning action", "Practice, course, or mentoring"]]],
      ["Evidence", "Show what you can do", [["Stretch project", "A useful challenge to take on"], ["Impact record", "Outcomes, examples, feedback"]]],
      ["Support & next steps", "Make a plan with people", [["Key conversation", "Manager, mentor, or peer"], ["30-day action", "One step and a review date"]]],
    ],
  },
  {
    id: "trip-plan", name: "Trip planner", description: "Keep the itinerary, bookings, budget, and essentials in one place.", category: "life", accent: "amber", tags: ["travel", "holiday", "vacation", "personal"],
    root: ["Our next trip", "Destination, dates, and travelers"],
    steps: ["Agree on dates, a budget, and what each traveler most wants to do.", "Map the essential bookings and leave room in the itinerary.", "Review documents, transport, and the packing list before departure."],
    branches: [
      ["The plan", "Choose the kind of trip you want", [["Must-do experiences", "Top picks from each traveler"], ["Loose itinerary", "A daily anchor; room to explore"]]],
      ["Bookings", "Keep the essentials together", [["Getting there", "Tickets, times, transfers"], ["Where to stay", "Address, check-in, confirmation"]]],
      ["Budget", "Know the total before you go", [["Fixed costs", "Travel, stays, reservations"], ["Daily spending", "Food, activities, and a buffer"]]],
      ["Before departure", "A calmer start to the trip", [["Documents & essentials", "ID, entry rules, contacts"], ["Packing & home", "Weather, chargers, final checks"]]],
    ],
  },
].map(practicalTemplate);

export const templates = [
  ...starterTemplates.map(template => ({
    ...template,
    ...starterGuides[template.id],
    board: { ...template.board, nodes: template.board.nodes.map(item => ({ ...item, h: item.shape === "circle" ? 144 : 108 })) },
  })),
  ...practicalTemplates,
].map(refineTemplate);

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
