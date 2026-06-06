/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Save, 
  Loader2, 
  Database, 
  Calendar, 
  Clock, 
  Copy, 
  Check,
  ChevronRight,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SavedQuery } from "@services/types";
import { getSavedQuery, updateSavedQueryNotes } from "@services/api";
import { RichTextEditor } from "@/components/RichTextEditor";
import { motion } from "framer-motion";
import { useDB } from "../../../../db-context";

export default function QueryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { alias } = useDB();

  const [query, setQuery] = useState<SavedQuery | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [notesContent, setNotesContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) {
      loadQuery();
    }
  }, [id]);

  const loadQuery = async () => {
    setLoading(true);
    try {
      const result = await getSavedQuery(id);
      if (result?.data) {
        setQuery(result.data);
        setNotesContent(result.data.notes || "");
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load query");
      router.push(`/db/${encodeURIComponent(alias)}/queries`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!query) return;

    setIsSaving(true);
    try {
      const result = await updateSavedQueryNotes(query.id, notesContent);
      if (result?.data) {
        setQuery(result.data);
        toast.success("Notes saved successfully");
        setIsEditing(false);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopySQL = () => {
    if (!query) return;
    navigator.clipboard.writeText(query.sql);
    setCopied(true);
    toast.success("SQL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading query details...</p>
      </div>
    );
  }

  if (!query) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => router.push(`/db/${encodeURIComponent(alias)}/queries`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Database className="h-6 w-6 text-primary/70" />
              {query.query}
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={isEditing ? "outline" : "secondary"}
            onClick={() => setIsEditing(!isEditing)}
            className="gap-2"
          >
            {isEditing ? "Cancel" : "Edit Notes"}
          </Button>
          
          {isEditing && (
            <Button
              onClick={handleSaveNotes}
              disabled={isSaving}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* SQL Block */}
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider">SQL Query</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleCopySQL}
                  className="h-7 gap-1.5 hover:bg-background"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-xs font-medium">{copied ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <div className="p-4 bg-muted/5">
                <pre className="text-sm font-mono text-teal-600 dark:text-teal-400 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
                  {query.sql}
                </pre>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-3">
              <h2 className="text-xl font-semibold flex items-center gap-2 px-1">
                Insights & Documentation
              </h2>
              
              <div className={`rounded-xl overflow-hidden transition-all duration-200 border ${isEditing ? 'border-primary ring-2 ring-primary/10' : 'border-border'}`}>
                <RichTextEditor
                  value={notesContent}
                  onChange={setNotesContent}
                  placeholder="Share the context, methodology, or insights found in this query..."
                  minHeight="min-h-[500px]"
                  readOnly={!isEditing}
                  onSave={handleSaveNotes}
                  isSaving={isSaving}
                  disabled={!isEditing}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-xl border border-border bg-card p-6 space-y-6 sticky top-6 shadow-sm"
          >
            <div className="space-y-4">
              <h3 className="font-semibold text-sm flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <Info className="w-4 h-4" />
                Query Metadata
              </h3>
              
              <div className="space-y-5 pt-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Status</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-sm font-medium">Saved to Library</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Created</span>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    {new Date(query.created_at * 1000).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Last Modified</span>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    {new Date(query.updated_at * 1000).toLocaleDateString()}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Session ID</span>
                  <span className="text-xs font-mono truncate bg-muted px-2 py-1.5 rounded-lg border border-border/40 text-muted-foreground/80">
                    {query.session_id}
                  </span>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="p-3.5 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground leading-relaxed italic">
                    This query and its insights are persistent. You can edit the documentation at any time to keep your findings up to date.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
