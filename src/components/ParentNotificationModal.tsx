import React, { useState } from 'react';
import { X, Send, Phone, MessageSquare, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface ParentNotificationModalProps {
  student: {
    studentId: string;
    identifier: string; // USN
    name: string;
    parentContact?: string;
  };
  subject: string;
  date: string;
  time: string;
  onClose: () => void;
  onSent?: () => void;
}

export const ParentNotificationModal: React.FC<ParentNotificationModalProps> = ({
  student,
  subject,
  date,
  time,
  onClose,
  onSent,
}) => {
  const [contact, setContact] = useState<string>(student.parentContact || '');
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [resultMessage, setResultMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  const formattedMessage = `Dear Parent/Guardian,\n\nYour ward ${student.name}\nUSN: ${student.identifier}\n\nwas marked ABSENT for:\n${subject}\n\nat Government Engineering College, Bidar.\nDate: ${date}\nTime: ${time}\n\nPlease take note.\n\nRegards,\nGEC Bidar Attendance System`;

  const handleNotify = async () => {
    const cleanPhone = contact.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 10) {
      setResultMessage({
        type: 'error',
        text: 'Please enter a valid 10-12 digit parent mobile number with country code (e.g. 919876543210).',
      });
      return;
    }

    setIsSending(true);
    setResultMessage(null);

    try {
      // 1. Log notification in backend attendance database
      const res = await api.post('/attendance/notify-parent', {
        studentId: student.studentId,
        identifier: student.identifier,
        studentName: student.name,
        parentContact: cleanPhone,
        subject,
        date,
        time,
        channel,
        message: formattedMessage,
      });

      // 2. If WhatsApp, launch the verified chat window with pre-filled message
      if (channel === 'whatsapp') {
        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedMessage)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
        setResultMessage({
          type: 'success',
          text: `WhatsApp dispatch opened for Parent (+${cleanPhone}). Notification logged on college records.`,
        });
      } else {
        // SMS Gateway
        setResultMessage({
          type: res.gatewayActive ? 'success' : 'info',
          text: res.message || 'Notification recorded in college registry.',
        });
      }

      if (onSent) onSent();
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: err.message || 'Failed to dispatch parent absence notice.',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F2A4A]/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0F2A4A] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            <h3 className="font-serif font-bold text-sm">Notify Parent of Absence</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Ward Summary Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-slate-500 block">Student Ward</span>
              <span className="font-semibold text-slate-800">{student.name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">USN</span>
              <span className="font-mono font-semibold text-slate-800 tabular-nums">{student.identifier}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Absent Subject</span>
              <span className="font-semibold text-amber-900">{subject}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Class Schedule</span>
              <span className="font-semibold text-slate-800">{date} · {time}</span>
            </div>
          </div>

          {/* Contact Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Parent / Guardian WhatsApp or Phone Number</span>
              <span className="text-[10px] text-slate-500 font-normal">Include country code (e.g. 91)</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="tel"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="e.g. 919876543210"
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono tabular-nums"
              />
            </div>
            {!student.parentContact && (
              <p className="mt-1 text-[11px] text-amber-700">
                Notice: Student profile lacked a parent contact; entering it here will update the college database for future notices.
              </p>
            )}
          </div>

          {/* Channel Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Dispatch Channel</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors flex items-center justify-center gap-1.5 ${
                  channel === 'whatsapp'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>WhatsApp Official Link</span>
              </button>
              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-colors flex items-center justify-center gap-1.5 ${
                  channel === 'sms'
                    ? 'border-blue-600 bg-blue-50 text-blue-800'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>College SMS Gateway</span>
              </button>
            </div>
          </div>

          {/* Message Preview */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Message Preview</label>
            <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 max-h-36 overflow-y-auto">
              {formattedMessage}
            </pre>
          </div>

          {/* Result Alert */}
          {resultMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                resultMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : resultMessage.type === 'error'
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              {resultMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="leading-relaxed">{resultMessage.text}</div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleNotify}
              disabled={isSending}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F2A4A] hover:bg-[#1E4976] rounded-lg transition-colors flex items-center gap-1.5 shadow disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-amber-400" />
              <span>{isSending ? 'Dispatching...' : 'Dispatch Notification'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
