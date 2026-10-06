import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { FacultyDashboard } from './components/FacultyDashboard';
import { BiometricModal } from './components/BiometricModal';
import { ShieldCheck, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, isLoading, isStudent, isFaculty } = useAuth();
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0F2A4A] flex flex-col items-center justify-center text-white">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mb-4" />
        <div className="font-serif text-lg font-bold">GEC Bidar Attendance Management System</div>
        <div className="text-xs text-slate-300 mt-1">Verifying campus credentials...</div>
      </div>
    );
  }

  // Not logged in -> Show Authentication View
  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Official Top Bar */}
      <Header onOpenBiometricEnroll={() => setEnrollModalOpen(true)} />

      {/* Main View Port - Guarded strictly by Role */}
      <main className="flex-1">
        {isStudent && <StudentDashboard />}
        {isFaculty && <FacultyDashboard />}
      </main>

      {/* Official Academic Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Government Engineering College, Bidar</span>
            <span>·</span>
            <span>Affiliated to Visvesvaraya Technological University (VTU), Belagavi</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
            <span>Attendance Management System · Role-Guarded Access</span>
          </div>
        </div>
      </footer>

      {/* Global Device Biometric Enrollment Modal */}
      {enrollModalOpen && (
        <BiometricModal
          mode="enroll"
          onClose={() => setEnrollModalOpen(false)}
          onSuccess={(msg) => {
            showToast(msg);
            setEnrollModalOpen(false);
          }}
        />
      )}

      {/* Global Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#0F2A4A] text-white px-4 py-2.5 rounded-lg shadow-lg border border-amber-400/40 text-xs flex items-center gap-2 animate-fade-in">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
