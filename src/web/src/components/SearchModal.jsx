import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Pagination } from "./Pagination";

export function SearchModal({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const doSearch = useCallback(async (q, p = 1) => {
    if (!q.trim()) {
      setResults([]);
      setTotalPages(1);
      return;
    }
    setLoading(true);
    try {
      const res = await api.search(q, p);
      if (res.ok) {
        setResults(res.results || []);
        setTotalPages(res.totalPages || 1);
        setPage(res.page || 1);
      }
    } catch (err) {
      console.error("Search error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (query) {
      const timer = setTimeout(() => doSearch(query), 300);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
      setTotalPages(1);
    }
  }, [query, doSearch]);

  const handleResultClick = (baseId) => {
    navigate(`/base/${baseId}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl animate-fade-in">
        {/* 搜索框 */}
        <div className="p-4 border-b border-gray-800">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索对话内容..."
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
            />
          </div>
        </div>

        {/* 搜索结果 */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500">搜索中...</div>
          ) : results.length === 0 && query ? (
            <div className="p-8 text-center text-gray-500">无结果</div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => handleResultClick(r.baseId)}
                    className="w-full p-4 text-left hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        r.role === "user" ? "bg-blue-900/50 text-blue-300" : "bg-purple-900/50 text-purple-300"
                      }`}>
                        {r.role === "user" ? "用户" : "AI"}
                      </span>
                      <span className="text-xs text-gray-500">
                        会话 #{r.baseId}
                      </span>
                    </div>
                    <p className="text-sm text-gray-300 truncate">
                      {r.content}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-gray-800">
            <Pagination page={page} totalPages={totalPages} onPageChange={(p) => doSearch(query, p)} />
          </div>
        )}

        {/* 底部 */}
        <div className="p-3 border-t border-gray-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
