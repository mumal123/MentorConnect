"use client";

import { useRef, useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check, Loader2, AlertCircle } from "lucide-react";
import { updateBio } from "@/app/actions/profile";

interface InlineBioEditorProps {
  initialBio: string | null;
}

export function InlineBioEditor({ initialBio }: InlineBioEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState(initialBio ?? "");
  const [savedBio, setSavedBio] = useState(initialBio ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEdit = () => {
    setIsEditing(true);
    setStatus("idle");
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSave = () => {
    if (bio.trim() === savedBio.trim()) {
      setIsEditing(false);
      return;
    }

    startTransition(async () => {
      const result = await updateBio(bio);
      if (result.success) {
        setSavedBio(bio.trim());
        setStatus("saved");
        setIsEditing(false);
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Failed to save.");
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      setBio(savedBio);
      setIsEditing(false);
    }
    // Cmd/Ctrl+Enter to save
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      handleSave();
    }
  };

  return (
    <div className="mt-4 group">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Bio</h3>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md p-1 hover:bg-accent text-muted-foreground hover:text-foreground"
            aria-label="Edit bio"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <AnimatePresence>
          {status === "saved" && (
            <motion.span
              key="saved"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1 text-xs text-emerald-500 font-medium"
            >
              <Check className="h-3.5 w-3.5" />
              Saved
            </motion.span>
          )}
          {status === "error" && (
            <motion.span
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 text-xs text-red-500"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              {errorMsg}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {isEditing ? (
          <motion.div
            key="editing"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            <textarea
              ref={textareaRef}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Tell your mentees a bit about yourself — your journey, expertise, and what you love to help with..."
              className="w-full rounded-lg border border-primary/50 bg-accent/50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-muted-foreground">
                Press <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] border border-border">Esc</kbd> to cancel ·{" "}
                <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] border border-border">⌘ Enter</kbd> to save
              </p>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                {isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="display"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {savedBio ? (
              <p
                onClick={handleEdit}
                className="text-sm whitespace-pre-wrap cursor-pointer rounded-lg px-3 py-2 -mx-3 hover:bg-accent/60 transition-colors leading-relaxed"
                title="Click to edit bio"
              >
                {savedBio}
              </p>
            ) : (
              <button
                onClick={handleEdit}
                className="text-sm text-muted-foreground italic hover:text-foreground transition-colors px-3 py-2 -mx-3 rounded-lg hover:bg-accent/60 w-full text-left"
              >
                + Add a bio — click to write about yourself…
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
