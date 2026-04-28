import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getSupabaseBrowserClient } from "../lib/supabaseBrowser";
import {
  ADMIN_ORDER_LIST_PAGE_SIZE,
  FULFILLMENT_TERMINAL_POSTGREST_IN,
  ORDER_LIST_PAYMENT_STATUSES,
  TEMPLATE_OWNER_ORDER_PAID,
  formatOrderDateUtc,
  formatOrderMoney,
  getLineItemCount,
  humanizeEnum,
} from "./adminOrderListHelpers";

type OrderRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string | null;
  customer_email: string;
  payment_status: string;
  fulfillment_status: string;
  total_cents: number;
  currency: string;
  order_items: { count: number }[] | { count: number } | null;
};

type NotificationLogRow = {
  order_id: string | null;
  status: string;
  created_at: string;
  template: string;
};

function useLatestOwnerPaidFailed(
  supabase: ReturnType<typeof getSupabaseBrowserClient>,
  orderIdsKey: string
) {
  const [failedByOrder, setFailedByOrder] = useState<Set<string>>(new Set());

  useEffect(() => {
    const orderIds = orderIdsKey === "" ? [] : orderIdsKey.split(",");
    if (!supabase || orderIds.length === 0) {
      setFailedByOrder(new Set());
      return;
    }
    void (async () => {
      const { data, error } = await supabase
        .from("notification_logs")
        .select("order_id, status, created_at, template")
        .in("order_id", orderIds)
        .eq("template", TEMPLATE_OWNER_ORDER_PAID);
      if (error || !data) {
        setFailedByOrder(new Set());
        return;
      }
      const latest = new Map<string, { status: string; created_at: string }>();
      for (const row of data as NotificationLogRow[]) {
        if (row.order_id == null) {
          continue;
        }
        const prev = latest.get(row.order_id);
        if (!prev || new Date(row.created_at) > new Date(prev.created_at)) {
          latest.set(row.order_id, { status: row.status, created_at: row.created_at });
        }
      }
      const next = new Set<string>();
      for (const [oid, v] of latest) {
        if (v.status === "failed") {
          next.add(oid);
        }
      }
      setFailedByOrder(next);
    })();
  }, [supabase, orderIdsKey]);

  return failedByOrder;
}

export default function AdminOrderList() {
  const supabase = getSupabaseBrowserClient();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unfulfilledOnly, setUnfulfilledOnly] = useState(false);
  const [listOffset, setListOffset] = useState(0);
  const [openFulfillmentCount, setOpenFulfillmentCount] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const orderIdsKey = rows.map((r) => r.id).join(",");
  const failedOwnerPaid = useLatestOwnerPaidFailed(supabase, orderIdsKey);

  const loadOpenCount = useCallback(async () => {
    if (!supabase) {
      setOpenFulfillmentCount(null);
      return;
    }
    const { count, error } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_status", "paid")
      .not("fulfillment_status", "in", FULFILLMENT_TERMINAL_POSTGREST_IN);
    if (error) {
      setOpenFulfillmentCount(null);
      return;
    }
    setOpenFulfillmentCount(count ?? 0);
  }, [supabase]);

  useEffect(() => {
    void loadOpenCount();
  }, [loadOpenCount]);

  useEffect(() => {
    if (!supabase) {
      setInitialLoading(false);
      return;
    }
    const append = listOffset > 0;
    if (!append) {
      setInitialLoading(true);
    }
    void (async () => {
      if (append) {
        setLoadingMore(true);
      }
      setErr(null);
      const from = listOffset;
      const to = from + ADMIN_ORDER_LIST_PAGE_SIZE - 1;
      let q = supabase
        .from("orders")
        .select(
          "id, order_number, created_at, customer_name, customer_email, payment_status, fulfillment_status, total_cents, currency, order_items(count)"
        )
        .order("created_at", { ascending: false })
        .range(from, to);

      if (unfulfilledOnly) {
        q = q
          .eq("payment_status", "paid")
          .not("fulfillment_status", "in", FULFILLMENT_TERMINAL_POSTGREST_IN);
      } else {
        q = q.in("payment_status", [...ORDER_LIST_PAYMENT_STATUSES]);
      }

      const { data, error } = await q;
      if (error) {
        setErr(error.message);
        if (!append) {
          setRows([]);
        }
        setHasMore(false);
      } else {
        const chunk = (data ?? []) as OrderRow[];
        if (append) {
          setRows((prev) => [...prev, ...chunk]);
        } else {
          setRows(chunk);
        }
        setHasMore(chunk.length === ADMIN_ORDER_LIST_PAGE_SIZE);
      }
      if (append) {
        setLoadingMore(false);
      } else {
        setInitialLoading(false);
      }
    })();
  }, [supabase, unfulfilledOnly, listOffset]);

  if (!supabase) {
    return (
      <p className="text-red-800" data-testid="admin-order-list-unconfigured" role="alert">
        Supabase is not configured. Set <code className="font-mono">VITE_SUPABASE_URL</code> and{" "}
        <code className="font-mono">VITE_SUPABASE_ANON_KEY</code>.
      </p>
    );
  }

  if (initialLoading) {
    return (
      <p className="text-slate-600" data-testid="admin-order-list-loading">
        Loading orders…
      </p>
    );
  }

  if (err) {
    return (
      <div className="text-red-800" data-testid="admin-order-list-error" role="alert">
        {err}
      </div>
    );
  }

  const onToggleUnfulfilled = () => {
    setListOffset(0);
    setRows([]);
    setInitialLoading(true);
    setUnfulfilledOnly((v) => !v);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) {
      return;
    }
    setListOffset((o) => o + ADMIN_ORDER_LIST_PAGE_SIZE);
  };

  if (rows.length === 0) {
    return (
      <div
        data-testid="admin-order-list-empty"
        className="text-center py-12 border border-dashed border-slate-200 rounded-lg bg-white"
      >
        <h2 className="text-lg font-medium text-slate-800">No orders match</h2>
        <p className="text-slate-600 mt-2">Try changing filters, or check Supabase for paid orders.</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <span className="text-sm text-slate-600" data-testid="admin-order-open-fulfillment-count">
            Open fulfillment: {openFulfillmentCount != null ? openFulfillmentCount : "—"}
          </span>
          <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={unfulfilledOnly}
              onChange={onToggleUnfulfilled}
              className="h-4 w-4 rounded border-slate-300"
            />
            Unfulfilled only
          </label>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="admin-order-list">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
        <div
          className="flex flex-wrap items-center gap-4 text-sm"
          data-testid="admin-order-list-toolbar"
        >
          <span className="text-slate-700" data-testid="admin-order-open-fulfillment-count">
            Open fulfillment:{" "}
            <span className="font-semibold tabular-nums">
              {openFulfillmentCount != null ? openFulfillmentCount : "—"}
            </span>
          </span>
          <label className="inline-flex items-center gap-2 text-slate-800 cursor-pointer min-h-[44px] min-w-[44px]">
            <input
              type="checkbox"
              checked={unfulfilledOnly}
              onChange={onToggleUnfulfilled}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>Unfulfilled only</span>
          </label>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[720px]">
          <caption className="sr-only">Admin orders, newest first</caption>
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="p-3 font-medium">Order</th>
              <th className="p-3 font-medium">Date</th>
              <th className="p-3 font-medium">Customer</th>
              <th className="p-3 font-medium">Total</th>
              <th className="p-3 font-medium">Payment</th>
              <th className="p-3 font-medium">Fulfillment</th>
              <th className="p-3 font-medium">Items</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const itemCount = getLineItemCount(r.order_items);
              const hasName = Boolean(r.customer_name && r.customer_name.trim());
              const nameLine = hasName ? r.customer_name!.trim() : "—";
              const showFail = failedOwnerPaid.has(r.id);
              return (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        className="text-blue-700 hover:underline font-mono"
                        to={`/admin/orders/${r.id}`}
                      >
                        {r.order_number}
                      </Link>
                      {showFail ? (
                        <span
                          className="text-xs font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded"
                          title="Latest owner order-paid email attempt failed"
                          data-testid={`admin-order-notify-failed-${r.id}`}
                        >
                          Email failed
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap text-slate-800">{formatOrderDateUtc(r.created_at)}</td>
                  <td className="p-3 text-slate-800">
                    <div>{nameLine}</div>
                    {hasName ? (
                      <div className="text-slate-500 text-xs break-all">{r.customer_email}</div>
                    ) : (
                      <div className="break-all text-slate-800">{r.customer_email}</div>
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{formatOrderMoney(r.total_cents, r.currency)}</td>
                  <td className="p-3">{humanizeEnum(r.payment_status)}</td>
                  <td className="p-3">{humanizeEnum(r.fulfillment_status)}</td>
                  <td className="p-3 tabular-nums">{itemCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {hasMore ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 min-h-[44px] text-sm font-medium text-white bg-slate-900 rounded-md disabled:opacity-50"
            data-testid="admin-order-list-load-more"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
