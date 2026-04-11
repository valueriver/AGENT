import { useState } from "react";

export function Sidebar({
  bases,
  activeBase,
  isOpen,
  onToggle,
  onSelectBase,
  onCreateBase,
  onDeleteBase,
  onOpenSettings,
  onOpenSearch,
  basePage,
  baseTotalPages,
  onBasePageChange,
}) {
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <>
      {/* 侧边栏 */}
      <aside
        className={`w-72 lg:w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col`}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <span className="text-xl">💬</span> 
            <span className="hidden sm:inline">会话列表</span>
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSearch}
              className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              title="搜索"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={onToggle}
              className="p-2 lg:hidden text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 新建按钮 */}
        <div className="p-3 border-b border-gray-800">
          <button
            onClick={onCreateBase}
            className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">新建会话</span>
            <span className="sm:hidden">新建</span>
          </button>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto">
          {bases.length === 0 ? (
            <div className="p-4 text-center text-gray-500 text-sm">
              暂无会话
            </div>
          ) : (
            <ul className="divide-y divide-gray-800">
              {bases.map((base) => (
                <li key={base.id} className="group">
                  <div
                    onClick={() => onSelectBase(base)}
                    className={`p-3 cursor-pointer hover:bg-gray-800 transition-colors ${
                      activeBase?.id === base.id ? "bg-gray-800 border-l-2 border-blue-500" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        会话 #{base.id}
                      </span>
                      {confirmDelete === base.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBase(base.id);
                              setConfirmDelete(null);
                            }}
                            className="p-1 text-red-400 hover:text-red-300"
                          >
                            ✓
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(null);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-300"
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(base.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 transition-opacity"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {base.messageCount} 条消息
                    </div>
                    {base.lastModified && (
                      <div className="text-xs text-gray-600 mt-0.5">
                        {new Date(base.lastModified).toLocaleString("zh-CN")}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 底部设置区域 */}
        {baseTotalPages > 1 && (
          <div className="px-3 py-2 border-t border-gray-800">
            <Pagination page={basePage} totalPages={baseTotalPages} onPageChange={onBasePageChange} />
          </div>
        )}
        <div className="p-3 border-t border-gray-800">
          <button
            onClick={onOpenSettings}
            className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm text-gray-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">模型设置</span>
            <span className="sm:hidden">设置</span>
          </button>
        </div>
      </aside>
    </>
  );
}
