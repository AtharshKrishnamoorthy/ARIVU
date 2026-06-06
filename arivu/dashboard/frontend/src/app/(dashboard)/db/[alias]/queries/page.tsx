/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Plus, Loader2, FolderOpen, BookOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SavedQuery } from "@services/types";
import { listSavedQueries, updateSavedQueryNotes } from "@services/api";
import { SavedQueryCard } from "@/components/SavedQueryCardComponent";
import { RichTextEditor } from "@/components/RichTextEditor";
import { useDB } from "../../../db-context";

export default function MyQueriesPage() {
  const router = useRouter();
  const { alias } = useDB();
  const [queries, setQueries] = useState<SavedQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Load saved queries
  useEffect(() => {
    loadQueries();
  }, []);

  const loadQueries = async () => {
    setLoading(true);
    try {
      const result = await listSavedQueries(100, 0);
      if (result?.data) {
        setQueries(result.data);
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load queries");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectQuery = (query: SavedQuery) => {
    router.push(`/db/${encodeURIComponent(alias)}/queries/${query.id}`);
  };

  const handleDeleteQuery = (id: string) => {
    setQueries((prev) => prev.filter((q) => q.id !== id));
  };

  // Filter queries
  const filteredQueries = queries.filter((q) =>
    q.query.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.sql.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.notes.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Queries</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse and manage your {queries.length} saved {queries.length === 1 ? "query" : "queries"}.
          </p>
        </div>
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search queries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[60vh]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading queries...</p>
          </div>
        ) : filteredQueries.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="rounded-full bg-muted p-4 mb-4">
              <FolderOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No queries found</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              {searchTerm
                ? "No queries match your search terms."
                : "Your saved queries will appear here once you save them from the chat."}
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filteredQueries.map((query, index) => (
                <motion.div
                  key={query.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.04 }}
                >
                  <SavedQueryCard
                    query={query}
                    onClick={() => handleSelectQuery(query)}
                    onDelete={handleDeleteQuery}
                    onEdit={() => handleSelectQuery(query)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
