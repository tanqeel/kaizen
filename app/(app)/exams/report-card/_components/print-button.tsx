'use client';

import { Button } from '@/components/ui';
import { Icon } from '@/components/icons';

/** Print button for the report card page (hidden in print via no-print). */
export function PrintButton() {
  return (
    <Button onClick={() => window.print()}>
      <Icon name="printer" size={16} /> Print / Save as PDF
    </Button>
  );
}
