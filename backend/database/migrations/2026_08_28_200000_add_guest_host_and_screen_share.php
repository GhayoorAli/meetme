<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('meetings', function (Blueprint $table) {
            $table->string('guest_host_token', 64)->nullable()->unique()->after('host_id');
        });

        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->string('screen_share_permission', 20)->default('none')->after('recording_permission');
            $table->boolean('hand_raised')->default(false)->after('screen_share_permission');
            $table->index(['meeting_id', 'screen_share_permission']);
            $table->index(['meeting_id', 'hand_raised']);
        });

        if (Schema::getConnection()->getDriverName() === 'mysql') {
            Schema::table('meetings', function (Blueprint $table) {
                $table->dropForeign(['host_id']);
            });
            DB::statement('ALTER TABLE meetings MODIFY host_id BIGINT UNSIGNED NULL');
            Schema::table('meetings', function (Blueprint $table) {
                $table->foreign('host_id')->references('id')->on('users')->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('meeting_participants', function (Blueprint $table) {
            $table->dropIndex(['meeting_id', 'screen_share_permission']);
            $table->dropIndex(['meeting_id', 'hand_raised']);
            $table->dropColumn(['screen_share_permission', 'hand_raised']);
        });

        Schema::table('meetings', function (Blueprint $table) {
            $table->dropColumn('guest_host_token');
        });
    }
};
