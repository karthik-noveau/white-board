import { useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router";
import Icon from "./BoardIcon";
import StudioScreen from "./StudioScreen";
import { brokenInteractions, prototypeStart, prototypeStep, screenElements, studioColors, studioRoles, studioScreens } from "../lib/canvasStudio";
import { nodeSize } from "../lib/boardAppearance";
import { boardPath } from "../lib/routes";
import styles from "../styles/canvasStudio.module.css";

function StudioDialog({ children, label, className = "", onClose, onKeyDown }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current, previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-label={label} className={`${styles.dialog} ${className}`} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event=>{event.stopPropagation();onKeyDown?.(event)}}>{children}</dialog>;
}

export function StudioLaunch({ title, onCreate, onClose }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const create = async () => {
    setBusy(true); setError("");
    try { await onCreate(); } catch (failure) { setError(failure.message || "Could not create your Studio copy."); setBusy(false); }
  };
  return <StudioDialog label="Try Canvas Studio" onClose={busy ? () => {} : onClose} className={styles.launch}>
    <header><span className={styles.studioIcon}><Icon name="spark" size={22}/></span><button className={styles.iconButton} disabled={busy} onClick={onClose} aria-label="Close Canvas Studio"><Icon name="close"/></button></header>
    <span className={styles.eyebrow}>CANVAS STUDIO · PREVIEW</span><h2>Make your ideas<br/>something you can click.</h2><p>Build screens on your canvas, connect their actions, and play the experience.</p>
    <div className={styles.flowIllustration} aria-hidden="true"><div><span>01 / EXPLORE</span><i/><b/><em/></div><Icon name="forward"/><div><span>02 / DISCOVER</span><i/><b/><em/></div><Icon name="forward"/><div><span>03 / SAVED</span><i/><b/><em/></div></div>
    <div className={styles.copyNotice}><Icon name="duplicate" size={19}/><div><strong>Try it in a separate copy</strong><span>We’ll copy “{title}”. Your original stays as it is, with a direct link back.</span></div></div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <footer><button className={styles.secondary} disabled={busy} onClick={onClose}>Maybe later</button><button className={styles.primary} disabled={busy} onClick={create}>{busy ? "Creating your copy…" : "Create studio copy"}<Icon name="forward" size={16}/></button></footer>
  </StudioDialog>;
}

function EditField({ label, value, onCommit, multiline = false, type = "text", min, max }) {
  const [draft, setDraft] = useState(String(value ?? "")), id = useId();
  const commit = () => {
    let clean = draft;
    if (type === "number") { const number = Number(draft); clean = Number.isFinite(number) ? Math.min(max ?? Infinity, Math.max(min ?? -Infinity, number)) : Number(value); }
    if (String(clean) !== String(value ?? "")) onCommit(clean);
    setDraft(String(clean));
  };
  const props = { id, value: draft, onChange: event => setDraft(event.target.value), onBlur: commit, onKeyDown: event => { if (event.key === "Enter" && !multiline) event.currentTarget.blur(); if (event.key === "Escape") { event.stopPropagation(); setDraft(String(value ?? "")); } } };
  return <label className={styles.field} htmlFor={id}><span>{label}</span>{multiline ? <textarea {...props} rows={3} maxLength={1200}/> : <input {...props} type={type} min={min} max={max} maxLength={180}/>}</label>;
}

function ScreenInspector({ screen, elementId, nodes, onChange, onElementChange, onElementSelect, onAddElement, onRemoveElement, onDuplicate, onStart, onChoose, onRemoveScreen }) {
  const item = screenElements(screen).find(element => element.id === elementId), size = nodeSize(screen);
  const patch = (key, value) => onElementChange(screen.id, item.id, { [key]: value });
  return <>
    <div className={styles.inspectorHeading}><div><span>{item ? "SELECTED ELEMENT" : "SCREEN SETTINGS"}</span><h3>{item ? item.role[0].toUpperCase() + item.role.slice(1) : screen.title}</h3></div>{item && <button className={styles.iconButton} aria-label="Back to screen settings" onClick={() => onElementSelect(null)}><Icon name="close" size={16}/></button>}</div>
    {item ? <div key={`${screen.id}-${item.id}`} className={styles.inspectorFields}>
      <EditField key={`text-${item.text}`} label="Content" multiline value={item.text} onCommit={text => patch("text", text)}/>
      {item.role === "card" && <EditField key={`detail-${item.detail}`} label="Supporting text" value={item.detail} onCommit={text => patch("detail", text)}/>}
      <div className={styles.positionFields}>{[["x", "X", 0, size.width - item.w], ["y", "Y", 0, size.height - item.h], ["w", "Width", 32, size.width - item.x], ["h", "Height", 20, size.height - item.y]].map(([key, label, min, max]) => <EditField key={`${key}-${item[key]}`} label={label} type="number" value={item[key]} min={min} max={max} onCommit={value => patch(key, value)}/>)}</div>
      <div className={styles.field}><span>Accent</span><div className={styles.swatches}>{Object.entries(studioColors).map(([tone, color]) => <button key={tone} style={{ background: color }} aria-label={`${tone} element accent`} aria-pressed={(item.tone || "violet") === tone} onClick={() => patch("tone", tone)}/>)}</div></div>
      <div className={styles.interaction}><span><Icon name="cursor" size={15}/>ON CLICK</span><label className={styles.field}><span>Action</span><select aria-label="Element click action" value={item.action?.type === "back" ? "back" : item.action?.type === "navigate" ? `screen:${item.action.target}` : "none"} onChange={event => { const value = event.target.value; patch("action", value === "none" ? undefined : value === "back" ? { type: "back" } : { type: "navigate", target: studioScreens(nodes).find(target => String(target.id) === value.slice(7))?.id, transition: item.action?.transition || "slide" }); }}><option value="none">No action</option><option value="back">Go back</option>{studioScreens(nodes).map(target => <option key={target.id} value={`screen:${target.id}`}>Open {target.title}</option>)}{item.action?.type === "navigate" && !studioScreens(nodes).some(target => target.id === item.action.target) && <option value={`screen:${item.action.target}`} disabled>Deleted screen — choose a target</option>}</select></label>
        {item.action?.type === "navigate" && <label className={styles.field}><span>Transition</span><select aria-label="Screen transition" value={item.action.transition || "slide"} onChange={event => patch("action", { ...item.action, transition: event.target.value })}><option value="slide">Slide</option><option value="fade">Fade</option><option value="instant">Instant</option></select></label>}
        <p>Press Play to try this interaction.</p>
      </div>
      <button className={styles.deleteElement} onClick={() => onRemoveElement(screen.id, item.id)}><Icon name="trash" size={15}/>Remove element</button>
    </div> : <div className={styles.inspectorFields}>
      <EditField key={`${screen.id}-${screen.title}`} label="Screen name" value={screen.title} onCommit={title => onChange(screen.id, { title: title.trim() || "Untitled screen" })}/>
      <div className={styles.screenMeta}><span>{size.width} × {size.height}</span><button aria-pressed={Boolean(screen.studio.start)} onClick={() => onStart(screen.id)}><Icon name="present" size={14}/>{screen.studio.start ? "Start screen" : "Set as start"}</button></div>
      <div className={styles.field}><span>Add to this screen</span><div className={styles.insertGrid}>{studioRoles.map(role => <button key={role} disabled={screenElements(screen).length>=250} onClick={() => onAddElement(screen.id, role)}><Icon name={{ heading: "text", text: "note", button: "cursor", card: "box", label: "bookmark", artwork: "palette" }[role]} size={16}/>{role[0].toUpperCase() + role.slice(1)}</button>)}</div></div>
      <div className={styles.field}><span>Layers <small>{screenElements(screen).length}</small></span><div className={styles.layers}>{screenElements(screen).map(element => <button key={element.id} onClick={() => { onChoose(screen); onElementSelect(element.id); }}><Icon name={element.action ? "cursor" : "box"} size={14}/><span>{element.text || element.role}</span>{element.action && <small>Click</small>}</button>)}</div></div>
      <div className={styles.screenActions}><button className={styles.secondary} onClick={() => onDuplicate(screen)}><Icon name="duplicate" size={15}/>Duplicate screen</button><button className={styles.deleteElement} onClick={() => onRemoveScreen(screen.id)}><Icon name="trash" size={15}/>Remove screen</button></div>
    </div>}
  </>;
}

export function StudioPanel({ nodes, selected, elementId, source, onClose, onPlay, onAddScreen, onStarter, onChoose, ...inspector }) {
  const screens = studioScreens(nodes), active = screens.find(screen => screen.id === selected?.id), broken = brokenInteractions(nodes);
  return <aside className={styles.panel} aria-label="Canvas Studio" data-studio-panel onPointerDown={event => event.stopPropagation()}>
    <header><span className={styles.studioIcon}><Icon name="spark" size={20}/></span><div><h2>Canvas Studio</h2><p>Design it. Connect it. Play it.</p></div><button className={styles.iconButton} aria-label="Close studio panel" onClick={onClose}><Icon name="close" size={17}/></button></header>
    <div className={styles.panelActions}><button className={styles.primary} disabled={!screens.length} onClick={onPlay}><Icon name="present" size={17}/>Play prototype</button><label className={styles.addScreen}><Icon name="plus" size={17}/><select aria-label="Add a screen" value="" onChange={event => onAddScreen(event.target.value)}><option value="" disabled>Add screen</option><option value="mobile">Mobile · 390 × 720</option><option value="desktop">Desktop · 960 × 640</option></select></label></div>
    <div className={styles.panelBody}>
      {!screens.length ? <div className={styles.empty}><div className={styles.emptyScreens}><span/><span/><span/></div><span className={styles.eyebrow}>YOUR CANVAS CAN COME ALIVE</span><h3>Start with an experience.</h3><p>Add a ready-to-play, three-screen flow. Every headline, card, and action is yours to change.</p><button className={styles.primary} onClick={onStarter}>Add starter experience<Icon name="forward" size={17}/></button><small>Or add an empty mobile or desktop screen above.</small></div> : <>
        <div className={styles.screenList}><span className={styles.sectionLabel}>SCREENS <b>{screens.length}</b></span>{screens.map((screen, index) => <button key={screen.id} aria-label={`Select screen ${screen.title}`} aria-pressed={active?.id === screen.id} onClick={() => { inspector.onElementSelect(null); onChoose(screen); }}><span>{String(index + 1).padStart(2, "0")}</span><b>{screen.title}</b>{screen.studio.start && <Icon name="present" size={14}/>}<small>{screenElements(screen).filter(item => item.action).length} links</small></button>)}</div>
        {!!broken.length && <div className={styles.warning} role="status"><Icon name="saveError" size={16}/><span>{broken.length} {broken.length === 1 ? "action needs" : "actions need"} a new destination.</span></div>}
        {active ? <ScreenInspector screen={active} elementId={elementId} nodes={nodes} onChoose={onChoose} {...inspector}/> : <div className={styles.selectHint}><Icon name="cursor" size={24}/><p>Select a screen or an element to edit it.</p><span>Drag elements to arrange them. Use the screen edge to move the whole screen.</span></div>}
      </>}
    </div>
    <footer>{source ? <><span><i/>Working in a studio copy</span><Link to={boardPath(source.sourceId)}><Icon name="back" size={14}/>Original board</Link></> : <span>All changes are saved on this device.</span>}</footer>
  </aside>;
}

export function PrototypePlayer({ nodes, initialScreenId, onClose }) {
  const first = prototypeStart(nodes, initialScreenId), [history, setHistory] = useState(() => first ? [first.id] : []), [hotspots, setHotspots] = useState(false), [transition, setTransition] = useState("instant");
  const [available, setAvailable] = useState({ width: 600, height: 700 }), viewport = useRef(null);
  const screen = studioScreens(nodes).find(item => item.id === history.at(-1)) || first, size = screen ? nodeSize(screen) : { width: 390, height: 720 };
  const scale = Math.max(.05, Math.min(1, (available.width - 48) / size.width, (available.height - 44) / size.height));
  useLayoutEffect(() => {
    const host = viewport.current;
    if (!host) return;
    const measure = () => setAvailable({ width: host.clientWidth, height: host.clientHeight });
    measure(); const observer = new ResizeObserver(measure); observer.observe(host); return () => observer.disconnect();
  }, []);
  const activate = action => { setTransition(action?.transition || "fade"); setHistory(value => prototypeStep(nodes, value, action)); };
  const back = () => activate({ type: "back" });
  return <StudioDialog label="Prototype player" onClose={onClose} className={styles.player} onKeyDown={event => { if (event.altKey && event.key === "ArrowLeft") { event.preventDefault(); back(); } }}>
    <header><span className={styles.playerBrand}><Icon name="present" size={18}/><b>Prototype</b><span>{screen?.title || "No screens"}</span></span><button className={styles.closePlayer} onClick={onClose} aria-label="Close prototype player"><Icon name="close" size={18}/><span>Back to canvas</span></button></header>
    <div className={styles.playerViewport} ref={viewport}>{screen ? <div className={styles.deviceShell} style={{ width: size.width * scale, height: size.height * scale }}><div key={`${screen.id}-${history.length}`} data-transition={transition} className={styles.playingScreen} style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}><StudioScreen screen={screen} playing showHotspots={hotspots} onActivate={activate}/></div></div> : <p>Add a screen to start a prototype.</p>}</div>
    <footer><div><button aria-label="Go back in prototype" disabled={history.length < 2} onClick={back}><Icon name="back" size={17}/></button><button aria-label="Restart prototype" onClick={() => { setTransition("fade"); setHistory(first ? [first.id] : []); }}><Icon name="rotate" size={17}/></button><span>{studioScreens(nodes).findIndex(item => item.id === screen?.id) + 1} / {studioScreens(nodes).length} screens</span></div><button aria-pressed={hotspots} onClick={() => setHotspots(value => !value)}><Icon name="cursor" size={16}/><span>{hotspots ? "Hide hotspots" : "Show hotspots"}</span></button><span className={styles.playerHint}>Click through the experience · Esc to return</span></footer>
  </StudioDialog>;
}
