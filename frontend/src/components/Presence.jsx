import React from "react";

/**
 * Presence Component
 * Renders a glassmorphic dashboard widget showing the active real-time collaborator count in the room.
 *
 * @param {Object} props
 * @param {number} props.users - Number of active users in the room
 */
export default function Presence({ users = [] }) {
  const visibleUsers = users.slice(0, 4);
  const excessCount = users.length > 4 ? users.length - 4 : 0;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/6 px-4 py-3 backdrop-blur-md transition-all duration-300 hover:border-cyan-300/15 hover:bg-white/10 flex flex-col justify-center min-w-[180px]">
      <p className="text-[0.7rem] uppercase tracking-[0.24em] text-slate-400">
        Collaborators
      </p>
      <div className="mt-2 flex items-center gap-3">
        {users.length === 0 ? (
          <p className="text-sm font-medium text-slate-400">No one online</p>
        ) : (
          <div className="flex items-center">
            {/* Overlapping Avatar Stack */}
            <div className="flex -space-x-2 overflow-hidden">
              {visibleUsers.map((user, idx) => (
                <div
                  key={`${user.userId || idx}-${idx}`}
                  className="group relative inline-block h-8 w-8 rounded-full ring-2 ring-slate-950 bg-gradient-to-br from-cyan-400 to-indigo-600 cursor-help"
                >
                  {user.avatar ? (
                    <img
                      className="h-full w-full rounded-full object-cover"
                      src={user.avatar}
                      alt={user.username}
                    />
                  ) : (
                    <div className="h-full w-full rounded-full flex items-center justify-center text-xs font-bold text-white uppercase">
                      {user.username.slice(0, 2)}
                    </div>
                  )}
                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 rounded-lg bg-slate-950/90 px-2.5 py-1 text-xs font-semibold text-white border border-white/10 shadow-xl opacity-0 transition-all duration-200 group-hover:opacity-100 whitespace-nowrap">
                    {user.username}
                  </div>
                </div>
              ))}

              {excessCount > 0 && (
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 ring-2 ring-slate-950 text-xs font-bold text-slate-300">
                  +{excessCount}
                </div>
              )}
            </div>

            {/* Glowing active indicator dot */}
            <span className="relative flex h-2 w-2 ml-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
