import React, { useState } from 'react';
import { ServiceSunday, Ministry, Person, Language, NotificationSettings, ShiftSwapRequest, UserRole, canAccessPersonalData, canViewPersonContactInfo } from '../types';
import { downloadICSFile, getGoogleCalendarUrl } from '../utils/calendarExport';
import { formatToEuropeanDate, formatEuropeanDateTime } from '../utils/dateUtils';
import {
  getStoredGoogleChatWebhook,
  setStoredGoogleChatWebhook,
  sendGoogleChatMessage,
  formatRosterForGoogleChat,
  formatPublicInvitationForMessenger,
  openFacebookMessenger,
  openGoogleChatSpace
} from '../lib/messaging';
import {
  Bell,
  CheckCircle2,
  Calendar,
  Send,
  Sliders,
  Mail,
  Smartphone,
  Sparkles,
  Clock,
  X,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Check,
  RotateCcw,
  MessageSquare,
  Share2,
  Copy,
  Users,
  Lock
} from 'lucide-react';
import { 
  getInAppNotifications, 
  markInAppNotificationRead, 
  markAllInAppNotificationsRead, 
  AppNotification 
} from '../services/notificationService';
import { useBackdropHistory } from '../hooks/useBackdropHistory';

interface NotificationHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  activePerson: Person | null;
  currentLanguage: Language;
  onUpdateSunday: (sunday: ServiceSunday) => void;
  onUpdatePersonNotificationSettings?: (personName: string, settings: NotificationSettings) => void;
  googleToken?: string | null;
  onSetGoogleToken?: (token: string | null) => void;
  swapRequests?: ShiftSwapRequest[];
  onCreateSwapRequest?: (req: Omit<ShiftSwapRequest, 'id' | 'createdAt' | 'status'>) => void;
  onCancelSwapRequest?: (requestId: string) => void;
  userRole?: UserRole;
}

export function getWhatsAppReminderUrl(
  ministryName: string,
  dateStr: string,
  phone?: string
): string {
  const message = `Cerkveni opomnik: Živjo! Opomnik za nedeljsko službo (${ministryName}) dne ${dateStr}. Hvala za tvoje služenje!`;
  const encodedText = encodeURIComponent(message);

  if (phone) {
    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '386' + cleanPhone.substring(1);
    }
    cleanPhone = cleanPhone.replace(/\+/g, '');
    if (cleanPhone) {
      return `https://wa.me/${cleanPhone}?text=${encodedText}`;
    }
  }
  return `https://wa.me/?text=${encodedText}`;
}

/**
 * Executes Resend API email dispatch (via /api/send-email serverless route or direct fallback with CORS handling)
 */
export async function sendResendEmail(
  toEmail: string,
  subject: string = 'Opomnik za nedeljsko službo - KC Kalvarija',
  htmlContent?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  const apiKey = (import.meta as any).env?.VITE_RESEND_API_KEY;
  const recipient = (toEmail && toEmail.includes('@')) ? toEmail.trim() : 'delivered@resend.dev';
  const html = htmlContent || '<p>Živjo!</p><p>Opomnik za tvojo nedeljsko službo v KC Kalvarija. Hvala za tvoje služenje!</p>';

  const payload = {
    from: 'KCK Organizacija Nedelje <nedelje@kalvarija.si>',
    to: [recipient],
    subject,
    html
  };

  // 1. Attempt Vercel / serverless endpoint first (/api/send-email)
  try {
    const apiRes = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (apiRes.ok) {
      const apiData = await apiRes.json();
      console.log('[Resend Email] Successfully sent via serverless /api/send-email:', apiData);
      return { success: true, data: apiData };
    }
  } catch (apiErr) {
    console.warn('[Resend Email] Serverless endpoint /api/send-email unavailable, attempting direct API:', apiErr);
  }

  // 2. Direct browser fetch with mode: 'cors'
  if (!apiKey) {
    console.warn('[Resend Email] VITE_RESEND_API_KEY is not defined in environment variables.');
    return { success: false, error: 'VITE_RESEND_API_KEY missing' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const responseData = await res.json();

    if (res.ok) {
      console.log('[Resend Email] Successfully sent email directly to', recipient, responseData);
      return { success: true, data: responseData };
    } else {
      console.error('[Resend Email] Resend API error response:', responseData);
      return { success: false, error: responseData.message || responseData.name || 'Resend API error' };
    }
  } catch (err: any) {
    console.error('[Resend Email] Direct client-side fetch failed (CORS restriction):', err);
    return {
      success: false,
      error: 'CORS Restriction: Direct client-side email dispatch is blocked by Resend policy. Use a Vercel serverless API function (/api/send-email) or trigger via Firebase Cloud Functions.'
    };
  }
}

function WhatsAppIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.301-.15-1.785-.881-2.062-.982-.276-.101-.477-.15-.678.15-.201.3-.779.982-.955 1.183-.176.201-.351.226-.652.076-.301-.15-1.274-.47-2.426-1.498-.897-.799-1.502-1.786-1.678-2.087-.176-.301-.019-.464.13-.613.135-.134.301-.351.452-.527.15-.176.201-.301.301-.502.101-.201.05-.376-.025-.527-.075-.15-.678-1.635-.93-2.245-.244-.593-.492-.511-.677-.521l-.578-.01c-.201 0-.527.075-.804.376-.276.301-1.054 1.03-1.054 2.512 0 1.482 1.079 2.912 1.23 3.113.15.201 2.122 3.24 5.142 4.542.718.31 1.279.495 1.716.634.721.23 1.377.197 1.896.12.578-.086 1.785-.729 2.036-1.432.251-.703.251-1.305.176-1.432-.075-.128-.276-.202-.577-.352z" />
    </svg>
  );
}

function MessengerIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.304 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26 6.559-6.963 3.13 3.26 5.888-3.26-6.559 6.963z" />
    </svg>
  );
}

function GoogleChatIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.98-1.385A9.947 9.947 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm-3 8h6a1 1 0 110 2H9a1 1 0 110-2zm0 4h4a1 1 0 110 2H9a1 1 0 110-2z" />
    </svg>
  );
}

export default function NotificationHubModal({
  isOpen,
  onClose,
  sundays,
  ministries,
  people,
  activePerson,
  currentLanguage,
  onUpdateSunday,
  onUpdatePersonNotificationSettings,
  googleToken,
  onSetGoogleToken,
  swapRequests = [],
  onCreateSwapRequest,
  onCancelSwapRequest,
  userRole
}: NotificationHubModalProps) {
  const [activeTab, setActiveTab] = useState<'my_reminders' | 'volunteer_responses' | 'settings' | 'leader_dispatch'>('my_reminders');
  const [inAppNotifs, setInAppNotifs] = useState<AppNotification[]>(() => getInAppNotifications());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [googleChatWebhook, setGoogleChatWebhook] = useState<string>(() => getStoredGoogleChatWebhook());
  const [isSendingGChat, setIsSendingGChat] = useState<boolean>(false);
  const [copiedPublicInvite, setCopiedPublicInvite] = useState<boolean>(false);
  const [selectedLeaderSundayId, setSelectedLeaderSundayId] = useState<string>(() => sundays[0]?.id || '');

  // Default notification preferences
  const [settings, setSettings] = useState<NotificationSettings>(() => {
    return activePerson?.notificationSettings || {
      emailReminders: true,
      fridayReminder: true,
      saturdayReminder: true,
      browserPush: true,
      reminderTimeFriday: '18:00',
      reminderTimeSaturday: '10:00'
    };
  });

  useBackdropHistory(isOpen, onClose, 'notification-hub-modal');

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Find all upcoming Sunday assignments for active user
  const personName = activePerson?.name || 'Sodelavec';

  // Find future or active sundays where person is assigned
  const myUpcomingDuties: { sunday: ServiceSunday; ministry: Ministry; status: 'confirmed' | 'tentative' | 'swap_requested' }[] = [];

  sundays.forEach((sunday) => {
    Object.entries(sunday.assignments).forEach(([mId, names]) => {
      if (Array.isArray(names) && names.includes(personName)) {
        const ministry = ministries.find((m) => m.id === mId);
        if (ministry) {
          const detail = sunday.assignmentDetails?.[mId]?.find((d) => d.personName === personName);
          const currentStatus = (detail?.status as any) === 'swap_requested' 
            ? 'swap_requested' 
            : (detail?.status || 'confirmed');

          myUpcomingDuties.push({
            sunday,
            ministry,
            status: currentStatus as any
          });
        }
      }
    });
  });

  // Handle status update (Confirm shift / Request swap)
  const handleSetAssignmentStatus = (sunday: ServiceSunday, ministryId: string, newStatus: 'confirmed' | 'swap_requested') => {
    const updatedDetails = { ...(sunday.assignmentDetails || {}) };
    const list = updatedDetails[ministryId] ? [...updatedDetails[ministryId]] : [];
    
    const idx = list.findIndex((item) => item.personName === personName);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status: newStatus as any };
    } else {
      list.push({ personName, status: newStatus as any });
    }

    updatedDetails[ministryId] = list;

    const updatedSunday: ServiceSunday = {
      ...sunday,
      assignmentDetails: updatedDetails
    };

    onUpdateSunday(updatedSunday);

    const ministry = ministries.find(m => m.id === ministryId);
    const ministryName = ministry ? ministry.nameSl : ministryId;

    const existingSwapReq = (swapRequests || []).find(r => 
      (r.sundayId === sunday.id || r.sundayDate === sunday.date) &&
      (r.ministryId === ministryId || r.ministryName === ministryName) &&
      r.requesterName === personName &&
      r.status === 'open'
    );

    if (newStatus === 'confirmed') {
      if (existingSwapReq && onCancelSwapRequest) {
        onCancelSwapRequest(existingSwapReq.id);
      }
      showToast(
        currentLanguage === 'sl'
          ? `✓ Hvala! Prisotnost za ${sunday.date} je potrjena.`
          : `✓ Thank you! Attendance for ${sunday.date} confirmed.`
      );
    } else {
      if (!existingSwapReq && onCreateSwapRequest) {
        onCreateSwapRequest({
          requesterName: personName,
          sundayId: sunday.id,
          sundayDate: sunday.date,
          ministryId: ministryId,
          ministryName: ministryName,
          reason: currentLanguage === 'sl' ? 'Prosim za zamenjavo za nedeljsko službo.' : 'Requesting swap for Sunday duty.'
        });
      }
      showToast(
        currentLanguage === 'sl'
          ? `⚠️ Prošnja za zamenjavo objavljena na Oglasni deski (${sunday.date}).`
          : `⚠️ Swap request posted to Swap Board for ${sunday.date}.`
      );
    }
  };

  // Save settings
  const handleToggleSetting = (key: keyof NotificationSettings) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    if (onUpdatePersonNotificationSettings && activePerson) {
      onUpdatePersonNotificationSettings(activePerson.name, updated);
    }
    showToast(currentLanguage === 'sl' ? 'Nastavitve opomnikov shranjene!' : 'Reminder settings saved!');
  };

  // Simulate & trigger test reminder notification pipeline
  const handleTestNotification = async () => {
    console.log('[NotificationHub] Executing Send Test Reminder Notification pipeline...');

    let pushTriggered = false;

    // 1. BROWSER NATIVE PUSH NOTIFICATION (Client-side Test)
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission();
        console.log('[NotificationHub] Browser Notification permission status:', permission);

        if (permission === 'granted') {
          const title = 'KCK Nedelje Opomnik';
          const body = currentLanguage === 'sl'
            ? `Pozdravljen/a ${personName}! Testno obvestilo deluje pravilno!`
            : `Hello ${personName}! Test reminder notification is working properly!`;
          const icon = '/pwa-192x192.png';

          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            try {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification(title, {
                body,
                icon,
                badge: icon
              });
              pushTriggered = true;
              console.log('[NotificationHub] Native browser notification delivered via Service Worker.');
            } catch (swErr) {
              console.warn('[NotificationHub] Service Worker showNotification failed, using fallback:', swErr);
              new Notification(title, { body, icon });
              pushTriggered = true;
            }
          } else {
            new Notification(title, { body, icon });
            pushTriggered = true;
            console.log('[NotificationHub] Native browser notification delivered via Notification API constructor.');
          }
        } else {
          console.warn('[NotificationHub] Browser notification permission was not granted:', permission);
          alert(
            currentLanguage === 'sl'
              ? 'Dovoljenje za potisna obvestila ni bilo odobreno. Prosimo omogočite obvestila v brskalniku.'
              : 'Browser push notification permission was not granted. Please enable notifications in your browser settings.'
          );
        }
      } catch (err) {
        console.error('[NotificationHub] Error requesting or showing browser notification:', err);
      }
    } else {
      console.warn('[NotificationHub] Notification API is not supported in this browser environment.');
    }

    // 2. EMAIL & BACKEND DELIVERY INTEGRATION (RESEND API)
    const resendApiKey = (import.meta as any).env?.VITE_RESEND_API_KEY;
    const recipientEmail = activePerson?.email || 'delivered@resend.dev';

    if (resendApiKey) {
      console.log('[NotificationHub] Resend API key found. Dispatching email to:', recipientEmail);
      const emailResult = await sendResendEmail(
        recipientEmail,
        'Opomnik za nedeljsko službo - KC Kalvarija',
        `<p>Živjo ${personName}!</p><p>Opomnik za tvojo nedeljsko službo v KC Kalvarija. Hvala za tvoje služenje!</p>`
      );

      if (emailResult.success) {
        showToast(
          currentLanguage === 'sl'
            ? `📧 E-poštno obvestilo poslano na ${recipientEmail}!`
            : `📧 Email reminder dispatched to ${recipientEmail}!`
        );
      } else {
        showToast(
          currentLanguage === 'sl'
            ? `⚠️ E-pošta ni bila poslana: ${emailResult.error}`
            : `⚠️ Email dispatch error: ${emailResult.error}`
        );
      }
    } else {
      console.warn('[NotificationHub] No VITE_RESEND_API_KEY configured in environment variables.');
      showToast(
        currentLanguage === 'sl'
          ? pushTriggered 
            ? '🔔 Preizkusno potisno obvestilo sproženo! (Za e-pošto nastavite VITE_RESEND_API_KEY v .env.local)'
            : '⚠️ Potisno obvestilo ni bilo odobreno v brskalniku. Nastavite VITE_RESEND_API_KEY v .env.local za e-pošto.'
          : pushTriggered
            ? '🔔 Native Web Push triggered! (Configure VITE_RESEND_API_KEY in .env.local for backend emails)'
            : '⚠️ Push blocked in browser. Configure VITE_RESEND_API_KEY in .env.local for backend emails.'
      );
    }
  };

  // Request browser notification permission
  const handleRequestPushPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      console.log('[NotificationHub] Request push permission result:', perm);
      if (perm === 'granted') {
        showToast(currentLanguage === 'sl' ? 'Dovoljenje za potisna obvestila odobreno!' : 'Push notifications allowed!');
        try {
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            const reg = await navigator.serviceWorker.ready;
            await reg.showNotification('KCK Nedelje Opomnik', {
              body: 'Testno obvestilo deluje pravilno!',
              icon: '/pwa-192x192.png'
            });
          } else {
            new Notification('KCK Nedelje Opomnik', {
              body: 'Testno obvestilo deluje pravilno!',
              icon: '/pwa-192x192.png'
            });
          }
        } catch (e) {
          new Notification('KCK Nedelje Opomnik', {
            body: 'Testno obvestilo deluje pravilno!',
            icon: '/pwa-192x192.png'
          });
        }
      } else {
        showToast(currentLanguage === 'sl' ? 'Obvestila so bila onemogočena v brskalniku.' : 'Push notifications were blocked.');
      }
    } else {
      alert(currentLanguage === 'sl' ? 'Vaš brskalnik ne podpira obvestil.' : 'Notifications are not supported in your browser.');
    }
  };

  // Selected Sunday object for Leader Dispatch tab
  const activeLeaderSunday = sundays.find(s => s.id === selectedLeaderSundayId) || sundays[0];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-gray-150 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Bell className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <h2 className="font-display font-semibold text-gray-900 text-base sm:text-lg flex items-center gap-2">
                <span>{currentLanguage === 'sl' ? 'Središče za opomnike in obvestila' : 'Reminder & Notification Center'}</span>
              </h2>
              <p className="text-xs text-gray-500 font-sans mt-0.5">
                {currentLanguage === 'sl'
                  ? `Opomniki, koledar in WhatsApp obveščanje za: ${personName}`
                  : `Reminders, calendar sync, and WhatsApp dispatch for: ${personName}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-1.5 border-b border-slate-200 px-3 sm:px-6 py-2.5 bg-slate-50/80 font-medium text-xs overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('my_reminders')}
            className={`px-3.5 py-2 rounded-xl font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'my_reminders'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{currentLanguage === 'sl' ? 'Moje zadolžitve' : 'My Scheduled Duties'}</span>
            <span className={`ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
              activeTab === 'my_reminders' ? 'bg-indigo-700 text-white' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {myUpcomingDuties.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('volunteer_responses');
              setInAppNotifs(getInAppNotifications());
            }}
            className={`px-3.5 py-2 rounded-xl font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'volunteer_responses'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{currentLanguage === 'sl' ? 'Odzivi sodelavcev' : 'Volunteer Responses'}</span>
            {inAppNotifs.filter(n => !n.read).length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold bg-rose-500 text-white">
                {inAppNotifs.filter(n => !n.read).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-2 rounded-xl font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{currentLanguage === 'sl' ? 'Urnik opomnikov' : 'Reminder Schedule'}</span>
          </button>

          {canAccessPersonalData(userRole) && (
            <button
              onClick={() => setActiveTab('leader_dispatch')}
              className={`px-3.5 py-2 rounded-xl font-semibold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                activeTab === 'leader_dispatch'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{currentLanguage === 'sl' ? 'Vodstveno obveščanje sodelavcev' : 'Leader Volunteer Dispatch'}</span>
            </button>
          )}
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="bg-indigo-600 text-white text-xs px-4 py-2 flex items-center justify-between font-medium animate-fade-in shadow-xs">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>{toastMessage}</span>
            </span>
            <button onClick={() => setToastMessage(null)} className="text-indigo-200 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB: VOLUNTEER RESPONSES */}
          {activeTab === 'volunteer_responses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-gray-600 font-medium">
                  {currentLanguage === 'sl' 
                    ? 'Pregled potrditev, zavrnitev in opomb sodelavcev' 
                    : 'Overview of volunteer confirmations, declines, and notes'}
                </div>
                {inAppNotifs.some(n => !n.read) && (
                  <button
                    type="button"
                    onClick={() => {
                      markAllInAppNotificationsRead();
                      setInAppNotifs(getInAppNotifications());
                      showToast(currentLanguage === 'sl' ? 'Vsa obvestila označena kot prebrana.' : 'All marked as read.');
                    }}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                  >
                    {currentLanguage === 'sl' ? 'Označi vse kot prebrano' : 'Mark all as read'}
                  </button>
                )}
              </div>

              {inAppNotifs.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-semibold text-gray-700">
                    {currentLanguage === 'sl' ? 'Ni novih odzivov sodelavcev.' : 'No volunteer responses yet.'}
                  </p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    {currentLanguage === 'sl'
                      ? 'Ko bodo sodelavci potrdili ali zavrnili zadolžitve prek e-poštne povezave ali dodali opombo, se bodo obvestila prikazala tukaj.'
                      : 'When volunteers confirm or decline invitations via email link or leave notes, notifications will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {inAppNotifs.map((notif) => {
                    const isConfirmed = notif.action === 'confirmed';
                    return (
                      <div
                        key={notif.id}
                        className={`p-3.5 rounded-xl border transition ${
                          notif.read ? 'bg-white border-slate-200' : 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono uppercase ${
                                isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isConfirmed ? '✓ Potrjeno' : '❌ Zavrnjeno'}
                              </span>
                              <span className="font-bold text-xs text-slate-900 font-display">
                                {notif.volunteerName}
                              </span>
                              <span className="text-[11px] text-slate-500 font-sans">
                                • {notif.ministryName} ({formatToEuropeanDate(notif.sundayDate)})
                              </span>
                            </div>

                            {notif.note && (
                              <div className="text-xs text-rose-900 bg-rose-50 border border-rose-200 p-2 rounded-lg italic">
                                💬 <strong>Opomba:</strong> "{notif.note}"
                              </div>
                            )}

                            <div className="text-[10px] text-slate-400 font-mono">
                              {formatEuropeanDateTime(notif.timestamp)}
                            </div>
                          </div>

                          {!notif.read && (
                            <button
                              type="button"
                              onClick={() => {
                                markInAppNotificationRead(notif.id);
                                setInAppNotifs(getInAppNotifications());
                              }}
                              className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold shrink-0 cursor-pointer"
                            >
                              ✓ Prebrano
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: MY REMINDERS */}
          {activeTab === 'my_reminders' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-[#4338CA] font-semibold text-xs font-display">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{currentLanguage === 'sl' ? 'Avtomatski opomniki in koledar za nedeljo' : 'Automated Pre-Sunday Reminder Flow & Calendar Sync'}</span>
                </div>
                <p className="text-[11px] text-gray-600 font-sans leading-relaxed">
                  {currentLanguage === 'sl'
                    ? 'Tukaj so navedeni vaši prihajajoči nedeljski razporedi. Z enim klikom lahko dodate termin v svoj Google Koledar (09:00 - 12:00) ali pošljete opomnik prek WhatsApp-a.'
                    : 'Here are your upcoming Sunday duty assignments. Add events to your Google Calendar in 1 tap (09:00 - 12:00) or send WhatsApp reminders.'}
                </p>
              </div>

              {myUpcomingDuties.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200 space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <p className="text-xs font-semibold text-gray-700">
                    {currentLanguage === 'sl' ? 'Trenutno nimate načrtovanih služb.' : 'No upcoming duties assigned.'}
                  </p>
                  <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
                    {currentLanguage === 'sl'
                      ? 'Ko boste razporejeni na nedeljsko služenje, se bodo tukaj prikazala opozorila in gumbi za koledar.'
                      : 'When leaders assign you to a Sunday service row, your duties and calendar sync links will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {myUpcomingDuties.map(({ sunday, ministry, status }) => {
                    const ministryName = currentLanguage === 'sl' ? ministry.nameSl : ministry.nameEn;
                    const eventTitle = `Nedeljska služba: ${ministryName} (KC Kalvarija)`;
                    const eventDesc = `Nedeljska služba KC Kalvarija\nVloga: ${ministryName}\nČas: 09:00 - 12:00\nDatum: ${sunday.date}\nVoditelj/Gost: ${sunday.guest || 'KC Kalvarija'}`;
                    const googleUrl = getGoogleCalendarUrl(eventTitle, sunday.date, eventDesc);
                    const whatsappUrl = getWhatsAppReminderUrl(ministryName, sunday.date, activePerson?.phone);

                    return (
                      <div
                        key={`${sunday.id}-${ministry.id}`}
                        className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-2xs hover:border-indigo-200 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-sm text-gray-950">
                                📅 {sunday.date}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${
                                  status === 'confirmed'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : status === 'swap_requested'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                }`}
                              >
                                {status === 'confirmed'
                                  ? (currentLanguage === 'sl' ? '✓ Prisotnost potrjena' : '✓ Confirmed')
                                  : status === 'swap_requested'
                                  ? (currentLanguage === 'sl' ? '⚠️ Zamenjava v teku' : '⚠️ Swap Requested')
                                  : (currentLanguage === 'sl' ? '⏰ Opomnik aktiven' : '⏰ Scheduled')}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-[#4338CA] mt-1 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span>
                              <span>{ministryName}</span>
                              <span className="text-[11px] text-gray-500 font-mono font-normal">
                                (09:00 - 12:00)
                              </span>
                            </div>
                          </div>

                          <div className="text-[11px] text-gray-500 font-mono flex items-center gap-2">
                            <span>{currentLanguage === 'sl' ? 'Opomnik:' : 'Reminders:'}</span>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-semibold">
                              {currentLanguage === 'sl' ? 'Četrtek 18:00 & Sobota 10:00' : 'Thursday 18:00 & Saturday 10:00'}
                            </span>
                          </div>
                        </div>

                        {/* Status Change & Action Triggers */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                          {/* Left: Attendance Toggle & Swap Buttons */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {(() => {
                              const existingSwapReq = (swapRequests || []).find(r => 
                                (r.sundayId === sunday.id || r.sundayDate === sunday.date) &&
                                (r.ministryId === ministry.id || r.ministryName === (ministry.nameSl || ministry.name)) &&
                                r.requesterName === personName &&
                                r.status === 'open'
                              );

                              const isSwapActive = status === 'swap_requested' || !!existingSwapReq;

                              if (isSwapActive) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleSetAssignmentStatus(sunday, ministry.id, 'confirmed')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    title={currentLanguage === 'sl' ? 'Prekliči zamenjavo in potrdi prisotnost' : 'Cancel swap & confirm attendance'}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>{currentLanguage === 'sl' ? 'Potrdi prisotnost (Prekliči zamenjavo)' : 'Confirm Duty (Cancel Swap)'}</span>
                                  </button>
                                );
                              }

                              return (
                                <div className="flex items-center gap-1.5">
                                  {status !== 'confirmed' && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetAssignmentStatus(sunday, ministry.id, 'confirmed')}
                                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>{currentLanguage === 'sl' ? 'Potrdi prisotnost' : 'Confirm Attendance'}</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleSetAssignmentStatus(sunday, ministry.id, 'swap_requested')}
                                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                    title={currentLanguage === 'sl' ? 'Objavi prošnjo za zamenjavo na Oglasni deski' : 'Post swap request to Swap Board'}
                                  >
                                    <span className="text-xs">⚠️</span>
                                    <span>{currentLanguage === 'sl' ? 'Prosim za zamenjavo' : 'Request Swap'}</span>
                                  </button>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Right: Direct Calendar & WhatsApp Actions */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
                              }}
                              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-250 text-xs font-bold rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer shadow-2xs"
                              title={currentLanguage === 'sl' ? 'Pošlji WhatsApp opomnik' : 'Send WhatsApp reminder'}
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => downloadICSFile(eventTitle, sunday.date, eventDesc)}
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#4338CA] border border-indigo-200/80 text-xs font-semibold rounded-lg transition active:scale-95 flex items-center gap-1 cursor-pointer"
                              title={currentLanguage === 'sl' ? 'Prenesi datoteko za koledar (iPhone / Outlook)' : 'Download calendar file (iPhone / Outlook)'}
                            >
                              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{currentLanguage === 'sl' ? 'Moj koledar (iPhone / Outlook)' : 'My Calendar (iPhone / Outlook)'}</span>
                            </button>

                            <a
                              href={googleUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault();
                                window.open(googleUrl, '_blank', 'noopener,noreferrer');
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>📅 {currentLanguage === 'sl' ? 'Dodaj v Google Koledar' : 'Add to Google Calendar'}</span>
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REMINDER SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-mono">
                  {currentLanguage === 'sl' ? 'Kanal obveščanja in časovni zamiki' : 'Channels & Timing'}
                </h3>

                {/* Thursday Prep Reminder Toggle */}
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-gray-900 block flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-600" />
                      <span>{currentLanguage === 'sl' ? 'Četrtek: Pripravljalni opomnik (72h prej)' : 'Thursday: Prep Reminder (72h prior)'}</span>
                    </span>
                    <span className="text-[11px] text-gray-500 font-sans block">
                      {currentLanguage === 'sl'
                        ? 'Prijazen opomnik v četrtek ob 18:00 za pravočasno pripravo in možnost zamenjave.'
                        : 'Friendly reminder on Thursday at 18:00 for advance prep and shift swap window.'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.fridayReminder}
                    onChange={() => handleToggleSetting('fridayReminder')}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Saturday Final Reminder Toggle */}
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-gray-900 block flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-600" />
                      <span>{currentLanguage === 'sl' ? 'Sobota: Končni opomnik (24h prej)' : 'Saturday: Final Reminder (24h prior)'}</span>
                    </span>
                    <span className="text-[11px] text-gray-500 font-sans block">
                      {currentLanguage === 'sl'
                        ? 'Zadnji opomnik v soboto ob 10:00 z informacijami o času prihoda in navodili.'
                        : 'Final reminder on Saturday at 10:00 AM with arrival time and instructions.'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.saturdayReminder}
                    onChange={() => handleToggleSetting('saturdayReminder')}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Email Reminders Toggle */}
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-gray-900 block flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      <span>{currentLanguage === 'sl' ? 'E-poštna obvestila' : 'Email Notifications'}</span>
                    </span>
                    <span className="text-[11px] text-gray-500 font-sans block">
                      {activePerson?.email ? activePerson.email : (currentLanguage === 'sl' ? 'Naveden e-poštni naslov v profilu' : 'Send to profile email address')}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.emailReminders}
                    onChange={() => handleToggleSetting('emailReminders')}
                    className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                </div>

                {/* Push Notifications Toggle */}
                <div className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-gray-900 block flex items-center gap-2">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                      <span>{currentLanguage === 'sl' ? 'Potisna obvestila na telefonu' : 'Phone Web Push Notifications'}</span>
                    </span>
                    <span className="text-[11px] text-gray-500 font-sans block">
                      {currentLanguage === 'sl'
                        ? 'Neposredno obvestilo na mobilnem brskalniku ali namizju.'
                        : 'Direct browser / mobile push notifications.'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleRequestPushPermission}
                      className="text-[10px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                    >
                      {currentLanguage === 'sl' ? 'Omogoči' : 'Enable'}
                    </button>
                    <input
                      type="checkbox"
                      checked={settings.browserPush}
                      onChange={() => handleToggleSetting('browserPush')}
                      className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Action: Test Notification */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-gray-300"
                >
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>
                    {currentLanguage === 'sl'
                      ? 'Pošlji preizkusno opomnik-obvestilo zdaj'
                      : 'Send Test Reminder Notification Now'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LEADER BATCH DISPATCH & WHATSAPP */}
          {activeTab === 'leader_dispatch' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs font-display">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>{currentLanguage === 'sl' ? 'Vodstveno obveščanje sodelavcev' : 'Leader Volunteer Dispatch'}</span>
                </div>
                <p className="text-[11px] text-amber-800 font-sans leading-relaxed">
                  {currentLanguage === 'sl'
                    ? 'Hitro obveščanje sodelavcev preko WhatsApp, Messenger ali Google Chat kanalov z enim klikom.'
                    : 'Quickly dispatch reminders to volunteers via WhatsApp, Messenger, or Google Chat channels in 1 click.'}
                </p>
              </div>

              {/* Sunday Selector for Leader Dispatch */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider font-mono">
                  {currentLanguage === 'sl' ? 'Izberi nedeljsko bogoslužje za obveščanje:' : 'Select Sunday Service:'}
                </label>
                <select
                  value={selectedLeaderSundayId}
                  onChange={(e) => setSelectedLeaderSundayId(e.target.value)}
                  className="w-full text-xs p-2.5 bg-white border border-gray-250 rounded-xl text-gray-900 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer shadow-2xs"
                >
                  {sundays.map((s) => (
                    <option key={s.id} value={s.id}>
                      📅 {s.date} {s.themeSl ? `– ${s.themeSl}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Roster Volunteers & WhatsApp 1-tap Reminders */}
              {activeLeaderSunday && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                    <h4 className="text-xs font-bold text-gray-900 font-display flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-indigo-600" />
                      <span>{currentLanguage === 'sl' ? 'Razporejeni sodelavci na ta dan:' : 'Assigned Volunteers:'}</span>
                    </h4>
                    <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-150">
                      {activeLeaderSunday.date}
                    </span>
                  </div>

                  {(() => {
                    const assignedPairs: { ministryId: string; ministryName: string; personName: string; phone?: string }[] = [];
                    Object.entries(activeLeaderSunday.assignments).forEach(([mId, names]) => {
                      if (Array.isArray(names)) {
                        const m = ministries.find((min) => min.id === mId);
                        const mName = m ? (currentLanguage === 'sl' ? m.nameSl : m.nameEn) : mId;
                        names.forEach((pName) => {
                          const p = people.find((person) => person.name === pName);
                          assignedPairs.push({
                            ministryId: mId,
                            ministryName: mName,
                            personName: pName,
                            phone: p?.phone
                          });
                        });
                      }
                    });

                    if (assignedPairs.length === 0) {
                      return (
                        <p className="text-xs text-gray-400 italic py-2">
                          {currentLanguage === 'sl' ? 'Za to nedeljo še ni dodeljenih sodelavcev.' : 'No volunteers assigned for this Sunday yet.'}
                        </p>
                      );
                    }

                    return (
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                        {assignedPairs.map((pair, idx) => {
                          const waUrl = getWhatsAppReminderUrl(pair.ministryName, activeLeaderSunday.date, pair.phone);
                          const isContactVisible = canViewPersonContactInfo(
                            userRole,
                            activePerson?.name,
                            { name: pair.personName, phone: pair.phone }
                          );

                          return (
                            <div key={`${pair.ministryId}-${pair.personName}-${idx}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 gap-2">
                              <div>
                                <span className="text-xs font-bold text-slate-900 block">{pair.personName}</span>
                                <span className="text-[10px] text-indigo-700 font-mono font-semibold">{pair.ministryName}</span>
                                {isContactVisible && pair.phone && <span className="text-[10px] text-slate-400 font-mono block">📞 {pair.phone}</span>}
                              </div>

                              {isContactVisible ? (
                                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                  {/* WhatsApp Pill */}
                                  <a
                                    href={waUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      window.open(waUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0 font-semibold shadow-2xs"
                                    title={currentLanguage === 'sl' ? 'Pošlji opomnik preko WhatsApp' : 'Send WhatsApp reminder'}
                                  >
                                    <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                                    <span>WA</span>
                                  </a>

                                  {/* Messenger Pill */}
                                  <button
                                    type="button"
                                    onClick={() => openFacebookMessenger()}
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0 font-semibold shadow-2xs"
                                    title={currentLanguage === 'sl' ? 'Odpri Facebook Messenger' : 'Open Facebook Messenger'}
                                  >
                                    <MessengerIcon className="w-3.5 h-3.5 fill-current" />
                                    <span>FB</span>
                                  </button>

                                  {/* Google Chat Pill */}
                                  <button
                                    type="button"
                                    onClick={() => openGoogleChatSpace()}
                                    className="bg-teal-600 hover:bg-teal-700 text-white text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer active:scale-95 shrink-0 font-semibold shadow-2xs"
                                    title={currentLanguage === 'sl' ? 'Odpri Google Chat' : 'Open Google Chat'}
                                  >
                                    <GoogleChatIcon className="w-3.5 h-3.5 fill-current" />
                                    <span>GChat</span>
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                                  <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{currentLanguage === 'sl' ? 'Dostopno vodjem' : 'Leaders & Admins only'}</span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Group Channels: Google Chat & Facebook Messenger */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* 1. Google Chat Integration Card */}
                <div className="bg-emerald-950 text-white rounded-xl p-3.5 border border-emerald-800/80 space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white font-display">
                        Google Chat Space
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => openGoogleChatSpace()}
                      className="px-2 py-0.5 bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-[10px] font-semibold rounded transition flex items-center gap-1 border border-emerald-700 cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Odpri Chat</span>
                    </button>
                  </div>

                  <input
                    type="url"
                    value={googleChatWebhook}
                    onChange={(e) => {
                      setGoogleChatWebhook(e.target.value);
                      setStoredGoogleChatWebhook(e.target.value);
                    }}
                    placeholder="Webhook URL..."
                    className="w-full bg-emerald-900/60 border border-emerald-700 text-[11px] text-white placeholder-emerald-500/80 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-400 font-mono"
                  />

                  <button
                    type="button"
                    onClick={async () => {
                      if (!sundays.length) return;
                      setIsSendingGChat(true);
                      const targetSunday = activeLeaderSunday || sundays[0];
                      const msg = formatRosterForGoogleChat(targetSunday.date, targetSunday.themeSl, targetSunday.assignments as any, currentLanguage);
                      const res = await sendGoogleChatMessage(msg, googleChatWebhook);
                      setIsSendingGChat(false);
                      if (res.success) {
                        showToast(currentLanguage === 'sl' ? '✓ Uspešno poslano v Google Chat!' : '✓ Posted to Google Chat!');
                      } else {
                        showToast(`⚠️ ${res.error}`);
                      }
                    }}
                    disabled={isSendingGChat}
                    className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSendingGChat ? 'Pošiljam...' : (currentLanguage === 'sl' ? 'Objavi razpored v Google Chat' : 'Post to Google Chat')}</span>
                  </button>
                </div>

                {/* 2. Facebook Messenger Card */}
                <div className="bg-blue-950 text-white rounded-xl p-3.5 border border-blue-800/80 space-y-2.5 shadow-md flex flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-blue-400" />
                    <h4 className="text-xs font-bold text-white font-display">
                      FB Messenger Javno Vabilo
                    </h4>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const targetSunday = activeLeaderSunday || sundays[0];
                        if (!targetSunday) return;
                        const inviteText = formatPublicInvitationForMessenger(targetSunday.date, targetSunday.themeSl, targetSunday.guest, currentLanguage);
                        navigator.clipboard.writeText(inviteText);
                        setCopiedPublicInvite(true);
                        setTimeout(() => setCopiedPublicInvite(false), 3000);
                        showToast(currentLanguage === 'sl' ? '📋 Javno vabilo kopirano za Messenger!' : '📋 Invitation copied for Messenger!');
                      }}
                      className="w-full py-1.5 bg-blue-800 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {copiedPublicInvite ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPublicInvite ? (currentLanguage === 'sl' ? 'Kopirano!' : 'Copied!') : (currentLanguage === 'sl' ? 'Kopiraj vabilo za skupino' : 'Copy Invite')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const targetSunday = activeLeaderSunday || sundays[0];
                        if (!targetSunday) return;
                        const inviteText = formatPublicInvitationForMessenger(targetSunday.date, targetSunday.themeSl, targetSunday.guest, currentLanguage);
                        openFacebookMessenger('kc.kalvarija', inviteText);
                      }}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>{currentLanguage === 'sl' ? 'Odpri FB Messenger' : 'Open Messenger'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-mono">
            {currentLanguage === 'sl' ? 'Sistem opomnikov v1.1 • KC Kalvarija' : 'Reminder Engine v1.1 • KC Kalvarija'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            {currentLanguage === 'sl' ? 'Zapri' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
}
