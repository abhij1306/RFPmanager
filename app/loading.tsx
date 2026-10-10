export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading RFPs" className="page">
      <header className="page-header">
        <div>
          <div className="skeleton" style={{ width: 90, height: 26 }} />
          <div className="skeleton" style={{ width: 320, height: 14, marginTop: 10 }} />
        </div>
        <div className="skeleton" style={{ width: 96, height: 32, borderRadius: 6 }} />
      </header>
      <div className="list-toolbar">
        <div className="skeleton" style={{ width: 420, height: 34, borderRadius: 6 }} />
      </div>
      <div className="rfp-table">
        <div className="rfp-table-head" />
        {Array.from({ length: 8 }, (_, index) => (
          <div className="rfp-row" key={index}>
            <span className="rfp-row-title">
              <span className="skeleton" style={{ width: `${70 - index * 5}%`, height: 13 }} />
              <span className="skeleton" style={{ width: 90, height: 11, marginTop: 7 }} />
            </span>
            <span className="skeleton" style={{ width: 90, height: 13 }} />
            <span className="skeleton" style={{ width: 28, height: 13, justifySelf: "end" }} />
            <span className="skeleton" style={{ width: 60, height: 13, justifySelf: "end" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
