import React, { useEffect } from 'react';

interface TakeCardsModalProps {
  requesterName: string;
  targetName: string;
  onAccept: () => void;
  onDecline: () => void;
  onClose: () => void;
  isOpen?: boolean;
}

const TakeCardsModal: React.FC<TakeCardsModalProps> = ({ requesterName, targetName, onAccept, onDecline, onClose, isOpen = true }) => {
  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!isOpen) return null;
    return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Card Take Request</h2>
        <p>{requesterName} wants to take all of {targetName}'s cards.</p>
        <div className="modal-actions">
          <button className="btn accept" onClick={onAccept}>Accept</button>
          <button className="btn decline" onClick={onDecline}>Decline</button>
        </div>
      </div>
    </div>
  );
};

export default TakeCardsModal;
