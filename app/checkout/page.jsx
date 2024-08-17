// pages/checkout.js
"use client";
import HomeLayout from "@/components/layout/HomeLayout";
import { clearCart } from "@/store/reducers/cartReducer";
// import useLoggedInStatus from "@/hooks/useLoggedinStatus";
import { client } from '@/utils/sanity/client';
import useCurrencyFormatter from '@/hooks/useCurrencyFormatter';

import { handleGenericError } from "@/utils/errorHandler";
import axios from "axios";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useSelector, useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { getCookie } from "@/utils/getCookie";

const Checkout = () => {
  const { cartItems } = useSelector((state) => state.cart);
  const formatCurrency = useCurrencyFormatter();
  const [serviceFees, setServiceFees] = useState([]);
  const [selectedServiceFee, setSelectedServiceFee] = useState(0);

  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  // Watch the selected location
  const selectedLocation = watch("serviceFee");
  console.log(selectedServiceFee);

  useEffect(() => {
    // Update the service fee based on the selected location
    if (selectedLocation) {
      const selectedFee = serviceFees.find(
        (fee) => fee._id === selectedLocation
      );
      setSelectedServiceFee(selectedFee ? selectedFee.fee : 0);
    }
    else {
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

  // console.log(serviceFees)

  const calculateSubtotal = () => {
    return cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  const subtotal = calculateSubtotal();
  const vat = subtotal * 0.07;
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const serviceFee = selectedServiceFee ?? 0; // Default to 650 if no location is selected
    const vat = Number(subtotal) * 0.075; // Example VAT rate (7%)
    return Number(subtotal) + Number(serviceFee) + Number(vat);

  };
  //      // Combine the form data with the selected service fee object

  //      const orderData = {
  //       ...data,
  //       serviceFee: {
  //         _type: "reference",
  //         _ref: data.serviceFee,
  //       },
  //       cartItems,
  //     };
  //   // console.log(data.serviceFee)

  //   try {
  //     if (data.firstName !== "") {
  //       setLoading(true);

  //       await axios
  //         .post("/api/order", { cartItems, ...data, amount: Math.round(calculateTotal()) })
  //         .then((res) => {
  //           setLoading(false);
  //           // dispatch(clearCart());

  //           // const paymentLink =
  //           //   res?.data?.paymentResponse?.data?.authorization_url;
  //           // console.log(paymentLink);
  //           // if (paymentLink) {
  //           //   window.location.href = paymentLink;
  //           // }
  //         });
  //     } else {
  //       toast.error("Please add an address to proceed with checkout");
  //     }
  //     // Call Paystack API to initiate payment
  //   } catch (error) {
  //     const errMsg = handleGenericError(error);
  //     toast.error(errMsg, {
  //       position: "top-right",
  //       duration: 3000,
  //     });
  //     setLoading(false);

  //     console.error("Error handling checkout:", error);
  //   }
  // };
  const token = getCookie("euodia_token"); // Assuming the API returns a token if the user exists
  const id = getCookie("euodia_user"); // Assuming the API returns a token if the user exists
  // const id = getCookie("euodia_user"); // Assuming the API returns a token if the user exists

  const handleCheckout = async (data) => {
    try {
      if (data.firstName !== "") {
        setLoading(true);


        const userId = id
        if (!userId) {
          throw new Error("User not found or could not be created");
        }

        // Combine the form data with the selected service fee object and user ID
        const orderData = {
          ...data,
          serviceFee: {
            _type: "reference",
            _ref: data.serviceFee,
          },
          cartItems,
          userId, // Pass the user ID to the order data
          amount: Math.round(calculateTotal()),
        };

        // Configure headers to include the token if available
        const config = token
          ? {
            headers: {
              Authorization: `Bearer ${token}`, // Include the token in the Authorization header
            },
          }
          : {};

        await axios
          .post("/api/order", orderData, config)
          .then((res) => {
            setLoading(false);
            dispatch(clearCart());
            toast.success("order placed", {
              position: "top-right",
              duration: 3000,
            })
            const paymentLink =
              res?.data?.paymentResponse?.data?.authorization_url;

            if (paymentLink) {
              window.location.href = paymentLink;
            }
          });
      } else {
        toast.error("Please add an address to proceed with checkout");
      }
    } catch (error) {
      const errMsg = handleGenericError(error);
      toast.error(errMsg, {
        position: "top-right",
        duration: 3000,
      });
      setLoading(false);

      console.error("Error handling checkout:", error);
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
                <form
                  onSubmit={handleSubmit(handleCheckout)}
                  className="space-y-4"
                >
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
                    {errors.firstName && (
                      <p className="text-red-600">{errors.firstName.message}</p>
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
                  {/* <div className="my-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Shipping/Delivery
                    </label>
                    <input
                      type="text"
                      {...register("deliveryAddress", {
                        required: "Delivery Address is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                      placeholder="Enter your delivery address "
                    />
                  </div> */}
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
                        required: "Service Area is required",
                      })}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    >
                      <option value="">Select your closest Delivery area</option>
                      {serviceFees.map((fee) => (
                        <option key={fee._id} value={fee._id}>
                          {fee.location}
                        </option>
                      ))}
                    </select>
                    {errors.location && (
                      <p className="text-red-600">{errors.serviceFee.message}</p>
                    )}
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="orderNotes"
                    >
                      ORDER NOTES (OPTIONAL)
                    </label>
                    <textarea
                      id="orderNotes"
                      {...register("orderNotes")}
                      className="mt-1 block w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-green-600 text-white p-2 rounded-md"
                  >
                    {loading ? "loading..." : "Place Order"}
                  </button>
                </form>
              </div>

              {/* Order details */}
              <div>
                <h2 className="text-2xl font-bold mb-6">Your Order</h2>
                <div className="border p-4 rounded-lg">
                  <div className="mb-4">
                    {cartItems.map((item) => (
                      <div key={item._id} className="flex justify-between">
                        <span>
                          {item.title} x {item.quantity}
                        </span>
                        <span>
                          ₦{(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                  <hr />
                  <div className="my-4">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₦{calculateSubtotal().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Service Fee:</span>
                      <span>₦{selectedServiceFee}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT:</span>
                      <span>
                        {formatCurrency(vat.toFixed(2))}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total:</span>
                      <span>₦{calculateTotal().toLocaleString()}</span>
                    </div>
                  </div>
                  <hr />

                  <div className="my-4">
                    <label className="block text-sm font-medium text-gray-700">
                      Payment Method
                    </label>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <input
                          type="radio"
                          name="paymentMethod"
                          className="mr-2"
                        />
                        <span>Card</span>
                      </div>
                      <img
                        src="/paystack.png"
                        alt="Paystack"
                        className=" "
                      />

                    </div>
                    {/* <div className="flex items-center mb-4">
                      <input
                        type="radio"
                        name="paymentMethod"
                        className="mr-2"
                      />
                      <span>Cash on delivery</span>
                    </div> */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default Checkout;
