import React, { useEffect, useMemo, useState } from "react";
import { db } from '@/api/base44Client';
import { useNavigate } from "react-router-dom";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, Search, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  formatCurrency,
  CATEGORY_LABELS,
  MONTH_NAMES,
  sortByDateDesc,
} from "@/lib/finance";

export default function TransactionHistory() {
  const navigate = useNavigate();
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

  const reload = () => {
    db.entities.Transaction.list("-date", 500).then((items) => setTransactions(items || []));
  };

  const filtered = useMemo(() => {
    return sortByDateDesc(transactions).filter((t) => {
      const matchesSearch = !search || [t.description, t.location, CATEGORY_LABELS[t.category]].join(' ').toLowerCase().includes(search.toLowerCase());
      const matchesMonth = monthFilter === 'all' || new Date(t.date).getMonth() === Number(monthFilter);
      const matchesType = typeFilter === 'all' || t.transaction_type === typeFilter;
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesMonth && matchesType && matchesCategory;
    });
  }, [transactions, search, monthFilter, typeFilter, categoryFilter]);

  const handleDelete = async (id) => {
    try {
      await db.entities.Transaction.delete(id);
      toast({ title: 'Transaction deleted.' });
      reload();
    } catch (err) {
      toast({ title: 'Could not delete', description: err.message, variant: 'destructive' });
    }
  };

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
            <p className="text-sm text-muted-foreground font-semibold">Browse and manage your entries.</p>
          </div>
          <Button onClick={() => navigate('/add')}>Add transaction</Button>
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
              <SelectItem value="earning">Earning</SelectItem>
              <SelectItem value="spending">Spending</SelectItem>
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
            const isEarn = t.transaction_type === 'earning';
            return (
              <div key={t.id} className="finn-card flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isEarn ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}`}>
                    {isEarn ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800">{t.description}</p>
                    <p className="text-sm text-muted-foreground font-semibold">{new Date(t.date).toLocaleDateString()} · {CATEGORY_LABELS[t.category]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-extrabold ${isEarn ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {isEarn ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                  <Button variant="outline" size="icon" onClick={() => navigate(`/edit/${t.id}`)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
