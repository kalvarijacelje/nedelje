/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ServiceSunday, Ministry, Person, Translation, UserRole, User, canAccessPersonalData, canViewPersonContactInfo, getPrivacyDisplayName } from '../types';
import { 
  Plus, Search, Phone, Mail, UserCheck, ShieldAlert, X, Crown, Pencil, Trash2, Link as LinkIcon, Unlink, AlertTriangle, Camera, Star, Award, HeartPulse, BatteryCharging, Info, MessageSquare, Send, Copy, ExternalLink, Link2, CheckCircle2, Check, Users, Archive, RotateCcw, Bell, Lock, Sliders, Loader2, Smile, GraduationCap, Footprints, Building2
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import PhotoCropperModal from './PhotoCropperModal';
import { calculatePersonBurnoutStatus, getBurnoutSummaryStats, isExemptFromBurnout } from '../lib/burnoutAnalytics';
import { useBackdropHistory } from '../hooks/useBackdropHistory';
import { supabase } from '../supabaseClient';
import { toCanonicalPersonId } from '../services/supabaseDataService';

interface PeopleViewProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  users?: User[];
  userRole: UserRole;
  activePerson?: Person | null;
  authUser?: any;
  translations: Translation;
  currentLanguage: 'sl' | 'en';
  onAddPerson: (newPerson: Person) => void;
  onDeletePerson?: (personId: string) => void;
  onUpdatePerson?: (personId: string, updatedPerson: Person) => void;
  onLinkUserPerson?: (userId: string, personId: string | undefined) => void;
  onUpdateUserRole?: (userId: string, newRole: UserRole) => void;
  onDeleteUser?: (userId: string, userEmail?: string) => void;
  onOpenNotificationModal?: () => void;
  googleToken?: string | null;
  onSetGoogleToken?: (token: string | null) => void;
  confirmedViewerIds?: string[];
  onConfirmViewer?: (userId: string, userEmail?: string) => void;
}

interface PendingUserItemCardProps {
  key?: React.Key;
  user: User;
  people: Person[];
  currentLanguage: 'sl' | 'en';
  onLinkUserPerson?: (userId: string, personName: string | undefined) => void;
  onUpdateUserRole?: (userId: string, newRole: UserRole) => void;
  onAddPerson: (newPerson: Person) => void;
  onDeleteUser?: (userId: string, userEmail?: string) => void;
  onConfirmViewer?: (userId: string, userEmail?: string) => void;
}

function PendingUserItemCard({
  user,
  people,
  currentLanguage,
  onLinkUserPerson,
  onUpdateUserRole,
  onAddPerson,
  onDeleteUser,
  onConfirmViewer,
}: PendingUserItemCardProps) {
  // Smart auto-match: find person with similar name or email
  const nameLower = (user.displayName || '').toLowerCase().trim();
  const emailLower = (user.email || '').toLowerCase().trim();

  const bestMatch = (people || []).find(p => {
    if (!p || !p.name) return false;
    const pNameLower = p.name.toLowerCase().trim();
    const pEmailLower = (p.email || '').toLowerCase().trim();
    if (emailLower && pEmailLower && emailLower === pEmailLower) return true;
    if (nameLower && pNameLower && (nameLower === pNameLower || nameLower.includes(pNameLower) || pNameLower.includes(nameLower))) return true;
    return false;
  });

  const [selectedPersonName, setSelectedPersonName] = useState<string>(user.personName || bestMatch?.name || '');
  const [selectedRole, setSelectedRole] = useState<UserRole>(user.role !== 'Viewer' ? user.role : (bestMatch?.role || 'Servant'));
  
  // Add new person sub-form state
  const [isAddingNew, setIsAddingNew] = useState<boolean>(false);
  const [newPersonName, setNewPersonName] = useState<string>(user.displayName || (user.email ? user.email.split('@')[0] : ''));
  const [newPersonRole, setNewPersonRole] = useState<UserRole>('Servant');
  const [newPersonPhone, setNewPersonPhone] = useState<string>('');
  
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleLinkExisting = () => {
    if (!selectedPersonName) {
      setStatusMsg({
        text: currentLanguage === 'sl' ? 'Prosimo izberite sodelavca s seznama.' : 'Please select a volunteer from the list.',
        type: 'error'
      });
      return;
    }
    const target = (people || []).find(p => p && (p.id === selectedPersonName || p.name === selectedPersonName));
    if (onLinkUserPerson) {
      onLinkUserPerson(user.uid, target ? target.id : selectedPersonName);
    }
    if (onUpdateUserRole) {
      onUpdateUserRole(user.uid, selectedRole);
    }
    setStatusMsg({
      text: currentLanguage === 'sl' 
        ? `Račun ${user.email} je bil uspešno povezan s sodelavcem ${target?.name || selectedPersonName} (vloga: ${selectedRole})!`
        : `Successfully linked ${user.email} to ${target?.name || selectedPersonName} (role: ${selectedRole})!`,
      type: 'success'
    });
  };

  const handleCreateAndLink = () => {
    const trimmedName = newPersonName.trim();
    if (!trimmedName) {
      setStatusMsg({
        text: currentLanguage === 'sl' ? 'Prosimo vnesite ime in priimek sodelavca.' : 'Please enter volunteer name.',
        type: 'error'
      });
      return;
    }
    
    // Check if name already exists in roster
    const existing = (people || []).find(p => p && p.name.toLowerCase() === trimmedName.toLowerCase());
    if (existing) {
      if (onLinkUserPerson) onLinkUserPerson(user.uid, existing.id);
      if (onUpdateUserRole) onUpdateUserRole(user.uid, newPersonRole);
      setStatusMsg({
        text: currentLanguage === 'sl'
          ? `Sodelavec "${existing.name}" že obstaja v bazi. Račun je bil uspešno povezan z njim!`
          : `Volunteer "${existing.name}" already exists in roster. Account linked!`,
        type: 'success'
      });
      return;
    }

    const createdPerson: Person = {
      id: toCanonicalPersonId(trimmedName),
      name: trimmedName,
      email: user.email,
      phone: newPersonPhone.trim() || undefined,
      role: newPersonRole,
      preferredMinistries: [],
      ledMinistries: [],
      familyMembers: []
    };

    onAddPerson(createdPerson);
    if (onLinkUserPerson) onLinkUserPerson(user.uid, createdPerson.id);
    if (onUpdateUserRole) onUpdateUserRole(user.uid, newPersonRole);

    setStatusMsg({
      text: currentLanguage === 'sl'
        ? `Nov sodelavec "${trimmedName}" ustvarjen in uspešno povezan z računom ${user.email}!`
        : `New volunteer "${trimmedName}" created and linked to ${user.email}!`,
      type: 'success'
    });
  };

  const linkedPerson = (people || []).find(p => p && (
    p.name === user.personName || 
    p.id === user.personName || 
    (p.email && user.email && p.email.toLowerCase().trim() === user.email.toLowerCase().trim()) ||
    ((p as any).auth_user_id && (p as any).auth_user_id === user.uid)
  ));
  const isUnlinked = !linkedPerson;

  return (
    <div className={`p-4 rounded-2xl space-y-3 font-sans transition shadow-xs ${
      isUnlinked 
        ? 'bg-amber-50/90 border-2 border-amber-500 ring-2 ring-amber-400/20 shadow-md' 
        : 'bg-slate-50 border border-slate-200'
    }`}>
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl font-bold flex items-center justify-center text-sm font-mono shrink-0 shadow-2xs ${
            isUnlinked ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white'
          }`}>
            {(user.displayName || user.email || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 flex-wrap">
              <span>{user.displayName || (currentLanguage === 'sl' ? 'Neregistrirano ime' : 'Unregistered Name')}</span>
              {linkedPerson ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  ✓ {currentLanguage === 'sl' ? 'Povezan: ' : 'Linked: '}{linkedPerson.name}
                </span>
              ) : (
                <span className="text-[10px] bg-amber-600 text-white font-mono font-bold px-2 py-0.5 rounded-full shadow-2xs">
                  ⚠️ {currentLanguage === 'sl' ? 'NI POVEZAN S PROFILOM' : 'NOT LINKED'}
                </span>
              )}
              {user.role === 'Viewer' && (
                <span className="text-[10px] bg-slate-200 text-slate-800 font-mono font-bold px-2 py-0.5 rounded-full border border-slate-300">
                  👁️ {currentLanguage === 'sl' ? 'Čaka na vlogo' : 'Pending Role'}
                </span>
              )}
            </h4>
            <span className="text-xs text-slate-500 font-mono block">{user.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-250 shadow-2xs">
            🔑 {user.role}
          </span>
          {onDeleteUser && (
            <button
              type="button"
              onClick={() => onDeleteUser(user.uid, user.email)}
              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-100 rounded-lg transition cursor-pointer"
              title={currentLanguage === 'sl' ? 'Izbriši ta registrirani račun iz baze' : 'Erase account'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Success / Error Message Banner */}
      {statusMsg && (
        <div className={`p-3 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in ${
          statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border border-emerald-250' : 'bg-rose-50 text-rose-900 border border-rose-250'
        }`}>
          <span>{statusMsg.text}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="text-slate-500 hover:text-slate-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Workflow Sections */}
      {!isAddingNew ? (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Who do I assign? */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono mb-1">
                👤 {currentLanguage === 'sl' ? 'Koga želite dodeliti? (Izberite sodelavca)' : 'Who do I assign? (Select Volunteer)'}
              </label>
              <select
                value={selectedPersonName}
                onChange={(e) => setSelectedPersonName(e.target.value)}
                className={`w-full text-xs px-3 py-2 border rounded-xl font-medium focus:outline-none focus:ring-2 cursor-pointer shadow-2xs ${
                  isUnlinked 
                    ? 'bg-amber-50 border-2 border-amber-400 text-amber-950 font-bold focus:ring-amber-500' 
                    : 'bg-white border-slate-300 text-slate-900 focus:ring-indigo-600'
                }`}
              >
                <option value="">-- {currentLanguage === 'sl' ? '⚠️ Izberite sodelavca iz baze' : '⚠️ Select roster volunteer'} --</option>
                {(people || [])
                  .filter(p => p && p.name && !p.isArchived)
                  .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                  .map((p) => {
                    const isRec = bestMatch?.name === p.name;
                    return (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name} {isRec ? `★ (${currentLanguage === 'sl' ? 'Priporočeno' : 'Suggested'})` : ''} {p.email ? `- ${p.email}` : ''}
                      </option>
                    );
                  })
                }
              </select>
            </div>

            {/* Role Assignment */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono mb-1">
                🔑 {currentLanguage === 'sl' ? 'Vloga v aplikaciji (samodejno shranjevanje):' : 'Assigned Role (auto-saved):'}
              </label>
              <select
                value={selectedRole}
                onChange={(e) => {
                  const nextRole = e.target.value as UserRole;
                  setSelectedRole(nextRole);
                  if (onUpdateUserRole) {
                    onUpdateUserRole(user.uid, nextRole);
                  }
                  if (nextRole === 'Viewer' && onConfirmViewer) {
                    onConfirmViewer(user.uid, user.email);
                  }
                  setStatusMsg({
                    text: currentLanguage === 'sl'
                      ? `✓ Vloga uporabnika ${user.displayName || user.email} shranjena (${nextRole})!`
                      : `✓ Role updated to ${nextRole}!`,
                    type: 'success'
                  });
                }}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-600 cursor-pointer shadow-2xs"
              >
                <option value="Servant">👤 Servant / Služabnik</option>
                <option value="Leader">📋 Leader / Vodja službe</option>
                <option value="Admin">🛠️ Admin (Poln nadzor)</option>
                <option value="Viewer">👁️ Viewer / Gledalec</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleLinkExisting}
                disabled={!selectedPersonName}
                className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <UserCheck className="w-4 h-4" />
                <span>{currentLanguage === 'sl' ? '✓ Poveži račun in shrani profil' : '✓ Link Account & Save Profile'}</span>
              </button>

              {onConfirmViewer && (
                <button
                  type="button"
                  onClick={() => {
                    onConfirmViewer(user.uid, user.email);
                    setStatusMsg({
                      text: currentLanguage === 'sl'
                        ? `✓ Uporabnik ${user.displayName || user.email} je potrjen kot Gledalec (brez pravic urejanja). Obvestilo je odstranjeno!`
                        : `✓ User ${user.displayName || user.email} confirmed as Viewer. Notification cleared!`,
                      type: 'success'
                    });
                  }}
                  className="w-full sm:w-auto px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  title={currentLanguage === 'sl' ? 'Potrdi uporabnika kot Gledalca brez dodeljevanja služb' : 'Confirm user as Viewer without granting editing permissions'}
                >
                  <span>👁️ {currentLanguage === 'sl' ? 'Potrdi kot Gledalec (brez pravic)' : 'Keep as Viewer (no permissions)'}</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAddingNew(true)}
              className="w-full sm:w-auto px-3.5 py-2 bg-white hover:bg-slate-100 text-indigo-700 border border-indigo-200 font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>{currentLanguage === 'sl' ? '+ Dodaj kot novega sodelavca' : '+ Add as New Volunteer'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Create New Person Sub-form */
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 animate-fade-in font-sans">
          <div className="flex items-center justify-between border-b border-indigo-150 pb-2">
            <h5 className="font-bold text-xs text-indigo-950 font-display flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>{currentLanguage === 'sl' ? 'Ustvari novega sodelavca in poveži Gmail:' : 'Add New Volunteer & Link Gmail:'}</span>
            </h5>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
            >
              {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono mb-1">
                👤 {currentLanguage === 'sl' ? 'Ime in priimek:' : 'Full Name:'}
              </label>
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Npr. Mojca Cilenšek"
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono mb-1">
                ✉️ {currentLanguage === 'sl' ? 'E-pošta (Google):' : 'Google Email:'}
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-600 font-mono text-xs cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono mb-1">
                🔑 {currentLanguage === 'sl' ? 'Vloga v aplikaciji:' : 'Role:'}
              </label>
              <select
                value={newPersonRole}
                onChange={(e) => setNewPersonRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-lg text-slate-900 font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
              >
                <option value="Servant">👤 Servant (Privzeto)</option>
                <option value="Leader">📋 Leader / Vodja</option>
                <option value="Admin">🛠️ Admin</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreateAndLink}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>{currentLanguage === 'sl' ? 'Ustvari sodelavca in poveži Gmail' : 'Create Volunteer & Link Gmail'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-3.5 py-2 bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              {currentLanguage === 'sl' ? 'Nazaj' : 'Back'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PeopleView({
  sundays,
  ministries,
  people,
  users = [],
  userRole,
  activePerson,
  authUser,
  translations,
  currentLanguage,
  onAddPerson,
  onDeletePerson,
  onUpdatePerson,
  onLinkUserPerson,
  onUpdateUserRole,
  onDeleteUser,
  onOpenNotificationModal,
  googleToken,
  onSetGoogleToken,
  confirmedViewerIds = [],
  onConfirmViewer,
}: PeopleViewProps) {
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          scopes: 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/chat.spaces.readonly https://www.googleapis.com/auth/chat.messages.create',
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account',
          }
        }
      });
      if (error) {
        console.error('Google connect error:', error);
      }
    } catch (err: any) {
      console.error('Google connect error:', err);
    } finally {
      setIsConnectingGoogle(false);
    }
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonPhone, setNewPersonPhone] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonRole, setNewPersonRole] = useState<UserRole>('Visitor');
  const [newPastorOrStaff, setNewPastorOrStaff] = useState<boolean>(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState<string | undefined>(undefined);
  const [newSelectedUserId, setNewSelectedUserId] = useState<string>('');
  const [addError, setAddError] = useState<string>('');
  const [cropperTarget, setCropperTarget] = useState<'edit' | 'add' | null>(null);
  const [selectedPrefs, setSelectedPrefs] = useState<string[]>([]);
  const [selectedLedMinistries, setSelectedLedMinistries] = useState<string[]>([]);
  const [newFamilyMemberText, setNewFamilyMemberText] = useState('');
  const [newFamilyList, setNewFamilyList] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);

  // Quick WhatsApp / SMS Reminder trigger modal
  const [reminderModalPerson, setReminderModalPerson] = useState<Person | null>(null);
  const [copiedReminderText, setCopiedReminderText] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activePeopleTab, setActivePeopleTab] = useState<'all' | 'active' | 'members' | 'youth' | 'visitors'>('all');
  const [showPendingUsersModal, setShowPendingUsersModal] = useState<boolean>(false);

  // Quick edit member state
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Servant');
  const [editMemberType, setEditMemberType] = useState<'adult' | 'minor' | 'youth' | 'visitor' | 'member'>('adult');
  const [editPastorOrStaff, setEditPastorOrStaff] = useState<boolean>(false);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | undefined>(undefined);
  const [showCropperModal, setShowCropperModal] = useState<boolean>(false);
  const [editPrefs, setEditPrefs] = useState<string[]>([]);
  const [editLedMinistries, setEditLedMinistries] = useState<string[]>([]);
  const [editFamilyMembers, setEditFamilyMembers] = useState<string[]>([]);
  const [editFamilyInput, setEditFamilyInput] = useState('');
  const [editError, setEditError] = useState('');

  useBackdropHistory(!!editingPerson, () => setEditingPerson(null), 'people-edit-person');
  useBackdropHistory(!!personToDelete, () => setPersonToDelete(null), 'people-delete-person');
  useBackdropHistory(!!reminderModalPerson, () => setReminderModalPerson(null), 'people-reminder-modal');
  useBackdropHistory(showPendingUsersModal, () => setShowPendingUsersModal(false), 'people-pending-users-modal');

  const isAdmin = userRole === 'Admin';
  const isLeader = userRole === 'Leader';
  const canEdit = isAdmin || isLeader;

  const canEditPerson = (target: Person | null | undefined): boolean => {
    if (!target) return false;
    if (isAdmin) return true;

    // ANY logged-in user (Leader, Servant, Member) can ALWAYS edit their OWN profile card!
    const isTargetMe = 
      (myPersonCard && (target.name === myPersonCard.name || (target.id && target.id === myPersonCard.id))) ||
      (activePerson && (target.name === activePerson.name || (target.id && target.id === activePerson.id))) ||
      (authUser?.email && target.email && target.email.toLowerCase().trim() === authUser.email.toLowerCase().trim());

    if (isTargetMe) return true;

    if (isLeader) {
      // 1. Leaders can NEVER edit an Admin account
      if (target.role === 'Admin' || target.name === 'Aleš Lajlar') return false;
      // 2. Leaders can NEVER edit OTHER leaders' profile cards
      if (target.role === 'Leader') return false;
      // 3. Leaders can edit team volunteers, servants, and members
      return true;
    }
    return false;
  };

  // Count active future assignment loads for each person to spot overwork
  const calculateServingCount = (personName: string) => {
    let count = 0;
    sundays.forEach((sunday) => {
      Object.values(sunday.assignments).forEach((roster) => {
        if (Array.isArray(roster) && roster.includes(personName)) {
          count++;
        }
      });
    });
    return count;
  };

  // Calculate Attendance Stats (Phase 2 Check-in logging)
  const calculateAttendanceStats = (personName: string) => {
    let totalAssigned = 0;
    let presentCount = 0;

    sundays.forEach((sunday) => {
      let wasAssigned = false;
      let wasPresent = false;

      Object.entries(sunday.assignments).forEach(([mId, roster]) => {
        if (Array.isArray(roster) && roster.includes(personName)) {
          wasAssigned = true;
          const rec = sunday.attendanceRecords?.[`${mId}_${personName}`];
          if (rec?.status === 'present' || rec?.status === 'late') {
            wasPresent = true;
          }
        }
      });

      if (wasAssigned) {
        totalAssigned++;
        if (wasPresent) presentCount++;
      }
    });

    const rate = totalAssigned > 0 ? Math.round((presentCount / totalAssigned) * 100) : 100;
    return { totalAssigned, presentCount, rate };
  };

  const handleCreatePersonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newPersonName.trim();
    if (!trimmedName) {
      setAddError(currentLanguage === 'sl' ? 'Ime ne sme biti prazno.' : 'Name cannot be empty.');
      return;
    }

    // Check if duplicate of existing name
    if (people.some(p => p && p.name && p.name.toLowerCase() === trimmedName.toLowerCase())) {
      setAddError(currentLanguage === 'sl' ? 'Sodelavec s tem imenom že obstaja!' : 'Volunteer with this name already exists!');
      return;
    }

    const createdPerson: Person = {
      id: toCanonicalPersonId(trimmedName),
      name: trimmedName,
      avatarUrl: newAvatarUrl || undefined,
      phone: newPersonPhone.trim() || undefined,
      email: newPersonEmail.trim() || undefined,
      role: newPersonRole,
      memberType: newPersonRole === 'Minor' ? 'minor' : (newPersonRole === 'Visitor' ? 'visitor' : (newPersonRole === 'Viewer' ? 'member' : 'adult')),
      isPastorOrStaff: newPastorOrStaff,
      preferredMinistries: selectedPrefs,
      ledMinistries: selectedLedMinistries,
      familyMembers: newFamilyList,
      createdBy: activePerson?.name || (userRole === 'Leader' ? 'Vodja' : 'Admin'),
      createdAt: new Date().toISOString(),
    };

    onAddPerson(createdPerson);

    // Immediate Google Account linking if selected
    if (newSelectedUserId && onLinkUserPerson) {
      onLinkUserPerson(newSelectedUserId, createdPerson.id);
    }

    // Reciprocal two-way family member linking for existing team members
    newFamilyList.forEach(famName => {
      const match = people.find(p => p && (p.name === famName || p.name.toLowerCase() === famName.toLowerCase()));
      if (match && match.name !== trimmedName && onUpdatePerson) {
        const existingFam = match.familyMembers || [];
        if (!existingFam.includes(trimmedName)) {
          onUpdatePerson(match.id, {
            ...match,
            familyMembers: [...existingFam, trimmedName]
          });
        }
      }
    });

    setNewPersonName('');
    setNewPersonPhone('');
    setNewPersonEmail('');
    setNewPersonRole('Servant');
    setNewPastorOrStaff(false);
    setNewAvatarUrl(undefined);
    setNewSelectedUserId('');
    setSelectedPrefs([]);
    setSelectedLedMinistries([]);
    setNewFamilyList([]);
    setNewFamilyMemberText('');
    setAddError('');
    setShowAddForm(false);
  };

  const startEditPerson = (person: Person) => {
    setCropperTarget('edit');
    setEditingPerson(person);
    setEditName(person.name);
    setEditPhone(person.phone || '');
    setEditEmail(person.email || '');
    setEditRole(person.role || 'Servant');
    setEditMemberType(person.memberType || (person.role === 'Minor' ? 'minor' : (person.role === 'Visitor' ? 'visitor' : 'adult')));
    setEditPastorOrStaff(person.isPastorOrStaff || isExemptFromBurnout(person.name));
    setEditAvatarUrl(person.avatarUrl);
    setEditPrefs([...person.preferredMinistries]);
    setEditLedMinistries([...(person.ledMinistries || [])]);
    setEditFamilyMembers([...(person.familyMembers || [])]);
    setEditError('');
  };

  const handleCancelEditPerson = () => {
    if (editingPerson) {
      if (window.confirm(currentLanguage === 'sl' ? 'Spremembe niso bile shranjene. Ali ste prepričani, da želite zapustiti urejanje?' : 'Changes have not been saved. Are you sure you want to close?')) {
        setEditingPerson(null);
        setEditError('');
      }
    } else {
      setEditingPerson(null);
      setEditError('');
    }
  };

  // Protect against accidental tab closing or navigation when form is open
  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (editingPerson || showAddForm) {
        e.preventDefault();
        e.returnValue = currentLanguage === 'sl' ? 'Spremembe niso bile shranjene. Ali ste prepričani, da želite zapustiti stran?' : 'Changes have not been saved. Are you sure you want to leave?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [editingPerson, showAddForm, currentLanguage]);

  const handleSaveEditPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson || !onUpdatePerson) return;

    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditError(currentLanguage === 'sl' ? 'Ime ne sme biti prazno.' : 'Name cannot be empty.');
      return;
    }

    // Check if duplicate of another person
    const isDuplicate = people.some(
      p => p && p.id !== editingPerson.id && p.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      setEditError(
        currentLanguage === 'sl'
          ? 'Sodelavec s tem imenom že obstaja. Prosimo dodajte priimek ali začetnico.'
          : 'Volunteer with this name already exists. Please add a surname or initial.'
      );
      return;
    }

    if (!isAdmin && editingPerson.role === 'Admin') {
      setEditError(currentLanguage === 'sl' ? 'Nimate pooblastil za spreminjanje Admin računa.' : 'You do not have permission to edit an Admin account.');
      return;
    }

    if (!isAdmin && editRole === 'Admin') {
      setEditError(currentLanguage === 'sl' ? 'Le administrator lahko dodeli Admin vlogo.' : 'Only an administrator can grant the Admin role.');
      return;
    }

    const cleanMemberType = editRole === 'Minor' ? 'minor' : (editRole === 'Visitor' ? 'visitor' : (editRole === 'Viewer' ? 'member' : 'adult'));

    onUpdatePerson(editingPerson.id, {
      ...editingPerson,
      id: editingPerson.id,
      name: trimmedName,
      avatarUrl: editAvatarUrl || undefined,
      phone: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      role: editRole,
      memberType: cleanMemberType,
      isVisitor: editRole === 'Visitor',
      isPastorOrStaff: editPastorOrStaff,
      isExemptFromBurnout: editPastorOrStaff,
      preferredMinistries: editPrefs,
      ledMinistries: editLedMinistries,
      familyMembers: editFamilyMembers,
    });

    // Reciprocal two-way family linking for added family members
    editFamilyMembers.forEach(famName => {
      const match = people.find(p => p && (p.name === famName || p.name.toLowerCase() === famName.toLowerCase()));
      if (match && match.name !== trimmedName) {
        const existingFam = match.familyMembers || [];
        if (!existingFam.includes(trimmedName)) {
          onUpdatePerson(match.id, {
            ...match,
            familyMembers: [...existingFam, trimmedName]
          });
        }
      }
    });

    // Reciprocal unlinking for removed family members
    const oldFamilyMembers = editingPerson.familyMembers || [];
    const removedFamilyMembers = oldFamilyMembers.filter(f => !editFamilyMembers.includes(f));
    removedFamilyMembers.forEach(famName => {
      const match = people.find(p => p && (p.name === famName || p.name.toLowerCase() === famName.toLowerCase()));
      if (match && match.name !== trimmedName) {
        const existingFam = match.familyMembers || [];
        if (existingFam.includes(trimmedName)) {
          onUpdatePerson(match.id, {
            ...match,
            familyMembers: existingFam.filter(f => f !== trimmedName)
          });
        }
      }
    });

    setEditingPerson(null);
    setEditError('');
  };

  const togglePref = (id: string) => {
    if (selectedPrefs.includes(id)) {
      setSelectedPrefs(selectedPrefs.filter(p => p !== id));
    } else {
      setSelectedPrefs([...selectedPrefs, id]);
    }
  };

  const toggleEditPref = (id: string) => {
    if (editPrefs.includes(id)) {
      setEditPrefs(editPrefs.filter(p => p !== id));
    } else {
      setEditPrefs([...editPrefs, id]);
    }
  };

  const myPersonCard = (activePerson && activePerson.name)
    ? (people || []).find(p => p && (p.name === activePerson.name || p.id === activePerson.id) && !p.isArchived)
    : null;

  const pendingUsers = useMemo(() => {
    return (users || []).filter(u => {
      const userEmailKey = (u.email || '').toLowerCase().trim();
      const isConfirmed = 
        confirmedViewerIds.includes(u.uid) || 
        (userEmailKey && confirmedViewerIds.includes(userEmailKey)) ||
        u.approval_status === 'viewer_approved';

      // Confirmed Viewers do NOT show up in pending alerts!
      if (isConfirmed) return false;

      const linkedPerson = (people || []).find(p => p && (
        (p.email && u.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim()) ||
        (u.personName && p.name && p.name.toLowerCase().trim() === u.personName.toLowerCase().trim()) ||
        (u.displayName && p.name && (u.displayName.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(u.displayName.toLowerCase()))) ||
        ((p as any).auth_user_id && (p as any).auth_user_id === u.uid)
      ));
      const isUnlinked = !linkedPerson;
      const isUnconfirmedViewer = u.role === 'Viewer';
      return isUnlinked || isUnconfirmedViewer;
    });
  }, [users, people, confirmedViewerIds]);

  const KNOWN_MINOR_IDS = useMemo(() => new Set([
    'p-tian_knap', 'p-hana_knap', 'p-natan_knap',
    'p-iva_kolar', 'p-mila_kolar',
    'p-jona_oreskovic', 'p-ronja_oreskovic',
    'p-emanuel_pratneker', 'p-jakob_pratneker', 'p-luka_pratneker',
    'p-lucija_srebot', 'p-leon_srebot',
    'p-masa_stefancic', 'p-mia_stefancic',
    'p-david_vuleta', 'p-izak_vuleta',
    'p-arne_zunec', 'p-pia_princic',
    'p-adonijah_lajlar', 'p-daniel_lajlar',
    'p-huntley_james_hupp', 'p-kenzley_franceen_hupp'
  ]), []);

  const getPersonCategory = (p: Person): 'active' | 'members' | 'youth' | 'visitors' => {
    if (!p) return 'members';
    if (p.isArchived || p.role === 'Visitor' || p.memberType === 'visitor' || p.isVisitor) {
      return 'visitors';
    }

    const isServing =
      p.role === 'Admin' ||
      p.role === 'Leader' ||
      p.role === 'Servant' ||
      (p.preferredMinistries && p.preferredMinistries.length > 0) ||
      (p.ledMinistries && p.ledMinistries.length > 0);

    if (isServing) {
      return 'active';
    }

    if (p.memberType === 'minor' || p.memberType === 'youth' || p.role === 'Minor' || (p.id && KNOWN_MINOR_IDS.has(p.id))) {
      return 'youth';
    }

    return 'members';
  };

  const allPeopleCount = (people || []).filter(p => p && p.name).length;
  const activeServantsCount = (people || []).filter(p => p && p.name && getPersonCategory(p) === 'active').length;
  const churchMembersCount = (people || []).filter(p => p && p.name && getPersonCategory(p) === 'members').length;
  const youthAndChildrenCount = (people || []).filter(p => p && p.name && getPersonCategory(p) === 'youth').length;
  const visitorsCount = (people || []).filter(p => p && p.name && getPersonCategory(p) === 'visitors').length;

  const filteredPeople = (people || []).filter((p) => {
    if (!p || typeof p !== 'object' || !p.name) return false;
    if (activePeopleTab !== 'all') {
      const cat = getPersonCategory(p);
      if (cat !== activePeopleTab) return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.familyMembers && p.familyMembers.some(f => f.toLowerCase().includes(q)))
    );
  });

  const leadersAndAdmins = filteredPeople
    .filter(p => p && p.name && (p.role === 'Admin' || p.role === 'Leader') && p.name !== myPersonCard?.name)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', currentLanguage === 'sl' ? 'sl' : 'en'));

  const servants = filteredPeople
    .filter(p => p && p.name && p.role !== 'Admin' && p.role !== 'Leader' && p.name !== myPersonCard?.name)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', currentLanguage === 'sl' ? 'sl' : 'en'));

  const burnoutStats = getBurnoutSummaryStats(sundays, people);

  if (!canAccessPersonalData(userRole)) {
    return (
      <div id="people-view-restricted" className="max-w-2xl mx-auto w-full p-8 my-8 bg-white border border-slate-200 rounded-2xl shadow-xs text-center space-y-4 font-sans animate-fade-in">
        <div className="w-14 h-14 mx-auto bg-amber-50 text-amber-600 rounded-full flex items-center justify-center border border-amber-200 shadow-2xs">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="font-display font-semibold text-gray-900 text-base">
            {currentLanguage === 'sl' ? 'Dostop omejen' : 'Access Restricted'}
          </h3>
          <p className="text-xs font-semibold text-amber-900 max-w-md mx-auto">
            {currentLanguage === 'sl'
              ? 'Osebni imenik je dostopen le odobrenim sodelavcem'
              : 'Personal directory is accessible only to approved team servants, leaders, and admins'}
          </p>
        </div>
        <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
          {currentLanguage === 'sl'
            ? 'Kot registrirani uporabnik s statusom pregledovalca (Viewer) si lahko ogledate nedeljske urnike in sporede. Za dostop do baze kontaktirajte administratorja.'
            : 'As a viewer, you can view Sunday rosters and rundowns. Contact an administrator to request team servant access.'}
        </p>
      </div>
    );
  }

  return (
    <div id="people-view-component" className="w-full space-y-5 animate-fade-in pb-12">
      {/* Admin Notification Banner for Unlinked / Pending New Users (People tab only) */}
      {userRole === 'Admin' && pendingUsers.length > 0 && (() => {
        const unlinkedList = pendingUsers.filter(u => !people.some(p => p && (
          p.name === u.personName || 
          p.id === u.personName || 
          (p.email && u.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim()) ||
          ((p as any).auth_user_id && (p as any).auth_user_id === u.uid)
        )));
        const viewersList = pendingUsers.filter(u => !unlinkedList.some(un => un.uid === u.uid));

        return (
          <div 
            onClick={() => setShowPendingUsersModal(true)}
            className="p-3.5 sm:p-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border-2 border-amber-500/50 hover:border-amber-500/70 text-amber-950 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md cursor-pointer transition"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 text-base shadow-sm">
                🔔
              </div>
              <div className="space-y-1 min-w-0">
                <h4 className="font-bold text-xs sm:text-sm text-amber-950 font-display flex items-center gap-2 flex-wrap">
                  <span>{currentLanguage === 'sl' ? 'Novo obvestilo o registracijah & vlogah' : 'User Registration & Role Notification'}</span>
                  <span className="text-[10px] bg-amber-600 text-white font-mono font-bold px-2 py-0.5 rounded-full shadow-2xs">
                    {pendingUsers.length}
                  </span>
                  {unlinkedList.length > 0 && (
                    <span className="text-[10px] bg-amber-600 text-white font-mono font-bold px-2 py-0.5 rounded-full shadow-2xs">
                      ⚠️ {unlinkedList.length} {currentLanguage === 'sl' ? 'nepovezanih' : 'unlinked'}
                    </span>
                  )}
                  {viewersList.length > 0 && (
                    <span className="text-[10px] bg-slate-800 text-slate-100 font-mono font-bold px-2 py-0.5 rounded-full shadow-2xs">
                      👁️ {viewersList.length} {currentLanguage === 'sl' ? 'gledalcev (čaka na vlogo)' : 'viewers (pending role)'}
                    </span>
                  )}
                </h4>
                <p className="text-[11px] text-amber-900 font-mono mt-0.5 font-medium leading-relaxed">
                  {currentLanguage === 'sl'
                    ? (unlinkedList.length > 0 && viewersList.length > 0
                        ? `${pendingUsers.map(u => u.displayName || u.email).join(', ')} – Vloge še niso dodeljene ali profili niso povezani s sodelavci.`
                        : unlinkedList.length > 0
                          ? `${unlinkedList.map(u => u.displayName || u.email).join(', ')} – Čaka na povezavo s profilom v bazi sodelavcev.`
                          : `${viewersList.map(u => u.displayName || u.email).join(', ')} – Novi uporabniki imajo vlogo Gledalec (Viewer), nastavite njihovo vlogo.`)
                    : `${pendingUsers.map(u => u.displayName || u.email).join(', ')} – Pending role assignment or profile linking.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
              {onConfirmViewer && viewersList.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    viewersList.forEach(v => onConfirmViewer(v.uid, v.email));
                  }}
                  className="w-full sm:w-auto px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                  title={currentLanguage === 'sl' ? 'Potrdi gledalce brez dodeljevanja posebnih pravic in odstrani obvestilo' : 'Confirm viewers and dismiss alert'}
                >
                  <span>👁️ {currentLanguage === 'sl' ? (viewersList.length === 1 ? 'Potrdi kot Gledalca' : 'Potrdi vse Gledalce') : 'Confirm as Viewer(s)'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPendingUsersModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0 shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>{currentLanguage === 'sl' ? '⚡ Poveži & Nastavi vloge' : '⚡ Link & Assign Roles'}</span>
              </button>
            </div>
          </div>
        );
      })()}

      {/* Hero Header Banner with subtle serving balance integration */}
      <HeroHeaderBanner
        variant="people"
        eyebrow={currentLanguage === 'sl' ? '👤 BAZA SODELAVCEV • KC KALVARIJA' : '👤 VOLUNTEER ROSTER • KC KALVARIJA'}
        title={translations.people}
        subtitle={currentLanguage === 'sl' ? 'Baza članov cerkve, vloge, kontakti, družinske povezave ter pregled služb.' : 'Servant database, team roles, contacts, family linkages, and serving balance tracker.'}
        icon={Users}
      >
        {/* Subtle Serving Balance & Roster Summary */}
        <div className="pt-2.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-white/85 font-medium flex items-center gap-1.5 text-xs">
              <HeartPulse className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>{currentLanguage === 'sl' ? 'Uravnoteženost služb:' : 'Serving balance:'}</span>
            </span>

            {burnoutStats.overloadedCount > 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-rose-500/25 text-rose-200 border border-rose-400/40">
                🔴 {burnoutStats.overloadedCount} {currentLanguage === 'sl' ? 'preobremenjenih' : 'overloaded'}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                🟢 {currentLanguage === 'sl' ? 'Uravnotežen urnik' : 'Balanced schedule'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-white/85">
            <span className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/10">
              👥 {activeServantsCount} {currentLanguage === 'sl' ? 'aktivnih' : 'active'}
            </span>
            <span className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/10">
              🏛️ {churchMembersCount} {currentLanguage === 'sl' ? 'članov' : 'members'}
            </span>
            <span className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/10">
              👶 {youthAndChildrenCount} {currentLanguage === 'sl' ? 'mladih' : 'youth'}
            </span>
            {visitorsCount > 0 && (
              <span className="px-2 py-0.5 bg-white/10 rounded-lg border border-white/10">
                🌿 {visitorsCount} {currentLanguage === 'sl' ? 'obiskovalcev' : 'visitors'}
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Alert Banner only if anyone is overloaded */}
        {burnoutStats.overloadedCount > 0 && (
          <div className="mt-2 p-2.5 bg-rose-950/80 border border-rose-500/40 text-rose-200 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {currentLanguage === 'sl'
                ? `Opozorilo za voditelje: ${burnoutStats.overloadedPeople.map(p => `${p.name} (${p.consecutive}x)`).join(', ')} strežejo 3+ nedelj zapored.`
                : `Leader Fatigue Alert: ${burnoutStats.overloadedPeople.map(p => `${p.name} (${p.consecutive}x)`).join(', ')} served 3+ consecutive Sundays.`}
            </span>
          </div>
        )}
      </HeroHeaderBanner>

      {/* Add New Person Drawer Form (Admin only) */}
      {showAddForm && (
        <form
          onSubmit={handleCreatePersonSubmit}
          className="p-4 sm:p-5 bg-white border border-gray-200 rounded-2xl shadow-xl space-y-4 animate-scale-up border-t-4 border-t-indigo-600"
        >
          <div className="flex items-center justify-between pb-3 border-b border-gray-150">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
                <Plus className="w-4 h-4" />
              </div>
              <h4 className="font-display font-semibold text-gray-900 text-sm tracking-tight">
                {currentLanguage === 'sl' ? 'Dodaj Novega Sodelavca' : 'Assign New Volunteer'}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-[10px] font-bold uppercase text-gray-400 hover:text-gray-700 transition focus:outline-none cursor-pointer"
            >
              {currentLanguage === 'sl' ? 'Zapri' : 'Close'}
            </button>
          </div>

          {addError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{addError}</span>
            </div>
          )}

          {/* Photo Avatar Upload & Crop Section */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="relative group shrink-0">
              {newAvatarUrl ? (
                <img
                  src={newAvatarUrl}
                  alt={newPersonName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-sm"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold text-base font-mono flex items-center justify-center border-2 border-indigo-200 shadow-sm select-none">
                  {newPersonName ? newPersonName[0] : '?'}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setCropperTarget('add');
                  setShowCropperModal(true);
                }}
                className="absolute inset-0 rounded-full bg-slate-900/40 text-white flex items-center justify-center opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title={currentLanguage === 'sl' ? 'Dodaj profilno sliko' : 'Add profile picture'}
              >
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCropperTarget('add');
                    setShowCropperModal(true);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{newAvatarUrl ? (currentLanguage === 'sl' ? 'Spremeni sliko' : 'Change photo') : (currentLanguage === 'sl' ? 'Naloži sliko' : 'Upload photo')}</span>
                </button>
                {newAvatarUrl && (
                  <button
                    type="button"
                    onClick={() => setNewAvatarUrl(undefined)}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{currentLanguage === 'sl' ? 'Odstrani' : 'Remove'}</span>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Maks. 10 MB • Avtomatsko obrezano 300x300
              </p>
            </div>
          </div>

          {/* Primary Info: Name, Phone, Email */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
                {currentLanguage === 'sl' ? 'Ime in priimek sodelavca' : 'Member Name & Surname'}
              </label>
              <input
                type="text"
                required
                value={newPersonName}
                onChange={(e) => {
                  setNewPersonName(e.target.value);
                  if (addError) setAddError('');
                }}
                placeholder="Npr. Franci Šumer ali Janez A."
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 font-medium"
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-600" />
                <span>{currentLanguage === 'sl' ? 'Telefon (GSM)' : 'Phone'}</span>
              </label>
              <input
                type="tel"
                value={newPersonPhone}
                onChange={(e) => setNewPersonPhone(e.target.value)}
                placeholder="041 850 651"
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div className="space-y-1 sm:col-span-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 font-mono flex items-center gap-1">
                <Mail className="w-3 h-3 text-indigo-600" />
                <span>{currentLanguage === 'sl' ? 'E-pošta' : 'Email Address'}</span>
              </label>
              <input
                type="email"
                value={newPersonEmail}
                onChange={(e) => setNewPersonEmail(e.target.value)}
                placeholder="ime@domena.si"
                className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>
          </div>

          {/* Immediate Google Account Linking Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600 font-mono flex items-center gap-1">
                <Link2 className="w-3 h-3 text-indigo-600" />
                <span>{currentLanguage === 'sl' ? 'Poveži z Google Računom takoj ob ustvarjanju' : 'Link to Google Account immediately'}</span>
              </label>
              {newSelectedUserId ? (
                <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{currentLanguage === 'sl' ? 'Izbran za povezavo' : 'Selected to Link'}</span>
                </span>
              ) : (
                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                  {currentLanguage === 'sl' ? 'Neobvezno' : 'Optional'}
                </span>
              )}
            </div>

            <select
              value={newSelectedUserId}
              onChange={(e) => setNewSelectedUserId(e.target.value)}
              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
            >
              <option value="">{currentLanguage === 'sl' ? '-- Brez povezave ali izberite registriran Google račun --' : '-- No link or select registered Google Account --'}</option>
              {users
                .filter(u => !u.personName)
                .map(u => (
                  <option key={u.uid} value={u.uid}>
                    {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                  </option>
                ))}
            </select>
          </div>

          {/* System Access Role Assignment */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
              🔑 {currentLanguage === 'sl' ? 'Vloga in dovoljenja v aplikaciji' : 'System Access Role'}
            </label>
            <select
              value={newPersonRole}
              onChange={(e) => setNewPersonRole(e.target.value as UserRole)}
              className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer font-semibold"
            >
              <option value="Admin">🛠️ Admin (Poln nadzor)</option>
              <option value="Leader">📋 Leader / Vodja službe (Urejanje svojih služb)</option>
              <option value="Servant">🤝 Servant / Služabnik (Služenje v ekipi)</option>
              <option value="Viewer">👤 Member / Član (Član cerkve)</option>
              <option value="Visitor">👋 Visitor / Obiskovalec (Občasen obisk / Gost)</option>
              <option value="Minor">👶 Minor / Mladoletni član</option>
            </select>
          </div>

          {/* Exemption Toggle */}
          <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
            <input
              type="checkbox"
              id="newPastorOrStaff"
              checked={newPastorOrStaff}
              onChange={(e) => setNewPastorOrStaff(e.target.checked)}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
            />
            <label htmlFor="newPastorOrStaff" className="text-xs font-semibold text-purple-900 cursor-pointer flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-purple-600" />
              <span>{currentLanguage === 'sl' ? 'Izvzemi iz preobremenjenosti (Vodstvo / Leader)' : 'Exempt from fatigue alerts (Leadership / Leader)'}</span>
            </label>
          </div>

          {/* Linked Family Members Section */}
          <div className="space-y-2 p-3 bg-emerald-50/50 border border-emerald-150 rounded-xl">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-emerald-950 font-mono">
              👨‍👩‍👧 {currentLanguage === 'sl' ? 'Povezani družinski člani (Mož / Žena / Otroci)' : 'Linked Family Members'}
            </label>

            {/* Active linked family badges */}
            <div className="flex flex-wrap gap-1.5">
              {newFamilyList.map(famName => (
                <span key={famName} className="inline-flex items-center gap-1 text-[10px] bg-white text-emerald-900 border border-emerald-250 font-bold px-2 py-0.5 rounded-full font-mono shadow-2xs">
                  <span>{famName}</span>
                  <button
                    type="button"
                    onClick={() => setNewFamilyList(newFamilyList.filter(f => f !== famName))}
                    className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                    title={currentLanguage === 'sl' ? 'Odstrani povezavo' : 'Remove link'}
                  >
                    &times;
                  </button>
                </span>
              ))}
              {newFamilyList.length === 0 && (
                <span className="text-[10px] text-emerald-800/70 italic font-mono">
                  {currentLanguage === 'sl' ? 'Ni povezanih družinskih članov' : 'No linked family members'}
                </span>
              )}
            </div>

            {/* 1. Quick Dropdown Selector for Team Volunteers */}
            <div className="space-y-1 pt-1">
              <label className="block text-[9px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                {currentLanguage === 'sl' ? 'Izberi iz ekipe (avtomatsko dvosmerno povezovanje):' : 'Select from team roster (auto two-way link):'}
              </label>
              <select
                value=""
                onChange={(e) => {
                  const selected = e.target.value;
                  if (selected && !newFamilyList.includes(selected)) {
                    setNewFamilyList([...newFamilyList, selected]);
                  }
                }}
                className="w-full text-xs px-2.5 py-2 bg-white border border-emerald-200 rounded-lg text-emerald-950 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="" disabled>
                  {currentLanguage === 'sl' ? '➕ Izberi sodelavca (zakonca / družino)...' : '➕ Select team volunteer (spouse / family)...'}
                </option>
                {people
                  .filter(p => p && p.name && p.name !== newPersonName.trim() && !newFamilyList.includes(p.name))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map(p => (
                    <option key={p.id || p.name} value={p.name}>
                      👤 {p.name} {p.email ? `(${p.email})` : ''}
                    </option>
                  ))
                }
              </select>
            </div>

            {/* 2. Custom Text Input for Unregistered Family / Children */}
            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                placeholder={currentLanguage === 'sl' ? 'Ali vpiši po meri (otroci)...' : 'Or type custom name (children)...'}
                value={newFamilyMemberText}
                onChange={(e) => setNewFamilyMemberText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (newFamilyMemberText.trim() && !newFamilyList.includes(newFamilyMemberText.trim())) {
                      setNewFamilyList([...newFamilyList, newFamilyMemberText.trim()]);
                      setNewFamilyMemberText('');
                    }
                  }
                }}
                className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
              />
              <button
                type="button"
                onClick={() => {
                  if (newFamilyMemberText.trim() && !newFamilyList.includes(newFamilyMemberText.trim())) {
                    setNewFamilyList([...newFamilyList, newFamilyMemberText.trim()]);
                    setNewFamilyMemberText('');
                  }
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer shrink-0"
              >
                + {currentLanguage === 'sl' ? 'Dodaj' : 'Add'}
              </button>
            </div>
          </div>

          {/* Unified 6-Category Grid for Ministries & Leadership */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                📅 {currentLanguage === 'sl' ? 'Nedeljske Službe & Področja Vodenja' : 'Sunday Ministries & Leadership'}
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                {currentLanguage === 'sl' ? 'Izberite službe (kljukica) in vodje (gumb 👑 Vodja)' : 'Select serving (check) and leadership (👑 Leader)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                { key: 'cleaning', labelSl: '🧹 Čistoča & Priprava prostora', labelEn: '🧹 Cleaning & Space Setup' },
                { key: 'hospitality', labelSl: '☕ Gostoljubje & Kavarna', labelEn: '☕ Hospitality & Café' },
                { key: 'sermon_prayer', labelSl: '📖 Bogoslužje', labelEn: '📖 Main Service' },
                { key: 'worship', labelSl: '🎵 Slavljenje', labelEn: '🎵 Worship' },
                { key: 'audio_video', labelSl: '🎥 Avdio Video', labelEn: '🎥 Audio Video' },
                { key: 'kids', labelSl: '👶 KCK Otroci / Nedeljska šola', labelEn: '👶 KCK Kids / Sunday School' },
                { key: 'post_service', labelSl: '🤝 Po bogoslužju', labelEn: '🤝 Post-Service' },
              ].map(cat => {
                const catMinistries = ministries.filter(m => 
                  m.category === cat.key || 
                  (cat.key === 'post_service' && m.category === 'other') ||
                  (cat.key === 'worship' && m.category === 'av_tech' && (m.id === 'slavilna_ekipa' || m.id === 'uvod_slavljenje' || m.id === 'zvok')) ||
                  (cat.key === 'audio_video' && m.category === 'av_tech' && (m.id !== 'slavilna_ekipa' && m.id !== 'uvod_slavljenje' && m.id !== 'zvok'))
                );
                if (catMinistries.length === 0) return null;

                return (
                  <div key={cat.key} className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2">
                    <div className="text-[11px] font-bold text-slate-800 uppercase tracking-tight font-display pb-1 border-b border-slate-200/80">
                      {currentLanguage === 'sl' ? cat.labelSl : cat.labelEn}
                    </div>
                    <div className="space-y-1.5 pt-0.5">
                      {catMinistries.map(m => {
                        const isServing = selectedPrefs.includes(m.id);
                        const isLed = selectedLedMinistries.includes(m.id);

                        const toggleServing = () => {
                          if (isServing) {
                            setSelectedPrefs(selectedPrefs.filter(id => id !== m.id));
                            setSelectedLedMinistries(selectedLedMinistries.filter(id => id !== m.id));
                          } else {
                            setSelectedPrefs([...selectedPrefs, m.id]);
                          }
                        };

                        const toggleLeading = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          if (isLed) {
                            setSelectedLedMinistries(selectedLedMinistries.filter(id => id !== m.id));
                          } else {
                            setSelectedLedMinistries([...selectedLedMinistries, m.id]);
                            if (!selectedPrefs.includes(m.id)) {
                              setSelectedPrefs([...selectedPrefs, m.id]);
                            }
                          }
                        };

                        return (
                          <div
                            key={m.id}
                            className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg border transition-all select-none ${
                              isServing
                                ? isLed
                                      ? 'bg-amber-50/80 border-amber-300 text-slate-900 shadow-2xs font-semibold'
                                      : 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-medium'
                                : 'bg-white border-slate-200 hover:bg-slate-100/60 text-slate-700'
                            }`}
                          >
                            <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isServing}
                                onChange={toggleServing}
                                className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 shrink-0 cursor-pointer"
                              />
                              <span className="text-xs truncate">
                                {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                              </span>
                            </label>

                            <button
                              type="button"
                              onClick={toggleLeading}
                              title={
                                isLed
                                  ? (currentLanguage === 'sl' ? 'Oseba je vodja te službe (kliknite za preklic)' : 'Leader of this ministry (click to revoke)')
                                  : (currentLanguage === 'sl' ? 'Označi osebo kot vodjo te službe' : 'Mark as leader of this ministry')
                              }
                              className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0 ml-1.5 ${
                                isLed
                                  ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-2xs'
                                  : 'bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-900 border border-slate-200'
                              }`}
                            >
                              <Crown className={`w-3 h-3 ${isLed ? 'text-slate-950 fill-slate-950' : 'text-slate-400'}`} />
                              <span>{isLed ? (currentLanguage === 'sl' ? 'Vodja' : 'Leader') : (currentLanguage === 'sl' ? 'Vodja' : 'Lead')}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-3 rounded-xl transition focus:outline-none font-bold shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <Plus className="w-4 h-4" />
            <span>{currentLanguage === 'sl' ? 'Dodaj Sodelavca in Shrani' : 'Assign & Save Volunteer'}</span>
          </button>
        </form>
      )}

      {/* Category Tabs: Active Servants vs Church Members vs Youth & Children vs Visitors */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-200/80 pb-2">
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
              showAddForm
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
            }`}
          >
            <Plus className={`w-4 h-4 transition-transform ${showAddForm ? 'rotate-45' : ''}`} />
            <span>{showAddForm ? (currentLanguage === 'sl' ? 'Zapri obrazec' : 'Close Form') : (currentLanguage === 'sl' ? 'Dodaj osebo' : 'Add Person')}</span>
          </button>
        )}

        {/* Tab 0: All People */}
        <button
          type="button"
          onClick={() => setActivePeopleTab('all')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activePeopleTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5 text-indigo-500" />
          <span>{currentLanguage === 'sl' ? 'Vsi' : 'All'}</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${activePeopleTab === 'all' ? 'bg-indigo-500/40 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
            {allPeopleCount}
          </span>
        </button>

        {/* Tab 1: Active Servants */}
        <button
          type="button"
          onClick={() => setActivePeopleTab('active')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activePeopleTab === 'active'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>{currentLanguage === 'sl' ? 'Aktivni sodelavci' : 'Active Servants'}</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${activePeopleTab === 'active' ? 'bg-indigo-500/40 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
            {activeServantsCount}
          </span>
        </button>

        {/* Tab 2: Church Members */}
        <button
          type="button"
          onClick={() => setActivePeopleTab('members')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activePeopleTab === 'members'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-sky-600" />
          <span>{currentLanguage === 'sl' ? 'Člani cerkve' : 'Members'}</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${activePeopleTab === 'members' ? 'bg-sky-500/40 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
            {churchMembersCount}
          </span>
        </button>

        {/* Tab 3: Youth & Children */}
        <button
          type="button"
          onClick={() => setActivePeopleTab('youth')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activePeopleTab === 'youth'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
          <span>{currentLanguage === 'sl' ? 'Mladina & Otroci' : 'Youth & Children'}</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${activePeopleTab === 'youth' ? 'bg-emerald-500/40 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
            {youthAndChildrenCount}
          </span>
        </button>

        {/* Tab 4: Visitors */}
        <button
          type="button"
          onClick={() => setActivePeopleTab('visitors')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activePeopleTab === 'visitors'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Footprints className="w-3.5 h-3.5 text-amber-600" />
          <span>{currentLanguage === 'sl' ? 'Obiskovalci' : 'Visitors'}</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${activePeopleTab === 'visitors' ? 'bg-amber-500/40 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
            {visitorsCount}
          </span>
        </button>
      </div>

      {/* Roster database filter search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={translations.searchPerson}
          className="w-full text-xs pl-10 pr-3 py-3 bg-white border border-gray-250 rounded-xl focus:outline-none focus:border-gray-400 font-sans shadow-[0_2px_4px_rgba(0,0,0,0.01)] text-gray-900 placeholder-gray-400"
        />
      </div>

      {/* Roster Card Renderer */}
      {(() => {
        const renderPersonCard = (person: Person, isMyCard = false, cardIdx = 0) => {
          if (!person || !person.name) return null;
          const personNameStr = person.name || 'Neznano';
          const displayPersonName = getPrivacyDisplayName(person, userRole, myPersonCard?.name, authUser?.email, authUser?.id || authUser?.uid, people);
          const firstChar = displayPersonName[0] || personNameStr[0] || '?';
          const chosenCount = person.preferredMinistries ? person.preferredMinistries.length : 0;
          const servingCount = calculateServingCount(personNameStr);
          const attStats = calculateAttendanceStats(personNameStr);
          const burnoutStatus = calculatePersonBurnoutStatus(personNameStr, sundays, people);

          const uniqueKey = person.id ? `${person.id}-${cardIdx}` : `${personNameStr}-${cardIdx}`;

          return (
            <div
              key={uniqueKey}
              id={`person-card-${person.id || personNameStr}`}
              className={`bg-white rounded-xl p-4 shadow-[0_2px_4px_rgba(0,0,0,0.01)] border flex flex-col justify-between h-full relative transition-colors ${
                isMyCard
                  ? 'border-indigo-500 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 ring-2 ring-indigo-300 shadow-md'
                  : person.isArchived ? 'border-amber-250/80 bg-amber-50/20' : 'border-gray-200 hover:border-indigo-200'
              }`}
            >
              {/* Top Header: Avatar + Name + Role + Actions */}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  {person.avatarUrl ? (
                    <img
                      src={person.avatarUrl}
                      alt={displayPersonName}
                      className="w-8 h-8 rounded-full object-cover border border-indigo-200 shrink-0 shadow-xs select-none"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4338CA] text-xs font-bold font-mono flex items-center justify-center border border-indigo-100 shrink-0 select-none">
                      {firstChar}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-gray-950 text-sm truncate leading-tight flex items-center gap-1.5 flex-wrap">
                      <span>{displayPersonName}</span>
                      {isMyCard && (
                        <span className="text-[9px] bg-indigo-600 text-white font-mono font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shadow-2xs">
                          ⭐ {currentLanguage === 'sl' ? 'Vi (Prijavljeni)' : 'You (Logged-in)'}
                        </span>
                      )}
                      {person.isArchived && (
                        <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold px-1.5 py-0.2 rounded">
                          📦 {currentLanguage === 'sl' ? 'Arhivirano' : 'Archived'}
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className={`inline-block text-[8px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded border ${
                        person.role === 'Admin'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : person.role === 'Leader'
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : person.role === 'Servant'
                          ? 'bg-sky-50 text-sky-700 border-sky-200'
                          : person.role === 'Visitor'
                          ? 'bg-teal-50 text-teal-700 border-teal-200'
                          : person.role === 'Minor'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {person.role === 'Admin' 
                          ? '🛠️ Admin' 
                          : person.role === 'Leader' 
                          ? '📋 Vodja' 
                          : person.role === 'Servant' 
                          ? '🤝 Služabnik' 
                          : person.role === 'Visitor'
                          ? '👋 Obiskovalec'
                          : person.role === 'Minor'
                          ? '👶 Mladoletni'
                          : '👤 Član'}
                      </span>
                    </div>
                  </div>
                </div>

                {canEditPerson(person) && (
                  <div className="flex items-center gap-0.5 shrink-0 -mr-1 -mt-0.5">
                    {onUpdatePerson && (
                      <button
                        onClick={() => startEditPerson(person)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition active:scale-95 focus:outline-none cursor-pointer"
                        title={currentLanguage === 'sl' ? 'Uredi sodelavca' : 'Edit member'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {onUpdatePerson && (
                      person.isArchived ? (
                        <button
                          onClick={() => onUpdatePerson(person.id, { ...person, isArchived: false })}
                          className="p-1.5 text-amber-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition active:scale-95 focus:outline-none cursor-pointer"
                          title={currentLanguage === 'sl' ? 'Obnovi iz arhiva v aktivne' : 'Restore from archive to active'}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => onUpdatePerson(person.id, { ...person, isArchived: true })}
                          className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition active:scale-95 focus:outline-none cursor-pointer"
                          title={currentLanguage === 'sl' ? 'Arhiviraj sodelavca' : 'Archive member'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                    {isAdmin && onDeletePerson && person.role !== 'Admin' && person.name !== 'Aleš Lajlar' && (
                      <button
                        onClick={() => setPersonToDelete(person)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition active:scale-95 focus:outline-none cursor-pointer"
                        title={currentLanguage === 'sl' ? 'Trajno izbriši sodelavca' : 'Permanently delete member'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Main Info Body: Phone, Email, Burnout Indicator, Preferred Ministries */}
              <div className="py-2.5 space-y-2.5 flex-1">
                {/* Phone & Email Row */}
                {(() => {
                  const isContactVisible = canViewPersonContactInfo(
                    userRole, 
                    myPersonCard?.name, 
                    person, 
                    authUser?.email, 
                    authUser?.id || authUser?.uid
                  );

                  if (!isContactVisible) {
                    return (
                      <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{currentLanguage === 'sl' ? 'Kontaktni podatki zaščiteni' : 'Contact info protected'}</span>
                        </span>
                        <span className="text-[9px] text-slate-400 font-sans">
                          {currentLanguage === 'sl' ? '(Samo za vodje)' : '(Leaders & Admins)'}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1 text-xs font-mono">
                      {person.phone ? (
                        <div className="flex items-center justify-between">
                          <a
                            href={`tel:${person.phone.replace(/\s+/g, '')}`}
                            className="text-slate-800 hover:text-indigo-600 font-semibold flex items-center gap-1.5 group cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition" />
                            <span>{person.phone}</span>
                          </a>
                          <div className="flex items-center gap-1">
                            <a
                              href={`https://wa.me/${person.phone.replace(/[^0-9]/g, '').replace(/^0/, '386')}?text=${encodeURIComponent(`Živjo ${personNameStr}! 👋`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition cursor-pointer"
                              title={currentLanguage === 'sl' ? 'Odpri v WhatsApp' : 'Open WhatsApp'}
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </a>
                            <button
                              type="button"
                              onClick={() => setReminderModalPerson(person)}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition cursor-pointer"
                              title={currentLanguage === 'sl' ? 'Hitri opomnik za službo' : 'Duty reminder'}
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block">
                          {currentLanguage === 'sl' ? 'Brez telefona' : 'No phone'}
                        </span>
                      )}

                      {person.email ? (
                        <a
                          href={`mailto:${person.email}`}
                          className="text-[11px] text-slate-600 hover:text-indigo-600 truncate flex items-center gap-1.5 group cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5 text-indigo-500 shrink-0 group-hover:scale-110 transition" />
                          <span className="truncate">{person.email}</span>
                        </a>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic block">
                          {currentLanguage === 'sl' ? 'Brez e-pošte' : 'No email'}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Serving Burnout Indicator */}
                <div className={`p-2 rounded-xl border text-[10px] font-mono flex items-center justify-between gap-2 ${burnoutStatus.colorClass}`}>
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>{burnoutStatus.badge}</span>
                    <span>{currentLanguage === 'sl' ? burnoutStatus.labelSl : burnoutStatus.labelEn}</span>
                  </div>
                  {burnoutStatus.status === 'overloaded' && (
                    <span className="text-[9px] bg-rose-200 text-rose-900 px-1.5 py-0.5 rounded font-extrabold animate-pulse">
                      ⚡ 3+ zapored
                    </span>
                  )}
                </div>

                {/* Led Ministries Section */}
                {person.ledMinistries && person.ledMinistries.length > 0 && (() => {
                  const ledList = person.ledMinistries || [];
                  const isExpanded = Boolean(expandedCards[`${person.id}_led`]);
                  const visibleLed = isExpanded ? ledList : ledList.slice(0, 4);
                  const remainingCount = ledList.length - 4;

                  return (
                    <div className="p-2 bg-indigo-50/60 border border-indigo-150/70 rounded-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                          👑 {currentLanguage === 'sl' ? 'Vodi službe' : 'Led Ministries'} ({ledList.length}):
                        </span>
                        {ledList.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setExpandedCards(prev => ({ ...prev, [`${person.id}_led`]: !prev[`${person.id}_led`] }))}
                            className="text-[9px] font-mono font-bold text-indigo-700 hover:text-indigo-950 hover:underline cursor-pointer"
                          >
                            {isExpanded ? (currentLanguage === 'sl' ? '▲ Skrij' : '▲ Show less') : `+${remainingCount} (Prikaži vse)`}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {visibleLed.map((mId) => {
                          const foundMin = ministries.find((m) => m.id === mId);
                          return foundMin ? (
                            <span
                              key={mId}
                              className="bg-indigo-600 text-white font-mono text-[9px] font-bold tracking-tight px-1.5 py-0.5 rounded shadow-2xs"
                            >
                              ★ {currentLanguage === 'sl' ? foundMin.nameSl : foundMin.nameEn}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Preferred Ministries Section */}
                {(() => {
                  const prefList = person.preferredMinistries || [];
                  const isExpanded = Boolean(expandedCards[`${person.id}_pref`]);
                  const visiblePrefs = isExpanded ? prefList : prefList.slice(0, 4);
                  const remainingCount = prefList.length - 4;

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-wider block">
                          {currentLanguage === 'sl' ? 'Željene službe' : 'Preferred Ministries'} ({chosenCount}):
                        </span>
                        {prefList.length > 4 && (
                          <button
                            type="button"
                            onClick={() => setExpandedCards(prev => ({ ...prev, [`${person.id}_pref`]: !prev[`${person.id}_pref`] }))}
                            className="text-[9px] font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                          >
                            {isExpanded ? (currentLanguage === 'sl' ? '▲ Skrij' : '▲ Show less') : `+${remainingCount} (Prikaži vse)`}
                          </button>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {prefList.length > 0 ? (
                          visiblePrefs.map((prefId) => {
                            const foundMin = ministries.find((m) => m.id === prefId);
                            return foundMin ? (
                              <span
                                key={prefId}
                                className="bg-gray-50 text-gray-700 font-mono text-[9px] font-bold tracking-tight border border-gray-200 px-1.5 py-0.5 rounded"
                              >
                                ★ {currentLanguage === 'sl' ? foundMin.nameSl : foundMin.nameEn}
                              </span>
                            ) : null;
                          })
                        ) : (
                          <span className="text-[9px] text-gray-400 italic font-mono">
                            {currentLanguage === 'sl' ? 'Ni izbranih služb' : 'No preferences set'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {person.familyMembers && person.familyMembers.length > 0 && (
                  <div>
                    <div className="text-[9px] font-mono text-emerald-800 bg-emerald-50/70 border border-emerald-200 px-2 py-1 rounded-md inline-flex items-center gap-1">
                      <span>👨‍👩‍👧 Družina:</span>
                      <span className="font-semibold">{person.familyMembers.join(', ')}</span>
                    </div>
                  </div>
                )}

                {/* Attendance Rate Badge */}
                {attStats.totalAssigned > 0 && (
                  <div>
                    <div className="text-[9px] font-mono text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md inline-flex items-center gap-1.5 font-medium">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      <span>
                        {currentLanguage === 'sl' ? 'Prisotnost:' : 'Attendance:'} <strong>{attStats.rate}%</strong> ({attStats.presentCount}/{attStats.totalAssigned})
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer: Summary Counts */}
              <div className="pt-2.5 border-t border-gray-150 flex items-center justify-between text-[10px] font-mono text-gray-500 mt-auto">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400 uppercase font-bold text-[9px]">
                    {currentLanguage === 'sl' ? 'Izbranih' : 'Chosen'}:
                  </span>
                  <span className={`font-bold px-1.5 py-0.5 rounded border ${
                    chosenCount > 0 
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                      : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>
                    {chosenCount} {currentLanguage === 'sl' ? 'služb' : (chosenCount === 1 ? 'roster' : 'rosters')}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {servingCount > 0 ? (
                    <span className={`font-bold px-1.5 py-0.5 rounded border ${
                      burnoutStatus.status === 'overloaded' 
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : burnoutStatus.status === 'exempt'
                        ? 'bg-purple-100 text-purple-900 border-purple-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {currentLanguage === 'sl' ? `${servingCount} na urniku` : `${servingCount} scheduled`}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic text-[9px]">
                      {currentLanguage === 'sl' ? 'Brez zadolžitev' : 'No duties'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        };

        const renderMyProfileCard = (person: Person) => {
          if (!person || !person.name) return null;
          const personNameStr = person.name || 'Neznano';
          const firstChar = personNameStr[0] || '?';
          const chosenCount = person.preferredMinistries ? person.preferredMinistries.length : 0;
          const servingCount = calculateServingCount(personNameStr);
          const attStats = calculateAttendanceStats(personNameStr);
          const burnoutStatus = calculatePersonBurnoutStatus(personNameStr, sundays, people);
          const ledList = person.ledMinistries || [];
          const prefList = person.preferredMinistries || [];

          return (
            <div
              key={`my-profile-${person.id || personNameStr}`}
              id={`person-card-${person.id || personNameStr}`}
              className="bg-white rounded-2xl p-4 sm:p-6 shadow-md border-2 border-indigo-500 bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 relative font-sans transition-all"
            >
              {/* PC / Desktop Split Layout (stacks vertically on mobile, 2-column side-by-side on md/lg) */}
              <div className="flex flex-col md:flex-row gap-6">
                
                {/* Left Column: Avatar, Profile Info, Contacts, Stats & Badges */}
                <div className="w-full md:w-5/12 lg:w-4/12 space-y-4 shrink-0 border-b md:border-b-0 md:border-r border-indigo-150 pb-4 md:pb-0 md:pr-6">
                  
                  {/* Header: Avatar + Name + Badges + Edit/Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {person.avatarUrl ? (
                        <img
                          src={person.avatarUrl}
                          alt={personNameStr}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-indigo-300 shadow-xs shrink-0 select-none"
                        />
                      ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-indigo-600 text-white text-base font-bold font-mono flex items-center justify-center border-2 border-indigo-300 shrink-0 shadow-xs select-none">
                          {firstChar}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-slate-950 text-base sm:text-lg truncate leading-tight flex items-center gap-1.5 flex-wrap">
                          <span>{personNameStr}</span>
                          <span className="text-[9px] bg-indigo-600 text-white font-mono font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 shadow-2xs">
                            ⭐ {currentLanguage === 'sl' ? 'Vi (Prijavljeni)' : 'You (Logged-in)'}
                          </span>
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`inline-block text-[9px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded border ${
                            person.role === 'Admin'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : person.role === 'Leader'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : person.role === 'Servant'
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : person.role === 'Visitor'
                              ? 'bg-teal-50 text-teal-700 border-teal-200'
                              : person.role === 'Minor'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {person.role === 'Admin' 
                              ? '🛠️ Admin' 
                              : person.role === 'Leader' 
                              ? '📋 Vodja' 
                              : person.role === 'Servant' 
                              ? '🤝 Služabnik' 
                              : person.role === 'Visitor'
                              ? '👋 Obiskovalec'
                              : person.role === 'Minor'
                              ? '👶 Mladoletni'
                              : '👤 Član'}
                          </span>

                          {person.isPastorOrStaff && (
                            <span className="text-[9px] font-mono bg-purple-100 text-purple-900 border border-purple-300 font-bold px-1.5 py-0.5 rounded-md">
                              ✝️ {currentLanguage === 'sl' ? 'Pastor / Zaposleni' : 'Full-time Staff'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {onUpdatePerson && (
                      <button
                        onClick={() => startEditPerson(person)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded-xl transition active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5 font-bold text-xs shadow-2xs"
                        title={currentLanguage === 'sl' ? 'Uredi moj profil' : 'Edit my profile'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{currentLanguage === 'sl' ? 'Uredi profil' : 'Edit profile'}</span>
                      </button>
                    )}
                  </div>

                  {/* Contact Details (Phone, WhatsApp, Reminder, Email) */}
                  {(() => {
                    const isContactVisible = canViewPersonContactInfo(
                      userRole, 
                      myPersonCard?.name, 
                      person, 
                      authUser?.email, 
                      authUser?.id || authUser?.uid
                    );

                    if (!isContactVisible) {
                      return (
                        <div className="p-3 bg-white/90 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs text-slate-500 font-mono">
                          <span className="flex items-center gap-1.5 font-medium">
                            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>{currentLanguage === 'sl' ? 'Kontaktni podatki zaščiteni' : 'Contact info protected'}</span>
                          </span>
                          <span className="text-[10px] text-slate-400 font-sans">
                            {currentLanguage === 'sl' ? '(Samo za vodje)' : '(Leaders & Admins)'}
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div className="p-3 bg-white/90 border border-indigo-150 rounded-xl space-y-2 text-xs font-mono">
                        {person.phone ? (
                          <div className="flex items-center justify-between">
                            <a
                              href={`tel:${person.phone.replace(/\s+/g, '')}`}
                              className="text-slate-800 hover:text-indigo-600 font-bold flex items-center gap-2 group cursor-pointer"
                            >
                              <Phone className="w-4 h-4 text-emerald-600 shrink-0 group-hover:scale-110 transition" />
                              <span>{person.phone}</span>
                            </a>
                            <div className="flex items-center gap-1">
                              <a
                                href={`https://wa.me/${person.phone.replace(/[^0-9]/g, '').replace(/^0/, '386')}?text=${encodeURIComponent(`Živjo ${personNameStr}! 👋`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                                title={currentLanguage === 'sl' ? 'Odpri v WhatsApp' : 'Open WhatsApp'}
                              >
                                <MessageSquare className="w-4 h-4" />
                              </a>
                              <button
                                type="button"
                                onClick={() => setReminderModalPerson(person)}
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                                title={currentLanguage === 'sl' ? 'Hitri opomnik za službo' : 'Duty reminder'}
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic block">
                            {currentLanguage === 'sl' ? 'Brez telefona' : 'No phone'}
                          </span>
                        )}

                        {person.email ? (
                          <a
                            href={`mailto:${person.email}`}
                            className="text-xs text-slate-700 hover:text-indigo-600 truncate flex items-center gap-2 group cursor-pointer font-medium"
                          >
                            <Mail className="w-4 h-4 text-indigo-500 shrink-0 group-hover:scale-110 transition" />
                            <span className="truncate">{person.email}</span>
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic block">
                            {currentLanguage === 'sl' ? 'Brez e-pošte' : 'No email'}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {/* Burnout & Attendance Stats */}
                  <div className="space-y-2">
                    <div className={`p-2.5 rounded-xl border text-xs font-mono flex items-center justify-between gap-2 ${burnoutStatus.colorClass}`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        <span>{burnoutStatus.badge}</span>
                        <span>{currentLanguage === 'sl' ? burnoutStatus.labelSl : burnoutStatus.labelEn}</span>
                      </div>
                      {burnoutStatus.status === 'overloaded' && (
                        <span className="text-[10px] bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full font-extrabold animate-pulse">
                          ⚡ 3+ zapored
                        </span>
                      )}
                    </div>

                    {attStats.totalAssigned > 0 && (
                      <div className="text-xs font-mono text-emerald-950 bg-emerald-50 border border-emerald-250 p-2.5 rounded-xl flex items-center gap-2 font-medium">
                        <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          {currentLanguage === 'sl' ? 'Prisotnost:' : 'Attendance:'} <strong>{attStats.rate}%</strong> ({attStats.presentCount}/{attStats.totalAssigned})
                        </span>
                      </div>
                    )}

                    {person.familyMembers && person.familyMembers.length > 0 && (
                      <div className="text-xs font-mono text-emerald-900 bg-emerald-50/80 border border-emerald-250 p-2.5 rounded-xl flex items-center gap-2">
                        <span>👨‍👩‍👧 Družina:</span>
                        <span className="font-bold">{person.familyMembers.join(', ')}</span>
                      </div>
                    )}
                  </div>

                </div>

                {/* Right Column: Full Unfolded Showcase of All Led & Preferred Ministries */}
                <div className="w-full md:w-7/12 lg:w-8/12 space-y-4 flex flex-col justify-between">
                  
                  <div className="space-y-4">
                    {/* Led Ministries Block */}
                    <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                          👑 {currentLanguage === 'sl' ? 'Vodi službe' : 'Led Ministries'} ({ledList.length}):
                        </span>
                      </div>
                      {ledList.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {ledList.map((mId) => {
                            const foundMin = ministries.find((m) => m.id === mId);
                            return foundMin ? (
                              <span
                                key={mId}
                                className="bg-indigo-600 text-white font-mono text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-2xs flex items-center gap-1"
                              >
                                ★ {currentLanguage === 'sl' ? foundMin.nameSl : foundMin.nameEn}
                              </span>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-indigo-400 italic font-mono block">
                          {currentLanguage === 'sl' ? 'Trenutno ne vodi nobene službe.' : 'Not leading any ministry currently.'}
                        </span>
                      )}
                    </div>

                    {/* Preferred Ministries Block */}
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-slate-800 uppercase tracking-wider block">
                          {currentLanguage === 'sl' ? 'Željene službe' : 'Preferred Ministries'} ({prefList.length}):
                        </span>
                      </div>
                      {prefList.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {prefList.map((prefId) => {
                            const foundMin = ministries.find((m) => m.id === prefId);
                            return foundMin ? (
                              <span
                                key={prefId}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-mono text-xs font-bold border border-slate-300 px-2.5 py-1.5 rounded-lg transition"
                              >
                                ★ {currentLanguage === 'sl' ? foundMin.nameSl : foundMin.nameEn}
                              </span>
                            ) : null;
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic font-mono block">
                          {currentLanguage === 'sl' ? 'Ni izbranih želenih služb.' : 'No preferences set.'}
                        </span>
                      )}
                    </div>

                    {/* Notification Center & Communication Channels Block */}
                    <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3 font-sans">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-indigo-600 shrink-0" />
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                              {currentLanguage === 'sl' ? 'Obveščanje in Google Povezava' : 'Notifications & Google Auth'}
                            </h4>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {currentLanguage === 'sl' ? 'Nastavitve obvestil in sinhronizacija' : 'Notification channels & sync'}
                            </p>
                          </div>
                        </div>

                        {googleToken ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                              ✓ Google {currentLanguage === 'sl' ? 'Povezan' : 'Connected'}
                            </span>
                            <button
                              type="button"
                              onClick={() => onSetGoogleToken && onSetGoogleToken(null)}
                              className="text-[10px] text-rose-600 hover:underline font-mono cursor-pointer"
                            >
                              {currentLanguage === 'sl' ? 'Odjavi' : 'Disconnect'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleConnectGoogle}
                            disabled={isConnectingGoogle}
                            className="text-[11px] bg-white hover:bg-slate-50 border border-slate-300 font-bold px-2.5 py-1 rounded-lg text-slate-800 flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                          >
                            {isConnectingGoogle ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                            ) : (
                              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                              </svg>
                            )}
                            <span>{currentLanguage === 'sl' ? 'Poveži Google' : 'Connect Google'}</span>
                          </button>
                        )}
                      </div>

                      {/* Supported Communication Channels */}
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-mono">
                        <span className="bg-white border border-indigo-200 text-indigo-900 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                          📅 Google Koledar
                        </span>
                        <span className="bg-white border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                          💬 Google Chat
                        </span>
                        <span className="bg-white border border-sky-200 text-sky-900 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                          ✉️ E-pošta
                        </span>
                        <span className="bg-white border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md flex items-center gap-1 font-semibold">
                          📱 WhatsApp
                        </span>
                      </div>

                      {onOpenNotificationModal && (
                        <button
                          type="button"
                          onClick={onOpenNotificationModal}
                          className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-xl transition cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>{currentLanguage === 'sl' ? 'Odpri Center za Obveščanje' : 'Open Notification Center'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Serving & Duty Summary Footer */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs font-mono text-slate-600 mt-auto">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 uppercase font-bold text-[10px]">
                        {currentLanguage === 'sl' ? 'Skupaj izbranih' : 'Total Chosen'}:
                      </span>
                      <span className="font-bold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md border border-indigo-200">
                        {chosenCount} {currentLanguage === 'sl' ? 'služb' : (chosenCount === 1 ? 'roster' : 'rosters')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {servingCount > 0 ? (
                        <span className="font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-md">
                          {currentLanguage === 'sl' ? `${servingCount} na urniku` : `${servingCount} scheduled`}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-xs">
                          {currentLanguage === 'sl' ? 'Brez trenutnih zadolžitev' : 'No current duties'}
                        </span>
                      )}
                    </div>
                  </div>

                </div>

              </div>
            </div>
          );
        };

        return (
          <div id="people-database-list" className="space-y-6">
            {/* Pinned Logged-in User Card Section (Active & All tabs) */}
            {myPersonCard && (!searchQuery || myPersonCard.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) && (activePeopleTab === 'active' || activePeopleTab === 'all') && (
              <div className="space-y-3 pb-3 border-b border-indigo-200/80">
                <div className="flex items-center gap-2 pb-1">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs">
                    ⭐
                  </div>
                  <h3 className="font-display font-bold text-xs sm:text-sm text-indigo-950 uppercase tracking-wider">
                    {currentLanguage === 'sl' ? 'Moj Profil (Vaša kartica)' : 'My Profile (Your Card)'}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                    {currentLanguage === 'sl' ? 'Prijavljeni sodelavec' : 'Active Account'}
                  </span>
                </div>

                <div className="w-full">
                  {renderMyProfileCard(myPersonCard)}
                </div>
              </div>
            )}

            {/* TAB 0: ALL PEOPLE */}
            {activePeopleTab === 'all' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-200/80">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                      👥
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-xs sm:text-sm text-indigo-950 uppercase tracking-wider">
                        {currentLanguage === 'sl' ? 'Vsi sodelavci in člani v bazi' : 'All People in Database'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {currentLanguage === 'sl' ? 'Celoten seznam vseh oseb (sodelavci, člani, mladina, otroci in obiskovalci)' : 'Complete directory of all registered individuals'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                    {filteredPeople.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredPeople
                    .slice()
                    .sort((a, b) => (a.name || '').localeCompare(b.name || '', currentLanguage === 'sl' ? 'sl' : 'en'))
                    .map((p, idx) => renderPersonCard(p, false, idx))}
                </div>
              </div>
            )}

            {/* TAB 1: ACTIVE SERVANTS */}
            {activePeopleTab === 'active' && (
              <>
                {/* Group 1: Leaders & Administrators (Alphabetical) */}
                {leadersAndAdmins.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-indigo-200/80">
                      <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                        👑
                      </div>
                      <h3 className="font-display font-bold text-xs sm:text-sm text-indigo-950 uppercase tracking-wider">
                        {currentLanguage === 'sl' ? 'Vodstvo in Administratorji' : 'Leaders & Administrators'}
                      </h3>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                        {leadersAndAdmins.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {leadersAndAdmins.map((p, idx) => renderPersonCard(p, false, idx))}
                    </div>
                  </div>
                )}

                {/* Group 2: Servants & Volunteers (Alphabetical) */}
                {servants.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 pb-2 border-b border-emerald-200/80">
                      <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                        👤
                      </div>
                      <h3 className="font-display font-bold text-xs sm:text-sm text-emerald-950 uppercase tracking-wider">
                        {currentLanguage === 'sl' ? 'Služabniki in Sodelavci' : 'Servants & Team Members'}
                      </h3>
                      <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                        {servants.length}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {servants.map((p, idx) => renderPersonCard(p, false, idx))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* TAB 2: CHURCH MEMBERS */}
            {activePeopleTab === 'members' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-sky-200/80">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-xs">
                      🏛️
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-xs sm:text-sm text-sky-950 uppercase tracking-wider">
                        {currentLanguage === 'sl' ? 'Člani Cerkvene Skupnosti' : 'Church Community Members'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {currentLanguage === 'sl' ? 'Polnoletni člani cerkve KC Kalvarija (kontakti, družinske povezave ter informacije)' : 'Adult congregation members (contacts and family links)'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-sky-100 text-sky-800 rounded-full border border-sky-200">
                    {filteredPeople.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredPeople.map((p, idx) => renderPersonCard(p, false, idx))}
                </div>
              </div>
            )}

            {/* TAB 3: YOUTH & CHILDREN */}
            {activePeopleTab === 'youth' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/80">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                      👶
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-xs sm:text-sm text-emerald-950 uppercase tracking-wider">
                        {currentLanguage === 'sl' ? 'Mladina in Otroci' : 'Youth & Children'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {currentLanguage === 'sl' ? 'Otroci in mladostniki cerkve KC Kalvarija (Nedeljska šola & družinske povezave)' : 'Kids and youth of KC Kalvarija (Sunday school & family links)'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    {filteredPeople.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredPeople.map((p, idx) => renderPersonCard(p, false, idx))}
                </div>
              </div>
            )}

            {/* TAB 4: VISITORS */}
            {activePeopleTab === 'visitors' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-amber-200/80">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                      🌿
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-xs sm:text-sm text-amber-950 uppercase tracking-wider">
                        {currentLanguage === 'sl' ? 'Obiskovalci & Neaktivni' : 'Visitors & Inactive'}
                      </h3>
                      <p className="text-[11px] text-slate-500 font-sans">
                        {currentLanguage === 'sl' ? 'Obiskovalci, občasni gostje ter tisti, ki so trenutno neaktivni ali so izstopili' : 'Visitors, guests, and stepped-out or inactive profiles'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full border border-amber-200">
                    {filteredPeople.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredPeople.map((p, idx) => renderPersonCard(p, false, idx))}
                </div>
              </div>
            )}

            {/* Empty Search Result Fallback */}
            {filteredPeople.length === 0 && (
              <div className="py-12 text-center bg-white rounded-2xl border border-gray-200 p-6 space-y-2">
                <Search className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm font-semibold text-gray-700">
                  {currentLanguage === 'sl' ? 'Ni najdenih oseb v tej kategoriji' : 'No people found in this category'}
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  {currentLanguage === 'sl' ? 'Poskusite spremeniti iskalni niz ali izberite drug zavihek.' : 'Try adjusting your search query or pick another tab.'}
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* EDIT PERSON MODAL */}
      {editingPerson && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in"
        >
          <form 
            onSubmit={handleSaveEditPerson}
            className="bg-white rounded-2xl max-w-4xl w-full h-[90vh] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 animate-scale-up"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-150 bg-slate-50/90 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-200">
                  <Pencil className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-gray-900 text-sm">
                    {currentLanguage === 'sl' ? 'Uredi sodelavca' : 'Edit Member'}
                  </h3>
                  <p className="text-[10px] text-indigo-600 font-mono font-medium">
                    {editingPerson.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelEditPerson}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-slate-200 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
              {editError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Photo Avatar Upload & Crop Section */}
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="relative group shrink-0">
                  {editAvatarUrl ? (
                    <img
                      src={editAvatarUrl}
                      alt={editName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold text-base font-mono flex items-center justify-center border-2 border-indigo-200 shadow-sm select-none">
                      {editName ? editName[0] : '?'}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCropperModal(true)}
                    className="absolute inset-0 rounded-full bg-slate-900/40 text-white flex items-center justify-center opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title={currentLanguage === 'sl' ? 'Spremeni profilno sliko' : 'Change profile picture'}
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCropperModal(true)}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{editAvatarUrl ? (currentLanguage === 'sl' ? 'Spremeni sliko' : 'Change photo') : (currentLanguage === 'sl' ? 'Naloži sliko' : 'Upload photo')}</span>
                    </button>
                    {editAvatarUrl && (
                      <button
                        type="button"
                        onClick={() => setEditAvatarUrl(undefined)}
                        className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{currentLanguage === 'sl' ? 'Odstrani' : 'Remove'}</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Maks. 10 MB • Avtomatsko obrezano 300x300
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
                  {currentLanguage === 'sl' ? 'Ime in priimek sodelavca' : 'Member Name & Surname'}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    if (editError) setEditError('');
                  }}
                  placeholder="Npr. Franci Šumer ali Janez A."
                  className="w-full text-xs px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 focus:border-indigo-600 font-medium"
                />
              </div>

              {/* Contact Details Inputs: Phone & Email */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono flex items-center gap-1">
                    <Phone className="w-3 h-3 text-emerald-600" />
                    <span>{currentLanguage === 'sl' ? 'Telefon (GSM)' : 'Phone'}</span>
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="041 850 651"
                    className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono flex items-center gap-1">
                      <Mail className="w-3 h-3 text-indigo-600" />
                      <span>{currentLanguage === 'sl' ? 'E-pošta' : 'Email'}</span>
                    </label>
                    {editEmail && (
                      <button
                        type="button"
                        onClick={() => setEditEmail('')}
                        className="text-[9px] text-rose-600 hover:text-rose-800 font-mono font-medium transition underline cursor-pointer"
                        title={currentLanguage === 'sl' ? 'Počisti polje za e-pošto' : 'Clear email field'}
                      >
                        {currentLanguage === 'sl' ? 'Počisti e-pošto' : 'Clear email'}
                      </button>
                    )}
                  </div>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="ime@domena.si"
                    className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
              </div>

              {/* Google Account Linking Section */}
              {editingPerson && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-slate-600 font-mono flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-indigo-600" />
                      <span>{currentLanguage === 'sl' ? 'Povezan Google Račun' : 'Linked Google Account'}</span>
                    </label>
                    {(() => {
                      const linkedUser = users.find(u => 
                        (u as any).personId === editingPerson.id ||
                        u.personName === editingPerson.name || 
                        (editingPerson.email && u.email && u.email.toLowerCase() === editingPerson.email.toLowerCase()) ||
                        (editEmail && u.email && u.email.toLowerCase() === editEmail.toLowerCase())
                      );
                      return linkedUser ? (
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{currentLanguage === 'sl' ? 'Povezan' : 'Linked'}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full">
                          {currentLanguage === 'sl' ? 'Ni povezan' : 'Not Linked'}
                        </span>
                      );
                    })()}
                  </div>

                  {(() => {
                    const linkedUser = users.find(u => 
                      (u as any).personId === editingPerson.id ||
                      u.personName === editingPerson.name || 
                      (editingPerson.email && u.email && u.email.toLowerCase() === editingPerson.email.toLowerCase()) ||
                      (editEmail && u.email && u.email.toLowerCase() === editEmail.toLowerCase())
                    );

                    if (linkedUser) {
                      return (
                        <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-250 text-xs">
                          <div>
                            <span className="font-semibold text-slate-800 block">{linkedUser.displayName || 'Google User'}</span>
                            <span className="text-[10px] text-slate-500 font-mono block">{linkedUser.email}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {userRole === 'Admin' && onLinkUserPerson && (
                              <button
                                type="button"
                                onClick={() => onLinkUserPerson(linkedUser.uid, undefined)}
                                className="text-[10px] text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-250 transition font-medium flex items-center gap-1 cursor-pointer"
                                title={currentLanguage === 'sl' ? 'Odstrani povezavo' : 'Unlink account'}
                              >
                                <Unlink className="w-3 h-3" />
                                <span>{currentLanguage === 'sl' ? 'Prekini' : 'Unlink'}</span>
                              </button>
                            )}
                            {userRole === 'Admin' && onDeleteUser && (
                              <button
                                type="button"
                                onClick={() => onDeleteUser(linkedUser.uid, linkedUser.email)}
                                className="text-[10px] text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded border border-rose-200 transition font-bold flex items-center gap-1 cursor-pointer"
                                title={currentLanguage === 'sl' ? 'Izbriši ta registrirani uporabniški račun in e-pošto iz baze' : 'Delete user account and erase email'}
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>{currentLanguage === 'sl' ? 'Izbriši račun' : 'Erase Account'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const availableUsers = (users || []).filter(
                      u => !(u as any).personId || (u as any).personId === editingPerson.id || u.personName === editingPerson.name
                    );

                    return (
                      <div className="space-y-2 pt-1">
                        {availableUsers.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-500 font-medium">
                              {currentLanguage === 'sl'
                                ? 'Povežite ta profil z registriranim Google računom:'
                                : 'Link this profile to a registered Google account:'}
                            </p>
                            <select
                              onChange={(e) => {
                                const selectedUid = e.target.value;
                                if (selectedUid) {
                                  const selectedUser = users.find(u => u.uid === selectedUid);
                                  if (selectedUser) {
                                    if (selectedUser.email) {
                                      setEditEmail(selectedUser.email);
                                    }
                                    if (selectedUser.displayName && selectedUser.displayName.trim()) {
                                      setEditName(selectedUser.displayName.trim());
                                    }
                                  }
                                  if (onLinkUserPerson) {
                                    onLinkUserPerson(selectedUid, editingPerson.id);
                                  }
                                }
                              }}
                              defaultValue=""
                              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer"
                            >
                              <option value="">{currentLanguage === 'sl' ? '-- Izberite Google račun --' : '-- Choose Google Account --'}</option>
                              {availableUsers.map(u => (
                                <option key={u.uid} value={u.uid}>
                                  {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200 leading-relaxed">
                            {currentLanguage === 'sl'
                              ? 'ℹ️ Trenutno v sistemu ni nepovezanih Google računov. Ko se sodelavec prijavi z Google računom (ali če se ujema e-pošta), se bo povezava vzpostavila samodejno.'
                              : 'ℹ️ No unlinked Google accounts registered yet. When this member signs in with Google, they will be paired automatically by email.'}
                          </p>
                        )}

                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await supabase.auth.signInWithOAuth({
                                provider: 'google',
                                options: { redirectTo: window.location.href }
                              });
                            } catch (err) {
                              console.warn('OAuth sign-in error:', err);
                            }
                          }}
                          className="w-full py-1.5 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 flex items-center justify-center gap-2 transition cursor-pointer shadow-2xs active:scale-95"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                          </svg>
                          <span>{currentLanguage === 'sl' ? 'Prijavi se / Poveži z Google računom' : 'Sign in / Link with Google'}</span>
                        </button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Role Assignment (Admin Only) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
                    🔑 {currentLanguage === 'sl' ? 'Vloga in dovoljenja v aplikaciji' : 'System Access Role'}
                  </label>
                  {!isAdmin && (
                    <span className="text-[9px] font-mono text-slate-400 font-semibold flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      {currentLanguage === 'sl' ? 'Le Admin' : 'Admin only'}
                    </span>
                  )}
                </div>
                <select
                  value={editRole}
                  disabled={!isAdmin}
                  onChange={(e) => {
                    const r = e.target.value as UserRole;
                    setEditRole(r);
                    setEditMemberType(r === 'Minor' ? 'minor' : (r === 'Visitor' ? 'visitor' : (r === 'Viewer' ? 'member' : 'adult')));
                  }}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isAdmin && <option value="Admin">🛠️ Admin (Poln nadzor)</option>}
                  <option value="Leader">📋 Leader / Vodja službe (Urejanje svojih služb)</option>
                  <option value="Servant">🤝 Servant / Služabnik (Služenje v ekipi)</option>
                  <option value="Viewer">👤 Member / Član (Član cerkve)</option>
                  <option value="Visitor">👋 Visitor / Obiskovalec (Občasen obisk / Gost)</option>
                  <option value="Minor">👶 Minor / Mladoletni član</option>
                </select>
                {!isAdmin && (
                  <p className="text-[10px] text-slate-400 font-mono">
                    🔒 {currentLanguage === 'sl' ? 'Sprememba sistemske vloge je mogoča le s strani administratorja.' : 'System role can only be changed by an Administrator.'}
                  </p>
                )}
              </div>

              {/* Pastor Exemption Toggle (Admin Only) */}
              <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                <input
                  type="checkbox"
                  id="editPastorOrStaff"
                  disabled={!isAdmin}
                  checked={editPastorOrStaff}
                  onChange={(e) => setEditPastorOrStaff(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label htmlFor="editPastorOrStaff" className={`text-xs font-semibold text-purple-900 flex items-center gap-1.5 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <Crown className="w-3 h-3 text-purple-600 shrink-0" />
                  <span>{currentLanguage === 'sl' ? 'Izvzemi iz opozoril preobremenjenosti (Vodstvo / Leader)' : 'Exempt from fatigue alerts (Leadership / Leader)'}</span>
                </label>
              </div>

              {/* Family Members Linking (Now above Led Ministries) */}
              <div className="space-y-2 p-3 bg-emerald-50/50 border border-emerald-150 rounded-xl">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-emerald-950 font-mono">
                  👨‍👩‍👧 {currentLanguage === 'sl' ? 'Povezani družinski člani (Mož / Žena / Otroci)' : 'Linked Family Members'}
                </label>

                {/* Active linked family badges */}
                <div className="flex flex-wrap gap-1.5">
                  {editFamilyMembers.map(famName => (
                    <span key={famName} className="inline-flex items-center gap-1 text-[10px] bg-white text-emerald-900 border border-emerald-250 font-bold px-2 py-0.5 rounded-full font-mono shadow-2xs">
                      <span>{famName}</span>
                      <button
                        type="button"
                        onClick={() => setEditFamilyMembers(editFamilyMembers.filter(f => f !== famName))}
                        className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                        title={currentLanguage === 'sl' ? 'Odstrani povezavo' : 'Remove link'}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                  {editFamilyMembers.length === 0 && (
                    <span className="text-[10px] text-emerald-800/70 italic font-mono">
                      {currentLanguage === 'sl' ? 'Ni povezanih družinskih članov' : 'No linked family members'}
                    </span>
                  )}
                </div>

                {/* 1. Quick Dropdown Selector for Team Volunteers */}
                <div className="space-y-1 pt-1">
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-emerald-800 font-mono">
                    {currentLanguage === 'sl' ? 'Izberi iz ekipe (avtomatsko dvosmerno povezovanje):' : 'Select from team roster (auto two-way link):'}
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (selected && !editFamilyMembers.includes(selected)) {
                        setEditFamilyMembers([...editFamilyMembers, selected]);
                      }
                    }}
                    className="w-full text-xs px-2.5 py-2 bg-white border border-emerald-200 rounded-lg text-emerald-950 font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="" disabled>
                      {currentLanguage === 'sl' ? '➕ Izberi sodelavca (zakonca / družino)...' : '➕ Select team volunteer (spouse / family)...'}
                    </option>
                    {people
                      .filter(p => p && p.name && p.name !== editingPerson.name && !editFamilyMembers.includes(p.name))
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(p => (
                        <option key={p.id || p.name} value={p.name}>
                          👤 {p.name} {p.email ? `(${p.email})` : ''}
                        </option>
                      ))
                    }
                  </select>
                </div>

                {/* 2. Custom Text Input for Unregistered Family / Children */}
                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    placeholder={currentLanguage === 'sl' ? 'Ali vpiši po meri (otroci)...' : 'Or type custom name (children)...'}
                    value={editFamilyInput}
                    onChange={(e) => setEditFamilyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (editFamilyInput.trim() && !editFamilyMembers.includes(editFamilyInput.trim())) {
                          setEditFamilyMembers([...editFamilyMembers, editFamilyInput.trim()]);
                          setEditFamilyInput('');
                        }
                      }
                    }}
                    className="flex-1 text-xs px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editFamilyInput.trim() && !editFamilyMembers.includes(editFamilyInput.trim())) {
                        setEditFamilyMembers([...editFamilyMembers, editFamilyInput.trim()]);
                        setEditFamilyInput('');
                      }
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer shrink-0"
                  >
                    + {currentLanguage === 'sl' ? 'Dodaj' : 'Add'}
                  </button>
                </div>
              </div>

              {/* Unified 6-Category Grid for Ministries & Leadership */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-slate-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 font-mono">
                    📅 {currentLanguage === 'sl' ? 'Nedeljske Službe & Področja Vodenja' : 'Sunday Ministries & Leadership'}
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {currentLanguage === 'sl' ? 'Izberite službe (kljukica) in vodje (gumb 👑 Vodja)' : 'Select serving (check) and leadership (👑 Leader)'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { key: 'cleaning', labelSl: '🧹 Priprava & Čiščenje', labelEn: '🧹 Setup & Cleaning' },
                    { key: 'hospitality', labelSl: '☕ Gostoljubje & Kava', labelEn: '☕ Hospitality & Snacks' },
                    { key: 'sermon_prayer', labelSl: '📖 Bogoslužje', labelEn: '📖 Main Service' },
                    { key: 'worship', labelSl: '🎵 Slavljenje', labelEn: '🎵 Worship' },
                    { key: 'audio_video', labelSl: '🎥 Avdio Video', labelEn: '🎥 Audio Video' },
                    { key: 'kids', labelSl: '👶 Nedeljska šola', labelEn: '👶 Sunday Kids School' },
                    { key: 'post_service', labelSl: '🤝 Po bogoslužju', labelEn: '🤝 Post-Service' },
                  ].map(cat => {
                    const catMinistries = ministries.filter(m => 
                      m.category === cat.key || 
                      (cat.key === 'post_service' && m.category === 'other') ||
                      (cat.key === 'worship' && m.category === 'av_tech' && (m.id === 'slavilna_ekipa' || m.id === 'uvod_slavljenje' || m.id === 'zvok')) ||
                      (cat.key === 'audio_video' && m.category === 'av_tech' && (m.id !== 'slavilna_ekipa' && m.id !== 'uvod_slavljenje' && m.id !== 'zvok'))
                    );
                    if (catMinistries.length === 0) return null;

                    return (
                      <div key={cat.key} className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2">
                        <div className="text-[11px] font-bold text-slate-800 uppercase tracking-tight font-display pb-1 border-b border-slate-200/80">
                          {currentLanguage === 'sl' ? cat.labelSl : cat.labelEn}
                        </div>
                        <div className="space-y-1.5 pt-0.5">
                          {catMinistries.map(m => {
                            const isServing = editPrefs.includes(m.id);
                            const isLed = editLedMinistries.includes(m.id);

                            const toggleServing = () => {
                              if (isServing) {
                                setEditPrefs(editPrefs.filter(id => id !== m.id));
                                setEditLedMinistries(editLedMinistries.filter(id => id !== m.id));
                              } else {
                                setEditPrefs([...editPrefs, m.id]);
                              }
                            };

                            const toggleLeading = (e: React.MouseEvent) => {
                              e.stopPropagation();
                              if (isLed) {
                                setEditLedMinistries(editLedMinistries.filter(id => id !== m.id));
                              } else {
                                setEditLedMinistries([...editLedMinistries, m.id]);
                                if (!editPrefs.includes(m.id)) {
                                  setEditPrefs([...editPrefs, m.id]);
                                }
                              }
                            };

                            return (
                              <div
                                key={m.id}
                                className={`flex items-center justify-between p-1.5 sm:p-2 rounded-lg border transition-all select-none ${
                                  isServing
                                    ? isLed
                                      ? 'bg-amber-50/80 border-amber-300 text-slate-900 shadow-2xs font-semibold'
                                      : 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-medium'
                                    : 'bg-white border-slate-200 hover:bg-slate-100/60 text-slate-700'
                                }`}
                              >
                                <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={isServing}
                                    onChange={toggleServing}
                                    className="w-3.5 h-3.5 text-indigo-600 rounded focus:ring-indigo-500 shrink-0 cursor-pointer"
                                  />
                                  <span className="text-xs truncate">
                                    {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                                  </span>
                                </label>

                                {isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={toggleLeading}
                                    title={
                                      isLed
                                        ? (currentLanguage === 'sl' ? 'Oseba je vodja te službe (kliknite za preklic)' : 'Leader of this ministry (click to revoke)')
                                        : (currentLanguage === 'sl' ? 'Označi osebo kot vodjo te službe' : 'Mark as leader of this ministry')
                                    }
                                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer shrink-0 ml-1.5 ${
                                      isLed
                                        ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-2xs'
                                        : 'bg-slate-100 hover:bg-amber-100 text-slate-400 hover:text-amber-900 border border-slate-200'
                                    }`}
                                  >
                                    <Crown className={`w-3 h-3 ${isLed ? 'text-slate-950 fill-slate-950' : 'text-slate-400'}`} />
                                    <span>{isLed ? (currentLanguage === 'sl' ? 'Vodja' : 'Leader') : (currentLanguage === 'sl' ? 'Vodja' : 'Lead')}</span>
                                  </button>
                                ) : isLed ? (
                                  <span 
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 shrink-0 ml-1.5 font-mono shadow-2xs" 
                                    title={currentLanguage === 'sl' ? 'Vodja službe (le administrator lahko spreminja vodje služb)' : 'Ministry Leader (only Administrator can change leadership)'}
                                  >
                                    <Crown className="w-3 h-3 text-amber-700 fill-amber-700" />
                                    <span>{currentLanguage === 'sl' ? 'Vodja' : 'Leader'}</span>
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 border-t border-gray-150 bg-gray-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancelEditPerson}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-4.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{currentLanguage === 'sl' ? 'Shrani spremembe' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Photo Crop Modal */}
      <PhotoCropperModal
        isOpen={showCropperModal}
        initialImageUrl={cropperTarget === 'add' ? newAvatarUrl : editAvatarUrl}
        currentLanguage={currentLanguage}
        onClose={() => {
          setShowCropperModal(false);
          setCropperTarget(null);
        }}
        onCropComplete={(croppedDataUrl) => {
          if (cropperTarget === 'add') {
            setNewAvatarUrl(croppedDataUrl);
          } else {
            setEditAvatarUrl(croppedDataUrl);
            if (editingPerson && onUpdatePerson) {
              const updated = {
                ...editingPerson,
                avatarUrl: croppedDataUrl,
              };
              setEditingPerson(updated);
              onUpdatePerson(editingPerson.id, updated);
            }
          }
          setShowCropperModal(false);
          setCropperTarget(null);
        }}
        onRemovePhoto={() => {
          if (cropperTarget === 'add') {
            setNewAvatarUrl(undefined);
          } else {
            setEditAvatarUrl(undefined);
            if (editingPerson && onUpdatePerson) {
              const updated = {
                ...editingPerson,
                avatarUrl: undefined,
              };
              setEditingPerson(updated);
              onUpdatePerson(editingPerson.id, updated);
            }
          }
        }}
      />

      {/* Delete Confirmation Pop-up Modal */}
      {personToDelete && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
        >
          <div 
            className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-gray-100 space-y-4 animate-scale-up"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-display font-semibold text-gray-900 text-sm">
                  {currentLanguage === 'sl' ? 'Trajni izbris ali arhiviranje' : 'Permanent Delete or Archive'}
                </h3>
                <p className="text-xs text-indigo-600 font-medium font-mono truncate">
                  {personToDelete.name}
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 space-y-2 text-xs text-gray-700">
              <p className="font-semibold text-rose-950">
                {currentLanguage === 'sl' 
                  ? 'Trajni izbris popolnoma odstrani to ime iz baze (uporabno za podvojena imena). Tega dejanja ni mogoče razveljaviti in oseba se po osvežitvi ne bo več pojavila.' 
                  : 'Permanent deletion completely removes this duplicate or invalid profile. This cannot be undone and will not come back on refresh.'}
              </p>
              <p className="text-[11px] text-gray-500">
                {currentLanguage === 'sl'
                  ? 'Za sodelavce, ki bodo morda znova služili kasneje, priporočamo uporabo možnosti "Arhiviraj".'
                  : 'For members who might serve again later, we recommend using "Archive".'}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPersonToDelete(null)}
                className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Prekliči' : 'Cancel'}
              </button>

              {onUpdatePerson && !personToDelete.isArchived && (
                <button
                  type="button"
                  onClick={() => {
                    onUpdatePerson(personToDelete.id, { ...personToDelete, isArchived: true });
                    setPersonToDelete(null);
                  }}
                  className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition cursor-pointer flex items-center gap-1.5 border border-amber-300"
                >
                  <Archive className="w-3.5 h-3.5 text-amber-800" />
                  <span>{currentLanguage === 'sl' ? 'Arhiviraj namesto izbrisa' : 'Archive instead'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (onDeletePerson) {
                    onDeletePerson(personToDelete.id);
                  }
                  setPersonToDelete(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{currentLanguage === 'sl' ? 'Trajno izbriši' : 'Delete Permanently'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Quick WhatsApp / SMS Reminder Modal */}
      {reminderModalPerson && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
        >
          <div 
            className="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl border border-gray-100 space-y-4 animate-scale-up"
          >
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-gray-900 text-sm">
                    {currentLanguage === 'sl' ? 'Hitro sporočilo / Opomnik za službo' : 'Quick Volunteer Duty Reminder'}
                  </h3>
                  <p className="text-[10px] text-emerald-700 font-mono font-semibold">
                    {reminderModalPerson.name} ({reminderModalPerson.phone || 'N/A'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReminderModalPerson(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
                {currentLanguage === 'sl' ? 'Predogled sporočila za WhatsApp / SMS' : 'Message Preview for WhatsApp / SMS'}
              </label>
              <textarea
                readOnly
                rows={4}
                value={`Živjo ${reminderModalPerson.name}! 👋 Opomnik za tvoje služenje v cerkvi Cerkev VEC. Hvala za tvojo zvestobo in dragocen trud! Vse dobro in blagoslovljen teden! 🙏✨`}
                className="w-full text-xs p-3 bg-slate-50 border border-slate-200 rounded-xl font-sans text-slate-800 focus:outline-none resize-none leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              {reminderModalPerson.phone && (
                <a
                  href={`https://wa.me/${reminderModalPerson.phone.replace(/[^0-9]/g, '').replace(/^0/, '386')}?text=${encodeURIComponent(`Živjo ${reminderModalPerson.name}! 👋 Opomnik za tvoje služenje v cerkvi Cerkev VEC. Hvala za tvojo zvestobo in dragocen trud! Vse dobro in blagoslovljen teden! 🙏✨`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    window.open(e.currentTarget.href, '_blank', 'noopener,noreferrer');
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{currentLanguage === 'sl' ? 'Odpri v WhatsApp' : 'Open in WhatsApp'}</span>
                </a>
              )}

              <div className="flex gap-2">
                {reminderModalPerson.phone && (
                  <a
                    href={`sms:${reminderModalPerson.phone.replace(/\s+/g, '')}?body=${encodeURIComponent(`Živjo ${reminderModalPerson.name}! 👋 Opomnik za tvoje služenje v cerkvi Cerkev VEC. Hvala za tvojo zvestobo in trud! 🙏`)}`}
                    className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5 text-slate-600" />
                    <span>SMS</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`Živjo ${reminderModalPerson.name}! 👋 Opomnik za tvoje služenje v cerkvi Cerkev VEC. Hvala za tvojo zvestobo in dragocen trud! Vse dobro in blagoslovljen teden! 🙏✨`);
                    setCopiedReminderText(true);
                    setTimeout(() => setCopiedReminderText(false), 2000);
                  }}
                  className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                  <span>{copiedReminderText ? (currentLanguage === 'sl' ? 'Kopirano! ✔' : 'Copied! ✔') : (currentLanguage === 'sl' ? 'Kopiraj' : 'Copy')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Users & Role Assignment Modal */}
      {showPendingUsersModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-5 animate-scale-up my-auto max-h-[90vh] flex flex-col font-sans">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white font-bold flex items-center justify-center text-lg shadow-2xs shrink-0">
                  🔔
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 font-display flex items-center gap-2">
                    <span>{currentLanguage === 'sl' ? 'Novi Registrirani Uporabniki & Povezava Vlog' : 'New Registered Users & Role Assignment'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {currentLanguage === 'sl' 
                      ? 'Povežite registrirane Google račune s sodelavci v bazi ali ustvarite novega sodelavca.' 
                      : 'Link registered Google accounts to roster profiles or create a new volunteer profile.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPendingUsersModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable list of pending users */}
            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {(() => {
                const list = (users || []).filter(u => {
                  const userEmailKey = (u.email || '').toLowerCase().trim();
                  const isConfirmed = 
                    confirmedViewerIds.includes(u.uid) || 
                    (userEmailKey && confirmedViewerIds.includes(userEmailKey)) ||
                    u.approval_status === 'viewer_approved';
                  if (isConfirmed) return false;

                  const linkedPerson = (people || []).find(p => p && (
                    p.name === u.personName || 
                    p.id === u.personName || 
                    (p.email && u.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim()) ||
                    ((p as any).auth_user_id && (p as any).auth_user_id === u.uid)
                  ));
                  return !linkedPerson || u.role === 'Viewer';
                });
                
                if (list.length === 0) {
                  return (
                    <div className="p-8 text-center bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 font-sans">
                      <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xl font-bold">
                        ✓
                      </div>
                      <h4 className="font-bold text-sm text-emerald-950">
                        {currentLanguage === 'sl' ? 'Vsi uporabniki so povezani in imajo vloge!' : 'All Users Linked & Roles Assigned!'}
                      </h4>
                      <p className="text-xs text-emerald-800 max-w-sm mx-auto">
                        {currentLanguage === 'sl' 
                          ? 'Vsi registrirani Google računi so povezani s profili v bazi ali potrjeni kot gledalci brez obvestil.' 
                          : 'All registered Google accounts have linked roster profiles or are confirmed as viewers.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowPendingUsersModal(false)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        {currentLanguage === 'sl' ? 'Zapri okno' : 'Close Window'}
                      </button>
                    </div>
                  );
                }

                return list.map((pendingUser) => (
                  <PendingUserItemCard
                    key={pendingUser.uid}
                    user={pendingUser}
                    people={people}
                    currentLanguage={currentLanguage}
                    onLinkUserPerson={onLinkUserPerson}
                    onUpdateUserRole={onUpdateUserRole}
                    onAddPerson={onAddPerson}
                    onDeleteUser={onDeleteUser}
                    onConfirmViewer={onConfirmViewer}
                  />
                ));
              })()}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500 font-mono">
                {currentLanguage === 'sl' ? 'Sistem samodejno sinhronizira e-pošto s profilom' : 'Email is automatically synced with profile'}
              </span>
              <button
                type="button"
                onClick={() => setShowPendingUsersModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {currentLanguage === 'sl' ? 'Zapri' : 'Close'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
