"use client";

import {
  ParticipantTile,
  isTrackReference,
  useTracks,
  type TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import { Track } from "livekit-client";

/**
 * Custom stage instead of <VideoConference />.
 * Avoids LiveKit GridLayout placeholder→track crash.
 */
function tileKey(track: TrackReferenceOrPlaceholder): string {
  return `${track.participant.identity}_${track.source}`;
}

export function MeetingVideoStage() {
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
  const columns = Math.min(Math.ceil(Math.sqrt(cameraCount)), 3);

  return (
    <div className="meet-video-well">
      {focused ? (
        <div className="flex h-full min-h-0 flex-col gap-3 p-3">
          <div
            className="relative min-h-0 flex-1 overflow-hidden rounded-[1.15rem] bg-black"
            data-lk-source="screen_share"
          >
            <ParticipantTile trackRef={focused} className="h-full w-full" />
          </div>
          {cameras.length > 0 ? (
            <div className="flex h-28 shrink-0 gap-3 overflow-x-auto pb-1">
              {cameras.map((track) => (
                <ParticipantTile
                  key={tileKey(track)}
                  trackRef={track}
                  className="h-full w-40 shrink-0 overflow-hidden rounded-[1.15rem] bg-black"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="grid h-full min-h-0 gap-3 p-3"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {cameras.map((track) => (
            <ParticipantTile
              key={tileKey(track)}
              trackRef={track}
              className="lk-participant-tile min-h-0 overflow-hidden rounded-[1.15rem] bg-black"
            />
          ))}
        </div>
      )}
    </div>
  );
}
