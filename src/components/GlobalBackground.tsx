import React from 'react';
import { useSettings } from '../context/SettingsContext';

import { useEffect } from 'react';

export function GlobalBackground() {
  const { panelBackgroundImage, panelBackgroundBlur } = useSettings();

  useEffect(() => {
    if (panelBackgroundImage) {
      document.documentElement.classList.add('has-bg-image');
    } else {
      document.documentElement.classList.remove('has-bg-image');
    }
    return () => {
      document.documentElement.classList.remove('has-bg-image');
    }
  }, [panelBackgroundImage]);

  if (!panelBackgroundImage) return null;

  const isSolidWhite = panelBackgroundImage === 'solid-white';

  return (
    <div 
      className="fixed inset-0 z-0 pointer-events-none bg-cover bg-center bg-no-repeat transition-all duration-500"
      style={{ 
        backgroundImage: isSolidWhite 
          ? 'linear-gradient(135deg, #ffffff 0%, #f4f4f6 40%, #e2e8f0 100%)' 
          : `url("${panelBackgroundImage}")`,
        filter: `blur(${panelBackgroundBlur || 0}px)`,
        transform: 'scale(1.08)', // To prevent blurred edges from showing
      }}
    >
      <div className={isSolidWhite ? "absolute inset-0 bg-zinc-950/30 backdrop-brightness-90" : "absolute inset-0 bg-zinc-950/40 backdrop-brightness-75"} />
    </div>
  );
}

