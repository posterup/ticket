"use client";

import { useEffect, useState } from "react";
import { Modal } from "@heroui/react";
import {
  ArrowDownToLine,
  ArrowLeft,
  Check,
  Landmark,
  Plus,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MoneyInput } from "@/components/ui/money-input";
import { formatNumber, formatToman, formatJalaliDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  BankAccount,
  Withdrawal,
  WithdrawalStatus,
} from "@/lib/finance/compute";

const STATUS: Record<WithdrawalStatus, { label: string; dot: string }> = {
  paid: { label: "واریز شد", dot: "bg-success" },
  processing: { label: "در حال پردازش", dot: "bg-warning" },
  pending: { label: "در انتظار", dot: "bg-muted" },
};

/** Iranian banks offered when saving a new account. */
const BANKS = [
  "بانک ملت",
  "بانک ملی ایران",
  "بانک صادرات ایران",
  "بانک تجارت",
  "بانک پارسیان",
  "بانک پاسارگاد",
  "بانک سامان",
  "بانک سپه",
  "بانک رفاه کارگران",
  "بانک کشاورزی",
  "بانک مسکن",
  "بانک اقتصاد نوین",
  "بانک سینا",
  "بانک شهر",
  "بانک آینده",
  "بانک کارآفرین",
] as const;

/** Normalise an IBAN: ASCII digits, no spaces, upper-case (e.g. `IR82…`). */
function normalizeIban(raw: string): string {
  const ascii = raw
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  return ascii.replace(/[^0-9a-zA-Z]/g, "").toUpperCase();
}

/** A valid Iranian IBAN is `IR` + 24 digits. */
function isValidIban(iban: string): boolean {
  return /^IR\d{24}$/.test(iban);
}

/** True at the `lg` breakpoint (desktop) — drives sheet-vs-popup placement. */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/** Last four digits of an IBAN, for a compact account label. */
function ibanTail(iban: string): string {
  return iban.slice(-4);
}

function accountLabel(a: BankAccount): string {
  return `${a.bankName} · ${ibanTail(a.iban)}`;
}

/**
 * Wallet-first finance surface: the spendable balance as the hero, a full-width
 * «برداشت» action that opens a two-step sheet (amount + شبا, then a fee
 * confirmation), and the list of past withdrawals beneath.
 */
export function WalletPanel({
  balance: initialBalance,
  fee,
  accounts: initialAccounts,
  withdrawals: initialWithdrawals,
}: {
  balance: number;
  fee: number;
  accounts: BankAccount[];
  withdrawals: Withdrawal[];
}) {
  const isDesktop = useIsDesktop();
  const [balance, setBalance] = useState(initialBalance);
  const [withdrawals, setWithdrawals] = useState(initialWithdrawals);
  const [accounts, setAccounts] = useState(initialAccounts);
  const [defaultId, setDefaultId] = useState(initialAccounts[0]?.id ?? "");

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(initialAccounts[0]?.id ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // «افزودن حساب» sheet.
  const [addOpen, setAddOpen] = useState(false);
  const [iban, setIban] = useState("");
  const [bankName, setBankName] = useState<string>(BANKS[0]);
  const [holder, setHolder] = useState("");
  const [addError, setAddError] = useState("");

  const account = accounts.find((a) => a.id === accountId);
  const amountValue = Number(amount) || 0;
  const payout = Math.max(0, amountValue - fee);

  function reset() {
    setStep("form");
    setAmount("");
    setAccountId(defaultId || accounts[0]?.id || "");
    setError("");
    setSubmitting(false);
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    reset();
  }

  function addAccount() {
    const normalized = normalizeIban(iban);
    if (!isValidIban(normalized)) {
      setAddError("شماره شبا باید با IR و ۲۴ رقم باشد.");
      return;
    }
    if (accounts.some((a) => a.iban === normalized)) {
      setAddError("این حساب قبلاً ثبت شده است.");
      return;
    }
    if (!holder.trim()) {
      setAddError("نام صاحب حساب را وارد کنید.");
      return;
    }
    const record: BankAccount = {
      id: `ba-${Date.now()}`,
      iban: normalized,
      bankName,
      holder: holder.trim(),
    };
    setAccounts((prev) => [...prev, record]);
    // First-ever account becomes the default automatically.
    setDefaultId((prev) => prev || record.id);
    setAddOpen(false);
    setIban("");
    setBankName(BANKS[0]);
    setHolder("");
    setAddError("");
  }

  function removeAccount(id: string) {
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (id === defaultId) setDefaultId(next[0]?.id ?? "");
      if (id === accountId) setAccountId(next[0]?.id ?? "");
      return next;
    });
  }

  function goConfirm() {
    if (amountValue <= 0) {
      setError("مبلغ برداشت را وارد کنید.");
      return;
    }
    if (amountValue <= fee) {
      setError(`مبلغ برداشت باید بیشتر از کارمزد (${formatToman(fee)}) باشد.`);
      return;
    }
    if (amountValue > balance) {
      setError("مبلغ برداشت بیشتر از موجودی کیف پول است.");
      return;
    }
    if (!account) {
      setError("یک حساب بانکی انتخاب کنید.");
      return;
    }
    setError("");
    setStep("confirm");
  }

  function submit() {
    if (!account) return;
    setSubmitting(true);
    // Sample data: append the request locally and debit the wallet.
    const record: Withdrawal = {
      id: `wd-${Date.now()}`,
      amount: amountValue,
      fee,
      iban: account.iban,
      bankName: account.bankName,
      status: "pending",
      date: new Date().toISOString(),
    };
    setWithdrawals((prev) => [record, ...prev]);
    setBalance((b) => b - amountValue);
    setOpen(false);
    reset();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Balance hero + withdraw action */}
      <section className="flex flex-col items-center gap-6 rounded-2xl border border-border bg-card px-6 py-10 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted">
            <Wallet className="size-4 text-faint" aria-hidden />
            موجودی کیف پول
          </span>
          <p className="flex items-baseline gap-2" dir="rtl">
            <span className="text-5xl font-extrabold tracking-tight text-foreground tabular-nums">
              {formatNumber(balance)}
            </span>
            <span className="text-lg font-medium text-muted">تومان</span>
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full max-w-sm"
          onClick={() => {
            reset();
            setOpen(true);
          }}
          disabled={balance <= fee || accounts.length === 0}
        >
          <ArrowDownToLine aria-hidden />
          برداشت وجه
        </Button>
      </section>

      {/* Withdrawals list */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground">برداشت‌ها</h2>
        {withdrawals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-subtle/40 px-5 py-8 text-center text-sm text-muted">
            هنوز برداشتی ثبت نکرده‌اید.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {withdrawals.map((w) => (
              <li
                key={w.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {formatToman(w.amount)}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <Landmark className="size-3.5 text-faint" aria-hidden />
                    {w.bankName} · {ibanTail(w.iban)}
                    <span className="text-faint">·</span>
                    {formatJalaliDate(w.date)}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1 text-xs text-muted">
                  <span
                    className={cn("size-1.5 rounded-full", STATUS[w.status].dot)}
                  />
                  {STATUS[w.status].label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Saved bank accounts (شبا/IBAN) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">حساب‌های بانکی</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setAddError("");
              setAddOpen(true);
            }}
          >
            <Plus aria-hidden />
            افزودن حساب
          </Button>
        </div>
        {accounts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-subtle/40 px-5 py-8 text-center text-sm text-muted">
            هنوز حساب بانکی ثبت نکرده‌اید. برای برداشت، یک شبا اضافه کنید.
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
            {accounts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {a.bankName}
                    {a.id === defaultId ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/5 px-2 py-0.5 text-[0.625rem] text-accent">
                        <Star className="size-2.5 fill-current" aria-hidden />
                        پیش‌فرض
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-xs text-muted" dir="ltr">
                    {a.iban}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {a.id === defaultId ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDefaultId(a.id)}
                    >
                      پیش‌فرض
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger/5"
                    aria-label="حذف حساب"
                    onClick={() => removeAccount(a.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add-account sheet */}
      <Modal
        isOpen={addOpen}
        onOpenChange={(next) => (next ? null : setAddOpen(false))}
      >
        <Modal.Backdrop />
        <Modal.Container placement={isDesktop ? "center" : "bottom"} size="md">
          <Modal.Dialog aria-label="افزودن حساب بانکی">
            <div className="flex flex-col gap-5 p-6">
              <Modal.Heading className="text-base font-semibold text-foreground">
                افزودن حساب بانکی
              </Modal.Heading>

              <Field
                id="account-iban"
                label="شماره شبا"
                hint="با IR و ۲۴ رقم، مثلاً IR820540102680020817909002"
              >
                <Input
                  id="account-iban"
                  dir="ltr"
                  value={iban}
                  onChange={(e) => setIban(e.target.value)}
                  placeholder="IR…"
                  aria-invalid={Boolean(addError)}
                />
              </Field>

              <Field id="account-bank" label="بانک">
                <Select
                  id="account-bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                >
                  {BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field id="account-holder" label="نام صاحب حساب">
                <Input
                  id="account-holder"
                  value={holder}
                  onChange={(e) => setHolder(e.target.value)}
                  placeholder="نام و نام خانوادگی"
                />
              </Field>

              {addError ? <p className="text-sm text-danger">{addError}</p> : null}

              <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => setAddOpen(false)}
                >
                  انصراف
                </Button>
                <Button type="button" className="w-full" onClick={addAccount}>
                  <Check aria-hidden />
                  ذخیره حساب
                </Button>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>

      {/* Withdraw sheet — bottom sheet on mobile, centered on desktop */}
      <Modal isOpen={open} onOpenChange={(next) => (next ? null : close())}>
        <Modal.Backdrop isDismissable={!submitting} />
        <Modal.Container placement={isDesktop ? "center" : "bottom"} size="md">
          <Modal.Dialog aria-label="برداشت وجه">
            {step === "form" ? (
              <div className="flex flex-col gap-5 p-6">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  برداشت وجه
                </Modal.Heading>

                <Field
                  id="withdraw-amount"
                  label="مبلغ برداشت"
                  hint={`موجودی قابل برداشت: ${formatToman(balance)}`}
                >
                  <MoneyInput
                    id="withdraw-amount"
                    value={amount}
                    onChange={setAmount}
                    placeholder="۰"
                    aria-invalid={Boolean(error)}
                  />
                </Field>

                <Field id="withdraw-account" label="واریز به حساب">
                  <Select
                    id="withdraw-account"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {accountLabel(a)}
                      </option>
                    ))}
                  </Select>
                </Field>

                {error ? <p className="text-sm text-danger">{error}</p> : null}

                <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={close}
                  >
                    انصراف
                  </Button>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={goConfirm}
                  >
                    بعدی
                    <ArrowLeft aria-hidden />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-5 p-6">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  تأیید برداشت
                </Modal.Heading>

                <dl className="flex flex-col gap-3 rounded-lg border border-border bg-subtle/40 p-4 text-sm">
                  <Row label="مبلغ درخواستی" value={formatToman(amountValue)} />
                  <Row label="کارمزد برداشت" value={formatToman(fee)} />
                  <div className="border-t border-border" />
                  <Row
                    label="مبلغ واریزی به حساب"
                    value={formatToman(payout)}
                    strong
                  />
                  {account ? (
                    <Row
                      label="حساب مقصد"
                      value={`${account.bankName} · ${ibanTail(account.iban)}`}
                    />
                  ) : null}
                </dl>

                <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => setStep("form")}
                    disabled={submitting}
                  >
                    بازگشت
                  </Button>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={submit}
                    disabled={submitting}
                  >
                    <Check aria-hidden />
                    {submitting ? "در حال ثبت…" : "تأیید برداشت"}
                  </Button>
                </div>
              </div>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          strong ? "font-bold text-foreground" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
