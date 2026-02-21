import React from "react";
import styles from "./StatsCards.module.css";

function StatCard({ label, value, sub }) {
  return (
    <div className={styles.card}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>{value}</div>
      {sub ? <div className={styles.sub}>{sub}</div> : null}
    </div>
  );
}

export default function StatsCards({ total, responseRate, active, avgDaysSince }) {
  return (
    <section className={styles.grid}>
      <StatCard label="Total applications" value={total} sub="Excludes archived records" />
      <StatCard label="Response rate" value={`${responseRate}%`} sub="Any status beyond Applied" />
      <StatCard label="Active applications" value={active} sub="Excludes Offer and Rejected" />
      <StatCard label="Avg days since application" value={avgDaysSince} />
    </section>
  );
}
