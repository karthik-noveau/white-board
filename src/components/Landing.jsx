import { useEffect, useRef } from "react";
import { Link } from "react-router";
import BoardIcon from "./BoardIcon";
import LandingPlayground from "./LandingPlayground";
import SiteHeader from "./SiteHeader";
import BrandMark from "./BrandMark";
import { brand } from "../lib/brand";
import styles from "../styles/landing.module.css";

function Arrow({ diagonal = false }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"}/></svg>;
}

function IdeaBackdrop() {
  return <div className={styles.heroAtmosphere} aria-hidden="true">
    <img src="/images/landing-landscape.jpg" width="1774" height="887" alt="" fetchPriority="high" decoding="async"/>
  </div>;
}

function SectionHeading({ eyebrow, title, description }) {
  return <div className={styles.sectionHeading} data-reveal=""><div><span className={styles.sectionEyebrow}>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</div></div>;
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
  { question: "Where are my boards saved?", answer: `${brand.name} automatically saves your boards in this browser on this device. Export a ${brand.name} board file or back up your workspace to keep a separate copy. Clearing browser data can remove your local boards.` },
  { question: "Can I share or export my work?", answer: "Yes. Share a read-only snapshot link or an editable copy, or export your board as an image, PDF, or an editable board file. Shared copies are independent, so later edits don’t sync between them." },
  { question: `Can I use ${brand.name} offline?`, answer: `Once you’ve opened ${brand.name} online, you can return to your saved boards and keep working offline in the same browser.` },
];

export default function Landing({ onCreate }) {
  const pageRef = useRef(null);
  useLandingMotion(pageRef);

  return <div ref={pageRef} className={styles.landing}>
    <a href="#main" className={styles.skipLink}>Skip to content</a>
    <SiteHeader/>

    <main id="main">
      <section className={styles.hero} aria-labelledby="hero-title" data-ambient="">
        <IdeaBackdrop/>
        <div className={styles.heroCopy}>
          <a className={styles.eyebrow} href="#product"><BoardIcon name="spark" size={15}/>A little space for your next big idea<Arrow/></a>
          <h1 id="hero-title">Big ideas deserve<br/>a bigger picture.</h1>
          <p>A quiet place for messy thinking. Connect your ideas,<br className={styles.desktopBreak}/> find the possibilities, and make your next move.</p>
          <div className={styles.heroActions}><Link className={styles.primaryLink} to="/projects">Start creating <Arrow/></Link></div>
          <div className={styles.heroNote}><span><Check/>No account needed</span><span><Check/>Private by default</span></div>
        </div>
        <LandingPlayground onCreate={onCreate}/>
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
          <article className={styles.smallFeature} data-reveal=""><span className={styles.featureIcon}><BoardIcon name="share" size={22}/></span><h3>Ready to share.</h3><p>Share a read-only snapshot or an editable copy. Export your ideas as an image, PDF, or board file.</p><div className={styles.fileTypes}><span>PNG</span><span>PDF</span><span>BOARD</span><BoardIcon name="download" size={17}/></div></article>
          <article className={styles.smallFeature} data-reveal=""><span className={styles.featureIcon}><BoardIcon name="present" size={22}/></span><h3>Make your point.</h3><p>Save the views that matter and present your board, one clear step at a time.</p><span className={styles.presentationDetail}><span/><span/><span/><Arrow/></span></article>
        </div>
      </section>

      <section className={styles.faq} id="faq" aria-labelledby="faq-title"><div data-reveal=""><span className={styles.sectionEyebrow}>GOOD TO KNOW</span><h2 id="faq-title">A little clarity<br/>before you start.</h2></div><div className={styles.faqList} data-reveal="">{faqs.map(item => <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>)}</div></section>

      <section className={styles.closing} data-reveal="" aria-labelledby="closing-title"><div className={styles.closingGrid} aria-hidden="true"/><div><span className={styles.closingBadge}><BrandMark size={24}/>YOUR NEXT CHAPTER STARTS HERE</span><h2 id="closing-title">Make your next<br/>big idea happen.</h2><p>You bring the ideas. We’ll bring the space.</p></div><div className={styles.closingActions}><Link className={styles.primaryLink} to="/projects">Start creating <Arrow/></Link><span><Check/>No account. No setup. Just start.</span></div></section>
    </main>

    <footer className={styles.footer}><div className={styles.footerTop}><div><Link to="/" className={styles.brand} aria-label={`${brand.name} home`}><span className={styles.brandIcon}><BrandMark size={24}/></span><b>{brand.name}</b></Link><p>{brand.tagline}</p></div><nav aria-label="Footer navigation"><a href="#product">Product</a><Link to="/templates">Templates</Link><a href="#faq">FAQs</a><Link to="/projects">Open workspace <Arrow diagonal/></Link></nav></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} {brand.name}</span><span><span className={styles.liveDot}/>A private space for your next big idea.</span><a href="#main">Back to top <span aria-hidden="true">↑</span></a></div></footer>
  </div>;
}

function Check() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
