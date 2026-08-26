import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { formatCurrency } from '@/lib/finance';
import { compressImageFile, MAX_PHOTO_DATA_URL_LENGTH } from '@/lib/image';
import { ListChecks, Clock, Camera, X, Hourglass } from 'lucide-react';

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

export default function Tasks() {
  const { refreshAssignedTaskCount } = useOutletContext() || {};
  const [searchParams] = useSearchParams();
  const highlightedTaskId = searchParams.get('taskId');
  const taskRefs = useRef({});
  const handledHighlightRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [proofText, setProofText] = useState('');
  const [proofPhoto, setProofPhoto] = useState('');
  const [submittingId, setSubmittingId] = useState(null);
  const [loadError, setLoadError] = useState('');

  const loadTasks = async () => {
    const docs = await db.entities.Task.list();
    setTasks(docs || []);
  };

  useEffect(() => {
    loadTasks()
      .catch((error) => {
        setLoadError(error.message || 'Could not load tasks. Please refresh and try again.');
      })
      .finally(() => setLoading(false));
  }, []);

  const assignedTasks = useMemo(() => tasks.filter((task) => task.status === 'assigned'), [tasks]);
  const submittedTasks = useMemo(() => tasks.filter((task) => task.status === 'submitted'), [tasks]);
  const historyTasks = useMemo(() => {
    return tasks
      .filter((task) => task.status === 'approved' || task.status === 'declined')
      .sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt));
  }, [tasks]);

  useEffect(() => {
    if (!highlightedTaskId || tasks.length === 0) return;
    // Only scroll/expand the first time this taskId's target becomes available.
    // Every task action re-fetches `tasks`, which would otherwise re-trigger
    // this — undoing a manual showHistory toggle and yanking the scroll
    // position back to the highlighted card after each submit.
    if (handledHighlightRef.current === highlightedTaskId) return;
    const target = tasks.find((task) => task.id === highlightedTaskId);
    if (!target) return;
    handledHighlightRef.current = highlightedTaskId;
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

  const resetProofForm = () => {
    setExpandedTaskId(null);
    setProofText('');
    setProofPhoto('');
  };

  const handleStartComplete = (taskId) => {
    if (expandedTaskId === taskId) {
      resetProofForm();
      return;
    }
    setExpandedTaskId(taskId);
    setProofText('');
    setProofPhoto('');
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please choose an image file.', variant: 'destructive' });
      return;
    }
    try {
      const dataUrl = await compressImageFile(file);
      if (dataUrl.length > MAX_PHOTO_DATA_URL_LENGTH) {
        toast({ title: 'That photo is too large. Try a smaller one.', variant: 'destructive' });
        return;
      }
      setProofPhoto(dataUrl);
    } catch (error) {
      toast({ title: 'Could not add that photo', description: error.message, variant: 'destructive' });
    }
  };

  const handleSubmitCompletion = async (taskId) => {
    if (submittingId === taskId) return;
    setSubmittingId(taskId);
    try {
      await db.entities.Task.submit(taskId, { proofText: proofText.trim(), proofPhotoUrl: proofPhoto });
      toast({ title: 'Sent to your parent for approval.' });
      resetProofForm();
      await loadTasks();
      await refreshAssignedTaskCount?.();
    } catch (error) {
      toast({
        title: 'Could not submit task',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingId(null);
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

  return (
    <div className="space-y-6">
      <div className="finn-card">
        <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
          <ListChecks className="w-6 h-6 text-sky-600" />
          Tasks
        </h1>
        <p className="text-sm text-muted-foreground font-semibold mt-1">
          Complete tasks from your parent to earn money.
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-800">To Do</h2>
        {assignedTasks.length === 0 ? (
          <div className="finn-card text-sm text-muted-foreground font-semibold text-center py-10">
            No tasks assigned right now.
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
                  <p className="font-extrabold text-slate-800">{task.name}</p>
                  <span className="text-2xl font-extrabold text-slate-800">
                    {formatCurrency(task.amount)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-semibold">{task.description}</p>
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Assigned {formatDateTime(task.createdAt)}
                </p>

                {expandedTaskId !== task.id ? (
                  <Button type="button" className="w-full" onClick={() => handleStartComplete(task.id)}>
                    Mark Complete
                  </Button>
                ) : (
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <div className="space-y-2 pt-3">
                      <Label htmlFor={`proof-text-${task.id}`}>Proof of completion (optional)</Label>
                      <Textarea
                        id={`proof-text-${task.id}`}
                        value={proofText}
                        onChange={(event) => setProofText(event.target.value)}
                        placeholder="Describe what you did..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Photo proof (optional)</Label>
                      {proofPhoto ? (
                        <div className="relative inline-block">
                          <img src={proofPhoto} alt="Proof preview" className="h-24 rounded-xl border border-slate-200" />
                          <button
                            type="button"
                            onClick={() => setProofPhoto('')}
                            className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 text-sm font-semibold text-sky-700 cursor-pointer">
                          <Camera className="w-4 h-4" />
                          Add a photo
                          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                        </label>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="flex-1"
                        disabled={submittingId === task.id}
                        onClick={() => handleSubmitCompletion(task.id)}
                      >
                        {submittingId === task.id ? 'Sending...' : 'Submit for Approval'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetProofForm}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {submittedTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-slate-800">Waiting for Approval</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {submittedTasks.map((task) => (
              <div
                key={task.id}
                ref={(el) => { taskRefs.current[task.id] = el; }}
                className={`finn-card space-y-3 ${highlightClass(task.id)}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-extrabold text-slate-800">{task.name}</p>
                  <span className="text-2xl font-extrabold text-slate-800">
                    {formatCurrency(task.amount)}
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-semibold">{task.description}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-sky-100 text-sky-700">
                  <Hourglass className="w-3.5 h-3.5" />
                  Waiting for your parent
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                    <p className="text-sm font-bold text-slate-800 truncate">{task.name}</p>
                    <p className="text-xs text-muted-foreground font-semibold">
                      {formatDateTime(task.resolvedAt || task.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-extrabold text-slate-800">{formatCurrency(task.amount)}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_STYLES[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
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
