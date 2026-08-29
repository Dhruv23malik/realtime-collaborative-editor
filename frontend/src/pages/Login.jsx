import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";

const BASE_URL = import.meta.env.VITE_API_URL || 
  (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3001"
    : "https://collabcode-backend.onrender.com");

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
      const res = await fetch(`${BASE_URL}/api/auth/login`, {
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
      const res = await fetch(`${BASE_URL}/api/auth/google`, {
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
    <div className="relative min-h-screen bg-[#0a0a0a] text-slate-200 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 select-none">
      <div className="relative text-left z-10 w-full max-w-sm rounded border border-[#27272a] bg-[#171717] p-6 shadow-2xl animate-rise">
        <div className="text-center mb-6">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#27272a] bg-[#27272a]/40 text-xs font-bold text-slate-200 mb-3">
            CE
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            Welcome Back
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to start collaborating in workspace sessions.
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
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded bg-white hover:opacity-90 py-2 text-sm font-semibold text-slate-950 transition shadow cursor-pointer"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>{loading ? "Signing in..." : "Sign In"}</span>
          </button>
        </form>

        <div className="relative flex py-4 items-center">
          <div className="flex-grow border-t border-[#27272a]"></div>
          <span className="flex-shrink mx-3 text-xs text-slate-550 uppercase tracking-widest font-bold">or</span>
          <div className="flex-grow border-t border-[#27272a]"></div>
        </div>

        <div className="flex justify-center mb-4">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError("Google Authentication Failed.")}
            theme="filled_dark"
            shape="square"
            width="100%"
          />
        </div>

        <p className="text-center text-sm text-slate-550">
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-slate-350 hover:text-slate-200 transition underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
