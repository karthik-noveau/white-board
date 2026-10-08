// Public editorial content only. Shared by the page, metadata, and social cards.
// Keep these guides grounded in the workflows the application actually supports.
export const productPages = [
  {
    path: '/online-whiteboard',
    label: 'Online whiteboard',
    title: 'Private online whiteboard, no account — DrawAnything',
    description: 'A private online whiteboard for notes, diagrams, and ideas. Connect rich cards, present your board, and export or share a snapshot. No account needed.',
    eyebrow: 'Your space, your pace',
    heading: 'A whiteboard for\nyour way of thinking.',
    intro: 'Bring notes, diagrams, images, and decisions together on an online whiteboard. DrawAnything gives you an open canvas with connected cards, automatic browser saves, and no account to set up.',
    action: 'Open a blank whiteboard',
    starter: null,
    templateIds: ['meeting-agenda', 'brainstorm', 'website-architecture'],
    preview: 'meeting-agenda',
    previewCaption: 'The Meeting to action template keeps discussion, decisions, and follow-up in one view.',
    definitionTitle: 'More context than a page. More structure than a blank space.',
    definition: 'An online whiteboard is a canvas for arranging information visually. In DrawAnything, cards hold your content and connections show how it relates. Use it to outline a conversation, explain a system, collect research, or explore an idea before committing it to a document.',
    exampleTitle: 'Try it: turn a meeting into a useful record',
    example: 'Start with Meeting to action. Write the outcome you need from the discussion, put supporting notes beside the agenda, and capture decisions as they happen. Add an owner and a next step for each action. Export a PDF for a stable record or send a read-only snapshot link. The recipient sees the version you shared; subsequent edits stay in your own board.',
    stepsTitle: 'From a blank canvas to a board you can share',
    steps: [
      { title: 'Give the board a purpose', text: 'Open a blank board for an unstructured idea, or start from a template for a meeting, project, or workshop. Name the board so you can find it again.' },
      { title: 'Bring the material together', text: 'Add rich text, checklists, tables, code, and images to cards. Keep related information close and connect cards when their relationship matters.' },
      { title: 'Create a path through the work', text: 'Arrange cards into groups, label connections, and save views for the areas you want to present. A little visual structure makes a large board easier to read.' },
      { title: 'Choose how to share it', text: 'Export PNG or PDF for a fixed view, download an editable board file, or create a snapshot link. Choose a read-only view or an independent editable copy.' },
    ],
    benefits: [
      { title: 'A workspace on your device', text: 'Boards save automatically in this browser. Export a board or back up the workspace to keep a separate copy before changing devices or clearing browser data.' },
      { title: 'Keep going offline', text: 'After the app has loaded and its offline setup has completed, return to saved boards in the same browser without a connection.' },
      { title: 'Share a deliberate snapshot', text: 'Choose what to include and send the current version. Snapshot links contain board data, so anyone with the link can access the shared content.' },
    ],
    faqs: [
      { question: 'Is this a live collaborative whiteboard?', answer: 'Shared boards are snapshots, not synchronized workspaces. A recipient can view a read-only snapshot or import an independent editable copy. Changes do not sync between people or devices.' },
      { question: 'Where is my whiteboard saved?', answer: 'Boards and recovery versions are stored in this browser on this device. Clearing browser data can remove them. Download board files or a workspace backup to keep a separate copy.' },
      { question: 'Can I open a shared board without an account?', answer: 'Yes. A snapshot link opens without sign-up. Anyone with the link can access the included content, so share it only with the people you intend to receive it.' },
    ],
    social: { title: 'Make room for the whole picture.', label: 'A private online whiteboard', subtitle: 'Notes. Diagrams. Your next big idea.', nodes: ['Your whiteboard', 'Capture a thought', 'Make a decision', 'Share a snapshot'] },
  },
];

export const productPageFor = path => productPages.find(page => page.path === path);
