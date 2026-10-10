export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading RFP" className="detail">
      <div className="detail-header">
        <div className="skeleton" style={{ width: 120, height: 12 }} />
        <div className="skeleton" style={{ width: "55%", height: 22, marginTop: 14 }} />
        <div className="meta-row">
          {[110, 130, 80].map((width) => <span className="skeleton" key={width} style={{ width, height: 26, borderRadius: 999 }} />)}
        </div>
        <div className="tabs" style={{ height: 38 }} />
      </div>
      <div className="detail-body">
        <div className="documents">
          <div className="library">
            <div className="library-top"><div className="skeleton" style={{ height: 34, borderRadius: 6 }} /></div>
            <div className="library-list">
              {Array.from({ length: 7 }, (_, index) => (
                <div className="doc-item" key={index}>
                  <span className="skeleton" style={{ width: 28, height: 28, borderRadius: 6 }} />
                  <span>
                    <span className="skeleton" style={{ display: "block", width: `${85 - index * 6}%`, height: 12 }} />
                    <span className="skeleton" style={{ display: "block", width: 100, height: 10, marginTop: 6 }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="reader" />
        </div>
      </div>
    </div>
  );
}
