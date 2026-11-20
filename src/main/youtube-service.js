const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const REQUEST_TIMEOUT_MS = 12000;

async function requestJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error && payload.error.message
      ? payload.error.message
      : `YouTube Data API respondeu com HTTP ${response.status}.`;
    throw new Error(message);
  }
  return payload;
}

async function getChannelStatus({ channelId, apiKey }) {
  if (!channelId || !apiKey) {
    throw new Error("Informe o ID do canal e uma chave da YouTube Data API v3.");
  }

  const channelUrl = new URL(`${YOUTUBE_API}/channels`);
  channelUrl.search = new URLSearchParams({
    part: "snippet,statistics",
    id: channelId,
    key: apiKey
  });
  const channelData = await requestJson(channelUrl);
  const channel = channelData.items && channelData.items[0];
  if (!channel) throw new Error("O canal não foi encontrado ou não está público.");

  const liveUrl = new URL(`${YOUTUBE_API}/search`);
  liveUrl.search = new URLSearchParams({
    part: "snippet",
    channelId,
    eventType: "live",
    type: "video",
    maxResults: "1",
    key: apiKey
  });
  const liveData = await requestJson(liveUrl);
  const live = liveData.items && liveData.items[0];

  return {
    channelName: channel.snippet.title,
    subscriberCount: channel.statistics.hiddenSubscriberCount
      ? null
      : channel.statistics.subscriberCount || null,
    live: live ? {
      title: live.snippet.title,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(live.id.videoId)}`
    } : null
  };
}

module.exports = { getChannelStatus };
