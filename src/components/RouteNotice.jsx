import { Link } from "react-router";
import usePageTitle from "../lib/usePageTitle";

export default function RouteNotice({ title = "Page not found", children, to = "/projects", action = "Open workspace" }) {
  usePageTitle(title);
  return <main className="routeNotice">
    <Link to="/" className="routeMark" aria-label="Nova home">✦</Link>
    <h1>{title}</h1>
    <p>{children || "This page doesn’t exist. Return to your workspace to continue."}</p>
    <Link to={to} className="routeAction">{action} <span aria-hidden="true">→</span></Link>
  </main>;
}
