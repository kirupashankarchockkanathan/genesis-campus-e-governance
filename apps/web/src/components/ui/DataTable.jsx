/** Simple accessible table. `columns` is [{ key, header, render? }]. */
export function DataTable({ columns, rows, caption, empty = 'Nothing to show.', rowKey = (r) => r.id }) {
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col">
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.total <= meta.pageSize) return null;
  const pages = Math.ceil(meta.total / meta.pageSize);
  return (
    <nav className="row" aria-label="Pagination">
      <button className="btn btn-secondary" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        Previous
      </button>
      <span className="muted small" aria-current="page">
        Page {meta.page} of {pages}
      </span>
      <button
        className="btn btn-secondary"
        disabled={meta.page >= pages}
        onClick={() => onPage(meta.page + 1)}
      >
        Next
      </button>
    </nav>
  );
}
