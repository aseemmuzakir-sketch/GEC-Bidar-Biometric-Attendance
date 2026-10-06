import React from 'react';
import { useAuth } from '../context/AuthContext';
import { GecCrest } from './GecCrest';
import { LogOut, User as UserIcon, Shield, Fingerprint } from 'lucide-react';

interface HeaderProps {
  onOpenBiometricEnroll?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenBiometricEnroll }) => {
  const { user, logout, isFaculty } = useAuth();

  if (!user) return null;

  return (
    <header className="sticky top-0 z-30 bg-[#0F2A4A] text-white border-b border-amber-500/20 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single Brand Zone */}
        <div className="flex items-center gap-3 min-w-0">
          <GecCrest size={40} />
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold truncate">
              Government Engineering College, Bidar
            </div>
            <div className="text-base sm:text-lg font-serif font-bold text-white tracking-tight truncate flex items-center gap-2">
              Attendance Management System
            </div>
          </div>
        </div>

        {/* Zone 2: Academic Role & Department Context */}
        <div className="hidden md:flex items-center gap-2 text-xs text-slate-300">
          <span className="font-semibold text-white">{user.name}</span>
          <span className="text-slate-500">·</span>
          <span className="font-mono text-amber-300 tabular-nums">{user.identifier}</span>
          <span className="text-slate-500">·</span>
          <span className="truncate max-w-[200px]">{user.department}</span>
          {user.semester && (
            <>
              <span className="text-slate-500">·</span>
              <span>Sem {user.semester}</span>
            </>
          )}
          {user.designation && (
            <>
              <span className="text-slate-500">·</span>
              <span>{user.designation}</span>
            </>
          )}
        </div>

        {/* Zone 3: Primary Actions (Biometric status & Logout) */}
        <div className="flex items-center gap-3 shrink-0">
          {onOpenBiometricEnroll && (
            <button
              onClick={onOpenBiometricEnroll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 rounded-lg transition-colors"
              title="Manage Device Biometric"
            >
              <Fingerprint className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Biometric</span>
            </button>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-slate-700">
            <div className="w-8 h-8 rounded-full bg-[#1E4976] border border-amber-400/30 flex items-center justify-center text-xs font-bold text-amber-200">
              {user.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-200 hover:text-white hover:bg-red-950/60 rounded-lg border border-red-900/40 transition-colors"
              title="Sign out of attendance portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
