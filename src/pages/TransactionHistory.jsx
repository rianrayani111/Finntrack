import React, { useEffect, useMemo, useState } from "react";
import { db } from '@/api/db';

import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, TrendingUp, TrendingDown } from "lucide-react";
import {
  formatCurrency,
  CATEGORY_LABELS,
  MONTH_NAMES,
  sortByDateDesc,
  transactionReason,
  transactionType,
} from "@/lib/finance";

export default function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    db.entities.Transaction.list("-date", 500)
      .then((items) => setTransactions(items || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return sortByDateDesc(transactions).filter((t) => {
      const matchesSearch = !search || [transactionReason(t), t.location, CATEGORY_LABELS[t.category]].join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesMonth = monthFilter === 'all' || new Date(t.date).getMonth() === Number(monthFilter);
      const matchesType = typeFilter === 'all' || transactionType(t) === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesMonth && matchesType && matchesCategory;
    });
  }, [transactions, search, monthFilter, typeFilter, categoryFilter]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800">Transaction History</h1>
            <p className="text-sm text-muted-foreground font-semibold">Browse your entries.</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="pl-10" />
          </div>
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All months</SelectItem>
              {MONTH_NAMES.map((name, index) => (
                <SelectItem key={name} value={String(index)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="deposit">Deposit</SelectItem>
              <SelectItem value="withdrawal">Withdrawal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="finn-card py-10 text-center text-sm text-muted-foreground font-semibold">
          No transactions match your filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const isEarn = transactionType(t) === 'deposit';
            return (
              <div key={t.id} className="finn-card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isEarn ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                    {isEarn ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800">{transactionReason(t)}</p>
                    <p className="text-sm text-muted-foreground font-semibold">{new Date(t.date).toLocaleDateString()} · {CATEGORY_LABELS[String(t.category)] || 'Deposit'} · {t.time}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-extrabold ${isEarn ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {isEarn ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
