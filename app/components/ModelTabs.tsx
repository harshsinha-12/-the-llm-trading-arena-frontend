import Link from "next/link";

export type ModelTabItem = {
    modelId: string;
    name: string;
    color: string;
};

export default function ModelTabs({
    models,
    active,
}: {
    models: ModelTabItem[];
    active?: string | null; // modelId of the active tab, or null for Aggregate
}) {
    return (
        <div style={{ 
            display: "flex", 
            borderBottom: "1px solid var(--landing-line)", 
            fontSize: "14px",
            fontFamily: "var(--font-mono), monospace",
            background: "var(--landing-surface-low)"
        }}>
            <Link
                href="/"
                style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "8px 16px",
                    borderRight: "1px solid var(--landing-line)",
                    fontWeight: !active ? 800 : 400,
                    backgroundColor: !active ? "var(--landing-surface)" : "transparent",
                    color: "var(--landing-line)",
                    whiteSpace: "nowrap",
                    textDecoration: "none",
                }}
            >
                Aggregate Index
            </Link>
            {models.map((m) => {
                const isActive = active === m.modelId;
                return (
                    <Link
                        key={m.modelId}
                        href={`/models/${m.modelId}`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            padding: "8px 16px",
                            borderRight: "1px solid var(--landing-line)",
                            backgroundColor: isActive ? "var(--landing-purple)" : "transparent",
                            color: "var(--landing-line)",
                            fontWeight: isActive ? 800 : 400,
                            whiteSpace: "nowrap",
                            textDecoration: "none",
                        }}
                    >
                        {m.name}
                    </Link>
                );
            })}
        </div>
    );
}
