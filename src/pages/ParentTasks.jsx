import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/finance';
import { Check, Clock, ListChecks, Trash2, X } from 'lucide-react';

const emptyForm = { childId: '', name: '', description: '', amount: '' };

const STATUS_STYLES = {
  approved: 'bg-emerald-100 text-emerald-700',
  declined: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS = {
  approved: 'Approved',
  declined: 'Declined',
};

const formatDateTime = (isoString) => {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export default function ParentTasks() {
  const { refreshPendingTaskApprovalCount } = useOutletContext() || {};
  const [searchParams] = useSearchParams();
  const highlightedTaskId = searchParams.get('taskId');
  const taskRefs = useRef({});
  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [loadError, setLoadError] = useState('');

  const loadTasks = async () => {
    const docs = await db.entities.Task.list();
    setTasks(docs || []);
  };

  useEffect(() => {
    Promise.all([db.users.listMyChildren(), db.entities.Task.list()])
      .then(([childDocs, taskDocs]) => {
        const nextChildren = childDocs || [];
        setChildren(nextChildren);
        setTasks(taskDocs || []);
        if (nextChildren.length > 0) {
          setForm((prev) => ({ ...prev, childId: prev.childId || nextChildren[0].uid }));
        }
      })
      .catch((error) => {
        setLoadError(error.message || 'Could not load tasks. Please refresh and try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const childMap = useMemo(() => new Map(children.map((child) => [child.uid, child])), [children]);
  const childName = (childId) => childMap.get(childId)?.displayName || 'Your child';

  const submittedTasks = useMemo(() => tasks.filter((task) => task.status === 'submitted'), [tasks]);
  const assignedTasks = useMemo(() => tasks.filter((task) => task.status === 'assigned'), [tasks]);
  const historyTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === 'approved' || task.status === 'declined')
      .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));
  }, [tasks]);

  useEffect(() => {
    if (!highlightedTaskId || tasks.length === 0) return;
    const target = tasks.find((task) => task.id === highlightedTaskId);
    if (!target) return;
    if (target.status === 'approved' || target.status === 'declined') {
      setShowHistory(true);
    }
    const timer = setTimeout(() => {
      taskRefs.current[highlightedTaskId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightedTaskId, tasks]);

  const highlightClass = (taskId) =>
    taskId === highlightedTaskId ? 'ring-2 ring-sky-400' : '';

  const handleInputChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.childId) {
      toast({ title: 'Please choose a child.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await db.entities.Task.create({
        childId: form.childId,
        name: form.name.trim(),
        description: form.description.trim(),
        amount: Number(form.amount),
      });
      toast({ title: 'Task assigned.' });
      setForm((prev) => ({ ...emptyForm, childId: prev.childId }));
      await loadTasks();
    } catch (error) {
      toast({
        title: 'Could not assign task',
        description: error.message || 'Please check your entries and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResolve = async (taskId, decision) => {
    setResolvingId(taskId);
    try {
      await db.entities.Task.resolve(taskId, decision);
      toast({ title: decision === 'accept' ? 'Task approved and money sent.' : 'Task declined.' });
      await loadTasks();
      await refreshPendingTaskApprovalCount?.();
    } catch (error) {
      toast({
        title: 'Could not resolve task',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setResolvingId(null);
    }
  };

  const handleDelete = async (taskId) => {
    const confirmDelete = window.confirm('Permanently delete this task?');
    if (!confirmDelete) return;

    setDeletingId(taskId);
    try {
      await db.entities.Task.delete(taskId);
      toast({ title: 'Task deleted.' });
      await loadTasks();
      await refreshPendingTaskApprovalCount?.();
    } catch (error) {
      toast({
        title: 'Could not delete task',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="finn-card text-center py-10">
        <p className="text-slate-700 font-bold">Could not load tasks</p>
        <p className="text-sm text-muted-foreground font-semibold mt-1">{loadError}</p>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="finn-card text-center py-10">
        <p className="text-slate-700 font-bold">No child accounts available.</p>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Add a child first before assigning tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-sky-600" />
          Assign a Task
        </h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Set a paid task for one of your kids. They'll get paid once you approve it as done.
        </p>

        <form className="space-y-4 mt-6" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label>Child</Label>
            <Select value={form.childId} onValueChange={(value) => handleInputChange('childId', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((child) => (
                  <SelectItem key={child.uid} value={child.uid}>
                    {child.displayName} (@{child.username})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-name">Task Name</Label>
            <Input
              id="task-name"
              value={form.name}
              onChange={(event) => handleInputChange('name', event.target.value)}
              placeholder="Clean your room"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={form.description}
              onChange={(event) => handleInputChange('description', event.target.value)}
              placeholder="What needs to be done?"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-amount">Reward Amount</Label>
            <Input
              id="task-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => handleInputChange('amount', event.target.value)}
              placeholder="10"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? 'Assigning...' : 'Assign Task'}
          </Button>
        </form>
      </div>

      {submittedTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-slate-800">Needs Your Approval</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {submittedTasks.map((task) => (
              <div
                key={task.id}
                ref={(el) => { taskRefs.current[task.id] = el; }}
                className={`finn-card space-y-3 ${highlightClass(task.id)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold text-slate-800">{childName(task.childId)}</p>
                  <span className="text-2xl font-extrabold text-slate-800">{formatCurrency(task.amount)}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{task.name}</p>
                <p className="text-sm text-slate-700 font-semibold">{task.description}</p>
                {(task.proofText || task.proofPhotoUrl) && (
                  <div className="rounded-2xl bg-slate-50 p-3 space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Proof</p>
                    {task.proofText && <p className="text-sm text-slate-700 font-semibold">{task.proofText}</p>}
                    {task.proofPhotoUrl && (
                      <img src={task.proofPhotoUrl} alt="Proof of completion" className="max-h-40 rounded-xl border border-slate-200" />
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Submitted {formatDateTime(task.submittedAt)}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    className="flex-1 gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={resolvingId === task.id}
                    onClick={() => handleResolve(task.id, 'accept')}
                  >
                    <Check className="w-4 h-4" />
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1 gap-1"
                    disabled={resolvingId === task.id}
                    onClick={() => handleResolve(task.id, 'decline')}
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-800">Assigned Tasks</h2>
        {assignedTasks.length === 0 ? (
          <div className="finn-card text-sm text-muted-foreground font-semibold text-center py-10">
            No tasks waiting to be completed.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assignedTasks.map((task) => (
              <div
                key={task.id}
                ref={(el) => { taskRefs.current[task.id] = el; }}
                className={`finn-card space-y-3 ${highlightClass(task.id)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold text-slate-800">{childName(task.childId)}</p>
                  <span className="text-2xl font-extrabold text-slate-800">{formatCurrency(task.amount)}</span>
                </div>
                <p className="text-sm font-bold text-slate-800">{task.name}</p>
                <p className="text-sm text-slate-700 font-semibold">{task.description}</p>
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Assigned {formatDateTime(task.createdAt)}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={deletingId === task.id}
                  onClick={() => handleDelete(task.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  {deletingId === task.id ? 'Deleting...' : 'Delete Task'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {historyTasks.length > 0 && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowHistory((prev) => !prev)}
            className="text-sm font-bold text-sky-700 hover:text-sky-800 underline underline-offset-2"
          >
            {showHistory ? 'Hide past tasks' : 'See all tasks'}
          </button>

          {showHistory && (
            <div className="finn-card divide-y divide-slate-100">
              {historyTasks.map((task) => (
                <div
                  key={task.id}
                  ref={(el) => { taskRefs.current[task.id] = el; }}
                  className={`py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3 rounded-xl ${
                    task.id === highlightedTaskId ? 'ring-2 ring-sky-400 px-2' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">
                      {childName(task.childId)} &mdash; {task.name}
                    </p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {formatDateTime(task.resolvedAt || task.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-extrabold text-slate-800">{formatCurrency(task.amount)}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                    {task.status === 'declined' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={deletingId === task.id}
                        onClick={() => handleDelete(task.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
