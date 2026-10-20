"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import OrderDetailsCard from "@/components/card/OrderDetailsCard";
import Typography from "@/components/reusables/typography/Typography";
import { client } from "@/utils/sanity/client";
import useCurrencyFormatter from "@/hooks/useCurrencyFormatter";
import { AiOutlineCheckCircle, AiOutlineWarning } from "react-icons/ai";
import { MdCancel, MdLocalShipping } from "react-icons/md";
import Link from "next/link";
import { toast } from "react-toastify";

// Status options list
const statusOptions = [
  { title: "Pending", value: "pending" },
  { title: "Processing", value: "processing" },
  { title: "Shipped", value: "shipped" },
  { title: "Delivered", value: "delivered" },
  { title: "Cancelled", value: "cancelled" },
];

export default function Page() {
  const [order, setOrder] = useState(null);
  const [transaction, setTransaction] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const { id } = useParams();
  const formatCurrency = useCurrencyFormatter();

  useEffect(() => {
    const fetchOrderDetails = async () => {
      if (!id) return;

      const query = `*[_type == "order" && orderId == $id][0]{
        _id,
        orderId,
        total,
        status,
        transactionDate,
        transactionRef,
        customer->{
          _id,
          name,
          email,
          totalSpent,
          orderCount,
          orders[]->{
            _id,
            orderId,
            transactionDate,
            total
          },
          transactions[]->{
            _id,
            transactionRef,
            amount,
            date
          }
        },
        phone,
        streetAddress,
        apartment,
        townCity,
        lineItems,
        deliveryFee,
        paymentStatus,
        products[]->{
          _id,
          title,
          price
        },
        serviceFee->{
          _id,
          fee
        },
        notes
      }`;

      const result = await client.fetch(query, { id });
      setOrder(result);
      setSelectedStatus(result.status);

      const transactionQuery = `*[_type == "transaction" && transactionRef == $transactionRef][0]{
        _id,
        transactionRef,
        amount,
        transactionDate,
        method,
      }`;

      const transactionResult = await client.fetch(transactionQuery, {
        transactionRef: result.transactionRef,
      });
      setTransaction(transactionResult);
    };

    fetchOrderDetails();
  }, [id]);

  const handleStatusChange = (event) => {
    setSelectedStatus(event.target.value);
  };

  const handleSaveStatus = async () => {
    if (!selectedStatus) return;
    setLoading(true);
    try {
      await client.patch(order._id).set({ status: selectedStatus }).commit();
      setLoading(false);
      toast.success("Order status updated successfully!");
    } catch (error) {
      setLoading(false);
      console.error("Failed to update order status:", error);
      toast.error("Failed to update order status.");
    }
  };

  if (!order) {
    return <div>Loading...</div>;
  }

  const statusColor = {
    pending: "bg-yellow-500",
    processing: "bg-blue-500",
    shipped: "bg-purple-500",
    delivered: "bg-green-500",
    cancelled: "bg-red-500",
  };

  const statusIcon = {
    pending: <AiOutlineWarning className="mr-2" />,
    processing: <MdLocalShipping className="mr-2" />,
    shipped: <MdLocalShipping className="mr-2" />,
    delivered: <AiOutlineCheckCircle className="mr-2" />,
    cancelled: <MdCancel className="mr-2" />,
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <Typography variant="h2" size="lg" className="mb-4">
        Order Details
      </Typography>
      <nav className="flex mb-4" aria-label="Breadcrumb">
        <ol className="inline-flex items-center space-x-1 md:space-x-2 rtl:space-x-reverse">
          <li className="inline-flex items-center">
            <Link
              href="/admin/orders/"
              className="text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
            >
              Home
            </Link>
          </li>
          <li>
            <span className="text-sm font-medium text-gray-500 md:mx-2 dark:text-gray-400">
              Orders
            </span>
          </li>
          <li>
            <span className="text-sm font-medium text-gray-500 md:mx-2 dark:text-gray-400">
              Order Details
            </span>
          </li>
        </ol>
      </nav>

      <div className="bg-white shadow-md rounded-lg p-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">
            Order ID: #{order.orderId}
          </h1>
          <span
            className={`flex items-center ${statusColor[order.status]} text-white px-3 py-1 rounded-full`}
          >
            {statusIcon[order.status]} {order.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <OrderDetailsCard
            title="Customer"
            content={
              <div className="text-gray-700">
                <p>{order.customer?.name}</p>
                <p>{order.customer?.email}</p>
                <p>{order.phone}</p>
                <p>
                  Total Orders:{" "}
                  <span className="font-semibold">
                    {order.customer?.orderCount}
                  </span>
                </p>
                <p>
                  Total Spent:{" "}
                  <span className="font-semibold">
                    {formatCurrency(order.customer?.totalSpent)}
                  </span>
                </p>
              </div>
            }
          />
          <OrderDetailsCard
            title="Order Info"
            content={
              <div className="text-gray-700">
                <p>
                  <span className="font-semibold">Shipping Fee:</span> {order.deliveryFee ?? order.serviceFee?.fee}
                </p>
                <p>
                  <span className="font-semibold">Order ID:</span> {order.transactionRef}
                </p>
                <p className={`${
                  order.status === "pending"
                    ? "text-yellow-600"
                    : order.status === "cancelled"
                    ? "text-red-600"
                    : "text-blue-600"
                }`}>
                  Status: {order.status}
                </p>
              </div>
            }
          />
          <OrderDetailsCard
            title="Deliver To"
            content={
              <div className="text-gray-700">
                <p>{order.streetAddress}</p>
                <p>{order.apartment}</p>
                <p>{order.townCity}</p>
              </div>
            }
          />
          <OrderDetailsCard
            title="Payment Info"
            content={
              <div className="text-gray-700">
                <p>
                  <span className="font-semibold">Method:</span> {transaction?.method}
                </p>
                <p>
                  <span className="font-semibold">Reference:</span> {transaction?.transactionRef}
                </p>
                <p>
                  <span className="font-semibold">Amount:</span> ₦{transaction?.amount?.toLocaleString()}
                </p>
                <p>
                  <span className="font-semibold">Date:</span> {new Date(transaction?.transactionDate).toLocaleDateString()}
                </p>
              </div>
            }
          />
        </div>

        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          {order.lineItems?.length > 0 && (
            <section className="w-full rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="mb-3 font-semibold">Purchased meals</h2>
              <p className="mb-3 text-sm">Payment: {order.paymentStatus || "pending"}</p>
              <ul className="space-y-3">
                {order.lineItems.map((item) => (
                  <li key={item._key} className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>{item.title} — {item.quantity} × {formatCurrency(item.unitPrice)}</span>
                    <span>{formatCurrency(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-gray-800">
            Update Order Status
          </h2>
          <div className="flex items-center gap-4">
            <select
              className="p-2 border rounded-lg"
              value={selectedStatus}
              onChange={handleStatusChange}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.title}
                </option>
              ))}
            </select>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition duration-300 ease-in-out"
              onClick={handleSaveStatus}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Status"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
