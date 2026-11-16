import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';

export const NotificationToast: React.FC = () => {
  const notification = useGameStore((state) => state.notification);
  const [visible, setVisible] = useState(false);
  const [currentText, setCurrentText] = useState('');

  useEffect(() => {
    if (notification) {
      setCurrentText(notification);
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        useGameStore.setState({ notification: null });
      }, 2400);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      setCurrentText('');
    }
  }, [notification]);

  if (!visible || !currentText) return null;

  return (
    <div className="fixed top-6 sm:top-7 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
      <div className="racing-panel px-6 py-2.5 rounded-full border border-orange-500 shadow-[0_0_25px_rgba(255,94,19,0.7)] text-sm sm:text-base font-black tracking-wider text-yellow-300 flex items-center space-x-2 animate-bounce">
        <span>{currentText}</span>
      </div>
    </div>
  );
};
