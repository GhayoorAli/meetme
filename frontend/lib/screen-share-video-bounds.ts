export type VideoBounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const SCREEN_SHARE_VIDEO_SELECTORS = [
  '.lk-participant-tile[data-lk-source="screen_share"] video',
  '[data-lk-source="screen_share"] video',
  ".lk-focus-layout video",
  ".lk-focus-layout-wrapper video",
];

/** Overlay sits beside VideoConference — search the shared parent wrapper. */
export function getVideoSearchRoot(overlayContainer: HTMLElement): HTMLElement {
  return overlayContainer.parentElement ?? overlayContainer;
}

export function findScreenShareVideo(
  searchRoot: HTMLElement,
): HTMLVideoElement | null {
  for (const selector of SCREEN_SHARE_VIDEO_SELECTORS) {
    const element = searchRoot.querySelector(selector);
    if (element instanceof HTMLVideoElement && element.videoWidth > 0) {
      return element;
    }
  }

  for (const selector of SCREEN_SHARE_VIDEO_SELECTORS) {
    const element = searchRoot.querySelector(selector);
    if (element instanceof HTMLVideoElement) {
      return element;
    }
  }

  return null;
}

export function getVideoBoundsInContainer(
  video: HTMLVideoElement,
  container: HTMLElement,
): VideoBounds | null {
  const videoRect = video.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  if (videoRect.width < 2 || videoRect.height < 2) {
    return null;
  }

  return {
    left: videoRect.left - containerRect.left,
    top: videoRect.top - containerRect.top,
    width: videoRect.width,
    height: videoRect.height,
  };
}

export function isNormalizedPoint(point: [number, number]): boolean {
  return point[0] >= 0 && point[0] <= 1 && point[1] >= 0 && point[1] <= 1;
}
