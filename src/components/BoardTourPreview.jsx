import Icon from "./BoardIcon";
import CanvasControlIcon from "./CanvasControlIcon";
import styles from "../styles/boardTour.module.css";

function MiniShape({ x, y, width = 106, label, accent = false }) {
  return <g className={accent ? styles.miniAccentShape : styles.miniShape}>
    <rect x={x} y={y} width={width} height="38" rx="8"/>
    <text x={x + width / 2} y={y + 23} textAnchor="middle">{label}</text>
  </g>;
}

// Illustrative previews only: the real board stays untouched throughout the tour.
export default function BoardTourPreview({ target }) {
  return <figure className={styles.preview} aria-hidden="true">
    <svg className={styles.previewCanvas} viewBox="0 0 320 116" fill="none" focusable="false">
      {target === "tool-box" && <g className={styles.previewReveal}>
        <rect className={styles.miniSurface} x="119" y="8" width="82" height="24" rx="6"/>
        <text className={styles.miniBold} x="135" y="24">B</text>
        <text className={styles.miniItalic} x="158" y="24">I</text>
        <circle cx="184" cy="20" r="5" fill="#9773d2"/>
        <MiniShape x={82} y={47} width={156} label="Your next idea"/>
        <rect x="78" y="43" width="164" height="46" rx="10" stroke="#a385d6" strokeWidth="1.2"/>
        {[78, 242].flatMap(x => [43, 89].map(y => <rect key={`${x}-${y}`} x={x - 2.5} y={y - 2.5} width="5" height="5" rx="1" fill="white" stroke="#9a7acd"/>))}
        <path d="M202 59v14" stroke="#8961c5" strokeWidth="1.3"/>
        <g transform="translate(235 83)"><Icon name="cursor" size={19}/></g>
      </g>}
      {target === "tool-link" && <>
        <path className={styles.previewConnection} d="M124 38h28a10 10 0 0 1 10 10v18a10 10 0 0 0 10 10h24" stroke="#a48acb" strokeWidth="1.8"/>
        <MiniShape x={18} y={19} label="Idea"/>
        <MiniShape x={196} y={57} label="Next step" accent/>
        <circle cx="124" cy="38" r="3" fill="white" stroke="#9773ca" strokeWidth="1.5"/>
        <circle cx="196" cy="76" r="3" fill="white" stroke="#9773ca" strokeWidth="1.5"/>
        <g transform="translate(278 93)"><Icon name="cursor" size={17}/></g>
      </>}
      {target === "tool-frame" && <g className={styles.previewReveal}>
        <rect x="35" y="12" width="250" height="91" rx="10" fill="#f0ebf8" fillOpacity=".7" stroke="#b6a0d3" strokeDasharray="3 3"/>
        <text className={styles.miniLabel} x="48" y="30">Research</text>
        <MiniShape x={49} y={46} label="Notes"/>
        <MiniShape x={167} y={46} label="Insights"/>
      </g>}
      {target === "styles" && <>
        <path d="M60 53h42m116 0h42" stroke="#b4a1ce" strokeWidth="1.6" strokeDasharray="4 4"/>
        <MiniShape x={102} y={34} width={116} label="Your idea" accent/>
        {["#8965c0", "#82b7d6", "#92bfa7", "#e3b95f"].map((color, index) => <circle key={color} cx={127 + index * 22} cy="94" r="6" fill={color}/>)}
        <path d="m124 94 2 2 4-4" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        <rect x="99" y="31" width="122" height="44" rx="10" stroke="#b59ad8"/>
      </>}
      {target === "navigation" && <>
        <g className={styles.previewReveal}>
          <path d="M125 48h70" stroke="#b4a1ce" strokeWidth="1.5"/>
          <MiniShape x={46} y={29} width={79} label="Idea"/>
          <MiniShape x={195} y={29} width={79} label="Plan" accent/>
        </g>
        <path d="M38 28v-6h10m224 0h10v6m0 39v6h-10M48 73H38v-6" stroke="#b09acb" strokeWidth="1.5" strokeLinecap="round"/>
        <rect className={styles.miniSurface} x="99" y="84" width="122" height="25" rx="7"/>
        <text className={styles.miniZoom} x="113" y="101">−</text>
        <text className={styles.miniLabel} x="129" y="100">100%</text>
        <text className={styles.miniZoom} x="166" y="101">+</text>
        <path d="M187 90v13" stroke="#e2dce9"/>
        <g transform="translate(193 86)"><CanvasControlIcon name="fit"/></g>
      </>}
      {target === "export" && <>
        <rect className={styles.miniSurface} x="26" y="27" width="111" height="66" rx="9"/>
        <path d="M76 51h15v21h17" stroke="#c2aedb" strokeWidth="1.4"/>
        <rect x="39" y="40" width="37" height="21" rx="5" fill="#a58acb"/>
        <rect x="92" y="64" width="30" height="16" rx="4" fill="#dcd0ed"/>
        <path d="M155 60h32m-5-5 5 5-5 5" stroke="#b19acb" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        <g className={styles.previewReveal}>
          <path d="M214 20h36l16 16v52a6 6 0 0 1-6 6h-46a6 6 0 0 1-6-6V26a6 6 0 0 1 6-6Z" fill="white" stroke="#d9cce9"/>
          <path d="M249 20v13a4 4 0 0 0 4 4h13" stroke="#d9cce9"/>
          <g transform="translate(228 42)"><Icon name="download" size={20}/></g>
          <text className={styles.miniFileType} x="237" y="81" textAnchor="middle">.nova</text>
        </g>
        <circle cx="36" cy="14" r="3" fill="#89b79c"/>
        <text className={styles.miniSaved} x="45" y="17">Saved locally</text>
      </>}
    </svg>
  </figure>;
}
