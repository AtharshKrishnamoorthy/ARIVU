/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Copy as CopyIcon, Check, MoreVertical,
  Trash2, Edit, ChevronRight, Database, Clock
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { SavedQuery } from "@services/types";
import { deleteSavedQuery } from "@services/api";

interface SavedQueryCardProps {
  query: SavedQuery;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onClick?: () => void;
}

export function SavedQueryCard({
  query,
  onDelete,
  onEdit,
  onClick,
}: SavedQueryCardProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopySQL = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(query.sql);
    setCopied(true);
    toast.success("SQL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSavedQuery(query.id);
      toast.success("Query deleted");
      onDelete?.(query.id);
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete query");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(query.id);
  };

  const timeAgo = formatDistanceToNow(new Date(query.created_at * 1000), {
    addSuffix: true,
  });

  return (
    <>
      <div
        onClick={onClick}
        className="group relative flex flex-col h-full border border-border/40 rounded-lg bg-card hover:bg-card/80 hover:border-primary/30 transition-all duration-200 overflow-hidden cursor-pointer shadow-sm hover:shadow-md"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-3.5 border-b border-border/40 bg-muted/20">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-1.5 mb-1">
              <Database className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">
                Query
              </span>
            </div>
            <h3 className="text-sm font-semibold text-foreground line-clamp-2 break-words">
              {query.query || "Untitled Query"}
            </h3>
          </div>

          {/* Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={handleEdit} className="gap-2">
                <Edit className="w-4 h-4" />
                Edit Notes
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleCopySQL}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    Copied!
                  </>
                ) : (
                  <>
                    <CopyIcon className="w-4 h-4" />
                    Copy SQL
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleDelete}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* SQL Preview */}
        <div className="flex-1 px-3.5 py-3 overflow-hidden">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            SQL
          </div>
          <pre className="text-xs font-mono text-teal-600 dark:text-teal-400 whitespace-pre-wrap break-words overflow-hidden text-ellipsis line-clamp-3">
            {query.sql}
          </pre>
        </div>

        {/* Notes Preview */}
        {query.notes && (
          <div className="px-3.5 py-3 border-t border-border/40 bg-muted/10">
            <div className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">
              Insights
            </div>
            <div className="text-xs text-foreground/70 line-clamp-2 break-words leading-relaxed">
              {query.notes.replace(/<[^>]*>/g, " ").substring(0, 150)}
              {query.notes.replace(/<[^>]*>/g, " ").length > 150 ? "..." : ""}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>{timeAgo}</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Saved Query?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The saved query "{query.query}" will
              be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 pt-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
