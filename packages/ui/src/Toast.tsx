import { PALETTE, RADIUS, SPACING, TYPOGRAPHY } from "@sunday/design";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type ToastTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface ToastOptions {
  /** Semantic tone. Default `neutral`. */
  tone?: ToastTone;
  /** Auto-dismiss after this many ms; `0`/omitted with `dangerous` stays until dismissed. Default 5000. */
  durationMs?: number;
}

export interface Toast extends Required<Pick<ToastOptions, "tone">> {
  id: string;
  message: ReactNode;
  durationMs: number;
}

export interface ToastApi {
  /** Push a toast; returns its id (so the caller can dismiss it early). */
  show: (message: ReactNode, options?: ToastOptions) => string;
  /** Dismiss a specific toast. */
  dismiss: (id: string) => void;
  /** Dismiss every toast. */
  clear: () => void;
  /** Current toasts (most recent last). */
  toasts: readonly Toast[];
}

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast API. Throws if used outside a {@link ToastProvider}. */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a <ToastProvider>");
  return ctx;
}

export interface ToastProviderProps {
  children?: ReactNode;
  /** Default auto-dismiss duration (ms) when not given per-toast. Default 5000. */
  defaultDurationMs?: number;
  /** Render the visual stack (an `aria-live` region). Default true. */
  renderViewport?: boolean;
}

/**
 * Provides the {@link useToast} API to its subtree and (by default) renders the
 * toast stack in an `aria-live="polite"` region so screen readers announce new
 * messages. Auto-dismiss timers are tracked per-toast and cleared on manual
 * dismiss/unmount. Pure React + inline tokens — no portal, no bundler.
 */
export function ToastProvider(props: ToastProviderProps): ReactNode {
  const { children, defaultDurationMs = 5000, renderViewport = true } = props;
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle !== undefined) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
    for (const handle of timers.current.values()) clearTimeout(handle);
    timers.current.clear();
  }, []);

  const show = useCallback(
    (message: ReactNode, options?: ToastOptions): string => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      const tone = options?.tone ?? "neutral";
      const durationMs = options?.durationMs ?? defaultDurationMs;
      setToasts((prev) => [...prev, { id, message, tone, durationMs }]);
      if (durationMs > 0 && typeof setTimeout !== "undefined") {
        const handle = setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, handle);
      }
      return id;
    },
    [defaultDurationMs, dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ show, dismiss, clear, toasts }), [show, dismiss, clear, toasts]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {renderViewport ? <ToastViewport toasts={toasts} onDismiss={dismiss} /> : null}
    </ToastContext.Provider>
  );
}

const TONE_STYLE: Record<ToastTone, CSSProperties> = {
  neutral: { background: PALETTE.neutral[800], color: PALETTE.neutral[50] },
  success: { background: PALETTE.status.success, color: "#ffffff" },
  warning: { background: PALETTE.status.warning, color: "#ffffff" },
  danger: { background: PALETTE.status.danger, color: "#ffffff" },
  info: { background: PALETTE.status.info, color: "#ffffff" },
};

interface ToastViewportProps {
  toasts: readonly Toast[];
  onDismiss: (id: string) => void;
}

/** The visual toast stack — an `aria-live` region anchored bottom-right. */
function ToastViewport(props: ToastViewportProps): ReactNode {
  const { toasts, onDismiss } = props;
  const region: CSSProperties = {
    position: "fixed",
    bottom: SPACING[4],
    right: SPACING[4],
    display: "flex",
    flexDirection: "column",
    gap: SPACING[2],
    zIndex: 1100,
    maxWidth: "calc(100vw - 2rem)",
  };
  return (
    <div role="region" aria-label="Notifications" aria-live="polite" data-sunday-toasts="" style={region}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "danger" ? "alert" : "status"}
          data-tone={toast.tone}
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACING[3],
            padding: `${SPACING[2]} ${SPACING[3]}`,
            borderRadius: RADIUS.md,
            fontFamily: TYPOGRAPHY.fontFamily.sans,
            fontSize: TYPOGRAPHY.fontSize.sm,
            boxShadow: "0 4px 16px rgba(15,23,42,0.25)",
            ...TONE_STYLE[toast.tone],
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => onDismiss(toast.id)}
            style={{
              appearance: "none",
              border: "none",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: TYPOGRAPHY.fontSize.base,
              lineHeight: 1,
              opacity: 0.85,
            }}
          >
            {"×"}
          </button>
        </div>
      ))}
    </div>
  );
}
