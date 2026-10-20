import { FiArrowRight, FiLoader, FiShoppingBag } from "react-icons/fi";
import PaymentStatusBadge from "@/components/orders/PaymentStatusBadge";
import {
  formatOrderAmount,
  formatOrderDate,
  getOrderReference,
} from "@/utils/orderPresentation";

function ViewOrderButton({ transaction, onViewTransaction, loadingReference }) {
  const reference = getOrderReference(transaction);
  const isOpening = loadingReference === transaction._id;
  return (
    <button
      type="button"
      onClick={() => onViewTransaction(transaction)}
      disabled={
        Boolean(loadingReference) ||
        (!transaction.transactionRef && !transaction.order?._ref)
      }
      aria-label={`View order ${reference}`}
      aria-busy={isOpening}
      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[13px] font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-wait disabled:opacity-50 sm:w-auto"
    >
      {isOpening ? "Opening…" : "View order"}
      {isOpening ? (
        <FiLoader aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        <FiArrowRight aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}

export default function OrderTable({
  transactions,
  onViewTransaction,
  loadingReference,
}) {
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-left">
          <caption className="sr-only">
            Your order and payment history, newest first
          </caption>
          <thead className="border-y border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th scope="col" className="w-[32%] px-6 py-4">
                Order reference
              </th>
              <th scope="col" className="w-[18%] px-4 py-4">
                Date placed
              </th>
              <th scope="col" className="w-[18%] px-4 py-4">
                Total
              </th>
              <th scope="col" className="w-[16%] px-4 py-4">
                Payment
              </th>
              <th scope="col" className="w-[16%] px-6 py-4 text-right">
                <span className="sr-only">Order details</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.map((transaction) => (
              <tr
                key={transaction._id}
                className="transition-colors hover:bg-slate-50/60"
              >
                <th scope="row" className="px-6 py-6 font-medium">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700">
                      <FiShoppingBag aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="break-all text-[14px] text-slate-800">
                      {getOrderReference(transaction)}
                    </span>
                  </div>
                </th>
                <td className="px-4 py-6 text-[13px] text-slate-500">
                  {formatOrderDate(transaction.transactionDate)}
                </td>
                <td className="whitespace-nowrap px-4 py-6 text-[14px] font-semibold tabular-nums text-slate-900">
                  {formatOrderAmount(transaction.amount)}
                </td>
                <td className="px-4 py-6">
                  <PaymentStatusBadge status={transaction.status} />
                </td>
                <td className="px-6 py-6 text-right">
                  <ViewOrderButton
                    {...{ transaction, onViewTransaction, loadingReference }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 lg:hidden">
        {transactions.map((transaction) => (
          <article
            key={transaction._id}
            aria-label={`Order ${getOrderReference(transaction)}`}
            className="p-4 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-slate-400">
                  Order reference
                </p>
                <h3 className="break-all text-[14px] font-semibold leading-6 text-slate-800">
                  {getOrderReference(transaction)}
                </h3>
              </div>
              <PaymentStatusBadge status={transaction.status} />
            </div>
            <dl className="mb-4 mt-5 grid grid-cols-2 gap-4">
              <div>
                <dt className="text-[12px] text-slate-500">Date placed</dt>
                <dd className="mt-1 text-[13px] font-medium text-slate-700">
                  {formatOrderDate(transaction.transactionDate)}
                </dd>
              </div>
              <div className="text-right">
                <dt className="text-[12px] text-slate-500">Order total</dt>
                <dd className="mt-1 break-words text-[17px] font-semibold tabular-nums text-slate-900">
                  {formatOrderAmount(transaction.amount)}
                </dd>
              </div>
            </dl>
            <ViewOrderButton
              {...{ transaction, onViewTransaction, loadingReference }}
            />
          </article>
        ))}
      </div>
    </>
  );
}
