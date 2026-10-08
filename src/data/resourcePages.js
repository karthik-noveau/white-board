import { brand } from '../lib/brand.js';

// Public product facts, shared by the visible pages and search metadata.
export const resourcePages = [
  {
    path: '/about', label: 'About DrawAnything', type: 'AboutPage',
    title: 'About DrawAnything — Your ideas, connected',
    description: 'Meet DrawAnything: a private visual workspace for connected ideas. Learn how it works, where boards live, and download the DrawAnything brand assets.',
    eyebrow: 'A little space. A bigger picture.',
    heading: 'Your ideas,\nconnected.',
    intro: 'DrawAnything is a private online whiteboard for the moment when a list is no longer enough. Bring thoughts, research, and plans together, then make the connections that help you move forward.',
    sections: [
      { id: 'purpose', title: 'Room to think. Tools to make it clear.', paragraphs: [
        'Start with one question, a blank board, or an editable template. Cards can hold notes, checklists, tables, code, and images. Connections show how those pieces fit together, while saved views give you a path through a larger board.',
        'Use a mind map to explore possibilities, a whiteboard to collect context, or a visual plan to turn a decision into a next step. The structure can change as your thinking does.',
      ] },
      { id: 'your-work', title: 'Your work starts on your device.', paragraphs: [
        'There is no account to create. Boards and recovery versions are saved in this browser on this device. Opening another browser, device, or website address opens a separate workspace.',
        'Keep an exported board file or a workspace backup somewhere safe. Browser storage can be cleared, and local recovery versions are not a separate backup.',
      ], link: { to: '/help#backups', label: 'Learn how to back up your work' } },
      { id: 'sharing', title: 'Share a version you choose.', paragraphs: [
        'Send a read-only snapshot, let someone import an editable copy, or export PNG, SVG, and PDF files. Shared snapshots capture the board at that moment; future edits do not synchronize.',
        'A snapshot link includes the shared board data. Anyone with the link can access that content. Choose what to include before copying the link.',
      ], link: { to: '/help#sharing', label: 'Understand sharing and exports' } },
    ],
    social: { title: brand.tagline, label: 'Meet DrawAnything', subtitle: 'A little space for your next big idea.', nodes: ['Your ideas', 'Room to think', 'Make it clear', 'Move forward'] },
  },
  {
    path: '/help', label: 'Help & getting started', type: 'WebPage',
    title: 'Save, share & back up your whiteboard — DrawAnything Help',
    description: 'Get started with DrawAnything. Learn how to save boards, download backups, share snapshots, export PNG, SVG or PDF, and work offline in your browser.',
    eyebrow: 'A clearer way to get started',
    heading: 'A little help.\nA lot of possibility.',
    intro: 'Your first board takes just a moment. Here is how to start, keep your work safe, and choose the right way to share it.',
    sections: [
      { id: 'first-board', title: 'Start your first board', paragraphs: [
        'Open your workspace to create a blank board, or choose Use template in the template library. Each template becomes a separate editable board. Rename it, add your own content, and move or connect cards to fit the idea.',
        'For a first session, try Radial brainstorm: replace the central idea with a question, add a few possibilities, and connect one of them to a next step.',
      ], link: { to: '/templates#template-brainstorm', label: 'Explore the Radial brainstorm template' } },
      { id: 'saving', title: 'Understand where your work is saved', paragraphs: [
        'DrawAnything automatically saves boards in this browser on this device. Return using the same browser profile and website address to find them again. There is no account-based cloud sync.',
        'Clearing site data, deleting a browser profile, or losing the device can remove your workspace. Private browsing may discard it when the session ends. Download a separate backup for work you want to keep.',
      ] },
      { id: 'backups', title: 'Back up and move your workspace', paragraphs: [
        'In the workspace header, choose Back up, then Download file. Keep the downloaded .drawanything-workspace file outside the browser, such as in your files or a storage service you trust.',
        'To move your work, open DrawAnything on the other device, choose Import, then Import file, and select the backup. You can also download a single editable .drawanything board file from the board’s export options.',
        'Back up again after meaningful changes. A downloaded file preserves the version you exported; it does not update automatically.',
      ], link: { to: '/projects', label: 'Open your workspace' } },
      { id: 'sharing', title: 'Choose what a shared link can do', paragraphs: [
        'Open Share on a board. Choose Read-only to let someone view the snapshot, or Editable to let them work on a separate copy on their device. Review the included content, then copy the link.',
        'Shared links are snapshots, not live collaborative sessions. To share a later version, create a new link. Existing links keep the content they already contain.',
        'Anyone with the link can access the included content. Read-only controls the app’s editing experience; it does not prevent someone from copying the content. Download a file instead if the board is too large for a link.',
      ] },
      { id: 'exports', title: 'Pick an export format', paragraphs: [
        'Open Export on a board. Choose PNG for an image, PDF for a document, or SVG for a vector graphic. Adjust the available export options and preview the result before downloading.',
        'Keep a .drawanything board file when you want to reopen and edit the board later. An image or PDF is useful for sharing a view, but it is not an editable board backup.',
      ] },
      { id: 'offline', title: 'Work offline after the app is ready', paragraphs: [
        'First open the deployed app online and allow its offline setup to finish. Then return to your saved boards using the same browser and website address when you are offline.',
        'Some optional features and resources need to load online before they are available offline. A new device needs an initial connection and an imported backup to access your work.',
      ] },
      { id: 'missing-board', title: 'Find a board that seems to be missing', paragraphs: [
        'Check that you are using the original browser profile, device, and website address. Look in Trash for a board that was deleted, or import your most recent downloaded backup.',
        'If the original browser data is gone and you have no separate backup or shared snapshot, there is no account-based copy for DrawAnything to restore.',
      ] },
    ],
    social: { title: 'Keep your ideas moving.', label: 'The DrawAnything field guide', subtitle: 'Start. Save. Share. Pick up where you left off.', nodes: ['Your workspace', 'Start a board', 'Keep a backup', 'Share your work'] },
  },
];

export const resourcePageFor = path => resourcePages.find(page => page.path === path);
