

# Add Video Support to CHEESEAmp

## Overview
Enhance CHEESEAmp to play video content for music NFTs that include video clips (music videos). The player will intelligently switch between audio-only and video modes based on the available media.

## Current Architecture
- **MusicNFT interface** already captures `videoUrl` and `clipUrl` fields
- **isMusicNFT()** already detects video-based music NFTs: `if (data.video && (data.artist || data.title || data.album))`
- **musicPlayer.ts** uses an HTMLAudioElement singleton for playback
- **Cover art area** (256x256px) displays album artwork during playback

## Implementation Strategy

### Phase 1: Extend the Media Player

**File: `src/lib/musicPlayer.ts`**

Transform the player to support both audio and video:

1. Add a video element alongside the existing audio element
2. Track current media type (`'audio' | 'video'`)
3. Add `isVideo` flag to PlaybackState interface
4. Modify `play()` to detect if track has video and switch elements accordingly
5. Ensure video element is created lazily and can be mounted to DOM

```text
+----------------------------------+
|   CheeseAmpMedia (singleton)     |
+----------------------------------+
| - audio: HTMLAudioElement        |
| - video: HTMLVideoElement | null |
| - mediaType: 'audio' | 'video'   |
+----------------------------------+
| + play(track, preferVideo?)      |
| + getVideoElement(): HTMLVideo   |
| + isVideoPlaying(): boolean      |
+----------------------------------+
```

### Phase 2: Update PlaybackState Interface

**File: `src/lib/musicPlayer.ts`**

Add new fields:
- `isVideo: boolean` - whether current track is playing as video
- `hasVideo: boolean` - whether current track has video available

### Phase 3: Update MusicNFT Detection

**File: `src/hooks/useMusicNFTs.ts`**

Modify `isMusicNFT()` to better capture video-primary tracks:
- Prioritize `videoUrl` over `audioUrl` when both exist for music videos
- Add `hasVideo` boolean to MusicNFT interface
- Ensure `audioUrl` falls back to video URL if no dedicated audio exists

### Phase 4: Video Player UI Component

**File: `src/components/music/CheeseAmpPlayer.tsx`**

Replace/enhance the CoverArt component in the "Now Playing" section:

1. Create `MediaDisplay` component that conditionally renders:
   - Cover art image (when audio-only or video paused)
   - Video element (when video is playing)
2. Add video toggle button for tracks that have both audio and video
3. Video element styling: 256x256px, object-fit cover, rounded corners
4. Show/hide video controls based on hover state

```text
+---------------------------+
|   MediaDisplay Component  |
+---------------------------+
|  +---------+---------+    |
|  | Video   | Cover   |    |
|  | Element | Art     |    |
|  | (when   | (when   |    |
|  | playing)| audio)  |    |
|  +---------+---------+    |
|                           |
|  [Toggle Video/Audio btn] |
+---------------------------+
```

### Phase 5: Video Indicator in Track List

**File: `src/components/music/CheeseAmpPlayer.tsx`**

Add visual indicator for tracks that have video:
- Small video icon next to track name
- Tooltip: "This track has a music video"

## Technical Details

### Video Element Management
```typescript
// In musicPlayer.ts
private video: HTMLVideoElement | null = null;
private videoContainer: HTMLElement | null = null;

getVideoElement(): HTMLVideoElement {
  if (!this.video) {
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.playsInline = true;
    this.video.loop = false;
    // Share same event listeners as audio
  }
  return this.video;
}

mountVideo(container: HTMLElement): void {
  this.videoContainer = container;
  if (this.video && this.mediaType === 'video') {
    container.appendChild(this.video);
  }
}
```

### Playing Video Tracks
```typescript
async play(track: MusicNFT, preferVideo = true): Promise<void> {
  const useVideo = preferVideo && !!track.videoUrl;
  this.mediaType = useVideo ? 'video' : 'audio';
  
  const mediaUrl = useVideo ? track.videoUrl! : track.audioUrl;
  const element = useVideo ? this.getVideoElement() : this.audio;
  
  // Pause the other element
  if (useVideo) this.audio.pause();
  else this.video?.pause();
  
  // Load and play
  element.src = mediaUrl;
  await element.play();
}
```

### UI Toggle Between Video/Audio
For tracks with both video and audio, show a toggle button:
- Video camera icon when in audio mode (click to switch to video)
- Music note icon when in video mode (click to switch to audio)

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/musicPlayer.ts` | Add video element, media type tracking, mount/unmount methods |
| `src/hooks/useMusicNFTs.ts` | Add `hasVideo` field, ensure videoUrl is captured correctly |
| `src/components/music/CheeseAmpPlayer.tsx` | Replace CoverArt with MediaDisplay, add video toggle, video indicators |

## Summary

This implementation adds native video playback to CHEESEAmp while maintaining backward compatibility with audio-only tracks. The cover art area transforms into a video player when a music video is playing, providing a seamless multimedia experience for WAX music NFT collectors.

