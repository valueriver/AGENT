import { useEffect, useState } from "react";

const DEFAULT_FORM = {
  apiUrl: "",
  apiKey: "",
  model: "",
  contextTurns: 10,
};

const normalizeForm = (config) => ({
  apiUrl: config?.apiUrl || "",
  apiKey: config?.apiKey || "",
  model: config?.model || "",
  contextTurns: Number.isInteger(Number(config?.contextTurns))
    ? Math.max(0, Number(config.contextTurns))
    : 10,
});

export function Settings({ isOpen, onClose, onSave, currentConfig }) {
  const [activeTab, setActiveTab] = useState("model");
  const [form, setForm] = useState(DEFAULT_FORM);

  useEffect(() => {
    if (isOpen) {
      setForm(normalizeForm(currentConfig));
    }
  }, [isOpen, currentConfig]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      contextTurns: Math.max(0, parseInt(form.contextTurns, 10) || 0),
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto">
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

        <div className="px-5 sm:px-6 pt-4">
          <div className="inline-flex rounded-lg bg-gray-800 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("model")}
              className={`px-4 py-2 rounded-md text-sm transition-colors ${
                activeTab === "model" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              模型
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("context")}
              className={`px-4 py-2 rounded-md text-sm transition-colors ${
                activeTab === "context" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
              }`}
            >
              上下文
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {activeTab === "model" && (
            <>
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

              <div className="text-xs text-gray-500 bg-gray-800/50 p-3 rounded-lg">
                <p>配置会保存在本地数据库中。</p>
                <p className="mt-1">支持兼容 OpenAI 格式的接口。</p>
              </div>
            </>
          )}

          {activeTab === "context" && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  上下文轮数
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.contextTurns}
                  onChange={(e) => setForm({ ...form, contextTurns: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>

              <div className="text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg space-y-1">
                <p>按最近 N 条用户消息裁剪上下文。</p>
                <p>`10` 表示保留最近 10 轮用户输入及其后续消息。</p>
                <p>`0` 表示不限制，加载当前会话全部历史。</p>
              </div>
            </>
          )}

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
