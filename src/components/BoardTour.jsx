import { useId, useLayoutEffect, useRef, useState } from "react";
import Icon from "./BoardIcon";
import BoardTourPreview from "./BoardTourPreview";
import { placeTourCard } from "../lib/boardTour";
import useMediaQuery from "../lib/useMediaQuery";
import styles from "../styles/boardTour.module.css";

const steps = [
  {
    target: "tool-box", icon: "box", title: "Add a shape",
    description: "Click Shape to add. Double-click its text to edit.",
  },
  {
    target: "tool-link", icon: "link", title: "Connect ideas",
    description: "Choose Connect, then click two shapes.",
  },
  {
    target: "tool-frame", icon: "frame", title: "Organize with frames",
    description: "Create a named section for related ideas.",
  },
  {
    target: "styles", icon: "palette", title: "Style a branch",
    description: "Select any shape or line to style its entire connected branch.",
  },
  {
    target: "navigation", icon: "hand", title: "Pan & zoom",
    description: "Space + drag to pan. Use − / + to zoom.",
  },
  {
    target: "export", icon: "download", title: "Save & export",
    description: "Auto-saved here. Export images, SVG, PDF, or a Nova backup.",
  },
];

export default function BoardTour({ onDismiss }) {
  const mobile = useMediaQuery();
  const [index, setIndex] = useState(-1);
  const [placement, setPlacement] = useState(null);
  const dialogRef = useRef(null), cardRef = useRef(null), headingRef = useRef(null);
  const maskId = useId();
  const step = steps[index];
  const ready = placement !== null;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      const restore = previousFocus?.isConnected && previousFocus !== document.body
        ? previousFocus : document.querySelector('[data-tour="replay"]');
      restore?.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    const target = step ? document.querySelector(`[data-tour="${mobile && step.target === "export" ? "mobile-more" : step.target}"]`) : null;
    const measure = () => {
      const rect = target?.getBoundingClientRect();
      setPlacement(placeTourCard(rect, { width: window.innerWidth, height: window.visualViewport?.height || window.innerHeight }, cardRef.current.getBoundingClientRect()));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(cardRef.current);
    if (target) observer.observe(target);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [step, mobile]);

  useLayoutEffect(() => {
    if (ready) {
      cardRef.current.scrollTop = 0;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [index, ready]);

  const spotlight = placement?.spotlight;
  const finish = () => onDismiss("skipped");

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="board-tour-title" aria-describedby="board-tour-description"
      onCancel={event => { event.preventDefault(); finish(); }}
      onKeyDown={event => event.stopPropagation()} onKeyUp={event => event.stopPropagation()}>
      <svg className={styles.shade} aria-hidden="true">
        <defs><mask id={maskId}><rect width="100%" height="100%" fill="white"/>{spotlight && <rect x={spotlight.left} y={spotlight.top} width={spotlight.width} height={spotlight.height} rx="12" fill="black"/>}</mask></defs>
        <rect width="100%" height="100%" fill="#201a35" fillOpacity=".42" mask={`url(#${maskId})`}/>
      </svg>
      {spotlight && <div className={styles.spotlight} style={spotlight} aria-hidden="true"/>}
      <section ref={cardRef} className={styles.card} style={{ left: placement?.left, top: placement?.top, visibility: placement ? "visible" : "hidden" }}>
        <button className={styles.skip} onClick={finish} aria-label="Skip tour" title="Skip tour">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        {step ? <BoardTourPreview key={step.target} target={step.target}/> : <div className={styles.welcomeArt} aria-hidden="true"><span className={styles.symbol}><Icon name="spark" size={28}/></span></div>}
        <div key={index} className={styles.body}>
          <h2 ref={headingRef} id="board-tour-title" tabIndex={-1}>{step?.title || "Welcome to your board"}</h2>
          <p id="board-tour-description">{mobile && step ? ({ "tool-box": "Tap Shape to add. Select it, then tap Edit.", "tool-link": "Choose Connect, then tap two shapes.", navigation: "Drag the canvas to pan. Pinch with two fingers to zoom.", export: "Auto-saved here. Open More to export your board." }[step.target] || step.description) : step?.description || "Six quick steps to get started."}</p>
          <footer className={styles.footer}>
            {step ? <button className={styles.back} onClick={() => setIndex(value => value - 1)} aria-label="Back" title="Previous step"><Icon name="back" size={16}/></button> : <span/>}
            {step ? <div className={styles.progress} role="progressbar" aria-label="Tour progress" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-valuetext={`Step ${index + 1} of ${steps.length}`}>
              {steps.map((item, position) => <span key={item.target} className={position === index ? styles.current : position < index ? styles.visited : ""}/>)}
            </div> : <span/>}
            <button className={styles.primary} onClick={() => index === steps.length - 1 ? onDismiss("completed") : setIndex(value => value + 1)}>
              {index === steps.length - 1 ? "Done" : step ? "Next" : "Start tour"}
              <Icon name="forward" size={16}/>
            </button>
          </footer>
        </div>
      </section>
    </dialog>
  );
}
