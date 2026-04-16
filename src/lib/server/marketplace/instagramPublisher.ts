const IG_API = 'https://graph.instagram.com/v25.0';

export interface PublishResult {
  success: boolean;
  igMediaId?: string;
  permalink?: string;
  error?: string;
}

/** Create a media container for a single image. */
export async function createImageContainer(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string,
  altText?: string,
): Promise<string> {
  const params: Record<string, string> = {
    image_url: imageUrl,
    caption,
    access_token: token,
  };
  if (altText) params.alt_text = altText;

  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Container creation failed');
  return data.id;
}

/** Create a media container for a video (feed post or reel). */
export async function createVideoContainer(
  igUserId: string,
  token: string,
  videoUrl: string,
  caption: string,
  mediaType: 'VIDEO' | 'REELS',
): Promise<string> {
  const params: Record<string, string> = {
    video_url: videoUrl,
    caption,
    media_type: mediaType,
    access_token: token,
  };

  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Container creation failed');
  return data.id;
}

/** Create a story container. */
export async function createStoryContainer(
  igUserId: string,
  token: string,
  mediaUrl: string,
  isVideo: boolean,
): Promise<string> {
  const params: Record<string, string> = {
    media_type: 'STORIES',
    access_token: token,
  };
  if (isVideo) {
    params.video_url = mediaUrl;
  } else {
    params.image_url = mediaUrl;
  }

  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Story container failed');
  return data.id;
}

/** Create carousel: first create child containers, then the parent. */
export async function createCarouselContainer(
  igUserId: string,
  token: string,
  items: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO' }>,
  caption: string,
): Promise<string> {
  const childIds: string[] = [];
  for (const item of items) {
    const params: Record<string, string> = {
      is_carousel_item: 'true',
      access_token: token,
    };
    if (item.mediaType === 'IMAGE') {
      params.image_url = item.url;
    } else {
      params.video_url = item.url;
      params.media_type = 'VIDEO';
    }

    const res = await fetch(`${IG_API}/${igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const data = await res.json();
    if (!res.ok || !data.id) throw new Error(data.error?.message || 'Carousel item failed');
    childIds.push(data.id);
  }

  for (const childId of childIds) {
    await waitForContainer(childId, token);
  }

  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'CAROUSEL',
      caption,
      children: childIds.join(','),
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Carousel container failed');
  return data.id;
}

/** Poll container status until FINISHED or error. Max 5 min. */
export async function waitForContainer(containerId: string, token: string): Promise<void> {
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${IG_API}/${containerId}?fields=status_code&access_token=${token}`,
    );
    const data = await res.json();
    const status = data.status_code;
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Container ${containerId} status: ${status}`);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error(`Container ${containerId} timed out after 5 minutes`);
}

/** Publish a ready container. */
export async function publishContainer(
  igUserId: string,
  token: string,
  containerId: string,
): Promise<{ igMediaId: string }> {
  const res = await fetch(`${IG_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      creation_id: containerId,
      access_token: token,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.id) throw new Error(data.error?.message || 'Publish failed');
  return { igMediaId: data.id };
}

/** Fetch permalink for a published post. */
export async function fetchPermalink(mediaId: string, token: string): Promise<string> {
  const res = await fetch(
    `${IG_API}/${mediaId}?fields=permalink&access_token=${token}`,
  );
  const data = await res.json();
  return data.permalink || '';
}

/** Full publish flow: create container → wait → publish → get permalink. */
export async function publishPost(
  igUserId: string,
  token: string,
  post: {
    gcsUrl: string;
    mediaType: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL';
    caption: string;
    altText?: string;
    carouselItems?: Array<{ url: string; mediaType: 'IMAGE' | 'VIDEO' }>;
  },
): Promise<PublishResult> {
  try {
    let containerId: string;

    switch (post.mediaType) {
      case 'IMAGE':
        containerId = await createImageContainer(igUserId, token, post.gcsUrl, post.caption, post.altText);
        break;
      case 'VIDEO':
        containerId = await createVideoContainer(igUserId, token, post.gcsUrl, post.caption, 'VIDEO');
        break;
      case 'REELS':
        containerId = await createVideoContainer(igUserId, token, post.gcsUrl, post.caption, 'REELS');
        break;
      case 'STORIES':
        containerId = await createStoryContainer(igUserId, token, post.gcsUrl, post.gcsUrl.endsWith('.mp4'));
        break;
      case 'CAROUSEL':
        if (!post.carouselItems?.length) throw new Error('Carousel requires items');
        containerId = await createCarouselContainer(igUserId, token, post.carouselItems, post.caption);
        break;
      default:
        throw new Error(`Unsupported media type: ${post.mediaType}`);
    }

    await waitForContainer(containerId, token);
    const { igMediaId } = await publishContainer(igUserId, token, containerId);
    const permalink = await fetchPermalink(igMediaId, token);

    return { success: true, igMediaId, permalink };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
