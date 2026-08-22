/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  sendLeaderAssignmentNotification, 
  sendBatchLeaderAssignmentNotification 
} from '../services/notificationService';

export interface QueuedAssignmentItem {
  id: string;
  sundayId?: string;
  sundayDate: string;
  ministryId: string;
  ministryName: string;
  token: string;
  assignedAt: string;
}

export interface QueuedRecipientBatch {
  volunteerName: string;
  volunteerEmail: string;
  leaderName: string;
  items: QueuedAssignmentItem[];
  timerExpiresAt: number; // Timestamp when grace window expires
  createdAt: number;
}

interface NotificationQueueContextType {
  batches: Record<string, QueuedRecipientBatch>;
  totalQueuedCount: number;
  queueAssignment: (params: {
    volunteerName: string;
    volunteerEmail?: string;
    leaderName: string;
    sundayId?: string;
    sundayDate: string;
    ministryId: string;
    ministryName: string;
    token: string;
  }) => boolean;
  flushBatchNow: (volunteerEmail: string) => Promise<boolean>;
  flushAllNow: () => Promise<void>;
  cancelBatch: (volunteerEmail: string) => void;
  removeQueuedItem: (volunteerEmail: string, itemId: string) => void;
  queueToast: string | null;
  dismissQueueToast: () => void;
}

const NotificationQueueContext = createContext<NotificationQueueContextType | null>(null);

const STORAGE_KEY = 'kck_assignment_queue';
const GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes

export function NotificationQueueProvider({ children }: { children: React.ReactNode }) {
  const [batches, setBatches] = useState<Record<string, QueuedRecipientBatch>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load notification queue from storage:', e);
    }
    return {};
  });

  const [queueToast, setQueueToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setQueueToast(msg);
  }, []);

  const dismissQueueToast = useCallback(() => {
    setQueueToast(null);
  }, []);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(batches));
    } catch (e) {
      console.warn('Failed to persist notification queue:', e);
    }
  }, [batches]);

  // Dispatch a single batch
  const executeDispatch = useCallback(async (batch: QueuedRecipientBatch): Promise<boolean> => {
    console.log("🚀 FLUSHING QUEUE BATCH:", batch);

    if (!batch.volunteerEmail || !batch.volunteerEmail.includes('@') || batch.items.length === 0) {
      console.warn("⚠️ Cannot dispatch batch without valid email or items:", batch);
      return false;
    }

    try {
      if (batch.items.length === 1) {
        const item = batch.items[0];
        const res = await sendLeaderAssignmentNotification({
          volunteerName: batch.volunteerName,
          volunteerEmail: batch.volunteerEmail,
          ministryName: item.ministryName,
          sundayDate: item.sundayDate,
          leaderName: batch.leaderName,
          token: item.token,
        });
        if (res.success) {
          showToast(`✓ Poslano e-poštno povabilo na ${batch.volunteerEmail}`);
          return true;
        } else {
          showToast(`⚠️ Napaka pri pošiljanju obvestila na ${batch.volunteerEmail}: ${res.error || 'neznana napaka'}`);
          return false;
        }
      } else {
        const res = await sendBatchLeaderAssignmentNotification({
          volunteerName: batch.volunteerName,
          volunteerEmail: batch.volunteerEmail,
          ministryName: batch.items[0].ministryName,
          items: batch.items.map(i => ({ sundayDate: i.sundayDate, token: i.token })),
          leaderName: batch.leaderName,
        });
        if (res.success) {
          showToast(`✓ Poslano zbirno obvestilo (${batch.items.length} terminov) na ${batch.volunteerEmail}`);
          return true;
        } else {
          showToast(`⚠️ Napaka pri pošiljanju za serijo: ${res.error || 'neznana napaka'}`);
          return false;
        }
      }
    } catch (err: any) {
      console.error("❌ Exception during queue batch dispatch:", err);
      showToast(`⚠️ Napaka pri pošiljanju: ${err.message || 'omrežna napaka'}`);
      return false;
    }
  }, [showToast]);

  // 1-second ticker to check for expired timers
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expiredEmails: string[] = [];

      Object.entries(batches).forEach(([email, batch]) => {
        if (batch.timerExpiresAt <= now) {
          expiredEmails.push(email);
        }
      });

      if (expiredEmails.length > 0) {
        expiredEmails.forEach((email) => {
          const batch = batches[email];
          if (batch) {
            executeDispatch(batch);
            setBatches((prev) => {
              const next = { ...prev };
              delete next[email];
              return next;
            });
          }
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [batches, executeDispatch]);

  // Warn on tab closing if there are pending queued assignments
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const count = Object.values(batches).reduce((acc, b) => acc + b.items.length, 0);
      if (count > 0) {
        e.preventDefault();
        e.returnValue = 'Imate čakajoča e-poštna obvestila, ki še niso bila odposlana.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [batches]);

  // Queue a new assignment
  const queueAssignment = useCallback((params: {
    volunteerName: string;
    volunteerEmail?: string;
    leaderName: string;
    sundayId?: string;
    sundayDate: string;
    ministryId: string;
    ministryName: string;
    token: string;
  }): boolean => {
    if (!params.volunteerEmail || !params.volunteerEmail.includes('@')) {
      return false;
    }

    const emailKey = params.volunteerEmail.toLowerCase().trim();
    const newItem: QueuedAssignmentItem = {
      id: `${params.sundayDate}_${params.ministryId}_${params.token}`,
      sundayId: params.sundayId,
      sundayDate: params.sundayDate,
      ministryId: params.ministryId,
      ministryName: params.ministryName,
      token: params.token,
      assignedAt: new Date().toISOString(),
    };

    setBatches((prev) => {
      const existing = prev[emailKey];
      const now = Date.now();
      const expiresAt = now + GRACE_PERIOD_MS;

      if (existing) {
        // Filter out if duplicate
        const filteredItems = existing.items.filter(
          item => !(item.sundayDate === params.sundayDate && item.ministryId === params.ministryId)
        );
        return {
          ...prev,
          [emailKey]: {
            ...existing,
            volunteerName: params.volunteerName,
            leaderName: params.leaderName,
            items: [...filteredItems, newItem],
            timerExpiresAt: expiresAt, // reset 10m countdown
          }
        };
      } else {
        return {
          ...prev,
          [emailKey]: {
            volunteerName: params.volunteerName,
            volunteerEmail: params.volunteerEmail!,
            leaderName: params.leaderName,
            items: [newItem],
            timerExpiresAt: expiresAt,
            createdAt: now,
          }
        };
      }
    });

    return true;
  }, []);

  // Flush single batch immediately
  const flushBatchNow = useCallback(async (volunteerEmail: string): Promise<boolean> => {
    const emailKey = volunteerEmail.toLowerCase().trim();
    const batch = batches[emailKey];
    if (!batch) return false;

    // Remove from queue immediately
    setBatches((prev) => {
      const next = { ...prev };
      delete next[emailKey];
      return next;
    });

    return executeDispatch(batch);
  }, [batches, executeDispatch]);

  // Flush all batches immediately
  const flushAllNow = useCallback(async (): Promise<void> => {
    const allBatches = Object.values(batches);
    setBatches({});
    for (const batch of allBatches) {
      await executeDispatch(batch);
    }
  }, [batches, executeDispatch]);

  // Cancel single batch
  const cancelBatch = useCallback((volunteerEmail: string) => {
    const emailKey = volunteerEmail.toLowerCase().trim();
    setBatches((prev) => {
      const next = { ...prev };
      delete next[emailKey];
      return next;
    });
    showToast(`✕ Obvestilo za ${volunteerEmail} je bilo preklicano (zadolžitev v urniku ostaja).`);
  }, [showToast]);

  // Remove single item from batch
  const removeQueuedItem = useCallback((volunteerEmail: string, itemId: string) => {
    const emailKey = volunteerEmail.toLowerCase().trim();
    setBatches((prev) => {
      const batch = prev[emailKey];
      if (!batch) return prev;
      const filtered = batch.items.filter(i => i.id !== itemId);
      if (filtered.length === 0) {
        const next = { ...prev };
        delete next[emailKey];
        return next;
      }
      return {
        ...prev,
        [emailKey]: {
          ...batch,
          items: filtered,
        }
      };
    });
  }, []);

  const totalQueuedCount = Object.values(batches).reduce((acc, b) => acc + b.items.length, 0);

  return (
    <NotificationQueueContext.Provider
      value={{
        batches,
        totalQueuedCount,
        queueAssignment,
        flushBatchNow,
        flushAllNow,
        cancelBatch,
        removeQueuedItem,
        queueToast,
        dismissQueueToast,
      }}
    >
      {children}
    </NotificationQueueContext.Provider>
  );
}

export function useNotificationQueue() {
  const context = useContext(NotificationQueueContext);
  if (!context) {
    throw new Error('useNotificationQueue must be used within a NotificationQueueProvider');
  }
  return context;
}
