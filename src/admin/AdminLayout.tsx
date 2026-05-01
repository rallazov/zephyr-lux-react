import { NavLink, Outlet, useMatch } from "react-router-dom";
import "./admin-pwa.css";
import { useAuth } from "../auth/AuthContext";
import { AdminOwnerPushPanel } from "./AdminOwnerPushPanel";

/**
 * Admin chrome without storefront header/footer (UX-DR2 / architecture).
 */
export default function AdminLayout() {
  const { signOut, user, configured, session } = useAuth();
  const orderDetailMatch = Boolean(useMatch({ path: "/admin/orders/:id", end: true }));

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden admin-pwa-shell"
      data-testid="admin-layout"
    >
      <header
        className={[
          "border-b border-slate-200 bg-white admin-pwa-shell-header",
          orderDetailMatch ? "print:hidden" : "",
        ].filter(Boolean).join(" ")}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 min-w-0 w-full sm:w-auto sm:min-w-[12rem]">
            <span className="font-semibold text-slate-800">Zephyr Lux Admin</span>
            {configured && user ? (
              <nav
                className="flex gap-1 -mx-1 px-1 overflow-x-auto sm:overflow-visible sm:mx-0 sm:px-0 sm:flex-wrap pb-0.5 sm:pb-0"
                aria-label="Admin"
              >
                <NavLink
                  to="/admin/orders"
                  className={({ isActive }) =>
                    [
                      "shrink-0 inline-flex items-center justify-center min-h-11 px-3 rounded-md text-sm transition-colors",
                      isActive ? "bg-blue-50 text-blue-800 font-medium" : "text-slate-600 hover:bg-slate-100",
                    ].join(" ")
                  }
                >
                  Orders
                </NavLink>
                <NavLink
                  to="/admin/products"
                  className={({ isActive }) =>
                    [
                      "shrink-0 inline-flex items-center justify-center min-h-11 px-3 rounded-md text-sm transition-colors",
                      isActive ? "bg-blue-50 text-blue-800 font-medium" : "text-slate-600 hover:bg-slate-100",
                    ].join(" ")
                  }
                >
                  Products
                </NavLink>
                <a
                  className="shrink-0 inline-flex items-center justify-center min-h-11 px-3 rounded-md text-sm text-slate-600 hover:bg-slate-100"
                  href="/"
                >
                  Storefront
                </a>
              </nav>
            ) : null}
          </div>
          {user ? (
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600 w-full sm:w-auto sm:justify-end">
              <span className="truncate min-w-0 max-w-[min(100%,16rem)]">{user.email}</span>
              <button
                type="button"
                className="shrink-0 min-h-11 px-3 rounded-md text-blue-800 font-medium hover:bg-blue-50"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 w-full min-w-0 admin-pwa-shell-main">
        <div className={orderDetailMatch ? "mb-6 print:hidden" : "mb-6"}>
          <AdminOwnerPushPanel session={session} isAdminContext={Boolean(configured && user)} />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
