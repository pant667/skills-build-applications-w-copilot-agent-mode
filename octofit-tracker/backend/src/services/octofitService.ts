import { Activity, Team, User, Workout } from '../models/index.js';
import mongoose from 'mongoose';

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(_input: unknown) {
  const input = _input as Record<string, unknown> | null;
  if (!input) throw httpError(400, 'Activity input is required');

  const { userId, teamId, type, minutes } = input;
  if (
    typeof userId !== 'string'
    || typeof teamId !== 'string'
    || typeof type !== 'string'
    || typeof minutes !== 'number'
  ) {
    throw httpError(400, 'userId, teamId, type, and numeric minutes are required');
  }
  if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(teamId)) {
    throw httpError(400, 'Invalid user or team ID');
  }
  if (!type.trim() || !Number.isFinite(minutes) || minutes < 1) {
    throw httpError(400, 'Activity type and positive minutes are required');
  }

  const [user, team] = await Promise.all([
    User.findById(userId).lean(),
    Team.findById(teamId).lean(),
  ]);
  if (!user || !team) throw httpError(404, 'User or team not found');

  const activity = await Activity.create({
    user: user._id,
    team: team._id,
    type: type.trim(),
    minutes,
    points: minutes,
    occurredAt: new Date(),
  });
  return activity.toObject();
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(_input: unknown) {
  const input = _input as Record<string, unknown> | null;
  if (!input || typeof input.name !== 'string' || !input.name.trim()) {
    throw httpError(400, 'Team name is required');
  }
  if (typeof input.mascot !== 'string' || !input.mascot.trim()) {
    throw httpError(400, 'Team mascot is required');
  }

  const members = Array.isArray(input.members) ? input.members : [];
  if (members.some((member) => typeof member !== 'string' || !mongoose.isValidObjectId(member))) {
    throw httpError(400, 'Team members must be valid user IDs');
  }

  const team = await Team.create({
    name: input.name.trim(),
    mascot: input.mascot.trim(),
    members: members.map((member) => new mongoose.Types.ObjectId(member as string)),
  });
  return team.toObject();
}

export async function getLeaderboard() {
  const teams = await Team.find().lean();
  const totals = new Map<string, number>();
  const activities = await Activity.find().lean();
  for (const activity of activities) {
    const teamId = activity.team.toString();
    totals.set(teamId, (totals.get(teamId) ?? 0) + activity.points);
  }

  return teams
    .map((team) => ({
      teamName: team.name,
      totalPoints: totals.get(team._id.toString()) ?? 0,
    }))
    .sort((left, right) => right.totalPoints - left.totalPoints || left.teamName.localeCompare(right.teamName))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export async function suggestWorkouts(userEmail: string) {
  const user = await User.findOne({ email: userEmail.toLowerCase() }).lean();
  if (!user) throw httpError(404, 'User not found');

  const recentActivity = await Activity.findOne({ user: user._id }).sort({ occurredAt: -1 }).lean();
  const activityFocus: Record<string, string> = {
    run: 'endurance',
    walk: 'mobility',
    cycle: 'endurance',
    strength: 'strength',
  };
  const focus = (recentActivity && activityFocus[recentActivity.type]) || user.fitnessGoal;

  const matching = await Workout.find({ focus }).lean();
  const workouts = matching.length > 0 ? matching : await Workout.find().lean();
  return workouts.map((workout) => ({
    ...workout,
    reason: recentActivity
      ? `Based on your recent ${recentActivity.type} activity and ${focus} goal`
      : `Based on your ${focus} fitness goal`,
  }));
}

export { User };
