import React, { useMemo } from "react";
import styles from "./ResumeAnalysisPanel.module.css";

function scoreColor(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return styles.scoreNeutral;
  if (n >= 80) return styles.scoreGood;
  if (n >= 60) return styles.scoreOk;
  return styles.scoreLow;
}

function toList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((x) => String(x));
}

export default function ResumeAnalysisPanel({
  open,
  title,
  analysisResult,
  analyzedAt,
  loading,
  error,
  feedback,
  onClose,
  onFeedback
}) {
  const strengths = useMemo(() => toList(analysisResult?.keyStrengths), [analysisResult]);
  const gaps = useMemo(() => toList(analysisResult?.gapsForNextLevel), [analysisResult]);
  const signals = useMemo(() => toList(analysisResult?.senioritySignals), [analysisResult]);
  const alternatives = useMemo(() => {
    const rows = Array.isArray(analysisResult?.alternativeRoles)
      ? analysisResult.alternativeRoles
      : [];
    return rows
      .map((r) => ({
        title: String(r?.title || "").trim(),
        matchScore: Number(r?.matchScore)
      }))
      .filter((r) => r.title);
  }, [analysisResult]);

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="AI resume analysis">
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.kicker}>AI Analysis</div>
            <div className={styles.title}>{title || "Resume"}</div>
          </div>
          <button className={styles.iconButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {loading ? (
            <div className={styles.state}>
              <div className={styles.stateTitle}>Analyzing…</div>
              <div className={styles.stateSub}>Extracting text and generating insights</div>
            </div>
          ) : error ? (
            <div className={styles.stateError}>
              <div className={styles.stateTitle}>Couldn’t analyze this resume</div>
              <div className={styles.stateSub}>{error}</div>
            </div>
          ) : !analysisResult ? (
            <div className={styles.state}>
              <div className={styles.stateTitle}>No analysis yet</div>
              <div className={styles.stateSub}>Click the AI badge to generate an analysis.</div>
            </div>
          ) : (
            <>
              <div className={styles.topGrid}>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Primary role</div>
                  <div className={styles.cardValue}>{analysisResult?.primaryRole || "—"}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Seniority</div>
                  <div className={styles.cardValue}>{analysisResult?.seniorityLevel || "—"}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Confidence</div>
                  <div className={`${styles.score} ${scoreColor(analysisResult?.confidenceScore)}`}>
                    {analysisResult?.confidenceScore ?? "—"}
                    {analysisResult?.confidenceScore != null ? <span className={styles.pct}>%</span> : null}
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Experience</div>
                  <div className={styles.cardValue}>{analysisResult?.yearsOfExperience || "—"}</div>
                </div>
              </div>

              <div className={styles.summary}>{analysisResult?.summary || ""}</div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Key strengths</div>
                {strengths.length === 0 ? (
                  <div className={styles.muted}>—</div>
                ) : (
                  <ul className={styles.strengthList}>
                    {strengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Signals for this level</div>
                {signals.length === 0 ? (
                  <div className={styles.muted}>—</div>
                ) : (
                  <ul className={styles.signalList}>
                    {signals.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Gaps for next level</div>
                {gaps.length === 0 ? (
                  <div className={styles.muted}>—</div>
                ) : (
                  <ul className={styles.gapList}>
                    {gaps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className={styles.section}>
                <div className={styles.sectionTitle}>Alternative roles</div>
                {alternatives.length === 0 ? (
                  <div className={styles.muted}>—</div>
                ) : (
                  <div className={styles.altGrid}>
                    {alternatives.map((r) => (
                      <div key={r.title} className={styles.altRow}>
                        <div className={styles.altTitle}>{r.title}</div>
                        <div className={styles.altScore}>{Number.isFinite(r.matchScore) ? `${r.matchScore}%` : "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {analyzedAt ? (
                <div className={styles.timestamp}>
                  Analyzed {new Date(analyzedAt).toLocaleString()}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.feedbackLabel}>Was this helpful?</div>
          <div className={styles.feedbackButtons}>
            <button
              className={`${styles.feedbackButton} ${feedback === "thumbs_up" ? styles.feedbackActive : ""}`}
              onClick={() => onFeedback?.("thumbs_up")}
              type="button"
              disabled={loading}
              aria-pressed={feedback === "thumbs_up" ? "true" : "false"}
            >
              👍
            </button>
            <button
              className={`${styles.feedbackButton} ${feedback === "thumbs_down" ? styles.feedbackActive : ""}`}
              onClick={() => onFeedback?.("thumbs_down")}
              type="button"
              disabled={loading}
              aria-pressed={feedback === "thumbs_down" ? "true" : "false"}
            >
              👎
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

