/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Check } from "lucide-react";
import { saveSavedQuery } from "@services/api";

interface SaveQueryDialogProps {
  sessionId: string;
  query: string;  // natural language question
  sql: string;    // generated SQL
  onSuccess?: (id: string) => void;
  trigger?: React.ReactNode;  // custom trigger button
}

export function SaveQueryDialog({
  sessionId,
  query,
  sql,
  onSuccess,
  trigger,
}: SaveQueryDialogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!query || !sql) {
      toast.error("Query and SQL are required");
      return;
    }

    setLoading(true);
    try {
      const result = await saveSavedQuery(sessionId, query, sql, notes);
      if (result?.data?.id) {
        setSavedId(result.data.id);
        toast.success("Query saved successfully!");
        setTimeout(() => {
          setOpen(false);
          setNotes("");
          setSavedId(null);
          onSuccess?.(result.data.id);
        }, 1500);
      } else {
        toast.error("Failed to save query");
      }
    } catch (error: any) {
      toast.error(error?.message || "Error saving query");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="ml-2 text-xs text-muted-foreground hover:text-foreground"
            title="Save this query for later reference"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            {savedId ? (
              <>
                <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Check className="w-5 h-5 text-emerald-500" />
                </div>
                Query Saved
              </>
            ) : (
              <>
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Save className="w-4 h-4 text-primary" />
                </div>
                Save Query
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {savedId
              ? "Your query has been saved successfully and is now available in your personal library."
              : "Save this query to your personal library with optional context for future reference."}
          </DialogDescription>
        </DialogHeader>

        {!savedId && (
          <div className="space-y-6 py-4">
            {/* Display Query & SQL (read-only) */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                  Question
                </label>
                <div className="text-sm px-4 py-3 rounded-xl bg-muted/30 border border-border/50 text-foreground leading-relaxed">
                  {query || "(No question)"}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70 flex items-center gap-2">
                  SQL Query
                </label>
                <div className="relative group">
                  <div className="text-[11px] px-4 py-3 rounded-xl bg-muted/50 border border-border/50 font-mono text-teal-600 dark:text-teal-400 max-h-40 overflow-y-auto whitespace-pre-wrap leading-normal scrollbar-thin">
                    {sql || "(No SQL)"}
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Editor */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                Insights & Documentation
              </label>
              <Textarea
                placeholder="Add any notes, methodology, or context for this query..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="resize-none min-h-32 text-sm bg-background border-border/60 focus:ring-2 focus:ring-primary/10 rounded-xl"
              />
              <div className="flex justify-end">
                <p className={`text-[10px] font-medium uppercase tracking-tight ${notes.length > 4500 ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                  {notes.length} / 5000 characters
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setNotes("");
                }}
                className="flex-1 rounded-xl h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 gap-2 rounded-xl h-11 shadow-lg shadow-primary/10"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Query
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
