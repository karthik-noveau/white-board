import { contentText, normalizeCellContent } from '../lib/cellContent.js';
import { previewBlocks, wrapPreviewText } from '../lib/previewLayout.js';

const text = value => ({ type: 'text', text: value });
const heading = value => ({ type: 'heading', level: 2, text: value });
const note = (value, tone = 'warm') => ({ type: 'note', tone, text: value });
const checklist = (...items) => ({ type: 'checklist', tasks: items.map(value => ({ text: value, done: false })) });
const table = (headers, ...rows) => ({ type: 'table', headers, rows });
const divider = () => ({ type: 'divider' });
const link = description => ({ type: 'link', url: '', description });
const code = (language, value) => ({ type: 'code', language, code: value });
const card = (title, ...content) => ({ title, content });

// These are native editor blocks, including editable cells inside tables.
// Empty resource URLs invite the user's own material instead of invented links.
const workspaces = {
  'product-discovery': {
    title: 'Discovery challenge', note: 'Which customer problem is worth solving?', label: 'Research and experiment workspace',
    cards: [
      card('Research brief',
        heading('People and purpose'), text('We want to understand how [audience] handles [situation].'),
        divider(), note('What decision will this research help us make?', 'violet')),
      card('Evidence log',
        table(['Observation', 'Source', 'Interpretation'], ['What happened?', 'Interview / date', 'Possible unmet need'], ['Exact words or behavior', 'Link / participant', 'Question to test']),
        note('Keep the observation separate from your interpretation.')),
      card('Interview guide',
        heading('Ask about a real experience'),
        checklist('Ask about the last time this happened', 'Explore the workaround they used', 'Capture the cost or frustration', 'Ask what a better outcome means')),
      card('Opportunity comparison',
        table(['Opportunity', 'Evidence', 'Next check'], ['Problem to explore', 'Customer signal', 'What is missing?'], ['Another possibility', 'Current assumption', 'Who can help?']),
        text('Choose the opportunity with the clearest unmet need.')),
      card('Experiment plan',
        heading('Our hypothesis'), text('If we [make a change], people will [observable behavior].'),
        checklist('Choose the smallest useful test', 'Set a success threshold before testing'),
        note('Owner: [name] · Review on: [date]', 'violet')),
      card('Decision and sources',
        note('Continue, change direction, or stop. Record the evidence behind it.', 'mint'),
        table(['Decision', 'Next commitment'], ['What we learned', 'What we will do next']),
        link('Add the interview notes or experiment results.')),
    ],
  },
  'business-strategy': {
    title: 'Strategic ambition', note: 'The choices that turn direction into action', label: 'Strategy and execution workspace',
    cards: [
      card('Direction and boundaries',
        heading('Our ambition'), text('We help [customers] achieve [outcome] through [distinct value].'),
        divider(), note('Name one thing we will deliberately not pursue.', 'violet')),
      card('Where to play',
        table(['Choice', 'Our focus'], ['Customer segment', 'Who we serve best'], ['Need to address', 'What matters most to them'], ['Market boundary', 'What we will leave out'])),
      card('Capabilities and gaps',
        table(['Capability', 'Current gap', 'Next move'], ['Strength to build', 'What is missing?', 'Smallest investment'], ['System to improve', 'What slows us?', 'Change to try']),
        note('Prioritize the capability that enables the strategy.')),
      card('First initiatives',
        heading('Turn the choices into work'),
        checklist('Choose the first measurable outcome', 'Assign one owner to each initiative', 'Identify the dependency to resolve', 'Agree the first milestone')),
      card('Outcome scorecard',
        table(['Signal', 'Baseline', 'Target', 'Review'], ['Outcome', 'Current value', 'Success value', 'Date / owner'], ['Early signal', 'Current value', 'Threshold', 'Check weekly']),
        text('Use signals that help you decide what to change.')),
      card('Review journal',
        heading('What changed?'), note('Capture new evidence, surprises, and a choice to revisit.', 'mint'),
        divider(), checklist('Keep the choice that is working', 'Adapt the weakest assumption', 'Record the next review date')),
    ],
  },
  'website-architecture': {
    title: 'Website purpose', note: 'Plan the pages, content, and visitor experience', label: 'Content and build workspace',
    cards: [
      card('Page inventory',
        table(['Page', 'Purpose', 'Next step'], ['Home', 'Explain the value', 'Explore the offer'], ['Product / service', 'Answer key questions', 'Choose an option'], ['Contact / sign up', 'Help people begin', 'Confirm the action']),
        note('Give each page one owner and one primary action.')),
      card('Page brief',
        heading('One visitor, one goal'), text('This page helps [visitor] understand [message] and take [action].'),
        divider(), note('What proof would make the message believable?', 'violet')),
      card('Content checklist',
        heading('Ready to write'),
        checklist('Write the main headline', 'Explain the benefit in plain language', 'Add an example or proof point', 'Answer the main objection', 'Choose one primary call to action')),
      card('Page structure',
        text('A small semantic starting point. Replace the copy and sections.'),
        code('HTML', '<main>\n  <h1>Your main promise</h1>\n  <p>Explain the value.</p>\n  <section aria-label="Details">\n    <h2>How it works</h2>\n  </section>\n</main>')),
      card('References and assets',
        link('Add the design file or wireframe.'),
        link('Add the content source or research notes.'),
        note('Keep the original sources close to the page brief.', 'mint')),
      card('Before publishing',
        checklist('Check the main journey on mobile', 'Test keyboard navigation and labels', 'Check links and form confirmation', 'Review titles and page descriptions'),
        note('Make the next step clear on every page.')),
    ],
  },
  'product-launch': {
    title: 'Launch outcome', note: 'A shared plan for readiness, release, and learning', label: 'Launch operations workspace',
    cards: [
      card('Positioning brief',
        heading('Audience and promise'), text('For [audience], this launch makes [valuable outcome] possible.'),
        divider(), note('Support the promise with one concrete proof point.', 'violet')),
      card('Readiness checklist',
        checklist('Test the core customer journey', 'Confirm the release owner', 'Prepare the support handover', 'Agree the rollback or fallback plan', 'Resolve launch-blocking issues')),
      card('Release plan',
        table(['Step', 'Owner', 'When', 'Ready when'], ['Review', '[Name]', '[Date / time]', 'Checks pass'], ['Publish', '[Name]', '[Date / time]', 'Approved'], ['Announce', '[Name]', '[Date / time]', 'Release live'])),
      card('Content and channels',
        table(['Asset / channel', 'Next action'], ['Launch page', 'Review copy and the main CTA'], ['Announcement', 'Confirm message and timing']),
        link('Add the approved assets or campaign folder.')),
      card('On launch day',
        heading('Keep the team aligned'), text('Confirm the release order and the person who makes the final call.'),
        divider(), checklist('Run the go / no-go check', 'Watch the customer experience', 'Record issues and assign a response')),
      card('Results and follow-up',
        note('Compare the outcome with the original promise.', 'mint'),
        table(['What we observed', 'What we will do'], ['Customer feedback', 'Next improvement'], ['Success signal', 'Keep, change, or investigate'])) ,
    ],
  },
};

function identifyContent(templateId, cardIndex, blocks, width) {
  let sequence = 0;
  const id = () => `${templateId}-${cardIndex}-${++sequence}`;
  return normalizeCellContent(blocks.map(block => ({
    ...block, id: id(),
    ...(block.type === 'table' ? {
      columnWidths: block.headers.map((_, index) => Math.floor((width - 50) / block.headers.length) + (index < (width - 50) % block.headers.length ? 1 : 0)),
      rows: block.rows.map(row => row.map(value => ({ id: id(), content: [{ ...text(value), id: id() }] }))),
    } : {}),
  })));
}

export function createComplexTemplate(template) {
  const workspace = workspaces[template.id], width = 520, gap = 104, step = width + gap;
  const cards = workspace.cards.map((item, index) => {
    const content = identifyContent(template.id, index, item.content, width);
    const titleExtra = (wrapPreviewText(item.title, width - 48, 18).length - 1) * 26;
    const controls = content.reduce((sum, block) => sum + (block.type === 'table' ? 36 : block.type === 'checklist' ? 32 : block.type === 'heading' ? 8 : 0), 0);
    const height = Math.ceil((100 + titleExtra + previewBlocks(content, width - 50).height + controls) / 8) * 8;
    return { id: index + 2, title: item.title, note: contentText(content), content, w: width, h: height, contentHeight: height, color: 'white', shape: 'round' };
  });
  // Matching row heights remain stable when the canvas measures real content.
  const rowHeights = [0, 1].map(row => Math.max(...cards.slice(row * 3, row * 3 + 3).map(card => card.h)));
  const root = { id: 1, title: workspace.title, note: workspace.note, root: true, color: template.accent, shape: 'round', w: 320, h: 112, x: (width + step * 2 - 320) / 2, y: 0 };
  const nodes = [root, ...cards.map((card, index) => ({ ...card, x: (index % 3) * step, y: 216 + (index < 3 ? 0 : rowHeights[0] + gap), h: rowHeights[index < 3 ? 0 : 1] }))];
  const pairs = [[1, 2], [1, 3], [1, 4], [2, 5], [3, 6], [4, 7]];
  const edges = pairs.map(([from, to], index) => ({ id: index + 1, from, to, side: 'bottom', structure: 'elbow', pattern: 'solid', weight: 'regular' }));
  return { ...template, layout: 'block-workspace', layoutLabel: workspace.label, board: { nodes, edges, globalSettings: { shape: 'round', color: 'white', structure: 'elbow', pattern: 'solid', weight: 'regular' } } };
}
