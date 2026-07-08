import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

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
      const res = await fetch(`${API_URL}/api/auth/register`, {
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
    <div className="relative min-h-screen overflow-hidden bg-[#080b16] text-white flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-[-10rem] top-20 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="mesh-overlay absolute inset-0 opacity-40" />
      </div>

      <div className="relative text-left z-10 glass-panel p-8 sm:p-10 rounded-[28px] border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl animate-rise max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-300 via-blue-400 to-indigo-500 text-lg font-semibold text-slate-950 shadow-[0_18px_45px_rgba(56,189,248,0.25)] mb-4">
            CC
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Create Account
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Join now to collaborate in real-time.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ""))}
              placeholder="dhruv123"
              className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-white/8"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-white/8"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-white/8"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-[0.24em] text-slate-400 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-2xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-cyan-300/70 focus:bg-white/8"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 shadow-[0_12px_30px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-slate-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200 transition">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
