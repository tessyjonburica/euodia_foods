"use client"
import React, { useState } from 'react';
import HomeLayout from '@/components/layout/HomeLayout';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import { decrementQuantity, incrementQuantity, updateCartItemQuantity } from '@/store/reducers/cartReducer';

const Cart = () => {
const dispatch = useDispatch()
  const {cartItems } = useSelector(state => state.cart)

console.log(cartItems);


  const calculateSubtotal = () => {
    return cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  };

  return (
    <HomeLayout>
      <div className="container mx-auto p-4">
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-right">Price</th>
                <th className="px-4 py-2 text-center">Quantity</th>
                <th className="px-4 py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {cartItems.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-2 flex items-center">
                    <Image
                      src={item?.image?.asset?.url}
                      alt={item.name}
                      width={100}
                      height={100}
                      className="w-10 h-10 mr-2 object-cover"
                    />
                    {item.title}
                  </td>
                  <td className="px-4 py-2 text-right">₦{item?.price?.toLocaleString()}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center">
                      <button
                        className="px-2 py-1 border rounded-l"
                        onClick={() => dispatch(decrementQuantity({ id: item?._id })) }
                      >
                        -
                      </button>
                      <span className="px-2 py-1 border-t border-b">
                        {item.quantity.toString().padStart(2, '0')}
                      </span>
                      <button
                        className="px-2 py-1 border rounded-r"
                        onClick={() => dispatch(incrementQuantity({ id: item?._id })) }                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right">
                    ₦{(item.price * item.quantity).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex flex-col md:flex-row justify-between items-start md:items-center">
          <Link href="/menu">
            <button className="border border-gray-300 px-4 py-2 rounded-md mb-4 md:mb-0">
              Return To Shop
            </button>
          </Link>
          <div className="border border-gray-300 p-4 rounded-md w-full md:w-1/3">
            <h2 className="text-lg font-bold mb-4">Cart Total</h2>
            <div className="flex justify-between mb-2">
              <span>Subtotal:</span>
              <span>₦{calculateSubtotal().toLocaleString()}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Shipping:</span>
              <span>Enter your address to view shipping options.</span>
            </div>
            <div className="flex justify-between mb-4">
              <span>Total:</span>
              <span>₦{calculateSubtotal().toLocaleString()}</span>
            </div>
            <Link href="/checkout">
              <button className="bg-green-500 text-white px-4 py-2 rounded-md w-full">
                Proceed to checkout
              </button>
            </Link>
          </div>
        </div>
      </div>
    </HomeLayout>
  );
};

export default Cart;
