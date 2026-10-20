"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiArrowRight,
  FiChevronRight,
  FiClock,
  FiRefreshCw,
  FiShoppingBag,
} from "react-icons/fi";
import { client } from "@/utils/sanity/client";
import useCookies from "@/hooks/useCookies";
import OrderTable from "@/components/OrderTable";
import HomeLayout from "@/components/layout/HomeLayout";
import OrderDetailsModal from "@/components/reusables/modal/OrderDetailsModal";

const PAGE_SIZE = 10;
const buttonClass =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

function HistoryState({ icon: Icon, title, children, action, error = false }) {
  return (
    <div
      className="flex flex-col items-center px-5 py-14 text-center sm:py-20"
      role={error ? "alert" : undefined}
    >
      <span
        className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${error ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}
      >
        <Icon aria-hidden="true" className="h-6 w-6" />
      </span>
      <h2 className="text-[20px] font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mb-6 mt-2 max-w-sm text-[14px] leading-6 text-slate-500">
        {children}
      </p>
      {action}
    </div>
  );
}

export default function OrdersPage({ searchParams = {} }) {
  const { getCookie } = useCookies();
  const [session, setSession] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(() =>
    Math.max(1, Number.parseInt(searchParams.page, 10) || 1),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loadingReference, setLoadingReference] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const closeOrder = useCallback(() => setSelectedOrder(null), []);

  useEffect(() => {
    const userId = getCookie("euodia_user");
    setSession(userId && getCookie("euodia_token") ? { userId } : false);
  }, [getCookie]);

  useEffect(() => {
    if (session === null) return;
    if (!session) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchTransactions() {
      setIsLoading(true);
      setError(false);
      setDetailsError("");
      try {
        const start = (currentPage - 1) * PAGE_SIZE;
        const params = { userId: session.userId };
        const [rows, count] = await Promise.all([
          client.fetch(
            `*[_type == "transaction" && userId._ref == $userId]
            | order(_createdAt desc) [${start}...${start + PAGE_SIZE}] {
              _id, amount, status, transactionRef, transactionDate, order
            }`,
            params,
          ),
          client.fetch(
            'count(*[_type == "transaction" && userId._ref == $userId])',
            params,
          ),
        ]);
        if (cancelled) return;
        setTransactions(rows);
        setTotalCount(count);
        const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
        if (currentPage > lastPage) setCurrentPage(lastPage);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    fetchTransactions();
    return () => {
      cancelled = true;
    };
  }, [session, currentPage, reloadVersion]);

  const handleViewTransaction = async (transaction) => {
    if (!session || loadingReference) return;
    setLoadingReference(transaction._id);
    setDetailsError("");
    try {
      const order = await client.fetch(
        `*[_type == "order"
        && (_id == $orderId || transactionRef == $reference)
        && customer._ref == $userId][0] {
          _id, total, status, transactionRef, name, email, phone,
          streetAddress, apartment, townCity, notes,
          products[]->{_id, title, "imageUrl": image.asset->url}
        }`,
        {
          orderId: transaction.order?._ref || "",
          reference: transaction.transactionRef || "",
          userId: session.userId,
        },
      );
      if (!order) throw new Error("Order unavailable");
      setSelectedOrder({ ...order, paymentStatus: transaction.status });
    } catch {
      setDetailsError(
        "We couldn’t load this order’s details. Please try again.",
      );
    } finally {
      setLoadingReference(null);
    }
  };

  return (
    <HomeLayout>
      <section className="mx-auto min-h-[65vh] w-full max-w-6xl px-4 pb-12 pt-6 font-poppins sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-[12px] text-slate-500 sm:mb-8"
        >
          <Link
            href="/"
            className="rounded hover:text-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            Home
          </Link>
          <FiChevronRight aria-hidden="true" className="h-3 w-3" />
          <span aria-current="page" className="font-medium text-slate-700">
            My orders
          </span>
        </nav>

        <header className="mb-7 flex flex-col gap-5 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-tight text-slate-900 sm:text-[36px]">
              My orders
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-slate-500 sm:text-[15px]">
              Your meals, order details, and payment updates.
            </p>
          </div>
          <Link href="/menu" className={`${buttonClass} shrink-0`}>
            <FiShoppingBag aria-hidden="true" className="h-4 w-4" />
            Order a meal
            <FiArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_24px_-12px_rgba(15,23,42,0.15)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[16px] font-semibold text-slate-900">
                Order history
              </h2>
              {!isLoading && session && !error && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium tabular-nums text-slate-500">
                  {totalCount}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-[12px] text-slate-400">
              <FiClock aria-hidden="true" className="h-3.5 w-3.5" />
              Newest first
            </span>
          </div>

          {detailsError && (
            <p
              role="alert"
              className="mx-4 mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-[13px] leading-5 text-rose-700 sm:mx-6"
            >
              {detailsError}
            </p>
          )}

          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="space-y-5 border-t border-slate-100 px-4 py-6 sm:px-6"
            >
              <span className="sr-only">Loading your orders…</span>
              {[0, 1, 2].map((row) => (
                <div
                  key={row}
                  aria-hidden="true"
                  className="flex animate-pulse items-center gap-4 motion-reduce:animate-none"
                >
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-2/3 max-w-xs rounded bg-slate-100" />
                    <div className="h-3 w-1/3 max-w-[140px] rounded bg-slate-100" />
                  </div>
                  <div className="h-7 w-16 rounded-full bg-slate-100" />
                </div>
              ))}
            </div>
          ) : !session ? (
            <HistoryState
              icon={FiShoppingBag}
              title="Your orders are waiting for you"
              action={
                <Link href="/login" className={buttonClass}>
                  Sign in to view orders
                  <FiArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              }
            >
              Sign in to see your order history and payment details.
            </HistoryState>
          ) : error ? (
            <HistoryState
              icon={FiAlertCircle}
              title="We couldn’t load your orders"
              error
              action={
                <button
                  type="button"
                  onClick={() => setReloadVersion((value) => value + 1)}
                  className={buttonClass}
                >
                  <FiRefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              }
            >
              Please check your connection and try again.
            </HistoryState>
          ) : transactions.length === 0 ? (
            <HistoryState
              icon={FiShoppingBag}
              title="No orders yet"
              action={
                <Link href="/menu" className={buttonClass}>
                  Explore our menu
                  <FiArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              }
            >
              Once you place an order, you’ll find all the details here.
            </HistoryState>
          ) : (
            <>
              <OrderTable
                {...{ transactions, loadingReference }}
                onViewTransaction={handleViewTransaction}
              />
              <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-100 bg-slate-50/40 px-4 py-4 sm:flex-row sm:px-6">
                <p className="text-[12px] text-slate-500">
                  Showing{" "}
                  <span className="font-medium text-slate-700">
                    {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(
                      (currentPage - 1) * PAGE_SIZE + transactions.length,
                      totalCount,
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-slate-700">
                    {totalCount}
                  </span>{" "}
                  {totalCount === 1 ? "order" : "orders"}
                </p>
                {totalPages > 1 && (
                  <nav
                    aria-label="Order history pages"
                    className="flex w-full items-center justify-between gap-3 sm:w-auto"
                  >
                    <button
                      type="button"
                      aria-label="Previous page"
                      disabled={currentPage === 1 || Boolean(loadingReference)}
                      onClick={() => setCurrentPage((page) => page - 1)}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <FiArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
                      Previous
                    </button>
                    <span className="whitespace-nowrap text-[12px] tabular-nums text-slate-500">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      aria-label="Next page"
                      disabled={
                        currentPage === totalPages || Boolean(loadingReference)
                      }
                      onClick={() => setCurrentPage((page) => page + 1)}
                      className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <FiArrowRight
                        aria-hidden="true"
                        className="h-3.5 w-3.5"
                      />
                    </button>
                  </nav>
                )}
              </div>
            </>
          )}
        </div>
      </section>
      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={closeOrder} />
      )}
    </HomeLayout>
  );
}
