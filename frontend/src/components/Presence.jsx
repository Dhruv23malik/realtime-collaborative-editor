import React from "react";

/**
 * Presence Component
 * Renders a compact, high-fidelity avatar stack showing the active real-time collaborators in the workspace.
 * Fits cleanly into toolbars or header sections.
 *
 * @param {Object} props
 * @param {Array} props.users - List of active users in the room
 */
export default function Presence({ users = [] }) {
  const visibleUsers = users.slice(0, 4);
  const excessCount = users.length > 4 ? users.length - 4 : 0;

  return (
    <div className="flex items-center gap-2">
      {users.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          <span>Solo Session</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Overlapping Avatar Stack */}
          <div className="flex -space-x-1.5 overflow-hidden">
            {visibleUsers.map((user, idx) => (
              <div
                key={`${user.userId || idx}-${idx}`}
                className="group relative inline-block h-6 w-6 rounded-full ring-2 ring-[#0c0f1d] bg-gradient-to-br from-cyan-400 to-indigo-600 cursor-help"
              >
                {user.avatar ? (
                  <img
                    className="h-full w-full rounded-full object-cover"
                    src={user.avatar}
                    alt={user.username}
                  />
                ) : (
                  <div className="h-full w-full rounded-full flex items-center justify-center text-[10px] font-bold text-white uppercase">
                    {user.username.slice(0, 2)}
                  </div>
                )}
                {/* Tooltip */}
                <div className="pointer-events-none absolute top-full left-1/2 z-50 mt-2 -translate-x-1/2 rounded bg-[#090d16] px-2 py-1 text-[10px] font-medium text-slate-200 border border-white/[0.08] shadow-2xl opacity-0 transition-all duration-200 group-hover:opacity-100 whitespace-nowrap">
                  {user.username}
                </div>
              </div>
            ))}

            {excessCount > 0 && (
              <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 ring-2 ring-[#0c0f1d] text-[9px] font-bold text-slate-300">
                +{excessCount}
              </div>
            )}
          </div>

          {/* Glowing active indicator dot */}
          <span className="relative flex h-1.5 w-1.5 ml-1">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
        </div>
      )}
    </div>
  );
}
