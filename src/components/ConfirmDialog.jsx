import React, { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// A promise-based replacement for window.confirm, rendered with the same
// AlertDialog the rest of the app uses. window.confirm is unstyled, and
// browsers let users suppress it ("prevent this page from creating additional
// dialogs"), after which it returns false silently and the delete button just
// stops working with no explanation.
//
//   const [confirm, confirmDialog] = useConfirm();
//   if (!(await confirm({ title: "Delete this goal?" }))) return;
//   ...
//   return <>{confirmDialog}...</>;
export function useConfirm() {
  // `options` is kept after closing so the text doesn't blank out while the
  // dialog animates away.
  const [state, setState] = useState({ open: false, options: {} });
  const resolveRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setState({ open: true, options });
      }),
    []
  );

  // Every way of closing lands here exactly once: the Action and Cancel
  // buttons settle first, and the dialog's own close (Escape, clicking
  // outside, or the close that follows a button) finds nothing left to settle.
  const settle = (value) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setState((prev) => ({ ...prev, open: false }));
  };

  const { open, options } = state;

  const confirmDialog = (
    <AlertDialog open={open} onOpenChange={(next) => !next && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          {options.description && <AlertDialogDescription>{options.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 text-white hover:bg-red-700" onClick={() => settle(true)}>
            {options.confirmLabel || "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return [confirm, confirmDialog];
}
