import { useEffect } from "react";
import { brand } from './brand';

export default function usePageTitle(title) {
  useEffect(() => { document.title = `${title} · ${brand.name}`; }, [title]);
}
