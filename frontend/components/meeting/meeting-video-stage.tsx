"use client";

import {
  ParticipantTile,
  isTrackReference,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { useEffect, useState } from "react";

/**
 * Custom stage instead of <VideoConference />.
 * Avoids LiveKit GridLayout placeholder→track crash.
 */
function tileKey(track: TrackReferenceOrPlaceholder): string {
  return `${track.participant.identity}_${track.source}`;
}

function useMaxVideoColumns() {
  const [maxColumns, setMaxColumns] = useState(3);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 640px)");
    const apply = () => setMaxColumns(media.matches ? 2 : 3);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  return maxColumns;
}

export function MeetingVideoStage() {
  const maxColumns = useMaxVideoColumns();
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const screenShares = tracks.filter(
    (track) =>
      track.source === Track.Source.ScreenShare &&
      isTrackReference(track) &&
      track.publication.isSubscribed &&
      !track.publication.isMuted,
  );
  const cameras = tracks.filter(
    (track) => track.source === Track.Source.Camera,
  );

  const focused = screenShares[0];
  const cameraCount = Math.max(cameras.length, 1);
  const columns = Math.min(Math.ceil(Math.sqrt(cameraCount)), maxColumns);

  return (
    <div className="meet-video-well">
      {focused ? (
        <div className="flex h-full min-h-0 flex-col gap-2 p-2 sm:gap-3 sm:p-3">
          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-[1rem] bg-black sm:rounded-[1.15rem]"
            data-lk-source="screen_share"
          >
            <ParticipantTile trackRef={focused} className="h-full w-full" />
          </div>
          {cameras.length > 0 ? (
            <div className="flex h-20 shrink-0 gap-2 overflow-x-auto pb-1 sm:h-28 sm:gap-3">
              {cameras.map((track) => (
                <ParticipantTile
                  key={tileKey(track)}
                  trackRef={track}
                  className="h-full w-28 shrink-0 overflow-hidden rounded-[1rem] bg-black sm:w-40 sm:rounded-[1.15rem]"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="grid h-full min-h-0 gap-2 p-2 sm:gap-3 sm:p-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {cameras.map((track) => (
            <ParticipantTile
              key={tileKey(track)}
              trackRef={track}
              className="lk-participant-tile min-h-0 overflow-hidden rounded-[1rem] bg-black sm:rounded-[1.15rem]"
            />
          ))}
        </div>
      )}
    </div>
  );
}
