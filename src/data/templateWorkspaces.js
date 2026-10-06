import { contentText } from '../lib/cellContent.js';
import { arrangeTemplateCards, templateDesigns } from './templateDesigns.js';
import { previewBlocks, wrapPreviewText } from '../lib/previewLayout.js';

const text = value => ({ type: 'text', text: value });
const tasks = (...items) => ({ type: 'checklist', tasks: items.map(value => ({ text: value, done: false })) });
const table = (headers, rows) => ({ type: 'table', headers, rows });
const note = value => ({ type: 'note', tone: 'warm', text: value });
const card = (title, ...content) => ({ title, content });

// Purpose-specific working content. Entries are prompts and unchecked actions,
// not invented progress, people, dates or results.
const workspaces = {
  'weekly-plan': [
    card('Make room for what matters', note('Choose three outcomes. Leave room for the unexpected.'), tasks('One thing to finish', 'One thing to move forward', 'One thing to let go')),
    card('Protect your focus', table(['When', 'One useful outcome'], [['First focus block', 'Your most important next step'], ['Second focus block', 'Finish before starting more']]), text('What could interrupt you? Decide how to handle it.')),
    card('Keep the promises', tasks('Check meetings and deadlines', 'Ask for the input you need', 'Tell someone what you are deferring')),
    card('The Friday reset', table(['Keep', 'Change'], [['A habit that helped', 'A friction to remove']]), text('What moved forward? What can wait?')),
  ],
  'project-plan': [
    card('01 · Define the finish line', text('What will be different when this is done?'), table(['We will deliver', 'We will leave out'], [['One useful outcome', 'A tempting distraction']]), note('A smaller promise, kept well.')),
    card('02 · Make a first version', tasks('Choose the smallest complete experience', 'Name an owner for the next step', 'Check the dependency most likely to slow you')),
    card('03 · Check it in the real world', text('Try the main journey with someone who needs it.'), tasks('Test the happy path and a failure', 'Write down what surprised you', 'Fix the most important friction')),
    card('04 · Ship, then learn', table(['Success signal', 'Review point'], [['What change will we look for?', 'When will we decide what is next?']]), tasks('Prepare the handover', 'Agree who makes the release decision')),
  ],
  'meeting-agenda': [
    card('Arrive with a purpose', note('By the end, we need to decide…'), text('Invite the people who can move that decision forward.'), tasks('Share the context in advance', 'Agree who owns the decision')),
    card('Make room for the discussion', table(['Topic', 'Timebox'], [['The decision that matters', '15 minutes'], ['Risks and open questions', '10 minutes']]), text('Example timing — adjust it to your meeting.')),
    card('Capture the decision', table(['We decided', 'Because'], [['Write the choice clearly', 'Keep the reasoning with it']]), text('What would make us reconsider?')),
    card('Leave with a next step', tasks('Name one owner per action', 'Agree a date for each handoff', 'Read back the commitments'), note('A useful meeting changes what happens next.')),
  ],
  'product-roadmap': [
    card('The outcome we are building for', text('Who needs a better experience, and what should change for them?'), table(['Evidence', 'Opportunity'], [['A repeated customer problem', 'A useful change to explore']]), note('Start with a need. Let the feature follow.')),
    card('Now · make a commitment', tasks('Choose the smallest useful release', 'Check capacity and dependencies', 'Agree the signal of success'), text('Keep this lane small enough to finish.')),
    card('Next · earn confidence', table(['Possibility', 'What we need to learn'], [['A promising bet', 'The riskiest assumption']]), tasks('Talk to affected customers', 'Run one focused experiment')),
    card('Later · keep the possibility', text('Ideas worth remembering, without promising a date.'), tasks('Capture the need behind the idea', 'Record what would change its priority'), note('Review the evidence before moving an idea into Next.')),
  ],
  'user-research': [
    card('A question worth answering', note('What decision will this research help us make?'), tasks('Write the riskiest assumption', 'Name the people affected', 'Decide what evidence would change your mind')),
    card('Listen for a real experience', text('“Tell me about the last time you tried this.”'), tasks('Ask what triggered the task', 'Explore the difficult moment', 'Notice the workaround')),
    card('Keep the evidence close', table(['Observation', 'Possible meaning'], [['A specific quote or behavior', 'Your interpretation — still a hypothesis']]), text('Look for a counterexample before calling it a pattern.')),
    card('Choose the next experiment', table(['What we learned', 'What we will try'], [['A pattern supported by evidence', 'A small, reversible next step']]), tasks('Connect the decision to its evidence', 'Choose how to tell if it helped')),
  ],
  'feature-brief': [
    card('Problem & evidence', text('For [user], [task] is difficult because [obstacle].'), table(['Evidence', 'Impact'], [['Customer feedback', 'What is harder today'], ['Observed behavior', 'Who and how often']]), note('Describe the problem before proposing a solution.')),
    card('First useful version', table(['Include', 'Leave for later'], [['Main user journey', 'Secondary workflow'], ['Essential behavior', 'Optional enhancement']]), text('Main flow: [start] → [action] → [useful result]')),
    card('Acceptance & risks', tasks('Define the successful end state', 'Check empty, error and loading states', 'Check keyboard and mobile use', 'Review permissions and data handling'), text('Biggest unknown: [question]\nValidation owner: [name]')),
    card('Release & learn', table(['Measure', 'Baseline', 'Target'], [['Primary outcome', 'Measure first', 'Set target'], ['Quality guardrail', 'Measure first', 'Set limit']]), text('First audience: [group]\nReview date: [date]\nRollback trigger: [signal]')),
  ],
  retrospective: [
    card('What worked', text('Period: [sprint or project]\nAdd specific moments worth repeating.'), table(['Observation', 'Why it helped'], [['A useful team habit', 'Impact on the work'], ['A good outcome', 'What made it possible']])),
    card('What got in the way', table(['Friction', 'Impact'], [['A repeated delay', 'What it prevented'], ['An unclear handoff', 'Who needed more context']]), note('Describe the conditions and events without assigning blame.')),
    card('One experiment', text('We believe [change] will improve [outcome].\nWe will try it for [period].'), tasks('Choose one small change', 'Agree an owner and a start date', 'Define an observable success signal')),
    card('Close the loop', table(['Action', 'Owner', 'Review'], [['Run the experiment', 'Assign owner', 'Set date'], ['Share what happened', 'Assign owner', 'Set date']]), text('At the next review: keep, adapt or stop?')),
  ],
  'okr-planning': [
    card('Objective & boundaries', text('This quarter we want to [meaningful change].\nIt matters because [customer or team benefit].'), note('An objective gives direction. Key results describe outcomes, not a list of tasks.'), text('What we will deprioritize: [tradeoff]')),
    card('Key results', table(['Result', 'Baseline', 'Target'], [['Outcome 1', 'Measure now', 'Set target'], ['Outcome 2', 'Measure now', 'Set target'], ['Quality guardrail', 'Measure now', 'Set limit']])),
    card('Initiatives & ownership', table(['Initiative', 'Owner', 'Supports'], [['First experiment', 'Assign owner', 'Outcome 1'], ['Second experiment', 'Assign owner', 'Outcome 2']]), tasks('Check dependencies and capacity', 'Name a source for each measurement')),
    card('Weekly check-in', text('Evidence this week: [change observed]\nConfidence: [reasoned assessment]\nObstacle: [what needs attention]'), tasks('Update results from the agreed source', 'Review the biggest uncertainty', 'Choose what to continue, change or stop')),
  ],
  onboarding: [
    card('Before day one', text('Role: [role]\nManager: [name]\nBuddy: [name]\nStart date: [date]'), tasks('Prepare equipment and workspace', 'Confirm the accounts and access needed', 'Share the first-week schedule')),
    card('Days 1–30 · learn', tasks('Meet the people you will work with', 'Observe a customer or team workflow', 'Complete one useful task with support'), table(['Check-in', 'Discuss'], [['Day 30', 'Context, confidence and support needed']])),
    card('Days 31–60 · contribute', text('Deliverable to own: [outcome]\nSupport available: [person or resource]'), tasks('Agree the definition of done', 'Deliver and ask for specific feedback', 'Review progress with the manager')),
    card('Days 61–90 · own', table(['Milestone', 'Evidence'], [['Lead an initiative', 'Result and feedback'], ['Operate independently', 'Decisions made with confidence']]), tasks('Review expectations together', 'Choose the next development goal')),
  ],
  'root-cause': [
    card('Facts & timeline', text('Observed problem: [what happened]\nImpact: [who, duration and scope]'), table(['When', 'Observed event'], [['Start', 'First confirmed signal'], ['Response', 'What happened next'], ['Recovery', 'How normal operation returned']])),
    card('Causes to investigate', table(['Possible factor', 'How to check'], [['Process or handoff', 'Review the actual sequence'], ['Tool or condition', 'Check relevant evidence'], ['Missing feedback', 'Check when detection was possible']]), note('Keep hypotheses separate from confirmed facts.')),
    card('Evidence chain', table(['Why did this happen?', 'Supporting evidence'], [['Immediate contributing factor', 'Record an observation'], ['Underlying condition', 'Verify the connection']]), text('Alternative explanation: [what else could fit the facts]')),
    card('Prevent a repeat', table(['Corrective action', 'Owner', 'Due'], [['Reduce the underlying risk', 'Assign owner', 'Set date'], ['Improve detection', 'Assign owner', 'Set date']]), tasks('Define a verification signal', 'Schedule a follow-up review')),
  ],
  'event-plan': [
    card('Audience & outcome', text('Event: [name]\nDate and place: [details]\nAudience: [who it is for]\nPeople should leave with: [outcome]'), tasks('Confirm capacity and accessibility needs', 'Choose how to collect feedback')),
    card('Run of show', table(['Time', 'Segment', 'Lead'], [['Opening', 'Welcome and purpose', 'Assign lead'], ['Main session', 'Activity or discussion', 'Assign lead'], ['Closing', 'Takeaways and next steps', 'Assign lead']])),
    card('Logistics & budget', table(['Item', 'Owner', 'Estimate'], [['Venue and equipment', 'Assign owner', 'Set budget'], ['Food or materials', 'Assign owner', 'Set budget'], ['Contingency', 'Assign owner', 'Set buffer']]), tasks('Test the equipment', 'Confirm the backup plan')),
    card('Invitations & follow-up', tasks('Send the invitation and RSVP details', 'Share arrival and access information', 'Confirm speakers and suppliers', 'Send resources and thanks afterward'), text('Feedback question: [what would make the next event better]')),
  ],
  'trip-plan': [
    card('Trip at a glance', text('Destination: [place]\nDates: [travel dates]\nTravelers: [names]\nBudget: [amount and currency]'), table(['Traveler', 'One must-do'], [['Name', 'Experience to prioritize'], ['Name', 'Experience to prioritize']])),
    card('Loose itinerary', table(['Day', 'Main plan', 'Keep flexible'], [['Day 1', 'Arrive and settle in', 'Rest and local exploring'], ['Day 2', 'One priority experience', 'Free time'], ['Final day', 'Departure', 'Allow travel buffer']])),
    card('Bookings & budget', table(['Booking', 'Reference', 'Cost'], [['Transport', 'Add confirmation', 'Add cost'], ['Stay', 'Add confirmation', 'Add cost'], ['Activities', 'Add confirmation', 'Add cost']]), text('Useful contact or address: [details]')),
    card('Before departure', tasks('Check current entry and document requirements', 'Confirm transport and check-in details', 'Save booking details for offline access', 'Pack medication, chargers and essentials', 'Finish home and work handovers')),
  ],
  'content-system': [
    card('Audience & voice', text('For: [specific reader]\nWe help them: [useful outcome]\nOur point of view: [distinct perspective]'), table(['Sound like', 'Avoid'], [['Clear and specific', 'Unsupported claims'], ['Helpful and practical', 'Unnecessary jargon']])),
    card('Story pipeline', table(['Story', 'Reader need', 'Stage'], [['Teach a useful skill', 'How do I do this?', 'Idea'], ['Show a real example', 'Will this work for me?', 'Idea'], ['Answer a common question', 'What should I consider?', 'Idea']])),
    card('Publishing plan', table(['Channel', 'Owner', 'Cadence'], [['Primary channel', 'Assign owner', 'Set rhythm'], ['Supporting channel', 'Assign owner', 'Set rhythm']]), text('Next publication: [story and date]\nReuse opportunity: [another useful format]')),
    card('Quality & learning', tasks('Check facts and source links', 'Use a concrete example', 'Make the next step clear', 'Review accessibility and readability'), text('What helped the audience: [evidence]\nWhat to change next: [lesson]')),
  ],
  'campaign-plan': [
    card('Audience & promise', text('Audience: [specific group]\nNeed: [what matters to them]\nPromise: [one useful benefit]\nDesired action: [next step]'), note('Use evidence for the promise and keep the call to action clear.')),
    card('Channels & assets', table(['Channel', 'Asset', 'Owner'], [['Email', 'Message and destination', 'Assign owner'], ['Social', 'Post and visual', 'Assign owner'], ['Website', 'Campaign page', 'Assign owner']])),
    card('Launch checklist', tasks('Check the message and destination', 'Review facts, links and accessibility', 'Test tracking and the main action', 'Confirm schedule, budget and owners', 'Prepare support for common questions')),
    card('Measure & adjust', table(['Measure', 'Baseline', 'Target'], [['Desired action', 'Measure first', 'Set target'], ['Cost or effort', 'Estimate first', 'Set limit']]), text('Review date: [date]\nContinue, adjust or stop based on: [signal]')),
  ],
  'article-outline': [
    card('Reader & takeaway', text('Reader: [who this is for]\nQuestion: [what they need answered]\nTakeaway: [one thing to remember]'), note('Keep one main idea. Remove sections that do not help the reader understand it.')),
    card('Opening & structure', table(['Section', 'Purpose'], [['Opening', 'Show the problem and why it matters'], ['Main explanation', 'Build understanding step by step'], ['Ending', 'Offer a useful next step']])),
    card('Claims & evidence', table(['Claim', 'Source or example'], [['Main point', 'Add supporting evidence'], ['Supporting point', 'Add a concrete example'], ['Limitation', 'Explain when it may not apply']])),
    card('Before publishing', tasks('Check every factual claim', 'Add descriptive source links', 'Replace vague wording with specifics', 'Check headings and reading flow', 'Confirm the title matches the article')),
  ],
  'study-notes': [
    card('Explain it simply', text('Write the idea as if you were explaining it to a friend.'), note('Start from memory. Check your source afterwards.')),
    card('Make a connection', table(['New idea', 'Something I already know'], [['A key concept', 'A familiar example or analogy']]), text('Where does this comparison stop working?')),
    card('Test your understanding', tasks('Explain it without your notes', 'Try a new example', 'Find and correct one misconception')),
    card('Come back to the hard part', table(['Still unclear', 'My next check'], [['One specific question', 'A source, example, or person who can help']]), tasks('Review the difficult idea next session', 'Explain it again in your own words')),
  ],
  'learning-plan': [
    card('Skill & proof', text('Skill: [observable ability]\nStarting point: [what I can do now]\nProof of progress: [small project or performance]'), note('Choose something you can demonstrate, not only a resource to finish.')),
    card('Resources & practice', table(['Resource', 'How I will use it'], [['One core guide', 'Learn a concept, then apply it'], ['A worked example', 'Rebuild it without looking']]), text('Practice rhythm: [days and time]\nFeedback source: [person or community]')),
    card('Project milestones', tasks('Build the smallest working example', 'Try the skill in a different situation', 'Get specific feedback', 'Improve the hardest part', 'Demonstrate the result without help')),
    card('Progress & next step', table(['Checkpoint', 'Evidence'], [['What I can do now', 'Example or result'], ['What remains difficult', 'Specific gap']]), text('Next practice task: [small action]\nReview date: [date]')),
  ],
  'career-plan': [
    card('Direction & strengths', text('Work I want more of: [activities]\nConditions that matter: [environment]\nStrengths I can build on: [examples]'), note('Describe the work you want to do, as well as a possible job title.')),
    card('Growth priorities', table(['Skill or experience', 'Practice opportunity'], [['Most useful gap', 'A real project or responsibility'], ['Supporting skill', 'Feedback, mentoring or practice']]), text('Priority for this month: [one choice]')),
    card('Evidence of impact', table(['Example', 'Outcome or feedback'], [['Recent contribution', 'What changed because of the work'], ['Stretch project', 'What it demonstrated']]), tasks('Collect specific examples', 'Ask a collaborator for feedback')),
    card('Next 30 days', tasks('Choose one practical growth action', 'Arrange a manager or mentor conversation', 'Agree a useful stretch opportunity', 'Review progress and update the plan'), text('Conversation with: [name]\nReview date: [date]')),
  ],
};

function identifyBlocks(templateId, cardIndex, content, width) {
  let sequence = 0;
  const id = () => `${templateId}-${cardIndex}-${++sequence}`;
  return content.map(block => ({
    ...block, id: id(),
    ...(block.type === 'table' ? {
      columnWidths: block.headers.map((_, column) => Math.floor((width - 50) / block.headers.length) + (column < (width - 50) % block.headers.length ? 1 : 0)),
      rows: block.rows.map(row => row.map(value => ({ id: id(), content: [{ ...text(value), id: id() }] }))),
    } : {}),
  }));
}

const lines = (value, width) => String(value).split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length * 7.4 / width)), 0);
function contentHeight(content, width) {
  const inner = width - 48;
  return Math.ceil(90 + content.reduce((height, block) => {
    if (block.type === 'table') {
      const column = inner / block.headers.length - 28;
      return height + 44 + block.rows.reduce((sum, row) => sum + 26 + 22 * Math.max(...row.map(slot => lines(contentText(slot.content), column))), 0) + 14;
    }
    if (block.type === 'checklist') return height + block.tasks.reduce((sum, task) => sum + Math.max(32, 8 + lines(task.text, inner - 52) * 24), 0) + 14;
    return height + lines(block.text, inner - (block.type === 'note' ? 28 : 0)) * 22 + (block.type === 'note' ? 26 : 0) + 14;
  }, 0));
}

export function refineTemplate(template) {
  const design = templateDesigns[template.id] || { layout: 'matrix', label: 'Connected ideas' };
  const cards = workspaces[template.id];
  if (!cards) return { ...template, layoutLabel: design.label, layout: design.layout };
  const width = 400;
  const prepared = cards.map((item, index) => {
    const content = identifyBlocks(template.id, index, item.content, width);
    return { id: index + 2, title: item.title, note: contentText(content), content, contentLayout: 'card', w: width, h: 100, contentHeight: Math.max(contentHeight(content, width), 80 + (wrapPreviewText(item.title, width - 48, 18, 2).length - 1) * 26 + previewBlocks(content, width - 50).height), color: 'white', shape: 'round' };
  });
  const originalRoot = template.board.nodes.find(item => item.root);
  const root = { ...originalRoot, note: design.caption || originalRoot.note };
  const { nodes, edges } = arrangeTemplateCards(prepared, root, design.layout);
  return { ...template, layoutLabel: design.label, layout: design.layout, board: { ...template.board, nodes, edges } };
}

export function templateHighlights(template) {
  const blocks = template.board.nodes.flatMap(item => item.content || []);
  return ['table', 'checklist'].flatMap(type => {
    const count = blocks.filter(block => block.type === type).length;
    return count ? [{ type, count, label: `${count} ${type}${count === 1 ? '' : 's'}` }] : [];
  });
}
