"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DashboardPayload, deriveAgentStatus, deriveEquippedSkills } from "../lib/seo-data";
import { getSupabaseBrowserClient } from "../lib/supabase-browser";

type UseRealtimeSeoDataResult = {
  data: DashboardPayload;
  isRefreshing: boolean;
  statusMap: ReturnType<typeof deriveAgentStatus>;
  skillsMap: ReturnType<typeof deriveEquippedSkills>;
  refreshNow: () => Promise<void>;
  error: string | null;
};

export function useRealtimeSeoData(initialData: DashboardPayload): UseRealtimeSeoDataResult {
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const mountedRef = useRef(true);

  const refreshNow = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);
      const token = await getToken({ template: "supabase" });
      if (!token) {
        throw new Error("No Supabase JWT template token was returned from Clerk.");
      }

      const supabase = getSupabaseBrowserClient(token);
      const { data: campaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("id,user_id,target_url,seed_topic,status,created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (campaignsError) {
        throw campaignsError;
      }

      const campaignIds = (campaigns ?? []).map((campaign) => campaign.id as string);
      if (campaignIds.length === 0) {
        if (mountedRef.current) {
          setData({
            campaigns: (campaigns ?? []) as DashboardPayload["campaigns"],
            keywords: [],
            content: [],
            outreach: [],
            logs: [],
            credentialRequests: []
          });
        }
        return;
      }

      const [keywordsResult, contentResult, outreachResult, logsResult, requestsResult] = await Promise.all([
        supabase
          .from("keywords")
          .select("id,campaign_id,keyword,intent,difficulty,rank_position,created_at")
          .in("campaign_id", campaignIds)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("content_pipeline")
          .select("id,campaign_id,title,slug,publish_status,published_url,created_at")
          .in("campaign_id", campaignIds)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("backlink_outreach")
          .select("id,campaign_id,prospect_domain,outreach_status,contact_email,created_at")
          .in("campaign_id", campaignIds)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("agent_logs")
          .select("id,campaign_id,agent_name,state,message,skill_name,created_at")
          .in("campaign_id", campaignIds)
          .order("created_at", { ascending: false })
          .limit(120),
        supabase
          .from("credential_requests")
          .select("id,user_id,provider,requested_by_agent,reason,status,created_at")
          .order("created_at", { ascending: false })
          .limit(40)
      ]);

      const firstError =
        keywordsResult.error ??
        contentResult.error ??
        outreachResult.error ??
        logsResult.error ??
        requestsResult.error;
      if (firstError) {
        throw firstError;
      }

      if (mountedRef.current) {
        setData({
          campaigns: (campaigns ?? []) as DashboardPayload["campaigns"],
          keywords: (keywordsResult.data ?? []) as DashboardPayload["keywords"],
          content: (contentResult.data ?? []) as DashboardPayload["content"],
          outreach: (outreachResult.data ?? []) as DashboardPayload["outreach"],
          logs: (logsResult.data ?? []) as DashboardPayload["logs"],
          credentialRequests: (requestsResult.data ?? []) as DashboardPayload["credentialRequests"]
        });
      }
    } catch (cause) {
      if (mountedRef.current) {
        setError(cause instanceof Error ? cause.message : "Realtime refresh failed.");
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, [getToken]);

  useEffect(() => {
    mountedRef.current = true;

    let channelCleanup: (() => void) | null = null;
    void (async () => {
      const token = await getToken({ template: "supabase" });
      if (!token) {
        setError("Clerk Supabase token template is required for realtime.");
        return;
      }

      const supabase = getSupabaseBrowserClient(token);
      const channel = supabase
        .channel("seo-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, () => {
          void refreshNow();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "keywords" }, () => {
          void refreshNow();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "content_pipeline" }, () => {
          void refreshNow();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "backlink_outreach" }, () => {
          void refreshNow();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "agent_logs" }, () => {
          void refreshNow();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "credential_requests" }, () => {
          void refreshNow();
        })
        .subscribe();

      channelCleanup = () => {
        void supabase.removeChannel(channel);
      };
    })();

    return () => {
      mountedRef.current = false;
      if (channelCleanup) {
        channelCleanup();
      }
    };
  }, [getToken, refreshNow]);

  const statusMap = useMemo(() => deriveAgentStatus(data.logs), [data.logs]);
  const skillsMap = useMemo(() => deriveEquippedSkills(data.logs), [data.logs]);

  return {
    data,
    isRefreshing,
    statusMap,
    skillsMap,
    refreshNow,
    error
  };
}
