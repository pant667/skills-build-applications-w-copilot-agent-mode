import { CapabilityCard } from './CapabilityCard.js';
export default function Teams() {
  return (
    <CapabilityCard
      title="Teams"
      description="Manage teams and members."
      path="/api/teams"
      responseKey="teams"
      emptyText="No teams yet."
      renderItem={(team) => `${String(team.name)}${team.mascot ? ` - ${String(team.mascot)}` : ''}`}
    />
  );
}
