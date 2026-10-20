"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { FiMapPin, FiShoppingBag, FiX } from "react-icons/fi";
import PaymentStatusBadge from "@/components/orders/PaymentStatusBadge";
import { formatOrderAmount } from "@/utils/orderPresentation";

export default function OrderDetailsModal({ order, onClose }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    if (!order) return;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [onClose, order]);

  if (!order) return null;
  const products =
    Array.isArray(order.lineItems) && order.lineItems.length
      ? order.lineItems.filter(Boolean)
      : Array.isArray(order.products)
        ? order.products.filter(Boolean)
        : [];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 font-poppins backdrop-blur-sm sm:items-center sm:p-6"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-details-title"
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[85dvh] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h2
              id="order-details-title"
              className="text-[22px] font-semibold tracking-tight text-slate-900"
            >
              Order details
            </h2>
            <p className="mt-1 break-all text-[12px] leading-5 text-slate-500">
              {order.transactionRef || "Order reference unavailable"}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close order details"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <FiX aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto overscroll-contain px-5 py-6 sm:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
            <span className="text-[13px] font-medium text-slate-600">
              Payment status
            </span>
            <PaymentStatusBadge status={order.paymentStatus} />
          </div>

          <section aria-labelledby="order-delivery-title" className="mb-7">
            <h3
              id="order-delivery-title"
              className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-slate-900"
            >
              <FiMapPin
                aria-hidden="true"
                className="h-4 w-4 text-emerald-700"
              />
              Delivery details
            </h3>
            <div className="grid gap-5 rounded-xl border border-slate-200/80 p-4 text-[13px] leading-6 text-slate-500 sm:grid-cols-2">
              <div className="min-w-0 break-words">
                <p className="font-semibold text-slate-800">
                  {order.name || "Name not provided"}
                </p>
                {order.email && <p className="break-all">{order.email}</p>}
                {order.phone && <p>{order.phone}</p>}
              </div>
              <div className="min-w-0 break-words">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                  Delivery address
                </p>
                <p>
                  {[order.streetAddress, order.apartment, order.townCity]
                    .filter(Boolean)
                    .join(", ") || "Address not provided"}
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="order-meals-title">
            <h3
              id="order-meals-title"
              className="mb-4 flex items-center gap-2 text-[14px] font-semibold text-slate-900"
            >
              <FiShoppingBag
                aria-hidden="true"
                className="h-4 w-4 text-emerald-700"
              />
              Your meals
            </h3>
            {products.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {products.map((product, index) => (
                  <li
                    key={`${product._id || product.title}-${index}`}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 p-3"
                  >
                    <Image
                      src={product.imageUrl || "/meal.jpg"}
                      alt={product.title || "Ordered meal"}
                      width={56}
                      height={56}
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                    <p className="min-w-0 break-words text-[13px] font-medium leading-5 text-slate-700">
                      {product.title || "Meal details unavailable"}
                      {Number.isInteger(product.quantity) && (
                        <span className="mt-1 block text-[12px] font-normal text-slate-500">
                          {product.quantity} ×{" "}
                          {formatOrderAmount(product.unitPrice)}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-[13px] leading-6 text-slate-500">
                Item details are not available for this order.
              </p>
            )}
          </section>

          {order.notes && (
            <section
              aria-labelledby="order-notes-title"
              className="mt-6 rounded-xl bg-amber-50/70 px-4 py-3"
            >
              <h3
                id="order-notes-title"
                className="mb-1 text-[12px] font-semibold text-slate-700"
              >
                Order notes
              </h3>
              <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-600">
                {order.notes}
              </p>
            </section>
          )}
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-100 bg-slate-50 px-5 py-5 sm:px-6">
          <span className="text-[14px] font-medium text-slate-600">
            Order total
          </span>
          <span className="break-words text-right text-[22px] font-bold tabular-nums tracking-tight text-slate-900">
            {formatOrderAmount(order.total)}
          </span>
        </footer>
      </div>
    </div>
  );
}
