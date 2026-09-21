import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import BoardIcon from "./BoardIcon";
import { templates } from "../data/templates";
import usePageTitle from "../lib/usePageTitle";
import styles from "../styles/landing.module.css";

const examples = [
  { id: "product-roadmap", label: "Product roadmap", icon: "layout", title: "The next big thing", category: "STRATEGY & PLANNING", description: "Turn your vision into a clear plan of action." },
  { id: "brainstorm", label: "Brainstorm", icon: "spark", title: "Room for possibilities", category: "IDEAS & EXPLORATION", description: "Explore possibilities and find your next breakthrough." },
  { id: "study-notes", label: "Study notes", icon: "note", title: "Making sense of it all", category: "LEARNING & DISCOVERY", description: "Connect concepts and make knowledge stick." },
];

// These previews use the content and connections of the templates they open.
const layouts = {
  "product-roadmap": [[115, 156, 200], [465, 40, 190], [465, 156, 190], [465, 272, 190], [810, 96, 170], [810, 216, 170]],
  brainstorm: [[450, 156, 190], [450, 25, 190], [790, 156, 190], [450, 287, 190], [115, 156, 190], [790, 25, 190]],
  "study-notes": [[450, 156, 200], [115, 70, 190], [115, 245, 190], [800, 40, 190], [800, 156, 190], [800, 272, 190]],
};

function Mark() {
  return <svg className={styles.mark} width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 1.5c1.8 8.5 6 12.7 14.5 14.5C22 17.8 17.8 22 16 30.5 14.2 22 10 17.8 1.5 16 10 14.2 14.2 10 16 1.5Z" fill="currentColor"/></svg>;
}

function Arrow({ diagonal = false }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"}/></svg>;
}

function IdeaBackdrop() {
  return <div className={styles.heroAtmosphere} aria-hidden="true">
    <div className={styles.heroPrism}/>
    <div className={styles.heroMesh}/>
    <div className={styles.gridLight}/>
    <svg className={`${styles.ideaField} ${styles.ideaFieldLeft}`} width="280" height="420" viewBox="0 0 280 420" fill="none" focusable="false">
      <g className={styles.ideaTracks}>
        <path d="M94 128v38q0 14 14 14h74q14 0 14 14v40" pathLength="1"/>
        <path d="M196 306v42q0 14 14 14h70" pathLength="1"/>
      </g>
      <g className={styles.ideaSignals}>
        <path d="M94 128v38q0 14 14 14h74q14 0 14 14v40" pathLength="1"/>
        <path d="M196 306v42q0 14 14 14h70" pathLength="1"/>
      </g>
      <g transform="translate(26 48)"><g className={styles.ideaTile}>
        <rect className={styles.ideaPaper} width="136" height="80" rx="12"/>
        <path className={styles.ideaGlyph} d="m22 18 2.5 7.5L32 28l-7.5 2.5L22 38l-2.5-7.5L12 28l7.5-2.5Z"/>
        <path className={styles.ideaInk} d="M45 25h67M45 33h42M17 56h75"/>
        <rect className={styles.ideaAccent} x="106" y="51" width="13" height="10" rx="3"/>
      </g></g>
      <g transform="translate(126 234)"><g className={`${styles.ideaTile} ${styles.ideaTileSecond}`}>
        <rect className={styles.ideaPaper} width="140" height="72" rx="12"/>
        <rect className={styles.ideaAccent} x="15" y="16" width="27" height="27" rx="7"/>
        <path className={styles.ideaGlyph} d="m22 29 4 4 9-10"/>
        <path className={styles.ideaInk} d="M55 25h63M55 35h39M16 56h77"/>
      </g></g>
      <g className={styles.gridBits}><rect x="204" y="78" width="7" height="7" rx="2"/><path d="M39 262v12m-6-6h12"/><rect x="81" y="355" width="5" height="5" rx="1"/></g>
    </svg>
    <svg className={`${styles.ideaField} ${styles.ideaFieldRight}`} width="280" height="420" viewBox="0 0 280 420" fill="none" focusable="false">
      <g className={styles.ideaTracks}>
        <path d="M196 154v38q0 14-14 14h-82q-14 0-14 14v40" pathLength="1"/>
        <path d="M86 332v34q0 14-14 14H0" pathLength="1"/>
      </g>
      <g className={styles.ideaSignals}>
        <path d="M196 154v38q0 14-14 14h-82q-14 0-14 14v40" pathLength="1"/>
        <path d="M86 332v34q0 14-14 14H0" pathLength="1"/>
      </g>
      <g transform="translate(126 76)"><g className={`${styles.ideaTile} ${styles.ideaTileThird}`}>
        <rect className={styles.ideaPaper} width="140" height="78" rx="12"/>
        <path className={styles.ideaGlyph} d="M18 31h11m-5-6 6 6-6 6M35 22v24"/>
        <path className={styles.ideaInk} d="M51 26h66M51 36h42M18 59h78"/>
        <rect className={styles.ideaAccent} x="109" y="53" width="14" height="11" rx="3"/>
      </g></g>
      <g transform="translate(18 260)"><g className={`${styles.ideaTile} ${styles.ideaTileFourth}`}>
        <rect className={styles.ideaPaper} width="136" height="72" rx="12"/>
        <path className={styles.ideaGlyph} d="M18 40V28m9 12V19m9 21V32"/>
        <path className={styles.ideaInk} d="M51 26h63M51 36h41M18 55h86"/>
      </g></g>
      <g className={styles.gridBits}><rect x="59" y="117" width="6" height="6" rx="1"/><path d="M241 293v12m-6-6h12"/><rect x="199" y="369" width="5" height="5" rx="1"/></g>
    </svg>
  </div>;
}

function PreviewMap({ template, zoom = 100, animated = false }) {
  const gradientId = useId().replaceAll(":", "");
  const nodes = template.board.nodes.map((node, index) => {
    const [x, y, width] = layouts[template.id][index];
    return { ...node, x, y, width, height: 76 };
  });

  function connector(edge) {
    const from = nodes.find(node => node.id === edge.from);
    const to = nodes.find(node => node.id === edge.to);
    if (edge.side === "top" || edge.side === "bottom") {
      const down = edge.side === "bottom";
      const x1 = from.x + from.width / 2;
      const x2 = to.x + to.width / 2;
      const y1 = from.y + (down ? from.height : 0);
      const y2 = to.y + (down ? 0 : to.height);
      return `M${x1} ${y1}C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`;
    }
    const left = edge.side === "left";
    const x1 = from.x + (left ? 0 : from.width);
    const x2 = to.x + (left ? to.width : 0);
    const y1 = from.y + from.height / 2;
    const y2 = to.y + to.height / 2;
    return `M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}`;
  }

  return <svg className={`${styles.map} ${animated ? styles.animatedMap : ""}`} viewBox="0 0 1100 390" role="img" aria-label={`${template.name}: ${nodes.map(node => node.title).join(", ")}`}>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9852eb"/><stop offset=".5" stopColor="#7140db"/><stop offset="1" stopColor="#425fda"/></linearGradient></defs>
    <g transform={`translate(550 195) scale(${zoom / 100}) translate(-550 -195)`}>
    <g className={styles.connections}>{template.board.edges.map((edge, index) => <path key={edge.id} d={connector(edge)} pathLength="1" style={{ "--edge-delay": `${260 + index * 120}ms` }}/>)}</g>
    {animated && <g className={styles.connectionSignals} aria-hidden="true">{template.board.edges.map((edge, index) => <path key={edge.id} d={connector(edge)} pathLength="1" style={{ "--signal-delay": `${2200 + index * 300}ms` }}/>)}</g>}
    {nodes.map((node, index) => <g key={node.id} transform={`translate(${node.x} ${node.y})`} className={`${styles.mapNode} ${node.root ? styles.rootNode : styles[node.color] || ""}`}>
      <g className={styles.nodeArrival} style={{ "--node-delay": `${node.root ? 120 : 520 + index * 110}ms`, "--idea-x": `${node.root ? 0 : index % 2 ? -24 : 24}px`, "--idea-y": `${node.root ? 14 : index % 2 ? 18 : -18}px`, "--idea-tilt": `${node.root ? 0 : index % 2 ? -3 : 3}deg` }}>
      <rect width={node.width} height={node.height} rx="10" style={node.root ? { fill: `url(#${gradientId})` } : undefined}/>
      {node.root && <path className={styles.nodeSpark} d="m20 16 1.5 4.5L26 22l-4.5 1.5L20 28l-1.5-4.5L14 22l4.5-1.5Z"/>}
      <text x="20" y={node.root ? 44 : 32} className={styles.nodeTitle}>{node.title}</text>
      <text x="20" y={node.root ? 61 : 51} className={styles.nodeNote}>{node.note}</text>
      {!node.root && <circle className={styles.nodePort} cx="0" cy="38" r="3"/>}
      </g>
    </g>)}
    </g>
  </svg>;
}

function CanvasPreview({ onCreate }) {
  const [active, setActive] = useState(0);
  const [view, setView] = useState("canvas");
  const [zoom, setZoom] = useState(100);
  const example = examples[active];
  const template = templates.find(item => item.id === example.id);
  const changeExample = index => { setActive(index); setZoom(100); };

  return <div className={styles.showcase} id="product" data-reveal="" data-ambient="">
    <div className={styles.previewShell}><div className={styles.preview}>
      <aside className={styles.previewSidebar}>
        <div className={styles.workspaceLabel}><span className={styles.workspaceIcon}><Mark/></span><div><b>My workspace</b><span>Personal workspace</span></div></div>
        <div className={styles.sidebarSection}><BoardIcon name="grid" size={16}/><b>Example boards</b><span>3</span></div>
        <div className={styles.examplePicker} role="group" aria-label="Explore canvas examples">{examples.map((item, index) => <button key={item.id} aria-pressed={active === index} className={active === index ? styles.activeExample : ""} onClick={() => changeExample(index)}><BoardIcon name={item.icon} size={17}/><span>{item.label}</span>{active === index && <span className={styles.selectedDot}/>}</button>)}</div>
        <Link className={styles.newBoard} to="/projects"><BoardIcon name="plus" size={16}/>Create a board</Link>
        <div className={styles.sidebarBottom}><span className={styles.secureIcon}><BoardIcon name="lock" size={16}/></span><div><b>Your private space</b><span>Stored on your device</span></div></div>
      </aside>
      <div className={styles.previewMain}>
        <div className={styles.previewHeader}><div className={styles.boardIdentity}><BoardIcon name={example.icon} size={19}/><b>{template.name}</b><span>Preview</span></div><button className={styles.useTemplate} onClick={() => onCreate(template)}>Use template <Arrow diagonal/></button></div>
        <div className={styles.previewSubheader}><div className={styles.viewPicker} role="group" aria-label="Preview view"><button aria-pressed={view === "canvas"} onClick={() => setView("canvas")}><BoardIcon name="layout" size={15}/>Canvas</button><button aria-pressed={view === "outline"} onClick={() => setView("outline")}><BoardIcon name="outline" size={15}/>Outline</button></div><span><BoardIcon name="lock" size={13}/>Only on your device</span></div>
        <div className={styles.previewCanvas} data-reveal="">
          {view === "canvas" ? <>
            <div className={styles.canvasLabel}><span className={styles.canvasLabelDot}/>{template.name}<span>{template.board.nodes.length} ideas</span></div>
            <div className={styles.mapViewport}><PreviewMap key={example.id} template={template} zoom={zoom} animated/></div>
            <div className={styles.previewTools} aria-hidden="true"><span className={styles.selectedTool}><BoardIcon name="cursor" size={19}/></span><span><BoardIcon name="hand" size={19}/></span><i/><span><BoardIcon name="plus" size={19}/></span><span><BoardIcon name="text" size={19}/></span><span><BoardIcon name="note" size={19}/></span><span><BoardIcon name="link" size={19}/></span></div>
            <div className={styles.previewZoom} role="group" aria-label="Preview zoom"><button onClick={() => setZoom(value => Math.max(75, value - 25))} disabled={zoom === 75} aria-label="Zoom preview out">−</button><span aria-live="polite">{zoom}%</span><button onClick={() => setZoom(value => Math.min(125, value + 25))} disabled={zoom === 125} aria-label="Zoom preview in">+</button><button onClick={() => setZoom(100)} aria-label="Fit preview"><BoardIcon name="fit" size={16}/></button></div>
          </> : <div className={styles.outlinePreview}><span className={styles.outlineHeading}>BOARD OUTLINE</span><h3>{template.name}</h3><ol>{template.board.nodes.map(node => <li key={node.id}><span className={node.root ? styles.outlineRoot : styles.outlineNode}><BoardIcon name={node.root ? "spark" : "box"} size={17}/></span><div><b>{node.title}</b><span>{node.note}</span></div><span className={styles.outlineConnection}>{template.board.edges.filter(edge => edge.from === node.id).length || "—"}<BoardIcon name="link" size={13}/></span></li>)}</ol></div>}
        </div>
        <div className={styles.previewFooter}><span><span className={styles.liveDot}/>Interactive preview</span><span>{template.board.nodes.length} ideas<span className={styles.footerDot}/> {template.board.edges.length} connections</span><span className={styles.previewTip}>Your next idea starts here <Arrow/></span></div>
      </div>
    </div>
    </div>
    <p className={styles.demoCaption}>A little structure. A whole new perspective.<span>Choose a board above to explore.</span></p>
  </div>;
}

function SectionHeading({ eyebrow, title, description, children }) {
  return <div className={styles.sectionHeading} data-reveal=""><div><span className={styles.sectionEyebrow}>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</div>;
}

// Reveal once as content enters the viewport. Resting styles remain visible
// without the observer, and keyboard focus never lands on hidden content.
function useLandingMotion(ref) {
  useEffect(() => {
    const page = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer;
    const reveal = element => { element.dataset.reveal = "visible"; };
    const setup = () => {
      observer?.disconnect();
      const elements = page.querySelectorAll("[data-reveal], [data-ambient]");
      if (preference.matches || typeof IntersectionObserver === "undefined") {
        elements.forEach(element => {
          if (element.hasAttribute("data-reveal")) reveal(element);
          delete element.dataset.offscreen;
        });
        return;
      }
      observer = new IntersectionObserver(entries => {
        entries.forEach(({ target, isIntersecting }) => {
          if (target.hasAttribute("data-ambient")) target.dataset.offscreen = String(!isIntersecting);
          if (!isIntersecting || !target.hasAttribute("data-reveal")) return;
          reveal(target);
          if (!target.hasAttribute("data-ambient")) observer.unobserve(target);
        });
      }, { threshold: 0.06 });
      elements.forEach(element => {
        if (element.hasAttribute("data-reveal") && element.dataset.reveal !== "visible") element.dataset.reveal = "pending";
        observer.observe(element);
      });
    };
    const onFocus = event => {
      let element = event.target.closest("[data-reveal]");
      while (element) {
        reveal(element);
        element = element.parentElement?.closest("[data-reveal]");
      }
    };
    setup();
    preference.addEventListener("change", setup);
    page.addEventListener("focusin", onFocus);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", setup);
      page.removeEventListener("focusin", onFocus);
    };
  }, [ref]);
}

const faqs = [
  { question: "Do I need an account to get started?", answer: "No. Open your workspace and start with a blank board or one of the templates. There’s no sign-up or setup." },
  { question: "Where are my boards saved?", answer: "Nova automatically saves your boards in this browser on this device. Export a .nova file or back up your workspace to keep a separate copy. Clearing browser data can remove your local boards." },
  { question: "Can I share or export my work?", answer: "Yes. Share a snapshot link that opens as an editable copy, or export your board as an image, PDF, or .nova file. Shared copies are independent, so later edits don’t sync between them." },
  { question: "Can I use Nova offline?", answer: "Once you’ve opened Nova online, you can return to your saved boards and keep working offline in the same browser." },
];

export default function Landing({ onCreate }) {
  usePageTitle("Turn ideas into a clear next step");
  const pageRef = useRef(null);
  const [motionPaused, setMotionPaused] = useState(false);
  useLandingMotion(pageRef);

  return <div ref={pageRef} className={styles.landing} data-motion-paused={motionPaused}>
    <a href="#main" className={styles.skipLink}>Skip to content</a>
    <header className={styles.header}><div className={styles.nav}>
      <Link to="/" className={styles.brand} aria-label="Nova home"><span className={styles.brandIcon}><Mark/></span><b>nova</b></Link>
      <nav aria-label="Main navigation"><a href="#product">Product</a><a href="#templates">Templates</a><a href="#features">Why Nova</a><a href="#faq">FAQs</a></nav>
      <div className={styles.navActions}><Link className={styles.workspaceLink} to="/projects">Open workspace</Link><Link className={styles.enterTop} to="/projects">Get started <Arrow/></Link></div>
    </div></header>

    <main id="main">
      <section className={styles.hero} aria-labelledby="hero-title" data-ambient="">
        <IdeaBackdrop/>
        <button type="button" className={styles.motionToggle} onClick={() => setMotionPaused(value => !value)} aria-label={motionPaused ? "Resume ambient animations" : "Pause ambient animations"} aria-pressed={motionPaused}><svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">{motionPaused ? <path d="m5 3 7 5-7 5Z" fill="currentColor"/> : <path d="M5 4v8M11 4v8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>}</svg><span>{motionPaused ? "Resume motion" : "Pause motion"}</span></button>
        <div className={styles.heroCopy}>
          <a className={styles.eyebrow} href="#product"><span><BoardIcon name="spark" size={15}/></span>A new perspective starts here<Arrow/></a>
          <h1 id="hero-title">Big ideas deserve<br/><span>a bigger picture.</span></h1>
          <p>Turn scattered thoughts into connected ideas, clear plans,<br className={styles.desktopBreak}/> and your next move. All in one visual workspace.</p>
          <div className={styles.heroActions}><Link className={styles.primaryLink} to="/projects">Start creating <Arrow/></Link><a className={styles.secondaryLink} href="#product"><BoardIcon name="layout" size={18}/>Explore the canvas</a></div>
          <div className={styles.heroNote}><span><Check/>No account needed</span><span><Check/>Private by default</span><span><Check/>Ready in seconds</span></div>
        </div>
        <CanvasPreview onCreate={onCreate}/>
      </section>

      <section className={styles.useCases} data-reveal="" aria-label="A workspace for every way you think"><span>BUILT FOR THE WAY YOU THINK</span><div><BoardIcon name="layout" size={22}/>Product & strategy</div><div><BoardIcon name="spark" size={22}/>Brainstorming</div><div><BoardIcon name="calendar" size={22}/>Project planning</div><div><BoardIcon name="note" size={22}/>Learning & research</div></section>

      <section className={styles.features} id="features" aria-labelledby="features-title">
        <SectionHeading eyebrow="THINK CLEARER. MOVE FORWARD." title={<span id="features-title">Less friction.<br/><span className={styles.gradientText}>More forward motion.</span></span>} description="The space to explore. The structure to make it happen."/>
        <div className={styles.featureGrid}>
          <article className={styles.connectionFeature} data-reveal="">
            <span className={styles.featureIcon}><BoardIcon name="layout" size={22}/></span><h3>Bring the whole picture together.</h3><p>Connect ideas, map decisions, and follow every possibility on a canvas that grows with you.</p>
            <div className={styles.connectionArt} aria-hidden="true"><svg viewBox="0 0 600 260" fill="none"><path pathLength="1" d="M-5 130h140c55 0 30-70 90-70h20m-110 70c55 0 30 70 90 70h20m130-140h20c55 0 25 70 80 70h95m-195 70h20c55 0 25-70 80-70"/><rect x="-20" y="101" width="157" height="58" rx="9"/><rect x="240" y="31" width="144" height="58" rx="9"/><rect x="240" y="171" width="144" height="58" rx="9"/><rect x="491" y="101" width="145" height="58" rx="9"/><text x="62" y="135">The big idea</text><text x="312" y="65">Explore possibilities</text><text x="312" y="205">Find the next step</text><text x="557" y="135">Move forward</text><circle cx="137" cy="130" r="4"/><circle cx="240" cy="60" r="4"/><circle cx="240" cy="200" r="4"/></svg><span className={styles.artCursor}><BoardIcon name="cursor" size={21}/><span>Your next move</span></span></div>
          </article>
          <article className={styles.styleFeature} data-reveal=""><span className={styles.featureIcon}><BoardIcon name="palette" size={22}/></span><h3>Make every idea your own.</h3><p>Colors, shapes, rich text, and connections. A toolkit that adapts to your way of thinking.</p><div className={styles.styleArt} aria-hidden="true"><div className={styles.styleNode}><BoardIcon name="spark" size={20}/><b>Something worth exploring</b><span>Start with a different perspective.</span></div><div className={styles.styleToolbar}><span><BoardIcon name="palette" size={16}/></span><i/><i/><i/><i/><i/><span className={styles.styleToolbarDivider}/><BoardIcon name="box" size={16}/></div></div></article>
          <article className={styles.smallFeature} data-reveal=""><span className={styles.featureIcon}><BoardIcon name="lock" size={22}/></span><h3>Private from the start.</h3><p>Your boards stay in your browser, on your device. Your workspace is yours.</p><span className={styles.featureDetail}><span className={styles.liveDot}/>Saved locally. Automatically.</span></article>
          <article className={styles.smallFeature} data-reveal=""><span className={styles.featureIcon}><BoardIcon name="share" size={22}/></span><h3>Ready to share.</h3><p>Send an editable snapshot or export your ideas as an image, PDF, or Nova file.</p><div className={styles.fileTypes}><span>PNG</span><span>PDF</span><span>.nova</span><BoardIcon name="download" size={17}/></div></article>
          <article className={styles.smallFeature} data-reveal=""><span className={styles.featureIcon}><BoardIcon name="present" size={22}/></span><h3>Make your point.</h3><p>Save the views that matter and present your board, one clear step at a time.</p><span className={styles.presentationDetail}><span/><span/><span/><Arrow/></span></article>
        </div>
      </section>

      <section className={styles.templatesSection} id="templates" aria-labelledby="templates-title">
        <SectionHeading eyebrow="A HEAD START ON WHAT’S NEXT" title={<span id="templates-title">Skip the blank canvas.</span>} description="Start with a little structure. Make it completely yours."><Link className={styles.textLink} to="/projects">All {templates.length} templates <Arrow/></Link></SectionHeading>
        <div className={styles.templateGrid}>{examples.map((example, index) => {
          const template = templates.find(item => item.id === example.id);
          return <button key={example.id} className={styles.templateCard} data-reveal="" onClick={() => onCreate(template)} aria-label={`Start with ${template.name}`}><span className={`${styles.templateArt} ${styles[`templateArt${index}`]}`}><PreviewMap template={template}/><span className={styles.templateTag}><BoardIcon name={example.icon} size={13}/>{index === 0 ? "Planning" : index === 1 ? "Ideation" : "Learning"}</span></span><span className={styles.templateCopy}><span className={styles.templateTitle}>{template.name}<Arrow diagonal/></span><span className={styles.templateDescription}>{example.description}</span></span></button>;
        })}</div>
      </section>

      <section className={styles.workflow} aria-labelledby="workflow-title"><div className={styles.workflowIntro} data-reveal=""><span className={styles.sectionEyebrow}>FROM IDEA TO ACTION</span><h2 id="workflow-title">Get into your flow.<br/>Stay there.</h2><Link className={styles.textLink} to="/projects">Open your workspace <Arrow/></Link></div><div className={styles.steps}>{[{title:"Start with a thought.", text:"Pick a template or start fresh. Get your first idea onto the canvas."}, {title:"Make the connections.", text:"Add branches, organize your thinking, and see how everything fits."}, {title:"Take the next step.", text:"Present your plan, share a snapshot, or come back when inspiration strikes."}].map((step, index) => <article key={step.title} data-reveal=""><span>0{index + 1}</span><div><h3>{step.title}</h3><p>{step.text}</p></div></article>)}</div></section>

      <section className={styles.faq} id="faq" aria-labelledby="faq-title"><div data-reveal=""><span className={styles.sectionEyebrow}>GOOD TO KNOW</span><h2 id="faq-title">A little clarity<br/>before you start.</h2></div><div className={styles.faqList} data-reveal="">{faqs.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>

      <section className={styles.closing} data-reveal="" aria-labelledby="closing-title"><div className={styles.closingGrid} aria-hidden="true"/><div><span className={styles.closingBadge}><Mark/>YOUR NEXT CHAPTER STARTS HERE</span><h2 id="closing-title">Make your next<br/>big idea happen.</h2><p>You bring the ideas. We’ll bring the space.</p></div><div className={styles.closingActions}><Link className={styles.primaryLink} to="/projects">Start creating <Arrow/></Link><span><Check/>No account. No setup. Just start.</span></div></section>
    </main>

    <footer className={styles.footer}><div className={styles.footerTop}><div><Link to="/" className={styles.brand} aria-label="Nova home"><span className={styles.brandIcon}><Mark/></span><b>nova</b></Link><p>Your ideas, connected.</p></div><nav aria-label="Footer navigation"><a href="#product">Product</a><a href="#templates">Templates</a><a href="#faq">FAQs</a><Link to="/projects">Open workspace <Arrow diagonal/></Link></nav></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} Nova</span><span><span className={styles.liveDot}/>A private space for your next big idea.</span><a href="#main">Back to top <span aria-hidden="true">↑</span></a></div></footer>
  </div>;
}

function Check() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
