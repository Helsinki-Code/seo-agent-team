"use client";

import { Canvas } from "@react-three/fiber";
import { Float, OrbitControls, RoundedBox, Text } from "@react-three/drei";
import { useMemo } from "react";
import type { DashboardPayload } from "../lib/seo-data";
import { useRealtimeSeoData } from "../hooks/use-realtime-seo-data";

const agentLayout = [
  { name: "Shiva", x: -4, z: -2 },
  { name: "Brahma", x: -1.5, z: -2 },
  { name: "Vishnu", x: 1.5, z: -2 },
  { name: "Hanuman", x: 4, z: -2 },
  { name: "Lakshmi", x: -2.5, z: 1.5 },
  { name: "Nandi", x: 2.5, z: 1.5 }
];

export function SeoOfficeLive({ initialData }: { initialData: DashboardPayload }) {
  const { statusMap, skillsMap, data } = useRealtimeSeoData(initialData);
  const agents = useMemo(
    () =>
      agentLayout.map((agent) => ({
        ...agent,
        status: statusMap[agent.name]?.state ?? "Idle",
        detail: statusMap[agent.name]?.message ?? "Waiting for campaign cycle",
        skill: statusMap[agent.name]?.skill ?? null
      })),
    [statusMap]
  );

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 xl:grid-cols-[1.4fr_1fr]">
      <section className="h-[620px] overflow-hidden rounded-3xl border border-white/10 bg-[var(--panel)]">
        <Canvas camera={{ position: [0, 7, 12], fov: 50 }}>
          <color attach="background" args={["#060b16"]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[8, 12, 4]} intensity={1.2} color="#7dd3fc" />
          <pointLight position={[-8, 4, 3]} intensity={0.7} color="#fbbf24" />

          <RoundedBox args={[16, 0.2, 10]} radius={0.12} position={[0, -0.1, 0]}>
            <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.75} />
          </RoundedBox>

          {agents.map((agent) => (
            <AgentAvatar
              key={agent.name}
              name={agent.name}
              position={[agent.x, 0.6, agent.z]}
              status={agent.status}
              detail={agent.detail}
            />
          ))}

          <OrbitControls enablePan={false} minDistance={8} maxDistance={16} maxPolarAngle={1.3} />
        </Canvas>
      </section>

      <section className="space-y-4">
        <article className="rounded-2xl border border-white/10 bg-[var(--panel)] p-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">Agent Live States</h2>
          <div className="mt-3 space-y-2">
            {agents.map((agent) => (
              <div key={agent.name} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-semibold text-[var(--text)]">{agent.name}</p>
                <p className="text-xs text-cyan-300">{agent.status}</p>
                <p className="text-xs text-[var(--muted)]">{agent.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-[var(--panel)] p-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">Equipped Skills</h2>
          <div className="mt-3 space-y-2">
            {Object.entries(skillsMap).map(([agent, skills]) => (
              <div key={agent} className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm">
                <p className="font-semibold text-[var(--text)]">{agent}</p>
                <p className="text-xs text-[var(--muted)]">{skills.join(", ")}</p>
              </div>
            ))}
            {Object.keys(skillsMap).length === 0 ? <p className="text-sm text-[var(--muted)]">No installed skills yet.</p> : null}
          </div>
        </article>

        <article className="rounded-2xl border border-white/10 bg-[var(--panel)] p-4">
          <h2 className="text-lg font-semibold text-[var(--text)]">Campaign Coverage</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Active campaigns: {data.campaigns.length}</p>
          <p className="text-sm text-[var(--muted)]">Tracked keywords: {data.keywords.length}</p>
          <p className="text-sm text-[var(--muted)]">Published assets: {data.content.length}</p>
        </article>
      </section>
    </main>
  );
}

function AgentAvatar({
  name,
  position,
  status,
  detail
}: {
  name: string;
  position: [number, number, number];
  status: string;
  detail: string;
}) {
  const searching = status.includes("Searching");
  const active = status.includes("Active");
  const color = searching ? "#f59e0b" : active ? "#22d3ee" : "#22c55e";

  return (
    <Float speed={active ? 2.3 : 1.1} rotationIntensity={0.25} floatIntensity={0.5}>
      <group position={position}>
        <mesh>
          <icosahedronGeometry args={[0.68, 1]} />
          <meshStandardMaterial color={color} roughness={0.35} metalness={0.45} emissive={color} emissiveIntensity={0.2} />
        </mesh>

        <Text position={[0, 1.2, 0]} fontSize={0.28} color="#f8fafc">
          {name}
        </Text>
        <Text position={[0, 0.85, 0]} fontSize={0.18} color={searching ? "#fbbf24" : active ? "#67e8f9" : "#86efac"} maxWidth={3}>
          {status}
        </Text>
        <Text position={[0, 0.55, 0]} fontSize={0.12} color="#94a3b8" maxWidth={3.4}>
          {detail.slice(0, 64)}
        </Text>
      </group>
    </Float>
  );
}
