interface Props {
    presets: {
        spaces: string[];
        facilities: string[];
        seats: string[];
    };
    selected: {
        spaces: string[];
        facilities: string[];
        seats: string[];
    };
    onChange: (selected: any) => void;
    onComplete: () => void;
}

export default function CategorySelector({ presets, selected, onChange, onComplete }: Props) {
    return (
        <div className="space-y-8">
            <CategorySection
                title="공간"
                icon="🏢"
                options={presets.spaces}
                selected={selected.spaces}
                onChange={(spaces) => onChange({ ...selected, spaces })}
            />

            <CategorySection
                title="시설"
                icon="🔧"
                options={presets.facilities}
                selected={selected.facilities}
                onChange={(facilities) => onChange({ ...selected, facilities })}
            />

            <CategorySection
                title="좌석"
                icon="💺"
                options={presets.seats}
                selected={selected.seats}
                onChange={(seats) => onChange({ ...selected, seats })}
            />

            <button onClick={onComplete} className="px-6 py-3 bg-yellow-400 rounded-xl">
                완료하고 마이페이지로
            </button>
        </div>
    );
}

function CategorySection({ title, icon, options, selected, onChange }) {
    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-xl font-bold mb-4">{icon} {title}</h3>
            <div className="flex flex-wrap gap-2">
                {options.map(option => (
                    <button
                        key={option}
                        onClick={() => {
                            const newSelected = selected.includes(option)
                                ? selected.filter(s => s !== option)
                                : [...selected, option];
                            onChange(newSelected);
                        }}
                        className={`px-4 py-2 rounded-xl transition-all ${selected.includes(option)
                            ? 'bg-yellow-400 text-gray-900 font-semibold'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        {option}
                    </button>
                ))}
            </div>
        </div>
    );
}