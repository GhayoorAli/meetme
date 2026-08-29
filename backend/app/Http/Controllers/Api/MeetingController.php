<?php

namespace App\Http\Controllers\Api;

use App\Enums\MeetingStatus;
use App\Enums\ParticipantRole;
use App\Enums\ParticipantStatus;
use App\Enums\RecordingPermissionStatus;
use App\Enums\ScreenSharePermissionStatus;
use App\Http\Controllers\Api\Concerns\AuthorizesMeetingHost;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meeting\CreateMeetingRequest;
use App\Http\Requests\Meeting\GuestCreateMeetingRequest;
use App\Http\Requests\Meeting\JoinMeetingRequest;
use App\Http\Resources\MeetingParticipantResource;
use App\Http\Resources\MeetingResource;
use App\Models\Meeting;
use App\Models\MeetingParticipant;
use App\Models\User;
use App\Services\LiveKitTokenService;
use App\Services\MeetingCodeGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

class MeetingController extends Controller
{
    use AuthorizesMeetingHost;

    public function __construct(
        private readonly MeetingCodeGenerator $codeGenerator,
        private readonly LiveKitTokenService $liveKit,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $meetings = Meeting::query()
            ->where('host_id', $request->user()->id)
            ->with('host')
            ->withCount('activeParticipants')
            ->latest()
            ->limit(50)
            ->get();

        return MeetingResource::collection($meetings);
    }

    public function store(CreateMeetingRequest $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $meeting = Meeting::query()->create([
            'host_id' => $user->id,
            'code' => $this->codeGenerator->generate(),
            'title' => $request->validated('title') ?? "{$user->name}'s meeting",
            'livekit_room' => $this->codeGenerator->generateRoomName(),
            'status' => MeetingStatus::Active,
            'waiting_room_enabled' => true,
            'started_at' => now(),
        ]);

        $meeting->load('host');

        return (new MeetingResource($meeting))
            ->response()
            ->setStatusCode(201);
    }

    public function storeGuest(GuestCreateMeetingRequest $request): JsonResponse
    {
        $displayName = $request->validated('display_name');
        $hostToken = Str::random(48);

        $meeting = Meeting::query()->create([
            'host_id' => null,
            'guest_host_token' => $hostToken,
            'code' => $this->codeGenerator->generate(),
            'title' => $request->validated('title') ?? "{$displayName}'s meeting",
            'livekit_room' => $this->codeGenerator->generateRoomName(),
            'status' => MeetingStatus::Active,
            'waiting_room_enabled' => true,
            'started_at' => now(),
        ]);

        return response()->json([
            'meeting' => new MeetingResource($meeting),
            'host_token' => $hostToken,
        ], 201);
    }

    public function show(string $code): MeetingResource|JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $meeting->load('host');

        return new MeetingResource($meeting);
    }

    public function join(JoinMeetingRequest $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if (! $meeting->isJoinable()) {
            return response()->json(['message' => 'This meeting has ended.'], 410);
        }

        /** @var User|null $user */
        $user = $request->user();
        $hostToken = $this->hostTokenFromRequest($request);
        $isHost = ($user && $meeting->isHostedBy($user)) || $meeting->isGuestHost($hostToken);

        $displayName = $user?->name ?? $request->input('display_name');

        if (! $displayName) {
            return response()->json(['message' => 'Display name is required.'], 422);
        }

        $resumeToken = $request->input('admit_token');
        if ($resumeToken) {
            $existing = MeetingParticipant::query()
                ->where('meeting_id', $meeting->id)
                ->where('admit_token', $resumeToken)
                ->first();

            if ($existing) {
                if ($existing->status === ParticipantStatus::Denied) {
                    return response()->json([
                        'status' => 'denied',
                        'message' => 'The host denied your request to join.',
                        'participant' => new MeetingParticipantResource($existing),
                    ]);
                }

                if ($existing->status === ParticipantStatus::Waiting) {
                    return response()->json([
                        'status' => 'waiting',
                        'message' => 'Waiting for the host to admit you.',
                        'meeting' => new MeetingResource($meeting->load('host')),
                        'participant' => [
                            'id' => $existing->id,
                            'display_name' => $existing->display_name,
                            'role' => $existing->role->value,
                            'status' => $existing->status->value,
                            'recording_permission' => $existing->recording_permission->value,
                            'screen_share_permission' => $existing->screen_share_permission->value,
                            'admit_token' => $existing->admit_token,
                        ],
                    ]);
                }

                if ($existing->status === ParticipantStatus::Admitted) {
                    return response()->json(
                        $this->admittedPayload(
                            $meeting,
                            $existing,
                            $existing->role === ParticipantRole::Host,
                        ),
                    );
                }
            }
        }

        if ($user) {
            $existingAdmitted = MeetingParticipant::query()
                ->where('meeting_id', $meeting->id)
                ->where('user_id', $user->id)
                ->where('status', ParticipantStatus::Admitted)
                ->latest()
                ->first();

            if ($existingAdmitted) {
                return response()->json(
                    $this->admittedPayload(
                        $meeting,
                        $existingAdmitted,
                        $meeting->isHostedBy($user),
                    ),
                );
            }
        }

        $identity = $user
            ? "user_{$user->id}"
            : 'guest_'.Str::uuid()->toString();

        $needsWaitingRoom = $meeting->waiting_room_enabled && ! $isHost;
        $status = $needsWaitingRoom
            ? ParticipantStatus::Waiting
            : ParticipantStatus::Admitted;

        $participant = MeetingParticipant::query()->create([
            'meeting_id' => $meeting->id,
            'user_id' => $user?->id,
            'display_name' => $displayName,
            'identity' => $identity,
            'role' => $isHost ? ParticipantRole::Host : ParticipantRole::Guest,
            'status' => $status,
            'recording_permission' => $isHost
                ? RecordingPermissionStatus::Approved
                : RecordingPermissionStatus::None,
            'screen_share_permission' => $isHost
                ? ScreenSharePermissionStatus::Approved
                : ScreenSharePermissionStatus::None,
            'admit_token' => Str::random(48),
            'joined_at' => $status === ParticipantStatus::Admitted ? now() : null,
        ]);

        if ($needsWaitingRoom) {
            return response()->json([
                'status' => 'waiting',
                'message' => 'Waiting for the host to admit you.',
                'meeting' => new MeetingResource($meeting->load('host')),
                'participant' => [
                    'id' => $participant->id,
                    'display_name' => $participant->display_name,
                    'role' => $participant->role->value,
                    'status' => $participant->status->value,
                    'recording_permission' => $participant->recording_permission->value,
                    'screen_share_permission' => $participant->screen_share_permission->value,
                    'admit_token' => $participant->admit_token,
                ],
            ]);
        }

        return response()->json($this->admittedPayload($meeting, $participant, $isHost));
    }

    public function joinStatus(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $token = $request->query('admit_token') ?? $request->input('admit_token');

        if (! $token) {
            return response()->json(['message' => 'Admit token is required.'], 422);
        }

        $participant = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('admit_token', $token)
            ->first();

        if (! $participant) {
            return response()->json(['message' => 'Join request not found.'], 404);
        }

        if ($participant->status === ParticipantStatus::Denied) {
            return response()->json([
                'status' => 'denied',
                'message' => 'The host denied your request to join.',
                'participant' => new MeetingParticipantResource($participant),
            ]);
        }

        if ($participant->status === ParticipantStatus::Waiting) {
            return response()->json([
                'status' => 'waiting',
                'message' => 'Still waiting for the host to admit you.',
                'participant' => new MeetingParticipantResource($participant),
            ]);
        }

        if ($participant->status === ParticipantStatus::Left) {
            return response()->json([
                'status' => 'left',
                'message' => 'You have left this meeting.',
                'participant' => new MeetingParticipantResource($participant),
            ]);
        }

        $isHost = $participant->role === ParticipantRole::Host;

        return response()->json($this->admittedPayload($meeting, $participant, $isHost));
    }

    public function waiting(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        $waiting = $meeting->waitingParticipants()->latest()->get();

        return response()->json([
            'data' => MeetingParticipantResource::collection($waiting),
        ]);
    }

    public function admit(Request $request, string $code, MeetingParticipant $participant): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting || $participant->meeting_id !== $meeting->id) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        if ($participant->status !== ParticipantStatus::Waiting) {
            return response()->json(['message' => 'This participant is not waiting.'], 422);
        }

        $participant->update([
            'status' => ParticipantStatus::Admitted,
            'joined_at' => now(),
        ]);

        return response()->json([
            'message' => 'Participant admitted.',
            'participant' => new MeetingParticipantResource($participant->fresh()),
        ]);
    }

    public function deny(Request $request, string $code, MeetingParticipant $participant): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting || $participant->meeting_id !== $meeting->id) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        if ($participant->status !== ParticipantStatus::Waiting) {
            return response()->json(['message' => 'This participant is not waiting.'], 422);
        }

        $participant->update([
            'status' => ParticipantStatus::Denied,
            'left_at' => now(),
        ]);

        return response()->json([
            'message' => 'Participant denied.',
            'participant' => new MeetingParticipantResource($participant->fresh()),
        ]);
    }

    public function leave(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $token = $request->input('admit_token');
        $identity = $request->input('identity');

        $participant = MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->when($token, fn ($q) => $q->where('admit_token', $token))
            ->when(! $token && $identity, fn ($q) => $q->where('identity', $identity))
            ->whereIn('status', [ParticipantStatus::Waiting->value, ParticipantStatus::Admitted->value])
            ->latest()
            ->first();

        if ($participant) {
            $participant->update([
                'status' => ParticipantStatus::Left,
                'left_at' => now(),
            ]);
        }

        return response()->json(['message' => 'Left meeting.']);
    }

    public function end(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        $meeting->update([
            'status' => MeetingStatus::Ended,
            'ended_at' => now(),
        ]);

        $meeting->participants()
            ->whereIn('status', [ParticipantStatus::Waiting->value, ParticipantStatus::Admitted->value])
            ->update([
                'status' => ParticipantStatus::Left,
                'left_at' => now(),
            ]);

        return response()->json([
            'message' => 'Meeting ended.',
            'meeting' => new MeetingResource($meeting->fresh('host')),
        ]);
    }

    public function requestRecording(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $participant = $this->resolveParticipant($request, $meeting);

        if (! $participant) {
            return response()->json(['message' => 'Participant not found.'], 404);
        }

        if ($participant->role === ParticipantRole::Host) {
            return response()->json(['message' => 'Hosts can record without requesting permission.'], 422);
        }

        if ($participant->status !== ParticipantStatus::Admitted) {
            return response()->json(['message' => 'You must be in the meeting to request recording.'], 422);
        }

        if ($participant->recording_permission === RecordingPermissionStatus::Approved) {
            return response()->json([
                'message' => 'You already have permission to record.',
                'recording_permission' => $participant->recording_permission->value,
            ]);
        }

        if ($participant->recording_permission === RecordingPermissionStatus::Pending) {
            return response()->json([
                'message' => 'Your recording request is pending host approval.',
                'recording_permission' => $participant->recording_permission->value,
            ]);
        }

        $participant->update([
            'recording_permission' => RecordingPermissionStatus::Pending,
        ]);

        return response()->json([
            'message' => 'Recording permission requested. Waiting for host approval.',
            'recording_permission' => RecordingPermissionStatus::Pending->value,
        ]);
    }

    public function recordingStatus(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $participant = $this->resolveParticipant($request, $meeting);

        if (! $participant) {
            return response()->json(['message' => 'Participant not found.'], 404);
        }

        return response()->json([
            'recording_permission' => $participant->recording_permission->value,
            'can_record' => $participant->canRecord(),
        ]);
    }

    public function recordingRequests(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        $pending = $meeting->pendingRecordingRequests()->latest()->get();

        return response()->json([
            'data' => MeetingParticipantResource::collection($pending),
        ]);
    }

    public function approveRecording(Request $request, string $code, MeetingParticipant $participant): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting || $participant->meeting_id !== $meeting->id) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        if ($participant->recording_permission !== RecordingPermissionStatus::Pending) {
            return response()->json(['message' => 'This participant has not requested recording.'], 422);
        }

        $participant->update([
            'recording_permission' => RecordingPermissionStatus::Approved,
        ]);

        return response()->json([
            'message' => 'Recording approved.',
            'participant' => new MeetingParticipantResource($participant->fresh()),
        ]);
    }

    public function denyRecording(Request $request, string $code, MeetingParticipant $participant): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting || $participant->meeting_id !== $meeting->id) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        if ($participant->recording_permission !== RecordingPermissionStatus::Pending) {
            return response()->json(['message' => 'This participant has not requested recording.'], 422);
        }

        $participant->update([
            'recording_permission' => RecordingPermissionStatus::Denied,
        ]);

        return response()->json([
            'message' => 'Recording denied.',
            'participant' => new MeetingParticipantResource($participant->fresh()),
        ]);
    }

    public function requestScreenShare(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $participant = $this->resolveParticipant($request, $meeting);

        if (! $participant) {
            return response()->json(['message' => 'Participant not found.'], 404);
        }

        if ($participant->role === ParticipantRole::Host) {
            return response()->json(['message' => 'Hosts can share their screen without requesting permission.'], 422);
        }

        if ($participant->status !== ParticipantStatus::Admitted) {
            return response()->json(['message' => 'You must be in the meeting to request screen share.'], 422);
        }

        if ($participant->screen_share_permission === ScreenSharePermissionStatus::Approved) {
            return response()->json([
                'message' => 'You already have permission to share your screen.',
                'screen_share_permission' => $participant->screen_share_permission->value,
            ]);
        }

        if ($participant->screen_share_permission === ScreenSharePermissionStatus::Pending) {
            return response()->json([
                'message' => 'Your screen share request is pending host approval.',
                'screen_share_permission' => $participant->screen_share_permission->value,
            ]);
        }

        $participant->update([
            'screen_share_permission' => ScreenSharePermissionStatus::Pending,
        ]);

        return response()->json([
            'message' => 'Screen share permission requested. Waiting for host approval.',
            'screen_share_permission' => ScreenSharePermissionStatus::Pending->value,
        ]);
    }

    public function screenShareStatus(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        $participant = $this->resolveParticipant($request, $meeting);

        if (! $participant) {
            return response()->json(['message' => 'Participant not found.'], 404);
        }

        return response()->json([
            'screen_share_permission' => $participant->screen_share_permission->value,
            'can_share_screen' => $participant->canShareScreen(),
        ]);
    }

    public function screenShareRequests(Request $request, string $code): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        $pending = $meeting->pendingScreenShareRequests()->latest()->get();

        return response()->json([
            'data' => MeetingParticipantResource::collection($pending),
        ]);
    }

    public function approveScreenShare(Request $request, string $code, MeetingParticipant $participant): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting || $participant->meeting_id !== $meeting->id) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        if ($participant->screen_share_permission !== ScreenSharePermissionStatus::Pending) {
            return response()->json(['message' => 'This participant has not requested screen share.'], 422);
        }

        $participant->update([
            'screen_share_permission' => ScreenSharePermissionStatus::Approved,
        ]);

        return response()->json([
            'message' => 'Screen share approved.',
            'participant' => new MeetingParticipantResource($participant->fresh()),
        ]);
    }

    public function denyScreenShare(Request $request, string $code, MeetingParticipant $participant): JsonResponse
    {
        $meeting = $this->findByCode($code);

        if (! $meeting || $participant->meeting_id !== $meeting->id) {
            return response()->json(['message' => 'Meeting not found.'], 404);
        }

        if ($denied = $this->denyUnlessHost($meeting, $request)) {
            return $denied;
        }

        if ($participant->screen_share_permission !== ScreenSharePermissionStatus::Pending) {
            return response()->json(['message' => 'This participant has not requested screen share.'], 422);
        }

        $participant->update([
            'screen_share_permission' => ScreenSharePermissionStatus::Denied,
        ]);

        return response()->json([
            'message' => 'Screen share denied.',
            'participant' => new MeetingParticipantResource($participant->fresh()),
        ]);
    }

    private function resolveParticipant(Request $request, Meeting $meeting): ?MeetingParticipant
    {
        $token = $request->input('admit_token') ?? $request->query('admit_token');
        $identity = $request->input('identity');

        return MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->when($token, fn ($q) => $q->where('admit_token', $token))
            ->when(! $token && $identity, fn ($q) => $q->where('identity', $identity))
            ->when(! $token && ! $identity && $request->user(), function ($q) use ($request, $meeting) {
                $q->where('user_id', $request->user()->id)
                    ->whereIn('status', [ParticipantStatus::Admitted->value, ParticipantStatus::Waiting->value]);
            })
            ->latest()
            ->first();
    }

    /**
     * @return array<string, mixed>
     */
    private function admittedPayload(Meeting $meeting, MeetingParticipant $participant, bool $isHost): array
    {
        $token = $this->liveKit->createAccessToken(
            roomName: $meeting->livekit_room,
            identity: $participant->identity,
            displayName: $participant->display_name,
            isHost: $isHost,
        );

        return [
            'status' => 'admitted',
            'meeting' => new MeetingResource($meeting->load('host')),
            'participant' => [
                'id' => $participant->id,
                'display_name' => $participant->display_name,
                'role' => $participant->role->value,
                'status' => $participant->status->value,
                'recording_permission' => $participant->recording_permission->value,
                'screen_share_permission' => $participant->screen_share_permission->value,
                'identity' => $participant->identity,
                'admit_token' => $participant->admit_token,
            ],
            'host_identity' => $this->hostIdentityForMeeting($meeting),
            'livekit' => [
                'url' => $this->liveKit->getServerUrl(),
                'token' => $token,
                'room' => $meeting->livekit_room,
            ],
        ];
    }

    private function hostIdentityForMeeting(Meeting $meeting): ?string
    {
        return MeetingParticipant::query()
            ->where('meeting_id', $meeting->id)
            ->where('role', ParticipantRole::Host)
            ->where('status', ParticipantStatus::Admitted)
            ->orderByDesc('joined_at')
            ->value('identity');
    }

    private function findByCode(string $code): ?Meeting
    {
        return Meeting::query()->where('code', $code)->first();
    }
}
