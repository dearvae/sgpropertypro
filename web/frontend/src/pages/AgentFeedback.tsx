import { useState } from 'react'
import { useAgentFeedback, type FeedbackSort } from '@/hooks/useAgentFeedback'
import type { AgentFeedback } from '@/types'

export function AgentFeedbackSection() {
  const [sort, setSort] = useState<FeedbackSort>('recent')
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const feedback = useAgentFeedback(sort)

  const handleSubmit = async () => {
    if (!content.trim()) {
      alert('请输入建议或反馈内容')
      return
    }
    try {
      await feedback.create.mutateAsync({ content: content.trim(), isAnonymous })
      setContent('')
      setIsAnonymous(false)
    } catch (e) {
      alert((e as Error).message)
    }
  }

  const handleVote = (item: AgentFeedback) => {
    if (feedback.toggleVote.isPending) return
    feedback.toggleVote.mutate({
      feedbackId: item.id,
      hasVoted: !!item.has_voted,
    })
  }

  const items = feedback.data ?? []

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-stone-700">建议与反馈</h2>
        <div className="flex gap-1 border border-stone-200 rounded-sm p-0.5">
          <button
            onClick={() => setSort('recent')}
            className={`px-3 py-1.5 text-sm rounded-sm ${
              sort === 'recent' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            按最近时间
          </button>
          <button
            onClick={() => setSort('top')}
            className={`px-3 py-1.5 text-sm rounded-sm ${
              sort === 'top' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            按支持最多
          </button>
        </div>
      </div>

      {/* 提交表单 */}
      <div className="mb-6 p-4 border border-stone-200 rounded-sm bg-white space-y-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="分享您的建议或反馈..."
          rows={4}
          className="w-full px-3 py-2 border border-stone-200 rounded-sm text-sm resize-none focus:outline-none focus:ring-1 focus:ring-stone-400"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="rounded border-stone-300"
            />
            匿名提交
          </label>
          <button
            onClick={handleSubmit}
            disabled={feedback.create.isPending || !content.trim()}
            className="text-sm px-4 py-2 border border-stone-300 rounded-sm hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {feedback.create.isPending ? '提交中...' : '提交'}
          </button>
        </div>
      </div>

      {/* 反馈列表 */}
      <div className="space-y-3">
        {feedback.isLoading ? (
          <div className="py-12 text-center text-stone-500 text-sm">加载中...</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-stone-500 text-sm border border-dashed border-stone-200 rounded-sm">
            暂无建议或反馈
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="border border-stone-200 rounded-sm bg-white p-4 flex gap-4"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-stone-900 whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs text-stone-500 mt-2">
                  {item.author_display ? item.author_display : '匿名'} ·{' '}
                  {new Date(item.created_at).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                onClick={() => handleVote(item)}
                disabled={feedback.toggleVote.isPending}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-sm border transition-colors ${
                  item.has_voted
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-stone-200 hover:bg-stone-50 text-stone-600'
                } disabled:opacity-50`}
                title={item.has_voted ? '取消支持' : '支持 +1'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-4 h-4 ${item.has_voted ? 'text-amber-600' : ''}`}
                >
                  <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM12.378 13.5a.75.75 0 01.75-.75h.008a.75.75 0 01.75.75v.008a.75.75 0 01-.75.75h-.008a.75.75 0 01-.75-.75V13.5z" />
                </svg>
                <span>{item.vote_count ?? 0}</span>
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
