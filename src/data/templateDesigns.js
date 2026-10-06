// A layout describes how someone works with the board, not a decorative theme.
export const templateDesigns = {
  'weekly-plan': { layout: 'focus', label: 'Weekly focus', caption: 'Three priorities. A little breathing room. A Friday reset.' },
  'project-plan': { layout: 'timeline', label: 'Delivery timeline', caption: 'Move from a clear outcome to a release you can stand behind.' },
  'meeting-agenda': { layout: 'workshop', label: 'Meeting workspace', caption: 'Arrive prepared. Leave with decisions and next steps.' },
  'product-roadmap': { layout: 'roadmap', label: 'Now · Next · Later', caption: 'A direction to believe in, with room to change your mind.' },
  'user-research': { layout: 'evidence', label: 'Evidence map', caption: 'Keep observations, interpretations, and decisions connected.' },
  'feature-brief': { layout: 'matrix', label: 'One-page brief', caption: 'One shared picture of the problem, scope, and success.' },
  retrospective: { layout: 'workshop', label: 'Reflection wall', caption: 'Notice the patterns. Choose one useful experiment.' },
  'okr-planning': { layout: 'focus', label: 'Outcome map', caption: 'Connect a meaningful goal to evidence of progress.' },
  onboarding: { layout: 'timeline', label: '30 · 60 · 90 days', caption: 'Turn a new beginning into a confident first three months.' },
  'root-cause': { layout: 'evidence', label: 'Investigation map', caption: 'Follow the evidence before choosing a fix.' },
  'event-plan': { layout: 'timeline', label: 'Event runway', caption: 'Bring the people, moving parts, and moments together.' },
  'trip-plan': { layout: 'matrix', label: 'Travel planner', caption: 'A place for the essentials, and room for discovery.' },
  'content-system': { layout: 'roadmap', label: 'Editorial board', caption: 'Connect your audience to stories worth coming back for.' },
  'campaign-plan': { layout: 'timeline', label: 'Campaign runway', caption: 'One promise, consistent touchpoints, measurable learning.' },
  'article-outline': { layout: 'story', label: 'Story spine', caption: 'Give every paragraph a reason to be here.' },
  'study-notes': { layout: 'evidence', label: 'Learning map', caption: 'Turn notes into explanations you can actually remember.' },
  'learning-plan': { layout: 'story', label: 'Practice path', caption: 'Build a small thing. Get feedback. Try again.' },
  'career-plan': { layout: 'focus', label: 'Growth map', caption: 'Connect the work you want with the next step you can take.' },
  'customer-journey': { layout: 'journey', label: 'Customer journey' },
  swot: { layout: 'quadrants', label: 'Four perspectives' },
  brainstorm: { layout: 'radial', label: 'Idea orbit' },
  'org-chart': { layout: 'tree', label: 'Team tree' },
  'decision-tree': { layout: 'decision', label: 'Decision paths' },
  'website-plan': { layout: 'hierarchy', label: 'Site architecture' },
};

export function arrangeTemplateCards(cards, root, layout) {
  const gap = 84, width = cards[0].w, step = width + gap;
  const topHeight = Math.max(cards[0].contentHeight, cards[1].contentHeight);
  const maxHeight = Math.max(...cards.map(card => card.contentHeight));
  const anchor = { ...root, id: 1, w: 300, h: 176, shape: 'round' };
  let positions, start;
  if (layout === 'timeline') {
    // A compact two-row path keeps four phases readable in a gallery preview.
    start = { x: 0, y: 0 };
    positions = [{ x: step, y: 0 }, { x: step * 2, y: 0 }, { x: step * 2, y: topHeight + gap }, { x: step, y: topHeight + gap }];
  } else if (layout === 'roadmap') {
    start = { x: 0, y: 0 };
    positions = [{ x: 0, y: 216 }, { x: step, y: 216 }, { x: step * 2, y: 216 }, { x: step * 3, y: 216 }];
  } else if (layout === 'story') {
    start = { x: (step + width - 300) / 2, y: 0 };
    positions = [{ x: 0, y: 220 }, { x: step, y: 220 }, { x: step, y: topHeight + 220 + gap }, { x: 0, y: topHeight + 220 + gap }];
  } else if (layout === 'evidence') {
    start = { x: step, y: Math.max(0, maxHeight / 2 - 68) };
    positions = [{ x: 0, y: 0 }, { x: step * 2, y: 0 }, { x: 0, y: topHeight + gap }, { x: step * 2, y: topHeight + gap }];
  } else if (layout === 'focus') {
    start = { x: (step * 2 + width - 300) / 2, y: 0 };
    positions = [{ x: 0, y: 220 }, { x: step, y: 220 }, { x: step * 2, y: 220 }, { x: step, y: 220 + maxHeight + gap }];
  } else {
    start = { x: (step + width - 300) / 2, y: 0 };
    positions = cards.map((card, index) => ({ x: (index % 2) * step, y: 220 + (index < 2 ? 0 : topHeight + gap) }));
  }
  const nodes = [{ ...anchor, ...start }, ...cards.map((card, index) => ({ ...card, ...positions[index] }))];
  let pairs;
  if (layout === 'timeline') pairs = [[1, 2], [2, 3], [3, 4], [4, 5]];
  else if (layout === 'story') pairs = [[1, 2], [2, 3], [3, 4], [4, 5]];
  else if (layout === 'focus') pairs = [[1, 2], [1, 3], [1, 4], [3, 5]];
  else pairs = cards.map(card => [1, card.id]);
  const edges = pairs.map(([from, to], index) => {
    const a = nodes.find(node => node.id === from), b = nodes.find(node => node.id === to);
    const vertical = a.x === b.x || (from === 1 && ['focus', 'workshop', 'matrix', 'roadmap', 'story'].includes(layout));
    return { id: index + 1, from, to, side: vertical ? 'bottom' : b.x > a.x ? 'right' : 'left',
      ...(from === 1 && vertical ? { controlY: b.y - (b.y > 220 ? gap / 2 : 22) } : {}),
      structure: 'elbow', pattern: 'solid', weight: 'regular' };
  });
  return { nodes, edges };
}
