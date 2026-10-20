"use client";
import HomeLayout from "@/components/layout/HomeLayout";
import { client } from "@/utils/sanity/client";
import useCurrencyFormatter from "@/hooks/useCurrencyFormatter";
import { handleGenericError } from "@/utils/errorHandler";
import axios from "axios";
import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { getCookie } from "@/utils/getCookie";
import LoadingScreen from "@/components/reusables/LoadingScreen";
import { useRouter } from "next/navigation"; // Import useRouter for redirection
import { getCheckoutAttempt, rememberPayment } from "@/utils/checkoutSession";

const Checkout = () => {
  const { cartItems } = useSelector((state) => state.cart);
  const formatCurrency = useCurrencyFormatter();
  const [serviceFees, setServiceFees] = useState([]);
  const [selectedServiceFee, setSelectedServiceFee] = useState(0);
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter(); // Initialize the router

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  // Redirect to /menu if cart is empty
  useEffect(() => {
    if (cartItems.length === 0) {
      router.push("/menu"); // Redirect to /menu if the cart is empty
    }
  }, [cartItems, router]);

  // Watch the selected location
  const selectedLocation = watch("serviceFee");

  useEffect(() => {
    // Update the service fee based on the selected location
    if (selectedLocation) {
      const selectedFee = serviceFees.find(
        (fee) => fee._id === selectedLocation,
      );
      setSelectedServiceFee(selectedFee ? selectedFee.fee : 0);
    } else {
      setSelectedServiceFee(0);
    }
  }, [selectedLocation, serviceFees]);

  useEffect(() => {
    async function fetchServiceFees() {
      const query = `*[_type == "serviceFee"]`;
      const fetchedServiceFees = await client.fetch(query);
      setServiceFees(fetchedServiceFees);
    }

    fetchServiceFees();
  }, []);

  const calculateSubtotal = () => {
    return cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const subtotal = calculateSubtotal();
  const vat = subtotal * 0.075;
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const serviceFee = selectedServiceFee ?? 0;
    const vat = Number(subtotal) * 0.075;
    return Number(subtotal) + Number(serviceFee) + Number(vat);
  };
  const token = getCookie("euodia_token");
  const id = getCookie("euodia_user");

  const handleCheckout = async (data) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      setLoading(true);
      const orderData = {
        ...data,
        serviceFee: data.serviceFee,
        cartItems: cartItems.map(({ _id, quantity }) => ({ _id, quantity })),
      };
      const attempt = await getCheckoutAttempt(orderData, token ? id : null);
      orderData.idempotencyKey = attempt.key;

      const config = token
        ? {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        : {};

      const res = await axios.post("/api/order", orderData, config);
      const payment = res.data?.paymentResponse?.data;
      if (!payment?.authorization_url || !payment.reference) {
        throw new Error(
          "Payment could not be started. Your cart is saved. Please try again.",
        );
      }
      rememberPayment(attempt, payment.reference);
      // Keep the cart and submission lock until navigation/payment completes.
      window.location.assign(payment.authorization_url);
    } catch (error) {
      const errMsg = handleGenericError(error);
      toast.error(errMsg, {
        position: "top-right",
        duration: 3000,
      });
      setLoading(false);
      submitting.current = false;
    }
  };

  return (
    <HomeLayout>
      <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
        <div className="container max-w-screen-lg mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-6">Delivery Details</h2>
                <p className="mb-5 text-sm text-gray-600">
                  You can order as a guest. No account or login is required.
                </p>
                <form
                  onSubmit={handleSubmit(handleCheckout)}
                  className="space-y-4"
                >
                  {/* Delivery Details Form */}
                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="firstName"
                    >
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      {...register("fullName", {
                        required: "Full Name is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                    {errors.fullName && (
                      <p className="text-red-600">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="streetAddress"
                    >
                      Street Address
                    </label>
                    <input
                      type="text"
                      id="streetAddress"
                      {...register("streetAddress", {
                        required: "Street Address is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                    {errors.streetAddress && (
                      <p className="text-red-600">
                        {errors.streetAddress.message}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="apartment"
                    >
                      Apartment, floor, etc. (optional)
                    </label>
                    <input
                      type="text"
                      id="apartment"
                      {...register("apartment")}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="townCity"
                    >
                      Town/City
                    </label>
                    <select
                      id="townCity"
                      {...register("townCity", {
                        required: "Town/City is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="Lagos">Lagos</option>
                    </select>
                    {errors.townCity && (
                      <p className="text-red-600">{errors.townCity.message}</p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="phoneNumber"
                    >
                      Phone Number
                    </label>
                    <input
                      type="text"
                      id="phoneNumber"
                      {...register("phoneNumber", {
                        required: "Phone Number is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                    {errors.phoneNumber && (
                      <p className="text-red-600">
                        {errors.phoneNumber.message}
                      </p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="email"
                    >
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      {...register("email", {
                        required: "Email Address is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                    {errors.email && (
                      <p className="text-red-600">{errors.email.message}</p>
                    )}
                  </div>
                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="location"
                    >
                      Delivery Area
                    </label>
                    <select
                      id="serviceFee"
                      {...register("serviceFee", {
                        required: "Delivery Area is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">
                        Select your closest Delivery area
                      </option>
                      {serviceFees.map((fee) => (
                        <option key={fee._id} value={fee._id}>
                          {fee.location} - {formatCurrency(fee.fee)}
                        </option>
                      ))}
                    </select>
                    {errors.serviceFee && (
                      <p className="text-red-600">
                        {errors.serviceFee.message}
                      </p>
                    )}
                  </div>

                  <div className="text-center">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2  text-white bg-green-600 rounded-md hover:bg-green-700"
                    >
                      Continue to payment
                    </button>
                  </div>
                </form>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
                <div className="space-y-4">
                  {/* Render Cart Items */}
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium">{item.title || item.name || "Meal"}</p>
                        <p className="text-sm ">
                          {item.quantity} x {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div>{formatCurrency(item.price * item.quantity)}</div>
                    </div>
                  ))}
                  <hr />
                  <div className="flex justify-between font-semibold">
                    <div>Subtotal</div>
                    <div>{formatCurrency(subtotal)}</div>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <div>VAT (7.5%)</div>
                    <div>{formatCurrency(vat)}</div>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <div>Service Fee</div>
                    <div>{formatCurrency(selectedServiceFee)}</div>
                  </div>
                  <hr />
                  <div className="flex justify-between text-base font-semibold">
                    <div>Total</div>
                    <div>{formatCurrency(calculateTotal())}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading && <LoadingScreen />}
    </HomeLayout>
  );
};

export default Checkout;
