import { useEffect, useState } from "react";

export const mobileQuery = "(max-width: 760px), (max-height: 500px) and (pointer: coarse)";

export default function useMediaQuery(query = mobileQuery) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}
