"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import InputComponent from "@/components/reusables/input/InputComponent";
import Button from "@/components/reusables/buttons/Button";
import { toast } from "react-toastify";

export default function ResetPassword() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = new URLSearchParams(window.location.search).get('token');

    try {
      const res = await fetch('/api/admin/password-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      if (res.ok) {
        setSuccess('Password reset successful! Redirecting to login...');
        toast.success('Password reset successful! Redirecting to login...');
        setTimeout(() => {
          router.push('/auth/login');
        }, 3000);
      } else {
        const data = await res.json();
        setError(data.message);
        toast.error(data.message);
      }
    } catch (error) {
      setError('Something went wrong. Please try again later.');
      toast.error('Something went wrong. Please try again later.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form onSubmit={handleSubmit} className="bg-white p-10 shadow-md flex flex-col gap-4 rounded-lg w-full max-w-sm">
        <h2 className="text-3xl text-center text-accent font-bold">Reset Your Password</h2>
        <p className="text-center text-gray-700 mb-4">Please enter your new password below.</p>

        <InputComponent
          label="New Password"
          placeholder="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          type="password"
          error={error}
        />

        <Button
          type="submit"
          title="Reset Password"
          color="accent"
        />

        {error && <p className="text-red-500 text-center">{error}</p>}
        {success && <p className="text-green-500 text-center">{success}</p>}
      </form>

</div>
  );
}
