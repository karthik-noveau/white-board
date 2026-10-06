import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import App from './App';
export { pageMetadata, publicPaths, renderHead } from './lib/seo';
export { brand, siteOrigin } from './lib/brand';

export function render(path) {
  return renderToString(<React.StrictMode><StaticRouter location={path}><App/></StaticRouter></React.StrictMode>);
}
