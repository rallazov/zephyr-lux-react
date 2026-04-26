import { isAdminUser } from "../auth/isAdmin";
import { useAuth } from "../auth/AuthContext";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";

/**
 * Child routes require Supabase, a session, and JWT app_metadata.role === "admin".
 */
export default function RequireAdmin() {
  const { user, loading, configured } = useAuth();
  const loc = useLocation();

  if (!configured) {
    return <Navigate to="/admin/login" replace state={{ from: loc }} />;
  }
  if (loading) {
    return (
      <p className="text-slate-600" data-testid="admin-auth-loading">
        Loading session…
      </p>
    );
  }
  if (!user) {
    return <Navigate to="/admin/login" replace state={{ from: loc }} />;
  }
  if (!isAdminUser(user)) {
    return (
      <div className="max-w-lg" role="alert" data-testid="admin-forbidden">
        <h1 className="text-xl font-bold text-red-800">Not authorized</h1>
        <p className="text-slate-600 mt-2">
          Your account is not an admin. Set{" "}
          <code className="bg-slate-100 px-1 rounded">app_metadata.role</code> to{" "}
          <code className="bg-slate-100 px-1 rounded">&quot;admin&quot;</code> in Supabase for this
          user.
        </p>
        <p className="mt-3">
          <Link className="text-blue-700 underline" to="/admin/login">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }
  return <Outlet />;
}
