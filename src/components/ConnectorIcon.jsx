/** The shared connector symbol used throughout the board. */
export default function ConnectorIcon({ size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="3" y="3" width="6" height="6" rx="1.5"/>
    <rect x="15" y="15" width="6" height="6" rx="1.5"/>
    <path d="M9 6h4a4 4 0 0 1 4 4v5"/>
  </svg>;
}
