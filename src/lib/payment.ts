import type { BusinessPaymentDetails } from '@/types'

export type BankFields = Pick<BusinessPaymentDetails, 'bank_name' | 'account_name' | 'account_number'>

export const hasBankDetails = (d?: Partial<BankFields> | null): d is BankFields =>
  !!(d && d.bank_name?.trim() && d.account_name?.trim() && d.account_number?.trim())

// "Payment details are set up" for checklist/warning purposes: structured
// bank details OR the older free-text instructions that existing businesses
// already use.
export const hasPaymentInfo = (
  d?: Partial<BankFields> | null,
  instructions?: string | null
) => hasBankDetails(d) || !!instructions?.trim()

// Bank details are all-or-nothing: a half-filled bank block on an invoice is
// worse than none. Returns an error message, or null when valid.
export function validateBankFields(f: { bank_name: string; account_name: string; account_number: string }): string | null {
  const filled = [f.bank_name, f.account_name, f.account_number].filter((v) => v.trim()).length
  if (filled === 0) return null
  if (filled < 3) return 'Add the bank name, account name and account number together, or clear all three.'
  if (!/^[0-9]{6,20}$/.test(f.account_number.replace(/\s+/g, ''))) {
    return 'Account number should be digits only (6–20 digits).'
  }
  return null
}
