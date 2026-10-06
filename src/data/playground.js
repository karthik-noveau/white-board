export const playgroundExamples = [
  { id: 'brainstorm', label: 'Brainstorm', icon: 'spark', title: 'What would make mornings better?', note: 'A little less rush. A little more room.', ideas: [{ id: 'idea-1', title: 'Less rush', note: 'Prepare the night before. Leave a little breathing room.' }, { id: 'idea-2', title: 'More energy', note: 'A short walk. A proper breakfast. The phone can wait.' }], action: 'Try it tomorrow', tasks: [{ text: 'Give yourself a 15-minute buffer', done: false }, { text: 'Keep breakfast screen-free', done: false }] },
  { id: 'launch', label: 'Plan a launch', icon: 'layout', title: 'Build something people love.', note: 'Start small. Learn from what happens.', ideas: [{ id: 'idea-1', title: 'Find a real need', note: 'Talk to three people. Look for a problem they already try to solve.' }, { id: 'idea-2', title: 'Make the first version count', note: 'One useful flow, with a clear way to tell if it helped.' }], action: 'A useful first release', tasks: [{ text: 'Test the core idea with someone', done: false }, { text: 'Choose one success signal', done: false }] },
  { id: 'learn', label: 'Learn a skill', icon: 'note', title: 'Get better by making things.', note: 'A new skill starts with a small attempt.', ideas: [{ id: 'idea-1', title: 'Learn by doing', note: 'Choose a tiny project. Learn just enough to make the next part.' }, { id: 'idea-2', title: 'Connect the dots', note: 'Explain what you learned in your own words. Keep a useful example.' }], action: 'A little progress each day', tasks: [{ text: 'Set aside 20 minutes to practice', done: false }, { text: 'Explain one new idea from memory', done: false }] },
];

export function playgroundProject(draft) {
  const middle = (draft.ideas.length - 1) * 120;
  const card = (id, title, x, y, content) => ({ id, title, x, y, w: 340, h: 200, color: 'white', shape: 'round', contentLayout: 'card', content });
  const nodes = [
    { id: 'root', root: true, title: draft.title.trim() || 'My big idea', note: draft.note, x: 0, y: middle, w: 280, h: 196, color: 'violet', shape: 'round' },
    ...draft.ideas.map((idea, index) => card(idea.id, idea.title.trim() || 'Untitled idea', 410, index * 250, [{ id: `${idea.id}-text`, type: 'text', text: idea.note }])),
    card('action', draft.action, 880, middle, [{ id: 'next-steps', type: 'checklist', tasks: structuredClone(draft.tasks) }]),
  ];
  const edges = draft.ideas.flatMap(idea => [{ id: `to-${idea.id}`, from: 'root', to: idea.id }, { id: `from-${idea.id}`, from: idea.id, to: 'action' }]).map(edge => ({ ...edge, structure: 'curve', pattern: 'solid', weight: 'regular' }));
  return { name: nodes[0].title, accent: 'violet', board: { nodes, edges, globalSettings: { shape: 'round', color: 'white', structure: 'curve', pattern: 'solid', weight: 'regular' } } };
}
