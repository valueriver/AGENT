export function Pagination({ page, totalPages, onPageChange, className = "" }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-2 py-1 text-sm rounded disabled:opacity-30 hover:bg-gray-700 disabled:hover:bg-transparent"
      >
        ‹
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onPageChange(1)} className="px-2 py-1 text-sm rounded hover:bg-gray-700">1</button>
          {start > 2 && <span className="px-1 text-gray-500">…</span>}
        </>
      )}
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-2 py-1 text-sm rounded ${
            p === page ? "bg-blue-600 text-white" : "hover:bg-gray-700"
          }`}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-500">…</span>}
          <button onClick={() => onPageChange(totalPages)} className="px-2 py-1 text-sm rounded hover:bg-gray-700">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-2 py-1 text-sm rounded disabled:opacity-30 hover:bg-gray-700 disabled:hover:bg-transparent"
      >
        ›
      </button>
    </div>
  );
}
