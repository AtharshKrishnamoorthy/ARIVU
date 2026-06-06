/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import {
  Bold, Italic, Underline, List, ListOrdered,
  Heading2, Quote, RotateCcw, Loader2, Save,
  Type, AlignLeft, AlignCenter, AlignRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  disabled?: boolean;
  onSave?: () => void;
  isSaving?: boolean;
  readOnly?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = "min-h-64",
  maxHeight = "max-h-96",
  disabled = false,
  onSave,
  isSaving = false,
  readOnly = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [charCount, setCharCount] = useState(0);
  const [activeStyles, setActiveStyles] = useState<string[]>([]);
  
  // Initialize content
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      if (!value || value === "<p></p>" || value === "<br>") {
        editorRef.current.innerHTML = "";
      } else {
        editorRef.current.innerHTML = value;
      }
      updateStats();
    }
  }, []);

  const updateStats = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || "";
      setCharCount(text.trim().length);
    }
  }, []);

  const checkActiveStyles = useCallback(() => {
    const styles = [];
    if (document.queryCommandState("bold")) styles.push("bold");
    if (document.queryCommandState("italic")) styles.push("italic");
    if (document.queryCommandState("underline")) styles.push("underline");
    if (document.queryCommandState("insertUnorderedList")) styles.push("list");
    if (document.queryCommandState("insertOrderedList")) styles.push("ordered-list");
    setActiveStyles(styles);
  }, []);

  const executeCommand = (command: string, val?: string) => {
    if (readOnly || disabled) return;
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    handleInput();
    checkActiveStyles();
  };

  const handleInput = () => {
    if (editorRef.current) {
      const content = editorRef.current.innerHTML;
      // If it's just empty tags, treat as empty
      if (content === "<p><br></p>" || content === "<br>") {
        onChange("");
      } else {
        onChange(content);
      }
      updateStats();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      executeCommand("insertHTML", "&nbsp;&nbsp;&nbsp;&nbsp;");
    }
    // Check styles on every key press to update UI
    setTimeout(checkActiveStyles, 10);
  };

  const handleReset = () => {
    if (editorRef.current) {
      editorRef.current.innerHTML = "";
      onChange("");
      updateStats();
      editorRef.current.focus();
    }
  };

  const isStyleActive = (style: string) => activeStyles.includes(style);

  return (
    <div className={cn(
      "group flex flex-col w-full border border-border/50 rounded-xl bg-background transition-all duration-200",
      !readOnly && !disabled && "focus-within:border-primary/40 focus-within:shadow-lg focus-within:shadow-primary/5",
      (readOnly || disabled) && "bg-muted/5"
    )}>
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b border-border/40 bg-muted/20 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-0.5 bg-background/50 p-1 rounded-lg border border-border/40">
            <ToolbarButton
              active={isStyleActive("bold")}
              onClick={() => executeCommand("bold")}
              icon={<Bold className="w-4 h-4" />}
              title="Bold (Ctrl+B)"
              disabled={disabled}
            />
            <ToolbarButton
              active={isStyleActive("italic")}
              onClick={() => executeCommand("italic")}
              icon={<Italic className="w-4 h-4" />}
              title="Italic (Ctrl+I)"
              disabled={disabled}
            />
            <ToolbarButton
              active={isStyleActive("underline")}
              onClick={() => executeCommand("underline")}
              icon={<Underline className="w-4 h-4" />}
              title="Underline (Ctrl+U)"
              disabled={disabled}
            />
          </div>

          <div className="w-px h-6 mx-1 bg-border/40" />

          <div className="flex items-center gap-0.5 bg-background/50 p-1 rounded-lg border border-border/40">
            <ToolbarButton
              active={isStyleActive("list")}
              onClick={() => executeCommand("insertUnorderedList")}
              icon={<List className="w-4 h-4" />}
              title="Bullet List"
              disabled={disabled}
            />
            <ToolbarButton
              active={isStyleActive("ordered-list")}
              onClick={() => executeCommand("insertOrderedList")}
              icon={<ListOrdered className="w-4 h-4" />}
              title="Numbered List"
              disabled={disabled}
            />
          </div>

          <div className="w-px h-6 mx-1 bg-border/40" />

          <div className="flex items-center gap-0.5 bg-background/50 p-1 rounded-lg border border-border/40">
            <ToolbarButton
              onClick={() => executeCommand("formatBlock", "<h2>")}
              icon={<Heading2 className="w-4 h-4" />}
              title="Heading 2"
              disabled={disabled}
            />
            <ToolbarButton
              onClick={() => executeCommand("formatBlock", "<blockquote>")}
              icon={<Quote className="w-4 h-4" />}
              title="Blockquote"
              disabled={disabled}
            />
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={disabled || charCount === 0}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Clear all"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            
            {onSave && (
              <Button
                size="sm"
                onClick={onSave}
                disabled={isSaving || disabled}
                className="h-8 gap-2 bg-primary hover:bg-primary/90 shadow-sm"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span className="text-xs font-medium">Save</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className="relative flex-1">
        {/* Real Placeholder */}
        {charCount === 0 && !readOnly && (
          <div className="absolute top-0 left-0 p-4 text-muted-foreground/50 pointer-events-none select-none text-sm italic">
            {placeholder}
          </div>
        )}
        
        <div
          ref={editorRef}
          contentEditable={!readOnly && !disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onMouseUp={checkActiveStyles}
          onKeyUp={checkActiveStyles}
          suppressContentEditableWarning
          className={cn(
            "w-full p-6 outline-none prose prose-sm dark:prose-invert max-w-none text-base leading-relaxed overflow-y-auto",
            minHeight,
            maxHeight,
            (readOnly || disabled) && "cursor-default opacity-90"
          )}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-border/40 bg-muted/10 rounded-b-xl">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <Type className="w-3 h-3" />
            {charCount} Characters
          </span>
          <span className="h-3 w-px bg-border/60" />
          <span>Rich Text Mode</span>
        </div>
        
        {charCount > 4500 && (
          <span className={cn(
            "text-[10px] font-bold uppercase",
            charCount > 5000 ? "text-destructive" : "text-amber-500"
          )}>
            {charCount > 5000 ? "Limit Exceeded" : `${5000 - charCount} chars left`}
          </span>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ active, onClick, icon, title, disabled }: any) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      disabled={disabled}
      className={cn(
        "h-8 w-8 p-0 transition-all duration-200",
        active 
          ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary" 
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
    </Button>
  );
}
