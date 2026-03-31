import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { subscribeToApplications } from "../services/applications";
import { subscribeToResumes } from "../services/resumes";
import { computeResumePerformance } from "../services/resumePerformance";
import { calcStats, getGreeting } from "../utils/statsCalc";
import styles from "./StatsPanel.module.css";

export default function StatsPanel() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [activeNeedsDataId, setActiveNeedsDataId] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToApplications(
      user.uid,
      (rows) => setApplications(rows),
      () => setApplications([])
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToResumes(
      user.uid,
      (rows) => setResumes(rows),
      () => setResumes([])
    );
    return () => unsub();
  }, [user?.uid]);

  const nonArchived = useMemo(
    () => applications.filter((app) => !app.archivedAt),
    [applications]
  );

  const stats = useMemo(() => calcStats(nonArchived), [nonArchived]);

  const perf = useMemo(
    () => computeResumePerformance(resumes, applications),
    [resumes, applications]
  );

  const resumeRows = useMemo(() => {
    return (resumes || []).map((r) => {
      const p = perf.byId.get(r.id);
      const rate = p?.progressionRate;
      const applicationCount = p?.applications || 0;
      const neededCount = Math.max(0, 5 - applicationCount);
      return {
        id: r.id,
        name: r.versionName || "Untitled",
        rate,
        rateLabel: rate == null ? "needs data" : `${rate}%`,
        applicationCount,
        neededCount
      };
    });
  }, [resumes, perf]);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "there";
  const greeting = getGreeting();

  return (
    <aside className={styles.panel}>
      {/* Greeting */}
      <div>
        <div className={styles.greet}>{greeting}, {displayName}</div>
        <div className={styles.name}>Your Search</div>
      </div>

      {/* Big interview rate card */}
      <div className={styles.bigStat}>
        <div className={styles.bigStatGlow} />
        <div className={styles.bsLabel}>Interview Rate</div>
        <div className={styles.bsValue}>
          {stats.interviewRate}<em className={styles.bsUnit}>%</em>
        </div>
        <div className={styles.bsSub}>
          {stats.interviewReached} of {stats.total} applications reached interview stage
        </div>
        <div className={styles.bsBar}>
          <div
            className={styles.bsFill}
            style={{ width: `${Math.min(stats.interviewRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Compact progression rate card */}
      <div className={[styles.bigStat, styles.compactStat].join(" ")}>
        <div className={styles.bsLabel}>Progression Rate</div>
        <div className={styles.compactValueRow}>
          <div className={styles.compactValue}>
            {stats.progressionRate}<em className={styles.compactUnit}>%</em>
          </div>
          <div className={styles.compactSub}>
            {stats.progressed} of {stats.total} applications progressed past applied
          </div>
        </div>
        <div className={styles.bsBar}>
          <div
            className={styles.bsFill}
            style={{ width: `${Math.min(stats.progressionRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Mini stat grid */}
      <div className={styles.miniGrid}>
        <div className={styles.miniCard}>
          <div className={styles.mcLabel}>Total</div>
          <div className={styles.mcValue}>{stats.total}</div>
          <div className={styles.mcSub}>Applications</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.mcLabel}>Active</div>
          <div className={styles.mcValue}>{stats.active}</div>
          <div className={styles.mcSub}>In progress</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.mcLabel}>Avg Days</div>
          <div className={styles.mcValue}>{stats.avgDaysSince}</div>
          <div className={styles.mcSub}>Since applying</div>
        </div>
        <div className={styles.miniCard}>
          <div className={styles.mcLabel}>Interviewed</div>
          <div className={[styles.mcValue, styles.rust].join(" ")}>{stats.interviews}</div>
          <div className={styles.mcSub}>Ever reached stage</div>
        </div>
      </div>

      {/* Resume performance */}
      {resumeRows.length > 0 ? (
        <div className={styles.resumeBox}>
          <div className={styles.rbTitle}>Resume Performance</div>
          {resumeRows.map((r) => (
            <div key={r.id} className={styles.rbItem}>
              <div className={styles.rbRow}>
                <span className={styles.rbName}>{r.name}</span>
                {r.rate == null ? (
                  <span className={styles.rbPctTooltipWrap}>
                    <button
                      type="button"
                      className={styles.rbPctTrigger}
                      tabIndex={0}
                      aria-describedby={`needs-data-tip-${r.id}`}
                      onMouseEnter={() => setActiveNeedsDataId(r.id)}
                      onMouseLeave={() => setActiveNeedsDataId((curr) => (curr === r.id ? null : curr))}
                      onFocus={() => setActiveNeedsDataId(r.id)}
                      onBlur={() => setActiveNeedsDataId((curr) => (curr === r.id ? null : curr))}
                    >
                      {r.rateLabel}
                    </button>
                    <span
                      id={`needs-data-tip-${r.id}`}
                      role="tooltip"
                      className={[
                        styles.rbTooltip,
                        activeNeedsDataId === r.id ? styles.rbTooltipVisible : ""
                      ].join(" ")}
                    >
                      {r.neededCount} more {r.neededCount === 1 ? "application" : "applications"} needed
                      {" "}({r.applicationCount}/5) to calculate progression rate.
                    </span>
                  </span>
                ) : (
                  <span className={styles.rbPct}>{r.rateLabel}</span>
                )}
              </div>
              <div className={styles.rbBar}>
                {r.rate != null ? (
                  <div
                    className={styles.rbFill}
                    style={{ width: `${Math.min(r.rate, 100)}%` }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  );
}
