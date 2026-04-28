import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/**
 * Admin chrome without storefront header/footer (UX-DR2 / architecture).
 */
export default function AdminLayout() {
  const { signOut, user, configured } = useAuth();

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      data-testid="admin-layout"
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-800">Zephyr Lux Admin</span>
            {configured && user ? (
              <nav className="flex gap-3 text-sm">
                <NavLink
                  to="/admin/orders"
                  className={({ isActive }) =>
                    isActive ? "text-blue-700 font-medium" : "text-slate-600 hover:text-slate-900"
                  }
                >
                  Orders
                </NavLink>
                <NavLink
                  to="/admin/products"
                  className={({ isActive }) =>
                    isActive
                      ? "text-blue-700 font-medium"
                      : "text-slate-600 hover:text-slate-900"
                  }
                >
                  Products
                </NavLink>
                <a className="text-slate-600 hover:text-slate-900" href="/">
                  Storefront
                </a>
              </nav>
            ) : null}
          </div>
          {user ? (
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <span className="truncate max-w-[12rem]">{user.email}</span>
              <button
                type="button"
                className="text-blue-700 hover:underline"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
