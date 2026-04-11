import { useState } from "react";

export function Settings({ isOpen, onClose, onSave, currentConfig }) {
  const [form, setForm] = useState({
    apiUrl: currentConfig?.apiUrl || "",
    apiKey: currentConfig?.apiKey || "",
    model: currentConfig?.model || "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md animate-fade-in max-h-[90vh] overflow-y-auto">
        {/* 标题 */}
        <div className="px-5 sm:px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="hidden sm:inline">设置</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* API URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              API URL
            </label>
            <input
              type="text"
              value={form.apiUrl}
              onChange={(e) => setForm({ ...form, apiUrl: e.target.value })}
              placeholder="https://api.openai.com/v1/chat/completions"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              模型
            </label>
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              placeholder="gpt-4.1-mini"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              required
            />
          </div>

          {/* 提示 */}
          <div className="text-xs text-gray-500 bg-gray-800/50 p-3 rounded-lg">
            <p>💡 配置将保存到浏览器本地存储中</p>
            <p className="mt-1">支持任何 OpenAI 兼容的 API (OpenAI, DeepSeek, Ollama 等)</p>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
