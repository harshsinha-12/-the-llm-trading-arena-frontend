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
        <div style={{ display: "flex", borderBottom: "2px solid #000", fontSize: "0.85rem" }}>
            <Link
                href="/"
                style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "0.5rem 1rem",
                    borderRight: "2px solid #000",
                    fontWeight: "bold",
                    backgroundColor: !active ? "#000" : "transparent",
                    color: !active ? "#fff" : "#000",
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
                            padding: "0.5rem 1rem",
                            borderRight: "2px solid #000",
                            backgroundColor: isActive ? "#000" : m.color,
                            color: isActive ? "#fff" : "#000",
                            fontWeight: isActive ? "bold" : "normal",
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
