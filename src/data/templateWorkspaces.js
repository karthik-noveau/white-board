import { contentText } from '../lib/cellContent.js';

const text = value => ({ type: 'text', text: value });
const tasks = (...items) => ({ type: 'checklist', tasks: items.map(value => ({ text: value, done: false })) });
const table = (headers, rows) => ({ type: 'table', headers, rows });
const note = value => ({ type: 'note', tone: 'warm', text: value });
const card = (title, ...content) => ({ title, content });

// Purpose-specific working content. Entries are prompts and unchecked actions,
// not invented progress, people, dates or results.
const workspaces = {
  'weekly-plan': [
    card('Three priorities', text('Choose outcomes that fit the time you actually have.'), table(['Outcome', 'Next step'], [['Must finish', 'Name the deliverable'], ['Make progress', 'Choose a small milestone'], ['Make space', 'Defer or delegate one task']])),
    card('Time & commitments', table(['Day', 'Focus block', 'Commitment'], [['Monday', 'Reserve time', 'Check calendar'], ['Wednesday', 'Reserve time', 'Check capacity'], ['Friday', 'Weekly review', 'Close open loops']]), note('Leave some capacity for unplanned work.')),
    card('Ready to start', tasks('Choose the first concrete action', 'Gather the information you need', 'Protect a focus block on the calendar', 'Tell others what you are deferring')),
    card('Friday reset', text('Wins: What moved forward?\nLesson: What would you do differently?'), tasks('Review unfinished work', 'Move only what still matters into next week', 'Choose one improvement for the next plan')),
  ],
  'project-plan': [
    card('Outcome & scope', text('We will deliver: [specific outcome]\nFor: [person or team]\nDone means: [observable result]'), table(['In scope', 'Out of scope'], [['Essential deliverable', 'Later enhancement'], ['Required audience', 'Audience for a later phase']])),
    card('Milestones & owners', table(['Milestone', 'Owner', 'Due'], [['Scope agreed', 'Assign owner', 'Set date'], ['First version ready', 'Assign owner', 'Set date'], ['Release reviewed', 'Assign owner', 'Set date']])),
    card('Risks & dependencies', table(['Dependency or risk', 'Response'], [['Input from another team', 'Agree a handoff date'], ['Unverified assumption', 'Run a small test'], ['Limited capacity', 'Reduce the first release']])),
    card('Ready to deliver', tasks('Confirm acceptance criteria', 'Test the main and failure paths', 'Prepare handover and support notes', 'Agree who approves the release'), text('Review date: [date]\nEvidence of success: [result or link]')),
  ],
  'meeting-agenda': [
    card('Prepare the meeting', text('Outcome: [decision or result]\nFacilitator: [name]\nDecision owner: [name]'), tasks('Invite the people needed for the decision', 'Share the context and pre-reading', 'Confirm the time available')),
    card('Timeboxed agenda', table(['Topic', 'Minutes', 'Lead'], [['Context and goal', '5', 'Assign lead'], ['Options and evidence', '15', 'Assign lead'], ['Decision and actions', '10', 'Assign lead']])),
    card('Decision log', table(['Decision', 'Reason or evidence'], [['What we agreed', 'Why this option'], ['Still open', 'What information is missing']]), text('Parking lot: [useful topics for another conversation]')),
    card('Actions & follow-up', table(['Action', 'Owner', 'Due'], [['First next step', 'Assign owner', 'Set date'], ['Resolve an open question', 'Assign owner', 'Set date']]), tasks('Read back actions and owners', 'Share the decision and follow-up date')),
  ],
  'product-roadmap': [
    card('Customer outcome', text('Help [customer] accomplish [job] with less [friction].'), table(['Evidence', 'What it suggests'], [['Customer observation', 'Problem to address'], ['Product signal', 'Opportunity to investigate']]), note('Plan around a customer outcome before choosing features.')),
    card('Now · committed', table(['Bet', 'Owner', 'Success signal'], [['Current priority', 'Assign owner', 'Define outcome'], ['Smallest useful release', 'Assign owner', 'Define measure']]), tasks('Confirm capacity and dependencies', 'Agree a review date')),
    card('Next · validate', table(['Opportunity', 'Evidence needed'], [['Potential next bet', 'Talk to affected customers'], ['Important assumption', 'Run a focused experiment']]), text('Move into Now only when the evidence and capacity support it.')),
    card('Later · explore', text('Keep possibilities visible without promising delivery dates.'), tasks('Capture an emerging customer need', 'Record what would change the priority', 'Review outcomes from the current release'), text('Review rhythm: [weekly or monthly]')),
  ],
  'user-research': [
    card('Decision & learning goals', text('Decision to inform: [what will change]\nResearch question: [what we need to learn]'), table(['Assumption', 'Evidence needed'], [['What we believe today', 'A recent real example'], ['What could change our mind', 'A conflicting observation']])),
    card('Participants & preparation', table(['Participant profile', 'Recruiting route'], [['People with this problem', 'Choose a relevant channel'], ['People using a workaround', 'Choose a relevant channel']]), tasks('Explain the purpose and ask for consent', 'Check the discussion guide', 'Prepare a place for notes')),
    card('Interview guide', text('Tell me about the last time you tried this.\nWhat triggered the task?\nWhere did it become difficult?\nWhat did you try instead?'), note('Ask for concrete experiences. Separate observations from your interpretation.')),
    card('Evidence → next action', table(['Observation', 'Implication'], [['Quote or behavior', 'Possible pattern'], ['Counterexample', 'Limit of the finding']]), tasks('Group repeated observations', 'Connect conclusions to evidence', 'Choose a small follow-up test')),
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
    card('Explain the concept', text('Topic: [course or chapter]\nIn my own words: [plain explanation]\nWhy it matters: [where it is useful]'), note('Write from memory first, then check your explanation.')),
    card('Ideas & examples', table(['Concept', 'Example or connection'], [['Key idea 1', 'A concrete example'], ['Key idea 2', 'How it connects to idea 1'], ['Common misconception', 'What is actually true']])),
    card('Active recall', tasks('Explain the topic without notes', 'Solve or create a new example', 'Compare two related concepts', 'Check errors against the source'), text('Hardest question: [what remains unclear]')),
    card('Review plan', table(['Review', 'What to check'], [['Next session', 'The hardest question'], ['Later review', 'Recall without reading first']]), text('Source: [book, chapter or link]\nNext question to explore: [question]')),
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
  const cards = workspaces[template.id];
  if (!cards) return template;
  const width = 480;
  const prepared = cards.map((item, index) => {
    const content = identifyBlocks(template.id, index, item.content, width);
    return { id: index + 2, title: item.title, note: contentText(content), content, w: width, h: 100, contentHeight: contentHeight(content, width), color: 'white', shape: 'round' };
  });
  const firstRow = Math.max(prepared[0].contentHeight, prepared[1].contentHeight);
  const root = template.board.nodes.find(item => item.root);
  const nodes = [
    { ...root, id: 1, x: 610, y: firstRow + 60 - 64, w: 280, h: 128, shape: 'round' },
    ...prepared.map((item, index) => ({ ...item, x: index % 2 ? 1020 : 0, y: index < 2 ? 0 : firstRow + 120 })),
  ];
  const edges = prepared.map((item, index) => ({ id: index + 1, from: 1, to: item.id, side: index % 2 ? 'right' : 'left', structure: 'elbow', pattern: 'solid', weight: 'regular' }));
  return { ...template, board: { ...template.board, nodes, edges } };
}

export function templateHighlights(template) {
  const blocks = template.board.nodes.flatMap(item => item.content || []);
  return ['table', 'checklist'].flatMap(type => {
    const count = blocks.filter(block => block.type === type).length;
    return count ? [{ type, count, label: `${count} ${type}${count === 1 ? '' : 's'}` }] : [];
  });
}
