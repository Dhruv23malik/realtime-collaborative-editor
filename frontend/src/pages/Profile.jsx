import React from "react";
import { Link } from "react-router-dom";
import { User, Calendar, Mail, Shield, ArrowLeft } from "lucide-react";

export default function Profile({ currentUser }) {
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#09090b] text-slate-300 flex items-center justify-center select-none">
        <div className="text-center bg-[#18181b] border border-[#27272a] p-6 rounded max-w-sm w-full mx-4 shadow-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded border border-[#27272a] bg-[#27272a]/40 text-slate-450 mx-auto mb-4">
            <User className="h-4.5 w-4.5" />
          </div>
          <p className="text-sm text-slate-400 mb-4">Please log in to view your profile dashboard.</p>
          <Link to="/login" className="inline-block rounded bg-white px-5 py-2 text-sm font-semibold text-[#09090b] transition hover:opacity-90 shadow">
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
    <div className="relative min-h-screen bg-[#09090b] text-slate-200 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8 select-none">
      <div className="relative text-left z-10 w-full max-w-sm rounded border border-[#27272a] bg-[#18181b] p-6 shadow-2xl animate-rise text-center">
        
        {/* Top bar back button */}
        <div className="absolute top-5 left-5">
          <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-350 transition">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Workspace</span>
          </Link>
        </div>

        {/* User avatar circle */}
        <div className="relative inline-flex items-center justify-center h-16 w-16 mx-auto mt-4 mb-4 rounded-full border border-[#27272a] shadow bg-[#27272a]/30 overflow-hidden">
          {currentUser.avatar ? (
            <img src={currentUser.avatar} alt={currentUser.username} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-white tracking-wider">
              {currentUser.username.slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        <h2 className="text-sm font-bold text-white tracking-wide">
          {currentUser.username}
        </h2>
        
        <div className="flex items-center justify-center gap-1.5 mt-1 text-slate-500 text-sm">
          <Mail className="h-3.5 w-3.5 text-slate-650" />
          <span className="font-mono">{currentUser.email}</span>
        </div>

        <div className="border-t border-[#27272a] py-4 mt-5 text-left space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-450">
              <Shield className="h-3.5 w-3.5 text-slate-500" />
              <span>Authentication Type</span>
            </div>
            <span className="rounded bg-[#27272a] px-2 py-0.5 font-medium text-slate-300 text-xs">
              {currentUser.googleId ? "Google OAuth" : "Canvas Credentials"}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-450">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>Member Since</span>
            </div>
            <span className="text-slate-400 font-medium">{joinDate}</span>
          </div>
        </div>

        <div className="mt-5">
          <Link
            to="/"
            className="w-full inline-block rounded bg-white py-2 text-sm font-semibold text-[#09090b] transition hover:opacity-90 shadow"
          >
            Enter Workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
