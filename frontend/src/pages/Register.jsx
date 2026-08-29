import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, UserPlus, AlertCircle } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3001"
    : "https://collabcode-backend.onrender.com");

export default function Register({ onRegisterSuccess }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      localStorage.setItem("token", data.token);
      onRegisterSuccess(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-slate-200 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 select-none">
      <div className="relative text-left z-10 w-full max-w-sm rounded border border-[#27272a] bg-[#171717] p-6 shadow-2xl animate-rise">
        <div className="text-center mb-6">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#27272a] bg-[#27272a]/40 text-xs font-bold text-slate-200 mb-3">
            CE
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Create Account
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign up to build together in synchronized editor workspaces.
          </p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded border border-rose-900/35 bg-rose-950/20 px-3 py-2 text-sm text-rose-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
                placeholder="developer101"
                className="w-full rounded border border-[#27272a] bg-black/25 px-3 py-2 pl-9 text-sm text-white placeholder:text-zinc-650 outline-none transition focus:border-zinc-700"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="developer@studio.com"
                className="w-full rounded border border-[#27272a] bg-black/25 px-3 py-2 pl-9 text-sm text-white placeholder:text-zinc-650 outline-none transition focus:border-zinc-700"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-[#27272a] bg-black/25 px-3 py-2 pl-9 text-sm text-white placeholder:text-zinc-650 outline-none transition focus:border-zinc-700"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded border border-[#27272a] bg-black/25 px-3 py-2 pl-9 text-sm text-white placeholder:text-zinc-650 outline-none transition focus:border-zinc-700"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded bg-white hover:opacity-90 py-2 text-sm font-semibold text-slate-950 transition shadow cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{loading ? "Creating Account..." : "Create Account"}</span>
          </button>
        </form>

        <p className="text-center text-sm text-slate-550 mt-5">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-slate-350 hover:text-slate-200 transition underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
