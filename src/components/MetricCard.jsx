const MetricCard = ({ title, count, icon }) => {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_25px_80px_rgba(15,23,42,0.12)]">
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-3xl bg-emerald-50 text-3xl text-emerald-700 shadow-sm">
        {icon}
      </div>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
        {title}
      </h3>
      <p className="mt-3 text-3xl font-bold text-slate-900">{count.toLocaleString()}</p>
    </div>
  );
};

export default MetricCard;
