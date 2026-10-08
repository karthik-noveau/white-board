import { arrangeTemplateBranches } from './templateDesigns.js';
import { createComplexTemplate } from './complexTemplateWorkspaces.js';
import { TYPES, walkContent } from '../lib/cellContent.js';

const idea = (title, note) => ({ title, note });
const branch = (title, note, color, ...items) => ({ title, note, color, items });

// One idea per card. Color follows a branch through its descendants; prompts
// invite real input without inventing progress, dates, people or results.
const workspaces = {
  'weekly-plan': {
    layout: 'side-map', label: 'Weekly priority map', root: idea('This week', 'Week of [date]. Choose one outcome that matters.'),
    groups: [
      branch('Make progress', 'Define a realistic finish line', 'blue',
        idea('One meaningful outcome', 'Finish [deliverable] by [day]. Why does it matter?'),
        idea('The first small step', 'Name one action you can finish in 30 minutes.')),
      branch('Protect your time', 'Make room for the work', 'green',
        idea('Reserve a focus block', 'Choose [day + time] for uninterrupted work.'),
        idea('Not this week', 'What can wait? Set a date to revisit it.')),
      branch('Friday reset', 'Close the loop', 'pink',
        idea('Keep what worked', 'Record one win and one thing you learned.'),
        idea('Carry one thing forward', 'Choose next week’s priority and its first action.')),
    ],
  },
  'project-plan': {
    layout: 'phases', label: 'Three-phase delivery map', root: idea('Project outcome', 'Deliver [result] for [audience] by [date].'),
    groups: [
      branch('01 · Define', 'Agree on the finish line', 'blue',
        idea('Set the scope', 'Name the deliverable and what is outside it.'),
        idea('Choose a success signal', 'Set a measurable target and a review date.')),
      branch('02 · Build', 'Make the smallest useful version', 'green',
        idea('Owner and milestone', 'Who owns the next deliverable? When is it due?'),
        idea('Dependencies and risks', 'Name the blocker, its owner, and the next check.')),
      branch('03 · Launch', 'Release, listen, improve', 'pink',
        idea('Check the experience', 'Test the main journey with a real user.'),
        idea('Review the outcome', 'Compare the result with your target. Choose the next step.')),
    ],
  },
  'meeting-agenda': {
    layout: 'side-map', label: 'Discussion to decision', root: idea('Meeting outcome', 'Set the decision, people, and timebox.'),
    groups: [
      branch('01 · Prepare', 'Arrive with shared context', 'blue',
        idea('Frame the question', 'Share the decision needed and any reading in advance.')),
      branch('02 · Discuss', 'Make room for every perspective', 'green',
        idea('Explore the options', 'Timebox the discussion. Note risks and open questions.')),
      branch('03 · Decide', 'Make the outcome explicit', 'pink',
        idea('Record the choice', 'Write the decision, its reason, and unresolved questions.')),
      branch('04 · Act', 'Leave with clear ownership', 'amber',
        idea('Name the next step', 'One action, one owner, and an agreed follow-up date.')),
    ],
  },
  'product-roadmap': {
    layout: 'columns', label: 'Now · Next · Later', root: idea('Product vision', 'Help [customer] achieve [outcome].'),
    groups: [
      branch('Now', 'Commit to the current priority', 'blue',
        idea('Deliver customer value', 'Name the customer problem, owner, and next release.'),
        idea('Measure the result', 'Choose one signal and a review date.')),
      branch('Next', 'Validate the next opportunity', 'green',
        idea('Test the key assumption', 'What must be true for this to work?'),
        idea('Run a small experiment', 'Choose a test, a success threshold, and a review date.')),
      branch('Later', 'Keep possibilities open', 'pink',
        idea('Explore an emerging need', 'What are customers beginning to ask for?'),
        idea('Set a reason to revisit', 'What change would make this a priority?')),
    ],
  },
  brainstorm: {
    layout: 'bilateral', label: 'Balanced idea map', root: idea('Big idea', 'How might we [improve something] for [someone]?'),
    groups: [
      branch('Why?', 'Find the purpose', 'blue',
        idea('The real problem', 'What needs to change?'),
        idea('The opportunity', 'What would a better outcome look like?')),
      branch('Who?', 'See other perspectives', 'pink',
        idea('People involved', 'Who feels this problem most?'),
        idea('Another viewpoint', 'Whose perspective are we missing?')),
      branch('What if?', 'Open up possibilities', 'green',
        idea('A bold possibility', 'What would you try with no constraints?'),
        idea('An unexpected angle', 'What if the opposite were true?')),
      branch('How?', 'Turn an idea into a test', 'amber',
        idea('A small experiment', 'Choose one idea and a test you can run this week.'),
        idea('A sign it is working', 'What result would tell you to keep going?')),
    ],
  },
  'study-notes': {
    layout: 'tree', label: 'Concept tree', root: idea('Core concept', 'Name the topic and what you want to understand.'),
    groups: [
      branch('Understand', 'Build a clear explanation', 'blue',
        idea('In your own words', 'Explain the idea without looking at your notes.'),
        idea('The essential parts', 'Which two or three details matter most?')),
      branch('Connect', 'Make the idea meaningful', 'green',
        idea('A familiar link', 'What does this remind you of?'),
        idea('Example and source', 'Describe one example. Add its source or page number.')),
      branch('Remember', 'Practice bringing it back', 'pink',
        idea('Test yourself', 'Write a question you should be able to answer.'),
        idea('Revisit the hard part', 'Name what is unclear. Set a review date.')),
    ],
  },

};

export function refineTemplate(template) {
  if (template.complexity === 'complex') return createComplexTemplate(template);
  const workspace = workspaces[template.id];
  return { ...template, complexity: template.complexity || 'simple', layoutLabel: workspace.label, layout: workspace.layout, board: arrangeTemplateBranches({ ...workspace, accent: template.accent }) };
}

export function templateHighlights(template) {
  const counts = {};
  for (const node of template.board.nodes) walkContent(node.content || [], ({ block }) => { counts[block.type] = (counts[block.type] || 0) + 1; });
  if (Object.keys(counts).length) return ['table', 'checklist', 'note', 'code', 'link'].filter(type => counts[type]).map(type => ({ type, count: counts[type], label: `${counts[type]} ${type === 'code' ? 'code block' : TYPES[type].name.toLowerCase()}${counts[type] === 1 ? '' : 's'}` }));
  const root = template.board.nodes.find(node => node.root);
  const branchCount = template.layout === 'phases' ? template.board.nodes.filter(node => /^\d{2} · /.test(node.title)).length : template.board.edges.filter(edge => edge.from === root.id).length;
  return [
    { type: 'branches', count: branchCount, label: `${branchCount} ${template.layout === 'phases' ? 'phases' : 'branches'}` },
    { type: 'cards', count: template.board.nodes.length, label: `${template.board.nodes.length} editable cards` },
  ];
}
