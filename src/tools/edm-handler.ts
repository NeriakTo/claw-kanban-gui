import type { CampaignStats, EdmQueryParams } from '../types.js';
import type { EdmCloudStore } from '../store/edm-store.js';

/**
 * Send marketing emails via Resend, then create a campaign record in the cloud.
 * Uses Resend Batch API for multiple recipients.
 */
export async function handleEdmSend(
  resendApiKey: string,
  params: { to: string; from: string; subject: string; html: string },
  edmStore: EdmCloudStore | null
): Promise<{ success: boolean; campaignId?: string; emailIds?: string[]; message: string }> {
  const recipients = params.to
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return { success: false, message: 'No recipients specified.' };
  }

  let emailIds: string[];

  if (recipients.length === 1) {
    // Single recipient — standard Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: params.from,
        to: recipients,
        subject: params.subject,
        html: params.html,
      }),
    });

    const data = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      return {
        success: false,
        message: `Resend API error (${response.status}): ${data.message ?? JSON.stringify(data)}`,
      };
    }
    emailIds = [data.id as string];
  } else {
    // Multiple recipients — Resend Batch API
    const emails = recipients.map((to) => ({
      from: params.from,
      to: [to],
      subject: params.subject,
      html: params.html,
    }));

    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify(emails),
    });

    const data = (await response.json()) as Record<string, any>;
    if (!response.ok) {
      return {
        success: false,
        message: `Resend Batch API error (${response.status}): ${data.message ?? JSON.stringify(data)}`,
      };
    }
    // Batch response: { data: [{ id: "..." }, ...] }
    emailIds = ((data.data ?? data) as { id: string }[]).map((item) => item.id);
  }

  // Create campaign record in the cloud (if store is available)
  let campaignId: string | undefined;
  if (edmStore) {
    try {
      const campaignRecipients = emailIds.map((emailId, i) => ({
        emailId,
        to: recipients[i] ?? recipients[0],
      }));

      const campaign = await edmStore.createCampaign({
        subject: params.subject,
        fromAddress: params.from,
        htmlSnapshot: params.html,
        tags: ['edm'],
        recipients: campaignRecipients,
      });
      campaignId = campaign.id;
    } catch (err: any) {
      console.warn(`[edm] Campaign record creation failed (emails were sent): ${err.message}`);
    }
  }

  const parts = [
    `Email sent successfully to ${recipients.join(', ')}.`,
    `IDs: ${emailIds.join(', ')}`,
  ];
  if (campaignId) {
    parts.push(`Campaign ID: ${campaignId} — use edm_track to check delivery status later.`);
  }

  return {
    success: true,
    campaignId,
    emailIds,
    message: parts.join(' '),
  };
}

/**
 * Refresh delivery status for a campaign by polling Resend GET /emails/{id}.
 */
export async function handleEdmTrack(
  resendApiKey: string,
  campaignId: string,
  edmStore: EdmCloudStore
): Promise<{ success: boolean; stats: CampaignStats | null; message: string }> {
  // 1. Get campaign recipients from cloud
  const { recipients } = await edmStore.getCampaign(campaignId);

  if (!recipients || recipients.length === 0) {
    return { success: false, stats: null, message: 'No recipients found for this campaign.' };
  }

  // 2. Poll Resend for each emailId
  const updates: { emailId: string; lastEvent: string; lastEventAt: string | null }[] = [];

  for (const recipient of recipients) {
    try {
      const response = await fetch(`https://api.resend.com/emails/${recipient.emailId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${resendApiKey}` },
      });

      if (response.ok) {
        const emailData = (await response.json()) as Record<string, any>;
        updates.push({
          emailId: recipient.emailId,
          lastEvent: emailData.last_event ?? 'sent',
          lastEventAt: emailData.created_at ?? null,
        });
      }
    } catch (err: any) {
      console.warn(`[edm] Failed to poll Resend for ${recipient.emailId}: ${err.message}`);
    }
  }

  // 3. Batch update recipients in cloud
  if (updates.length > 0) {
    await edmStore.updateRecipients(campaignId, updates);
  }

  // 4. Get fresh stats
  const stats = await edmStore.getCampaignStats(campaignId);

  return {
    success: true,
    stats,
    message: `Tracked ${updates.length}/${recipients.length} emails. Delivery rate: ${(stats.deliveryRate * 100).toFixed(1)}%, Open rate: ${(stats.openRate * 100).toFixed(1)}%`,
  };
}

/**
 * Query EDM campaigns — list, detail, stats, or filter recipients.
 */
export async function handleEdmQuery(
  params: EdmQueryParams,
  edmStore: EdmCloudStore
): Promise<any> {
  const limit = params.limit ?? 50;

  switch (params.query) {
    case 'list': {
      const campaigns = await edmStore.listCampaigns(limit);
      return {
        campaigns: campaigns.map((c) => ({
          id: c.id,
          subject: c.subject,
          fromAddress: c.fromAddress,
          totalRecipients: c.totalRecipients,
          createdAt: c.createdAt,
          stats: c.stats,
        })),
      };
    }

    case 'detail': {
      if (!params.campaignId) {
        return { error: 'campaignId is required for detail query' };
      }
      const { campaign, recipients } = await edmStore.getCampaign(params.campaignId);
      return { campaign, recipients };
    }

    case 'stats': {
      if (!params.campaignId) {
        return { error: 'campaignId is required for stats query' };
      }
      const stats = await edmStore.getCampaignStats(params.campaignId);
      return { campaignId: params.campaignId, stats };
    }

    case 'filter': {
      if (!params.campaignId) {
        return { error: 'campaignId is required for filter query' };
      }
      if (!params.filterEvent) {
        return { error: 'filterEvent is required for filter query' };
      }
      const recipients = await edmStore.filterRecipients(
        params.campaignId,
        params.filterEvent,
        params.exclude,
        limit
      );
      return {
        campaignId: params.campaignId,
        filterEvent: params.filterEvent,
        exclude: params.exclude ?? false,
        count: recipients.length,
        recipients,
      };
    }

    default:
      return { error: `Unknown query type: ${params.query}` };
  }
}
