<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->boolean('waiting_room_enabled')->default(true)->after('status');
        });

        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->string('status', 20)->default('admitted')->after('role');
            $table->string('admit_token', 64)->nullable()->unique()->after('status');
            $table->index(['meeting_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->dropColumn('waiting_room_enabled');
        });

        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->dropIndex(['meeting_id', 'status']);
            $table->dropColumn(['status', 'admit_token']);
        });
    }
};
