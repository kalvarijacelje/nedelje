/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNotificationQueue, QueuedRecipientBatch } from '../hooks/useNotificationQueue';
import { Clock, Send, X, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

export default function NotificationQueueBar() {
  const { 
    batches, 
    totalQueuedCount, 
    flushBatchNow, 
    flushAllNow, 
    cancelBatch, 
    queueToast, 
    dismissQueueToast 
  } = useNotificationQueue();

  const [isExpanded, setIsExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Update timer ticks every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const batchList: QueuedRecipientBatch[] = Object.values(batches || {});

  if (batchList.length === 0 && !queueToast) {
    return null;
  }

  const formatRemainingTime = (timerExpiresAt: number) => {
    const diffSeconds = Math.max(0, Math.ceil((timerExpiresAt - now) / 1000));
    const mins = Math.floor(diffSeconds / 60);
    const secs = diffSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Find the earliest expiring batch for multi-item countdown
  const earliestExpiry: number = batchList.reduce(
    (min: number, b: QueuedRecipientBatch) => (b.timerExpiresAt < min ? b.timerExpiresAt : min),
    batchList[0]?.timerExpiresAt || Date.now()
  );

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-[99990] max-w-lg w-[92%] sm:w-auto pointer-events-auto flex flex-col items-center md:items-end gap-2">
      {/* Toast Notice from Queue Actions */}
      {queueToast && (
        <div className="bg-slate-900/60 hover:bg-slate-900/80 transition-colors backdrop-blur-md text-white text-xs px-4 py-2 rounded-full shadow-2xl border border-emerald-500/30 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{queueToast}</span>
          </div>
          <button
            type="button"
            onClick={dismissQueueToast}
            className="text-slate-300 hover:text-white p-0.5 cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Sleek Top Capsule */}
      {batchList.length > 0 && (
        <div className="flex flex-col items-center md:items-end w-full sm:w-auto animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900/55 hover:bg-slate-900/75 transition-colors backdrop-blur-md text-white border border-white/20 shadow-xl rounded-full px-3.5 py-1.5 flex items-center justify-between sm:justify-start gap-2.5 sm:gap-3 text-xs md:text-sm font-sans w-full sm:w-auto animate-in fade-in slide-in-from-top-3 duration-300">
            {/* Blinking Timer Indicator & Title */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </span>
              
              <div className="flex items-center gap-1.5 font-medium text-slate-100 text-xs truncate max-w-[190px] sm:max-w-[280px]">
                {batchList.length === 1 ? (
                  <>
                    <span className="font-semibold truncate">{batchList[0].volunteerName}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({batchList[0].items.length})</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-indigo-300 font-bold text-[11px]">
                      {formatRemainingTime(batchList[0].timerExpiresAt)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-semibold">{batchList.length} oseb ({totalQueuedCount})</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-mono text-indigo-300 font-bold text-[11px]">
                      {formatRemainingTime(earliestExpiry)}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 shrink-0">
              {batchList.length === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => flushBatchNow(batchList[0].volunteerEmail)}
                    className="bg-emerald-600/80 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Pošlji e-poštno obvestilo zdaj"
                  >
                    <Send className="w-3 h-3" />
                    <span>Pošlji zdaj</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelBatch(batchList[0].volunteerEmail)}
                    className="text-slate-300 hover:text-white p-0.5 transition cursor-pointer text-xs"
                    title="Prekliči obvestilo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => flushAllNow()}
                    className="bg-emerald-600/80 hover:bg-emerald-600 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer active:scale-95"
                    title="Pošlji vsa obvestila zdaj"
                  >
                    <Send className="w-3 h-3" />
                    <span>Pošlji vse ({totalQueuedCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-slate-300 hover:text-white p-0.5 transition cursor-pointer text-xs"
                    title={isExpanded ? "Skrij podrobnosti" : "Prikaži podrobnosti"}
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Expanded multi-recipient dropdown list */}
          {batchList.length > 1 && isExpanded && (
            <div className="mt-1.5 w-full bg-slate-900/60 backdrop-blur-md border border-white/15 rounded-2xl p-2 space-y-1.5 shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
              {batchList.map((batch) => (
                <div 
                  key={batch.volunteerEmail}
                  className="bg-slate-800/65 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-semibold text-slate-100 truncate">{batch.volunteerName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({batch.items.length})</span>
                    <span className="text-[10px] text-indigo-300 font-mono font-semibold">
                      {formatRemainingTime(batch.timerExpiresAt)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => flushBatchNow(batch.volunteerEmail)}
                      className="bg-indigo-600/85 hover:bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full transition cursor-pointer"
                    >
                      Pošlji
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelBatch(batch.volunteerEmail)}
                      className="text-slate-400 hover:text-rose-400 p-0.5 transition cursor-pointer"
                      title="Prekliči"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
