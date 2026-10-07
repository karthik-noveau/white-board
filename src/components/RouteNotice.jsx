import SiteHeader from "./SiteHeader";
import { Link } from "react-router";
import usePageTitle from "../lib/usePageTitle";

export default function RouteNotice({ title = "Page not found", children, to = "/projects", action = "Open workspace", embedded = false }) {
  usePageTitle(title);
  return <div className="routeNoticePage" data-embedded={embedded || undefined}>{!embedded && <SiteHeader layout="content"/>}<main className="routeNotice">
    <h1>{title}</h1>
    <p>{children || "This page doesn’t exist. Return to your workspace to continue."}</p>
    <Link to={to} className="routeAction">{action} <span aria-hidden="true">→</span></Link>
  </main></div>;
}
