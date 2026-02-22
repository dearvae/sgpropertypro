import { useState } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useAgentFeedback, type FeedbackSort } from '@/hooks/useAgentFeedback'
import type { AgentFeedback } from '@/types'

export function AgentFeedbackSection() {
  const [sort, setSort] = useState<FeedbackSort>('recent')
  const [content, setContent] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [visibility, setVisibility] = useState<'all' | 'developer_only'>('all')
  const feedback = useAgentFeedback(sort)
  const { t, i18n } = useTranslation()

  const handleSubmit = async () => {
    if (!content.trim()) {
      message.warning(t('feedback.enterFeedback'))
      return
    }
    try {
      await feedback.create.mutateAsync({ content: content.trim(), isAnonymous, visibility })
      setContent('')
      setIsAnonymous(false)
    } catch (e) {
      message.error((e as Error).message)
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
        <h2 className="text-sm font-medium text-[#2b5843]/90">{t('feedback.title')}</h2>
        <div className="flex gap-1 border border-[#53868e]/25 rounded-full p-0.5">
          <button
            onClick={() => setSort('recent')}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              sort === 'recent' ? 'text-[#f6f3f1]' : 'text-[#2b5843]/80 hover:bg-[#53868e]/10'
            }`}
            style={sort === 'recent' ? { background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' } : undefined}
          >
            {t('feedback.sortRecent')}
          </button>
          <button
            onClick={() => setSort('top')}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              sort === 'top' ? 'text-[#f6f3f1]' : 'text-[#2b5843]/80 hover:bg-[#53868e]/10'
            }`}
            style={sort === 'top' ? { background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' } : undefined}
          >
            {t('feedback.sortTop')}
          </button>
        </div>
      </div>

      <div className="mb-6 p-4 border border-[#53868e]/25 rounded-xl space-y-3" style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t('feedback.placeholder')}
          rows={4}
          className="w-full px-3 py-2 border border-[#53868e]/25 rounded-xl text-sm text-[#2b5843] resize-none focus:outline-none focus:border-[#53868e] focus:ring-1 focus:ring-[#53868e]/30"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-[#2b5843]/80 cursor-pointer">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="rounded border-[#53868e]/40"
              />
              {t('feedback.anonymousSubmit')}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#2b5843]/80">{t('feedback.visibility')}</span>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'all'}
                  onChange={() => setVisibility('all')}
                  className="text-stone-600"
                />
                {t('feedback.visibilityAll')}
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === 'developer_only'}
                  onChange={() => setVisibility('developer_only')}
                  className="text-stone-600"
                />
                {t('feedback.visibilityDeveloper')}
              </label>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={feedback.create.isPending || !content.trim()}
            className="text-sm px-4 py-2 rounded-full text-[#f6f3f1] hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #53868e 0%, #2b5843 100%)' }}
          >
            {feedback.create.isPending ? t('feedback.submitting') : t('feedback.submit')}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {feedback.isLoading ? (
          <div className="py-12 text-center text-[#2b5843]/70 text-sm">{t('common.loading')}</div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-[#2b5843]/70 text-sm border border-dashed border-[#53868e]/25 rounded-xl">
            {t('feedback.noFeedback')}
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="border border-[#53868e]/25 rounded-xl p-4 flex gap-4"
              style={{ background: 'linear-gradient(145deg, #f6f3f1 0%, #ebece8 100%)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#2b5843] whitespace-pre-wrap">{item.content}</p>
                <p className="text-xs text-[#2b5843]/70 mt-2">
                  {item.author_display ? item.author_display : t('common.anonymous')} ·{' '}
                  {new Date(item.created_at).toLocaleString(i18n.language === 'zh' ? 'zh-CN' : 'en-US', {
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
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  item.has_voted
                    ? 'border-[#53868e] text-[#2b5843]'
                    : 'border-[#53868e]/25 hover:bg-[#53868e]/10 text-[#2b5843]/80'
                } disabled:opacity-50`}
                style={item.has_voted ? { background: 'rgba(83,134,142,0.2)' } : undefined}
                title={item.has_voted ? t('feedback.unsupport') : t('feedback.support')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className={`w-4 h-4 ${item.has_voted ? 'text-[#53868e]' : ''}`}
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
