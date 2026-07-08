import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      localStorage.setItem("token", data.token);
      onLoginSuccess(data.user, data.token);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Google login failed.");
      }

      localStorage.setItem("token", data.token);
      onLoginSuccess(data.user, data.token);
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
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Sign in to start editing in synced sessions.
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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 shadow-[0_12px_30px_rgba(255,255,255,0.15)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-white/8"></div>
          <span className="flex-shrink mx-4 text-xs text-slate-500 uppercase tracking-widest">or</span>
          <div className="flex-grow border-t border-white/8"></div>
        </div>

        <div className="flex justify-center mb-6">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google Authentication Failed.")}
            theme="filled_dark"
            shape="circle"
            width="100%"
          />
        </div>

        <p className="text-center text-sm text-slate-400">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-cyan-300 hover:text-cyan-200 transition">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
