import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';
import { headTags, pageMetadata } from './seo';

export default function useSeo() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    document.head.querySelectorAll('[data-seo]').forEach(element => element.remove());
    for (const { tag, text, ...attributes } of headTags(pageMetadata(pathname))) {
      const element = document.createElement(tag);
      element.setAttribute('data-seo', '');
      for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
      if (text) element.textContent = text;
      document.head.append(element);
    }
  }, [pathname]);
}
