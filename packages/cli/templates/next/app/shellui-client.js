'use client';

import { useEffect } from 'react';

export default function ShelluiClient() {
  useEffect(() => {
    // Dynamic import avoids SSR evaluating @shellui/sdk/tiny (uses `location`).
    void import('@shellui/sdk/tiny').then(({ shellui }) => {
      // Light Shellui host handshake when embedded (no-op outside the shell).
      void shellui.ready;
    });
  }, []);
  return null;
}
