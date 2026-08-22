/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { ServiceSunday, Ministry, Person, Translation, UserRole, User, canAccessPersonalData, canViewPersonContactInfo } from '../types';
import { 
  Plus, Search, Phone, Mail, UserCheck, ShieldAlert, X, Crown, Pencil, Trash2, Link as LinkIcon, Unlink, AlertTriangle, Camera, Star, Award, HeartPulse, BatteryCharging, Info, MessageSquare, Send, Copy, ExternalLink, Link2, CheckCircle2, Check, Users, Archive, RotateCcw, Bell, Lock, Sliders, Loader2
} from 'lucide-react';
import HeroHeaderBanner from './HeroHeaderBanner';
import PhotoCropperModal from './PhotoCropperModal';
import { calculatePersonBurnoutStatus, getBurnoutSummaryStats, isExemptFromBurnout } from '../lib/burnoutAnalytics';
import { useBackdropHistory } from '../hooks/useBackdropHistory';

interface PeopleViewProps {
  sundays: ServiceSunday[];
  ministries: Ministry[];
  people: Person[];
  users?: User[];
  userRole: UserRole;
  activePerson?: Person | null;
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
}

interface PendingUserItemCardProps {
  user: User;
  people: Person[];
  currentLanguage: 'sl' | 'en';
  onLinkUserPerson?: (userId: string, personName: string | undefined) => void;
  onUpdateUserRole?: (userId: string, newRole: UserRole) => void;
  onAddPerson: (newPerson: Person) => void;
  onDeleteUser?: (userId: string, userEmail?: string) => void;
}

function PendingUserItemCard({
  user,
  people,
  currentLanguage,
  onLinkUserPerson,
  onUpdateUserRole,
  onAddPerson,
  onDeleteUser,
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
      id: 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6),
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

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 font-sans transition shadow-xs">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm font-mono shrink-0 shadow-2xs">
            {(user.displayName || user.email || 'U').substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <span>{user.displayName || (currentLanguage === 'sl' ? 'Neregistrirano ime' : 'Unregistered Name')}</span>
              {user.personName ? (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                  ✓ {user.personName}
                </span>
              ) : (
                <span className="text-[10px] bg-amber-100 text-amber-900 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-300">
                  ⚠️ {currentLanguage === 'sl' ? 'Čaka na povezavo' : 'Pending Link'}
                </span>
              )}
            </h4>
            <span className="text-xs text-slate-500 font-mono block">{user.email}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-mono font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-250 shadow-2xs">
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
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer shadow-2xs"
              >
                <option value="">-- {currentLanguage === 'sl' ? 'Izberite sodelavca iz baze' : 'Select roster volunteer'} --</option>
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
                🔑 {currentLanguage === 'sl' ? 'Vloga v aplikaciji:' : 'Assigned Role:'}
              </label>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer shadow-2xs"
              >
                <option value="Servant">👤 Servant / Služabnik (Privzeto)</option>
                <option value="Leader">📋 Leader / Vodja službe</option>
                <option value="Admin">🛠️ Admin (Poln nadzor)</option>
                <option value="Viewer">👁️ Viewer / Gledalec</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={handleLinkExisting}
              disabled={!selectedPersonName}
              className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-4 h-4" />
              <span>{currentLanguage === 'sl' ? '✓ Poveži račun in nastavi vlogo' : '✓ Link Account & Assign Role'}</span>
            </button>

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
}: PeopleViewProps) {
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  const handleConnectGoogle = async () => {
    if (!auth || !onSetGoogleToken) return;
    setIsConnectingGoogle(true);
    try {
      const result = await signInWithPopup(auth, workspaceGoogleProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        onSetGoogleToken(credential.accessToken);
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
  const [newPersonRole, setNewPersonRole] = useState<UserRole>('Servant');
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
  const [activePeopleTab, setActivePeopleTab] = useState<'active' | 'archived'>('active');
  const [showPendingUsersModal, setShowPendingUsersModal] = useState<boolean>(false);

  // Quick edit member state
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Servant');
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
      id: 'p-' + trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '_') + '-' + Date.now().toString(36),
      name: trimmedName,
      avatarUrl: newAvatarUrl || undefined,
      phone: newPersonPhone.trim() || undefined,
      email: newPersonEmail.trim() || undefined,
      role: newPersonRole,
      isPastorOrStaff: newPastorOrStaff,
      preferredMinistries: selectedPrefs,
      ledMinistries: selectedLedMinistries,
      familyMembers: newFamilyList,
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
    setEditPastorOrStaff(person.isPastorOrStaff || isExemptFromBurnout(person.name));
    setEditAvatarUrl(person.avatarUrl);
    setEditPrefs([...person.preferredMinistries]);
    setEditLedMinistries([...(person.ledMinistries || [])]);
    setEditFamilyMembers([...(person.familyMembers || [])]);
    setEditError('');
  };

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

    onUpdatePerson(editingPerson.id, {
      ...editingPerson,
      id: editingPerson.id,
      name: trimmedName,
      avatarUrl: editAvatarUrl || undefined,
      phone: editPhone.trim() || undefined,
      email: editEmail.trim() || undefined,
      role: editRole,
      isPastorOrStaff: editPastorOrStaff,
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
    return (users || []).filter(u => !u.personName || u.role === 'Viewer');
  }, [users]);

  const activePeopleCount = (people || []).filter(p => p && p.name && !p.isArchived).length;
  const archivedPeopleCount = (people || []).filter(p => p && p.name && p.isArchived).length;

  const filteredPeople = (people || []).filter((p) => {
    if (!p || typeof p !== 'object' || !p.name) return false;
    const matchesTab = activePeopleTab === 'archived' ? Boolean(p.isArchived) : !p.isArchived;
    if (!matchesTab) return false;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) ||
      (p.phone && p.phone.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
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
    <div id="people-view-component" className="max-w-5xl mx-auto w-full space-y-5 animate-fade-in pb-12 px-3 sm:px-4">
      {/* Admin Notification Banner for Unlinked / Pending New Users (People tab only) */}
      {userRole === 'Admin' && pendingUsers.length > 0 && (
        <div 
          onClick={() => setShowPendingUsersModal(true)}
          className="p-3.5 sm:p-4 bg-amber-500/10 border-2 border-amber-500/40 hover:bg-amber-500/15 text-amber-950 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm cursor-pointer transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 text-base shadow-2xs">
              🔔
            </div>
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-amber-950 font-display flex items-center gap-1.5">
                <span>{currentLanguage === 'sl' ? 'Novo obvestilo o prijavi uporabnikov' : 'New Registered User Notification'}</span>
                <span className="text-[10px] bg-amber-600 text-white font-mono font-bold px-1.5 py-0.2 rounded-full">
                  {pendingUsers.length}
                </span>
              </h4>
              <p className="text-[11px] text-amber-900 font-mono mt-0.5 font-medium">
                {currentLanguage === 'sl'
                  ? `${pendingUsers.map(u => u.displayName || u.email).join(', ')} – Vloge še niso dodeljene ali profili niso povezani.`
                  : `${pendingUsers.map(u => u.displayName || u.email).join(', ')} – Pending role assignment or profile linking.`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPendingUsersModal(true);
            }}
            className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-xs rounded-xl transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
          >
            <span>{currentLanguage === 'sl' ? '⚡ Poveži & Nastavi vloge' : '⚡ Link & Assign Roles'}</span>
          </button>
        </div>
      )}

      {/* Hero Header Banner */}
      <HeroHeaderBanner
        variant="people"
        eyebrow={currentLanguage === 'sl' ? '👤 BAZA SODELAVCEV • KC KALVARIJA' : '👤 VOLUNTEER ROSTER • KC KALVARIJA'}
        title={translations.people}
        subtitle={currentLanguage === 'sl' ? 'Baza služabnikov, vloge, kontakti, družinske povezave ter spremljanje uravnoteženosti službe.' : 'Servant database, team roles, contacts, family linkages, and serving balance tracker.'}
        icon={Users}
      />

      {/* Burnout Prevention & Serving Balance Analytics Widget */}
      <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-md border border-indigo-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-indigo-800/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                <span>{currentLanguage === 'sl' ? 'Preprečevanje izgorelosti in uravnoteženost službe' : 'Burnout Prevention & Serving Balance'}</span>
              </h3>
              <p className="text-xs text-slate-300">
                {currentLanguage === 'sl' 
                  ? 'Spremljanje pogostosti službe po nedeljah – preprečite preobremenjenost prostovoljcev' 
                  : 'Track serving frequency per Sunday – avoid volunteer fatigue'}
              </p>
            </div>
          </div>

          {/* Indicators Summary Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono font-bold">
            <span className="px-2.5 py-1 bg-rose-950/80 text-rose-300 border border-rose-700/80 rounded-lg flex items-center gap-1">
              🔴 {burnoutStats.overloadedCount} {currentLanguage === 'sl' ? 'Preobremenjeni' : 'Overloaded'}
            </span>
            <span className="px-2.5 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 rounded-lg flex items-center gap-1">
              🟢 {burnoutStats.balancedCount} {currentLanguage === 'sl' ? 'Uravnoteženi' : 'Balanced'}
            </span>
            <span className="px-2.5 py-1 bg-slate-800/90 text-slate-300 border border-slate-700 rounded-lg flex items-center gap-1">
              ⚪ {burnoutStats.availableCount} {currentLanguage === 'sl' ? 'Na voljo' : 'Available'}
            </span>
            <span className="px-2.5 py-1 bg-purple-950/80 text-purple-300 border border-purple-700/80 rounded-lg flex items-center gap-1" title="Glavni pastor ali stalno osebje">
              👑 {burnoutStats.exemptCount} {currentLanguage === 'sl' ? 'Izvzeti' : 'Exempt'}
            </span>
          </div>
        </div>

        {/* Dynamic Alert Banner if anyone is overloaded */}
        {burnoutStats.overloadedCount > 0 ? (
          <div className="p-3 bg-rose-950/90 border border-rose-800 text-rose-200 rounded-xl text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">
                {currentLanguage === 'sl' ? 'Opozorilo za voditelje: ' : 'Leader Fatigue Alert: '}
              </span>
              <span>
                {currentLanguage === 'sl'
                  ? `${burnoutStats.overloadedPeople.map(p => `${p.name} (${p.consecutive}x zapored)`).join(', ')} strežejo 3 ali več nedelj zapored. Priporočamo, da jim namenite 1 teden počitka.`
                  : `${burnoutStats.overloadedPeople.map(p => `${p.name} (${p.consecutive}x consecutive)`).join(', ')} served 3+ consecutive Sundays. Rest is suggested.`}
              </span>
            </div>
          </div>
        ) : (
          <div className="p-2.5 bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 rounded-xl text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {currentLanguage === 'sl'
                ? 'Odlično! Vsi služabniki imajo uravnotežen urnik in nihče od prostovoljcev ni preobremenjen.'
                : 'Great job! All volunteers have a balanced schedule with no fatigue detected.'}
            </span>
          </div>
        )}
      </div>

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
              <option value="Servant">👤 Servant / Služabnik (Prijava sebe in družine)</option>
              <option value="Viewer">👁️ Viewer / Gledalec (Le branje)</option>
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
              <span>{currentLanguage === 'sl' ? 'Izvzemi iz preobremenjenosti (Glavni pastor / stalno osebje)' : 'Exempt from fatigue alerts (Main Pastor / Full-time staff)'}</span>
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

          {/* If Leader or Admin role, select led ministries */}
          {(newPersonRole === 'Leader' || newPersonRole === 'Admin') && (
            <div className="space-y-1.5 p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-indigo-900 font-mono">
                👑 {currentLanguage === 'sl' ? 'Službe, ki jih vodi ta vodja' : 'Ministries Led by this Leader'}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {ministries.map(m => {
                  const isLed = selectedLedMinistries.includes(m.id);
                  return (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        if (isLed) {
                          setSelectedLedMinistries(selectedLedMinistries.filter(id => id !== m.id));
                        } else {
                          setSelectedLedMinistries([...selectedLedMinistries, m.id]);
                        }
                      }}
                      className={`text-[10px] px-2.5 py-1 rounded-lg transition border font-mono font-bold cursor-pointer ${
                        isLed
                          ? 'bg-indigo-700 text-white border-indigo-700 shadow-2xs'
                          : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                      }`}
                    >
                      👑 {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preferred Areas of Service */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
              {currentLanguage === 'sl' ? 'Prednostne službe (Označi vse)' : 'Preferred Areas of Service'}
            </label>
            <div className="flex flex-wrap gap-1.5 border border-gray-200 p-2.5 rounded-xl bg-gray-50/80">
              {ministries.map((m) => {
                const isSelected = selectedPrefs.includes(m.id);
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => togglePref(m.id)}
                    className={`text-[10px] px-2.5 py-1 rounded-lg transition border font-mono cursor-pointer ${
                      isSelected
                        ? 'bg-gray-900 text-white border-gray-900 font-bold shadow-2xs'
                        : 'bg-white hover:bg-gray-150 text-gray-600 border-gray-200'
                    }`}
                  >
                    {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                  </button>
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

      {/* Subtabs for Active vs Archived Members */}
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
          <span>{currentLanguage === 'sl' ? 'Aktivni sodelavci' : 'Active Members'}</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${activePeopleTab === 'active' ? 'bg-indigo-500/40 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200'}`}>
            {activePeopleCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActivePeopleTab('archived')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
            activePeopleTab === 'archived'
              ? 'bg-amber-900 text-amber-50 shadow-xs'
              : 'bg-white text-slate-600 hover:bg-amber-50 hover:text-amber-900 border border-slate-200'
          }`}
        >
          <Archive className="w-3.5 h-3.5 text-amber-600" />
          <span>{currentLanguage === 'sl' ? 'Arhiv' : 'Archive'}</span>
          <span className={`text-[10px] px-2 py-0.2 rounded-full font-mono ${activePeopleTab === 'archived' ? 'bg-amber-700 text-amber-50' : 'bg-amber-100 text-amber-900 border border-amber-200'}`}>
            {archivedPeopleCount}
          </span>
        </button>

        {onOpenNotificationModal && (
          <button
            type="button"
            onClick={onOpenNotificationModal}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition shadow-xs cursor-pointer ml-auto active:scale-95"
            title={currentLanguage === 'sl' ? 'Odpri nastavitve obveščanja in kanalov (Google Koledar, Chat, E-pošta, WhatsApp)' : 'Open notification center and channels'}
          >
            <Bell className="w-3.5 h-3.5 text-indigo-600" />
            <span>{currentLanguage === 'sl' ? 'Center za obveščanje & Kanali' : 'Notification Center'}</span>
            {googleToken ? (
              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-mono font-bold px-1.5 py-0.2 rounded-full border border-emerald-300">
                ✓ Google
              </span>
            ) : (
              <span className="text-[9px] bg-amber-100 text-amber-800 font-mono font-bold px-1.5 py-0.2 rounded-full border border-amber-300">
                ! Google
              </span>
            )}
          </button>
        )}
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
          const firstChar = personNameStr[0] || '?';
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
                      alt={personNameStr}
                      className="w-8 h-8 rounded-full object-cover border border-indigo-200 shrink-0 shadow-xs select-none"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[#EEF2FF] text-[#4338CA] text-xs font-bold font-mono flex items-center justify-center border border-indigo-100 shrink-0 select-none">
                      {firstChar}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display font-semibold text-gray-950 text-sm truncate leading-tight flex items-center gap-1.5 flex-wrap">
                      <span>{personNameStr}</span>
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
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {person.role === 'Admin' ? '🛠️ Admin' : person.role === 'Leader' ? '📋 Vodja' : '👤 Služabnik'}
                      </span>
                    </div>
                  </div>
                </div>

                {canEdit && (
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
                    {onDeletePerson && (
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
                    auth.currentUser?.email, 
                    auth.currentUser?.uid
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
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}>
                            {person.role === 'Admin' ? '🛠️ Admin' : person.role === 'Leader' ? '📋 Vodja' : '👤 Služabnik'}
                          </span>

                          {person.isPastorOrStaff && (
                            <span className="text-[9px] font-mono bg-purple-100 text-purple-900 border border-purple-300 font-bold px-1.5 py-0.5 rounded-md">
                              ✝️ {currentLanguage === 'sl' ? 'Pastor / Zaposleni' : 'Full-time Staff'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {canEdit && onUpdatePerson && (
                      <button
                        onClick={() => startEditPerson(person)}
                        className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/80 rounded-xl border border-indigo-200 transition active:scale-95 cursor-pointer shrink-0"
                        title={currentLanguage === 'sl' ? 'Uredi moj profil' : 'Edit my profile'}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Contact Details (Phone, WhatsApp, Reminder, Email) */}
                  {(() => {
                    const isContactVisible = canViewPersonContactInfo(
                      userRole, 
                      myPersonCard?.name, 
                      person, 
                      auth.currentUser?.email, 
                      auth.currentUser?.uid
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
            {/* Pinned Logged-in User Card Section */}
            {myPersonCard && (!searchQuery || myPersonCard.name.toLowerCase().includes(searchQuery.toLowerCase().trim())) && activePeopleTab === 'active' && (
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

            {/* Empty Search Result Fallback */}
            {filteredPeople.length === 0 && (
              <div className="py-12 text-center bg-white rounded-2xl border border-gray-200 p-6 space-y-2">
                <Search className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm font-semibold text-gray-700">
                  {currentLanguage === 'sl' ? 'Ni najdenih sodelavcev' : 'No volunteers found'}
                </p>
                <p className="text-xs text-gray-400 font-mono">
                  {currentLanguage === 'sl' ? 'Poskusite spremeniti iskalni niz.' : 'Try adjusting your search query.'}
                </p>
              </div>
            )}
          </div>
        );
      })()}

      {/* EDIT PERSON MODAL */}
      {editingPerson && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
        >
          <form 
            onSubmit={handleSaveEditPerson}
            className="bg-white rounded-2xl max-w-md w-full max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-gray-200 animate-scale-up"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-150 bg-slate-50/80 flex items-center justify-between shrink-0">
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
                onClick={() => setEditingPerson(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
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

                    return (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-500">
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
                                // 1. Immediately update form input states!
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
                          {users
                            .filter(u => !(u as any).personId || (u as any).personId === editingPerson.id || u.personName === editingPerson.name)
                            .map(u => (
                              <option key={u.uid} value={u.uid}>
                                {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Role Assignment */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
                  🔑 {currentLanguage === 'sl' ? 'Vloga in dovoljenja v aplikaciji' : 'System Access Role'}
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full text-xs px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer font-semibold"
                >
                  <option value="Admin">🛠️ Admin (Poln nadzor)</option>
                  <option value="Leader">📋 Leader / Vodja službe (Urejanje svojih služb)</option>
                  <option value="Servant">👤 Servant / Služabnik (Prijava sebe in družine)</option>
                  <option value="Viewer">👁️ Viewer / Gledalec (Le branje)</option>
                </select>
              </div>

              {/* Pastor Exemption Toggle */}
              <div className="flex items-center gap-2 p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                <input
                  type="checkbox"
                  id="editPastorOrStaff"
                  checked={editPastorOrStaff}
                  onChange={(e) => setEditPastorOrStaff(e.target.checked)}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="editPastorOrStaff" className="text-xs font-semibold text-purple-900 cursor-pointer flex items-center gap-1.5">
                  <Crown className="w-3 h-3 text-purple-600 shrink-0" />
                  <span>{currentLanguage === 'sl' ? 'Izvzemi iz opozoril preobremenjenosti (Glavni pastor / stalno osebje)' : 'Exempt from fatigue alerts (Main Pastor / Full-time staff)'}</span>
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

              {/* If Leader or Admin role, select led ministries */}
              {(editRole === 'Leader' || editRole === 'Admin') && (
                <div className="space-y-1.5 p-3 bg-indigo-50/50 border border-indigo-150 rounded-xl">
                  <label className="block text-[10px] font-bold uppercase tracking-wide text-indigo-900 font-mono">
                    👑 {currentLanguage === 'sl' ? 'Službe, ki jih vodi ta vodja' : 'Ministries Led by this Leader'}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ministries.map(m => {
                      const isLed = editLedMinistries.includes(m.id);
                      return (
                        <button
                          type="button"
                          key={m.id}
                          onClick={() => {
                            if (isLed) setEditLedMinistries(editLedMinistries.filter(id => id !== m.id));
                            else setEditLedMinistries([...editLedMinistries, m.id]);
                          }}
                          className={`text-[10px] px-2.5 py-1 rounded transition border font-mono cursor-pointer ${
                            isLed ? 'bg-indigo-700 text-white border-indigo-800 font-bold' : 'bg-white text-indigo-800 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          {isLed ? '✔ ' : ''}{currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 font-mono">
                  {currentLanguage === 'sl' ? 'Prednostne službe' : 'Preferred Areas of Service'}
                </label>
                <div className="flex flex-wrap gap-1.5 border border-gray-200 p-2.5 rounded-xl bg-gray-50/80">
                  {ministries.map((m) => {
                    const isSelected = editPrefs.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => toggleEditPref(m.id)}
                        className={`text-[10px] px-2.5 py-1 rounded transition border font-mono cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-950 text-white border-indigo-950 font-bold'
                            : 'bg-white hover:bg-gray-150 text-gray-700 border-gray-200'
                        }`}
                      >
                        ★ {currentLanguage === 'sl' ? m.nameSl : m.nameEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 border-t border-gray-150 bg-gray-50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingPerson(null)}
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
          }
          setShowCropperModal(false);
          setCropperTarget(null);
        }}
        onRemovePhoto={() => {
          if (cropperTarget === 'add') {
            setNewAvatarUrl(undefined);
          } else {
            setEditAvatarUrl(undefined);
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
                const pendingUsers = (users || []).filter(u => !u.personName || u.role === 'Viewer');
                
                if (pendingUsers.length === 0) {
                  return (
                    <div className="p-8 text-center bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3 font-sans">
                      <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xl font-bold">
                        ✓
                      </div>
                      <h4 className="font-bold text-sm text-emerald-950">
                        {currentLanguage === 'sl' ? 'Vsi uporabniki so povezani!' : 'All Users Linked & Assigned!'}
                      </h4>
                      <p className="text-xs text-emerald-800 max-w-sm mx-auto">
                        {currentLanguage === 'sl' 
                          ? 'Vsi registrirani Google računi imajo dodeljene profile in ustrezna dovoljenja.' 
                          : 'All registered Google accounts have linked roster profiles and permissions set.'}
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

                return pendingUsers.map((pendingUser) => (
                  <PendingUserItemCard
                    key={pendingUser.uid}
                    user={pendingUser}
                    people={people}
                    currentLanguage={currentLanguage}
                    onLinkUserPerson={onLinkUserPerson}
                    onUpdateUserRole={onUpdateUserRole}
                    onAddPerson={onAddPerson}
                    onDeleteUser={onDeleteUser}
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
