import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { AgentFeedback } from '@/types'

export type FeedbackSort = 'recent' | 'top'

export function useAgentFeedback(sort: FeedbackSort) {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['agent-feedback', sort, user?.id],
    queryFn: async () => {
      const { data: feedbackData, error: feedbackError } = await supabase
        .from('agent_feedback')
        .select('*')
        .order('created_at', { ascending: false })
      if (feedbackError) throw feedbackError

      const { data: votesData, error: votesError } = await supabase
        .from('agent_feedback_votes')
        .select('feedback_id, user_id')
      if (votesError) throw votesError

      const voteCountByFeedback = new Map<string, number>()
      const userVotedFeedbackIds = new Set<string>()
      for (const v of votesData ?? []) {
        voteCountByFeedback.set(v.feedback_id, (voteCountByFeedback.get(v.feedback_id) ?? 0) + 1)
        if (v.user_id === user?.id) userVotedFeedbackIds.add(v.feedback_id)
      }

      const items: AgentFeedback[] = (feedbackData ?? []).map((f) => ({
        ...f,
        vote_count: voteCountByFeedback.get(f.id) ?? 0,
        has_voted: userVotedFeedbackIds.has(f.id),
      }))

      if (sort === 'recent') {
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      } else {
        items.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
      }
      return items
    },
    enabled: !!user?.id,
  })

  const create = useMutation({
    mutationFn: async ({
      content,
      isAnonymous,
    }: {
      content: string
      isAnonymous: boolean
    }) => {
      let authorDisplay: string | null = null
      if (!isAnonymous) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user!.id)
          .maybeSingle()
        authorDisplay = (profile?.full_name?.trim() || user!.email) ?? null
      }
      const { data, error } = await supabase
        .from('agent_feedback')
        .insert({
          author_id: isAnonymous ? null : user!.id,
          author_display: authorDisplay,
          content,
        })
        .select()
        .single()
      if (error) throw error
      return data as AgentFeedback
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-feedback'] })
    },
  })

  const toggleVote = useMutation({
    mutationFn: async ({
      feedbackId,
      hasVoted,
    }: {
      feedbackId: string
      hasVoted: boolean
    }) => {
      if (hasVoted) {
        const { error } = await supabase
          .from('agent_feedback_votes')
          .delete()
          .eq('feedback_id', feedbackId)
          .eq('user_id', user!.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('agent_feedback_votes').insert({
          feedback_id: feedbackId,
          user_id: user!.id,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-feedback'] })
    },
  })

  return { ...query, create, toggleVote }
}
