import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from './useAuth'
import type { Property } from '@/types'

export function useProperties() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['properties', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('agent_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Property[]
    },
    enabled: !!user?.id,
  })

  const create = useMutation({
    mutationFn: async (p: {
      title: string
      link?: string
      basic_info?: string
      source_url?: string
      price?: string
      size_sqft?: string
      bedrooms?: string
      bathrooms?: string
      main_image_url?: string
      image_urls?: string[]
      floor_plan_url?: string
      listing_agent_name?: string
      listing_agent_phone?: string
      listing_type?: 'sale' | 'rent'
      lease_tenure?: string
      site_plan_url?: string
    }) => {
      const { data, error } = await supabase
        .from('properties')
        .insert({
          agent_id: user!.id,
          title: p.title,
          link: p.link || null,
          basic_info: p.basic_info || null,
          source_url: p.source_url || null,
          price: p.price || null,
          size_sqft: p.size_sqft || null,
          bedrooms: p.bedrooms || null,
          bathrooms: p.bathrooms || null,
          main_image_url: p.main_image_url || null,
          image_urls: p.image_urls ?? null,
          floor_plan_url: p.floor_plan_url || null,
          listing_agent_name: p.listing_agent_name || null,
          listing_agent_phone: p.listing_agent_phone || null,
          listing_type: p.listing_type || null,
          lease_tenure: p.lease_tenure || null,
          site_plan_url: p.site_plan_url || null,
        })
        .select()
        .single()
      if (error) throw error
      return data as Property
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', user?.id] }),
  })

  const findBySourceUrl = async (sourceUrl: string): Promise<Property | null> => {
    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('agent_id', user!.id)
      .eq('source_url', sourceUrl)
      .maybeSingle()
    if (error) throw error
    return data as Property | null
  }

  const update = useMutation({
    mutationFn: async (p: Partial<Property> & { id: string }) => {
      const { id, ...rest } = p
      const { data, error } = await supabase
        .from('properties')
        .update({ ...rest, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Property
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', user?.id] }),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['properties', user?.id] }),
  })

  return { ...query, create, update, remove, findBySourceUrl }
}
