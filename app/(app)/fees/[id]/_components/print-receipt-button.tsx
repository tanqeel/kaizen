'use client';

import { Button } from '@/components/ui';
import { Icon } from '@/components/icons';
import { printPaymentReceipt, type ReceiptPayment, type ReceiptVoucher } from './receipt';

/** Per-payment "print receipt" button: opens a standalone printable receipt. */
export function PrintReceiptButton({
  schoolName, payment, voucher,
}: {
  schoolName: string;
  payment: ReceiptPayment;
  voucher: ReceiptVoucher;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => printPaymentReceipt(schoolName, payment, voucher)}
      aria-label={`Print receipt ${payment.receiptNo}`}
    >
      <Icon name="printer" size={16} /> Receipt
    </Button>
  );
}
