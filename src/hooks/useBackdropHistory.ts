/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

/**
 * Hook to intercept the hardware/browser back button and mouse back click
 * when a modal, drawer, or overlay is open, closing the overlay instead of navigating away.
 *
 * @param isOpen - Whether the modal/overlay is currently visible.
 * @param onClose - Callback to close the modal/overlay.
 * @param modalId - Optional identifier for debugging or state tagging.
 */
export function useBackdropHistory(
  isOpen: boolean,
  onClose: () => void,
  modalId: string = 'overlay'
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const isClosedByPopstate = useRef(false);
  const isPushed = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      isClosedByPopstate.current = false;
      return;
    }

    // Modal just opened: push history entry
    isClosedByPopstate.current = false;
    isPushed.current = true;
    const initialPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const stateTag = { __modalOverlay: modalId, timestamp: Date.now() };
    window.history.pushState(stateTag, '');

    const handlePopState = () => {
      // User pressed back button
      isClosedByPopstate.current = true;
      isPushed.current = false;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);

      // If closed programmatically / via UI click (not by back button) and state was pushed
      // ONLY revert history if the user is still on the same pathname!
      // If the route or tab changed, DO NOT call history.back() as it would undo the user's tab navigation!
      if (isPushed.current && !isClosedByPopstate.current) {
        isPushed.current = false;
        const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
        if (currentPath === initialPath && window.history.state && window.history.state.__modalOverlay === modalId) {
          window.history.back();
        }
      }
    };
  }, [isOpen, modalId]);
}
