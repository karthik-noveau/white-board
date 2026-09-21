/** Minimal, rounded outline icons for the canvas navigation controls. */
export default function CanvasControlIcon({ name }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "fit" ? <>
      <path d="M8 4.5H6a1.5 1.5 0 0 0-1.5 1.5v2m11-3.5H18A1.5 1.5 0 0 1 19.5 6v2m0 8v2a1.5 1.5 0 0 1-1.5 1.5h-2m-8 0H6A1.5 1.5 0 0 1 4.5 18v-2"/>
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none"/>
    </> : <>
      <rect x="5" y="10" width="14" height="10.5" rx="3"/>
      {name === "locked"
        ? <path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>
        : <path d="M8 10V7.5a4 4 0 0 1 7.6-1.75"/>}
    </>}
  </svg>;
}
