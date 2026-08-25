<?php

namespace App\Http\Controllers\Api;

use App\Enums\MeetingStatus;
use App\Enums\ParticipantRole;
use App\Enums\ParticipantStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Meeting\CreateMeetingRequest;
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
        $isHost = $user && $meeting->isHostedBy($user);

        $displayName = $user?->name ?? $request->input('display_name');

        if (! $displayName) {
            return response()->json(['message' => 'Display name is required.'], 422);
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

        if (! $meeting->isHostedBy($request->user())) {
            return response()->json(['message' => 'Only the host can view the waiting room.'], 403);
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

        if (! $meeting->isHostedBy($request->user())) {
            return response()->json(['message' => 'Only the host can admit participants.'], 403);
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

        if (! $meeting->isHostedBy($request->user())) {
            return response()->json(['message' => 'Only the host can deny participants.'], 403);
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

        if (! $meeting->isHostedBy($request->user())) {
            return response()->json(['message' => 'Only the host can end this meeting.'], 403);
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
                'identity' => $participant->identity,
                'admit_token' => $participant->admit_token,
            ],
            'livekit' => [
                'url' => $this->liveKit->getServerUrl(),
                'token' => $token,
                'room' => $meeting->livekit_room,
            ],
        ];
    }

    private function findByCode(string $code): ?Meeting
    {
        return Meeting::query()->where('code', $code)->first();
    }
}
