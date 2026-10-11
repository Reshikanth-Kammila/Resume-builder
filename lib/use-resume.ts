"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, contentSignature } from "./api";
import type { Master, Resume } from "./types";

export function useResume(onError: (message: string) => void) {
  const [resume, setResume] = useState<Resume | null>(null);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<
    "saved" | "saving" | "unsaved" | "error"
  >("saved");
  const [history, setHistory] = useState({ undo: 0, redo: 0 });
  const current = useRef<Resume | null>(null);
  const revisionRef = useRef(0);
  const persisted = useRef("");
  const undoStack = useRef<Resume[]>([]);
  const redoStack = useRef<Resume[]>([]);
  const inFlight = useRef<Promise<void> | null>(null);
  const errorHandler = useRef(onError);
  useEffect(() => {
    errorHandler.current = onError;
  }, [onError]);
  const load = useCallback((value: Master) => {
    current.current = value.resume;
    revisionRef.current = value.revision_id;
    persisted.current = contentSignature(value.resume);
    undoStack.current = [];
    redoStack.current = [];
    setHistory({ undo: 0, redo: 0 });
    setResume(value.resume);
    setRevision(value.revision_id);
    setSaveState("saved");
  }, []);
  const update = useCallback((mutate: (draft: Resume) => void) => {
    if (!current.current) return;
    const next = structuredClone(current.current);
    mutate(next);
    if (contentSignature(next) === contentSignature(current.current)) return;
    undoStack.current.push(current.current);
    undoStack.current = undoStack.current.slice(-80);
    redoStack.current = [];
    current.current = next;
    setResume(next);
    setSaveState("unsaved");
    setHistory({ undo: undoStack.current.length, redo: 0 });
  }, []);
  const flush = useCallback(async () => {
    if (inFlight.current) return inFlight.current;
    if (
      !current.current ||
      contentSignature(current.current) === persisted.current
    )
      return;
    const task = async () => {
      setSaveState("saving");
      try {
        while (
          current.current &&
          contentSignature(current.current) !== persisted.current
        ) {
          const snapshot = current.current;
          const signature = contentSignature(snapshot);
          const saved = await api<Master>("/master", {
            method: "PUT",
            body: JSON.stringify({
              resume: snapshot,
              base_revision_id: revisionRef.current,
              label: "Resume edited",
            }),
          });
          revisionRef.current = saved.revision_id;
          setRevision(saved.revision_id);
          persisted.current = signature;
          if (
            current.current &&
            contentSignature(current.current) === signature
          ) {
            current.current = saved.resume;
            setResume(saved.resume);
          }
        }
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        errorHandler.current(
          error instanceof Error ? error.message : "Saving failed.",
        );
        throw error;
      } finally {
        inFlight.current = null;
      }
    };
    inFlight.current = task();
    return inFlight.current;
  }, []);
  useEffect(() => {
    if (!resume || contentSignature(resume) === persisted.current) return;
    const timer = setTimeout(() => {
      void flush().catch(() => undefined);
    }, 750);
    return () => clearTimeout(timer);
  }, [resume, flush]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (
        current.current &&
        contentSignature(current.current) !== persisted.current
      ) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const travel = useCallback((direction: "undo" | "redo") => {
    const source = direction === "undo" ? undoStack : redoStack;
    const target = direction === "undo" ? redoStack : undoStack;
    const next = source.current.pop();
    if (!next || !current.current) return;
    target.current.push(current.current);
    current.current = next;
    setResume(next);
    setSaveState("unsaved");
    setHistory({
      undo: undoStack.current.length,
      redo: redoStack.current.length,
    });
  }, []);
  return {
    resume,
    revision,
    saveState,
    history,
    update,
    flush,
    load,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
  };
}
