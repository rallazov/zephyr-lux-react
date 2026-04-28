import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ANALYTICS_EVENTS } from "../../analytics/events";
import { dispatchAnalyticsEvent } from "../../analytics/sink";
import { usePageMeta } from "../../seo/meta";
import { DEFAULT_META_DESCRIPTION, SITE_BRAND } from "../../seo/site";
import Footer from "../Footer/Footer";
import Header from "../Header/Header";

const Layout = () => {
  const location = useLocation();

  usePageMeta({
    title: SITE_BRAND,
    description: DEFAULT_META_DESCRIPTION,
    canonicalPath: location.pathname,
    ogType: "website",
  });

  useEffect(() => {
    const path = location.pathname;
    const storageKey = `analytics_page_view:${path}:${location.key}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* private mode / quota — may duplicate in dev Strict Mode */
    }
    dispatchAnalyticsEvent({
      name: ANALYTICS_EVENTS.page_view,
      payload: { path },
    });
  }, [location.pathname, location.key]);

  return (
    <div className="App" data-testid="storefront-layout">
      <Header />
      <main className="storefront-outlet">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;


