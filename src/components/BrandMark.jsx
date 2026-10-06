import { brand } from '../lib/brand';

export default function BrandMark({ size = 24, className }) {
  return <svg width={size} height={size} viewBox="8 8 48 48" fill="currentColor" className={className} aria-hidden="true" focusable="false"><path d={brand.markPath}/></svg>;
}
