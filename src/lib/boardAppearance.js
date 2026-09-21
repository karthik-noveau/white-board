export const palettes = {
  violet: ["#f0eaff", "#7656c9", "#5b3dab"], blue: ["#e8f3ff", "#3d8ac9", "#2770ae"], amber: ["#fff3d8", "#d99a24", "#a96f05"],
  pink: ["#ffeaf1", "#d8678c", "#b54369"], green: ["#e5f6ed", "#49a878", "#278458"], orange: ["#ffeddf", "#df7d43", "#b85c27"], white: ["#ffffff", "#b8bec8", "#59616c"],
};

export const rootColors = node => {
  const color=palettes[node.color]?node.color:"white",[background,,accent]=palettes[color],solid=color!=="white";
  return {fill:solid?(color==="violet"?"#6436dc":accent):background,text:solid?"#ffffff":"#151621",note:solid?"rgba(255,255,255,.88)":"#5f687b",editor:solid?"rgba(255,255,255,.1)":"rgba(25,25,32,.04)"};
};

export const nodeSize = node => ({
  width: node.w || (node.shape==="circle" ? (node.root ? 144 : 124) : node.root ? 252 : 228),
  height: node.h || (node.shape==="circle" ? (node.root ? 144 : 124) : node.root ? 108 : 92),
});
