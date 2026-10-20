"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { handleGenericError } from "@/utils/errorHandler";

import { getCookie } from "@/utils/getCookie";

export default function ServiceFeeForm({ serviceFee, onClose,mutate, onSuccess }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: serviceFee || { location: "", fee: "" },
  });
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    const token = getCookie('admineu_token'); // Retrieve the token
  
    try {
      let response;
      const config = {
        headers: {
          Authorization: `Bearer ${token}`, // Set the Bearer token
        },
      };
  
      if (serviceFee) {
        // Update service fee if editing
        response = await axios.patch(`/api/admin/servicefee/${serviceFee._id}`, data, config);
        toast.success("Service fee updated successfully", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      mutate()

      } else {
        // Create a new service fee
        response = await axios.post("/api/admin/servicefee", data, config);
        toast.success("Service fee created successfully", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
        });
      }
      mutate()
  
      setLoading(false);
      reset();
      onSuccess(response.data); // Pass the created/updated service fee to the parent
    } catch (error) {
      const errMsg = handleGenericError(error);
      setLoading(false);
  
      toast.error(errMsg, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
    }
  };

return (
    <div className="max-w-md mx-auto mt-10">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label
            htmlFor="locationName"
            className="block text-sm font-medium text-gray-700"
          >
            Location Name
          </label>
          <input
            type="text"
            id="locationName"
            {...register("location", {
              required: "Location name is required",
            })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {errors.location && (
            <span className="text-red-500 text-sm">
              {errors.location.message}
            </span>
          )}
        </div>
        <div>
          <label
            htmlFor="fee"
            className="block text-sm font-medium text-gray-700"
          >
            Service Fee
          </label>
          <input
            type="number"
            id="fee"
            min="0"
            step="0.01"
            {...register("fee", { required: "Service fee is required", valueAsNumber: true, min: { value: 0, message: "Fee must be zero or more" } })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
          {errors.fee && (
            <span className="text-red-500 text-sm">{errors.fee.message}</span>
          )}
        </div>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            className="bg-gray-500 text-white px-4 py-2 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full md:w-auto bg-green-600 text-white py-2 px-4 rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>
    </div>
  );
}
