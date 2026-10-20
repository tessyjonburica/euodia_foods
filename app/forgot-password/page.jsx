"use client";
import { useState } from 'react';
import InputComponent from "@/components/reusables/input/InputComponent";
import Button from "@/components/reusables/buttons/Button";
import { toast } from "react-toastify";

export default function Page() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Password reset link has been sent to your email address.');
        setIsSubmitting(false);

      } else {
        toast.error(data.message || 'Something went wrong. Please try again.');
        setIsSubmitting(false);

      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
      setIsSubmitting(false);

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-10 shadow-md flex flex-col gap-4 rounded-lg w-full max-w-sm"
      >
        <h2 className="text-3xl text-center text-accent font-bold">Set or Reset Your Password</h2>
        <p className="text-center text-gray-700 mb-4">
          Enter your email address and we&apos;ll send you a link to set a password. If you ordered as a guest, this also activates your account.
        </p>
        <InputComponent
          label="Email"
          placeholder="johndoe@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          name="email"
        />

        <Button
          type="submit"
          title={isSubmitting ? "Sending..." : "Send Reset Link"}
          color="accent"
          isLoading={isSubmitting}
        />

        <p className="text-center mt-2">
          Remember your password?{" "}
          <a href="/login" className="text-green-500">
            Log in
          </a>
        </p>
      </form>

</div>
  );
}
