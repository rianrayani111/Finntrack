import React, { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";

import usePageMeta from "@/hooks/usePageMeta";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { education } from "@/api/education";
import {
  DAY_NAMES,
  PageTitle,
  Section,
  SmallButton,
  formatEdu,
  parseAmount,
  paydayText,
  useStudent,
} from "@/components/student/StudentUI";

function BalanceBar({ label, amount, share, tone }) {
  const pct = Math.round(share * 100);
  return (
    <div>
      <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
        <span>{label}</span>
        <span>
          {formatEdu(amount)} ({pct}%)
        </span>
      </div>
      <div className="h-4 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function StudentBank() {
  usePageMeta("Bank & Savings", "Your class bank and savings.", "/student/bank");
  const { summary, refreshSummary } = useStudent();
  const [amountText, setAmountText] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const cash = Math.max(summary.cash, 0);
  const total = cash + summary.savings;
  const rate = summary.savingsRatePct;
  const nextInterest = Math.round(summary.savings * rate) / 100;

  const handleTransfer = async (direction) => {
    const amount = parseAmount(amountText);
    if (!(amount > 0)) return setError("Enter an amount in dollars and cents, like 10.00.");
    setError("");
    setBusy(direction);
    try {
      await education.transfer(direction, amount);
      toast({
        title: direction === "deposit" ? `Deposited ${formatEdu(amount)} to the bank` : `Withdrew ${formatEdu(amount)} to cash`,
      });
      setAmountText("");
      await refreshSummary();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageTitle>Savings Summary &amp; Interest Rate</PageTitle>

      <div className="finn-card mt-4 grid sm:grid-cols-2 gap-3 text-sm font-bold text-slate-700">
        <p>
          Current bank balance: <span className="text-slate-900">{formatEdu(summary.savings)} EduBucks</span>
        </p>
        <p>
          Weekly interest rate: <span className="text-slate-900">{rate}%</span>
        </p>
        <p>
          Total interest earned: <span className="text-emerald-700">{formatEdu(summary.totalInterest)} EduBucks</span>
        </p>
        <p>
          Next interest payout:{" "}
          <span className="text-slate-900">
            {DAY_NAMES[summary.paydayDow]} ({paydayText(summary)})
          </span>
        </p>
      </div>

      <Section title="Visual Balance Breakdown">
        <div className="finn-card space-y-4">
          <BalanceBar label="Spending Cash" amount={summary.cash} share={total ? cash / total : 0} tone="bg-sky-400" />
          <BalanceBar
            label={`Bank Savings (earning ${rate}% a week)`}
            amount={summary.savings}
            share={total ? summary.savings / total : 0}
            tone="bg-emerald-400"
          />
        </div>
      </Section>

      <Section title="How the Class Bank & Interest Works">
        <div className="finn-card">
          <ol className="list-decimal pl-5 space-y-2 text-sm font-semibold text-slate-700">
            <li>
              <span className="font-extrabold">Spending cash vs. savings:</span> cash in your pocket buys store items and
              marketplace goods. Savings stay locked safely in the vault to earn extra free money!
            </li>
            <li>
              <span className="font-extrabold">Earning weekly interest:</span> the {rate}% interest rate pays you bonus
              EduBucks for saving. Right now, your {formatEdu(summary.savings)} balance will earn{" "}
              {formatEdu(nextInterest)} extra on payday ({paydayText(summary)})!
            </li>
          </ol>
        </div>
      </Section>

      <Section title="Deposit & Withdrawal Transfers">
        <div className="finn-card max-w-md space-y-3">
          <p className="text-sm font-bold text-slate-700">
            Spending cash available: <span className="text-slate-900">{formatEdu(summary.cash)} EduBucks</span>
          </p>
          <div className="space-y-2">
            <Label htmlFor="transfer-amount" className="font-bold text-slate-700">
              Amount (EduBucks)
            </Label>
            <Input
              id="transfer-amount"
              inputMode="decimal"
              placeholder="10.00"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className="h-11 rounded-2xl border-2"
            />
          </div>
          {error && <p className="text-sm font-bold text-rose-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <SmallButton tone="green" className="py-2.5" disabled={Boolean(busy)} onClick={() => handleTransfer("deposit")}>
              {busy === "deposit" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
              Deposit to bank
            </SmallButton>
            <SmallButton tone="primary" className="py-2.5" disabled={Boolean(busy)} onClick={() => handleTransfer("withdraw")}>
              {busy === "withdraw" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
              Withdraw to cash
            </SmallButton>
          </div>
        </div>
      </Section>
    </div>
  );
}
