"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FiMenu, FiX, FiShoppingCart, FiUser, FiLogOut, FiList } from "react-icons/fi";
import Button from "../reusables/buttons/Button";
import { useRouter, usePathname } from "next/navigation";
import useCookies from "@/hooks/useCookies";
import { useSelector } from 'react-redux';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const totalQuantities = useSelector(state => state.cart.totalQuantities);

  const router = useRouter();     
  const pathname = usePathname(); // Get current route
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  }

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  }

  const { getCookie, removeCookie } = useCookies();
  
  let euodia_token = getCookie("euodia_token");

  useEffect(() => { }, [euodia_token]);

  const handleLogout = () => {
    removeCookie("euodia_token");
    removeCookie("euodia_user");
    router.push("/login");
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="container mx-auto flex justify-between items-center p-4">
        <Link href="/">
          <div className="flex items-center">
            <Image src="/logo.svg" alt="Euodia Logo" width={40} height={40} />
            <span className="ml-2 text-md text-accent font-bold">
              Euodia WholeFoods
            </span>
          </div>
        </Link>
        <div className="hidden md:flex items-center space-x-6">
          <Link href="/" className={`hover:text-green-800 ${pathname === '/' ? 'text-green-600' : ''}`}>
            Home
          </Link>
          <Link href="/menu" className={`hover:text-green-800 ${pathname === '/menu' ? 'text-green-600' : ''}`}>
            Our Menu
          </Link>
          <Link href="/contact-us" className={`hover:text-green-800 ${pathname === '/contact-us' ? 'text-green-600' : ''}`}>
            Contact us
          </Link>
          <div className="flex items-center space-x-4">
            <Link href="/cart">
              <button className="hover:text-green-800 relative">
                <FiShoppingCart className="text-xl" />
                {totalQuantities !== 0 && (
                  <p className='absolute -top-2 right-0 bg-red h-4 w-4 text-white flex items-center justify-center p-1 text-sm rounded-full'>
                    {totalQuantities}
                  </p>
                )}
              </button>
            </Link>
            {euodia_token ? (
              <div className="relative z-50">
                <button onClick={toggleDropdown} aria-label="Account menu" aria-expanded={isDropdownOpen} className="hover:text-green-800">
                  <FiUser className="h-5 w-5" />
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 shadow-lg rounded-md py-2 z-10">
                    <Link href="/order" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                      <FiList className="mr-2" />
                      My Orders
                    </Link>
                    <button onClick={handleLogout} className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100">
                      <FiLogOut className="mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                color="black"
                title="Login"
                hoverAnimation={"bounce"}
                isBorder
                onClick={() => router.push("/login")}
              />
            )}
          </div>
        </div>
        <div className="md:hidden flex items-center">
          <Link href="/cart">
            <button className="hover:text-green-800 relative">
              <FiShoppingCart className="text-xl" />
              {totalQuantities !== 0 && (
                <p className='absolute -top-2 right-0 bg-red h-4 w-4 text-white flex items-center justify-center p-1 text-sm rounded-full'>
                  {totalQuantities}
                </p>
              )}
            </button>
          </Link>
          <button onClick={toggleSidebar} aria-label={isOpen ? 'Close menu' : 'Open menu'} aria-expanded={isOpen} className="ml-4">
            {isOpen ? (
              <FiX className="h-6 w-6 text-green-600" />
            ) : (
              <FiMenu className="h-6 w-6 text-green-600" />
            )}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="md:hidden z-99999 flex flex-col items-center bg-white shadow-lg p-4 space-y-4">
          <Link href="/" className={`hover:text-green-800 ${pathname === '/' ? 'text-green-600' : ''}`} onClick={toggleSidebar}>
            Home
          </Link>
          <Link href="/menu" className={`hover:text-green-800 ${pathname === '/menu' ? 'text-green-600' : ''}`} onClick={toggleSidebar}>
            Our Menu
          </Link>
          <Link href="/contact-us" className={`hover:text-green-800 ${pathname === '/contact-us' ? 'text-green-600' : ''}`} onClick={toggleSidebar}>
            Contact us
          </Link>
          <div className="flex flex-col items-center space-y-4 w-full">
            {euodia_token ? (
              <div className="relative w-full">
                <button
                  onClick={toggleDropdown}
                  aria-expanded={isDropdownOpen}
                  className="flex items-center justify-center text-green-600 border border-green-600 rounded-lg px-4 py-2 w-full hover:bg-green-600 hover:text-white"
                >
                  <FiUser className="mr-2 h-5 w-5" />
                  Account
                </button>
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-full bg-white border opacity-100 border-gray-300 shadow-lg rounded-md py-2 z-10">
                    <Link href="/order" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100" onClick={toggleSidebar}>
                      <FiList className="mr-2" />
                      My Orders
                    </Link>
                    <button onClick={handleLogout} className="flex items-center w-full px-4 py-2 text-gray-700 hover:bg-gray-100">
                      <FiLogOut className="mr-2" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                title="Login"
                color="gray"
                isBorder
                onClick={() => {
                  toggleSidebar();
                  router.push("/login");
                }}
                className="w-full"
              />
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
