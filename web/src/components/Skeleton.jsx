/**
 * Skeleton loading components for each page type
 */

export function StatCardSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-4" style={{ marginBottom: 24 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card" style={{ padding: 20 }}>
          <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)', marginBottom: 12 }} />
          <div className="skeleton skeleton-text" style={{ width: '50%' }} />
          <div className="skeleton" style={{ width: '40%', height: 28, marginTop: 4, borderRadius: 'var(--radius-sm)' }} />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }) {
  return (
    <div className="grid grid-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-card" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div className="skeleton" style={{ width: '100%', height: 20 }} />
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '12px 16px', borderBottom: i < rows - 1 ? '1px solid var(--border-color-light)' : 'none' }}>
          <div className="skeleton skeleton-row" style={{ height: 20, marginBottom: 0 }} />
        </div>
      ))}
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="chart-card">
      <div className="skeleton skeleton-text" style={{ width: '30%', marginBottom: 16 }} />
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="skeleton"
            style={{
              flex: 1,
              height: `${20 + Math.random() * 80}%`,
              borderRadius: '3px 3px 0 0',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: 28 }}>
        <div className="skeleton" style={{ width: 200, height: 30, marginBottom: 8, borderRadius: 'var(--radius-sm)' }} />
        <div className="skeleton" style={{ width: 300, height: 16, borderRadius: 'var(--radius-sm)' }} />
      </div>
      <StatCardSkeleton />
      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        <ChartSkeleton />
        <ChartSkeleton />
      </div>
      <CardSkeleton />
    </div>
  );
}
