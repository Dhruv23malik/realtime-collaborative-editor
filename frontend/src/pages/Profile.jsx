import React from "react";
import { Link } from "react-router-dom";

export default function Profile({ currentUser }) {
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#080b16] text-white flex items-center justify-center">
        <div className="text-center glass-panel p-8 rounded-3xl border border-white/10 max-w-sm">
          <p className="text-lg text-slate-400 mb-4">Please log in to view your profile.</p>
          <Link to="/login" className="rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:opacity-90">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const joinDate = new Date(currentUser.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#080b16] text-white flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12rem] top-[-10rem] h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute right-[-10rem] top-20 h-72 w-72 rounded-full bg-fuchsia-400/10 blur-3xl" />
        <div className="mesh-overlay absolute inset-0 opacity-40" />
      </div>

      <div className="relative text-left z-10 glass-panel p-8 sm:p-10 rounded-[28px] border border-white/10 bg-slate-950/40 backdrop-blur-xl shadow-2xl animate-rise max-w-md w-full text-center">
        <div className="relative inline-flex items-center justify-center h-28 w-28 mx-auto mb-6 rounded-full border-4 border-cyan-400/20 shadow-xl overflow-hidden bg-gradient-to-br from-cyan-400 to-indigo-600">
          {currentUser.avatar ? (
            <img src={currentUser.avatar} alt={currentUser.username} className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl font-bold text-white">
              {currentUser.username.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-white mb-1">
          {currentUser.username}
        </h2>
        <p className="text-sm text-cyan-300 mb-6 font-mono">{currentUser.email}</p>

        <div className="border-t border-white/8 py-5 text-left space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Account Type</span>
            <span className="rounded-full bg-white/6 px-3 py-1 font-medium text-slate-300 text-xs">
              {currentUser.googleId ? "Google Account" : "Standard Account"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Collaborator Since</span>
            <span className="text-white font-medium">{joinDate}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            to="/"
            className="w-full rounded-2xl bg-white py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90 shadow-[0_12px_30px_rgba(255,255,255,0.15)]"
          >
            Enter Studio Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
