"use client";
import { useEffect, useRef, useState } from "react";
import { Expand, FileCheck2, Minimize2, ScanLine } from "lucide-react";
import type { Resume } from "@/lib/types";
import { Button } from "./ui/button";

export function ResumePreview({
  resume,
  focus = false,
  onToggleFocus,
}: {
  resume: Resume;
  focus?: boolean;
  onToggleFocus?: () => void;
}) {
  const [html, setHtml] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState("fit");
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(1123);
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const scale =
    zoom === "fit"
      ? Math.min(1, Math.max(0.2, (width - 64) / 794))
      : Number(zoom);
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(entries[0].contentRect.width),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(resume),
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error("Preview unavailable. Your content is still safe.");
        setHtml(await response.text());
        setError("");
      } catch (error) {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Preview failed.");
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [resume]);
  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (doc)
      void doc.fonts.ready.then(() =>
        setHeight(
          Math.max(
            1123,
            doc.querySelector<HTMLElement>(".document")?.scrollHeight || 1123,
          ),
        ),
      );
  };
  return (
    <div className={`preview-pane ${focus ? "preview-focused" : ""}`}>
      <div className="preview-toolbar">
        <div className="preview-label">
          <span className="live-dot" />
          LIVE PREVIEW
        </div>
        <div className="preview-controls">
          <span className="preview-format">
            A4 <span>·</span> Segoe UI
          </span>
          <select
            aria-label="Preview zoom"
            value={zoom}
            onChange={(e) => setZoom(e.target.value)}
          >
            <option value="fit">Fit to width</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
          </select>
          {onToggleFocus && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={focus ? "Exit focus mode" : "Focus preview"}
              onClick={onToggleFocus}
            >
              {focus ? <Minimize2 size={16} /> : <Expand size={16} />}
            </Button>
          )}
        </div>
      </div>
      <div className="preview-scroll" ref={container}>
        {error ? (
          <div className="empty-state">
            <ScanLine size={32} />
            <h3>Let’s reconnect your preview</h3>
            <p>{error}</p>
          </div>
        ) : (
          <>
            <div
              className="paper-wrap"
              style={{ width: 794 * scale, height: height * scale }}
            >
              {html ? (
                <iframe
                  ref={frame}
                  title="Live A4 resume preview"
                  srcDoc={html}
                  sandbox="allow-same-origin"
                  onLoad={measure}
                  scrolling="no"
                  style={{ width: 794, height, transform: `scale(${scale})` }}
                />
              ) : (
                <div className="paper-loading">
                  <div className="skeleton-line long" />
                  <div className="skeleton-line" />
                  <div className="skeleton-block" />
                </div>
              )}
            </div>
            <div className="preview-footnote">
              <FileCheck2 size={14} />
              A4 layout · Selectable text · Page breaks verified on export
            </div>
          </>
        )}
      </div>
    </div>
  );
}
