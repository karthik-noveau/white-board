import ConnectorIcon from "./ConnectorIcon";

/** Matching outline icons for the board-wide appearance controls. */
export default function BoardStyleIcon({ name, lineType }) {
  if (name === "structure" && !lineType) return <ConnectorIcon size={20}/>;

  const linePaths = {
    curve: "M4 18C12 18 12 6 20 6",
    straight: "M5 19 19 5",
    elbow: "M4 18h6a2 2 0 0 0 2-2V8a2 2 0 0 1 2-2h6",
  };
  const icons = {
    shape: <rect x="4" y="4" width="16" height="16" rx="4"/>,
    color: <>
      <path d="M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.5-3.3 1.5 1.5 0 0 1 1.1-2.5H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z"/>
      <g fill="currentColor" stroke="none">
        <circle cx="7.5" cy="9" r="1.1"/>
        <circle cx="12" cy="6.5" r="1.1"/>
        <circle cx="16.5" cy="9" r="1.1"/>
        <circle cx="6.5" cy="13.5" r="1.1"/>
      </g>
    </>,
    structure: <path d={linePaths[lineType] || linePaths.straight}/>,
    pattern: <>
      <path d="M4 6h16M4 12h3m3 0h4m3 0h3"/>
      <g fill="currentColor" stroke="none">
        {[4, 8, 12, 16, 20].map(x => <circle key={x} cx={x} cy="18" r=".9"/>)}
      </g>
    </>,
    weight: <>
      <path d="M4 5.5h16" strokeWidth="1.2"/>
      <path d="M4 12h16" strokeWidth="2.2"/>
      <path d="M4 18.5h16" strokeWidth="3.4"/>
    </>,
  };

  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{icons[name]}</svg>;
}
